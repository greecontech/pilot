import Link from "next/link";
import { Sparkline } from "@/components/Charts";
import { Badge, Empty, Kpi, Notice, PageHead, Panel } from "@/components/ui";
import { one, query } from "@/lib/db";
import { SECTOR_LABELS, fmtDateTime, fmtNumber, fmtRelative } from "@/lib/format";
import { completedMonths, currentProjectMonth, monthLabel, PROJECT_MONTHS } from "@/lib/project";
import { listMetrics, metricStatus, series } from "@/lib/queries";
import { loadSetup } from "@/lib/setup";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const setup = user.role === "admin" ? await loadSetup() : null;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000);
  const [metrics, counts, alerts] = await Promise.all([
    listMetrics(),
    one<{ sites: number; sources: number; live: number; readings: number; open: number; critical: number }>(
      `select (select count(*) from sites)::int as sites,
              (select count(*) from data_sources where active)::int as sources,
              (select count(*) from data_sources where active and last_seen_at > now() - interval '1 hour')::int as live,
              (select count(*) from readings where ts > now() - interval '24 hours')::int as readings,
              (select count(*) from alerts where status = 'open')::int as open,
              (select count(*) from alerts where status <> 'resolved' and severity = 'critical')::int as critical`
    ),
    query<{ id: string; message: string; severity: string; status: string; created_at: Date; site_name: string }>(
      `select a.id, a.message, a.severity, a.status, a.created_at, s.name as site_name
       from alerts a join metrics m on m.id = a.metric_id join data_sources d on d.id = m.source_id join sites s on s.id = d.site_id
       where a.status <> 'resolved' order by (a.severity = 'critical') desc, a.created_at desc limit 6`
    )
  ]);
  const spark = await series(metrics.map((m) => m.id), dayAgo, now);

  const sites = new Map<string, { name: string; sector: string; metrics: typeof metrics }>();
  for (const m of metrics) {
    if (!sites.has(m.site_id)) sites.set(m.site_id, { name: m.site_name, sector: m.sector, metrics: [] });
    sites.get(m.site_id)!.metrics.push(m);
  }
  const month = currentProjectMonth(now);
  const completed = await completedMonths();

  return (
    <div className="stack">
      <PageHead title={`Good day, ${user.name.split(" ")[0]}`} intro={`Overview of all sites and data sources · ${fmtDateTime(now)}`} />
      {denied && <Notice tone="error">Your role does not have access to that page.</Notice>}

      {setup && setup.progress.next && (
        <Panel title="Finish the pilot setup" meta={`${setup.progress.done} of ${setup.progress.total} steps done`}
          actions={<Link className="button small" href="/setup">Open the setup guide</Link>}>
          <p>Next: <b>{setup.progress.next.title}</b>. <span className="muted">{setup.progress.next.summary}</span></p>
        </Panel>
      )}

      <div className="kpis">
        <Kpi label="Sites" value={counts?.sites ?? 0} sub={`${metrics.length} monitored metrics`} />
        <Kpi label="Sources online" value={`${counts?.live ?? 0} / ${counts?.sources ?? 0}`} sub="reported in the last hour" />
        <Kpi label="Readings · 24 h" value={fmtNumber(counts?.readings ?? 0, 0)} />
        <Kpi label="Open alerts" value={counts?.open ?? 0} sub={counts?.critical ? `${counts.critical} critical` : "none critical"} />
        {month >= 1 && month <= PROJECT_MONTHS && (
          <Kpi label="Startup Albania" value={`Month ${month}`} unit={`/ ${PROJECT_MONTHS}`} sub={`${monthLabel(month)} · ${completed} of ${PROJECT_MONTHS} months completed`} />
        )}
      </div>

      <Panel title="Needs attention" meta="Active alerts, critical first" flush
        actions={<Link className="button secondary small" href="/alerts">All alerts</Link>}>
        {alerts.length === 0 ? (
          <Empty>All monitored values are within their limits.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td style={{ width: 110 }}><Badge status={a.severity} /></td>
                    <td>{a.message}<div className="small muted">{a.site_name}</div></td>
                    <td style={{ width: 130 }}><Badge status={a.status} /></td>
                    <td className="num muted small" style={{ width: 120 }}>{fmtRelative(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {sites.size === 0 && (
        <Panel title="Get started">
          <p>No sites yet. <Link href="/sources">Add a site and a data source</Link> to start collecting readings.</p>
        </Panel>
      )}

      {[...sites.entries()].map(([id, site]) => (
        <Panel key={id} title={site.name} meta={SECTOR_LABELS[site.sector]} flush
          actions={<Link className="button secondary small" href={`/monitoring?site=${id}`}>Monitor</Link>}>
          <div className="metric-tiles">
            {site.metrics.map((m) => {
              const status = metricStatus(m);
              return (
                <Link key={m.id} href={`/monitoring?metric=${m.id}`} className="metric-tile">
                  <div className="spread">
                    <span className="small muted">{m.name}</span>
                    <Badge status={status} />
                  </div>
                  <div className="v">{fmtNumber(m.last_value)}<small>{m.unit}</small></div>
                  <Sparkline values={(spark.get(m.id) ?? []).map((p) => p.v)} />
                  <div className="small muted">
                    {m.source_name}{m.source_kind === "simulated" ? " · simulated" : ""} · {fmtRelative(m.last_ts)}
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}
