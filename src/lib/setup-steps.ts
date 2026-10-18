// The pilot setup guide: what has to be done, in order, and how to tell it is done.
// Pure — the platform feeds it facts read from the database; unit-tested in tests/setup.test.ts.

export type SetupFacts = {
  sessionSecret: boolean;
  demoOn: boolean;
  orgSaved: boolean;
  emailConfigured: boolean;
  recipients: number;
  testEmailSent: boolean;
  /** Sites that are not demo sites. */
  sites: number;
  deviceSources: number;
  /** Most recent time any device source sent data. */
  lastSeenAt: Date | null;
  limitsSet: boolean;
  alertRaised: boolean;
  /** Active accounts that are not administrators (invited or added people). */
  members: number;
  now: Date;
};

export type SetupGroup = "Platform" | "Email alerts" | "The pilot station" | "People";

export type SetupStep = {
  id: string;
  group: SetupGroup;
  title: string;
  /** One sentence: what this is and why it matters. */
  summary: string;
  /** What to do, step by step. Text between backticks is shown as code. */
  how: string[];
  href: string;
  hrefLabel: string;
  done: boolean;
  /** What the platform currently sees, shown next to the status. */
  detail?: string;
};

export const GROUPS: SetupGroup[] = ["Platform", "Email alerts", "The pilot station", "People"];

function ago(from: Date, now: Date) {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / 1440)} d ago`;
}

export function buildSetupSteps(f: SetupFacts): SetupStep[] {
  return [
    {
      id: "secret", group: "Platform", title: "Protect sign-in sessions",
      summary: "Without a session secret, everyone is signed out every time the server restarts.",
      how: ["On the Railway app service open Variables.", "Set `SESSION_SECRET` to 40 or more random characters (your password manager can generate them).", "Redeploy."],
      href: "/admin/settings", hrefLabel: "Open settings", done: f.sessionSecret
    },
    {
      id: "demo", group: "Platform", title: "Turn demo data off",
      summary: "Demo sites and simulated readings would mix with the pilot's real data.",
      how: ["Set `SEED_DEMO` and `SIMULATOR` to `false` on the Railway service and redeploy.", "Under Sites & sources, delete the demo sites."],
      href: "/sources", hrefLabel: "Open sites & sources", done: !f.demoOn
    },
    {
      id: "org", group: "Platform", title: "Save your organization details",
      summary: "The name and contact email appear in the platform and in emails.",
      how: ["Open Settings & audit.", "Enter the organization name and contact email under Organization and press Save."],
      href: "/admin/settings", hrefLabel: "Open settings", done: f.orgSaved
    },
    {
      id: "email", group: "Email alerts", title: "Connect the email service",
      summary: "Alerts go out by email through Resend, because Railway blocks regular email on its Hobby plan.",
      how: [
        "Create an account at resend.com and verify your sending domain (add the DNS records it shows).",
        "Create an API key with sending access.",
        "On the Railway service set `RESEND_API_KEY` and `ALERT_EMAIL_FROM`, for example `Greecon Alerts <alerts@greecon.earth>`, then redeploy."
      ],
      href: "/admin/settings", hrefLabel: "Open settings", done: f.emailConfigured
    },
    {
      id: "recipients", group: "Email alerts", title: "Add alert recipients",
      summary: "The people who should be emailed when soil gets too dry or a station goes silent.",
      how: ["Open Settings & audit → Alert emails.", "Enter the farmer's and the project manager's addresses, separated by commas, and press Save recipients."],
      href: "/admin/settings", hrefLabel: "Open settings", done: f.recipients > 0,
      detail: f.recipients > 0 ? `${f.recipients} recipient${f.recipients === 1 ? "" : "s"}` : undefined
    },
    {
      id: "testmail", group: "Email alerts", title: "Send a test email",
      summary: "Proves that alerts will reach people, before a real alert needs to.",
      how: ["Press Send test email under Alert emails.", "Check that it arrived in every recipient's inbox, spam folder included."],
      href: "/admin/settings", hrefLabel: "Open settings", done: f.testEmailSent
    },
    {
      id: "site", group: "The pilot station", title: "Create the pilot site",
      summary: "A site is the farm or plot being monitored.",
      how: ["Under Sites & sources open Add a site.", "Enter the farm's name, choose sector Agriculture and add the location."],
      href: "/sources", hrefLabel: "Open sites & sources", done: f.sites > 0
    },
    {
      id: "device", group: "The pilot station", title: "Create the station's device and key",
      summary: "Each station has its own key. It is how the platform knows who is sending.",
      how: [
        "On the site choose Add a data source to this site, kind Device.",
        "Copy the key at once: it is shown only one time. Store it in your password manager.",
        "Use one source and one key per station."
      ],
      href: "/sources", hrefLabel: "Open sites & sources", done: f.deviceSources > 0
    },
    {
      id: "data", group: "The pilot station", title: "Receive the first readings",
      summary: "Proves the whole chain works: station, connection, platform.",
      how: [
        "Flash the station with its key (see the build tutorial), or run the simulator script with the key.",
        "This step turns green once a device has sent data."
      ],
      href: "/sources", hrefLabel: "Open sites & sources", done: f.lastSeenAt !== null,
      detail: f.lastSeenAt ? `Last data ${ago(f.lastSeenAt, f.now)}` : undefined
    },
    {
      id: "limits", group: "The pilot station", title: "Set the soil moisture lower limits",
      summary: "Without a limit no alert can be raised.",
      how: [
        "Under Sites & sources click Edit on Soil moisture 1, enter a Lower limit and press Save.",
        "Do the same for Soil moisture 2. We suggest 28% to start; agree it with the farmer."
      ],
      href: "/sources", hrefLabel: "Open sites & sources", done: f.limitsSet
    },
    {
      id: "alert", group: "The pilot station", title: "See an alert fire",
      summary: "Proves that a dry reading becomes an alert and an email.",
      how: [
        "On a Rehearsal source (never on the pilot station), send dry readings with the simulator script and `--dry`, or let a sensor dry out.",
        "Check that an alert appears on the Alerts page and that one email arrives."
      ],
      href: "/alerts", hrefLabel: "Open alerts", done: f.alertRaised
    },
    {
      id: "member", group: "People", title: "Invite the farmer",
      summary: "The farmer gets their own account and chooses their own password.",
      how: [
        "Open Users & roles → Invite someone and enter the farmer's email.",
        "Choose the role Authorized user: the farmer can see everything but cannot change a limit or stop a station by accident. Choose Operator only for a technician who maintains the system.",
        "Copy the link, or let the platform email it. The farmer opens it and creates the account."
      ],
      href: "/admin/users", hrefLabel: "Open users & roles", done: f.members > 0
    }
  ];
}

export function setupProgress(steps: SetupStep[]) {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, remaining: steps.length - done, next: steps.find((s) => !s.done) ?? null };
}
