// The session badge's reconciliation rules.
//
// Background: sessions live in Windows Terminal TABS, and several sessions
// routinely share ONE window. The badge used to track window handles, which made
// it lie in both directions — it never cleared when you closed one tab of a
// shared window, and it wrongly cleared when you dragged a tab elsewhere.
//
// These tests pin the reconciliation itself (pure logic, no Windows needed). The
// tab-matching rule is shared with the badge's click handler, so if these two
// ever disagree the badge would show a count it can't open.
//
// Run: npm test

import test from "node:test";
import assert from "node:assert/strict";

// Mirrors server.js tabTitleMatches. Claude/Codex rename a tab to
// "<spinner> <project>", so the project folder name is a substring, never equal.
function tabTitleMatches(title, basename) {
  if (!title || !basename) return false;
  return String(title).toLowerCase().includes(String(basename).toLowerCase());
}

const GRACE = 12000;

// Mirrors server.js pruneInteractiveSessions. Returns the surviving sessions.
function prune(sessions, tabs, now) {
  if (tabs === null) return sessions;   // scan failed — change nothing
  const byBase = new Map();
  for (const s of sessions) {
    if (!byBase.has(s.basename)) byBase.set(s.basename, []);
    byBase.get(s.basename).push(s);
  }
  const dead = new Set();
  for (const [base, entries] of byBase) {
    const openTabs = tabs.filter((t) => tabTitleMatches(t, base)).length;
    entries.sort((a, b) => b.startedAt - a.startedAt);
    let slots = openTabs;
    for (const s of entries) {
      if (now - s.startedAt < GRACE) continue;
      if (slots > 0) { slots--; continue; }
      dead.add(s);
    }
  }
  return sessions.filter((s) => !dead.has(s));
}

const NOW = 1_000_000;
const old = (basename, slug = basename) => ({ slug, basename, startedAt: NOW - 60_000 });

test("a tab title matches its project even after Claude renames it", () => {
  assert.ok(tabTitleMatches("✳ Megami Agent", "Megami Agent"), "spinner prefix must still match");
  assert.ok(tabTitleMatches("⠂ Coding Drives", "Coding Drives"));
  assert.ok(tabTitleMatches("Megami Agent", "Megami Agent"), "our own --title, before any rename");
  assert.ok(!tabTitleMatches("✳ Lunar Leads", "Megami Agent"), "a different project must not match");
  assert.ok(!tabTitleMatches("", "Megami Agent"));
  assert.ok(!tabTitleMatches("✳ Megami Agent", ""), "empty basename must not match everything");
});

test("badge clears when the session's tab is closed", () => {
  const sessions = [old("Megami Agent")];
  // The window is still open with other projects' tabs — the old window-handle
  // model saw the window alive and kept the badge lit forever. This is the bug.
  const tabs = ["✳ Lunar Leads", "⠂ Coding Drives"];
  assert.deepEqual(prune(sessions, tabs, NOW), [], "closing the tab must clear the badge");
});

test("badge stays while the tab is open, even sharing a window", () => {
  const sessions = [old("Megami Agent")];
  const tabs = ["✳ Megami Agent", "✳ Lunar Leads", "⠂ Coding Drives"];
  assert.equal(prune(sessions, tabs, NOW).length, 1, "a live tab must keep its badge");
});

test("a just-launched session survives before its tab has painted", () => {
  const fresh = { slug: "x", basename: "Megami Agent", startedAt: NOW - 500 };
  // wt hasn't drawn the tab yet. Pruning here would kill the badge before it
  // ever appeared.
  assert.equal(prune([fresh], [], NOW).length, 1, "grace period must protect a fresh launch");
  // Once past grace with still no tab, it goes.
  const stale = { slug: "x", basename: "Megami Agent", startedAt: NOW - GRACE - 1 };
  assert.equal(prune([stale], [], NOW).length, 0, "a launch that never opened must not linger");
});

test("closing one of two sessions on the same project drops exactly one", () => {
  const older = { slug: "p", basename: "Megami Agent", startedAt: NOW - 60_000 };
  const newer = { slug: "p", basename: "Megami Agent", startedAt: NOW - 30_000 };
  // Two sessions, same project, so both tabs carry the same title — they can
  // only be told apart by count.
  const survivors = prune([older, newer], ["✳ Megami Agent"], NOW);
  assert.equal(survivors.length, 1, "one tab left = one session left");
  assert.equal(survivors[0], newer, "the newest session must be the one kept");
});

test("a failed tab scan never wipes live badges", () => {
  const sessions = [old("Megami Agent"), old("Lunar Leads")];
  // null = "couldn't read the tabs". An empty array would mean "no tabs exist"
  // and would clear everything — exactly the wrong reaction to a flaky scan.
  assert.equal(prune(sessions, null, NOW).length, 2, "a failed scan must change nothing");
  assert.equal(prune(sessions, [], NOW).length, 0, "a real empty result still clears");
});

test("projects with similar names don't steal each other's tabs", () => {
  // "Lunar Leads" is a substring of "Lunar Leads Landing" — both are real
  // projects here. The shorter name matching the longer one's tab is a real
  // hazard of substring matching; this pins the asymmetry.
  assert.ok(tabTitleMatches("✳ Lunar Leads Landing", "Lunar Leads"),
    "known limitation: the shorter name DOES match the longer project's tab");
  assert.ok(!tabTitleMatches("✳ Lunar Leads", "Lunar Leads Landing"),
    "but the longer name never matches the shorter project's tab");
});
