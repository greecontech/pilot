# D2 requirements coverage (month 1)

This maps each requirement in *D2 – Specifikimi i kërkesave funksionale dhe teknike të Greecon Platform* to what the platform implements at the end of project month 1 (September 2026).

## Functional requirements (§5)

| § | Requirement | Implementation |
|---|---|---|
| 5.1 | Create and administer users; roles and access levels; activate and deactivate users; control access by role | `/admin/users`, with accounts created by password or by one-time invitation link (`/join/<token>`). The roles are `admin`, `operator` and `viewer`. Access is checked on the server for every page and action (`requireUser(role)`). A deactivated user loses access immediately, and at least one active administrator must always remain. |
| 5.2 | Centralized dashboard: structured information, quick access, indicators, navigation, items that need attention | `/`: key figures, "Needs attention" (active alerts, critical first), and per-site metric tiles showing status and a 24-hour trend. |
| 5.3 | Receive and record data; organize and store it; view current and historical data; filter and search | `/data` (filters, pagination, manual entry, CSV import and export), `/api/ingest`, and PostgreSQL storage indexed by metric and time. |
| 5.4 | Gradual integration of sources, devices and external systems | Sites, then data sources (device, API, manual, simulated), then metrics. Each source has its own API key; only the SHA-256 hash of the key is stored. Metrics are created automatically on first ingestion. |
| 5.5 | Current state, change over time, comparison, trends, deviations, charts and tables | `/monitoring`: charts with limit lines, current, average, min/max and limits, period presets or a custom range, and an overlay of the previous period. |
| 5.6 | Notifications and signals for deviations, extensible later | Every new reading is checked against the metric's limits. An alert is warning or critical, with one active alert per breach. Alerts close automatically once values return to range. Acknowledgements are audited. |
| 5.7 | Reports: key indicators, by period, filtered, structured, for decision-making | `/reports`, with CSV export and print. The change against the previous period is shown only when that period has at least half as many readings. |
| 5.8 | System administration: users, roles, configuration | `/admin/users`, and `/admin/settings` (organization settings, system status, audit log). |

## Technical requirements (§6)

| § | Requirement | Implementation |
|---|---|---|
| 6.1 | Modular, extensible architecture | Each module is its own route under `src/app/(app)/<module>`. Shared logic lives in `src/lib` (ingestion, thresholds, queries, reports), and the schema is versioned SQL migrations. |
| 6.2 | Interoperability | A JSON ingestion API and CSV import/export. The schema is ready for the MQTT/edge gateway work in `greecon-tech/web`. |
| 6.3 | Performance and stability | Aggregation runs in SQL (`date_bin`), with about 200 points per chart. Readings are indexed by `(metric_id, ts)`, and `/api/health` serves as the Railway health check. |
| 6.4 | Security | bcrypt password hashes, HTTP-only signed session cookies, role checks on the server, login throttling, hashed API keys, CSV formula neutralization, and an audit log of every change. |
| 6.5 | Usability | The Greecon design system, calm status labels and a responsive layout (phone to desktop). |
| 6.6 | Scalability | New users, modules, sources and metrics need no code changes. |
| 6.7 | Maintenance | TypeScript strict mode, unit tests (`npm test`) and idempotent migrations run on every deploy. |

## Next steps (months 2–3, per D1)

- D3: detail the module structure with pilot partners. Candidates include per-site access for authorized users, and email notifications for critical alerts.
- Connect the first real device or gateway to `/api/ingest`, replacing the simulated sources.
- Add an Albanian interface language.
