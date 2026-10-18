import Link from "next/link";
import { Badge, PageHead, Panel } from "@/components/ui";
import { loadSetup } from "@/lib/setup";
import { GROUPS } from "@/lib/setup-steps";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Setup guide" };

/** Renders text with `code` spans for anything between backticks. */
function Rich({ text }: { text: string }) {
  return <>{text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
}

export default async function SetupGuide() {
  await requireUser("admin");
  const { steps, progress } = await loadSetup();
  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="stack">
      <PageHead
        title="Setup guide"
        intro="The steps to get the pilot running, in order. Each one ticks itself when the platform sees it is done, so you can stop and come back at any time."
      />

      <div className="panel">
        <div className="panel-body">
          <div className="spread">
            <div>
              <div className="small muted">Progress</div>
              <div style={{ fontSize: 22 }}>{progress.done} of {progress.total} steps done</div>
            </div>
            {progress.next ? (
              <div style={{ textAlign: "right" }}>
                <div className="small muted">Next step</div>
                <div>{progress.next.title}</div>
              </div>
            ) : (
              <Badge status="done" label="Setup complete" />
            )}
          </div>
          <div className="progress" role="progressbar" aria-valuenow={progress.done} aria-valuemin={0} aria-valuemax={progress.total} aria-label="Setup progress">
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {GROUPS.map((group) => {
        const inGroup = steps.filter((s) => s.group === group);
        return (
          <Panel key={group} title={group} meta={`${inGroup.filter((s) => s.done).length} of ${inGroup.length} done`} flush>
            <ol className="checklist">
              {inGroup.map((step) => {
                const isNext = progress.next?.id === step.id;
                return (
                  <li key={step.id} className={step.done ? "done" : isNext ? "next" : undefined}>
                    <span className="mark" aria-hidden="true">{step.done ? "✓" : ""}</span>
                    <div className="body">
                      <div className="spread">
                        <h3>{step.title}</h3>
                        <div className="row">
                          {step.detail && <span className="small muted">{step.detail}</span>}
                          {step.done ? <Badge status="done" label="done" /> : isNext ? <Badge status="watch" label="next" /> : <Badge status="planned" label="to do" />}
                        </div>
                      </div>
                      <p className="small muted">{step.summary}</p>
                      {!step.done && (
                        <details open={isNext}>
                          <summary>How to do it</summary>
                          <ol className="how">
                            {step.how.map((line, i) => <li key={i}><Rich text={line} /></li>)}
                          </ol>
                          <Link className="button secondary small" href={step.href}>{step.hrefLabel}</Link>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        );
      })}
    </div>
  );
}
