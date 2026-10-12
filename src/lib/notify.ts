// Email notifications for the pilot: new alerts and stations that stop sending.
//
// Email goes out through Resend's HTTPS API, not SMTP: Railway blocks outbound SMTP on its Free, Trial
// and Hobby plans. Failures never affect ingestion — a mail that cannot be sent is released and retried by
// the periodic sweep (every 5 minutes, NOTIFY_SWEEP_SECONDS).
import { one, query } from "./db";
import {
  buildAlertEmail, buildOfflineEmail, buildTestEmail, parseRecipients, type Email
} from "./email-templates";
import { fmtDateTime } from "./format";

/** Alerts older than this are never emailed, so enabling email does not flood inboxes with history. */
const MAX_ALERT_AGE_HOURS = 24;

const num = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_FROM);
}

function appUrl() {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null;
}

const link = (path: string) => (appUrl() ? `${appUrl()}${path}` : null);

/** Recipients saved under Settings, falling back to ALERT_EMAIL_TO. */
export async function alertRecipients() {
  const row = await one<{ value: string }>("select value from settings where key = 'alert_recipients'");
  const saved = parseRecipients(typeof row?.value === "string" ? row.value : "").emails;
  return saved.length ? saved : parseRecipients(process.env.ALERT_EMAIL_TO ?? "").emails;
}

export async function sendEmail(to: string[], email: Email) {
  if (!emailConfigured()) throw new Error("Email is not configured (RESEND_API_KEY and ALERT_EMAIL_FROM).");
  const response = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.ALERT_EMAIL_FROM, to, subject: email.subject, text: email.text, html: email.html }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Email provider answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

export async function sendTestEmail(to: string[]) {
  await sendEmail(to, buildTestEmail(link("/")));
}

type PendingAlert = {
  id: string; site_id: string; metric_id: string; severity: "warning" | "critical"; message: string; value: number;
  threshold: number; created_at: Date; metric: string; unit: string; site: string;
};

/**
 * Emails every open alert that has not been emailed yet. A metric is emailed at most once per
 * ALERT_EMAIL_COOLDOWN_HOURS (default 6), so a value hovering around its limit does not produce a
 * message every few minutes; if it is still breaching when the cooldown ends, the email goes out then.
 * Alerts due together for one site go out as one email. Only the start of a breach is emailed.
 * Returns the number of emails sent.
 */
export async function notifyPendingAlerts() {
  if (!emailConfigured()) return 0;
  const to = await alertRecipients();
  if (to.length === 0) return 0;

  const pending = await query<PendingAlert>(
    `select a.id, a.metric_id, a.severity, a.message, a.value, a.threshold, a.created_at,
            m.name as metric, m.unit, s.id as site_id, s.name as site
     from alerts a
     join metrics m on m.id = a.metric_id
     join data_sources d on d.id = m.source_id
     join sites s on s.id = d.site_id
     where a.status = 'open' and a.notified_at is null and d.kind <> 'simulated'
       and a.created_at > now() - $2::float8 * interval '1 hour'
       and not exists (
         select 1 from alerts n
         where n.metric_id = a.metric_id and n.notified_at > now() - $1::float8 * interval '1 hour'
       )
     order by a.created_at`,
    [num("ALERT_EMAIL_COOLDOWN_HOURS", 6), MAX_ALERT_AGE_HOURS]
  );

  // One alert per metric, then one email per site.
  const bySite = new Map<string, PendingAlert[]>();
  const seenMetrics = new Set<string>();
  for (const alert of pending) {
    if (seenMetrics.has(alert.metric_id)) continue;
    seenMetrics.add(alert.metric_id);
    bySite.set(alert.site_id, [...(bySite.get(alert.site_id) ?? []), alert]);
  }

  let sent = 0;
  for (const group of bySite.values()) {
    // Claim the alerts first, so the post-ingest call and the periodic sweep can never both send them.
    const claimed = await query<{ id: string }>(
      "update alerts set notified_at = now() where id = any($1::uuid[]) and notified_at is null and status = 'open' returning id",
      [group.map((a) => a.id)]
    );
    const ids = new Set(claimed.map((r) => r.id));
    const mine = group.filter((a) => ids.has(a.id));
    if (mine.length === 0) continue;
    try {
      await sendEmail(to, buildAlertEmail(mine.map((alert) => ({
        severity: alert.severity, message: alert.message, site: alert.site, metric: alert.metric,
        value: round(alert.value), threshold: round(alert.threshold), unit: alert.unit,
        when: fmtDateTime(alert.created_at), link: link("/alerts")
      }))));
      sent++;
    } catch (error) {
      await query("update alerts set notified_at = null where id = any($1::uuid[])", [mine.map((a) => a.id)]);
      console.error("[notify] alert email failed, will retry:", (error as Error).message);
      break; // the provider is probably down; try again at the next sweep
    }
  }
  return sent;
}

/**
 * Emails once when a device source has sent nothing for OFFLINE_AFTER_MINUTES (default 90 — nine missed
 * readings at one every 10 minutes). Without this, a dead station looks exactly like healthy soil.
 * It re-arms as soon as the station sends data again.
 */
export async function notifyOfflineSources() {
  if (!emailConfigured()) return 0;
  const to = await alertRecipients();
  if (to.length === 0) return 0;

  const minutes = num("OFFLINE_AFTER_MINUTES", 90);
  const stale = await query<{ id: string; source: string; site: string; last_seen_at: Date }>(
    `select d.id, d.name as source, s.name as site, d.last_seen_at
     from data_sources d join sites s on s.id = d.site_id
     where d.kind = 'device' and d.active and d.last_seen_at is not null
       and d.last_seen_at < now() - $1::float8 * interval '1 minute'
       and (d.offline_notified_at is null or d.offline_notified_at < d.last_seen_at)`,
    [minutes]
  );

  let sent = 0;
  for (const source of stale) {
    const claimed = await one(
      `update data_sources set offline_notified_at = now()
       where id = $1 and (offline_notified_at is null or offline_notified_at < last_seen_at) returning id`,
      [source.id]
    );
    if (!claimed) continue;
    try {
      await sendEmail(to, buildOfflineEmail({
        source: source.source, site: source.site, lastSeen: fmtDateTime(source.last_seen_at), minutes, link: link("/sources")
      }));
      sent++;
    } catch (error) {
      await query("update data_sources set offline_notified_at = null where id = $1", [source.id]);
      console.error("[notify] offline email failed, will retry:", (error as Error).message);
      break;
    }
  }
  return sent;
}

let timer: NodeJS.Timeout | undefined;

/** Runs both checks every 5 minutes. Safe to call more than once. */
export function startNotifier() {
  if (timer) return;
  const sweep = () =>
    Promise.all([notifyPendingAlerts(), notifyOfflineSources()]).catch((e) => console.error("[notify]", e.message));
  timer = setInterval(sweep, Math.max(5, num("NOTIFY_SWEEP_SECONDS", 300)) * 1000);
  timer.unref();
  console.log(emailConfigured() ? "[notify] email alerts enabled" : "[notify] email alerts off (set RESEND_API_KEY and ALERT_EMAIL_FROM)");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
