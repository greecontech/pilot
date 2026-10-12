"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";
import { parseRecipients } from "@/lib/email-templates";
import { text, type FormState } from "@/lib/form-state";
import { alertRecipients, emailConfigured, sendTestEmail } from "@/lib/notify";
import { requireUser } from "@/lib/session";

export async function saveSettings(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("admin");
  const values = {
    organization_name: text(form, "organization_name", 120),
    contact_email: text(form, "contact_email", 200)
  };
  for (const [key, value] of Object.entries(values)) {
    await query(
      "insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value",
      [key, JSON.stringify(value)]
    );
  }
  await audit(user.id, "update", "settings", null, values);
  revalidatePath("/admin/settings");
  return { ok: "Settings saved." };
}

export async function saveAlertRecipients(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("admin");
  const { emails, invalid } = parseRecipients(text(form, "alert_recipients", 2000));
  if (invalid.length) return { error: `Not a valid email address: ${invalid.join(", ")}` };
  if (emails.length > 10) return { error: "At most 10 recipients." };
  await query(
    "insert into settings (key, value) values ('alert_recipients', $1) on conflict (key) do update set value = excluded.value",
    [JSON.stringify(emails.join(", "))]
  );
  await audit(user.id, "update", "settings", "alert_recipients", { recipients: emails });
  revalidatePath("/admin/settings");
  return { ok: emails.length ? `Alert emails will go to ${emails.join(", ")}.` : "No recipients: alert emails are off." };
}

export async function sendTestEmailAction(): Promise<FormState> {
  const user = await requireUser("admin");
  if (!emailConfigured()) return { error: "Email is not configured. Set RESEND_API_KEY and ALERT_EMAIL_FROM on the server." };
  const to = await alertRecipients();
  if (to.length === 0) return { error: "Add at least one recipient and save first." };
  try {
    await sendTestEmail(to);
  } catch (error) {
    return { error: `Sending failed: ${(error as Error).message}` };
  }
  await audit(user.id, "test", "email", null, { to });
  return { ok: `Test email sent to ${to.join(", ")}. Check the inbox, and the spam folder.` };
}
