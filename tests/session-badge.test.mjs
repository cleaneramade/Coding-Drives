// The session badge's reconciliation rules.
//
// Background: the badge used to be inferred — from in-progress task rows, from
// Windows Terminal TAB TITLES, from window handles — and it lied in both
// directions. It claimed a session after an app restart had left a task stuck
// "in progress" with nothing running, and it kept claiming one after you closed
// the terminal, because the title it was matching had been renamed by the CLI.
//
// It is now a fact, not an inference: every launch registers a session whose id
// is stamped into the child's command line, and one process query says which
// ids still exist. These tests pin that reconciliation (pure logic, no Windows
// needed) — the grace periods in particular, because they are what stops a
// single slow or failed probe from clearing a badge for a live session.
//
// Run: npm test

import test from "node:test";
import assert from "node:assert/strict";

// Mirrors server.js.
const START_GRACE = 25000;    // SESSION_START_GRACE_MS
const MISSING_GRACE = 12000;  // SESSION_MISSING_GRACE_MS

// Mirrors reconcileSessions. `live` is the probe result: a Set of session ids
// still running, or null when the probe itself failed. Mutates `sessions` the
// way the server does and returns { alive, died }.
function reconcile(sessions, live, now) {
  if (live === null) return { alive: sessions, died: [] };   // probe failed — change nothing
  const alive = [];
  const died = [];
  for (const s of sessions) {
    if (live.has(s.id)) {
      s.missingSince = 0;
      alive.push(s);
      continue;
    }
    if (now - s.startedAt < START_GRACE) { alive.push(s); continue; }
    if (!s.missingSince) { s.missingSince = now; alive.push(s); continue; }
    if (now - s.missingSince < MISSING_GRACE) { alive.push(s); continue; }
    died.push(s);
  }
  return { alive, died };
}

const T0 = 1_700_000_000_000;
const mk = (id, over = {}) => ({
  id, slug: "s", basename: "Proj", agent: "claude", kind: "interactive",
  startedAt: T0, missingSince: 0, taskIds: [], ...over,
});

test("a running session keeps its badge", () => {
  const sessions = [mk("a")];
  const { alive } = reconcile(sessions, new Set(["a"]), T0 + 60_000);
  assert.equal(alive.length, 1);
});

test("a closed terminal clears the badge after the missing grace", () => {
  const sessions = [mk("a")];
  const now = T0 + 60_000;
  // First pass only marks it missing — one absent probe is not proof.
  let r = reconcile(sessions, new Set(), now);
  assert.equal(r.alive.length, 1, "not dropped on the first miss");
  // Still inside the grace window.
  r = reconcile(r.alive, new Set(), now + MISSING_GRACE - 1);
  assert.equal(r.alive.length, 1);
  // Past it.
  r = reconcile(r.alive, new Set(), now + MISSING_GRACE + 1);
  assert.equal(r.alive.length, 0);
  assert.equal(r.died.length, 1);
});

test("a just-launched session survives before its process is findable", () => {
  const sessions = [mk("a", { startedAt: T0 })];
  const { alive } = reconcile(sessions, new Set(), T0 + START_GRACE - 1);
  assert.equal(alive.length, 1);
  assert.equal(alive[0].missingSince, 0, "the start grace must not arm the missing timer");
});

test("a failed probe never wipes live badges", () => {
  const sessions = [mk("a"), mk("b")];
  const { alive, died } = reconcile(sessions, null, T0 + 10 * 60_000);
  assert.equal(alive.length, 2);
  assert.equal(died.length, 0);
});

test("a session that reappears has its missing timer cleared", () => {
  const sessions = [mk("a")];
  const now = T0 + 60_000;
  let r = reconcile(sessions, new Set(), now);          // marks missing
  assert.ok(r.alive[0].missingSince > 0);
  r = reconcile(r.alive, new Set(["a"]), now + 1000);   // back again
  assert.equal(r.alive[0].missingSince, 0);
  // …and a later single miss must start the clock over, not inherit the old one.
  r = reconcile(r.alive, new Set(), now + 2000);
  assert.equal(r.alive.length, 1);
});

test("closing one of two sessions on the same project drops exactly one", () => {
  const sessions = [mk("a"), mk("b")];
  const now = T0 + 60_000;
  let r = reconcile(sessions, new Set(["b"]), now);
  r = reconcile(r.alive, new Set(["b"]), now + MISSING_GRACE + 1);
  assert.deepEqual(r.alive.map((s) => s.id), ["b"]);
  assert.deepEqual(r.died.map((s) => s.id), ["a"]);
});

test("ids are per-session, so same-named projects never steal each other", () => {
  // Two projects whose folders share a basename — the old title matcher
  // confused these; ids cannot.
  const sessions = [
    mk("a", { slug: "one", basename: "Site" }),
    mk("b", { slug: "two", basename: "Site" }),
  ];
  const now = T0 + 60_000;
  let r = reconcile(sessions, new Set(["a"]), now);
  r = reconcile(r.alive, new Set(["a"]), now + MISSING_GRACE + 1);
  assert.deepEqual(r.alive.map((s) => s.slug), ["one"]);
});

test("a dead task session hands back its task ids so they can be settled", () => {
  const sessions = [mk("a", { kind: "task", taskIds: ["t1", "t2"] })];
  const now = T0 + 60_000;
  let r = reconcile(sessions, new Set(), now);
  r = reconcile(r.alive, new Set(), now + MISSING_GRACE + 1);
  assert.deepEqual(r.died[0].taskIds, ["t1", "t2"]);
});
