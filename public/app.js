// Coding Drives — frontend.

const grid       = document.getElementById("grid");
const empty      = document.getElementById("empty");
const tpl        = document.getElementById("card-template");
const searchEl   = document.getElementById("search");
const chipRow    = document.getElementById("chip-row");
const toaster    = document.getElementById("toaster");
const kpiTotal   = document.getElementById("kpi-total");
const kpiProg    = document.getElementById("kpi-progress");
const kpiOnHold  = document.getElementById("kpi-on-hold");
const kpiDone    = document.getElementById("kpi-done");
const btnAdd     = document.getElementById("btn-add");

// Add-project modal
const modal      = document.getElementById("modal-add");
const modalPath  = document.getElementById("add-path");
const modalPick  = document.getElementById("add-pick");
const modalSubmit= document.getElementById("add-submit");
const modalError = document.getElementById("add-error");
// Add-project modal — unified smart field
const addStatus = document.getElementById("add-status");
const addQuick  = document.getElementById("add-quick");

// Publish-to-GitHub wizard modal
const ghModal      = document.getElementById("modal-github");
const ghTitle      = document.getElementById("modal-github-title");
const ghStepMethod = document.getElementById("gh-step-method");
const ghStepAi     = document.getElementById("gh-step-ai");
const ghStepManual = document.getElementById("gh-step-manual");
const ghFootMethod = document.getElementById("gh-foot-method");
const ghFootAi     = document.getElementById("gh-foot-ai");
const ghFootManual = document.getElementById("gh-foot-manual");
const ghRepoName   = document.getElementById("gh-repo-name");
const ghVersionFld = document.getElementById("gh-version-field");
const ghVersion    = document.getElementById("gh-version");
const ghVisSegment = document.getElementById("gh-vis-segment");
const ghModeSegment= document.getElementById("gh-mode-segment");
const ghMethodNext = document.getElementById("gh-method-next");
const ghAiBack     = document.getElementById("gh-ai-back");
const ghAiLaunch   = document.getElementById("gh-ai-launch");
const ghAiSummary  = document.getElementById("gh-ai-summary");
const ghManualBack = document.getElementById("gh-manual-back");
// Step 2b (manual flow) — kept from the previous single-shot UI.
const ghPrior      = document.getElementById("gh-prior");
const ghSummary    = document.getElementById("gh-summary");
const ghDest       = document.getElementById("gh-dest");
const ghProgress   = document.getElementById("gh-progress");
const ghStepsEl    = document.getElementById("gh-steps");
const ghError      = document.getElementById("gh-error");
const ghStatus     = document.getElementById("gh-status");
const ghSubmit     = document.getElementById("gh-submit");

// In-card menu (the 3-dot button flips the card into this list of options)
const cardMenuTpl = document.getElementById("card-menu-template");

let projects = [];
let statuses = [];
let backupPath = "";
// User-set hex for the Total KPI tile. Empty string = use bundled brand
// violet (CSS token-driven default). Round-trips through /api/projects.
let totalColor = "";
// Settings → Card display → "Show stack badge". Off by default so the badge
// doesn't double up with the languages row. Round-trips via /api/projects.
let showStackBadge = false;
// Settings → Card display → "Show language badges". On by default — the
// per-language colour chips are the card's primary "what is this project
// made of" signal. Round-trips via /api/projects.
let showLanguageBadges = true;
// Settings → Preferences → "Send tasks with". Which AI CLI the per-task send
// buttons launch ("claude" | "codex"). Round-trips via /api/projects.
let taskAgent = "claude";
// Per-filter drag-and-drop arrangements, keyed "all" / status id. Each filter
// page sorts and saves independently; server prepends new arrivals.
let projectOrders = {};

// Filter chip selection persists across relaunches via localStorage. Chromium's
// profile lives under Electron's userData, so the value survives the same way
// projects.json does. We default to "all" on first run and on any read error
// (storage disabled, parsing failure, etc.) — picking a saved id that no
// longer matches a real status is handled after loadProjects validates it.
const STATUS_FILTER_KEY = "cd:activeStatus";
function readStoredStatus() {
  try {
    const v = localStorage.getItem(STATUS_FILTER_KEY);
    return typeof v === "string" && v.length ? v : "all";
  } catch { return "all"; }
}
function writeStoredStatus(id) {
  try { localStorage.setItem(STATUS_FILTER_KEY, id); } catch {}
}
let activeStatus = readStoredStatus();
let query = "";

// Per-card "show tasks" toggle (the checklist icon in each card header).
// Persisted the same way the status filter is, so the cards you work from
// keep their task list open across relaunches.
const TASKS_SHOWN_KEY = "cd:tasksShown";
function readTasksShown() {
  try { return new Set(JSON.parse(localStorage.getItem(TASKS_SHOWN_KEY)) || []); }
  catch { return new Set(); }
}
const tasksShownCards = readTasksShown();
function writeTasksShown() {
  try { localStorage.setItem(TASKS_SHOWN_KEY, JSON.stringify([...tasksShownCards])); } catch {}
}

