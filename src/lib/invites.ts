import { one } from "./db";
import { INVITE_TOKEN, hashInviteToken, inviteState, type InviteRole, type InviteState } from "./invite-core";

export type Invitation = {
  id: string;
  role: InviteRole;
  email: string | null;
  note: string;
  expires_at: Date;
  state: InviteState;
};

/** Looks an invitation up by the token from its link. Null for anything malformed or unknown. */
export async function findInvitation(token: string): Promise<Invitation | null> {
  if (!INVITE_TOKEN.test(token)) return null;
  const row = await one<{
    id: string; role: InviteRole; email: string | null; note: string;
    expires_at: Date; used_at: Date | null; revoked_at: Date | null;
  }>(
    "select id, role, email, note, expires_at, used_at, revoked_at from invitations where token_hash = $1",
    [hashInviteToken(token)]
  );
  if (!row) return null;
  return { id: row.id, role: row.role, email: row.email, note: row.note, expires_at: row.expires_at, state: inviteState(row) };
}
