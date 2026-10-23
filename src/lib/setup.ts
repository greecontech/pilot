import { one } from "./db";
import { parseRecipients } from "./email-templates";
import { emailConfigured } from "./notify";
import { sessionSecretConfigured } from "./session";
import { buildSetupSteps, setupProgress, type SetupFacts } from "./setup-steps";

/** Reads what the platform can see about its own setup, in a single query, and turns it into the guide's steps. */
export async function loadSetup(now = new Date()) {
  const row = await one<{
    org_saved: boolean; recipients: string | null; test_sent: boolean; simulated_source: boolean; sites: number;
    device_sources: number; last_seen: Date | null; limits_set: boolean; alert_raised: boolean; members: number;
  }>(
    `select
       exists(select 1 from settings where key in ('organization_name', 'contact_email')) as org_saved,
       (select value from settings where key = 'alert_recipients') as recipients,
       exists(select 1 from audit_events where action = 'test' and entity = 'email') as test_sent,
       exists(select 1 from data_sources where kind = 'simulated') as simulated_source,
       (select count(*) from sites s where not exists
          (select 1 from data_sources d where d.site_id = s.id and d.kind = 'simulated'))::int as sites,
       (select count(*) from data_sources where kind = 'device' and active)::int as device_sources,
       (select max(last_seen_at) from data_sources where kind = 'device') as last_seen,
       exists(select 1 from metrics m join data_sources d on d.id = m.source_id
              where d.kind <> 'simulated' and m.key ~ '^soil_moisture_[0-9]+$' and m.min_threshold is not null) as limits_set,
       exists(select 1 from alerts a join metrics m on m.id = a.metric_id join data_sources d on d.id = m.source_id
              where d.kind <> 'simulated') as alert_raised,
       (select count(*) from users where role <> 'admin' and active)::int as members`
  );
  const saved = parseRecipients(typeof row?.recipients === "string" ? row.recipients : "").emails;
  const recipients = saved.length ? saved : parseRecipients(process.env.ALERT_EMAIL_TO ?? "").emails;
  const facts: SetupFacts = {
    sessionSecret: sessionSecretConfigured(),
    demoOn: process.env.SEED_DEMO === "true" || process.env.SIMULATOR === "true" || Boolean(row?.simulated_source),
    orgSaved: Boolean(row?.org_saved),
    emailConfigured: emailConfigured(),
    recipients: recipients.length,
    testEmailSent: Boolean(row?.test_sent),
    sites: row?.sites ?? 0,
    deviceSources: row?.device_sources ?? 0,
    lastSeenAt: row?.last_seen ?? null,
    limitsSet: Boolean(row?.limits_set),
    alertRaised: Boolean(row?.alert_raised),
    members: row?.members ?? 0,
    now
  };
  const steps = buildSetupSteps(facts);
  return { steps, progress: setupProgress(steps) };
}
