import type { PoolClient } from "pg";
import { pool } from "./db";
import { notifyPendingAlerts } from "./notify";
import { evaluate, type Thresholds } from "./thresholds";

export type Origin = "api" | "manual" | "import" | "simulated";
export type ReadingInput = { metricId: string; ts: Date; value: number };

type MetricRow = Thresholds & { id: string; name: string; unit: string };

/**
 * Stores readings and evaluates thresholds on each metric's newest value.
 * Historical back-fills (older than what is already stored) never raise alerts.
 */
export async function recordReadings(readings: ReadingInput[], origin: Origin) {
  if (readings.length === 0) return { inserted: 0, alertsOpened: 0 };
  const client = await pool().connect();
  try {
    await client.query("begin");
    const latestBefore = await latestTimestamps(client, [...new Set(readings.map((r) => r.metricId))]);
    await client.query(
      `insert into readings (metric_id, ts, value, origin)
       select * from unnest($1::uuid[], $2::timestamptz[], $3::float8[], $4::text[])`,
      [
        readings.map((r) => r.metricId),
        readings.map((r) => r.ts.toISOString()),
        readings.map((r) => r.value),
        readings.map(() => origin)
      ]
    );

    const newest = new Map<string, ReadingInput>();
    for (const r of readings) {
      const current = newest.get(r.metricId);
      if (!current || r.ts > current.ts) newest.set(r.metricId, r);
    }

    let alertsOpened = 0;
    for (const reading of newest.values()) {
      const before = latestBefore.get(reading.metricId);
      if (before && reading.ts < before) continue;
      if (await evaluateReading(client, reading)) alertsOpened++;
    }

    await client.query(
      `update data_sources set last_seen_at = now()
       where id in (select distinct source_id from metrics where id = any($1::uuid[]))`,
      [[...newest.keys()]]
    );
    await client.query("commit");
    // Email after the commit and without waiting: a slow mail provider must never delay the device's upload.
    if (alertsOpened > 0) void notifyPendingAlerts().catch((e) => console.error("[notify]", e.message));
    return { inserted: readings.length, alertsOpened };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function latestTimestamps(client: PoolClient, metricIds: string[]) {
  const { rows } = await client.query<{ metric_id: string; ts: Date }>(
    "select metric_id, max(ts) as ts from readings where metric_id = any($1::uuid[]) group by metric_id",
    [metricIds]
  );
  return new Map(rows.map((r) => [r.metric_id, r.ts]));
}

/** Returns true when a new alert was opened. */
async function evaluateReading(client: PoolClient, reading: ReadingInput) {
  const { rows } = await client.query<MetricRow>(
    "select id, name, unit, min_threshold, max_threshold from metrics where id = $1",
    [reading.metricId]
  );
  const metric = rows[0];
  if (!metric) return false;
  const breach = evaluate(metric, reading.value);

  if (!breach) {
    // Back within range: close anything still open for this metric.
    await client.query(
      "update alerts set status = 'resolved', resolved_at = now() where metric_id = $1 and status <> 'resolved'",
      [metric.id]
    );
    return false;
  }

  const unit = metric.unit ? ` ${metric.unit}` : "";
  const message = `${metric.name} ${breach.kind === "above" ? "above" : "below"} limit: ${round(reading.value)}${unit} (limit ${round(breach.threshold)}${unit})`;
  const existing = await client.query<{ id: string }>(
    "select id from alerts where metric_id = $1 and kind = $2 and status <> 'resolved' limit 1",
    [metric.id, breach.kind]
  );
  if (existing.rows[0]) {
    // Keep one active alert per breach; escalate severity but never downgrade it.
    await client.query(
      `update alerts set value = $2, message = $3,
         severity = case when severity = 'critical' then 'critical' else $4 end
       where id = $1`,
      [existing.rows[0].id, reading.value, message, breach.severity]
    );
    return false;
  }
  await client.query(
    "insert into alerts (metric_id, kind, severity, threshold, value, message) values ($1, $2, $3, $4, $5, $6)",
    [metric.id, breach.kind, breach.severity, breach.threshold, reading.value, message]
  );
  return true;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
