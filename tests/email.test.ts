import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAlertEmail, buildInviteEmail, buildOfflineEmail, escapeHtml, parseRecipients } from "../src/lib/email-templates.ts";

test("parses, lowercases and de-duplicates recipients, and reports invalid ones", () => {
  const { emails, invalid } = parseRecipients("Farmer@Example.com; pm@greecon.earth,\nfarmer@example.com, not-an-email, a@b");
  assert.deepEqual(emails, ["farmer@example.com", "pm@greecon.earth"]);
  assert.deepEqual(invalid, ["not-an-email", "a@b"]);
});

test("empty recipient input is valid and yields no addresses", () => {
  assert.deepEqual(parseRecipients(" , ;\n"), { emails: [], invalid: [] });
});

const alert = {
  severity: "critical" as const, message: "Soil moisture 1 below limit: 12.5 % (limit 28 %)", site: "Pilot farm",
  metric: "Soil moisture 1", value: 12.5, threshold: 28, unit: "%", when: "12 Nov 2026, 06:10", link: "https://platform.greecon.earth/alerts"
};

test("alert email carries severity, site, value, limit and a link, in both languages", () => {
  const mail = buildAlertEmail([alert]);
  assert.match(mail.subject, /CRITICAL/);
  assert.match(mail.subject, /Pilot farm/);
  assert.match(mail.text, /Alarm kritik/);
  assert.match(mail.text, /Value \/ Vlera: 12\.5 %/);
  assert.match(mail.text, /Limit \/ Kufiri: 28 %/);
  assert.match(mail.text, /https:\/\/platform\.greecon\.earth\/alerts/);
  assert.match(buildAlertEmail([{ ...alert, severity: "warning" }]).subject, /Warning/);
});

test("alert email omits the link line when the public URL is unknown", () => {
  assert.doesNotMatch(buildAlertEmail([{ ...alert, link: null }]).text, /https?:\/\//);
});

test("user-controlled names are HTML-escaped", () => {
  const mail = buildAlertEmail([{ ...alert, site: '<script>alert("x")</script>' }]);
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /&lt;script&gt;/);
  assert.equal(escapeHtml(`a&b<"'>`), "a&amp;b&lt;&quot;&#39;&gt;");
});

test("alerts due together for a site become one email listing every metric", () => {
  const second = { ...alert, metric: "Soil moisture 2", value: 14, severity: "warning" as const };
  const mail = buildAlertEmail([alert, second]);
  assert.match(mail.subject, /CRITICAL · 2 alerts — Pilot farm/);
  assert.match(mail.text, /Soil moisture 1: 12\.5 % \(limit \/ kufiri 28 %\)/);
  assert.match(mail.text, /Soil moisture 2: 14 % \(limit \/ kufiri 28 %\)/);
});

test("offline email names the station, the site and how long it has been silent", () => {
  const mail = buildOfflineEmail({ source: "Soil station 1", site: "Pilot farm", lastSeen: "12 Nov 2026, 04:00", minutes: 90, link: null });
  assert.match(mail.subject, /Soil station 1/);
  assert.match(mail.text, /90\+ min/);
  assert.match(mail.text, /Stacioni/);
});

test("invitation email carries the link, who invited, the role and the validity, in both languages", () => {
  const mail = buildInviteEmail({ organization: "Greecon shpk", role: "Operator", inviter: "Eridon Manuka", days: 7, link: "https://platform.greecon.earth/join/gi_abc" });
  assert.match(mail.subject, /Invitation to Greecon shpk/);
  assert.match(mail.text, /Jeni ftuar/);
  assert.match(mail.text, /Invited by \/ Ftuar nga: Eridon Manuka/);
  assert.match(mail.text, /Valid for \/ Vlen për: 7 days \/ ditë/);
  assert.match(mail.text, /https:\/\/platform\.greecon\.earth\/join\/gi_abc/);
  assert.match(mail.html, /href="https:\/\/platform\.greecon\.earth\/join\/gi_abc"/);
});

test("names in the invitation email are HTML-escaped", () => {
  const mail = buildInviteEmail({ organization: "x", role: "Operator", inviter: "<img src=x onerror=alert(1)>", days: 3, link: "https://e.com/join/t" });
  assert.doesNotMatch(mail.html, /<img/);
});
