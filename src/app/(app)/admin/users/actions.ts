"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { baseUrl } from "@/lib/base-url";
import { one } from "@/lib/db";
import { buildInviteEmail } from "@/lib/email-templates";
import { text, type FormState } from "@/lib/form-state";
import { INVITE_DAYS, INVITE_ROLES, MAX_OPEN_INVITES, generateInviteToken, isValidEmail, type InviteRole } from "@/lib/invite-core";
import { emailConfigured, sendEmail } from "@/lib/notify";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { requireUser } from "@/lib/session";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function otherActiveAdmins(exceptId: string) {
  const row = await one<{ n: number }>("select count(*)::int as n from users where role = 'admin' and active and id <> $1", [exceptId]);
  return row?.n ?? 0;
}

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("admin");
  const email = text(form, "email", 200).toLowerCase();
  const name = text(form, "name", 120);
  const role = text(form, "role") as Role;
  const password = String(form.get("password") ?? "");
  if (!EMAIL.test(email)) return { error: "Enter a valid email." };
  if (!name) return { error: "Name is required." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  if (password.length < 10) return { error: "The initial password must have at least 10 characters." };
  if (await one("select 1 from users where email = $1", [email])) return { error: "A user with this email already exists." };
  const user = await one<{ id: string }>(
    "insert into users (email, name, role, password_hash) values ($1, $2, $3, $4) returning id",
    [email, name, role, await bcrypt.hash(password, 12)]
  );
  await audit(admin.id, "create", "user", user!.id, { email, role });
  revalidatePath("/admin/users");
  return { ok: `${name} can now sign in as ${email}. Share the initial password securely and ask them to change it.` };
}

export async function updateUser(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("admin");
  const id = text(form, "id");
  const role = text(form, "role") as Role;
  const active = form.get("active") === "on";
  const name = text(form, "name", 120);
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  if (!name) return { error: "Name is required." };
  const target = await one<{ role: Role; active: boolean }>("select role, active from users where id = $1", [id]);
  if (!target) return { error: "User not found." };
  const losesAdmin = target.role === "admin" && target.active && (role !== "admin" || !active);
  if (losesAdmin && (await otherActiveAdmins(id)) === 0) return { error: "At least one active administrator must remain." };
  if (id === admin.id && !active) return { error: "You cannot deactivate your own account." };
  await one("update users set name = $2, role = $3, active = $4 where id = $1", [id, name, role, active]);
  await audit(admin.id, "update", "user", id, { role, active });
  revalidatePath("/admin/users");
  return { ok: "User updated." };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("admin");
  const id = text(form, "id");
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { error: "The new password must have at least 10 characters." };
  const user = await one<{ email: string }>("update users set password_hash = $2 where id = $1 returning email", [id, await bcrypt.hash(password, 12)]);
  if (!user) return { error: "User not found." };
  await audit(admin.id, "reset_password", "user", id);
  return { ok: `Password for ${user.email} was reset.` };
}

/**
 * Creates a one-time invitation link. The link is shown once and only its hash is stored, so a lost link is
 * revoked and replaced, never looked up. Invitations can create operators and read-only users, not administrators.
 */
export async function createInvitation(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("admin");
  const role = text(form, "role") as InviteRole;
  const email = text(form, "email", 200).toLowerCase();
  const note = text(form, "note", 120);
  const days = Number(form.get("days"));
  if (!INVITE_ROLES.includes(role)) return { error: "Choose Operator or Authorized user. Administrators are added with a password under “Add user”." };
  if (!(INVITE_DAYS as readonly number[]).includes(days)) return { error: "Choose how long the link stays valid." };
  if (email && !isValidEmail(email)) return { error: "Enter a valid email, or leave it empty." };
  if (email && (await one("select 1 from users where email = $1", [email]))) return { error: "A user with this email already exists." };
  const open = await one<{ n: number }>("select count(*)::int as n from invitations where used_at is null and revoked_at is null and expires_at > now()");
  if ((open?.n ?? 0) >= MAX_OPEN_INVITES) return { error: `There are already ${MAX_OPEN_INVITES} open invitations. Revoke some first.` };

  const { token, hash } = generateInviteToken();
  const invitation = await one<{ id: string }>(
    `insert into invitations (token_hash, role, email, note, created_by, expires_at)
     values ($1, $2, $3, $4, $5, now() + make_interval(days => $6)) returning id`,
    [hash, role, email || null, note, admin.id, days]
  );
  // The token itself is never written to the audit log.
  await audit(admin.id, "create", "invitation", invitation!.id, { role, email: email || null, days });
  const link = `${await baseUrl()}/join/${token}`;

  let sent = "";
  if (email) {
    if (!emailConfigured()) sent = " Email is not set up, so nothing was sent: share the link yourself.";
    else {
      try {
        const organization = (await one<{ value: string }>("select value from settings where key = 'organization_name'"))?.value;
        await sendEmail([email], buildInviteEmail({
          organization: typeof organization === "string" && organization ? organization : "Greecon shpk",
          role: ROLE_LABELS[role], inviter: admin.name, days, link
        }));
        sent = ` It was also emailed to ${email}.`;
      } catch (error) {
        sent = ` The email could not be sent (${(error as Error).message}): share the link yourself.`;
      }
    }
  }
  revalidatePath("/admin/users");
  return { ok: `Invitation created, valid for ${days} days.${sent}`, secret: link };
}

export async function revokeInvitation(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireUser("admin");
  const id = text(form, "id");
  const row = await one<{ id: string }>(
    "update invitations set revoked_at = now() where id = $1 and used_at is null and revoked_at is null returning id",
    [id]
  );
  if (!row) return { error: "That invitation is no longer open." };
  await audit(admin.id, "revoke", "invitation", id);
  revalidatePath("/admin/users");
  return { ok: "Invitation revoked. The link no longer works." };
}