// ── Helpers ─────────────────────────────────────────────────────────────
function fmtTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.floor(s - m * 60)}s`;
}

// `color` is either a CSS-token name ("warning", "success", …) that maps to
// existing status-pill rules, OR a hex string like "#fbbf24". In the hex case
// we set inline styles using the hex (with computed soft alpha for bg).
function isHex(c) { return typeof c === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c); }

// Colors offered by Settings → Statuses. Tokens, not free hex: they track the
// design system through theme changes, and every .status-pill rule is already
// keyed on these names. Legacy hex still renders (applyStatusColor handles it)
// — it just isn't offered for new picks.
const STATUS_COLOR_TOKENS = ["brand", "success", "warning", "danger", "info", "muted", "archived"];
const STATUS_SWATCH_CSS = {
  brand:    "var(--brand-500)",
  success:  "var(--success)",
  warning:  "var(--warning)",
  danger:   "var(--danger)",
  info:     "var(--info)",
  muted:    "var(--fg-3)",
  archived: "#a1a1aa",   // matches the archived pill rule in app.css
};
function statusSwatchColor(color) {
  if (isHex(color)) return color;
  return STATUS_SWATCH_CSS[color] || "var(--fg-3)";
}

// projects.json stores status ids, so an id is generated once at creation and
// never changes — renaming a status only touches its label. Rewriting an id
// would strand every project still pointing at the old one.
function makeStatusId(label, taken) {
  const base = label.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "status";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}
function applyStatusColor(el, color, selected) {
  // Reset any previous inline overrides + data-color
  el.style.background = "";
  el.style.borderColor = "";
  el.style.color = "";
  el.removeAttribute("data-color");
  if (isHex(color)) {
    if (selected) {
      el.style.background = color + "2E";   // ~18% alpha
      el.style.borderColor = color;
      el.style.color = color;
    } else {
      // unselected pills stay neutral; the colored ring shows on hover via existing CSS
      el.style.color = ""; // inherit muted gray
    }
  } else {
    el.dataset.color = color;
  }
}

const TOAST_ICONS = {
  info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.7" fill="currentColor"/></svg>',
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 4.5 4.5L20 6"/></svg>',
  error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6m0-6-6 6"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 10 17H2Z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="0.7" fill="currentColor"/></svg>',
};

function toast({ kind = "info", title, sub, ttlMs = 4000, action }) {
  const el = document.createElement("div");
  el.className = "toast";
  el.dataset.kind = kind;
  const iconSvg = TOAST_ICONS[kind] || TOAST_ICONS.info;
  el.innerHTML = `
    <div class="toast-icon" aria-hidden="true">${iconSvg}</div>
    <div class="toast-body">
      <div class="t-title"></div>
      ${sub ? '<div class="t-sub"></div>' : ''}
    </div>
  `;
  el.querySelector(".t-title").textContent = title;
  if (sub) el.querySelector(".t-sub").textContent = sub;
  const dismiss = () => {
    el.style.transition = "opacity 220ms ease, transform 220ms ease";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 240);
  };
  // Optional action button (e.g. Undo) — sits on the far right, vertically
  // centred, opposite the icon + text. Clicking runs the action and
  // dismisses the toast immediately.
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      clearTimeout(timer);
      dismiss();
      action.onClick();
    });
    el.appendChild(btn);
  }
  toaster.appendChild(el);
  const timer = setTimeout(dismiss, ttlMs);
}

// ── API ───────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function loadProjects() {
  const data = await api("/api/projects");
  projects = data.projects;
  statuses = data.statuses;
  backupPath = data.backupPath || "";
  totalColor = data.totalColor || "";
  showStackBadge = data.showStackBadge === true;
  // Languages default to ON — undefined or missing in the API response is
  // treated as enabled so existing installs keep their current behaviour.
  showLanguageBadges = data.showLanguageBadges !== false;
  taskAgent = data.taskAgent === "codex" ? "codex" : "claude";
  projectOrders = data.projectOrders || {};
  // Mirror to body attributes so CSS can globally suppress any rogue
  // badge element if the JS branch in buildCard / renderLanguages is ever
  // bypassed (e.g. future template paths that clone a card with a
  // pre-populated badge). Belt + braces: JS hides, CSS forces display:none.
  document.body.dataset.showStackBadge = showStackBadge ? "true" : "false";
  document.body.dataset.showLanguageBadges = showLanguageBadges ? "true" : "false";
  // A persisted filter id might reference a status the user has since removed
  // (statusOverrides allows label/color edits, but a full reset wipes custom
  // ids). Fall back to "all" rather than rendering an empty grid with no chip
  // selected.
  if (activeStatus !== "all" && !statuses.some((s) => s.id === activeStatus)) {
    activeStatus = "all";
    writeStoredStatus("all");
  }
  renderChips();
  renderGrid();
  renderKpis();
  syncTaskPolling();
}

// ── Render: KPIs ──────────────────────────────────────────────────────────
// Maps the active filter id to the matching .kpi[data-kind="…"] tile so the
// KPI tiles visually reflect which filter is selected (mirrors the chip row).
const KPI_KIND_BY_STATUS = { "all": "total", "in-progress": "progress", "on-hold": "on-hold", "done": "done" };
function renderKpis() {
  const visible = projects.filter((p) => p.status !== "archived");
  kpiTotal.textContent  = visible.length;
  kpiProg.textContent   = projects.filter((p) => p.status === "in-progress").length;
  kpiOnHold.textContent = projects.filter((p) => p.status === "on-hold").length;
  kpiDone.textContent   = projects.filter((p) => p.status === "done").length;
  // Apply user-customised hex colors (if any) to the KPI cards.
  const byId = Object.fromEntries(statuses.map((s) => [s.id, s.color]));
  applyKpiHexColor(document.querySelector('.kpi[data-kind="progress"]'), byId["in-progress"]);
  applyKpiHexColor(document.querySelector('.kpi[data-kind="on-hold"]'),  byId["on-hold"]);
  applyKpiHexColor(document.querySelector('.kpi[data-kind="done"]'),     byId["done"]);
  applyKpiHexColor(document.querySelector('.kpi[data-kind="total"]'),    totalColor);
  // Mark the KPI tile matching the active filter so CSS can highlight it.
  const activeKind = KPI_KIND_BY_STATUS[activeStatus];
  document.querySelectorAll(".kpi").forEach((el) => {
    el.dataset.active = el.dataset.kind === activeKind ? "true" : "false";
  });
}

// Single source of truth for switching the active filter — the chip row and
// the KPI tiles both call this so they stay in sync. Also persists the choice
// so the next relaunch lands on the same filter the user left it on.
function setActiveStatus(id) {
  if (activeStatus === id) return;
  activeStatus = id;
  writeStoredStatus(id);
  renderChips();
  renderKpis();
  renderGrid();
}

// KPI tiles act as quick filters: clicking "In Progress" cycles to that
// filter, "Total" returns to "All". Delegated so we register one listener for
// all four tiles, and so it's resilient to any future addition of new KPIs.
const KPI_STATUS_BY_KIND = { "progress": "in-progress", "on-hold": "on-hold", "done": "done", "total": "all" };
document.getElementById("kpi-row")?.addEventListener("click", (e) => {
  const tile = e.target.closest(".kpi");
  if (!tile) return;
  const id = KPI_STATUS_BY_KIND[tile.dataset.kind];
  if (id) setActiveStatus(id);
});
function applyKpiHexColor(el, color) {
  if (!el) return;
  if (isHex(color)) {
    el.style.background  = color + "2E";
    el.style.borderColor = color;
    el.style.color = color;
  } else {
    // Restore default (CSS token-driven) styling.
    el.style.background  = "";
    el.style.borderColor = "";
    el.style.color = "";
  }
}

// ── Render: filter chips ──────────────────────────────────────────────────
function renderChips() {
  chipRow.innerHTML = "";
  const counts = projects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const visibleCount = projects.filter((p) => p.status !== "archived").length;

  const items = [
    { id: "all", label: "All", count: visibleCount },
    ...statuses.map((s) => ({ ...s, count: counts[s.id] || 0 })),
  ];

  for (const item of items) {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.dataset.id = item.id;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", item.id === activeStatus ? "true" : "false");
    // textContent, not innerHTML — status labels are user-editable in
    // Settings, and markup typed there must render as text, not as HTML.
    const labelEl = document.createElement("span");
    labelEl.textContent = item.label;
    const countEl = document.createElement("span");
    countEl.className = "count";
    countEl.textContent = item.count;
    btn.append(labelEl, countEl);
    btn.addEventListener("click", () => setActiveStatus(item.id));
    chipRow.appendChild(btn);
  }
}

// ── Render: card grid ─────────────────────────────────────────────────────
function renderGrid() {
  // Close any open in-card menu BEFORE the grid is wiped (in bucketCards) —
  // otherwise the stale card node (including its menu-view listeners) is
  // detached but kept alive by closures in dispatchCardMenuAction, leaking
  // one subtree per re-render while a menu is open.
  //
  // NOTE: the grid is deliberately NOT wiped here. It used to be, and that was
  // the scroll-jump bug: with the grid emptied up front, bucketCards' column
  // measurement (gridColumnCount reads grid.clientWidth) forced a layout pass
  // against an EMPTY grid — the page height collapsed, the browser clamped the
  // scroll position toward the top, and every 8s poll repaint yanked the user
  // up the page. bucketCards wipes immediately before refilling instead, with
  // no layout read in between, so the collapsed state is never laid out.
  closeAllCardMenus();
  const q = query.trim().toLowerCase();
  const filtered = projects.filter((p) => {
    // Default: hide archived from "All" — only show under the explicit Archived chip.
    if (activeStatus === "all") {
      if (p.status === "archived") return false;
    } else if (p.status !== activeStatus) {
      return false;
    }
    if (q && !p.name.toLowerCase().includes(q) && !(p.notes || "").toLowerCase().includes(q)) return false;
    return true;
  });

  // Each filter page has its own saved arrangement — sort by the active
  // filter's order list. Slugs not yet listed (status just flipped locally)
  // float to the top, matching the server's new-arrivals-on-top rule.
  const pos = new Map((projectOrders[activeStatus] || []).map((s, i) => [s, i]));
  filtered.sort((a, b) =>
    (pos.has(a.slug) ? pos.get(a.slug) : -1) -
    (pos.has(b.slug) ? pos.get(b.slug) : -1)
  );

  // Belt & braces for the scroll-jump fix above: snapshot the window scroll
  // and restore it in the same frame, so even a future layout read sneaking
  // into the rebuild can't leave the viewport clamped to the top.
  const scroller = document.scrollingElement || document.documentElement;
  const scrollY = scroller.scrollTop;
  empty.hidden = filtered.length > 0;
  bucketCards(filtered.map((p) => buildCard(p)));
  if (scroller.scrollTop !== scrollY) scroller.scrollTop = scrollY;
}

// ── Offset (masonry) layout ───────────────────────────────────────────────
// Cards are distributed round-robin into N independent flex columns. Reading
// order stays row-major (cards 1, 2, 3 across the top), but each column
// stacks on its own: a card growing — tasks shown, added, expanded — only
// pushes ITS column down, never reshuffling neighbours, and every column
// ends at its own natural y. N mirrors the old auto-fill/minmax(360px, 1fr)
// breakpoints so the responsive behaviour is unchanged.
const MASONRY_MIN_COL = 360;  // px — minimum column width
const MASONRY_GAP = 18;       // px — must match .grid / .masonry-col gap
let masonryCols = 0;
// Authoritative linear (row-major) order of the card elements currently in
// the grid. The DOM alone can't express it — querySelectorAll walks columns
// top-to-bottom, which is col-major — so re-buckets and drag-reorders always
// read/write this array.
let gridCardOrder = [];

function gridColumnCount() {
  const cs = getComputedStyle(grid);
  const w = grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return Math.max(1, Math.floor((w + MASONRY_GAP) / (MASONRY_MIN_COL + MASONRY_GAP)));
}

function bucketCards(cardEls) {
  gridCardOrder = [...cardEls];
  masonryCols = gridColumnCount();
  grid.textContent = "";
  const cols = Array.from({ length: masonryCols }, () => {
    const col = document.createElement("div");
    col.className = "masonry-col";
    grid.appendChild(col);
    return col;
  });
  cardEls.forEach((el, i) => cols[i % masonryCols].appendChild(el));
}

// Phone-home-screen push-over: FLIP-animate every card from its old spot to
// its new one whenever the order changes mid-drag. skipEl (the card being
// dragged) is left alone — it's gliding under the pointer on its own
// transform and must not be animated against it.
function rebucketWithFlip(cardEls, skipEl) {
  // First rects = current VISUAL positions (in-flight transforms included),
  // so an interrupted push-over continues from exactly where it is.
  const first = new Map(cardEls.map((c) => [c, c.getBoundingClientRect()]));
  bucketCards(cardEls);
  // Settle every non-dragged card to its raw layout slot before measuring
  // destinations — leftover mid-animation transforms would otherwise pollute
  // the destination rects and make cards visibly jump / overshoot.
  for (const c of cardEls) {
    if (c === skipEl) continue;
    c.style.transition = "none";
    c.style.transform = "";
  }
  void grid.offsetWidth; // one reflow: clean layout to measure against
  const moving = [];
  for (const c of cardEls) {
    if (c === skipEl) continue;
    const f = first.get(c);
    const l = c.getBoundingClientRect();
    const dx = f.left - l.left;
    const dy = f.top - l.top;
    if (!dx && !dy) continue;
    c.style.transform = `translate(${dx}px, ${dy}px)`;
    moving.push(c);
  }
  void grid.offsetWidth; // one reflow: commit all start positions
  for (const c of moving) {
    c.style.transition = "transform 200ms cubic-bezier(0.2, 0.7, 0.3, 1)";
    c.style.transform = "";
    c.addEventListener("transitionend", function clear() {
      c.style.transition = "";
      c.removeEventListener("transitionend", clear);
    });
  }
}

// On resize only re-bucket when the column count actually changes — the
// existing card nodes move between columns; nothing is rebuilt, so open
// menus / focused inputs inside cards survive width-only resizes.
window.addEventListener("resize", () => {
  if (gridColumnCount() === masonryCols) return;
  bucketCards(gridCardOrder.filter((el) => el.isConnected));
});

// ── Drag-to-rearrange project cards ───────────────────────────────────────
// Native HTML5 drag — the browser's compositor-driven ghost follows the
// cursor with zero JS in the loop (the smoothest feel by far); the grid
// FLIPs around the dimmed in-place card. Drop persists the order via
// /api/projects/reorder.
let lastCardDragTarget = null;
let lastCardDragMove = 0;
let lastCardDragX = 0;
let lastCardDragY = 0;

// While any of our drags is live, the WHOLE window is a valid drop zone.
// Without this the cursor flashes ⊘ no-drop over the topbar/background, and
// releasing there makes Windows play the slow "ghost flies back to origin"
// animation — both read as glitches.
document.addEventListener("dragover", (e) => {
  if (!document.querySelector(".card.card-dragging, .task-item.dragging")) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
});
document.addEventListener("drop", (e) => {
  if (!document.querySelector(".card.card-dragging, .task-item.dragging")) return;
  e.preventDefault();
});

// No dead zones: when the pointer is over a gap / column padding instead of
// a card, snap to the nearest card (by Y) in the column under the pointer so
// hovering ANYWHERE on the grid still resorts.
function nearestCardAt(x, y, exclude) {
  let best = null;
  let bestDist = Infinity;
  for (const col of grid.querySelectorAll(".masonry-col")) {
    const r = col.getBoundingClientRect();
    if (x < r.left - MASONRY_GAP || x > r.right + MASONRY_GAP) continue;
    for (const c of col.querySelectorAll(".card")) {
      if (c === exclude) continue;
      const cr = c.getBoundingClientRect();
      const dy = y < cr.top ? cr.top - y : y > cr.bottom ? y - cr.bottom : 0;
      if (dy < bestDist) { bestDist = dy; best = c; }
    }
  }
  return best;
}

grid.addEventListener("dragover", (e) => {
  const dragging = grid.querySelector(".card.card-dragging");
  if (!dragging) return;            // a task row drag — its list handles it
  e.preventDefault();
  e.dataTransfer.dropEffect = "move"; // clean move cursor, never ⊘
  let target = e.target instanceof Element ? e.target.closest(".card") : null;
  if (!target) target = nearestCardAt(e.clientX, e.clientY, dragging);
  if (!target || target === dragging) return;
  // The same-target block exists ONLY to stop the layout oscillating under a
  // stationary cursor right after a swap. Real pointer travel since the last
  // swap means the user is deliberately aiming — re-arm everything so the
  // card that just shifted can immediately be swapped with again.
  if (lastCardDragTarget &&
      Math.hypot(e.clientX - lastCardDragX, e.clientY - lastCardDragY) > 30) {
    lastCardDragTarget = null;
  }
  // One move per hovered card + a throttle so variable-height cards can't
  // oscillate the layout under the pointer. Gaps never re-arm lastTarget.
  const now = performance.now();
  if (target === lastCardDragTarget || now - lastCardDragMove < 120) return;
  lastCardDragTarget = target;
  lastCardDragMove = now;
  lastCardDragX = e.clientX;
  lastCardDragY = e.clientY;
  const from = gridCardOrder.indexOf(dragging);
  const to = gridCardOrder.indexOf(target);
  if (from === -1 || to === -1 || from === to) return;
  const next = [...gridCardOrder];
  next.splice(from, 1);
  next.splice(to, 0, dragging);
  rebucketWithFlip(next);
});

async function finishCardDrag() {
  lastCardDragTarget = null;
  // Persist into the ACTIVE filter's order only — every page arranges
  // independently. Visible slugs re-slot into their existing positions
  // within this page's list (search may be hiding some members).
  const orderKey = activeStatus;
  const visibleSlugs = gridCardOrder.filter((el) => el.isConnected).map((el) => el.dataset.slug);
  let current = projectOrders[orderKey] || [];
  // Slugs the page list doesn't know yet (status flipped locally moments
  // ago) join at the top, mirroring the server's new-arrivals rule.
  const missing = visibleSlugs.filter((s) => !current.includes(s));
  if (missing.length) current = [...missing, ...current];
  const visSet = new Set(visibleSlugs);
  const slots = current.map((s, i) => (visSet.has(s) ? i : -1)).filter((i) => i >= 0);
  const next = [...current];
  slots.forEach((slot, k) => { next[slot] = visibleSlugs[k]; });
  if (next.join(",") === (projectOrders[orderKey] || []).join(",")) return;
  projectOrders[orderKey] = next;
  try {
    await api("/api/projects/reorder", { method: "POST", body: { filter: orderKey, order: next } });
  } catch (err) {
    toast({ kind: "error", title: "Couldn't save order", sub: err.message });
    loadProjects().catch(() => {});
  }
}

// Per-language colored badges. Same chip shape as .stack-badge but the
// background IS the language colour (JavaScript = yellow, TypeScript = blue,
// etc.), so a glance at the strip reads as the project's language mix
// without a separate legend or proportional bar. Cap to LANG_BADGE_MAX
// languages with the rest rolled into a neutral "Other" pill so a project
// with stray tooling files doesn't pad the row.
const LANG_BADGE_MAX = 3;
const LANG_OTHER_COLOR = "#8b8b8b";
function fmtPct(p) {
  if (p < 0.001) return "<0.1%";
  const v = p * 100;
  return (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + "%";
}
// Convert a 6-digit hex (#rrggbb) to rgba(r,g,b,alpha). Returns the raw
// input as a fallback when it isn't a clean hex literal — defensive for the
// rare language whose colour ships through in a non-hex format.
function hexToRgba(hex, alpha) {
  const m = /^#?([a-f0-9]{6})$/i.test(String(hex || ""));
  if (!m) return hex;
  const s = String(hex).replace(/^#/, "");
  const n = parseInt(s, 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
function makeLangBadge(name, pct, color, extraClass) {
  const el = document.createElement("span");
  el.className = "lang-badge" + (extraClass ? " " + extraClass : "");
  // Status-pill look: soft tinted background + matching translucent border
  // + full-strength colored text. Alpha values mirror the --*-soft tokens
  // the status pills use so the language row reads as the same family of
  // chip without us having to bake per-language CSS variables.
  el.style.background  = hexToRgba(color, 0.15);
  el.style.borderColor = hexToRgba(color, 0.55);
  el.style.color       = color;
  el.dataset.lang = name;

  // Two flex children so the row stays on a single line: the name span can
  // shrink and ellipsize when card width is tight, but the percent span never
  // shrinks — the number is the load-bearing info and always reads cleanly.
  const nameEl = document.createElement("span");
  nameEl.className = "lang-badge-name";
  nameEl.textContent = name;
  const pctEl = document.createElement("span");
  pctEl.className = "lang-badge-pct";
  pctEl.textContent = fmtPct(pct);
  el.append(nameEl, pctEl);
  return el;
}
function renderLanguages(node, p) {
  const wrap = node.querySelector(".languages");
  // The wrapping row carries the "Languages" label — hide the whole row when
  // there's nothing to show so a project with no detected languages doesn't
  // sprout an empty labeled row below its path.
  const row = node.querySelector(".card-row-langs");
  if (!wrap || !row) return;
  // Settings → Card display → "Show language badges" off: hide the row
  // outright regardless of what the project has.
  if (!showLanguageBadges) { row.hidden = true; return; }
  const list = Array.isArray(p.languages) ? p.languages : [];
  // A genuinely empty folder (brand-new project, nothing in it yet) has
  // nothing to say — hide the row rather than filling the space with a
  // badge. The chip below is reserved for folders that HAVE content whose
  // language just couldn't be recognised.
  if (list.length === 0 && p.empty) { row.hidden = true; return; }
  row.hidden = false;
  wrap.textContent = "";
  // Folder has content but no recognised code files (docs/assets-only
  // project, unrecognised file types) — show a neutral chip so the gap
  // reads as "checked, nothing detectable" rather than a broken toggle.
  if (list.length === 0) {
    const el = document.createElement("span");
    el.className = "lang-badge lang-badge-none";
    el.style.background  = hexToRgba(LANG_OTHER_COLOR, 0.15);
    el.style.borderColor = hexToRgba(LANG_OTHER_COLOR, 0.55);
    el.style.color       = LANG_OTHER_COLOR;
    const nameEl = document.createElement("span");
    nameEl.className = "lang-badge-name";
    nameEl.textContent = "No code detected";
    el.appendChild(nameEl);
    wrap.appendChild(el);
    return;
  }

  const visible = list.slice(0, LANG_BADGE_MAX);
  const rest = list.slice(LANG_BADGE_MAX);
  for (const l of visible) {
    wrap.appendChild(makeLangBadge(l.name, l.pct, l.color || LANG_OTHER_COLOR, ""));
  }
  if (rest.length) {
    const otherPct = rest.reduce((s, l) => s + l.pct, 0);
    const badge = makeLangBadge("Other", otherPct, LANG_OTHER_COLOR, "lang-badge-other");
    wrap.appendChild(badge);
  }
}

// ── Per-project tasks ─────────────────────────────────────────────────────
// Rendered into the card's .card-tasks section. Open tasks (anything not
// complete) show first, capped at TASK_VISIBLE_MAX with a "+N more" expander;
// completed tasks collapse into the expanded view so the at-a-glance state is
// always "what's left". Expansion survives re-renders via expandedTaskCards.
const TASK_VISIBLE_MAX = 3;
const expandedTaskCards = new Set(); // slugs whose full task list is expanded

// Lifecycle is mostly automatic: the only manual input is the done-toggle
// (the mark). "in-progress" is set by the app on send, "complete"/"failed"
// are reported back by the agent.
const TASK_STATUS_LABEL = {
  "pending":     "Not done",
  "in-progress": "In progress",
  "complete":    "Done",
  "failed":      "Failed",
};
const TASK_MARK_SVG = {
  // pending: empty ring (pure CSS), in-progress: pulsing dot (pure CSS)
  "complete": '<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  "failed":   '<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>',
};
const TASK_SEND_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
const TASK_TRASH_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg>';
const TASK_CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

function agentLabel() { return taskAgent === "codex" ? "Codex" : "Claude Code"; }

// Rebuild a single card in place — used by task interactions so the whole
// grid doesn't repaint (which would steal focus from the quick-add input and
// close open menus on unrelated cards).
function refreshCard(slug) {
  const project = projects.find((x) => x.slug === slug);
  const cardEl = grid.querySelector(`.card[data-slug="${CSS.escape(slug)}"]`);
  if (!project || !cardEl) { renderGrid(); return null; }
  const fresh = buildCard(project);
  // Keep the linear-order array pointing at the live node.
  const orderIdx = gridCardOrder.indexOf(cardEl);
  if (orderIdx !== -1) gridCardOrder[orderIdx] = fresh;
  cardEl.replaceWith(fresh);
  return fresh;
}

function buildTaskRow(p, t) {
  const li = document.createElement("li");
  li.className = "task-item";
  li.dataset.status = t.status;
  li.dataset.taskId = t.id;
  // Which agent the task was last sent to — drives the in-progress blink
  // colour (Claude = orange, Codex = white).
  li.dataset.agent = t.agent === "codex" ? "codex" : "claude";

  // Drag to reorder — rows can be dragged within their card's list; the
  // list's dragover handler (renderTasks) live-moves the row, dragend
  // persists whatever order the DOM ends up in.
  li.draggable = true;
  li.addEventListener("dragstart", (e) => {
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", t.id); } catch {}
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    finishTaskDrag(p, li.closest(".task-list"));
  });

  // Status mark — the one manual control. Click toggles done ⇄ not done;
  // on a blinking in-progress task it RESETS to not done instead (the
  // manual escape hatch when a session was closed early). Failed → done.
  const mark = document.createElement("button");
  mark.type = "button";
  mark.className = "task-mark";
  const stateLabel = TASK_STATUS_LABEL[t.status] || t.status;
  const nextStatus = t.status === "complete" || t.status === "in-progress" ? "pending" : "complete";
  mark.setAttribute("aria-label", `${stateLabel}. ${nextStatus === "pending" ? "Reset to not done" : "Mark done"}: ${t.title}`);
  mark.innerHTML = TASK_MARK_SVG[t.status] || "";
  mark.addEventListener("click", (e) => {
    e.stopPropagation();
    setTaskStatus(p, t, nextStatus);
  });

  // Title — click opens the editor (title + description).
  const title = document.createElement("button");
  title.type = "button";
  title.className = "task-title";
  title.textContent = t.title;
  title.addEventListener("click", (e) => {
    e.stopPropagation();
    openTaskModal(p, t);
  });

  // Delete — removes the task outright, no modal round-trip.
  const del = document.createElement("button");
  del.type = "button";
  del.className = "task-delete";
  del.innerHTML = TASK_TRASH_SVG;
  del.setAttribute("aria-label", `Delete task: ${t.title}`);
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteTask(p, t.id);
  });

  // Send — launches the agent in a terminal at the project path with this
  // task injected. Disabled while the task is already out with an agent.
  const send = document.createElement("button");
  send.type = "button";
  send.className = "task-send";
  send.innerHTML = TASK_SEND_SVG;
  if (t.status === "in-progress") send.disabled = true;
  send.setAttribute("aria-label", `Send task to ${agentLabel()}: ${t.title}`);
  send.addEventListener("click", (e) => {
    e.stopPropagation();
    sendTasks(p, [t.id]);
  });

  li.append(mark, title, del, send);
  return li;
}

// Shared by the row trash button and the editor modal's Delete. The toast
// carries an Undo that restores the exact task (same id, status, position)
// while the notification is still on screen.
async function deleteTask(p, taskId) {
  const idx = (p.tasks || []).findIndex((x) => x.id === taskId);
  const removed = idx === -1 ? null : { ...p.tasks[idx] };
  try {
    await api(`/api/projects/${p.slug}/tasks/${taskId}/delete`, { method: "POST", body: {} });
    p.tasks = (p.tasks || []).filter((x) => x.id !== taskId);
    refreshCard(p.slug);
    toast({
      kind: "info",
      title: "Task deleted",
      sub: "Removed from this project's list.",
      ttlMs: 5000,
      action: removed ? {
        label: "Undo",
        onClick: async () => {
          try {
            const r = await api(`/api/projects/${p.slug}/tasks/restore`, {
              method: "POST",
              body: { task: removed, index: idx },
            });
            const tasks = [...(p.tasks || [])];
            tasks.splice(Math.min(idx, tasks.length), 0, r.task);
            p.tasks = tasks;
            refreshCard(p.slug);
            syncTaskPolling();
          } catch (err) {
            toast({ kind: "error", title: "Couldn't undo", sub: err.message });
          }
        },
      } : undefined,
    });
  } catch (err) {
    toast({ kind: "error", title: "Couldn't delete task", sub: err.message });
  }
}

// The visible list may be a subset (first 3 + expander), so a drag reorders
// only the visible rows: their slots in the stored array are re-filled with
// the new visible sequence, everything else keeps its position.
function applyVisibleReorder(p, newVisibleIds) {
  const tasks = p.tasks || [];
  const visSet = new Set(newVisibleIds);
  const slots = tasks.map((t, i) => (visSet.has(t.id) ? i : -1)).filter((i) => i >= 0);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const next = [...tasks];
  slots.forEach((slot, k) => { next[slot] = byId.get(newVisibleIds[k]); });
  p.tasks = next;
  return next.map((t) => t.id);
}

async function finishTaskDrag(p, list) {
  if (!list) return;
  const domIds = [...list.querySelectorAll(".task-item")].map((el) => el.dataset.taskId);
  const before = (p.tasks || []).map((t) => t.id).join(",");
  const order = applyVisibleReorder(p, domIds);
  if (order.join(",") === before) return; // dropped back where it started
  try {
    await api(`/api/projects/${p.slug}/tasks/reorder`, { method: "POST", body: { order } });
    refreshCard(p.slug);
  } catch (err) {
    toast({ kind: "error", title: "Couldn't reorder", sub: err.message });
    loadProjects().catch(() => {});
  }
}

function renderTasks(node, p) {
  const wrap = node.querySelector(".card-tasks");
  if (!wrap) return;
  const list    = wrap.querySelector(".task-list");
  const count   = wrap.querySelector(".task-count");
  const sendAll = wrap.querySelector(".task-send-all");
  const more    = wrap.querySelector(".task-more");
  const addBtn  = wrap.querySelector(".task-add-btn");
  const addInput= wrap.querySelector(".task-add-input");

  const tasks = Array.isArray(p.tasks) ? p.tasks : [];
  const open  = tasks.filter((t) => t.status !== "complete");
  const done  = tasks.filter((t) => t.status === "complete");
  const expanded = expandedTaskCards.has(p.slug);

  // Open-count chip — only when there's something left to do.
  count.hidden = open.length === 0;
  count.textContent = String(open.length);

  // Send all — needs at least 2 sendable tasks to earn the extra button.
  const sendable = open.filter((t) => t.status !== "in-progress");
  sendAll.hidden = sendable.length < 2;
  sendAll.onclick = () => sendTasks(p, null);

  // Rows — open first, completed only in the expanded view.
  list.textContent = "";
  const ordered = expanded ? [...open, ...done] : open.slice(0, TASK_VISIBLE_MAX);
  for (const t of ordered) list.appendChild(buildTaskRow(p, t));
  list.hidden = ordered.length === 0;

  // Drag-and-drop: live-move the dragged row to wherever the pointer sits;
  // the row's dragend handler persists the resulting DOM order.
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = list.querySelector(".task-item.dragging");
    if (!dragging) return;
    const after = [...list.querySelectorAll(".task-item:not(.dragging)")]
      .find((el) => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
    if (after) list.insertBefore(dragging, after);
    else list.appendChild(dragging);
  });

  // Expander — counts everything the COLLAPSED view hides (overflow open +
  // done). Styled as a pill toggle; the chevron flips via .expanded. When
  // collapsing would hide nothing (e.g. the only completed task was just
  // unchecked), expansion is meaningless — drop the state so "Show less"
  // doesn't linger on a fully visible list.
  const hiddenCount = Math.max(0, open.length - TASK_VISIBLE_MAX) + done.length;
  if (hiddenCount === 0) expandedTaskCards.delete(p.slug);
  if (expanded && hiddenCount > 0) {
    more.hidden = false;
    more.classList.add("expanded");
    more.innerHTML = `<span>Show less</span>${TASK_CHEVRON_SVG}`;
    more.setAttribute("aria-expanded", "true");
    more.onclick = () => { expandedTaskCards.delete(p.slug); refreshCard(p.slug); };
  } else if (hiddenCount > 0) {
    more.hidden = false;
    more.classList.remove("expanded");
    more.innerHTML = `<span>+${hiddenCount} more</span>${TASK_CHEVRON_SVG}`;
    more.setAttribute("aria-expanded", "false");
    more.onclick = () => { expandedTaskCards.add(p.slug); refreshCard(p.slug); };
  } else {
    more.hidden = true;
  }

  // Quick-add — low-key button that swaps into an inline input. Enter saves
  // and keeps the input open for rapid entry; Escape or blur-on-empty backs
  // out to the button.
  addBtn.addEventListener("click", () => {
    addBtn.hidden = true;
    addInput.hidden = false;
    addInput.focus();
  });
  addInput.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      addInput.value = "";
      addInput.hidden = true;
      addBtn.hidden = false;
      return;
    }
    if (e.key !== "Enter") return;
    const title = addInput.value.trim();
    if (!title) return;
    addInput.disabled = true;
    try {
      const r = await api(`/api/projects/${p.slug}/tasks`, { method: "POST", body: { title } });
      p.tasks = [...tasks, r.task];
      const freshCard = refreshCard(p.slug);
      // Rapid entry: keep adding mode active on the rebuilt card. The editor
      // (description etc.) is opt-in by clicking the task afterwards.
      const nextInput = freshCard?.querySelector(".task-add-input");
      const nextBtn   = freshCard?.querySelector(".task-add-btn");
      if (nextInput && nextBtn) {
        nextBtn.hidden = true;
        nextInput.hidden = false;
        nextInput.focus();
      }
    } catch (err) {
      addInput.disabled = false;
      toast({ kind: "error", title: "Couldn't add task", sub: err.message });
    }
  });
  addInput.addEventListener("blur", () => {
    if (!addInput.value.trim() && !addInput.disabled) {
      addInput.hidden = true;
      addBtn.hidden = false;
    }
  });
}

// Manual status change from the card (mark click) or editor modal.
async function setTaskStatus(p, t, status) {
  const prev = { status: t.status, statusNote: t.statusNote };
  t.status = status;
  t.statusNote = "";
  refreshCard(p.slug);
  try {
    await api(`/api/projects/${p.slug}/tasks/${t.id}`, { method: "POST", body: { status } });
    syncTaskPolling();
  } catch (err) {
    Object.assign(t, prev);
    refreshCard(p.slug);
    toast({ kind: "error", title: "Couldn't update task", sub: err.message });
  }
}

// Send one task (taskIds = [id]) or every open task (taskIds = null) to the
// agent picked in Settings. The server marks them in-progress, builds the
// prompt (task + note + report-back instruction), and opens one terminal.
async function sendTasks(p, taskIds) {
  try {
    const result = await api(`/api/projects/${p.slug}/tasks/send`, {
      method: "POST",
      body: taskIds ? { taskIds } : {},
    });
    if (result && result.notInstalled) {
      openInstallModal(result);
      return;
    }
    const idSet = taskIds ? new Set(taskIds) : null;
    const now = new Date().toISOString();
    for (const t of p.tasks || []) {
      const targeted = idSet ? idSet.has(t.id) : (t.status === "pending" || t.status === "failed");
      if (targeted) {
        t.status = "in-progress";
        t.statusNote = "";
        t.sentAt = now;
      }
    }
    refreshCard(p.slug);
    syncTaskPolling();
    toast({
      kind: "info",
      title: result.count === 1 ? `Task sent to ${agentLabel()}` : `${result.count} tasks sent to ${agentLabel()}`,
      sub: "Launching in a new terminal.",
    });
  } catch (err) {
    toast({ kind: "error", title: "Couldn't send", sub: err.message });
  }
}

// Poll while any task is out with an agent so report-backs surface without a
// manual refresh. Skips a beat whenever the user is mid-interaction (typing
// in a quick-add input, any modal open, an in-card menu open) — a re-render
// there would steal focus / slam the menu shut.
let taskPollTimer = null;
function anyTasksInProgress() {
  // Also keep polling while any project has a live interactive Claude/Codex
  // terminal open, so its session badge clears on the next tick once the user
  // closes that window (the server prunes closed sessions on each fetch).
  return projects.some(
    (p) => (p.liveSessions || 0) > 0 || (p.tasks || []).some((t) => t.status === "in-progress")
  );
}
// ── Active sessions ─────────────────────────────────────────────────────────
// Each card carries its own "N Session(s)" badge (built in buildCard) showing
// how many AI sends are still in progress for that project. Clicking the badge
// asks the server to open the running background terminal(s) for THAT project so
// the user can watch what's going on — "open up all the running terminals
// corresponding to that session". Passing a project scopes the open to its own
// session windows; omitting it falls back to the global open-everything action.
async function openSessions(p) {
  try {
    const url = p && p.slug
      ? `/api/projects/${p.slug}/sessions/open`
      : `/api/sessions/open`;
    const r = await api(url, { method: "POST" });
    if (r && r.focused > 0) {
      toast({
        kind: "info",
        title: r.focused === 1 ? "Opened session terminal" : `Opened ${r.focused} session terminals`,
        // Headless sessions have no window of their own, so we open a live
        // log-tailing terminal instead of raising an existing window. The
        // fallback flag means the server couldn't pin down this project's
        // exact window and raised every running session terminal instead.
        sub: r.fallback
          ? "Couldn't match this project's window by name, so every running session terminal was raised."
          : r.headless
          ? "Showing live output from the background session(s)."
          : "Brought the running session window(s) to the front.",
      });
    } else if (r && r.headless) {
      toast({
        kind: "info",
        title: "No live session output yet",
        sub: "The background session may have just started or already finished — try again in a moment.",
      });
    } else {
      toast({
        kind: "info",
        title: "No terminal windows found",
        sub: "The session may have already finished or its window was closed.",
      });
    }
  } catch (err) {
    toast({ kind: "error", title: "Couldn't open terminals", sub: err.message });
  }
}
// Timestamp of the user's last scroll gesture. The 8s poll repaint tears the
// whole grid down; doing that mid-scroll kills the gesture's momentum and,
// combined with any layout hiccup, reads as "the app forced me back up the
// page". Wheel/touch are captured too because 'scroll' alone misses the very
// start of a gesture. Passive + capture: never delays scrolling, and inner
// scrollers (task lists) count as activity as well.
let lastUserScrollAt = 0;
["scroll", "wheel", "touchmove"].forEach((ev) =>
  window.addEventListener(ev, () => { lastUserScrollAt = Date.now(); }, { passive: true, capture: true })
);

function taskPollTick() {
  // Don't refetch + full-repaint the grid while the window is minimized or
  // hidden — nobody is looking, and with many projects this is a needless
  // (and event-loop-blocking) full teardown every 8s. The focus handler
  // refreshes immediately when the user returns, so no staleness is visible.
  if (document.hidden) return;
  if (document.querySelector(".modal.is-open")) return;
  if (document.querySelector('.card[data-menu="open"]')) return;
  // Mid-scroll: skip this tick entirely — the next one (8s) will catch up.
  if (Date.now() - lastUserScrollAt < 1500) return;
  const ae = document.activeElement;
  if (ae && (ae.classList.contains("task-add-input") || ae.id === "search")) return;
  loadProjects().catch(() => {});
}
function syncTaskPolling() {
  // Common chokepoint for every task-state change (initial load, 8s poll,
  // optimistic send, manual status flip, undo) — keep the background poll
  // running while any session is live. Per-card session badges are rebuilt by
  // buildCard whenever a card is (re)rendered, so they need no nudge here.
  const active = anyTasksInProgress();
  if (active && !taskPollTimer) {
    taskPollTimer = setInterval(taskPollTick, 8000);
  } else if (!active && taskPollTimer) {
    clearInterval(taskPollTimer);
    taskPollTimer = null;
  }
}

// ── Reference-link chip editor ─────────────────────────────────────────────
// Shared by the task editor and the schedule form. Turns a [list, input, Add]
// trio into a "paste a URL → Add → removable chip" control, mirroring how scan
// paths are added in Settings. Pasting several URLs at once (newline/space
// separated) adds each. Returns { set, get } so callers can load/read the
// working list without touching the DOM.
function makeLinkEditor({ listEl, inputEl, addBtn }) {
  let links = [];
  function render() {
    listEl.textContent = "";
    links.forEach((url, i) => {
      const item = document.createElement("div");
      item.className = "path-item";
      item.innerHTML = `<span></span><button class="remove" type="button" aria-label="Remove">✕</button>`;
      const txt = item.querySelector("span");
      txt.textContent = url;
      txt.title = url;
      item.querySelector(".remove").addEventListener("click", () => {
        links.splice(i, 1);
        render();
      });
      listEl.appendChild(item);
    });
  }
  function add(raw) {
    const v = (raw || "").trim();
    if (!v) return;
    if (!links.includes(v)) links.push(v);
    render();
  }
  function addMany(text) {
    String(text || "").split(/[\s\r\n\t]+/).map((s) => s.trim()).filter(Boolean).forEach(add);
  }
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      addMany(inputEl.value);
      inputEl.value = "";
      inputEl.focus();
    });
  }
  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addMany(inputEl.value); inputEl.value = ""; }
    });
    // Pasting MULTIPLE urls at once (they contain whitespace/newlines) adds each
    // as its own chip; a single url paste falls through so the user can tweak it
    // before hitting Add.
    inputEl.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";
      if (/[\s\r\n\t]/.test(text.trim())) {
        e.preventDefault();
        addMany(text);
        inputEl.value = "";
      }
    });
  }
  return {
    set(arr) { links = Array.isArray(arr) ? arr.filter(Boolean).map(String) : []; if (inputEl) inputEl.value = ""; render(); },
    get() { return [...links]; },
  };
}

// ── Task editor modal ─────────────────────────────────────────────────────
const taskModal      = document.getElementById("modal-task");
const taskEditTitle  = document.getElementById("task-edit-title");
const taskEditNote   = document.getElementById("task-edit-note");
const taskLinksEditor = makeLinkEditor({
  listEl:  document.getElementById("task-edit-links-list"),
  inputEl: document.getElementById("task-edit-links-input"),
  addBtn:  document.getElementById("task-edit-links-add"),
});
const taskEditReport = document.getElementById("task-edit-report");
const taskEditDelete = document.getElementById("task-edit-delete");
const taskEditSave   = document.getElementById("task-edit-save");
const taskImageInput   = document.getElementById("task-edit-image-input");
const taskImageAttach  = document.getElementById("task-image-attach");
const taskImageEmpty   = document.getElementById("task-image-empty");
const taskImagePreview = document.getElementById("task-image-preview");
const taskImageThumb   = document.getElementById("task-image-thumb");
const taskImageName    = document.getElementById("task-image-name");
const taskImageRemove  = document.getElementById("task-image-remove");
let editingTask = null;            // { slug, id }

// Swap the image field between its "Attach image" empty state and the
// thumbnail preview, reading whatever image the task currently carries. The
// ?v= cache-buster forces a refetch after an upload replaces the file in place.
function renderTaskImage(p, t) {
  const img = t.image;
  if (img && img.name) {
    taskImageThumb.src = `/api/projects/${p.slug}/tasks/${t.id}/image?v=${encodeURIComponent(t.updatedAt || img.name)}`;
    taskImageName.textContent = img.name;
    taskImageEmpty.hidden = true;
    taskImagePreview.hidden = false;
  } else {
    taskImageThumb.removeAttribute("src");
    taskImageName.textContent = "";
    taskImageEmpty.hidden = false;
    taskImagePreview.hidden = true;
  }
}

function openTaskModal(p, t, { focusNote = false } = {}) {
  editingTask = { slug: p.slug, id: t.id };
  taskEditTitle.value = t.title;
  taskEditNote.value = t.note || "";
  taskLinksEditor.set(t.links);
  renderTaskImage(p, t);
  // Surface the agent's last report so a "failed" has its reason attached.
  if (t.statusNote) {
    taskEditReport.hidden = false;
    taskEditReport.textContent =
      (t.status === "failed" ? "Agent reported a blocker: " : "Agent report: ") + t.statusNote;
  } else {
    taskEditReport.hidden = true;
    taskEditReport.textContent = "";
  }
  taskModal.style.display = "";
  taskModal.classList.add("is-open");
  // Fresh from quick-add the title is already written — drop the caret into
  // the prompt note instead so the natural next step is one keystroke away.
  (focusNote ? taskEditNote : taskEditTitle).focus();
}

// Upload a single image File to the currently-edited task and swap the preview
// in. Shared by the file picker and the clipboard-paste path. A pasted image
// usually arrives without a filename, so synthesise one from its mime type
// (the server derives the on-disk extension from name/content-type either way).
async function uploadTaskImageFile(file) {
  if (!file || !editingTask) return;
  const p = projects.find((x) => x.slug === editingTask.slug);
  const t = p?.tasks?.find((x) => x.id === editingTask.id);
  if (!p || !t) return;
  let name = (file.name || "").trim();
  if (!name) {
    const sub = (file.type && file.type.split("/")[1]) || "png";
    name = `pasted-image.${sub === "jpeg" ? "jpg" : sub}`;
  }
  try {
    const buf = await file.arrayBuffer();
    // Raw byte upload (no base64 inflation). The server route uses its own
    // higher body limit, so this bypasses the 1 MB JSON cap on /api.
    const res = await fetch(
      `/api/projects/${p.slug}/tasks/${t.id}/image?name=${encodeURIComponent(name)}`,
      { method: "POST", headers: { "content-type": file.type || "application/octet-stream" }, body: buf }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    Object.assign(t, data.task);
    renderTaskImage(p, t);
    refreshCard(p.slug);
    toast({ kind: "success", title: "Image attached", sub: name });
  } catch (err) {
    toast({ kind: "error", title: "Couldn't attach image", sub: err.message });
  }
}

// Attach → open the native file picker. The chosen image is uploaded straight
// away (the task already exists in the editor) and the preview swaps in.
taskImageAttach?.addEventListener("click", () => taskImageInput?.click());
taskImageInput?.addEventListener("change", async () => {
  const file = taskImageInput.files && taskImageInput.files[0];
  taskImageInput.value = ""; // allow re-picking the same file later
  await uploadTaskImageFile(file);
});

// Paste an image straight from the clipboard (Ctrl+V) anywhere inside the task
// dialog — copy an image, open/Edit the task, paste, and it's attached as the
// reference image. Pasting into the text fields still types normally; we only
// intercept when the clipboard actually carries an image file.
taskModal?.addEventListener("paste", async (e) => {
  if (!editingTask) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const it of items) {
    if (it.kind === "file" && (it.type || "").startsWith("image/")) {
      const file = it.getAsFile();
      if (file) { e.preventDefault(); await uploadTaskImageFile(file); break; }
    }
  }
});
taskImageRemove?.addEventListener("click", async () => {
  if (!editingTask) return;
  const p = projects.find((x) => x.slug === editingTask.slug);
  const t = p?.tasks?.find((x) => x.id === editingTask.id);
  if (!p || !t) return;
  try {
    const r = await api(`/api/projects/${p.slug}/tasks/${t.id}/image/delete`, { method: "POST", body: {} });
    Object.assign(t, r.task);
    renderTaskImage(p, t);
    refreshCard(p.slug);
  } catch (err) {
    toast({ kind: "error", title: "Couldn't remove image", sub: err.message });
  }
});
function closeTaskModal() {
  taskModal.classList.remove("is-open");
  taskModal.style.display = "none";
  editingTask = null;
}
taskModal?.querySelectorAll(".modal-close").forEach((b) => b.addEventListener("click", closeTaskModal));
taskModal?.querySelector(".modal-backdrop")?.addEventListener("click", closeTaskModal);

taskEditSave?.addEventListener("click", async () => {
  if (!editingTask) return;
  const p = projects.find((x) => x.slug === editingTask.slug);
  const t = p?.tasks?.find((x) => x.id === editingTask.id);
  if (!p || !t) { closeTaskModal(); return; }
  const title = taskEditTitle.value.trim();
  if (!title) {
    toast({ kind: "error", title: "Task needs a title", sub: "Give it a short summary first." });
    return;
  }
  // Links come from the chip editor (already trimmed + de-duped). The server
  // validates/normalises.
  const links = taskLinksEditor.get();
  try {
    const r = await api(`/api/projects/${p.slug}/tasks/${t.id}`, {
      method: "POST",
      body: { title, note: taskEditNote.value, links },
    });
    Object.assign(t, r.task);
    closeTaskModal();
    refreshCard(p.slug);
  } catch (err) {
    toast({ kind: "error", title: "Couldn't save task", sub: err.message });
  }
});

taskEditDelete?.addEventListener("click", async () => {
  if (!editingTask) return;
  const p = projects.find((x) => x.slug === editingTask.slug);
  const id = editingTask.id;
  closeTaskModal();
  if (p) await deleteTask(p, id);
});

function buildCard(p) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.slug = p.slug;
  node.dataset.status = p.status;

  // Drag-to-rearrange. Guards: task rows are draggable on their own and
  // their drag events bubble up here — e.target tells the two apart.
  node.draggable = true;
  node.addEventListener("dragstart", (e) => {
    if (e.target !== node) return;
    node.classList.add("card-dragging");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", p.slug); } catch {}
  });
  node.addEventListener("dragend", (e) => {
    if (e.target !== node) return;
    node.classList.remove("card-dragging");
    finishCardDrag();
  });
  node.querySelector(".card-title").textContent = p.name;

  // Active-session badge. A "send" launches ONE background terminal that works
  // this project's queued tasks, so a distinct session = a distinct (send)
  // batch — keyed by sentAt — among this project's in-progress tasks. Clicking
  // the card's Claude/Codex button opens an interactive terminal that's tracked
  // separately (server-side liveSessions) and counts the same way: each open
  // window is one live session. The badge sums both and, when clicked, raises
  // every running terminal window. Hidden while the project has nothing running.
  const sessionBadge = node.querySelector(".card-session-badge");
  const sessionText  = node.querySelector(".card-session-text");
  if (sessionBadge && sessionText) {
    const batches = new Set();
    for (const t of p.tasks || []) {
      if (t.status === "in-progress") batches.add(t.sentAt || "");
    }
    const n = batches.size + (p.liveSessions || 0);
    if (n === 0) {
      sessionBadge.hidden = true;
    } else {
      sessionBadge.hidden = false;
      sessionText.textContent = `${n} Session${n === 1 ? "" : "s"}`;
      sessionBadge.setAttribute(
        "aria-label",
        `${n} active terminal session${n === 1 ? "" : "s"} — click to open`
      );
      sessionBadge.title = "Open this project's running terminal session windows";
      sessionBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        openSessions(p);
      });
    }
  }

  // Visit chip — only shown when the project has a github.com origin (set
  // server-side via .git/config detection). Inserted into card-title-row
  // before .card-title-actions so it sits between the project name and the
  // explorer/menu icons. stopPropagation prevents the link from triggering
  // the card-level (title) handler.
  if (p.githubUrl) {
    const a = document.createElement("a");
    a.className = "gh-visit-badge";
    a.href = p.githubUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", `Visit ${p.githubUrl}`);
    a.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.04c-3.2.7-3.88-1.37-3.88-1.37-.52-1.34-1.27-1.7-1.27-1.7-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a10.94 10.94 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5z"/></svg><span>Visit</span>';
    a.addEventListener("click", (e) => e.stopPropagation());
    const titleRow = node.querySelector(".card-title-row");
    const actions  = node.querySelector(".card-title-actions");
    if (titleRow && actions) titleRow.insertBefore(a, actions);
  }

  const stackEl = node.querySelector(".stack-badge");
  if (showStackBadge) {
    stackEl.textContent = p.stack;
    stackEl.dataset.stack = p.stack;
    // Polyglot projects (Tauri = Node + Rust, Next.js + Python backend, etc.)
    // get a second badge so the secondary stack isn't silently hidden. Cap at
    // two — beyond that the row gets noisy.
    if (Array.isArray(p.stacks) && p.stacks[1]) {
      const second = document.createElement("span");
      second.className = "stack-badge stack-badge-secondary";
      second.textContent = p.stacks[1];
      second.dataset.stack = p.stacks[1];
      stackEl.after(second);
    }
  } else {
    // Toggled off in Settings → Card display. Remove the element entirely so
    // there's no empty-chip placeholder taking up space in the header row.
    stackEl.remove();
  }

  // Indicators (GIT / VERCEL / ENV) live in the same meta strip as the stack
  // badge and are conceptually part of the same "tech surface" of the card.
  // When the Settings toggle is off the whole strip is suppressed — skip
  // populating indicators too so the row truly disappears.
  const inds = node.querySelector(".indicators");
  if (showStackBadge) {
    const VISIBLE_INDS = ["git", "vercel", "env"];
    for (const kind of VISIBLE_INDS) {
      if (!p.indicators[kind]) continue;
      const span = document.createElement("span");
      span.className = "ind";
      span.dataset.kind = kind;
      span.textContent = kind;
      inds.appendChild(span);
    }
  }

  // Collapse the meta row entirely when the toggle is off so the card
  // doesn't keep a blank strip's worth of padding / line-height between the
  // title and the status row.
  const metaRow = node.querySelector(".card-meta");
  if (metaRow && !showStackBadge) {
    metaRow.hidden = true;
  }

  renderLanguages(node, p);

  const pathEl = node.querySelector(".card-path-text");
  pathEl.textContent = p.path;

  // The ENTIRE path pill is the click target — not just the small icon. The
  // icon button remains in the DOM as a visual hint for affordance, but any
  // click on .card-path (including the icon, which bubbles up here) copies
  // the path. role="button" + aria-label make it accessible as a button to
  // assistive tech even though the element is a <div>.
  const pathContainer = node.querySelector(".card-path");
  pathContainer.setAttribute("role", "button");
  pathContainer.setAttribute("tabindex", "0");
  pathContainer.setAttribute("aria-label", `Copy path: ${p.path}`);
  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(p.path);
      toast({ kind: "info", title: "Path copied", sub: "Copied to your clipboard." });
    } catch (err) {
      toast({ kind: "error", title: "Copy failed", sub: err.message });
    }
  };
  pathContainer.addEventListener("click", (e) => {
    e.stopPropagation();
    copyPath();
  });
  // Keyboard support — Enter / Space activates the copy.
  pathContainer.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      copyPath();
    }
  });

  // Status picker
  const picker = node.querySelector(".status-picker");
  for (const s of statuses) {
    const pill = document.createElement("button");
    pill.className = "status-pill";
    pill.type = "button";
    pill.textContent = s.label;
    pill.setAttribute("aria-selected", p.status === s.id ? "true" : "false");
    applyStatusColor(pill, s.color, p.status === s.id);
    pill.addEventListener("click", () => updateStatus(p.slug, s.id));
    picker.appendChild(pill);
  }

  // Title-row buttons
  node.querySelector(".explorer").addEventListener("click", () => openTool(p.slug, "explorer"));
  const menuBtn = node.querySelector(".card-menu");
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleCardMenu(node, p);
  });

  // Action buttons
  node.querySelector(".action-vscode").addEventListener("click", () => openTool(p.slug, "vscode"));
  node.querySelector(".action-claude").addEventListener("click", () => openTool(p.slug, "claude"));
  node.querySelector(".action-codex")?.addEventListener("click",  () => openTool(p.slug, "codex"));

  renderTasks(node, p);

  // Tasks toggle — the checklist icon in the header shows/hides the card's
  // task section. State persists per project; a small violet dot on the icon
  // signals "open tasks in here" while the section is collapsed.
  const taskToggle = node.querySelector(".task-toggle");
  const tasksSection = node.querySelector(".card-tasks");
  const tasksOn = tasksShownCards.has(p.slug);
  const openCount = (p.tasks || []).filter((t) => t.status !== "complete").length;
  taskToggle.setAttribute("aria-pressed", String(tasksOn));
  taskToggle.setAttribute("aria-label", tasksOn ? "Hide tasks" : "Show tasks");
  taskToggle.dataset.hasOpen = openCount > 0 ? "true" : "false";
  tasksSection.hidden = !tasksOn;
  taskToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (tasksShownCards.has(p.slug)) tasksShownCards.delete(p.slug);
    else tasksShownCards.add(p.slug);
    writeTasksShown();
    refreshCard(p.slug);
  });

  return node;
}

// ── Status / archive ──────────────────────────────────────────────────────
async function updateStatus(slug, statusId) {
  const target = projects.find((p) => p.slug === slug);
  if (!target || target.status === statusId) return;
  const prev = target.status;
  target.status = statusId;
  // If moving to archived (or out of archived), hide/show appropriately.
  renderChips();
  renderKpis();
  renderGrid();
  try {
    await api(`/api/projects/${slug}`, { method: "POST", body: { status: statusId } });
  } catch (err) {
    target.status = prev;
    renderGrid(); renderChips(); renderKpis();
    toast({ kind: "error", title: "Couldn't update status", sub: err.message });
  }
}

// ── Tools ─────────────────────────────────────────────────────────────────
async function openTool(slug, tool) {
  try {
    const result = await api(`/api/projects/${slug}/open`, { method: "POST", body: { tool } });
    // Server short-circuits when an installable CLI is missing from PATH
    // and returns {ok:false, notInstalled:true, ...} so we can show our
    // own confirmation modal instead of letting Windows 11 hijack with
    // its "install from Store" prompt.
    if (result && result.notInstalled) {
      openInstallModal(result);
      return;
    }
    const labels = { vscode: "VS Code", claude: "Claude Code", codex: "Codex", explorer: "File Explorer" };
    toast({ kind: "info", title: `Opening ${labels[tool] || tool}…`, sub: "Launching in a new window." });
    // For an interactive Claude/Codex terminal the server registers the new
    // window ~1.4s after launch; refetch shortly after so the card's session
    // badge lights up without waiting for the next poll. loadProjects starts
    // the poll loop (anyTasksInProgress now counts live sessions), which then
    // clears the badge once the user closes the terminal.
    if ((tool === "claude" || tool === "codex") && !(result && result.notInstalled)) {
      setTimeout(() => { loadProjects().catch(() => {}); }, 2000);
    }
  } catch (err) {
    toast({ kind: "error", title: "Couldn't open", sub: err.message });
  }
}

// ── Install confirmation modal ────────────────────────────────────────────
const installModal     = document.getElementById("modal-install");
const installTextEl    = document.getElementById("install-text");
const installCmdEl     = document.getElementById("install-cmd");
const installAllowBtn  = document.getElementById("install-allow");
let pendingInstall = null;   // { tool, displayName, installCmd }

function openInstallModal(payload) {
  pendingInstall = payload;
  installTextEl.textContent = `${payload.displayName} isn't installed on this PC. Allow Coding Drives to install it for you?`;
  installCmdEl.textContent  = payload.installCmd;
  installAllowBtn.disabled = false;
  installModal.style.display = "";
  installModal.classList.add("is-open");
}
function closeInstallModal() {
  installModal.classList.remove("is-open");
  installModal.style.display = "none";
  pendingInstall = null;
}
installModal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) =>
  el.addEventListener("click", closeInstallModal)
);
installAllowBtn.addEventListener("click", async () => {
  if (!pendingInstall) return;
  const { tool, displayName } = pendingInstall;
  installAllowBtn.disabled = true;
  try {
    await api(`/api/tools/install`, { method: "POST", body: { tool } });
    toast({ kind: "info", title: `Installing ${displayName}…`, sub: "Re-open the project once the terminal finishes." });
    closeInstallModal();
  } catch (err) {
    toast({ kind: "error", title: "Install failed to start", sub: err.message });
    installAllowBtn.disabled = false;
  }
});

