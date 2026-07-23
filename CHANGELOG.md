# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v1.8.0 — 2026-07-23

### Added
- **Scheduled Tasks** — a "Schedule" button in the toolbar opens a Scheduled Tasks modal where you create one-off or recurring (daily/weekly/monthly) schedules that automatically generate a task and launch it with Claude or Codex on one or more projects. Each schedule row shows a live status dot (green = armed, gray = paused, red = last run failed) with pause/resume, Run now, Edit, and Delete actions, a plain-English cadence summary ("Runs: every day at 09:00"), and a next-run hint. A 30-second ticker plus a boot sweep means anything that came due while the PC or app was off fires the moment the app reopens.
- **System tray + background running** — closing the window no longer quits the app; it hides to a new tray icon so the scheduler keeps firing. The tray menu offers "Open Coding Drives" and "Quit (stops scheduled tasks)", a one-time balloon explains the app is still running, and relaunching the app surfaces the existing window instead of starting a second copy.
- **Active-session badge** on project cards — a pulsing green "N Sessions" pill (reduced-motion aware) appears when a project has AI work running, counting both task batches and open interactive Claude/Codex terminals. Clicking it opens/raises the actual terminal window(s), correctly handling tabbed, minimized, hidden, or CLI-renamed terminals.
- **Task reference images** — attach an image (PNG/JPG/GIF/WEBP/BMP/SVG, up to 25 MB) to a task, or paste one with Ctrl+V in the Edit Task dialog. It shows a thumbnail preview, is saved to disk so the spawned AI session can open it, and survives task delete/undo-restore.
- **Task reference links** — attach http/https URLs to a task (deduped, up to 20) as removable chips, with multi-URL paste support; they're passed to the AI session as a "Reference Links" section.
- **Editable project statuses** — Settings now has a full status editor: add, rename, recolor (design-system swatches), reorder, and delete status chips. The last status can't be deleted, and removing one rehomes its projects and reports how many moved.
- **Headless background terminals** setting — task/publish sessions run hidden and close themselves when done; headless sessions now run as real, watchable interactive sessions started minimized (raisable from the session badge) instead of windowless log-only processes.
- **Automatic launch-prompt acceptance** — sessions launched from the dashboard pre-answer Claude/Codex one-time gates (folder trust, external CLAUDE.md imports, .mcp.json enablement, the bypass-permissions warning, first-run onboarding) so a launch never stalls on an interactive question.
- **Remotion demo project** (`demo/`) that renders a 20-second 1080p promo video of the app (animated cursor driving the add-project modal, project cards, status picker, and vendor buttons).
- **Tests** — unit tests pinning session-badge/terminal reconciliation, and an update-survival integration test that boots the server twice against the same user data with different bundled configs to prove upgrades never lose user settings.
- **`scripts/clean-dist.mjs`** — a postbuild helper that prunes stale installers from `dist/`, keeping only the version just built.

### Changed
- The GitHub release flow was substantially expanded: it adopts a repo's already-published history when needed, writes detailed release notes generated from the actual diff since the last release, builds and uploads a downloadable release package, and verifies the release afterward. Publishing also reliably detects an already-published repo (via the folder's origin, a recorded repo URL, or a GitHub account lookup), and cards show a "Visit" badge for published projects even without a local git remote.
- User settings now survive app updates: bundled defaults (`config.json`, wiped on update) are kept separate from user state (`user-config.json` in userData), the Electron shell reads the port from the user config, and data migrations use a versioned schema that upgrades old data but never downgrades data written by a newer build.
- Sending a task — or a fired schedule — automatically flips the project's status to "In Progress" (unless archived).
- The app is branded "Coding Drives" throughout (window title, error dialogs) instead of "Project Tracker"; the header eyebrow now reads "Local-first dashboard".
- Task card header reorganized: "Send all", "Add task", and the expander live in one right-aligned cluster, with "Add task" revealing an inline quick-add input; the task overflow control is now a violet pill toggle with a flipping chevron.
- Search input is debounced (~120 ms), and task polling is smarter: it pauses while the window is hidden or mid-scroll, keeps polling while sessions are live so badges clear promptly, and adds a 45 s heartbeat so fired scheduled tasks appear without refocusing the window.
- External links opened from the app are restricted to http/https schemes.
- Modal form controls (selects, date/time inputs) restyled to match the dark UI.

### Fixed
- The periodic background refresh no longer yanks the page back to the top while you're reading — scroll position is preserved across repaints.
- API requests that hit a server error now return a proper 500 instead of hanging forever (no more stuck spinners).
- Concurrent settings writes (saving settings, reordering cards, registering found projects) are serialized, fixing a race where one save could silently discard another's.
- The session badge reliably finds and raises the right terminal after Claude/Codex rename the tab, when sessions share a tabbed window, or when a headless session's window is hidden — and it clears when you close the terminal.
- Deleting a status no longer strands projects outside the filter view; an invalid status list falls back to defaults instead of booting into an empty filter row.
- "Show less" no longer lingers on fully-visible task lists, and the hidden-count calculation was corrected.
- Status chip labels render as plain text, so names containing markup display literally instead of being interpreted as HTML.
- A backup's post-copy bookkeeping failure no longer leaves the request hanging after the mirror already succeeded.

### Removed
- The standalone "Publish New Release" modal and its direct `gh release create` endpoint — release publishing now runs through the richer publish-wizard flow with diff-based notes and an attached package.
