import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Nav, type NavItem } from "@/components/Nav";
import { one } from "@/lib/db";
import { ROLE_LABELS, atLeast } from "@/lib/roles";
import { loadSetup } from "@/lib/setup";
import { requireUser } from "@/lib/session";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const alerts = await one<{ n: number }>("select count(*)::int as n from alerts where status = 'open'");

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", group: "Operations" },
    { href: "/monitoring", label: "Monitoring", group: "Operations" },
    { href: "/alerts", label: "Alerts", count: alerts?.n, group: "Operations" },
    { href: "/data", label: "Data", group: "Data" },
    { href: "/sources", label: "Sites & sources", group: "Data" },
    { href: "/reports", label: "Reports", group: "Data" },
    { href: "/project", label: "Project plan", group: "Project" }
  ];
  if (atLeast(user.role, "admin")) {
    const { progress } = await loadSetup();
    items.push(
      { href: "/setup", label: "Setup guide", count: progress.remaining, group: "Administration" },
      { href: "/admin/users", label: "Users & roles", group: "Administration" },
      { href: "/admin/settings", label: "Settings & audit", group: "Administration" }
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" style={{ textDecoration: "none" }}>
          <Logo />
        </Link>
        <Nav items={items} />
        <div className="sidebar-foot">
          <Link href="/account" style={{ textDecoration: "none" }}>
            <div className="who">{user.name}</div>
            <div className="role">{ROLE_LABELS[user.role]}</div>
          </Link>
          <form action={logout}>
            <button type="submit" className="secondary small">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
