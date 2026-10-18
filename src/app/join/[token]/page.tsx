import { AuthShell } from "@/components/AuthShell";
import { one } from "@/lib/db";
import { findInvitation } from "@/lib/invites";
import { ROLE_LABELS } from "@/lib/roles";
import { JoinForm } from "./JoinForm";

export const dynamic = "force-dynamic";
// The link carries the secret: do not leak it to other sites through the Referer header.
export const metadata = { title: "Create your account", referrer: "no-referrer" as const };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findInvitation(token).catch(() => null);
  const open = invitation?.state === "open" ? invitation : null;
  const org = open
    ? (await one<{ value: string }>("select value from settings where key = 'organization_name'").catch(() => null))?.value
    : null;

  return (
    <AuthShell>
      {open ? (
        <JoinForm token={token} lockedEmail={open.email} role={ROLE_LABELS[open.role]} organization={typeof org === "string" && org ? org : "Greecon shpk"} />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <h1 style={{ fontSize: 20 }}>This link does not work</h1>
          <div className="notice error" role="alert">
            This invitation link is not valid. It may have expired or already been used. Ask your administrator for a new one.
          </div>
          <a className="button secondary" href="/login">Go to sign in</a>
        </div>
      )}
    </AuthShell>
  );
}
