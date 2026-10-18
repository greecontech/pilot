"use client";

import { startTransition, useActionState } from "react";
import { acceptInvitation, type JoinState } from "../actions";

export function JoinForm({ token, lockedEmail, role, organization }: { token: string; lockedEmail: string | null; role: string; organization: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(acceptInvitation, {});
  return (
    <form onSubmit={(e) => {
      // Manual submit keeps what was typed after a failed attempt.
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      startTransition(() => action(data));
    }}>
      <h1 style={{ fontSize: 20 }}>Create your account</h1>
      <p className="small muted">{organization} has invited you to Greecon Platform as <b>{role}</b>. Choose your own password: no one else will know it.</p>
      {state.error && <div className="notice error" role="alert">{state.error}</div>}
      <input type="hidden" name="token" value={token} />
      <label>
        Your name
        <input name="name" required maxLength={120} autoComplete="name" autoFocus />
      </label>
      <label>
        Email
        <input name="email" type="email" required autoComplete="username" defaultValue={lockedEmail ?? ""} readOnly={Boolean(lockedEmail)} />
      </label>
      <label>
        <span>Password <span className="muted small">(at least 10 characters)</span></span>
        <input name="password" type="password" required minLength={10} autoComplete="new-password" />
      </label>
      <label>
        Repeat the password
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
    </form>
  );
}