// ── Backup ────────────────────────────────────────────────────────────────
// All feedback flows through toasts now that the inline .last-backup pill
// has been removed. Status (busy / success / failure) is communicated
// through the kind/title/sub of each toast. `mode` is forwarded to the
// server — "replace" overwrites the recorded backup destination, "new"
// creates a timestamped sibling folder so the prior backup is preserved.
async function doBackup(project, mode = "replace", folderName = undefined) {
  toast({ kind: "info", title: `Backing up ${project.name}…`, sub: "Mirroring files to your backup folder." });
  try {
    const data = await api(`/api/projects/${project.slug}/backup`, { method: "POST", body: { mode, folderName } });
    if (data.ok) {
      project.lastBackedUpAt = new Date().toISOString();
      toast({
        kind: "success",
        title: `${project.name} backed up`,
        sub: `Saved to ${data.dest.split(/[\\/]/).pop()} · ${fmtDuration(data.durationMs)}`,
      });
    } else {
      toast({ kind: "error", title: "Backup failed", sub: data.message || data.stderr || `Exit code ${data.exitCode}` });
    }
  } catch (err) {
    toast({ kind: "error", title: "Backup failed", sub: err.message });
  }
}

// ── Backup confirmation modal ─────────────────────────────────────────────
const backupModal      = document.getElementById("modal-backup");
const backupReplaceSub = document.getElementById("backup-replace-sub");
const backupSubmitBtn  = document.getElementById("backup-confirm");
const backupFolderInput = document.getElementById("backup-folder-name");
let backupProject = null;
let backupMode = null;
// Tracks whether the user has typed into the folder-name input. Used to
// suppress the auto-prefill when the user clicks between mode cards —
// once they've committed to a name, we don't overwrite it.
let backupFolderUserEdited = false;

