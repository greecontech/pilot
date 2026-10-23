import type { ReactNode } from "react";
import { Funders } from "@/components/Funders";
import { Logo, Mark } from "@/components/Logo";

/** The two-column layout shared by the sign-in page and the invitation page. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth">
      <section className="auth-brand" aria-hidden="true">
        <div className="auth-brand-mark"><Mark size={64} color="#f7f1e9" /></div>
        <div>
          <p className="auth-kicker">Greecon Platform</p>
          <h1 className="auth-title">Nature and technology <em>in harmony.</em></h1>
          <p className="auth-lead">One intelligent system for renewable energy, smart agriculture and water management — monitored, measured and optimised in real time.</p>
        </div>
        <ul className="auth-sectors">
          <li>Energy</li><li>Agriculture</li><li>Water</li>
        </ul>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <Logo size={40} />
          {children}
          <p className="auth-foot">Greecon shpk · Durana Tech Park, Shijak · <a href="https://greecon.earth">greecon.earth</a></p>
        </div>
        <Funders />
      </section>
    </main>
  );
}
