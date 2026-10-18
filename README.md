# Greecon Platform

Operational platform of **Greecon shpk** for monitoring energy, water and agriculture sites. It is built within the **Startup Albania 2026** project, supported by the Ministry of Economy and Innovation.

This repository is the working base of the platform described in the project's technology development deliverables: **D1**, the work plan, and **D2**, the functional and technical specification. [`docs/requirements-coverage.md`](docs/requirements-coverage.md) maps each D2 requirement to what is implemented.

## What it does

| Module | D2 | Summary |
|---|---|---|
| Sign-in and roles | §5.1, §9.1 | Email and password sign-in. Three roles: **Administrator**, **Operator** and **Authorized user** (read-only). Access is enforced on the server. People join by **invitation** (see [Accounts and invitations](#accounts-and-invitations)). |
| Dashboard | §5.2 | Key figures, alerts that need attention, and each site's metrics with 24-hour trends. |
| Data | §5.3 | Every reading, filterable by site, metric, origin and period. Supports manual entry, CSV import and CSV export. |
| Sites and sources | §5.4 | Sites, data sources (device, API, manual), and metrics with lower and upper limits. Sources get API keys for ingestion. |
| Monitoring | §5.5, §9.4–9.5 | A chart for each metric with its limits, a period selector (24 h to 90 days, or custom), and comparison with the previous period. |
| Alerts | §5.6, §9.6 | An alert is raised when a reading crosses a limit: warning or critical. Alerts can be acknowledged or resolved, and they close automatically once values return to range. New alerts, and stations that stop sending, are also emailed (see [Email alerts](#email-alerts)). |
| Reports | §5.7, §9.7 | A summary per metric for a chosen period: min, max, average, change against the previous period, share of readings outside limits, and alerts. Can be exported to CSV or printed. |
| Administration | §5.8 | Users and roles, invitations, organization settings, system status and a full audit log. |
| Setup guide | – | A checklist of the pilot setup steps that ticks itself from the platform's own state (see [Setup guide](#setup-guide)). |
| Project plan | Aneksi 1 | Startup Albania activity plan (Gantt chart), the current month, and the status of deliverables D1–D7. |

## Stack

- **Next.js 16** (App Router, server components and server actions) with TypeScript.
- **PostgreSQL** accessed through `pg`. The schema is plain SQL in `db/`, applied by `scripts/migrate.mjs` on every start.
- Sessions use signed JWT cookies (`jose`), and passwords are hashed with bcrypt.
- Charts are server-rendered SVG, with no client-side chart library.
- The design follows the Greecon design system: IBM Plex Serif and the brand palette.

## Deploying to Railway

1. **Create a project.** In Railway, choose **New Project → Deploy from GitHub repo** and select the GitHub repository that holds this code. Railway reads `railway.json`, builds the `Dockerfile` and uses `/api/health` as the health check.
2. **Add a database.** Choose **+ New → Database → PostgreSQL** in the same project.
3. **Set variables.** Under the app service's **Variables**, set the following (see `.env.example`):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (a reference to the Postgres service) |
   | `SESSION_SECRET` | A random string of 32 or more characters, e.g. `openssl rand -base64 48` |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | The first administrator, created on first start |
   | `SEED_DEMO` | `true` for demo sites with 30 days of history (optional) |
   | `SIMULATOR` | `true` for live simulated readings every 60 s (optional) |
   | `PROJECT_START_DATE` | `2026-08-01` (project month 1 = August 2026) |
   | `RESEND_API_KEY`, `ALERT_EMAIL_FROM`, `ALERT_EMAIL_TO`, `APP_URL` | Email alerts (optional, see [Email alerts](#email-alerts)) |

4. **Get a URL.** Under **Settings → Networking → Generate Domain**, create a public URL. A custom domain such as `platform.greecon.earth` can be added in the same place.
5. **Deploy and sign in.** Deploy, then sign in with the admin account and change the password under **Account**.

Every start runs the database migrations, which are idempotent and safe to repeat, before the server starts.

To remove the demo data later, set `SEED_DEMO` and `SIMULATOR` to `false`. Then delete the demo sites under **Sites & sources**.

## Email alerts

The farmer should not have to watch a dashboard, so the platform emails alerts. Two kinds of email are sent, each in English and Albanian:

- **A new alert**, when a reading first crosses a limit. Alerts due together for one site go out as one email, so two sensors drying at once is one message. A metric is emailed at most once per `ALERT_EMAIL_COOLDOWN_HOURS` (default 6), so a value hovering around its limit does not produce a message every few minutes. If it is still breaching when the cooldown ends, the email is sent then. Only the start of a breach is emailed.
- **Station offline**, when a **Device** source has sent nothing for `OFFLINE_AFTER_MINUTES` (default 90). Without it a dead station looks exactly like healthy soil. It re-arms as soon as the station sends data again. Deactivate a source under **Sites & sources** to stop these emails.

Email is sent through [Resend](https://resend.com)'s HTTPS API, because Railway blocks outbound SMTP on its Free, Trial and Hobby plans. To enable it:

1. Create a Resend account and verify the sending domain (for example `greecon.earth`) by adding the DNS records Resend shows.
2. Create an API key and set `RESEND_API_KEY` and `ALERT_EMAIL_FROM` (for example `Greecon Alerts <alerts@greecon.earth>`) on the app service. Optionally set `APP_URL` so emails link to your platform address.
3. Under **Settings & audit → Alert emails**, enter the recipients and press **Send test email**. (`ALERT_EMAIL_TO` provides the initial recipients.)

Without `RESEND_API_KEY` nothing is sent, and the platform works as before. A failed send never delays or fails a device upload: the alert is released and retried by a sweep that runs every `NOTIFY_SWEEP_SECONDS` (default 300). Alerts older than 24 hours and alerts on simulated sources are never emailed.

## Setup guide

Administrators see a **Setup guide** in the sidebar, with the number of steps still open. It lists the 12 steps of the pilot setup in four groups (platform, email alerts, the pilot station, people), explains each one, and links to the page where it is done. A step ticks itself when the platform can see it is done, for example the first reading arrived or a lower limit was set, so the page is always the true state, never a list somebody has to keep up to date. While steps remain, the dashboard shows the next one.

## Accounts and invitations

There is no open sign-up: anyone who found the address could otherwise read farm data. People join by invitation instead.

1. An administrator opens **Users & roles → Invite someone**, optionally enters the person's email, chooses a role and how long the link stays valid (3, 7 or 14 days), and presses **Create invitation link**.
2. The link is shown **once** and is also emailed to the person when an email address was given and email alerts are set up. Only a SHA-256 hash of it is stored, so a lost link is revoked and replaced, never looked up.
3. The person opens the link, enters their name, and chooses their own password (10 or more characters). Nobody else ever knows it. They are signed in at once.

What keeps this safe:

- Invitations create **Authorized users** (read-only) or **Operators**. Administrators are only added by an administrator under **Add user with a password**.
- A link works **once**. Two people opening it at the same moment create one account: the invitation is claimed atomically in the same database transaction that creates the user.
- A link can be **revoked** at any time, and expires on its own. An email address that already has an account is refused, and the link stays usable.
- With an email address on the invitation, only that address is accepted, whatever the browser sends.
- The link page sends no referrer, a link that is wrong, used, revoked or expired shows the same neutral message, and the token never appears in the audit log. Every step is audited.

For a farmer, choose **Authorized user**. An **Operator** can also change limits, create sources, replace a station's key and deactivate it, and either of the last two silently stops the station.

## Local development

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD
set -a; . ./.env; set +a
npm run migrate
npm run dev                 # http://localhost:3000
```

Checks:

```bash
npm run typecheck
npm test
npm run build
```

## Sending data from devices

Create a source of type **Device** or **API integration** under **Sites & sources** and copy its key. It is shown only once. Then send readings:

```bash
curl -X POST https://<your-domain>/api/ingest \
  -H "Authorization: Bearer gk_xxxxxxxx_..." \
  -H "Content-Type: application/json" \
  -d '{"readings":[{"metric":"soil_moisture","value":31.4,"unit":"%"}]}'
```

The API accepts up to 5,000 readings per request, and timestamps are optional (ISO 8601). A metric key the platform hasn't seen before is created automatically. A request with any invalid reading is rejected as a whole, with the index and reason for each error.

## Structure

```
db/                    SQL migrations (schema, project plan)
scripts/migrate.mjs    applies migrations, creates the first admin
src/instrumentation.ts demo seed and simulator on server start
src/lib/               database, session, roles, ingestion and alerting, queries, reports
src/app/(app)/         authenticated pages
src/app/api/           health, ingestion and CSV export endpoints
tests/                 unit tests (node --test)
devices/               pilot station firmware (ESP32) and a test sender
```

## Pilot

The pilot focuses on one feature: soil moisture monitoring with alerts. The plan and checklist are in [`docs/pilot-soil-moisture.md`](docs/pilot-soil-moisture.md). The station hardware, wiring and firmware are in [`devices/esp32-soil-moisture`](devices/esp32-soil-moisture/README.md). To test without hardware, run `python3 devices/emulator/send_test_readings.py --url <platform-url> --key <device-key>`.
