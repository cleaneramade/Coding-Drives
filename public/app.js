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

// Publish New Release modal (only opened when a project already has an
// origin pointing at github.com, surfaced via project.githubUrl).
const relModal     = document.getElementById("modal-release");
const relTarget    = document.getElementById("rel-target");
const relTag       = document.getElementById("rel-tag");
const relTitle     = document.getElementById("rel-title");
const relAuto      = document.getElementById("rel-auto");
const relNotesWrap = document.getElementById("rel-notes-wrap");
const relNotes     = document.getElementById("rel-notes");
const relError     = document.getElementById("rel-error");
const relSubmit    = document.getElementById("rel-submit");

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

function toast({ kind = "info", title, sub, ttlMs = 4000 }) {
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
  toaster.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 220ms ease, transform 220ms ease";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 240);
  }, ttlMs);
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
    btn.innerHTML = `<span>${item.label}</span><span class="count">${item.count}</span>`;
    btn.addEventListener("click", () => setActiveStatus(item.id));
    chipRow.appendChild(btn);
  }
}

// ── Render: card grid ─────────────────────────────────────────────────────
function renderGrid() {
  // Close any open in-card menu BEFORE wiping the grid — otherwise the stale
  // card node (including its menu-view listeners) is detached but kept alive
  // by closures in dispatchCardMenuAction, leaking one subtree per re-render
  // while a menu is open.
  closeAllCardMenus();
  grid.innerHTML = "";
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

  empty.hidden = filtered.length > 0;
  for (const p of filtered) grid.appendChild(buildCard(p));
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

  el.title = name + " " + fmtPct(pct);
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
  if (list.length === 0) { row.hidden = true; return; }
  row.hidden = false;
  wrap.textContent = "";

  const visible = list.slice(0, LANG_BADGE_MAX);
  const rest = list.slice(LANG_BADGE_MAX);
  for (const l of visible) {
    wrap.appendChild(makeLangBadge(l.name, l.pct, l.color || LANG_OTHER_COLOR, ""));
  }
  if (rest.length) {
    const otherPct = rest.reduce((s, l) => s + l.pct, 0);
    const badge = makeLangBadge("Other", otherPct, LANG_OTHER_COLOR, "lang-badge-other");
    badge.title = rest.map((l) => l.name + " " + fmtPct(l.pct)).join("\n");
    wrap.appendChild(badge);
  }
}

function buildCard(p) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.slug = p.slug;
  node.dataset.status = p.status;
  node.querySelector(".card-title").textContent = p.name;

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
      chip.title = "Create new projects in " + root;
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
    if (typeof closeReleaseModal === "function") closeReleaseModal();
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
    action = `re-publish "${repo}" and create a new release (${cliName} will pick the version)`;
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

// ── Publish New Release modal ─────────────────────────────────────────────
let relProject = null;

function openReleaseModal(project) {
  relProject = project;
  relTarget.textContent = `Repo: ${project.githubUrl}`;
  relTag.value   = "";
  relTitle.value = "";
  relAuto.checked = true;
  relNotesWrap.hidden = true;
  relNotes.value = "";
  relError.textContent = "";
  relSubmit.disabled = false;
  relModal.style.display = "";
  relModal.classList.add("is-open");
}
function closeReleaseModal() {
  relModal.classList.remove("is-open");
  relModal.style.display = "none";
  relProject = null;
}
relModal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) =>
  el.addEventListener("click", closeReleaseModal)
);
relAuto.addEventListener("change", () => { relNotesWrap.hidden = relAuto.checked; });

relSubmit.addEventListener("click", async () => {
  if (!relProject) return;
  const tag = relTag.value.trim();
  if (!tag) { relError.textContent = "Tag is required (e.g., v1.0.1)."; return; }
  relSubmit.disabled = true;
  relError.textContent = "";
  try {
    const r = await api(`/api/projects/${relProject.slug}/github/release`, {
      method: "POST",
      body: {
        tag,
        title: relTitle.value.trim() || undefined,
        autoNotes: relAuto.checked,
        notes: relAuto.checked ? undefined : relNotes.value,
      },
    });
    toast({ kind: "success", title: `Released ${tag}`, sub: r.releaseUrl || relProject.githubUrl });
    closeReleaseModal();
  } catch (err) {
    relError.textContent = err.message;
    relSubmit.disabled = false;
  }
});

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
  view.querySelector('[data-action="visit-github"]').hidden = !isPublished;

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
  const lockedHeight = card.offsetHeight;
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
  else if (action === "visit-github") {
    if (project.githubUrl) window.open(project.githubUrl, "_blank", "noopener");
  }
  else if (action === "archive")        await updateStatus(project.slug, "archived");
  else if (action === "unarchive")      await updateStatus(project.slug, "in-progress");
}

// ── Search + auto-rescan ──────────────────────────────────────────────────
searchEl.addEventListener("input", (e) => {
  query = e.target.value;
  renderGrid();
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

  // Logo preview — bust cache so a freshly uploaded file shows.
  document.getElementById("set-logo-preview").src = "/api/logo?t=" + Date.now();

  // (Status / KPI color customisation removed — defaults only. Server
  // still honours any prior `statusOverrides`/`totalColor` values stored
  // in user-config.json so existing customisations keep working; "Reset
  // all to defaults" wipes them.)

  // Scan paths
  const scanHost = document.getElementById("set-scan-paths");
  scanHost.innerHTML = "";
  settingsState.scanPaths.forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "path-item";
    item.innerHTML = `<span></span><button class="remove" type="button" aria-label="Remove">✕</button>`;
    const txt = item.querySelector("span");
    txt.textContent = shortenScanPath(p);
    txt.title = p;   // full path on hover, since the badge shows the shortened path
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

// Save: build the user-config patch from the working copy.
document.getElementById("set-save").addEventListener("click", async () => {
  const enabledStackBadge =
    settingsState.showStackBadge && !settingsState._initialShowStackBadge;
  const patch = {
    backupPath: settingsState.backupPath || undefined,
    scanPaths: settingsState.scanPaths,
    excludeFolders: settingsState.excludeFolders,
    showStackBadge: !!settingsState.showStackBadge,
    showLanguageBadges: !!settingsState.showLanguageBadges,
    openClaudeInDesktop: !!settingsState.openClaudeInDesktop,
    openCodexInDesktop: !!settingsState.openCodexInDesktop,
  };
  try {
    await api("/api/config", { method: "POST", body: patch });
    closeSettings();
    await loadProjects();
    toast({
      kind: "success",
      title: "Settings saved",
      // When the stack-badge toggle flipped on, the badges came from a fresh
      // detection pass; otherwise just confirm the save. Always a one-line sub
      // so every toast reads consistently.
      sub: enabledStackBadge ? "Badges rescanned." : "Your preferences are updated.",
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