// Build a compact sortable timestamp suffix for backup folder names.
function makeBackupStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
// Strip any trailing "-YYYY-MM-DD-HHMM" suffix so we don't double-append
// a timestamp when the prior backup was already a timestamped folder.
function stripBackupStamp(name) {
  return name.replace(/-\d{4}-\d{2}-\d{2}-\d{4}$/, "");
}
function defaultFolderForMode(project, _mode) {
  // Same pattern for both modes — the prefill always reads as the full
  // intended folder name (base + timestamp), so the user sees exactly
  // what the new folder will be called. If they want to truly overwrite
  // an existing untimestamped backup (e.g. "YouTube"), they can clear
  // the suffix in the input before submitting.
  const stamp = makeBackupStamp();
  const dest = project.lastBackedUpDest;
  const base = dest
    ? stripBackupStamp(dest.split(/[\\/]/).pop())
    : project.name;
  return `${base}-${stamp}`;
}

function openBackupModal(project) {
  backupProject = project;
  backupFolderUserEdited = false;
  const replaceCard = backupModal.querySelector('[data-mode="replace"]');
  const newCard     = backupModal.querySelector('[data-mode="new"]');
  const hasPrior    = !!project.lastBackedUpAt;
  // Server tells us whether the saved backup folder is still on disk. If the
  // user deleted it between sessions, Replace would silently re-create a new
  // folder — technically harmless but it would say "Overwrite backup from
  // <date>" while there is nothing to overwrite. Treat missing-on-disk the
  // same as never-backed-up so the card copy stays honest.
  const replaceAvailable = hasPrior && project.lastBackedUpExists !== false;

  // Replace card: enabled only when there's an existing backup to overwrite.
  // When disabled, it visually grays out and pointer-events are dropped via
  // the [disabled] CSS rule.
  if (replaceAvailable) {
    replaceCard.disabled = false;
    backupReplaceSub.textContent = `Overwrite backup from ${fmtTimestamp(project.lastBackedUpAt)}.`;
    replaceCard.setAttribute("aria-checked", "true");
    newCard.setAttribute("aria-checked", "false");
    backupMode = "replace";
  } else {
    replaceCard.disabled = true;
    backupReplaceSub.textContent = hasPrior
      ? "Saved backup folder is missing — create a new one."
      : "No prior backup — create one first.";
    replaceCard.setAttribute("aria-checked", "false");
    newCard.setAttribute("aria-checked", "true");
    backupMode = "new";
  }
  backupFolderInput.value = defaultFolderForMode(project, backupMode);
  backupFolderInput.placeholder = defaultFolderForMode(project, backupMode);
  backupSubmitBtn.disabled = false;

  backupModal.style.display = "";
  backupModal.classList.add("is-open");
}
function closeBackupModal() {
  backupModal.classList.remove("is-open");
  backupModal.style.display = "none";
  backupProject = null;
  backupMode = null;
  backupFolderUserEdited = false;
}
backupModal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) =>
  el.addEventListener("click", closeBackupModal)
);
backupModal.querySelectorAll(".gh-method-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (card.disabled) return;
    backupModal.querySelectorAll(".gh-method-card").forEach((c) => c.setAttribute("aria-checked", "false"));
    card.setAttribute("aria-checked", "true");
    backupMode = card.dataset.mode;
    // Auto-update the folder-name field to the new mode's default ONLY if
    // the user hasn't typed in it. Their typed value wins over our prefill.
    if (!backupFolderUserEdited && backupProject) {
      const next = defaultFolderForMode(backupProject, backupMode);
      backupFolderInput.value = next;
      backupFolderInput.placeholder = next;
    }
    backupSubmitBtn.disabled = false;
  });
});
backupFolderInput.addEventListener("input", () => {
  backupFolderUserEdited = true;
});
backupSubmitBtn.addEventListener("click", async () => {
  if (!backupProject || !backupMode) return;
  const p = backupProject;
  const mode = backupMode;
  const folderName = backupFolderInput.value.trim() || defaultFolderForMode(p, mode);
  closeBackupModal();
  await doBackup(p, mode, folderName);
});

