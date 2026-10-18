// Pure rules for invitations — no I/O, unit-tested in tests/invite.test.ts.
//
// An invitation is a one-time link. The administrator creates it, the invited person opens it and chooses
// their own password, so nobody else ever knows that password. Only a SHA-256 hash of the token is stored.
import { createHash, randomBytes } from "node:crypto";

/** Invitations can only create operators and read-only users. Administrators are created under Users & roles. */
export const INVITE_ROLES = ["operator", "viewer"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const INVITE_DAYS = [3, 7, 14] as const;
export const MAX_OPEN_INVITES = 50;
export const MIN_PASSWORD = 10;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `gi_` plus 32 random bytes as base64url (43 characters). */
export const INVITE_TOKEN = /^gi_[A-Za-z0-9_-]{43}$/;

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken() {
  const token = `gi_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashInviteToken(token) };
}

export type InviteState = "open" | "used" | "revoked" | "expired";

export function inviteState(
  row: { used_at: Date | null; revoked_at: Date | null; expires_at: Date },
  now = new Date()
): InviteState {
  if (row.used_at) return "used";
  if (row.revoked_at) return "revoked";
  if (row.expires_at.getTime() <= now.getTime()) return "expired";
  return "open";
}

export function isValidEmail(value: string) {
  return value.length <= 200 && EMAIL.test(value);
}

type NewAccount = { name: string; email: string; password: string; confirm: string };

/**
 * Validates the form an invited person submits. When the invitation is locked to an email address, that
 * address is the only one accepted, whatever the browser sent.
 */
export function checkNewAccount(input: NewAccount, lockedEmail: string | null): { error: string } | { name: string; email: string } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "Enter your name." };
  if (name.length > 120) return { error: "The name is too long." };
  if (lockedEmail && email !== lockedEmail) return { error: "This invitation is for a different email address." };
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (input.password.length < MIN_PASSWORD) return { error: `The password must have at least ${MIN_PASSWORD} characters.` };
  if (input.password !== input.confirm) return { error: "The two passwords do not match." };
  return { name, email };
}
