import { pool, query } from "./db";
import { DEMO_SITES, demoValue } from "./demo-model";
import { recordReadings } from "./ingest";
import { startNotifier } from "./notify";

const HOUR = 3_600_000;

/** Seeds demo sites and 30 days of hourly history when SEED_DEMO=true and the database has no sites. */
export async function seedDemo() {
  const client = await pool().connect();
  try {
    await client.query("select pg_advisory_lock(727002)");
    const { rows } = await client.query<{ n: number }>("select count(*)::int as n from sites");
    if (rows[0].n > 0) return;

    const now = Math.floor(Date.now() / HOUR) * HOUR;
    const start = now - 30 * 24 * HOUR;
    for (const site of DEMO_SITES) {
      const s = await client.query<{ id: string }>(
        "insert into sites (name, sector, location, description) values ($1, $2, $3, $4) returning id",
        [site.name, site.sector, site.location, site.description]
      );
      const src = await client.query<{ id: string }>(
        "insert into data_sources (site_id, name, kind, last_seen_at) values ($1, $2, 'simulated', now()) returning id",
        [s.rows[0].id, site.source]
      );
      for (const m of site.metrics) {
        const metric = await client.query<{ id: string }>(
          "insert into metrics (source_id, key, name, unit, min_threshold, max_threshold) values ($1, $2, $3, $4, $5, $6) returning id",
          [src.rows[0].id, m.key, m.name, m.unit, m.min ?? null, m.max ?? null]
        );
        const ts: string[] = [];
        const values: number[] = [];
        for (let t = start; t < now; t += HOUR) {
          ts.push(new Date(t).toISOString());
          values.push(m.value(new Date(t)));
        }
        await client.query(
          `insert into readings (metric_id, ts, value, origin)
           select $1, unnest($2::timestamptz[]), unnest($3::float8[]), 'simulated'`,
          [metric.rows[0].id, ts, values]
        );
      }
    }
    console.log("[seed] demo sites and 30 days of history created");
  } finally {
    await client.query("select pg_advisory_unlock(727002)");
    client.release();
  }
}

/** Writes one reading per simulated metric; alerts are evaluated exactly as for real data. */
export async function simulateTick(now = new Date()) {
  const metrics = await query<{ id: string; key: string }>(
    `select m.id, m.key from metrics m join data_sources d on d.id = m.source_id
     where d.kind = 'simulated' and d.active`
  );
  const readings = metrics
    .map((m) => ({ metricId: m.id, ts: now, value: demoValue(m.key, now) }))
    .filter((r): r is { metricId: string; ts: Date; value: number } => r.value !== null);
  await recordReadings(readings, "simulated");
}

let timer: NodeJS.Timeout | undefined;

export async function start() {
  if (!process.env.DATABASE_URL) {
    console.warn("[bootstrap] DATABASE_URL not set; skipping seed and simulator.");
    return;
  }
  startNotifier();
  try {
    if (process.env.SEED_DEMO === "true") await seedDemo();
    if (process.env.SIMULATOR === "true" && !timer) {
      const seconds = Math.max(15, Number(process.env.SIMULATOR_INTERVAL_SECONDS || 60));
      await simulateTick();
      timer = setInterval(() => simulateTick().catch((e) => console.error("[simulator]", e.message)), seconds * 1000);
      timer.unref();
      console.log(`[simulator] writing simulated readings every ${seconds}s`);
    }
  } catch (error) {
    console.error("[bootstrap] failed:", (error as Error).message);
  }
}