// ── Add Project modal ─────────────────────────────────────────────────────
// We toggle a class AND clear/restore the inline `display:none` baked into the
// HTML. Three independent layers (base CSS, [hidden] rule, inline style) make
// it impossible for the modal to appear unless code explicitly opens it.
// Latest inspection result for the typed path — drives the button label and
// which API the submit handler calls. `seq` guards against out-of-order
// responses from the debounced inspect requests.
let addState = { state: "empty" };
let addInspectTimer = null;
let addInspectSeq = 0;
// The destination folder for NEW projects, chosen via the scan-folder chips.
// When the user types a bare name, the project is created in here.
let selectedBase = null;

// Join a base folder + a bare name into a Windows path (one backslash).
function addJoin(base, name) {
  return base.replace(/[\\/]+$/, "") + "\\" + name;
}
// What we actually inspect/act on: a bare name (no separator) is treated as a
// NEW project inside the selected base folder; anything with a separator is
// taken as a literal path (so paste/Browse still works for connecting).
function effectiveAddPath() {
  const raw = modalPath.value.trim();
  if (!raw) return "";
  const hasSep = /[\\/]/.test(raw);
  if (!hasSep && selectedBase) return addJoin(selectedBase, raw);
  return raw;
}

function openAddModal() {
  modal.style.display = "";
  modal.classList.add("is-open");
  modalError.textContent = "";
  modalPath.value = "";
  renderAddState({ state: "empty" });
  populateAddQuick();
  setTimeout(() => modalPath.focus(), 0);
}
function closeAddModal() {
  modal.classList.remove("is-open");
  modal.style.display = "none";
  clearTimeout(addInspectTimer);
}

// Destination chips — one per configured scan folder. Clicking SELECTS where a
// new project gets created (it sets `selectedBase` and updates the purple
// preview banner) — it does NOT touch the name field and never flips the flow
// to "connect". The first folder is selected by default, so typing a name and
// hitting Create just works.
function populateAddQuick() {
  api("/api/config").then((cfg) => {
    const roots = [...(cfg.scanPaths || [])];
    addQuick.innerHTML = "";
    selectedBase = roots[0] || null;
    roots.forEach((root, i) => {
      const leaf = root.replace(/[\\/]+$/, "").replace(/^.*[\\/]/, "") || root;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "add-quick-chip";
      chip.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      const plus = document.createElement("span");
      plus.className = "add-quick-plus";
      plus.setAttribute("aria-hidden", "true");
      plus.textContent = "+";
      const label = document.createElement("span");
      label.className = "add-quick-label";
      label.textContent = leaf;
      chip.append(plus, label);
      chip.addEventListener("click", () => {
        selectedBase = root;
        addQuick.querySelectorAll(".add-quick-chip").forEach((c) =>
          c.setAttribute("aria-pressed", c === chip ? "true" : "false"));
        modalPath.focus();
        queueInspect();   // re-preview the destination without changing the name
      });
      addQuick.appendChild(chip);
    });
    addQuick.hidden = roots.length === 0;
    queueInspect();       // refresh preview in case a name is already typed
  }).catch(() => { addQuick.hidden = true; });
}

// Debounced call to the server's path inspector.
function queueInspect() {
  clearTimeout(addInspectTimer);
  addInspectTimer = setTimeout(runInspect, 200);
}
async function runInspect() {
  const eff = effectiveAddPath();
  const seq = ++addInspectSeq;
  if (!eff) { renderAddState({ state: "empty" }); return; }
  try {
    const r = await api("/api/path/inspect", { method: "POST", body: { path: eff } });
    if (seq !== addInspectSeq) return; // a newer keystroke already superseded this
    renderAddState(r);
  } catch { /* network blip — leave the last good state in place */ }
}

// Translate an inspect result into the status callout + button label/state.
function renderAddState(s) {
  addState = s;
  modalError.textContent = "";
  const show = (kind, html) => {
    addStatus.dataset.kind = kind;
    addStatus.innerHTML = html;     // static strings only — see create case for the path
    addStatus.hidden = false;
  };
  const setBtn = (label, enabled) => {
    modalSubmit.textContent = label;
    modalSubmit.disabled = !enabled;
  };
  switch (s.state) {
    case "connect":
      show("connect", s.alreadyTracked
        ? "Already inside a scan folder — this just refreshes it."
        : "Existing folder — it'll be <strong>connected</strong> and tracked.");
      setBtn("Connect project", true);
      break;
    case "create":
      addStatus.dataset.kind = "create";
      addStatus.innerHTML = "New folder — will be <strong>created</strong> here:<span class=\"add-status-path\"></span>";
      addStatus.querySelector(".add-status-path").textContent = s.path; // user input via textContent
      addStatus.hidden = false;
      setBtn("Create project", true);
      break;
    case "no-parent":
      show("error", "That parent folder doesn't exist yet.");
      setBtn("Add project", false);
      break;
    case "bad-name":
      show("error", "That name can't contain \\ / : * ? \" &lt; &gt; |");
      setBtn("Add project", false);
      break;
    case "invalid-file":
      show("error", "That's a file, not a folder.");
      setBtn("Add project", false);
      break;
    default: // empty
      addStatus.hidden = true;
      setBtn("Add project", false);
  }
}

btnAdd.addEventListener("click", openAddModal);
modal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) =>
  el.addEventListener("click", closeAddModal)
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAddModal();
    closeGithubModal();
    // Modal helpers below are declared later in the file; they exist by the
    // time a user could ever fire this handler (after first paint).
    if (typeof closeInstallModal === "function") closeInstallModal();
    if (typeof closeBackupModal === "function")  closeBackupModal();
    closeAllCardMenus();
  }
});

// Live inspection as the user types or pastes.
modalPath.addEventListener("input", queueInspect);

modalPick.addEventListener("click", async () => {
  modalError.textContent = "";
  try {
    const result = await api("/api/dialog/pick-folder", { method: "POST", body: {} });
    if (result.canceled || !result.path) return;
    modalPath.value = result.path;
    queueInspect();
  } catch (err) {
    // Native picker only available in desktop app — fall back to manual paste.
    modalError.textContent = err.message + "  Paste the folder path instead.";
  }
});

modalSubmit.addEventListener("click", async () => {
  modalError.textContent = "";
  const s = addState;
  // Act on the RESOLVED path/parent from the last inspection, not the raw text,
  // so a bare name creates in the selected folder (not relative to anything).
  if (s.state !== "connect" && s.state !== "create") {
    modalError.textContent = "Type a project name, or pick a folder to connect."; return;
  }
  modalSubmit.disabled = true;
  try {
    if (s.state === "connect") {
      const result = await api("/api/projects/add", { method: "POST", body: { path: s.path } });
      toast(result.alreadyTracked
        ? { kind: "info", title: "Already tracked", sub: result.project?.name || s.name }
        : { kind: "success", title: "Project connected", sub: result.project?.name || s.name });
    } else {
      const result = await api("/api/projects/create", { method: "POST", body: { parent: s.parent, name: s.name } });
      toast({ kind: "success", title: "Project created", sub: result.project?.name || s.name });
    }
    closeAddModal();
    await loadProjects();
  } catch (err) {
    modalError.textContent = err.message;
    modalSubmit.disabled = false;
  }
});

// Submit on Enter when the path field is focused (only if the target is valid).
modalPath.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !modalSubmit.disabled) modalSubmit.click();
});

// ── Publish to GitHub wizard ─────────────────────────────────────────────
//
// Two-step flow:
//   Step 1 ("method")  — pick AI vs Manual, set repo name + visibility.
//   Step 2a ("ai")     — pick Claude vs Codex, then launch the prefilled CLI.
//   Step 2b ("manual") — existing audit + SSE-streamed publish pipeline.
//
// State is intentionally module-scoped (not a class) to mirror the rest of
// app.js. Each open of the modal resets every field via openGithubModal().
let ghProject = null;
let ghPublishing = false;
let wizardMethod = null;   // "ai" | "manual" — from Step 1
let wizardCli    = null;   // "claude" | "codex" — from Step 2a
// "initial" — first-time publish (no .git origin yet on GitHub).
// "overwrite" / "release" — re-publish modes; toggled via the mode
// segment in the modal head. The popover decides which set is allowed
// when it opens the modal.
let wizardMode   = "initial";

function showWizardStep(step) {
  ghStepMethod.hidden = step !== "method";
  ghStepAi.hidden     = step !== "ai";
  ghStepManual.hidden = step !== "manual";
  ghFootMethod.hidden = step !== "method";
  ghFootAi.hidden     = step !== "ai";
  ghFootManual.hidden = step !== "manual";
}

function getWizardVisibility() {
  // Source of truth is the segmented control's data-active attribute.
  const seg = document.getElementById("gh-vis-segment");
  return seg?.dataset.active === "private" ? "private" : "public";
}
function setWizardVisibility(value) {
  const seg = document.getElementById("gh-vis-segment");
  if (!seg) return;
  const v = value === "private" ? "private" : "public";
  seg.dataset.active = v;
  seg.querySelectorAll(".gh-vis-opt").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.value === v))
  );
}
// Click either half of the segment to switch. Lives outside the modal-open
// scope because the segment is in the modal header (always present once
// the modal exists in the DOM).
document.getElementById("gh-vis-segment")?.addEventListener("click", (e) => {
  const opt = e.target.closest(".gh-vis-opt");
  if (!opt) return;
  setWizardVisibility(opt.dataset.value);
  // Keep the AI summary in sync if Step 2a is currently visible.
  if (typeof refreshAiSummary === "function") refreshAiSummary();
});

// mode: "initial" | "overwrite" | "release". Defaults based on whether
// the project already has a github.com origin (already-published projects
// open in "release" mode by default — most common re-publish action).
function openGithubModal(project, mode) {
  ghProject = project;
  wizardMethod = null;
  wizardCli = null;
  wizardMode = mode === "overwrite" || mode === "release"
    ? mode
    : (project.githubUrl ? "release" : "initial");
  const isRepublish = wizardMode !== "initial";

  // Title + segment visibility reflect the mode.
  ghTitle.textContent = isRepublish ? "Publish New Release" : "Publish to GitHub";
  if (ghVisSegment)  ghVisSegment.hidden  = isRepublish;
  if (ghModeSegment) ghModeSegment.hidden = !isRepublish;
  if (isRepublish) setWizardModeSegment(wizardMode);

  // Step 1 reset
  ghRepoName.value = project.name;
  // Repo name is locked once published — the github URL is the source of
  // truth and we don't want users renaming the repo by accident.
  ghRepoName.disabled = isRepublish;
  ghModal.querySelectorAll(".gh-method-card").forEach((b) => b.setAttribute("aria-checked", "false"));
  ghModal.querySelectorAll(".gh-cli-card").forEach((b) => b.setAttribute("aria-checked", "false"));
  ghMethodNext.disabled = true;
  ghAiLaunch.disabled = true;
  ghAiSummary.textContent = "";
  // Default visibility back to Public on every open (only matters in initial mode)
  setWizardVisibility("public");
  // Version field starts empty; visibility recalculated on every method
  // and mode change. Hidden by default and only surfaced once the user
  // has picked "manual" + "release".
  ghVersion.value = "";
  refreshVersionFieldVisibility();
  // Step 2b reset
  ghError.textContent = "";
  ghStatus.textContent = "";
  ghProgress.hidden = true;
  ghStepsEl.innerHTML = "";
  ghPrior.hidden = true;
  ghPrior.innerHTML = "";
  ghSummary.innerHTML = "";
  ghSubmit.hidden = true;
  ghSubmit.onclick = null;
  showWizardStep("method");
  ghModal.style.display = "";
  ghModal.classList.add("is-open");
}

// Mirrors the segment's data-active + aria-pressed to reflect wizardMode.
function setWizardModeSegment(value) {
  if (!ghModeSegment) return;
  const v = value === "overwrite" ? "overwrite" : "release";
  ghModeSegment.dataset.active = v;
  ghModeSegment.querySelectorAll(".gh-vis-opt").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.value === v))
  );
}

// Show/hide the version input. Rule: only visible when re-publishing AS
// a new release via the manual flow. AI flow figures the version out
// itself; overwrite flow doesn't need one.
function refreshVersionFieldVisibility() {
  if (!ghVersionFld) return;
  const showVersion = wizardMode === "release" && wizardMethod === "manual";
  ghVersionFld.hidden = !showVersion;
}

// Mode segment click handler — same pattern as the visibility segment.
ghModeSegment?.addEventListener("click", (e) => {
  const opt = e.target.closest(".gh-vis-opt");
  if (!opt) return;
  wizardMode = opt.dataset.value === "overwrite" ? "overwrite" : "release";
  setWizardModeSegment(wizardMode);
  refreshVersionFieldVisibility();
  // Keep the AI summary in sync when Step 2a is visible.
  if (typeof refreshAiSummary === "function") refreshAiSummary();
});

function closeGithubModal() {
  ghModal.classList.remove("is-open");
  ghModal.style.display = "none";
  ghProject = null;
  wizardMethod = null;
  wizardCli = null;
}

ghModal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) =>
  el.addEventListener("click", closeGithubModal)
);

// Step 1 — method picker (radio behavior). Only enables Continue once a
// method is selected; visibility + repo name are editable freely.
ghModal.querySelectorAll(".gh-method-card").forEach((card) => {
  card.addEventListener("click", () => {
    wizardMethod = card.dataset.method;
    ghModal.querySelectorAll(".gh-method-card").forEach((b) =>
      b.setAttribute("aria-checked", String(b === card))
    );
    ghMethodNext.disabled = false;
    // Manual + release combo needs the version input — surface it now so
    // the user can fill it before clicking Continue.
    refreshVersionFieldVisibility();
  });
});

// ── Header confirm icon (replaces footer brand button) ──────────────────
// The brand CTA for each wizard step lives in the modal header now (left
// of the X close button). The original step buttons (#gh-method-next,
// #gh-ai-launch, #gh-submit) still exist in the DOM but are `hidden` so
// existing handlers and disabled-state logic continue to work unchanged.
// A MutationObserver mirrors whichever step button is currently the
// "active primary" into the header confirm icon's enabled state, and the
// header icon's click proxies through to that button's click().
const ghConfirm = document.getElementById("gh-confirm");
function syncGhConfirm() {
  let active = null;
  let shouldHide = false;
  if (!ghFootMethod.hidden) {
    active = ghMethodNext;
  } else if (!ghFootAi.hidden) {
    active = ghAiLaunch;
  } else if (!ghFootManual.hidden) {
    // Step 2b: gh-submit only becomes visible after the publish completes.
    // Until then, there's no header CTA to show.
    if (ghSubmit.hidden) shouldHide = true;
    else active = ghSubmit;
  }
  if (shouldHide || !active) {
    ghConfirm.hidden = true;
    ghConfirm.disabled = true;
    return;
  }
  ghConfirm.hidden = false;
  ghConfirm.disabled = !!active.disabled;
  ghConfirm.textContent = (active.textContent || "").trim();
}
const ghConfirmObserver = new MutationObserver(syncGhConfirm);
[ghMethodNext, ghAiLaunch, ghSubmit, ghFootMethod, ghFootAi, ghFootManual].forEach((el) => {
  if (el) ghConfirmObserver.observe(el, { attributes: true, attributeFilter: ["disabled", "hidden"] });
});
ghConfirm.addEventListener("click", () => {
  if (!ghFootMethod.hidden && !ghMethodNext.disabled) ghMethodNext.click();
  else if (!ghFootAi.hidden && !ghAiLaunch.disabled) ghAiLaunch.click();
  else if (!ghFootManual.hidden && !ghSubmit.hidden && !ghSubmit.disabled) ghSubmit.click();
});

ghMethodNext.addEventListener("click", () => {
  if (!wizardMethod || !ghProject) return;
  if (wizardMethod === "ai") {
    showWizardStep("ai");
    refreshAiSummary();
  } else {
    showWizardStep("manual");
    runManualAudit();
  }
});

ghAiBack.addEventListener("click", () => showWizardStep("method"));
ghManualBack.addEventListener("click", () => showWizardStep("method"));

