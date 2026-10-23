// Pure email content and validation — no I/O, unit-tested in tests/email.test.ts.
// Labels are bilingual (English / Albanian) because the pilot users are Albanian farmers.

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Splits a comma/semicolon/newline separated list. Returns the valid addresses and any that were rejected. */
export function parseRecipients(raw: string) {
  const seen = new Set<string>();
  const invalid: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL.test(email) || email.length > 200) invalid.push(part.trim());
    else seen.add(email);
  }
  return { emails: [...seen], invalid };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type Email = { subject: string; text: string; html: string };

type Row = [label: string, value: string];

function render(heading: string, rows: Row[], link: string | null, linkLabel: string): { text: string; html: string } {
  const text = [heading, "", ...rows.map(([k, v]) => `${k}: ${v}`), ...(link ? ["", `${linkLabel}: ${link}`] : [])].join("\n");
  const html =
    `<div style="font-family:Georgia,serif;color:#1a2a22;max-width:520px">` +
    `<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(heading)}</h2>` +
    `<table style="border-collapse:collapse;font-size:15px">` +
    rows.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#5b6b62">${escapeHtml(k)}</td><td style="padding:3px 0"><strong>${escapeHtml(v)}</strong></td></tr>`).join("") +
    `</table>` +
    (link ? `<p style="margin:16px 0 0"><a href="${escapeHtml(link)}" style="color:#386f54">${escapeHtml(linkLabel)}</a></p>` : "") +
    `<p style="margin:20px 0 0;font-size:12px;color:#5b6b62">Greecon Platform</p></div>`;
  return { text, html };
}

export type AlertEmailInput = {
  severity: "warning" | "critical";
  message: string;
  site: string;
  metric: string;
  value: number;
  threshold: number;
  unit: string;
  when: string;
  link: string | null;
};

/** One email for all alerts of a site that are due together, so two sensors drying at once is one message. */
export function buildAlertEmail(alerts: AlertEmailInput[]): Email {
  const first = alerts[0];
  const critical = alerts.some((a) => a.severity === "critical");
  const level = critical ? "Critical alert / Alarm kritik" : "Warning / Paralajmërim";
  const withUnit = (n: number, a: AlertEmailInput) => `${n}${a.unit ? ` ${a.unit}` : ""}`;

  if (alerts.length === 1) {
    const rows: Row[] = [
      ["Site / Vendi", first.site],
      ["Metric / Matja", first.metric],
      ["Value / Vlera", withUnit(first.value, first)],
      ["Limit / Kufiri", withUnit(first.threshold, first)],
      ["Time / Koha", first.when]
    ];
    const body = render(`${level}: ${first.message}`, rows, first.link, "Open alerts / Hap alarmet");
    return { subject: `[Greecon] ${critical ? "CRITICAL" : "Warning"} · ${first.message} — ${first.site}`, ...body };
  }

  const rows: Row[] = [
    ["Site / Vendi", first.site],
    ...alerts.map((a): Row => [a.metric, `${withUnit(a.value, a)} (limit / kufiri ${withUnit(a.threshold, a)})`]),
    ["Time / Koha", first.when]
  ];
  const body = render(`${level}: ${alerts.length} alerts / alarme`, rows, first.link, "Open alerts / Hap alarmet");
  return { subject: `[Greecon] ${critical ? "CRITICAL" : "Warning"} · ${alerts.length} alerts — ${first.site}`, ...body };
}

export function buildOfflineEmail(input: { source: string; site: string; lastSeen: string; minutes: number; link: string | null }): Email {
  const rows: Row[] = [
    ["Site / Vendi", input.site],
    ["Station / Stacioni", input.source],
    ["Last data / Të dhënat e fundit", input.lastSeen]
  ];
  const heading = `Station offline for ${input.minutes}+ min / Stacioni pa lidhje`;
  const body = render(heading, rows, input.link, "Open sources / Hap burimet");
  return { subject: `[Greecon] Station offline — ${input.source}, ${input.site}`, ...body };
}

export function buildTestEmail(link: string | null): Email {
  const body = render("Test email / Email provë", [["Status", "Email alerts are working / Njoftimet me email funksionojnë"]], link, "Open platform / Hap platformën");
  return { subject: "[Greecon] Test email", ...body };
}

export function buildInviteEmail(input: { organization: string; role: string; inviter: string; days: number; link: string }): Email {
  const rows: Row[] = [
    ["Invited by / Ftuar nga", input.inviter],
    ["Role / Roli", input.role],
    ["Valid for / Vlen për", `${input.days} days / ditë`]
  ];
  const body = render("You are invited to Greecon Platform / Jeni ftuar në Greecon Platform", rows, input.link, "Create your account / Krijoni llogarinë tuaj");
  return { subject: `[Greecon] Invitation to ${input.organization}`, ...body };
}
