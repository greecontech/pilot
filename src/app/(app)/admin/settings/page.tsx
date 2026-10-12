import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Empty, PageHead, Panel } from "@/components/ui";
import { one, query } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { projectStart } from "@/lib/project";
import { requireUser, sessionSecretConfigured } from "@/lib/session";
import { emailConfigured } from "@/lib/notify";
import { saveAlertRecipients, saveSettings, sendTestEmailAction } from "./actions";

export const metadata = { title: "Settings & audit" };
const PAGE_SIZE = 50;

export default async function Settings({ searchParams }: { searchParams: Promise<{ entity?: string; page?: string }> }) {
  await requireUser("admin");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const entity = params.entity || null;

  const [settingsRows, info, entities, events] = await Promise.all([
    query<{ key: string; value: string }>("select key, value from settings"),
    one<{ version: string; size: string; readings: number; users: number }>(
      `select current_setting('server_version') as version, pg_size_pretty(pg_database_size(current_database())) as size,
              (select count(*) from readings)::int as readings, (select count(*) from users)::int as users`
    ),
    query<{ entity: string }>("select distinct entity from audit_events order by entity"),
    query<{ id: number; action: string; entity: string; entity_id: string | null; detail: Record<string, unknown>; created_at: Date; user_name: string | null }>(
      `select a.id, a.action, a.entity, a.entity_id, a.detail, a.created_at, u.name as user_name
       from audit_events a left join users u on u.id = a.user_id
       where ($1::text is null or a.entity = $1)
       order by a.created_at desc limit ${PAGE_SIZE + 1} offset ${(page - 1) * PAGE_SIZE}`,
      [entity]
    )
  ]);
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value])) as Record<string, string | undefined>;
  const hasMore = events.length > PAGE_SIZE;
  const link = (p: number) => `/admin/settings?${new URLSearchParams({ ...(entity ? { entity } : {}), page: String(p) })}`;

  return (
    <div className="stack">
      <PageHead title="Settings & audit" intro="Platform configuration, system status and the record of every change (D2 §5.8)." />

      <div className="grid-2">
        <Panel title="Organization">
          <ActionForm action={saveSettings} submit="Save" resetOnSuccess={false}>
            <label>Organization name<input name="organization_name" defaultValue={settings.organization_name ?? "Greecon shpk"} /></label>
            <label>Contact email<input name="contact_email" type="email" defaultValue={settings.contact_email ?? "projects@greecon.earth"} /></label>
          </ActionForm>
        </Panel>
        <Panel title="System">
          <table>
            <tbody>
              <tr><td className="muted">Database</td><td>PostgreSQL {info?.version} · {info?.size}</td></tr>
              <tr><td className="muted">Stored readings</td><td>{fmtNumber(info?.readings ?? 0, 0)}</td></tr>
              <tr><td className="muted">Users</td><td>{info?.users}</td></tr>
              <tr><td className="muted">Demo simulator</td><td>{process.env.SIMULATOR === "true" ? `on, every ${process.env.SIMULATOR_INTERVAL_SECONDS || 60} s` : "off"}</td></tr>
              <tr><td className="muted">Timezone</td><td>{process.env.APP_TIMEZONE || "Europe/Tirane"}</td></tr>
              <tr><td className="muted">Project start</td><td>{fmtDate(projectStart())}</td></tr>
              <tr><td className="muted">Session secret</td><td>{sessionSecretConfigured() ? "configured" : <span style={{ color: "var(--critical)" }}>not set — users are signed out on every restart. Set SESSION_SECRET (32+ characters).</span>}</td></tr>
              <tr><td className="muted">Deployment</td><td>{process.env.RAILWAY_ENVIRONMENT_NAME ? `Railway · ${process.env.RAILWAY_ENVIRONMENT_NAME}` : process.env.NODE_ENV}</td></tr>
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Alert emails" meta="Critical and warning alerts, and stations that stop sending, are emailed to these addresses (English / Albanian).">
        <div className="stack">
          <table>
            <tbody>
              <tr><td className="muted">Email service</td><td>{emailConfigured() ? `Resend · from ${process.env.ALERT_EMAIL_FROM}` : <span style={{ color: "var(--critical)" }}>not configured — set RESEND_API_KEY and ALERT_EMAIL_FROM on the server</span>}</td></tr>
            </tbody>
          </table>
          <ActionForm action={saveAlertRecipients} submit="Save recipients" resetOnSuccess={false}>
            <label>Recipients (separate with commas)<textarea name="alert_recipients" rows={2} defaultValue={settings.alert_recipients ?? process.env.ALERT_EMAIL_TO ?? ""} placeholder="farmer@example.com, pm@greecon.earth" /></label>
          </ActionForm>
          <ActionForm action={sendTestEmailAction} submit="Send test email" buttonClass="secondary" />
        </div>
      </Panel>

      <Panel title="Audit log" flush actions={
        <form method="get" className="row">
          <select name="entity" defaultValue={entity ?? ""} style={{ width: 180 }}>
            <option value="">All entities</option>
            {entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}
          </select>
          <button className="secondary small" type="submit">Filter</button>
        </form>
      }>
        {events.length === 0 ? <Empty>No events.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
              <tbody>
                {events.slice(0, PAGE_SIZE).map((e) => (
                  <tr key={e.id}>
                    <td className="small" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(e.created_at)}</td>
                    <td className="small">{e.user_name ?? "system"}</td>
                    <td><code>{e.action}</code></td>
                    <td className="small">{e.entity}</td>
                    <td className="small muted mono" style={{ maxWidth: 360, overflowWrap: "anywhere" }}>
                      {Object.keys(e.detail).length ? JSON.stringify(e.detail) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="row end small">
        {page > 1 && <Link className="button secondary small" href={link(page - 1)}>Newer</Link>}
        {hasMore && <Link className="button secondary small" href={link(page + 1)}>Older</Link>}
      </div>
    </div>
  );
}