// Step 2a — CLI picker
ghModal.querySelectorAll(".gh-cli-card").forEach((card) => {
  card.addEventListener("click", () => {
    wizardCli = card.dataset.cli;
    ghModal.querySelectorAll(".gh-cli-card").forEach((b) =>
      b.setAttribute("aria-checked", String(b === card))
    );
    ghAiLaunch.disabled = false;
    refreshAiSummary();
  });
});

function refreshAiSummary() {
  const repo = (ghRepoName.value || ghProject?.name || "").trim();
  const vis  = getWizardVisibility();
  const cliName = wizardCli === "codex" ? "Codex" : wizardCli === "claude" ? "Claude Code" : "your CLI";
  if (!wizardCli) { ghAiSummary.textContent = ""; return; }
  // Tailor the one-line summary to the active mode so the user knows
  // exactly what their CLI is about to do.
  let action;
  if (wizardMode === "release") {
    action = `update "${repo}" and cut a new release — version picked by ${cliName}, detailed changelog of everything that changed, and the built release package attached`;
  } else if (wizardMode === "overwrite") {
    action = `overwrite "${repo}" on GitHub with the latest code in this folder (no new release tag)`;
  } else {
    action = `publish "${repo}" as ${vis}`;
  }
  ghAiSummary.textContent = `${cliName} will open in this project's folder with a prefilled prompt to ${action}.`;
}

ghAiLaunch.addEventListener("click", async () => {
  if (!wizardCli || !ghProject) return;
  ghAiLaunch.disabled = true;
  try {
    const repoName = (ghRepoName.value || ghProject.name).trim();
    const visibility = getWizardVisibility();
    const result = await api(`/api/projects/${ghProject.slug}/github/ai-launch`, {
      method: "POST",
      body: { cli: wizardCli, repoName, visibility, mode: wizardMode },
    });
    // Server short-circuits when Claude/Codex isn't on PATH — surface the
    // same install modal the open-tool flow uses, instead of flashing a
    // terminal with "command not found" and showing a misleading success
    // toast.
    if (result && result.notInstalled) {
      closeGithubModal();
      openInstallModal(result);
      return;
    }
    toast({
      kind: "success",
      title: `Opened ${wizardCli === "codex" ? "Codex" : "Claude Code"}`,
      sub: wizardMode === "initial"
        ? "Continue the publish in the terminal."
        : wizardMode === "release"
          ? "Continue the release in the terminal."
          : "Continue the overwrite in the terminal.",
    });
    closeGithubModal();
    // Best-effort auto-refresh: most AI publishes finish under a minute.
    // The window-focus listener will also kick a re-scan when the user
    // returns from the terminal — this is a backup tick.
    setTimeout(() => loadProjects().catch(() => {}), 30000);
  } catch (err) {
    toast({ kind: "error", title: "Failed to open CLI", sub: err.message });
  } finally {
    ghAiLaunch.disabled = false;
  }
});

// Keep the AI summary live as the user edits repo name. The visibility
// segment already calls refreshAiSummary in its own click handler.
ghRepoName.addEventListener("input", refreshAiSummary);

// Step 2b — runs the existing audit + gh check, then auto-fires runPublish().
async function runManualAudit() {
  if (!ghProject || ghPublishing) return;
  // For new-release mode the version is required and must look like
  // semver. Bail before we start spinning up the audit so the user gets
  // a clear, immediate error on Step 1 rather than mid-pipeline.
  if (wizardMode === "release") {
    const v = (ghVersion.value || "").trim().replace(/^v/i, "");
    if (!v || !/^\d+\.\d+\.\d+([.\-+].+)?$/.test(v)) {
      showWizardStep("method");
      ghError.textContent = "Enter a version like 1.2.3 to cut a new release.";
      return;
    }
  }
  ghError.textContent = "";
  ghStatus.textContent = "";
  ghProgress.hidden = true;
  ghStepsEl.innerHTML = "";
  ghPrior.hidden = true;
  ghPrior.innerHTML = "";
  ghSummary.innerHTML = '<div class="gh-audit-loading">Checking GitHub CLI…</div>';
  ghSubmit.hidden = true;
  ghSubmit.onclick = null;

  let audit, check;
  try {
    [audit, check] = await Promise.all([
      api(`/api/projects/${ghProject.slug}/github/audit`),
      api(`/api/github/check`),
    ]);
  } catch (err) {
    ghSummary.innerHTML = "";
    ghError.textContent = err.message;
    return;
  }

  // Re-publish must mirror back into the SAME folder the first publish
  // chose, otherwise we'd end up with two divergent public copies. The
  // audit endpoint returns prior.publicCopyPath when a prior prep exists
  // — prefer that over the default suggestion for re-publish modes.
  ghDest.value = (wizardMode !== "initial" && audit.prior?.publicCopyPath)
    ? audit.prior.publicCopyPath
    : audit.suggestedDest;

  if (audit.prior) {
    ghPrior.hidden = false;
    // Built with createElement / textContent rather than innerHTML so a
    // malicious repoUrl (e.g. javascript:…) or publicCopyPath with HTML
    // can't execute. The values originate from projects.json, which is
    // written by our own server — but the URL is read from .git/config,
    // which is itself just a file on the user's disk.
    ghPrior.textContent = "";
    const banner = document.createElement("div");
    banner.className = "gh-prior-banner";

    const head = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = "Already published";
    head.append(strong, document.createTextNode(` on ${fmtTimestamp(audit.prior.createdAt)}`));

    const repoRow = document.createElement("div");
    repoRow.appendChild(document.createTextNode("Repo: "));
    const a = document.createElement("a");
    // Refuse non-http(s) hrefs so a stored `javascript:` URL can't fire.
    const safeHref = /^https?:\/\//i.test(audit.prior.repoUrl) ? audit.prior.repoUrl : "";
    if (safeHref) { a.href = safeHref; a.target = "_blank"; a.rel = "noopener"; }
    a.textContent = audit.prior.repoUrl || "";
    repoRow.appendChild(a);

    const copyRow = document.createElement("div");
    copyRow.appendChild(document.createTextNode("Public copy: "));
    const code = document.createElement("code");
    code.textContent = audit.prior.publicCopyPath || "";
    copyRow.appendChild(code);

    banner.append(head, repoRow, copyRow);
    ghPrior.appendChild(banner);
  }

  if (!check.installed || !check.authed) {
    ghSummary.innerHTML = `
      <div class="gh-row gh-row-red"><span class="gh-dot"></span>
        <div>${!check.installed
          ? "<strong>GitHub CLI not found.</strong> Install <code>gh</code> from <a href=\"https://cli.github.com\" target=\"_blank\" rel=\"noopener\">cli.github.com</a>, then try again."
          : "<strong>GitHub CLI not authenticated.</strong> Run <code>gh auth login</code> in a terminal, then try again."
        }</div></div>`;
    return;
  }

  const vis = getWizardVisibility();
  const summaryRows = [
    `<div class="gh-row gh-row-green"><span class="gh-dot"></span>
      <div>Signed in as <code>${check.user || "(unknown)"}</code> — publishing <code>${ghProject.name}</code> as ${vis}.</div></div>`,
  ];
  if (audit.secrets.length) {
    summaryRows.push(`<div class="gh-row gh-row-yellow"><span class="gh-dot"></span>
      <div>${audit.secrets.length} secret file${audit.secrets.length === 1 ? "" : "s"} will be excluded.</div></div>`);
  }
  ghSummary.innerHTML = summaryRows.join("");

  await runPublish();
}

