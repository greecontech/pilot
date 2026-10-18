import { ActionForm } from "@/components/ActionForm";
import { Badge, PageHead, Panel } from "@/components/ui";
import { query } from "@/lib/db";
import { fmtDate, fmtRelative } from "@/lib/format";
import { INVITE_DAYS, INVITE_ROLES, inviteState } from "@/lib/invite-core";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { createInvitation, createUser, resetPassword, revokeInvitation, updateUser } from "./actions";

export const metadata = { title: "Users & roles" };

export default async function Users() {
  const me = await requireUser("admin");
  const users = await query<{ id: string; email: string; name: string; role: Role; active: boolean; created_at: Date; last_login_at: Date | null }>(
    "select id, email, name, role, active, created_at, last_login_at from users order by active desc, name"
  );
  const invitations = await query<{
    id: string; role: Role; email: string | null; note: string; created_at: Date; expires_at: Date;
    used_at: Date | null; revoked_at: Date | null; created_by_name: string | null; used_by_name: string | null;
  }>(
    `select i.id, i.role, i.email, i.note, i.created_at, i.expires_at, i.used_at, i.revoked_at,
            c.name as created_by_name, u.name as used_by_name
     from invitations i left join users c on c.id = i.created_by left join users u on u.id = i.used_by
     where i.created_at > now() - interval '60 days' order by i.created_at desc limit 50`
  );

  return (
    <div className="stack">
      <PageHead title="Users & roles" intro="Invite people, assign roles and control access (D2 §5.1). Changes apply on the user's next request." />

      <div className="grid-3">
        {ROLES.map((r) => (
          <div key={r} className="kpi">
            <div className="label">{ROLE_LABELS[r]}</div>
            <div className="value" style={{ fontSize: 22 }}>{users.filter((u) => u.role === r && u.active).length}</div>
            <div className="sub">{ROLE_DESCRIPTIONS[r]}</div>
          </div>
        ))}
      </div>

      <Panel title="Invite someone" meta="They open a one-time link and choose their own password. You never see it.">
        <div id="invite" />
        <ActionForm action={createInvitation} submit="Create invitation link">
          <label><span>Who is it for? <span className="muted small">(optional)</span></span><input name="note" maxLength={120} placeholder="Farmer, pilot farm" /></label>
          <label><span>Email <span className="muted small">(optional)</span></span><input name="email" type="email" placeholder="farmer@example.com" /></label>
          <label>Role
            <select name="role" defaultValue="viewer">
              {INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          <label>Link valid for
            <select name="days" defaultValue="7">
              {INVITE_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
        </ActionForm>
        <p className="small muted" style={{ marginTop: 10 }}><b>Authorized user</b> can look but not change anything: the right choice for a farmer. <b>Operator</b> can also change limits, create sources and replace a station&rsquo;s key, so use it for a technician.</p>
        <p className="small muted" style={{ marginTop: 6 }}>With an email address, the link only works for that address, and it is emailed to them when email alerts are set up. Without one, send the link yourself and they enter their own address.</p>
      </Panel>

      <Panel title="Add user with a password" meta="For administrators, or when you prefer to hand over an initial password yourself.">
        <ActionForm action={createUser} submit="Create user">
          <label>Name<input name="name" required maxLength={120} /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Role
            <select name="role" defaultValue="viewer">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          <label>Initial password<input name="password" type="password" minLength={10} required autoComplete="new-password" /></label>
        </ActionForm>
      </Panel>

      {invitations.length > 0 && (
        <Panel title="Invitations" meta="Last 60 days" flush>
          <div className="table-wrap">
            <table>
              <thead><tr><th>For</th><th>Role</th><th>Status</th><th>Created</th><th /></tr></thead>
              <tbody>
                {invitations.map((i) => {
                  const state = inviteState(i);
                  return (
                    <tr key={i.id}>
                      <td>{i.note || i.email || <span className="muted">Link without a name</span>}{i.note && i.email && <div className="small muted">{i.email}</div>}</td>
                      <td>{ROLE_LABELS[i.role]}</td>
                      <td>
                        {state === "open" && <><Badge status="planned" label="waiting" /><div className="small muted">until {fmtDate(i.expires_at)}</div></>}
                        {state === "used" && <><Badge status="done" label="accepted" /><div className="small muted">{i.used_by_name}</div></>}
                        {state === "revoked" && <Badge status="inactive" label="revoked" />}
                        {state === "expired" && <Badge status="stale" label="expired" />}
                      </td>
                      <td className="small">{fmtRelative(i.created_at)}<div className="muted">{i.created_by_name}</div></td>
                      <td className="right">
                        {state === "open" && (
                          <ActionForm action={revokeInvitation} submit="Revoke" buttonClass="secondary small" className="row" confirm="Revoke this invitation? The link will stop working.">
                            <input type="hidden" name="id" value={i.id} />
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title={`${users.length} users`} flush>
        <div className="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}{u.id === me.id && <span className="muted small"> (you)</span>}<div className="small muted">{u.email}</div></td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td><Badge status={u.active ? "active" : "inactive"} /></td>
                  <td className="small">{fmtRelative(u.last_login_at)}</td>
                  <td className="right">
                    <details className="inline-edit">
                      <summary>Manage</summary>
                      <div className="stack" style={{ gap: 12, textAlign: "left" }}>
                        <ActionForm action={updateUser} submit="Save" resetOnSuccess={false}>
                          <input type="hidden" name="id" value={u.id} />
                          <label>Name<input name="name" defaultValue={u.name} required /></label>
                          <label>Role
                            <select name="role" defaultValue={u.role}>
                              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </select>
                          </label>
                          <label className="inline"><input type="checkbox" name="active" defaultChecked={u.active} /> Active</label>
                        </ActionForm>
                        <ActionForm action={resetPassword} submit="Reset password" buttonClass="secondary">
                          <input type="hidden" name="id" value={u.id} />
                          <label>New password<input name="password" type="password" minLength={10} required autoComplete="new-password" /></label>
                        </ActionForm>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
