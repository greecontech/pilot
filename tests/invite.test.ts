import { test } from "node:test";
import assert from "node:assert/strict";
import { INVITE_ROLES, INVITE_TOKEN, checkNewAccount, generateInviteToken, hashInviteToken, inviteState } from "../src/lib/invite-core.ts";

test("tokens are random, well-formed, and stored only as a hash", () => {
  const a = generateInviteToken();
  const b = generateInviteToken();
  assert.match(a.token, INVITE_TOKEN);
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashInviteToken(a.token));
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.ok(!a.hash.includes(a.token.slice(3, 20)), "the hash must not contain the token");
});

test("malformed tokens are rejected before any database lookup", () => {
  for (const bad of ["", "gi_", "gi_short", "xx_" + "A".repeat(43), "gi_" + "A".repeat(44), "gi_" + "A".repeat(42) + "!", " gi_" + "A".repeat(43)]) {
    assert.doesNotMatch(bad, INVITE_TOKEN, bad);
  }
});

test("invitations cannot create administrators", () => {
  assert.deepEqual([...INVITE_ROLES], ["operator", "viewer"]);
});

const now = new Date("2026-11-02T10:00:00Z");
const open = { used_at: null, revoked_at: null, expires_at: new Date("2026-11-09T10:00:00Z") };

test("an invitation is open until it is used, revoked or expired", () => {
  assert.equal(inviteState(open, now), "open");
  assert.equal(inviteState({ ...open, used_at: new Date("2026-11-02T09:00:00Z") }, now), "used");
  assert.equal(inviteState({ ...open, revoked_at: new Date("2026-11-02T09:00:00Z") }, now), "revoked");
  assert.equal(inviteState({ ...open, expires_at: new Date("2026-11-02T10:00:00Z") }, now), "expired", "expires exactly at the deadline");
  assert.equal(inviteState({ ...open, expires_at: new Date("2026-11-01T10:00:00Z") }, now), "expired");
});

test("a used invitation stays used even after it also expires", () => {
  assert.equal(inviteState({ ...open, used_at: new Date("2026-11-02T09:00:00Z"), expires_at: new Date("2026-11-01T00:00:00Z") }, now), "used");
});

const good = { name: "  Ana Hoxha ", email: " Ana@Example.com ", password: "correct-horse-battery", confirm: "correct-horse-battery" };

test("a valid form is accepted and normalised", () => {
  assert.deepEqual(checkNewAccount(good, null), { name: "Ana Hoxha", email: "ana@example.com" });
});

test("an invitation locked to an email accepts only that address, whatever the browser sent", () => {
  assert.deepEqual(checkNewAccount(good, "ana@example.com"), { name: "Ana Hoxha", email: "ana@example.com" });
  assert.deepEqual(checkNewAccount({ ...good, email: "someone-else@example.com" }, "ana@example.com"), { error: "This invitation is for a different email address." });
});

test("weak or mismatched passwords and missing fields are rejected", () => {
  assert.match((checkNewAccount({ ...good, password: "short", confirm: "short" }, null) as { error: string }).error, /at least 10/);
  assert.match((checkNewAccount({ ...good, confirm: "different-password" }, null) as { error: string }).error, /do not match/);
  assert.match((checkNewAccount({ ...good, name: "   " }, null) as { error: string }).error, /name/);
  assert.match((checkNewAccount({ ...good, email: "not-an-email" }, null) as { error: string }).error, /valid email/);
  assert.match((checkNewAccount({ ...good, name: "x".repeat(121) }, null) as { error: string }).error, /too long/);
});