async function runPublish() {
  if (!ghProject || ghPublishing) return;
  ghPublishing = true;
  ghError.textContent = "";
  ghStatus.textContent = "Publishing…";
  ghProgress.hidden = false;
  ghStepsEl.innerHTML = "";

  const repoName   = ghRepoName.value.trim() || ghProject.name;
  const dest       = ghDest.value.trim();
  const visibility = getWizardVisibility();
  const version    = (ghVersion.value || "").trim().replace(/^v/i, "");

  let resp;
  try {
    resp = await fetch(`/api/projects/${ghProject.slug}/github/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ repoName, dest, visibility, mode: wizardMode, version }),
    });
  } catch (err) {
    ghError.textContent = err.message;
    ghPublishing = false;
    return;
  }
  if (!resp.ok && resp.status !== 200) {
    ghError.textContent = `Server returned ${resp.status}`;
    ghPublishing = false;
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finalEvent = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const evMatch = raw.match(/^event:\s*(\S+)/m);
      const dataMatch = raw.match(/^data:\s*(.*)$/m);
      if (!dataMatch) continue;
      let payload;
      try { payload = JSON.parse(dataMatch[1]); } catch { continue; }
      const ev = evMatch ? evMatch[1] : "message";
      if (ev === "step") {
        const li = document.createElement("li");
        li.className = `gh-step gh-step-${payload.ok ? "ok" : "err"}`;
        li.textContent = `[${payload.phase}] ${payload.msg}`;
        ghStepsEl.appendChild(li);
        ghStepsEl.scrollTop = ghStepsEl.scrollHeight;
      } else if (ev === "done") {
        finalEvent = payload;
      }
    }
  }

  ghPublishing = false;
  if (finalEvent && finalEvent.ok) {
    // Mode-aware copy so the user knows whether the run created a new
    // release tag or just pushed an overwrite commit.
    const verb = wizardMode === "release" ? "Released" : wizardMode === "overwrite" ? "Updated" : "Published";
    ghStatus.textContent = `${verb}.`;
    ghSubmit.hidden = false;
    ghSubmit.textContent = "Open on GitHub";
    ghSubmit.onclick = () => window.open(finalEvent.repoUrl, "_blank");
    const versionTag = (ghVersion.value || "").trim().replace(/^v/i, "");
    const title = wizardMode === "release"
      ? `Released v${versionTag}`
      : wizardMode === "overwrite"
        ? "Repo updated on GitHub"
        : "Published to GitHub";
    toast({ kind: "success", title, sub: finalEvent.repoUrl });
    await loadProjects();
  } else {
    ghStatus.textContent = "Failed.";
    ghError.textContent = "Publish did not complete. See log above.";
  }
}

// ── In-card menu (3-dot transforms the card body) ─────────────────────────
// Clicking the 3-dot button on a card hides the body sections and reveals
// the .card-menu-view container populated with the same menu items that
// previously lived in a floating popover. Clicking ⋮ again flips back.
// Only one card at a time is in menu mode — opening another card's menu
// closes any other open one.

function closeCardMenu(card) {
  if (!card || card.dataset.menu !== "open") return;
  card.removeAttribute("data-menu");
  // Release the snapshotted height so the card returns to natural sizing.
  card.style.minHeight = "";
  const menuBtn = card.querySelector(".card-menu");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
}
function closeAllCardMenus(except) {
  document.querySelectorAll('.card[data-menu="open"]').forEach((c) => {
    if (c !== except) closeCardMenu(c);
  });
}

// Click anywhere outside an open ⋯ menu closes it. Capture phase, so widgets
// that stopPropagation (task marks, path pills, badges, …) can't keep a stale
// menu open. The ⋯ buttons and the menu items themselves are exempt — they
// run their own toggle/dispatch logic, which already closes the menu.
document.addEventListener("click", (e) => {
  const open = document.querySelector('.card[data-menu="open"]');
  if (!open) return;
  if (!(e.target instanceof Element)) return;
  if (e.target.closest(".card-menu") || e.target.closest(".card-menu-view")) return;
  closeCardMenu(open);
}, true);

// Escape closes it too — but only when no modal is open, so the key keeps
// meaning "back out of the topmost layer".
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (document.querySelector(".modal.is-open")) return;
  closeAllCardMenus();
});

function populateCardMenu(card, project) {
  const view = card.querySelector(".card-menu-view");
  view.innerHTML = "";
  view.appendChild(cardMenuTpl.content.cloneNode(true));

  // Per-project visibility — same rules the old popover used.
  view.querySelector('[data-action="archive"]').hidden   = project.status === "archived";
  view.querySelector('[data-action="unarchive"]').hidden = project.status !== "archived";

  const isPublished = !!project.githubUrl;
  const publishLabel = view.querySelector('[data-action="publish-github"] .publish-label');
  const publishDesc  = view.querySelector('[data-action="publish-github"] .publish-desc');
  if (publishLabel) publishLabel.textContent = isPublished ? "New Release" : "Publish";
  if (publishDesc)  publishDesc.textContent  = isPublished ? "Tag and publish a release" : "Push to a new GitHub repo";

  view.querySelectorAll(".popover-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      dispatchCardMenuAction(item.dataset.action, project, card);
    });
  });
}

function toggleCardMenu(card, project) {
  if (card.dataset.menu === "open") {
    closeCardMenu(card);
    return;
  }
  closeAllCardMenus(card);
  // Snapshot the card's natural body-mode height BEFORE swapping in the
  // menu, then lock it as min-height. Without this the card jumps size
  // because the menu grid is more compact than the stacked body sections —
  // the user wants the card footprint stable across both states.
  //
  // Measure WITHOUT the per-card variable sections — the tasks list and the
  // language row. Tasks can make a card several times taller than its
  // default body, and the language row comes and goes per project; either
  // would make menu-mode cards open at different heights. Excluding both
  // means EVERY card's menu opens at the same standard envelope, and the
  // hidden sections come back when the menu closes.
  const hideForMeasure = [
    card.querySelector(".card-tasks"),
    card.querySelector(".card-row-langs"),
  ].filter((el) => el && !el.hidden);
  hideForMeasure.forEach((el) => { el.hidden = true; });
  const lockedHeight = card.offsetHeight;
  hideForMeasure.forEach((el) => { el.hidden = false; });
  populateCardMenu(card, project);
  card.style.minHeight = `${lockedHeight}px`;
  card.dataset.menu = "open";
  const menuBtn = card.querySelector(".card-menu");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
}

async function dispatchCardMenuAction(action, project, card) {
  // Close the menu first so the card returns to its normal view before any
  // modal/toast appears. Matches the old popover's close-then-fire flow.
  closeCardMenu(card);

  if (action === "backup")              openBackupModal(project);
  else if (action === "publish-github") {
    // Same wizard for both flows — flips between "Publish to GitHub"
    // (initial) and "Publish New Release" (re-publish: overwrite OR new
    // release) based on whether project.githubUrl is set.
    openGithubModal(project, project.githubUrl ? "release" : "initial");
  }
  else if (action === "archive")        await updateStatus(project.slug, "archived");
  else if (action === "unarchive")      await updateStatus(project.slug, "in-progress");
}

// ── Search + auto-rescan ──────────────────────────────────────────────────
// renderGrid() filters + sorts every project and rebuilds the grid; doing that
// synchronously on every keystroke janks once there are many projects. Update
// `query` immediately (never lose input) but debounce the rebuild so a burst of
// fast typing collapses into a single render.
let searchDebounce = null;
searchEl.addEventListener("input", (e) => {
  query = e.target.value;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(renderGrid, 120);
});

// Auto-refresh when the window regains focus (e.g., after dropping in a new project).
window.addEventListener("focus", () => loadProjects().catch(() => {}));

// ── Scan button ───────────────────────────────────────────────────────────
// Re-runs the project scan against every folder in `scanPaths` and reports how
// many *new* projects appeared since the last load. Existing projects keep
// their stored status / notes — only the project list is refreshed.
document.getElementById("btn-scan").addEventListener("click", async () => {
  const btn = document.getElementById("btn-scan");
  if (btn.dataset.busy === "true") return;
  btn.dataset.busy = "true";
  const before = new Set(projects.map((p) => p.slug));
  try {
    await loadProjects();
    const added = projects.filter((p) => !before.has(p.slug));
    if (added.length === 0) {
      toast({ kind: "info", title: "Scan complete", sub: "No new projects found." });
    } else {
      toast({
        kind: "success",
        title: `${added.length} new project${added.length === 1 ? "" : "s"} found`,
        sub: added.slice(0, 3).map((p) => p.name).join(", ") + (added.length > 3 ? "…" : ""),
      });
    }
  } catch (err) {
    toast({ kind: "error", title: "Scan failed", sub: err.message });
  } finally {
    btn.dataset.busy = "false";
  }
});

// ── Settings modal ────────────────────────────────────────────────────────
const settingsModal = document.getElementById("modal-settings");
const btnSettings   = document.getElementById("btn-settings");
let settingsState = null;   // working copy of user-config that the modal mutates

function openSettings() {
  api("/api/config").then((cfg) => {
    settingsState = {
      backupPath: cfg.backupPath || "",
      scanPaths: [...(cfg.scanPaths || [])],
      excludeFolders: [...(cfg.excludeFolders || [])],
      statuses: cfg.statuses.map((s) => ({ ...s })),
      // Customisable Total-tile color. The hex falls back to the canonical
      // brand violet (#6a4dff = --brand-500) when the user hasn't set one.
      totalColor: cfg.totalColor || "#6a4dff",
      customLogo: cfg.customLogo || null,
      // Off by default — see server: language row usually covers what the
      // stack badge would say. Tracking the original lets Save detect a
      // false→true flip and request a rescan on the server.
      showStackBadge: cfg.showStackBadge === true,
      _initialShowStackBadge: cfg.showStackBadge === true,
      // Language badges default to ON when the key isn't present — keeps
      // existing installs behaving the same way after this upgrade.
      showLanguageBadges: cfg.showLanguageBadges !== false,
      // Off by default — the Claude button keeps its terminal behaviour until
      // the user opts into the desktop-app deep link.
      openClaudeInDesktop: cfg.openClaudeInDesktop === true,
      // Same opt-in for Codex (uses `codex app <folder>` instead of a deep link).
      openCodexInDesktop: cfg.openCodexInDesktop === true,
      // Off by default — when on, task/publish sessions run hidden and close
      // themselves once the work is done (no lingering terminal windows).
      headlessTerminals: cfg.headlessTerminals === true,
      // Which AI CLI the task send buttons launch. Claude unless opted out.
      taskAgent: cfg.taskAgent === "codex" ? "codex" : "claude",
    };
    renderSettings();
    settingsError("");
    settingsModal.style.display = "";
    settingsModal.classList.add("is-open");
  }).catch((err) => toast({ kind: "error", title: "Couldn't load settings", sub: err.message }));
}
function closeSettings() {
  settingsModal.classList.remove("is-open");
  settingsModal.style.display = "none";
  settingsState = null;
}
function settingsError(msg) {
  document.getElementById("set-error").textContent = msg || "";
}

btnSettings?.addEventListener("click", openSettings);
settingsModal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) =>
  el.addEventListener("click", closeSettings)
);

// Stack-badge toggle — mutate the working copy as the user flips it.
// Persistence happens when the user clicks Save (see the save handler).
document.getElementById("set-show-stack")?.addEventListener("change", (e) => {
  if (settingsState) settingsState.showStackBadge = e.target.checked;
});
// Language-badge toggle — same pattern as the stack badge above.
document.getElementById("set-show-langs")?.addEventListener("change", (e) => {
  if (settingsState) settingsState.showLanguageBadges = e.target.checked;
});
// Claude desktop-app toggle — same pattern. Routes the Claude button to the
// claude:// deep link when on (handled server-side in /api/projects/:slug/open).
document.getElementById("set-claude-desktop")?.addEventListener("change", (e) => {
  if (settingsState) settingsState.openClaudeInDesktop = e.target.checked;
});
// Codex desktop-app toggle — routes the Codex button to `codex app <folder>`.
document.getElementById("set-codex-desktop")?.addEventListener("change", (e) => {
  if (settingsState) settingsState.openCodexInDesktop = e.target.checked;
});
// Headless background terminals — task/publish sessions run hidden and exit
// when done (handled server-side in spawnAiPrompt's headless branch).
document.getElementById("set-headless-terminals")?.addEventListener("change", (e) => {
  if (settingsState) settingsState.headlessTerminals = e.target.checked;
});
// Task agent segment — which CLI the per-task send buttons launch. Same
// slide-segment pattern as the publish modal's visibility control.
function setTaskAgentSegment(v) {
  const seg = document.getElementById("set-task-agent");
  if (!seg) return;
  const val = v === "codex" ? "codex" : "claude";
  seg.dataset.active = val;
  seg.querySelectorAll(".gh-vis-opt").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.value === val))
  );
}
document.getElementById("set-task-agent")?.addEventListener("click", (e) => {
  const opt = e.target.closest(".gh-vis-opt");
  if (!opt) return;
  if (settingsState) settingsState.taskAgent = opt.dataset.value === "codex" ? "codex" : "claude";
  setTaskAgentSegment(opt.dataset.value);
});

// Display form for a scan-folder pill: drop the leading "<drive>:\Users\<name>\"
// so the badge reads e.g. "Documents\♾️ Coding Projects - Local" (or just
// "Music") instead of the full path — shorter and cleaner while still showing
// the meaningful path. Paths outside the user home are shown unchanged. The
// full path stays available via the pill's title tooltip.
function shortenScanPath(p) {
  const short = String(p).replace(/^[A-Za-z]:[\\/]Users[\\/][^\\/]+[\\/]/i, "");
  return short || String(p);
}

function renderSettings() {
  // Backup path
  document.getElementById("set-backup-path").value = settingsState.backupPath || "";

  // Stack-badge toggle
  const showStackEl = document.getElementById("set-show-stack");
  if (showStackEl) showStackEl.checked = !!settingsState.showStackBadge;
  // Language-badge toggle
  const showLangsEl = document.getElementById("set-show-langs");
  if (showLangsEl) showLangsEl.checked = !!settingsState.showLanguageBadges;
  // Claude desktop-app toggle
  const claudeDesktopEl = document.getElementById("set-claude-desktop");
  if (claudeDesktopEl) claudeDesktopEl.checked = !!settingsState.openClaudeInDesktop;
  const codexDesktopEl = document.getElementById("set-codex-desktop");
  if (codexDesktopEl) codexDesktopEl.checked = !!settingsState.openCodexInDesktop;
  // Headless background terminals toggle
  const headlessEl = document.getElementById("set-headless-terminals");
  if (headlessEl) headlessEl.checked = !!settingsState.headlessTerminals;
  // Task agent segment
  setTaskAgentSegment(settingsState.taskAgent);

  // Logo preview — bust cache so a freshly uploaded file shows.
  document.getElementById("set-logo-preview").src = "/api/logo?t=" + Date.now();

  // Statuses
  const stHost = document.getElementById("set-status-list");
  stHost.innerHTML = "";
  settingsState.statuses.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "status-edit-row";

    const swatch = document.createElement("span");
    swatch.className = "status-swatch";
    swatch.style.background = statusSwatchColor(s.color);

    const label = document.createElement("input");
    label.type = "text";
    label.value = s.label;
    label.setAttribute("aria-label", "Status name");
    // Mutate in place without re-rendering — a re-render here would yank focus
    // out of the field on every keystroke.
    label.addEventListener("input", () => {
      settingsState.statuses[i].label = label.value;
    });

    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "Status color");
    // A legacy hex from the old customisation screen has no matching token.
    // Offer it as its own option so merely opening Settings doesn't silently
    // convert someone's existing color to a token.
    const opts = isHex(s.color) ? [s.color, ...STATUS_COLOR_TOKENS] : STATUS_COLOR_TOKENS;
    for (const t of opts) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      if (t === s.color) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => {
      settingsState.statuses[i].color = sel.value;
      renderSettings();   // repaint the swatch
    });

    const del = document.createElement("button");
    del.className = "remove";
    del.type = "button";
    del.textContent = "✕";
    del.setAttribute("aria-label", `Remove ${s.label}`);
    del.disabled = settingsState.statuses.length <= 1;
    del.addEventListener("click", () => {
      settingsState.statuses.splice(i, 1);
      renderSettings();
    });

    row.append(swatch, label, sel, del);
    stHost.appendChild(row);
  });

  // Scan paths
  const scanHost = document.getElementById("set-scan-paths");
  scanHost.innerHTML = "";
  settingsState.scanPaths.forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "path-item";
    item.innerHTML = `<span></span><button class="remove" type="button" aria-label="Remove">✕</button>`;
    const txt = item.querySelector("span");
    txt.textContent = shortenScanPath(p);
    item.querySelector(".remove").addEventListener("click", () => {
      settingsState.scanPaths.splice(i, 1);
      renderSettings();
    });
    scanHost.appendChild(item);
  });

  // Excludes
  const exHost = document.getElementById("set-exclude-list");
  exHost.innerHTML = "";
  settingsState.excludeFolders.forEach((name, i) => {
    const chip = document.createElement("span");
    chip.className = "exclude-chip";
    chip.innerHTML = `<span></span><button class="remove" type="button" aria-label="Remove">✕</button>`;
    chip.querySelector("span").textContent = name;
    chip.querySelector(".remove").addEventListener("click", () => {
      settingsState.excludeFolders.splice(i, 1);
      renderSettings();
    });
    exHost.appendChild(chip);
  });
}

// Backup-path picker — folder is set ONLY via the Browse dialog or Paste button.
// The input itself is `readonly` (no manual typing).
document.getElementById("set-backup-pick").addEventListener("click", async () => {
  try {
    const r = await api("/api/dialog/pick-folder", { method: "POST", body: {} });
    if (r.path) {
      settingsState.backupPath = r.path;
      document.getElementById("set-backup-path").value = r.path;
    }
  } catch (err) { settingsError(err.message); }
});
document.getElementById("set-backup-paste").addEventListener("click", async () => {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) { settingsError("Clipboard is empty."); return; }
    settingsState.backupPath = text;
    document.getElementById("set-backup-path").value = text;
    settingsError("");
  } catch (err) {
    settingsError("Couldn't read clipboard: " + err.message);
  }
});

// Logo upload + reset. After either action succeeds, the window icon needs
// to be rebuilt — which means re-creating the BrowserWindow with a new `icon:`
// option. The simplest, bullet-proof way to force that is a full app relaunch.
function relaunchAfter(toastInfo) {
  toast(toastInfo);
  // Brief delay so the user sees the toast before the window disappears.
  setTimeout(() => {
    if (window.cdAPI?.app?.relaunch) {
      window.cdAPI.app.relaunch();
    } else {
      // Browser/dev-server fallback: just reload so at least the in-app logo refreshes.
      window.location.reload();
    }
  }, 900);
}
// Builds the "sub" line of the combined logo+desktop-icon toast. Single
// source of truth for whichever path (upload or reset) just ran. When the
// shortcut update failed, we surface the actual error so the user knows
// where to look (tracker.log has the full PS trace too).
function buildLogoToastSub(shortcutUpdate, defaultSub) {
  if (!shortcutUpdate) return defaultSub; // SVG: server skipped on purpose
  if (shortcutUpdate.ok) {
    const n = shortcutUpdate.updated;
    return `${n} desktop shortcut${n === 1 ? "" : "s"} refreshed · restarting…`;
  }
  // Failure: spotlight the error, drop the "restarting" suffix since the
  // user will probably want to read it before the relaunch.
  return `Desktop icon update failed: ${(shortcutUpdate.error || "see tracker.log").slice(0, 120)}`;
}

// Wraps a button in a busy state while `fn` runs. Restores label on
// completion. Used by the logo pick/reset handlers so the user sees
// immediate feedback during the 1–3s PowerShell + relaunch window
// instead of an unresponsive button + no UI changes.
async function withBusyButton(btn, busyLabel, fn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.dataset.busy = "true";
  btn.textContent = busyLabel;
  try { return await fn(); }
  finally {
    btn.disabled = false;
    delete btn.dataset.busy;
    btn.textContent = original;
  }
}

document.getElementById("set-logo-pick").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  try {
    const r = await api("/api/dialog/pick-file", {
      method: "POST",
      body: { filters: [{ name: "Image", extensions: ["svg", "png", "jpg", "jpeg", "ico"] }] },
    });
    if (r.canceled || !r.path) return;
    await withBusyButton(btn, "Updating…", async () => {
      const u = await api("/api/settings/logo", { method: "POST", body: { path: r.path } });
      settingsState.customLogo = u.customLogo;
      refreshLogoEverywhere();
      const ok = !u.shortcutUpdate || u.shortcutUpdate.ok;
      relaunchAfter({
        kind: ok ? "success" : "error",
        title: "Logo updated",
        sub: buildLogoToastSub(u.shortcutUpdate, "Restarting to apply new icon…"),
      });
    });
  } catch (err) { settingsError(err.message); }
});
document.getElementById("set-logo-reset").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  try {
    await withBusyButton(btn, "Resetting…", async () => {
      const u = await api("/api/settings/logo/reset", { method: "POST", body: {} });
      settingsState.customLogo = null;
      refreshLogoEverywhere();
      const ok = !u?.shortcutUpdate || u.shortcutUpdate.ok;
      relaunchAfter({
        kind: ok ? "info" : "error",
        title: "Logo reset to default",
        sub: buildLogoToastSub(u?.shortcutUpdate, "Restarting to apply…"),
      });
    });
  } catch (err) { settingsError(err.message); }
});
function refreshLogoEverywhere() {
  const t = "?t=" + Date.now();
  document.getElementById("set-logo-preview").src = "/api/logo" + t;
  document.getElementById("brand-mark").src       = "/api/logo" + t;
  // credit-mark is intentionally NOT refreshed here — it is locked to the
  // bundled creator avatar served by /api/credit-logo and must remain
  // unchanged when users rebrand the app.
}

// Scan path add (paste or pick)
document.getElementById("set-scan-pick").addEventListener("click", async () => {
  try {
    const r = await api("/api/dialog/pick-folder", { method: "POST", body: {} });
    if (r.path) document.getElementById("set-scan-add").value = r.path;
  } catch (err) { settingsError(err.message); }
});
document.getElementById("set-scan-confirm").addEventListener("click", () => {
  const input = document.getElementById("set-scan-add");
  const v = input.value.trim();
  if (!v) return;
  if (!settingsState.scanPaths.includes(v)) settingsState.scanPaths.push(v);
  input.value = "";
  renderSettings();
});

// Exclude add — accepts either a typed folder name or, via Browse, a picked
// folder whose basename is added to the exclude list. Excludes are matched by
// folder name (not full path) during scanning.
document.getElementById("set-exclude-pick").addEventListener("click", async () => {
  try {
    const r = await api("/api/dialog/pick-folder", { method: "POST", body: {} });
    if (r.path) {
      // Strip to the leaf folder name — that's what the scanner matches against.
      const leaf = r.path.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
      document.getElementById("set-exclude-add").value = leaf;
    }
  } catch (err) { settingsError(err.message); }
});
function addExcludeName(raw) {
  const v = (raw || "").trim();
  if (!v) return false;
  if (settingsState.excludeFolders.includes(v)) return false;
  settingsState.excludeFolders.push(v);
  return true;
}
document.getElementById("set-exclude-confirm").addEventListener("click", () => {
  const input = document.getElementById("set-exclude-add");
  if (addExcludeName(input.value)) {
    input.value = "";
    renderSettings();
  } else if (input.value.trim()) {
    settingsError(`"${input.value.trim()}" is already excluded.`);
  }
});
document.getElementById("set-exclude-add").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("set-exclude-confirm").click(); }
});

// Add a status. New ones start "muted" — a neutral chip the user can then
// recolor, rather than guessing a meaning from the palette.
document.getElementById("set-status-confirm").addEventListener("click", () => {
  const input = document.getElementById("set-status-add");
  const label = input.value.trim();
  if (!label) { settingsError("Give the status a name first."); return; }
  const taken = new Set(settingsState.statuses.map((s) => s.id));
  settingsState.statuses.push({ id: makeStatusId(label, taken), label, color: "muted" });
  input.value = "";
  settingsError("");
  renderSettings();
});
document.getElementById("set-status-add").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("set-status-confirm").click(); }
});

// Save: build the user-config patch from the working copy.
document.getElementById("set-save").addEventListener("click", async () => {
  const enabledStackBadge =
    settingsState.showStackBadge && !settingsState._initialShowStackBadge;
  // Trim status labels before validating — a name of just spaces would pass a
  // truthy check but render as a blank chip.
  const statuses = settingsState.statuses.map((s) => ({ ...s, label: s.label.trim() }));
  if (statuses.some((s) => !s.label)) {
    settingsError("Every status needs a name.");
    return;
  }
  const patch = {
    backupPath: settingsState.backupPath || undefined,
    scanPaths: settingsState.scanPaths,
    excludeFolders: settingsState.excludeFolders,
    statuses,
    showStackBadge: !!settingsState.showStackBadge,
    showLanguageBadges: !!settingsState.showLanguageBadges,
    openClaudeInDesktop: !!settingsState.openClaudeInDesktop,
    openCodexInDesktop: !!settingsState.openCodexInDesktop,
    headlessTerminals: !!settingsState.headlessTerminals,
    taskAgent: settingsState.taskAgent === "codex" ? "codex" : "claude",
  };
  try {
    const saved = await api("/api/config", { method: "POST", body: patch });
    closeSettings();
    await loadProjects();
    // Removing a status rehomes any project still filed under it. Say so out
    // loud — projects silently changing status is exactly the kind of thing a
    // user should be told, not left to discover.
    const moved = saved?.movedProjects || 0;
    toast({
      kind: "success",
      title: "Settings saved",
      // When the stack-badge toggle flipped on, the badges came from a fresh
      // detection pass; otherwise just confirm the save. Always a one-line sub
      // so every toast reads consistently.
      sub: moved
        ? `${moved} project${moved === 1 ? "" : "s"} moved to “${saved.statuses[0].label}”.`
        : enabledStackBadge ? "Badges rescanned." : "Your preferences are updated.",
    });
  } catch (err) { settingsError(err.message); }
});

// Reset everything to bundled defaults.
document.getElementById("set-reset").addEventListener("click", async () => {
  if (!confirm("Reset all settings to defaults? Your project statuses and notes are preserved.")) return;
  try {
    await api("/api/settings/reset", { method: "POST", body: {} });
    closeSettings();
    refreshLogoEverywhere();
    await loadProjects();
    toast({ kind: "info", title: "Settings reset", sub: "Back to bundled defaults." });
  } catch (err) { settingsError(err.message); }
});

// ── Scheduled tasks modal ─────────────────────────────────────────────────
const scheduleModal   = document.getElementById("modal-schedule");
const btnSchedule     = document.getElementById("btn-schedule");
const schedListEl     = document.getElementById("schedule-list");
const schedEmptyEl    = document.getElementById("schedule-empty");
const schedProjectSel  = document.getElementById("sched-project");
const schedProjectsList = document.getElementById("sched-projects-list");
const schedProjectAdd  = document.getElementById("sched-project-add");
const schedTitleEl    = document.getElementById("sched-title");
const schedNoteEl     = document.getElementById("sched-note");
const schedLinksEditor = makeLinkEditor({
  listEl:  document.getElementById("sched-links-list"),
  inputEl: document.getElementById("sched-links-input"),
  addBtn:  document.getElementById("sched-links-add"),
});
const schedRecurrence = document.getElementById("sched-recurrence");
const schedTimeEl     = document.getElementById("sched-time");
const schedDateTimeEl = document.getElementById("sched-datetime");
const schedWeekdayEl  = document.getElementById("sched-weekday");
const schedDayEl      = document.getElementById("sched-day");
const schedAgentEl    = document.getElementById("sched-agent");
const schedNextHint   = document.getElementById("sched-next-hint");
const schedErrorEl    = document.getElementById("sched-error");
const schedFormTitle  = document.getElementById("sched-form-title");
const schedSaveBtn    = document.getElementById("sched-save");
const schedCancelEdit = document.getElementById("sched-cancel-edit");
const schedNewBtn     = document.getElementById("sched-new");

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
let schedules = [];          // last fetched list
let editingScheduleId = null; // null = create mode
// Projects the schedule being built/edited targets (multi-select). Chips
// mirror the reference-link editor right below the field — same component.
let schedSelectedSlugs = [];
// Labels for slugs whose project is no longer in the dashboard list (folder
// moved/deleted) — seeded from the schedule payload's resolved names on edit.
const schedChipNames = new Map();

function schedProjectName(slug) {
  const p = projects.find((x) => x.slug === slug);
  return p ? p.name : (schedChipNames.get(slug) || "(missing project)");
}
function renderSchedProjectChips() {
  schedProjectsList.textContent = "";
  schedSelectedSlugs.forEach((slug, i) => {
    const item = document.createElement("div");
    item.className = "path-item";
    // Static, trusted markup — the project name goes in via textContent below.
    item.innerHTML = `<span></span><button class="remove" type="button" aria-label="Remove">✕</button>`;
    const txt = item.querySelector("span");
    txt.textContent = schedProjectName(slug);
    txt.title = schedProjectName(slug);
    item.querySelector(".remove").addEventListener("click", () => {
      schedSelectedSlugs.splice(i, 1);
      renderSchedProjectChips();
    });
    schedProjectsList.appendChild(item);
  });
}
function addSchedProject() {
  const slug = schedProjectSel.value;
  if (!slug) return;
  if (!schedSelectedSlugs.includes(slug)) {
    schedSelectedSlugs.push(slug);
    renderSchedProjectChips();
  }
  schedErrorEl.textContent = "";
}

// Fill the day-of-month select once (1–31). The picker clamps to the real
// month length server-side, so "31" simply means "last day" in shorter months.
function populateScheduleDayOptions() {
  if (!schedDayEl || schedDayEl.options.length) return;
  for (let d = 1; d <= 31; d++) {
    const o = document.createElement("option");
    o.value = String(d);
    o.textContent = ordinal(d);
    schedDayEl.appendChild(o);
  }
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmtClockFromHHMM(time) {
  const [hh, mm] = String(time || "09:00").split(":").map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function fmtDateTime(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
// Human cadence summary for a schedule-shaped object (form values or a saved row).
function scheduleSummary(s) {
  if (s.recurrence === "once") {
    const when = fmtDateTime(s.startAt);
    return when ? `Once on ${when}` : "Once (pick a date)";
  }
  if (s.recurrence === "weekly") return `Weekly on ${WEEKDAY_NAMES[Number(s.weekday)] || "Monday"} at ${fmtClockFromHHMM(s.time)}`;
  if (s.recurrence === "monthly") return `Monthly on the ${ordinal(Number(s.day) || 1)} at ${fmtClockFromHHMM(s.time)}`;
  return `Daily at ${fmtClockFromHHMM(s.time)}`;
}

// Show only the timing fields relevant to the chosen cadence.
function applyRecurrenceVisibility() {
  const r = schedRecurrence.value;
  document.getElementById("sched-field-datetime").hidden = r !== "once";
  document.getElementById("sched-field-time").hidden     = r === "once";
  document.getElementById("sched-field-weekday").hidden  = r !== "weekly";
  document.getElementById("sched-field-day").hidden      = r !== "monthly";
  refreshScheduleHint();
}
function refreshScheduleHint() {
  schedNextHint.textContent = "Runs: " + scheduleSummary(readScheduleForm());
}

// Populate the project <select> from the already-loaded projects list. If the
// schedule being edited points at a project no longer present, keep it visible
// as a flagged option so the selection isn't silently lost.
function renderScheduleProjectSelect(selectedSlug) {
  schedProjectSel.textContent = "";
  const have = new Set();
  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) {
    const o = document.createElement("option");
    o.value = p.slug;
    o.textContent = p.name;
    schedProjectSel.appendChild(o);
    have.add(p.slug);
  }
  if (selectedSlug && have.has(selectedSlug)) schedProjectSel.value = selectedSlug;
}

function resetScheduleForm() {
  editingScheduleId = null;
  schedFormTitle.textContent = "New scheduled task";
  schedCancelEdit.hidden = true;
  schedSaveBtn.textContent = "Add schedule";
  renderScheduleProjectSelect(projects[0]?.slug || "");
  schedSelectedSlugs = [];
  schedChipNames.clear();
  renderSchedProjectChips();
  schedTitleEl.value = "";
  schedNoteEl.value = "";
  schedLinksEditor.set([]);
  schedRecurrence.value = "daily";
  schedTimeEl.value = "09:00";
  schedWeekdayEl.value = "1";
  schedDayEl.value = "1";
  schedAgentEl.value = "";
  // Default the one-off picker to ~an hour out, rounded, for a sensible start.
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  schedDateTimeEl.value = toLocalDateTimeValue(d);
  schedErrorEl.textContent = "";
  applyRecurrenceVisibility();
}
// Date → "YYYY-MM-DDTHH:MM" in local time (what <input type=datetime-local> wants).
function toLocalDateTimeValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fillScheduleForm(s) {
  editingScheduleId = s.id;
  schedFormTitle.textContent = "Edit scheduled task";
  schedCancelEdit.hidden = false;
  schedSaveBtn.textContent = "Save changes";
  renderScheduleProjectSelect(s.slug);
  // Seed the chip list from the saved schedule. projectNames (resolved
  // server-side) label any slug whose folder is no longer in the dashboard.
  schedSelectedSlugs = (Array.isArray(s.slugs) && s.slugs.length ? s.slugs : [s.slug]).filter(Boolean);
  schedChipNames.clear();
  (s.projectNames || []).forEach((nm, i) => {
    if (schedSelectedSlugs[i]) schedChipNames.set(schedSelectedSlugs[i], nm);
  });
  renderSchedProjectChips();
  schedTitleEl.value = s.title || "";
  schedNoteEl.value = s.note || "";
  schedLinksEditor.set(s.links);
  schedRecurrence.value = SCHED_RECURRENCES.has(s.recurrence) ? s.recurrence : "daily";
  schedTimeEl.value = s.time || "09:00";
  schedWeekdayEl.value = String(s.weekday ?? 1);
  schedDayEl.value = String(s.day ?? 1);
  schedAgentEl.value = s.agent === "claude" || s.agent === "codex" ? s.agent : "";
  schedDateTimeEl.value = s.startAt && Date.parse(s.startAt)
    ? toLocalDateTimeValue(new Date(s.startAt))
    : toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000));
  schedErrorEl.textContent = "";
  applyRecurrenceVisibility();
  // The editor lives below the list inside the scrollable body — bring it on
  // screen so clicking a row's Edit visibly does something.
  document.getElementById("schedule-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
const SCHED_RECURRENCES = new Set(["once", "daily", "weekly", "monthly"]);

// Gather the form into the API body shape. The one-off datetime-local value is
// passed through verbatim as startAt — the server parses it in local time.
function readScheduleForm() {
  return {
    slugs: [...schedSelectedSlugs],
    title: schedTitleEl.value.trim(),
    note: schedNoteEl.value,
    links: schedLinksEditor.get(),
    recurrence: schedRecurrence.value,
    time: schedTimeEl.value || "09:00",
    weekday: Number(schedWeekdayEl.value),
    day: Number(schedDayEl.value),
    startAt: schedDateTimeEl.value || "",
    agent: schedAgentEl.value || null,
  };
}

function renderScheduleList() {
  schedListEl.textContent = "";
  schedEmptyEl.hidden = schedules.length > 0;
  const countEl = document.getElementById("sched-count");
  if (countEl) {
    countEl.hidden = schedules.length === 0;
    countEl.textContent = schedules.length;
  }
  for (const s of schedules) {
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.dataset.id = s.id;
    if (!s.enabled) row.dataset.disabled = "true";

    // At-a-glance state: green = armed, gray = paused, red = last run failed.
    const dot = document.createElement("span");
    dot.className = "schedule-row-dot";
    dot.dataset.state = !s.enabled ? "paused" : (s.lastStatus === "error" ? "error" : "on");
    row.appendChild(dot);

    const main = document.createElement("div");
    main.className = "schedule-row-main";

    const titleLine = document.createElement("div");
    titleLine.className = "schedule-row-title";
    titleLine.textContent = s.title || "(untitled task)";
    if (!s.projectExists) {
      const warn = document.createElement("span");
      warn.className = "schedule-row-warn";
      warn.textContent = "folder missing";
      titleLine.appendChild(warn);
    }
    main.appendChild(titleLine);

    const meta = document.createElement("div");
    meta.className = "schedule-row-meta";
    const parts = [s.projectName || "—", scheduleSummary(s)];
    if (s.agent) parts.push(s.agent === "codex" ? "Codex" : "Claude");
    meta.textContent = parts.join("  •  ");
    main.appendChild(meta);

    const sub = document.createElement("div");
    sub.className = "schedule-row-sub";
    if (!s.enabled) {
      sub.textContent = s.recurrence === "once" && s.lastRunAt ? `Ran ${fmtDateTime(s.lastRunAt)}` : "Paused";
    } else if (s.nextRunAt) {
      sub.textContent = "Next run " + fmtDateTime(s.nextRunAt);
    } else {
      sub.textContent = "No upcoming run";
    }
    if (s.lastStatus === "error" && s.lastError) {
      const err = document.createElement("span");
      err.className = "schedule-row-error";
      err.textContent = "  •  last run failed: " + s.lastError;
      sub.appendChild(err);
    }
    main.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "schedule-row-actions";

    // Enable/disable switch (reuses the settings switch styling).
    const toggle = document.createElement("label");
    toggle.className = "switch";
    toggle.title = s.enabled ? "Pause" : "Resume";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!s.enabled;
    cb.setAttribute("aria-label", "Enabled");
    cb.addEventListener("change", () => toggleSchedule(s, cb.checked));
    const track = document.createElement("span");
    track.className = "switch-track";
    track.setAttribute("aria-hidden", "true");
    track.innerHTML = '<span class="switch-thumb"></span>';
    toggle.appendChild(cb);
    toggle.appendChild(track);
    actions.appendChild(toggle);

    actions.appendChild(makeSchedActionBtn("Run now", () => runScheduleNow(s), SCHED_ICON.run));
    actions.appendChild(makeSchedActionBtn("Edit", () => fillScheduleForm(s), SCHED_ICON.edit));
    const del = makeSchedActionBtn("Delete", () => deleteSchedule(s), SCHED_ICON.del);
    del.classList.add("schedule-row-del");
    actions.appendChild(del);

    row.appendChild(main);
    row.appendChild(actions);
    schedListEl.appendChild(row);
  }
}
// Inline icons for the schedule-row actions, so they share the icon+label
// language used across the rest of the app (card menu, send buttons, etc.).
const SCHED_ICON = {
  run:  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 3 14 9-14 9z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  del:  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
};
function makeSchedActionBtn(label, onClick, icon) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-ghost btn-sm";
  if (icon) {
    b.innerHTML = icon; // static, trusted markup
    const span = document.createElement("span");
    span.textContent = label;
    b.appendChild(span);
  } else {
    b.textContent = label;
  }
  b.addEventListener("click", onClick);
  return b;
}

async function loadSchedules() {
  try {
    const data = await api("/api/schedules");
    schedules = Array.isArray(data.schedules) ? data.schedules : [];
    renderScheduleList();
  } catch (err) {
    toast({ kind: "error", title: "Couldn't load schedules", sub: err.message });
  }
}

function openScheduleModal() {
  populateScheduleDayOptions();
  resetScheduleForm();
  // Show the device timezone in the Important note so "local time" is concrete.
  const tzEl = document.getElementById("sched-tz");
  if (tzEl) {
    try { tzEl.textContent = ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`; }
    catch { tzEl.textContent = ""; }
  }
  scheduleModal.style.display = "";
  scheduleModal.classList.add("is-open");
  loadSchedules();
}
function closeScheduleModal() {
  scheduleModal.classList.remove("is-open");
  scheduleModal.style.display = "none";
  editingScheduleId = null;
}

