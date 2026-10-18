"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { pool } from "@/lib/db";
import { checkNewAccount } from "@/lib/invite-core";
import { findInvitation } from "@/lib/invites";
import { createSession } from "@/lib/session";

export type JoinState = { error?: string };

const INVALID = "This invitation link is not valid. It may have expired or already been used. Ask your administrator for a new one.";

// Light in-process throttle on invalid links: 20 per 15 minutes per address. Tokens carry 256 bits, so guessing
// is not a realistic attack; this only keeps a script from hammering the endpoint.
const failures = new Map<string, { count: number; until: number }>();
const WINDOW = 15 * 60_000;
const LIMIT = 20;

async function clientKey() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export async function acceptInvitation(_: JoinState, form: FormData): Promise<JoinState> {
  const key = await clientKey();
  const seen = failures.get(key);
  if (seen && seen.until > Date.now() && seen.count >= LIMIT) return { error: "Too many attempts. Try again in a few minutes." };
  const fail = () => {
    const next = seen && seen.until > Date.now() ? seen.count + 1 : 1;
    failures.set(key, { count: next, until: Date.now() + WINDOW });
    return { error: INVALID };
  };

  const invitation = await findInvitation(String(form.get("token") ?? ""));
  if (!invitation || invitation.state !== "open") return fail();

  const checked = checkNewAccount(
    {
      name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""), confirm: String(form.get("confirm") ?? "")
    },
    invitation.email
  );
  if ("error" in checked) return { error: checked.error };

  // Hash only after the link has been checked, so a bad link cannot be used to burn CPU.
  const passwordHash = await bcrypt.hash(String(form.get("password")), 12);

  let userId: string;
  const client = await pool().connect();
  try {
    await client.query("begin");
    // Claim the invitation atomically: of two simultaneous requests, only one gets a row back.
    const claimed = await client.query<{ role: string }>(
      `update invitations set used_at = now()
       where id = $1 and used_at is null and revoked_at is null and expires_at > now() returning role`,
      [invitation.id]
    );
    if (!claimed.rows[0]) {
      await client.query("rollback");
      return fail();
    }
    const created = await client.query<{ id: string }>(
      "insert into users (email, name, role, password_hash) values ($1, $2, $3, $4) returning id",
      [checked.email, checked.name, claimed.rows[0].role, passwordHash]
    );
    userId = created.rows[0].id;
    await client.query("update invitations set used_by = $2 where id = $1", [invitation.id, userId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    if ((error as { code?: string }).code === "23505") {
      // The email is taken. The rollback above also released the invitation, so it can still be used.
      return { error: "An account with this email already exists. Sign in instead, or ask for an invitation with a different address." };
    }
    throw error;
  } finally {
    client.release();
  }

  failures.delete(key);
  await audit(userId, "accept", "invitation", invitation.id, { role: invitation.role, email: checked.email });
  await createSession(userId);
  redirect("/");
}
