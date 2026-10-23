import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { one } from "@/lib/db";
import { getUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

/** Explains an unfinished setup instead of failing with a generic server error. */
async function setupProblem(): Promise<string | null> {
  if (!process.env.DATABASE_URL) return "The database is not connected. Set DATABASE_URL on the service (Railway: ${{Postgres.DATABASE_URL}}) and redeploy.";
  try {
    const row = await one<{ n: number }>("select count(*)::int as n from users");
    if (!row || row.n === 0) return "No administrator exists yet. Set ADMIN_EMAIL and ADMIN_PASSWORD (min. 8 characters) on the service and redeploy.";
    return null;
  } catch {
    return "The database cannot be reached or is not initialised. Check DATABASE_URL and the deploy logs.";
  }
}

export default async function LoginPage() {
  const problem = await setupProblem();
  if (!problem && (await getUser().catch(() => null))) redirect("/");
  return (
    <AuthShell>
      {problem && <div className="notice error" role="alert">{problem}</div>}
      <LoginForm />
      <p className="small muted">Have an invitation? Open the link you were sent to create your account. No link yet? Ask your administrator.</p>
    </AuthShell>
  );
}