async function saveSchedule() {
  const body = readScheduleForm();
  if (!body.slugs.length) { schedErrorEl.textContent = "Add at least one project (pick one and press Add)."; return; }
  if (!body.title) { schedErrorEl.textContent = "Give the task a name."; return; }
  if (body.recurrence === "once" && !body.startAt) {
    schedErrorEl.textContent = "Pick a date and time."; return;
  }
  schedErrorEl.textContent = "";
  schedSaveBtn.disabled = true;
  try {
    const wasEditing = !!editingScheduleId;
    const path = wasEditing ? `/api/schedules/${editingScheduleId}` : "/api/schedules";
    await api(path, { method: "POST", body });
    resetScheduleForm();
    await loadSchedules();
    // Back to the top of the scrollable body so the saved row is in view.
    const body = scheduleModal.querySelector(".schedule-body");
    if (body) body.scrollTo({ top: 0, behavior: "smooth" });
    toast({ kind: "success", title: wasEditing ? "Schedule updated" : "Schedule created" });
  } catch (err) {
    schedErrorEl.textContent = err.message;
  } finally {
    schedSaveBtn.disabled = false;
  }
}

async function toggleSchedule(s, enabled) {
  try {
    await api(`/api/schedules/${s.id}`, { method: "POST", body: { enabled } });
    await loadSchedules();
  } catch (err) {
    toast({ kind: "error", title: "Couldn't update schedule", sub: err.message });
    await loadSchedules();
  }
}

async function runScheduleNow(s) {
  try {
    await api(`/api/schedules/${s.id}/run`, { method: "POST", body: {} });
    toast({ kind: "success", title: "Scheduled task sent", sub: s.title });
    await loadSchedules();
    // Surface the freshly-created task on the project card behind the modal.
    loadProjects().catch(() => {});
  } catch (err) {
    toast({ kind: "error", title: "Couldn't run task", sub: err.message });
  }
}

async function deleteSchedule(s) {
  if (!confirm(`Delete the scheduled task "${s.title}"?`)) return;
  try {
    await api(`/api/schedules/${s.id}/delete`, { method: "POST", body: {} });
    if (editingScheduleId === s.id) resetScheduleForm();
    await loadSchedules();
  } catch (err) {
    toast({ kind: "error", title: "Couldn't delete schedule", sub: err.message });
  }
}

btnSchedule?.addEventListener("click", openScheduleModal);
scheduleModal?.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) =>
  el.addEventListener("click", closeScheduleModal)
);
schedNewBtn?.addEventListener("click", () => {
  resetScheduleForm();
  document.getElementById("schedule-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
schedCancelEdit?.addEventListener("click", resetScheduleForm);
schedProjectAdd?.addEventListener("click", addSchedProject);
schedSaveBtn?.addEventListener("click", saveSchedule);
schedRecurrence?.addEventListener("change", applyRecurrenceVisibility);
[schedTimeEl, schedWeekdayEl, schedDayEl, schedDateTimeEl].forEach((el) =>
  el?.addEventListener("change", refreshScheduleHint)
);

// Heartbeat: while no task is mid-flight the 8s task poll stays off (it's only
// for live sessions), so a schedule that fires on its own would otherwise not
// appear until the next focus/interaction. This slow 45s tick — same guards as
// taskPollTick (skips when hidden / a modal is open / typing) — surfaces fired
// scheduled tasks (and the lazy staleness sweep) within a reasonable window.
setInterval(taskPollTick, 45000);

// ── Traffic-light window controls ─────────────────────────────────────────
const winApi = window.cdAPI?.window;
if (winApi) {
  document.getElementById("win-min")?.addEventListener("click",   () => winApi.minimize());
  document.getElementById("win-max")?.addEventListener("click",   () => winApi.maximize());
  document.getElementById("win-close")?.addEventListener("click", () => winApi.close());

  // Swap the green button glyph based on current window state — outward
  // triangles when windowed (will go fullscreen), inward when maximized (will
  // restore). Matches macOS exactly.
  const maxBtn  = document.getElementById("win-max");
  const icoMax  = maxBtn?.querySelector(".ico-max");
  const icoRest = maxBtn?.querySelector(".ico-restore");
  const setMaxState = (isMax) => {
    if (!icoMax || !icoRest) return;
    icoMax.hidden  = !!isMax;
    icoRest.hidden = !isMax;
    maxBtn.setAttribute("aria-label", isMax ? "Restore" : "Maximize");
  };
  winApi.isMaximized?.().then(setMaxState).catch(() => {});
  winApi.onMaximizeChanged?.(setMaxState);
}

// ── Initial load ──────────────────────────────────────────────────────────
loadProjects().catch((err) => {
  toast({ kind: "error", title: "Couldn't load projects", sub: err.message });
});
