import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUPS, buildSetupSteps, setupProgress, type SetupFacts } from "../src/lib/setup-steps.ts";

const now = new Date("2026-11-04T12:00:00Z");
const empty: SetupFacts = {
  sessionSecret: false, demoOn: true, orgSaved: false, emailConfigured: false, recipients: 0, testEmailSent: false,
  sites: 0, deviceSources: 0, lastSeenAt: null, limitsSet: false, alertRaised: false, members: 0, now
};
const allDone: SetupFacts = {
  sessionSecret: true, demoOn: false, orgSaved: true, emailConfigured: true, recipients: 2, testEmailSent: true,
  sites: 1, deviceSources: 1, lastSeenAt: new Date("2026-11-04T11:50:00Z"), limitsSet: true, alertRaised: true, members: 1, now
};

test("a fresh platform has nothing done and starts with the first step", () => {
  const steps = buildSetupSteps(empty);
  const p = setupProgress(steps);
  assert.equal(p.done, 0);
  assert.equal(p.total, steps.length);
  assert.equal(p.next?.id, "secret");
});

test("a finished setup has no next step", () => {
  const p = setupProgress(buildSetupSteps(allDone));
  assert.equal(p.done, p.total);
  assert.equal(p.remaining, 0);
  assert.equal(p.next, null);
});

test("steps are unique, grouped in a fixed order, and each has instructions and a destination", () => {
  const steps = buildSetupSteps(empty);
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
  const groupsInOrder = [...new Set(steps.map((s) => s.group))];
  assert.deepEqual(groupsInOrder, GROUPS);
  for (const s of steps) {
    assert.ok(s.how.length > 0, `${s.id} has instructions`);
    assert.match(s.href, /^\//, `${s.id} points inside the platform`);
  }
});

test("the next step is the first one not done, even if later ones are", () => {
  const steps = buildSetupSteps({ ...allDone, emailConfigured: false });
  assert.equal(setupProgress(steps).next?.id, "email");
  assert.equal(setupProgress(steps).remaining, 1);
});

test("demo data counts as not done; turning it off completes the step", () => {
  assert.equal(buildSetupSteps({ ...allDone, demoOn: true }).find((s) => s.id === "demo")?.done, false);
  assert.equal(buildSetupSteps(allDone).find((s) => s.id === "demo")?.done, true);
});

test("details say what the platform sees", () => {
  const steps = buildSetupSteps(allDone);
  assert.equal(steps.find((s) => s.id === "data")?.detail, "Last data 10 min ago");
  assert.equal(steps.find((s) => s.id === "recipients")?.detail, "2 recipients");
  assert.equal(buildSetupSteps({ ...allDone, recipients: 1 }).find((s) => s.id === "recipients")?.detail, "1 recipient");
  assert.equal(buildSetupSteps({ ...allDone, lastSeenAt: new Date("2026-11-02T12:00:00Z") }).find((s) => s.id === "data")?.detail, "Last data 2 d ago");
  assert.equal(buildSetupSteps(empty).find((s) => s.id === "data")?.detail, undefined);
});

test("inviting the farmer recommends the read-only role, and any non-admin account completes the step", () => {
  const step = buildSetupSteps(empty).find((s) => s.id === "member")!;
  assert.match(step.how.join(" "), /Authorized user/);
  assert.equal(buildSetupSteps({ ...empty, members: 1 }).find((s) => s.id === "member")?.done, true);
});
