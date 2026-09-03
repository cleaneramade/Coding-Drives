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
// Settings → "Open editor for new tasks". When on, naming a task on a card
// opens the full editor so a description / links / image can be added at once.
let openTaskEditorOnCreate = true;
// ── Card buttons (Settings → "Card buttons") ──────────────────────────────
// The full roster of tools a card action button can be. `group` drives the
// Settings editor's tabs (IDEs vs AI agents); `modes: true` marks tools that
// can open EITHER their desktop app or a terminal CLI (Claude, Codex) — that
// choice lives on the slot as mode: "app" | "cli", and the Settings shelf
// splits those tools into two pills (Claude App / Claude CLI) so the mode is
// picked up front rather than toggled afterwards. Cards are repainted from
// this map on every rebuild, so the template's baked-in buttons are just
// skeletons.
const VENDOR_TOOLS = {
  vscode: {
    label: "VS Code",
    cls: "vendor-vscode",
    group: "ide",
    // Official VS Code wedge (Microsoft).
    svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M70.9119 99.3171C72.4869 99.9307 74.2828 99.8914 75.8725 99.1264L96.4608 89.2197C98.6242 88.1787 100 85.9892 100 83.5872V16.4133C100 14.0113 98.6243 11.8218 96.4609 10.7808L75.8725 0.873756C73.7862 -0.130129 71.3446 0.11576 69.5135 1.44695C69.252 1.63711 69.0028 1.84943 68.769 2.08341L29.3551 38.0415L12.1872 25.0096C10.589 23.7965 8.35363 23.8959 6.86933 25.2461L1.36303 30.2549C-0.452552 31.9064 -0.454633 34.7627 1.35853 36.417L16.2471 50.0001L1.35853 63.5832C-0.454633 65.2374 -0.452552 68.0938 1.36303 69.7453L6.86933 74.7541C8.35363 76.1043 10.589 76.2037 12.1872 74.9905L29.3551 61.9587L68.769 97.9167C69.3925 98.5406 70.1246 99.0104 70.8511 99.3171ZM75.0152 27.2989L45.1091 50.0001L75.0152 72.7012V27.2989Z"/></svg>',
  },
  cursor: {
    label: "Cursor",
    cls: "vendor-cursor",
    group: "ide",
    // Official Cursor mark (Anysphere) — via simple-icons.
    svg: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true"><path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"/></svg>',
  },
  antigravity: {
    label: "Antigravity",
    cls: "vendor-antigravity",
    group: "ide",
    // Official Google Antigravity mark — via lobehub's brand-icon set
    // (matches svgl's copy of the same logo).
    svg: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M21.751 22.607c1.34 1.005 3.35.335 1.508-1.508C17.73 15.74 18.904 1 12.037 1 5.17 1 6.342 15.74.815 21.1c-2.01 2.009.167 2.511 1.507 1.506 5.192-3.517 4.857-9.714 9.715-9.714 4.857 0 4.522 6.197 9.714 9.715z"/></svg>',
  },
  claude: {
    label: "Claude Code",
    // Shelf name for the App / CLI pair — "Claude Code CLI" is a mouthful and
    // overflows the pill; the card button keeps the full label.
    short: "Claude",
    cls: "vendor-claude",
    group: "ai",
    modes: true,
    // Official Claude Code mark (Anthropic).
    svg: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path clip-rule="evenodd" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"/></svg>',
  },
  codex: {
    label: "Codex",
    cls: "vendor-codex",
    group: "ai",
    modes: true,
    // Official OpenAI / ChatGPT mark.
    svg: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true"><path d="M9.20509 8.76511V6.50545C9.20509 6.31513 9.27649 6.17234 9.44293 6.0773L13.9861 3.46088C14.6046 3.10413 15.342 2.93769 16.103 2.93769C18.9573 2.93769 20.7651 5.14983 20.7651 7.50454C20.7651 7.67098 20.7651 7.86129 20.7412 8.05161L16.0316 5.2924C15.7462 5.12596 15.4607 5.12596 15.1753 5.2924L9.20509 8.76511ZM19.8135 17.5659V12.1664C19.8135 11.8333 19.6708 11.5955 19.3854 11.429L13.4152 7.95633L15.3656 6.83833C15.5321 6.74328 15.6749 6.74328 15.8413 6.83833L20.3845 9.45474C21.6928 10.216 22.5728 11.8333 22.5728 13.4031C22.5728 15.2108 21.5025 16.8758 19.8135 17.5657V17.5659ZM7.80173 12.8088L5.8513 11.6671C5.68486 11.5721 5.61346 11.4293 5.61346 11.239V6.00613C5.61346 3.46111 7.56389 1.53433 10.2042 1.53433C11.2033 1.53433 12.1307 1.86743 12.9159 2.46202L8.2301 5.17371C7.94475 5.34015 7.80195 5.57798 7.80195 5.91109V12.809L7.80173 12.8088ZM12 15.2349L9.20509 13.6651V10.3351L12 8.76534L14.7947 10.3351V13.6651L12 15.2349ZM13.7958 22.4659C12.7967 22.4659 11.8693 22.1328 11.0841 21.5382L15.7699 18.8265C16.0553 18.6601 16.198 18.4222 16.198 18.0891V11.1912L18.1723 12.3329C18.3388 12.4279 18.4102 12.5707 18.4102 12.761V17.9939C18.4102 20.5389 16.4359 22.4657 13.7958 22.4657V22.4659ZM8.15848 17.1617L3.61528 14.5452C2.30696 13.784 1.42701 12.1667 1.42701 10.5969C1.42701 8.76534 2.52115 7.12414 4.20987 6.43428V11.8574C4.20987 12.1905 4.35266 12.4284 4.63802 12.5948L10.5846 16.0436L8.63415 17.1617C8.46771 17.2567 8.32492 17.2567 8.15848 17.1617ZM7.897 21.0625C5.20919 21.0625 3.23488 19.0407 3.23488 16.5432C3.23488 16.3529 3.25875 16.1626 3.2824 15.9723L7.96817 18.6839C8.25352 18.8504 8.53911 18.8504 8.82446 18.6839L14.7947 15.2351V17.4948C14.7947 17.6851 14.7233 17.8279 14.5568 17.9229L10.0136 20.5393C9.39518 20.8961 8.6578 21.0625 7.89677 21.0625H7.897ZM13.7958 23.8929C16.6739 23.8929 19.0762 21.8474 19.6235 19.1357C22.2874 18.4459 24 15.9484 24 13.4034C24 11.7383 23.2865 10.121 22.002 8.95542C22.121 8.45588 22.1924 7.95633 22.1924 7.45702C22.1924 4.0557 19.4331 1.51045 16.2458 1.51045C15.6037 1.51045 14.9852 1.60549 14.3668 1.81968C13.2963 0.773071 11.8215 0.107086 10.2042 0.107086C7.32606 0.107086 4.92383 2.15256 4.37653 4.86425C1.7126 5.55411 0 8.05161 0 10.5966C0 12.2617 0.713506 13.879 1.99795 15.0446C1.87904 15.5441 1.80764 16.0436 1.80764 16.543C1.80764 19.9443 4.56685 22.4895 7.75421 22.4895C8.39632 22.4895 9.01478 22.3945 9.63324 22.1803C10.7035 23.2269 12.1783 23.8929 13.7958 23.8929Z"/></svg>',
  },
  gemini: {
    label: "Gemini",
    cls: "vendor-gemini",
    group: "ai",
    // Official Google Gemini spark — via simple-icons.
    svg: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/></svg>',
  },
};
// The three card slots: { tool, mode? }, mode only on two-mode tools. The
// defaults mirror what the app always shipped: VS Code, Claude CLI, Codex CLI.
const DEFAULT_CARD_BUTTONS = [{ tool: "vscode" }, { tool: "claude", mode: "cli" }, { tool: "codex", mode: "cli" }];
function sanitizeCardButtons(list) {
  return DEFAULT_CARD_BUTTONS.map((fallback, i) => {
    const e = Array.isArray(list) && list[i] && VENDOR_TOOLS[list[i].tool] ? list[i] : fallback;
    return VENDOR_TOOLS[e.tool].modes
      ? { tool: e.tool, mode: e.mode === "app" ? "app" : "cli" }
      : { tool: e.tool };
  });
}
// Live value the grid paints from. Round-trips via /api/projects.
let cardButtons = sanitizeCardButtons(null);
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
// What the colour picker calls each token. The token names are design-system
// internals — "brand", "muted", "archived" tell a reader nothing about what
// they will see, so the dropdown shows the colour instead.
const STATUS_COLOR_LABELS = {
  brand:    "Violet",
  success:  "Green",
  warning:  "Yellow",
  danger:   "Red",
  info:     "Blue",
  muted:    "Grey",
  archived: "Faded grey",
};
function statusColorLabel(color) {
  // A legacy hex has no name worth printing, and the swatch beside the picker
  // already shows exactly which colour it is.
  return STATUS_COLOR_LABELS[color] || "Custom colour";
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

// Cap the stack so a burst (several sessions ending at once) can't paper over
// the app. Oldest goes first.
const TOAST_MAX = 4;
function toast({ kind = "info", title, sub, ttlMs = 4000, action }) {
  const el = document.createElement("div");
  el.className = "toast";
  el.dataset.kind = kind;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  const iconSvg = TOAST_ICONS[kind] || TOAST_ICONS.info;
  el.innerHTML = `
    <div class="toast-icon" aria-hidden="true">${iconSvg}</div>
    <div class="toast-body">
      <div class="t-title"></div>
      ${sub ? '<div class="t-sub"></div>' : ''}
    </div>
    <button class="toast-close" type="button" aria-label="Dismiss">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 6 12 12M6 18 18 6"/></svg>
    </button>
    <span class="toast-timer" aria-hidden="true"><i style="animation-duration:${ttlMs}ms"></i></span>
  `;
  el.querySelector(".t-title").textContent = title;
  if (sub) el.querySelector(".t-sub").textContent = sub;
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 240);
  };
  el.querySelector(".toast-close").addEventListener("click", () => { clearTimeout(timer); dismiss(); });
  // Hovering pauses the countdown — a toast you're reading shouldn't vanish.
  el.addEventListener("mouseenter", () => { clearTimeout(timer); el.classList.add("is-held"); });
  el.addEventListener("mouseleave", () => { el.classList.remove("is-held"); timer = setTimeout(dismiss, 1600); });
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
  while (toaster.children.length > TOAST_MAX) toaster.firstElementChild.remove();
  let timer = setTimeout(dismiss, ttlMs);
  return el;
}

// ── Background event toasts ───────────────────────────────────────────────
// The server queues anything that finishes while nobody is watching (a task
// reporting back, a session exiting, a schedule firing). Each event is shown
// exactly once: we remember the highest seq we've toasted, and the first load
// only records the high-water mark so opening the app doesn't replay history.
let lastEventSeq = -1;
function drainEvents(events) {
  if (!Array.isArray(events)) return;
  const highest = events.reduce((m, e) => Math.max(m, e.seq || 0), 0);
  if (lastEventSeq < 0) { lastEventSeq = highest; return; }   // first load
  const fresh = events.filter((e) => (e.seq || 0) > lastEventSeq);
  lastEventSeq = Math.max(lastEventSeq, highest);
  for (const e of fresh.slice(-TOAST_MAX)) {
    toast({ kind: e.kind || "info", title: e.title, sub: e.sub || undefined, ttlMs: 7000 });
  }
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
  openTaskEditorOnCreate = data.openTaskEditorOnCreate !== false;
  cardButtons = sanitizeCardButtons(data.cardButtons);
  projectOrders = data.projectOrders || {};
  drainEvents(data.events);
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

// Most recent of: an edit made inside the app, the project being opened from
// its card, and the folder's own mtime. Used to order each status group on the
// All page.
function lastTouched(p) {
  const t = (iso) => { const n = Date.parse(iso || ""); return Number.isFinite(n) ? n : 0; };
  return Math.max(t(p.updatedAt), t(p.lastOpenedAt), Number(p.mtime) || 0);
}

// ── Render: card grid ─────────────────────────────────────────────────────
// A poll / focus refresh landing mid-drag used to rebuild every card, which
// detached the element under the cursor and silently killed the drag. Defer
// the rebuild until the card is dropped instead.
let pendingGridRender = false;
function renderGrid() {
  // A press that is about to become a drag counts too: an 8s poll landing in
  // the 260ms between mouse-down and the drag arming used to swap the card
  // node out from under the cursor, and the drag then died silently.
  if (cardDrag || cardPress) { pendingGridRender = true; return; }

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
  if (activeStatus === "all") {
    // The All page organises ITSELF: status groups in the order the status
    // chips are configured (In Progress, then On Hold, then Done, …), and
    // inside each group the most recently worked-on project first. "Worked on"
    // is the latest of three signals — an edit made in the app, opening the
    // project from its card, and the folder's own modified time — so a project
    // you touched in your editor five minutes ago outranks one you last opened
    // in the app last week.
    //
    // Per-status pages keep their hand-arranged order; that's where dragging
    // lives. Pinned cards still come first everywhere.
    const rank = new Map(statuses.map((st, i) => [st.id, i]));
    filtered.sort((a, b) =>
      ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) ||
      ((rank.has(a.status) ? rank.get(a.status) : 99) -
       (rank.has(b.status) ? rank.get(b.status) : 99)) ||
      (lastTouched(b) - lastTouched(a))
    );
  } else {
    const pos = new Map((projectOrders[activeStatus] || []).map((s, i) => [s, i]));
    // Pinned projects always float above everything else while keeping their
    // relative drag order among themselves.
    filtered.sort((a, b) =>
      ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) ||
      ((pos.has(a.slug) ? pos.get(a.slug) : -1) -
       (pos.has(b.slug) ? pos.get(b.slug) : -1))
    );
  }

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
// Cards are laid out in N independent flex columns. Reading order stays
// roughly row-major (cards 1, 2, 3 across the top) but each column stacks on
// its own: a card growing — tasks shown, added, expanded — only pushes ITS
// column down, never reshuffling neighbours, and every column ends at its own
// natural y.
//
// Placement is HEIGHT-BALANCED, not round-robin. Round-robin handed every
// Nth card to the same column regardless of how tall it was, so a column that
// happened to collect the task-heavy cards ran hundreds of pixels past the
// others — the "one long column with dead space to the right" problem. Each
// card now goes to whichever column is currently SHORTEST (ties break left,
// so the first row still reads 1-2-3), which keeps the bottom edge level.
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

// Heights are cached on the element so a re-bucket mid-drag (which happens on
// every insertion change) doesn't force a fresh measurement of every card.
function cardHeightOf(el) {
  const h = el.offsetHeight;
  if (h > 0) el._cdHeight = h;
  return el._cdHeight || h || 0;
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

  // Pass 1 — drop every card into the DOM round-robin. This exists only so
  // the cards are laid out at their final column width and can be measured;
  // it is never what the user ends up seeing when there is more than one
  // column of cards.
  cardEls.forEach((el, i) => cols[i % masonryCols].appendChild(el));
  if (masonryCols < 2 || cardEls.length <= masonryCols) {
    requestAnimationFrame(syncAllTaskListFades);
    return;
  }

  // Pass 2 — measure, then greedily re-home each card into whichever column
  // is currently SHORTEST. All the reads happen before all the writes, so
  // this costs one layout flush, not one per card.
  const heights = cardEls.map(cardHeightOf);
  const filled = new Array(masonryCols).fill(0);
  cardEls.forEach((el, i) => {
    let best = 0;
    for (let c = 1; c < masonryCols; c++) {
      // "Shorter by more than a hair" keeps ties on the leftmost column, so
      // an all-equal grid still fills 1-2-3 across the first row.
      if (filled[c] < filled[best] - 0.5) best = c;
    }
    // appendChild MOVES the node when it is already in another column, and
    // because we walk cardEls in linear order every column ends up holding
    // its own cards in reading order.
    cols[best].appendChild(el);
    filled[best] += heights[i] + MASONRY_GAP;
  });
  // The cards now have real boxes — settle every scrollable task list's edge
  // fades against their actual heights.
  requestAnimationFrame(syncAllTaskListFades);
}

// Phone-home-screen push-over: FLIP-animate every card from its old spot to
// its new one whenever the order changes mid-drag. Elements in `skip` (the
// floating card, if any) are left alone.
function rebucketWithFlip(cardEls, skip) {
  const skipSet = skip instanceof Set ? skip : new Set(skip ? [skip] : []);
  // First rects = current VISUAL positions (in-flight transforms included),
  // so an interrupted push-over continues from exactly where it is.
  const first = new Map(cardEls.map((c) => [c, c.getBoundingClientRect()]));
  bucketCards(cardEls);
  // Settle every non-skipped card to its raw layout slot before measuring
  // destinations — leftover mid-animation transforms would otherwise pollute
  // the destination rects and make cards visibly jump / overshoot.
  for (const c of cardEls) {
    if (skipSet.has(c)) continue;
    c.style.transition = "none";
    c.style.transform = "";
  }
  void grid.offsetWidth; // one reflow: clean layout to measure against
  const moving = [];
  for (const c of cardEls) {
    if (skipSet.has(c)) continue;
    const f = first.get(c);
    const l = c.getBoundingClientRect();
    const dx = f.left - l.left;
    const dy = f.top - l.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    c.style.transform = `translate(${dx}px, ${dy}px)`;
    moving.push(c);
  }
  void grid.offsetWidth; // one reflow: commit all start positions
  const flipMs = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260;
  for (const c of moving) {
    if (!flipMs) { c.style.transform = ""; continue; }
    c.style.transition = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
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
  if (cardDrag) return;                       // never reshuffle mid-drag
  if (gridColumnCount() === masonryCols) return;
  bucketCards(gridCardOrder.filter((el) => el.isConnected));
});

// ── Drag-to-rearrange project cards ───────────────────────────────────────
// Pointer-driven, phone-home-screen style. The pressed card lifts out of the
// flow into a fixed-position "floater" that tracks the cursor 1:1, and a
// same-size placeholder takes its slot in the grid. Moving the cursor over
// another card decides BEFORE or AFTER it (which half of the card the cursor
// is in), the placeholder re-slots there, and every other card FLIPs into its
// new home — so the layout you see mid-drag is exactly the layout you get.
//
// Native HTML5 drag used to do this and had three problems:
//   * the drop target was picked by "which card index am I over" — a swap,
//     not an insert, so crossing into another row moved things you didn't aim
//     at;
//   * a 120 ms anti-oscillation throttle made it feel laggy and sometimes
//     swallowed a deliberate move;
//   * releasing anywhere Windows considered a non-target played the slow
//     "ghost flies home" animation.
// None of that applies to a pointer-driven drag.
const CARD_DRAG_THRESHOLD = 7;   // px of travel before a press becomes a drag
const CARD_DRAG_HOLD_MS   = 260; // press-and-hold also arms the drag
const CARD_EDGE_SCROLL    = 90;  // px band at the viewport edge that autoscrolls

let cardPress = null;   // { el, project, pointerId, startX, startY, holdTimer }
let lastAllDragHintAt = 0;
let cardDrag  = null;   // live drag state

// Anything the user can click inside a card must NOT start a drag.
const NO_DRAG_SELECTOR =
  "button, a, input, textarea, select, label, .card-tasks, .card-menu-view, .card-path, .status-picker, [contenteditable]";

grid.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || cardDrag) return;
  const el = e.target instanceof Element ? e.target.closest(".card") : null;
  if (!el || el.dataset.menu === "open") return;
  if (e.target instanceof Element && e.target.closest(NO_DRAG_SELECTOR)) return;
  const project = projects.find((p) => p.slug === el.dataset.slug);
  if (!project) return;
  if (activeStatus === "all") {
    // All sorts itself; a drag here would snap straight back on the next
    // render, which reads as the grid fighting you. Say why, once per press,
    // and point at the two things that DO work here.
    if (Date.now() - lastAllDragHintAt > 8000) {
      lastAllDragHintAt = Date.now();
      toast({
        kind: "info",
        title: "All arranges itself",
        sub: "Sorted by status, then most recently worked on. Pin a card, or open a status tab to arrange by hand.",
        ttlMs: 5000,
      });
    }
    return;
  }
  cardPress = {
    el, project, slug: el.dataset.slug,
    pointerId: e.pointerId,
    startX: e.clientX, startY: e.clientY,
    holdTimer: setTimeout(() => {
      if (cardPress && !cardDrag) beginCardDrag(cardPress.startX, cardPress.startY);
    }, CARD_DRAG_HOLD_MS),
  };
});

function cancelCardPress() {
  if (!cardPress) return;
  clearTimeout(cardPress.holdTimer);
  cardPress = null;
  if (pendingGridRender) { pendingGridRender = false; renderGrid(); }
}

window.addEventListener("pointermove", (e) => {
  if (cardDrag) { onCardDragMove(e.clientX, e.clientY); return; }
  if (!cardPress || e.pointerId !== cardPress.pointerId) return;
  if (Math.hypot(e.clientX - cardPress.startX, e.clientY - cardPress.startY) < CARD_DRAG_THRESHOLD) return;
  beginCardDrag(e.clientX, e.clientY);
  onCardDragMove(e.clientX, e.clientY);
});

window.addEventListener("pointerup", () => {
  if (cardDrag) endCardDrag();
  else cancelCardPress();
});
window.addEventListener("pointercancel", () => {
  if (cardDrag) endCardDrag();
  else cancelCardPress();
});
// Escape aborts a drag and puts the card back where it started.
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && cardDrag) endCardDrag({ cancel: true });
});
// Alt-tabbing (or releasing the button outside the window) never delivers a
// pointerup, which would otherwise strand the floating card mid-air with the
// grid stuck in drag mode. Treat losing the window as a drop where it is.
window.addEventListener("blur", () => {
  if (cardDrag) endCardDrag();
  else cancelCardPress();
});

function beginCardDrag(x, y) {
  const press = cardPress;
  if (!press) return;
  clearTimeout(press.holdTimer);
  cardPress = null;

  // The grid may have been rebuilt between mouse-down and here (a poll that
  // slipped through, a status change). Re-resolve the card by slug so the
  // drag still starts on the live node instead of dying on a detached one.
  let el = press.el;
  if (!el.isConnected || gridCardOrder.indexOf(el) === -1) {
    const fresh = grid.querySelector(`.card[data-slug="${CSS.escape(press.slug)}"]`);
    if (fresh) el = fresh;
  }
  const rect = el.getBoundingClientRect();
  const index = gridCardOrder.indexOf(el);
  if (index === -1) return;

  // Placeholder holds the slot so the rest of the grid keeps a real gap to
  // push around — exactly the hole a phone home screen leaves behind.
  const ph = document.createElement("div");
  ph.className = "card-placeholder";
  ph.style.height = `${rect.height}px`;
  ph._cdHeight = rect.height;

  const order = [...gridCardOrder];
  order[index] = ph;

  // Lift the card out of the flow. Fixed positioning means grid reflows
  // beneath it can never tug it around.
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.position = "fixed";
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.margin = "0";
  el.style.zIndex = "60";
  el.style.pointerEvents = "none";
  el.classList.add("card-dragging");
  document.body.appendChild(el);
  document.body.classList.add("is-card-dragging");

  cardDrag = {
    el, ph,
    project: press.project,
    grabX: x - rect.left,
    grabY: y - rect.top,
    w: rect.width, h: rect.height,
    baseLeft: rect.left, baseTop: rect.top,
    lastX: x, lastY: y,
    lastSlotAt: 0,
    startOrder: [...gridCardOrder],
    startIndex: index,
    rafId: 0,
    scrollRaf: 0,
    scrollDy: 0,
    moved: false,
  };

  rebucketWithFlip(order, el);
  positionFloater(x, y);
}

function positionFloater(x, y) {
  const d = cardDrag;
  if (!d) return;
  // Clamp so the card can never be flung fully off-screen and lost.
  const left = Math.max(-d.w * 0.4, Math.min(window.innerWidth - d.w * 0.6, x - d.grabX));
  const top  = Math.max(-d.h * 0.4, Math.min(window.innerHeight - 48, y - d.grabY));
  d.el.style.transform = `translate(${left - d.baseLeft}px, ${top - d.baseTop}px) scale(1.02)`;
}

function onCardDragMove(x, y) {
  const d = cardDrag;
  if (!d) return;
  d.lastX = x; d.lastY = y;
  d.moved = true;
  positionFloater(x, y);
  edgeAutoScroll(y);
  // Time-throttled rather than rAF-throttled on purpose: rAF is suspended
  // whenever Chromium considers the window occluded, and a drag that stops
  // re-slotting because another window is overlapping ours is exactly the
  // kind of "it just doesn't work" the reorder used to suffer from. The
  // expensive part (rebucketWithFlip) only runs when the slot really moves.
  const now = performance.now();
  if (now - d.lastSlotAt < 24) return;
  d.lastSlotAt = now;
  updateCardDropSlot(x, y);
}

// Auto-scroll the page while the cursor sits near the top/bottom edge, so a
// long grid can be reordered without letting go.
function edgeAutoScroll(y) {
  const d = cardDrag;
  if (!d) return;
  const scroller = document.scrollingElement || document.documentElement;
  let dy = 0;
  if (y < CARD_EDGE_SCROLL) dy = -Math.ceil((CARD_EDGE_SCROLL - y) / 6);
  else if (y > window.innerHeight - CARD_EDGE_SCROLL) dy = Math.ceil((y - (window.innerHeight - CARD_EDGE_SCROLL)) / 6);
  d.scrollDy = dy;
  if (!dy || d.scrollRaf) return;
  const step = () => {
    if (!cardDrag || !cardDrag.scrollDy) { if (cardDrag) cardDrag.scrollRaf = 0; return; }
    scroller.scrollTop += cardDrag.scrollDy;
    updateCardDropSlot(cardDrag.lastX, cardDrag.lastY);
    cardDrag.scrollRaf = requestAnimationFrame(step);
  };
  d.scrollRaf = requestAnimationFrame(step);
}

// Where would the card land if the user let go right now?
//
// Rules, in order:
//  1. Over a card → BEFORE it if the cursor is in its top half, AFTER it if
//     in the bottom half. That's insert-not-swap, and it's what makes
//     crossing into a different row predictable: you always aim at a seam
//     between two cards, never at a card's index.
//  2. Below the last card of a column (the dead space at the bottom of a
//     short column) → after that column's last card.
//  3. Nothing under the cursor at all (well outside the grid) → leave the
//     slot where it is, so a wobble off the edge doesn't fling the card away.
function updateCardDropSlot(x, y) {
  const d = cardDrag;
  if (!d) return;
  const order = gridCardOrder;
  const target = cardUnderPoint(x, y, d.ph);
  if (!target || target.el === d.ph) return;

  const r = target.el.getBoundingClientRect();
  const after = target.forceAfter === true
    ? true
    : target.forceAfter === false
      ? false
      : y > r.top + r.height / 2;

  const from = order.indexOf(d.ph);
  let to = order.indexOf(target.el);
  if (from === -1 || to === -1) return;
  if (after) to += 1;
  if (from < to) to -= 1;          // account for pulling the placeholder out
  if (to === from) return;

  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, d.ph);
  rebucketWithFlip(next, d.el);
}

// Nearest drop reference for a point. Returns { el, forceAfter } where el is
// a card (or the placeholder) already in the grid. forceAfter === undefined
// means "decide by which half of the card the cursor is in".
function cardUnderPoint(x, y, ph) {
  const cols = [...grid.querySelectorAll(".masonry-col")];
  if (!cols.length) return null;

  // Way off to the side of the whole grid — ignore, don't yank the card.
  const gridRect = grid.getBoundingClientRect();
  if (x < gridRect.left - 120 || x > gridRect.right + 120) return null;

  // Pick the column horizontally: the one containing x, else the closest.
  let col = null;
  let colDist = Infinity;
  for (const c of cols) {
    const r = c.getBoundingClientRect();
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    if (dx < colDist) { colDist = dx; col = c; }
  }
  if (!col) return null;

  const items = [...col.children];
  if (!items.length) {
    // Empty column (fewer cards than columns): aim at the end of the nearest
    // non-empty column to its left, else the start of the one to its right.
    const idx = cols.indexOf(col);
    for (let i = idx - 1; i >= 0; i--) {
      const prev = cols[i].children;
      if (prev.length) return { el: prev[prev.length - 1], forceAfter: true };
    }
    for (let i = idx + 1; i < cols.length; i++) {
      const nxt = cols[i].children;
      if (nxt.length) return { el: nxt[0], forceAfter: false };
    }
    return null;
  }

  const last = items[items.length - 1];
  if (y > last.getBoundingClientRect().bottom) {
    return last === ph ? null : { el: last, forceAfter: true };
  }
  const firstEl = items[0];
  if (y < firstEl.getBoundingClientRect().top) {
    return firstEl === ph ? null : { el: firstEl, forceAfter: false };
  }

  // Nearest item by vertical distance — and the PLACEHOLDER is a candidate
  // like any other. That single detail is what stops the layout oscillating:
  // once the hole sits under the cursor, the nearest item is the hole itself
  // and nothing moves until the cursor travels onto a different card. Skipping
  // it instead (the old behaviour) made the card below the hole the target,
  // which pushed the hole away, which made the first card the target again —
  // a loop that landed the card wherever the last frame happened to fall.
  let best = null;
  let bestDist = Infinity;
  for (const el of items) {
    const r = el.getBoundingClientRect();
    const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    if (dy < bestDist) { bestDist = dy; best = el; }
  }
  if (!best || best === ph) return null;
  return { el: best };
}

function endCardDrag({ cancel = false } = {}) {
  const d = cardDrag;
  if (!d) return;
  cardDrag = null;
  if (d.rafId) cancelAnimationFrame(d.rafId);
  if (d.scrollRaf) cancelAnimationFrame(d.scrollRaf);
  d.scrollDy = 0;
  document.body.classList.remove("is-card-dragging");

  if (cancel) {
    const order = [...d.startOrder];
    order[d.startIndex] = d.ph;
    bucketCards(order);
  }

  // Fly the floater home to the placeholder's slot, then swap them.
  const target = d.ph.getBoundingClientRect();
  const settle = () => {
    const final = gridCardOrder.map((el) => (el === d.ph ? d.el : el));
    d.ph.replaceWith(d.el);
    gridCardOrder = final;
    d.el.classList.remove("card-dragging");
    for (const k of ["width", "height", "position", "left", "top", "margin", "zIndex", "pointerEvents", "transition", "transform"]) {
      d.el.style[k] = "";
    }
    if (!cancel) finishCardDrag();
    if (pendingGridRender) { pendingGridRender = false; renderGrid(); }
  };

  if (!d.moved) { settle(); return; }
  d.el.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
  d.el.style.transform = `translate(${target.left - d.baseLeft}px, ${target.top - d.baseTop}px) scale(1)`;
  let done = false;
  const finish = () => { if (done) return; done = true; settle(); };
  d.el.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 320);
}

async function finishCardDrag() {
  // Persist into the ACTIVE filter's order only — every page arranges
  // independently. Visible slugs re-slot into their existing positions
  // within this page's list (search may be hiding some members).
  const orderKey = activeStatus;
  const visibleSlugs = gridCardOrder
    .filter((el) => el.isConnected && el.dataset && el.dataset.slug)
    .map((el) => el.dataset.slug);
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

// While a task row is being dragged the whole window stays a valid drop zone
// (task rows still use native HTML5 drag). Without this the cursor flashes ⊘
// over the topbar/background and Windows plays the "ghost flies back" bounce.
document.addEventListener("dragover", (e) => {
  if (!document.querySelector(".task-item.dragging")) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
});
document.addEventListener("drop", (e) => {
  if (!document.querySelector(".task-item.dragging")) return;
  e.preventDefault();
});

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
// Rendered into the card's .card-tasks section as two clearly separate
// things: the TO-DO list (anything not complete) and the COMPLETED history.
//
// Collapsed, a card shows EVERY open task — past TASK_VISIBLE_MAX rows the
// list itself scrolls, so the card keeps a sane footprint while still letting
// you flick through the whole to-do list for a quick reference. The expander
// then only controls the completed history, which lands under its own
// "Completed" divider so finished work is never mixed into the to-dos.
// Expansion survives re-renders via expandedTaskCards.
const TASK_VISIBLE_MAX = 5;
const expandedTaskCards = new Set(); // slugs whose full task list is expanded
// Slugs whose completed block should animate in on the NEXT render only —
// set by the expander click, cleared as soon as it's used, so a background
// poll repaint never replays the animation.
const revealTaskCards = new Set();

// Show a fade only on the edge that actually has more content past it, and
// cross-fade it in and out. A permanently-on bottom gradient (what a static
// mask-image gives you) sits there fading the last row even when the list is
// already at the end, which is what made the collapsed list look cheap.
// Called after the grid is populated, because renderTasks itself runs while
// the card is still DETACHED (buildCard assembles it, bucketCards appends it),
// where every height reads 0. Measuring there left the bottom fade off, so a
// scrollable to-do list gave no "more below" cue until you happened to scroll
// it. This is the first moment the rows have a real box.
function syncAllTaskListFades() {
  for (const frame of grid.querySelectorAll(".task-list-frame")) {
    const list = frame.querySelector(".task-list");
    if (list) syncTaskListFades(list, frame);
  }
}

function syncTaskListFades(list, frame) {
  const max = list.scrollHeight - list.clientHeight;
  const scrollable = max > 2;
  frame.dataset.fadeTop = scrollable && list.scrollTop > 2 ? "on" : "off";
  frame.dataset.fadeBottom = scrollable && list.scrollTop < max - 2 ? "on" : "off";
}

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
  // Never swap a card node out from under a live drag — the floater IS a card
  // node, and replacing it would drop the drag on the floor.
  if (cardDrag || cardPress) { pendingGridRender = true; return null; }
  const project = projects.find((x) => x.slug === slug);
  const cardEl = grid.querySelector(`.card[data-slug="${CSS.escape(slug)}"]`);
  if (!project || !cardEl) { renderGrid(); return null; }
  const fresh = buildCard(project);
  // Keep the linear-order array pointing at the live node.
  const orderIdx = gridCardOrder.indexOf(cardEl);
  if (orderIdx !== -1) gridCardOrder[orderIdx] = fresh;
  cardEl.replaceWith(fresh);
  requestAnimationFrame(syncAllTaskListFades);
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

  // Rows. COLLAPSED shows every open (to-do) task — the list itself scrolls
  // once it gets long, so a card with 20 to-dos stays card-sized but you can
  // still flick through all of them without expanding. EXPANDED adds the
  // completed history underneath its own divider, so the to-do list is never
  // mixed in with what's already finished.
  list.textContent = "";
  for (const t of open) list.appendChild(buildTaskRow(p, t));
  // Completed history reads newest-first: the thing you finished a minute ago
  // is the one you want to see, not the one from six weeks ago. Falls back
  // through reportedAt → updatedAt → createdAt so a row missing a timestamp
  // still lands somewhere sensible instead of jumping to the top.
  const doneAt = (t) => {
    for (const k of ["reportedAt", "updatedAt", "createdAt"]) {
      const n = Date.parse(t[k] || "");
      if (Number.isFinite(n)) return n;
    }
    return 0;
  };
  done.sort((a, b) => doneAt(b) - doneAt(a));
  if (expanded && done.length) {
    const sep = document.createElement("li");
    sep.className = "task-group-sep";
    sep.setAttribute("role", "presentation");
    sep.innerHTML = `<span>Completed</span><span class="task-group-count">${done.length}</span>`;
    list.appendChild(sep);
    for (const t of done) list.appendChild(buildTaskRow(p, t));
  }
  list.hidden = open.length === 0 && !(expanded && done.length);
  // Only the collapsed to-do list is height-capped; expanded shows everything.
  const scrolls = !expanded && open.length > TASK_VISIBLE_MAX;
  list.classList.toggle("task-list-scroll", scrolls);
  const frame = list.closest(".task-list-frame");
  if (frame) {
    frame.hidden = list.hidden;
    // renderTasks runs while the card is still DETACHED (buildCard assembles it
    // before bucketCards appends it), so every height here reads 0 and the
    // fades would start off — no "more below" cue until the user happened to
    // scroll. Measure again on the next frame, once the card is really in the
    // grid.
    if (!list._cdFadeBound) {
      list._cdFadeBound = true;
      list.addEventListener("scroll", () => syncTaskListFades(list, frame), { passive: true });
    }
  }
  // Rows revealed by expanding get a short staggered rise. Only on the pass
  // that follows the click — a poll repaint mustn't re-run the animation and
  // make an idle card twitch every 8 seconds.
  if (expanded && done.length && revealTaskCards.has(p.slug)) {
    revealTaskCards.delete(p.slug);
    const revealed = [...list.children].slice(open.length);
    revealed.forEach((el, i) => {
      el.classList.add("task-revealing");
      el.style.animationDelay = `${Math.min(i, 8) * 26}ms`;
      el.addEventListener("animationend", () => {
        el.classList.remove("task-revealing");
        el.style.animationDelay = "";
      }, { once: true });
    });
  }

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
  const hiddenCount = done.length;
  if (hiddenCount === 0) expandedTaskCards.delete(p.slug);
  if (expanded && hiddenCount > 0) {
    more.hidden = false;
    more.classList.add("expanded");
    more.innerHTML = `<span>Show less</span>${TASK_CHEVRON_SVG}`;
    more.setAttribute("aria-expanded", "true");
    more.onclick = () => {
      // Fade the completed block out before the card rebuilds, so collapsing
      // is a movement rather than rows blinking out of existence.
      const rows = [...list.children].slice(open.length);
      if (!rows.length) { expandedTaskCards.delete(p.slug); refreshCard(p.slug); return; }
      rows.forEach((el, i) => {
        el.classList.add("task-hiding");
        el.style.animationDelay = `${Math.min(rows.length - 1 - i, 8) * 18}ms`;
      });
      setTimeout(() => { expandedTaskCards.delete(p.slug); refreshCard(p.slug); }, 190);
    };
  } else if (hiddenCount > 0) {
    more.hidden = false;
    more.classList.remove("expanded");
    more.innerHTML = `<span>${hiddenCount} done</span>${TASK_CHEVRON_SVG}`;
    more.setAttribute("aria-expanded", "false");
    more.onclick = () => {
      expandedTaskCards.add(p.slug);
      revealTaskCards.add(p.slug);
      refreshCard(p.slug);
    };
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
      if (openTaskEditorOnCreate) {
        // Settings → "Open editor for new tasks": go straight into the full
        // editor with the caret in the description, so the description,
        // links and reference image can all be added in one pass.
        openTaskModal(p, r.task, { focusNote: true });
      } else {
        // Rapid entry: keep adding mode active on the rebuilt card.
        const nextInput = freshCard?.querySelector(".task-add-input");
        const nextBtn   = freshCard?.querySelector(".task-add-btn");
        if (nextInput && nextBtn) {
          nextBtn.hidden = true;
          nextInput.hidden = false;
          nextInput.focus();
        }
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
        title: r.focused === 1 ? "Session window raised" : `${r.focused} session windows raised`,
        // A headless session runs in a minimized window, so raising it is a
        // restore — the session itself is never touched.
        sub: r.headless
          ? "Showing live output from the background session."
          : "Brought to the front — the session keeps running either way.",
      });
    } else if (r && r.ended) {
      // The registry says nothing is running for this project, so the badge is
      // about to clear itself. Say that rather than "not found".
      toast({
        kind: "info",
        title: "That session has finished",
        sub: "Nothing is running for this project any more — the badge clears on the next refresh.",
      });
      loadProjects().catch(() => {});
    } else {
      toast({
        kind: "info",
        title: "Couldn't find the window",
        sub: "The session is still running, but its terminal window couldn't be located to raise.",
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
// A reference is either a web address or a real path on this PC. Both are
// useful to an agent — "here's the spec" is as often a file on disk as a URL —
// and the server stores whichever it is verbatim.
function isReference(v) {
  const s = String(v || "").trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;   // http(s) URL
  if (/^file:\/\//i.test(s)) return true;     // file:// URL
  if (/^[a-zA-Z]:[\\/]/.test(s)) return true; // C:\… or C:/…
  if (/^\\\\/.test(s)) return true;           // \\server\share
  if (s.startsWith("/")) return true;         // POSIX absolute
  return false;
}

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
    const v = (raw || "").trim().replace(/^["'<]+|[">']+$/g, "");
    if (!v) return;
    if (!isReference(v)) {
      toast({
        kind: "error",
        title: "Not a link or a path",
        sub: "Use a web address (https://\u2026) or a full path on this PC.",
      });
      return;
    }
    if (!links.includes(v)) links.push(v);
    render();
  }
  // One reference per LINE. Splitting on spaces the way this used to would
  // shred a real Windows path (C:\Coding Projects\spec.md became three chips),
  // so a space split is only used when every fragment on the line
  // independently looks like a reference.
  function addMany(text) {
    for (const line of String(text || "").split(/[\r\n]+/)) {
      const t = line.trim();
      if (!t) continue;
      const parts = t.split(/[ \t]+/).filter(Boolean);
      if (parts.length > 1 && parts.every(isReference)) parts.forEach(add);
      else add(t);
    }
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
document.getElementById("task-image-replace")?.addEventListener("click", () => taskImageInput?.click());

// Drag-and-drop straight onto the dialog. The whole modal card is the drop
// zone (dropping "somewhere in the dialog" is what people actually do), with
// the empty-state box highlighting so the target is obvious. Dropping a file
// that isn't an image says so rather than silently doing nothing.
(() => {
  const card = taskModal?.querySelector(".modal-card");
  if (!card) return;
  let depth = 0;
  const setActive = (on) => {
    card.classList.toggle("is-drop-target", on);
    document.getElementById("task-image-drop")?.classList.toggle("is-drop-target", on);
  };
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  card.addEventListener("dragenter", (e) => {
    if (!editingTask || !hasFiles(e)) return;
    e.preventDefault();
    depth++;
    setActive(true);
  });
  card.addEventListener("dragover", (e) => {
    if (!editingTask || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  card.addEventListener("dragleave", () => {
    if (--depth <= 0) { depth = 0; setActive(false); }
  });
  card.addEventListener("drop", async (e) => {
    if (!editingTask || !hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    setActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!(file.type || "").startsWith("image/")) {
      toast({ kind: "error", title: "Not an image", sub: `${file.name} isn't a PNG, JPG, GIF, WEBP or SVG.` });
      return;
    }
    await uploadTaskImageFile(file);
  });
})();
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
// Attach by NAME instead of by file: an http(s) image URL (downloaded) or a
// path to an image already on this PC (copied). Same end state as an upload —
// one file on disk the agent can read — so the preview path is identical.
async function attachTaskImageFromSource(source) {
  if (!editingTask) return;
  const p = projects.find((x) => x.slug === editingTask.slug);
  const t = p?.tasks?.find((x) => x.id === editingTask.id);
  if (!p || !t) return;
  const btn = document.getElementById("task-image-src-add");
  const input = document.getElementById("task-image-src");
  if (btn) btn.disabled = true;
  try {
    const r = await api(`/api/projects/${p.slug}/tasks/${t.id}/image/source`, {
      method: "POST",
      body: { source },
    });
    Object.assign(t, r.task);
    renderTaskImage(p, t);
    refreshCard(p.slug);
    if (input) input.value = "";
    toast({ kind: "success", title: "Image attached", sub: r.task?.image?.name || source });
  } catch (err) {
    toast({ kind: "error", title: "Couldn't attach image", sub: err.message });
  } finally {
    if (btn) btn.disabled = false;
  }
}
document.getElementById("task-image-src-add")?.addEventListener("click", () => {
  const v = document.getElementById("task-image-src")?.value.trim();
  if (v) attachTaskImageFromSource(v);
});
document.getElementById("task-image-src")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const v = e.target.value.trim();
  if (v) attachTaskImageFromSource(v);
});
// Browse fills the path box rather than uploading, so the row reads the same
// way the Settings path rows do: pick, see the path, then Add.
document.getElementById("task-image-pick")?.addEventListener("click", async () => {
  try {
    const r = await api("/api/dialog/pick-file", {
      method: "POST",
      body: { filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }] },
    });
    if (r?.path) {
      const input = document.getElementById("task-image-src");
      if (input) input.value = r.path;
      await attachTaskImageFromSource(r.path);
    }
  } catch (err) {
    toast({ kind: "error", title: "Couldn't open the picker", sub: err.message });
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
// ── Image lightbox ────────────────────────────────────────────────────────
// Click any attached reference image to see it full size. Escape, the close
// button, or a click on the backdrop dismisses it.
const lightbox     = document.getElementById("image-lightbox");
const lightboxImg  = document.getElementById("lightbox-img");
const lightboxCap  = document.getElementById("lightbox-caption");
function openLightbox(src, caption = "") {
  if (!lightbox || !src) return;
  lightboxImg.src = src;
  lightboxImg.alt = caption || "Reference image";
  lightboxCap.textContent = caption || "";
  lightboxCap.hidden = !caption;
  lightbox.hidden = false;
}
function closeLightbox() {
  if (!lightbox || lightbox.hidden) return;
  lightbox.hidden = true;
  lightboxImg.removeAttribute("src");
}
document.getElementById("lightbox-close")?.addEventListener("click", closeLightbox);
lightbox?.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
// Escape closes the lightbox FIRST (capture phase) so it doesn't also close
// the task dialog underneath in the same keypress.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && lightbox && !lightbox.hidden) {
    e.stopPropagation();
    closeLightbox();
  }
}, true);
document.getElementById("task-image-zoom")?.addEventListener("click", () => {
  const src = taskImageThumb?.getAttribute("src");
  if (src) openLightbox(src, taskImageName?.textContent || "");
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

// Caption for card action button `i`. Normally the tool's own name ("Claude
// Code"), but the Settings shelf lets the same tool sit in two slots as its
// app AND its terminal — in which case both buttons would read the same thing.
// Those two fall back to the variant names the shelf uses.
function cardButtonLabel(i) {
  const slot = cardButtons[i] || DEFAULT_CARD_BUTTONS[i];
  const v = VENDOR_TOOLS[slot.tool];
  const twin = cardButtons.some((s, j) => j !== i && s.tool === slot.tool);
  if (!twin || !v.modes) return v.label;
  return `${v.short || v.label} ${slot.mode === "app" ? "App" : "CLI"}`;
}

function buildCard(p) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.slug = p.slug;
  node.dataset.status = p.status;

  // Drag-to-rearrange is pointer-driven and delegated from the grid (see
  // beginCardDrag) — no per-card listeners and no native HTML5 drag, so task
  // rows inside the card keep their own draggable behaviour uncontested.
  node.draggable = false;
  node.querySelector(".card-title").textContent = p.name;

  // Active-session badge. A "send" launches ONE background terminal that works
  // this project's queued tasks, so a distinct session = a distinct (send)
  // batch — keyed by sentAt — among this project's in-progress tasks. Clicking
  // the card's Claude/Codex button opens an interactive terminal that's tracked
  // separately (server-side liveSessions) and counts the same way: each open
  // window is one live session. The badge sums both and, when clicked, raises
  // every running terminal window. Hidden while the project has nothing running.
  // Pinned flag — visible only while pinned; click unpins in one tap.
  node.dataset.pinned = p.pinned ? "true" : "false";
  const pinBadge = node.querySelector(".card-pin-badge");
  if (pinBadge) {
    pinBadge.hidden = !p.pinned;
    pinBadge.addEventListener("click", (e) => {
      e.stopPropagation();
      setPinned(p, false);
    });
  }

  const sessionBadge = node.querySelector(".card-session-badge");
  const sessionText  = node.querySelector(".card-session-text");
  if (sessionBadge && sessionText) {
    // Count comes straight from the server's session registry, which is backed
    // by real processes. It used to ALSO add one per distinct in-progress task
    // batch, and that was the "says a session is active when it isn't" bug: a
    // task left in-progress by a closed terminal or an app restart kept the
    // badge lit for a session that no longer existed, and clicking it then
    // reported "no session found" while the badge stayed put.
    const n = p.liveSessions || 0;
    if (n === 0) {
      sessionBadge.hidden = true;
    } else {
      sessionBadge.hidden = false;
      sessionText.textContent = `${n} Session${n === 1 ? "" : "s"}`;
      sessionBadge.setAttribute(
        "aria-label",
        `${n} active terminal session${n === 1 ? "" : "s"} — click to open`
      );
      sessionBadge.title = n === 1
        ? "Bring this project's session window to the front"
        : `Bring this project's ${n} session windows to the front`;
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

  // Action buttons — all three painted from the card-buttons config
  // (Settings → "Card buttons"): any mix of IDEs and AI agents, with
  // Claude/Codex slots carrying their own app-vs-CLI open mode. Cards
  // rebuild on every loadProjects, so a settings change repaints the whole
  // grid without special handling here.
  node.querySelectorAll(".card-actions .vendor-btn").forEach((btn, i) => {
    const slot = cardButtons[i] || DEFAULT_CARD_BUTTONS[i];
    const v = VENDOR_TOOLS[slot.tool];
    btn.className = `btn vendor-btn ${v.cls}`;
    btn.dataset.tool = slot.tool;
    btn.querySelector(".vendor-mark").innerHTML = v.svg;
    btn.querySelector(".vendor-label").textContent = cardButtonLabel(i);
    btn.addEventListener("click", () => openTool(p.slug, slot.tool, slot.mode));
  });

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

// ── Pin to top ────────────────────────────────────────────────────────────
// Pinned projects sort above every other card on every filter page. The flag
// lives server-side in the project DB (db[slug].pinned) so it survives a
// rescan and a relaunch. Optimistic: flip locally, repaint, then persist.
async function setPinned(project, pinned) {
  const target = projects.find((p) => p.slug === project.slug) || project;
  if (!!target.pinned === !!pinned) return;
  target.pinned = pinned;
  project.pinned = pinned;
  renderGrid();
  try {
    await api(`/api/projects/${project.slug}`, { method: "POST", body: { pinned } });
    toast({
      kind: "success",
      title: pinned ? "Pinned to top" : "Unpinned",
      sub: pinned ? `${project.name} stays first in the grid.` : `${project.name} is back in its normal spot.`,
    });
  } catch (err) {
    target.pinned = !pinned;
    project.pinned = !pinned;
    renderGrid();
    toast({ kind: "error", title: "Couldn't update pin", sub: err.message });
  }
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
// `mode` rides along for two-mode tools (Claude/Codex): "app" opens the
// desktop app, "cli" (or absent) a terminal session.
async function openTool(slug, tool, mode) {
  try {
    const result = await api(`/api/projects/${slug}/open`, { method: "POST", body: { tool, mode } });
    // Server short-circuits when an installable CLI is missing from PATH
    // and returns {ok:false, notInstalled:true, ...} so we can show our
    // own confirmation modal instead of letting Windows 11 hijack with
    // its "install from Store" prompt.
    if (result && result.notInstalled) {
      openInstallModal(result);
      return;
    }
    const label = tool === "explorer" ? "File Explorer" : (VENDOR_TOOLS[tool]?.label || tool);
    toast({ kind: "info", title: `Opening ${label}…`, sub: "Launching in a new window." });
    // For an interactive AI terminal the server registers the new window
    // ~1.4s after launch; refetch shortly after so the card's session badge
    // lights up without waiting for the next poll. loadProjects starts the
    // poll loop (anyTasksInProgress now counts live sessions), which then
    // clears the badge once the user closes the terminal. Desktop-app opens
    // create no tracked window, so they skip the refetch.
    if ((tool === "claude" || tool === "codex" || tool === "gemini") && mode !== "app") {
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
let pendingInstall = null;   // { tool, displayName, installCmd, slug?, autoLaunch? }
const installAfterEl = document.getElementById("install-after");

function openInstallModal(payload) {
  pendingInstall = payload;
  installTextEl.textContent = `${payload.displayName} isn't installed on this PC. Allow Coding Drives to install it for you?`;
  installCmdEl.textContent  = payload.installCmd;
  // IDE installs chain a launch of the project that triggered the prompt;
  // CLI installs still need a re-click once npm finishes.
  installAfterEl.textContent = payload.autoLaunch
    ? `A terminal window will open so you can see the install progress — when it finishes, this project opens in ${payload.displayName} automatically.`
    : "A terminal window will open so you can see the install progress. Re-open the project once the install completes.";
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
  const { tool, displayName, slug } = pendingInstall;
  installAllowBtn.disabled = true;
  try {
    const r = await api(`/api/tools/install`, { method: "POST", body: { tool, slug } });
    toast({
      kind: "info",
      title: `Installing ${displayName}…`,
      sub: r.willLaunch
        ? "The project will open there on its own when the install finishes."
        : "Re-open the project once the terminal finishes.",
    });
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

  const pinLabel = view.querySelector('[data-action="pin"] .pin-label');
  const pinDesc  = view.querySelector('[data-action="pin"] .pin-desc');
  if (pinLabel) pinLabel.textContent = project.pinned ? "Unpin" : "Pin to top";
  if (pinDesc)  pinDesc.textContent  = project.pinned
    ? "Return to its normal spot"
    : "Keep this card first in the grid";

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

  if (action === "pin")                 await setPinned(project, !project.pinned);
  else if (action === "backup")         openBackupModal(project);
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

// ── Keeping the grid current (no manual Scan button) ──────────────────────
// The header used to carry a Scan button. Every /api/projects response already
// re-runs the folder scan, so the button only ever re-did what the next
// refresh would do anyway — it was a placebo. It's gone, and these three
// triggers cover everything it did:
//
//   1. window focus            — alt-tab back after adding/removing a folder
//                                and the grid is correct before you look at it;
//   2. the 8s task poll        — while any session is running;
//   3. a 30s idle heartbeat    — so a folder added while the window is already
//                                focused still appears on its own.
//
// All three funnel through loadProjects(), which is a full rescan server-side,
// and all of them are skipped while the window is hidden, a dialog is open, a
// card menu is open, a card is being dragged or the user is mid-scroll/typing
// (taskPollTick's guards), so nothing repaints under the user's hands.
const IDLE_RESCAN_MS = 30000;
setInterval(() => {
  if (taskPollTimer) return;          // the 8s poll already covers this
  taskPollTick();
}, IDLE_RESCAN_MS);

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
      // Off by default — when on, task/publish sessions run hidden and close
      // themselves once the work is done (no lingering terminal windows).
      headlessTerminals: cfg.headlessTerminals === true,
      // ON unless opted out — naming a new task opens its editor so the
      // description / links / image can be added in the same breath.
      openTaskEditorOnCreate: cfg.openTaskEditorOnCreate !== false,
      // Per-agent model override. Empty string = the CLI's own default.
      taskModels: { claude: "", codex: "", ...(cfg.taskModels || {}) },
      // Claude Code Remote Control — off unless asked for, because pairing a
      // brand-new session could itself prompt, which is the last thing an
      // unattended background run needs.
      remoteControl: cfg.remoteControl === true,
      // Which AI CLI the task send buttons launch. Claude unless opted out.
      taskAgent: cfg.taskAgent === "codex" ? "codex" : "claude",
      // The three card action buttons ({ tool, mode? } each). The server
      // serves this pre-sanitized, incl. migration from the old
      // ideButton/desktop-toggle keys; sanitize again anyway so the editor
      // can trust every slot.
      cardButtons: sanitizeCardButtons(cfg.cardButtons),
    };
    // Card-buttons board opens with slot 1 armed, so a tap on a tool pill
    // has somewhere to go before any slot has been touched.
    cardBtnActiveSlot = 0;
    renderSettings();
    setSettingsTab("cards");
    settingsError("");
    settingsModal.style.display = "";
    settingsModal.classList.add("is-open");
    // setSettingsTab ran while the dialog was still display:none, so the ink
    // had nothing to measure. Place it now it has a size, without animating.
    positionTabInk({ animate: false });
  }).catch((err) => toast({ kind: "error", title: "Couldn't load settings", sub: err.message }));
}
// ── Settings tabs ─────────────────────────────────────────────────────────
// One panel visible at a time. The card-buttons editor measures its slot cards
// when it renders, so switching INTO the Cards tab repaints it — otherwise it
// would have laid itself out while hidden (zero width).
let settingsTab = "cards";
// Slide the thumb onto the active tab. It sizes to the BUTTON, not the label:
// the thumb is a background, so it should cover the whole option the way a
// segmented control does. Absolutely positioned against the strip's padding
// box, hence subtracting the border. `animate: false` for the first paint
// after the dialog opens, otherwise it slides in from the left edge every
// single time.
function positionTabInk({ animate = true } = {}) {
  const strip = document.querySelector(".settings-tabs");
  const ink = strip?.querySelector(".settings-tab-ink");
  const active = strip?.querySelector('.settings-tab[aria-selected="true"]');
  if (!strip || !ink || !active) return;
  const btn = active.getBoundingClientRect();
  const host = strip.getBoundingClientRect();
  if (!btn.width) return;            // dialog still hidden — nothing to measure
  const border = parseFloat(getComputedStyle(strip).borderLeftWidth) || 0;
  // Sit 2px inside the button on each side. At full button width the thumb
  // on the first and last tab ran flush into the strip's rounded edge, which
  // read as hugging next to the 6px of clearance it has above and below; this
  // matches the two.
  const INSET = 1;
  if (!animate) ink.style.transition = "none";
  ink.style.width = `${Math.round(btn.width) - INSET * 2}px`;
  ink.style.transform = `translateX(${Math.round(btn.left - host.left - border) + INSET}px)`;
  if (!animate) { void ink.offsetWidth; ink.style.transition = ""; }
}
window.addEventListener("resize", () => positionTabInk({ animate: false }));

function setSettingsTab(tab) {
  settingsTab = tab;
  document.querySelectorAll(".settings-tab").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.setAttribute("aria-selected", String(on));
    // Roving tabindex: one stop for the whole strip, then arrow keys within it.
    b.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll(".settings-panel").forEach((pnl) => {
    pnl.hidden = pnl.dataset.panel !== tab;
  });
  const body = document.querySelector(".settings-body");
  if (body) body.scrollTop = 0;
  if (tab === "cards" && settingsState) renderCardButtonsEditor();
  positionTabInk();
}
document.querySelector(".settings-tabs")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".settings-tab");
  if (btn) setSettingsTab(btn.dataset.tab);
});
// Arrow keys walk the strip, Home / End jump to its ends — what a role=tablist
// is expected to do, and it was doing none of it.
document.querySelector(".settings-tabs")?.addEventListener("keydown", (e) => {
  const step = { ArrowLeft: -1, ArrowRight: 1, Home: "first", End: "last" }[e.key];
  if (step === undefined) return;
  const list = [...document.querySelectorAll(".settings-tab")];
  const i = list.indexOf(document.activeElement);
  if (i === -1) return;
  e.preventDefault();
  const next = step === "first" ? 0
    : step === "last" ? list.length - 1
    : (i + step + list.length) % list.length;
  list[next].focus();
  setSettingsTab(list[next].dataset.tab);
});

function closeSettings() {
  disarmReset();
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
  if (!settingsState) return;
  settingsState.showStackBadge = e.target.checked;
  renderCardPreview();
});
// Language-badge toggle — same pattern as the stack badge above.
document.getElementById("set-show-langs")?.addEventListener("change", (e) => {
  if (!settingsState) return;
  settingsState.showLanguageBadges = e.target.checked;
  renderCardPreview();
});
// Headless background terminals — task/publish sessions run hidden and exit
// when done (handled server-side in spawnAiPrompt's headless branch).
document.getElementById("set-headless-terminals")?.addEventListener("change", (e) => {
  if (settingsState) settingsState.headlessTerminals = e.target.checked;
});
// Open the full task editor right after a card's quick-add names a task.
document.getElementById("set-open-task-editor")?.addEventListener("change", (e) => {
  if (settingsState) settingsState.openTaskEditorOnCreate = e.target.checked;
});
// Remote Control — launches sessions with Claude Code's --remote-control so
// they can be driven from the phone app.
document.getElementById("set-remote-control")?.addEventListener("change", (e) => {
  if (settingsState) settingsState.remoteControl = e.target.checked;
});
// ── Agent model picker ────────────────────────────────────────────────────
// Which model the chosen agent runs. "Default" sends no --model flag at all,
// so the CLI keeps whatever it is already configured with — that stays the
// out-of-the-box behaviour. The list is per-agent because the two CLIs take
// completely different model ids.
const AGENT_MODELS = {
  claude: [
    { value: "", label: "Let the AI choose" },
    { value: "claude-opus-5", label: "Opus 5 — most capable" },
    { value: "claude-sonnet-5", label: "Sonnet 5 — balanced" },
    { value: "claude-haiku-4-5", label: "Haiku 4.5 — fastest" },
  ],
  codex: [
    { value: "", label: "Let the AI choose" },
    { value: "gpt-5-codex", label: "gpt-5-codex" },
    { value: "gpt-5", label: "gpt-5" },
  ],
};
function renderTaskModelSelect() {
  const sel = document.getElementById("set-task-model");
  if (!sel || !settingsState) return;
  const agent = settingsState.taskAgent === "codex" ? "codex" : "claude";
  const list = AGENT_MODELS[agent] || AGENT_MODELS.claude;
  const current = settingsState.taskModels?.[agent] || "";
  sel.textContent = "";
  // A model saved by hand (or by a newer build) that isn't in the list still
  // shows, rather than silently resetting to Default on the next save.
  const known = new Set(list.map((m) => m.value));
  const rows = known.has(current) ? list : [...list, { value: current, label: current }];
  for (const m of rows) {
    const o = document.createElement("option");
    o.value = m.value;
    o.textContent = m.label;
    sel.appendChild(o);
  }
  sel.value = current;
  sel._cdSync?.();
  const help = document.getElementById("set-model-help");
  if (help) {
    // Short: it shares a line with its label, after a dash.
    help.textContent = agent === "codex" ? "Which brain Codex uses" : "Which brain Claude Code uses";
  }
}
document.getElementById("set-task-model")?.addEventListener("change", (e) => {
  if (!settingsState) return;
  const agent = settingsState.taskAgent === "codex" ? "codex" : "claude";
  settingsState.taskModels = { ...settingsState.taskModels, [agent]: e.target.value };
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
  renderTaskModelSelect();
  setTaskAgentSegment(opt.dataset.value);
});
// ── Card-buttons editor (Settings → "Card buttons") ───────────────────────
// A drag-and-drop board, tools first.
//
//   TOP — the SHELF: every choice a card button can be, one pill each. Claude
//   and Codex appear twice, once as the desktop app and once as the terminal
//   CLI, so there is no hidden mode to flip after the fact. What the pill says
//   is what the button does.
//
//   BOTTOM — three dashed SLOTS, one per action button on a project card.
//
// Drag a shelf pill onto a slot, or drag one slot's pill onto another to swap
// the two buttons. Dragging is fiddly for some people, so every drag has a tap
// equivalent: tap a slot to arm it, then tap a shelf pill. Slots and pills are
// focusable and answer Enter / Space too, so none of this is drag-only.
//
// Uniqueness is per CHOICE, not per tool: Claude App in one slot and Claude
// CLI in another is a fair thing to want, but the same pill twice is not, so
// dropping a choice that is already placed swaps the two slots.
//
// Each entry is { id, tool, mode?, label } and maps 1:1 onto a stored slot
// ({ tool, mode? }). Single-mode tools come first so the shelf's top row is
// the plain tools and the second row is the app-or-terminal pairs.
const CARD_BUTTON_CHOICES = (() => {
  const entries = Object.entries(VENDOR_TOOLS);
  const plain = entries
    .filter(([, v]) => !v.modes)
    .map(([tool, v]) => ({ id: tool, tool, label: v.label }));
  const paired = entries
    .filter(([, v]) => v.modes)
    .flatMap(([tool, v]) => [
      { id: `${tool}:app`, tool, mode: "app", label: `${v.short || v.label} App` },
      { id: `${tool}:cli`, tool, mode: "cli", label: `${v.short || v.label} CLI` },
    ]);
  return [...plain, ...paired];
})();

// The id a stored slot corresponds to, so the shelf can mark what is placed.
function cardBtnSlotId(slot) {
  return VENDOR_TOOLS[slot.tool]?.modes ? `${slot.tool}:${slot.mode === "app" ? "app" : "cli"}` : slot.tool;
}

let cardBtnActiveSlot = 0;
// What is being dragged right now: { kind: "choice", id } from the shelf, or
// { kind: "slot", index } from a slot. Kept in a module variable because the
// HTML5 dataTransfer payload is unreadable during dragover (protected mode),
// and the slot needs to know what is coming to highlight correctly.
let cardBtnDragging = null;

// Put choice `id` into slot `i`. If that exact choice already sits in another
// slot the two entries trade places, so no slot is ever emptied and the same
// pill never appears twice.
function cardBtnPlaceChoice(i, id) {
  const list = settingsState.cardButtons;
  const choice = CARD_BUTTON_CHOICES.find((c) => c.id === id);
  if (!choice || cardBtnSlotId(list[i]) === id) return false;
  const other = list.findIndex((s) => cardBtnSlotId(s) === id);
  const incoming = choice.mode ? { tool: choice.tool, mode: choice.mode } : { tool: choice.tool };
  if (other !== -1) list[other] = list[i];
  list[i] = incoming;
  return true;
}

// Swap two slots outright — used when a slot's own pill is dragged onto
// another slot.
function cardBtnSwapSlots(a, b) {
  const list = settingsState.cardButtons;
  if (a === b || !list[a] || !list[b]) return false;
  const tmp = list[a];
  list[a] = list[b];
  list[b] = tmp;
  return true;
}

// The logo + name pill. The same component fills a slot and sits on the shelf,
// so what you drag is exactly what lands.
function cardBtnPill(id) {
  const choice = CARD_BUTTON_CHOICES.find((c) => c.id === id);
  const v = VENDOR_TOOLS[choice.tool];
  const pill = document.createElement("div");
  pill.className = "cardbtn-pill";
  pill.dataset.choice = id;
  // Lets CSS reach a single vendor for an optical correction without the
  // .vendor-* class, whose :hover rules would repaint the whole pill.
  pill.dataset.tool = choice.tool;
  pill.draggable = true;

  const mark = document.createElement("span");
  mark.className = `cardbtn-pill-mark ${v.cls}`;
  mark.innerHTML = v.svg;

  const name = document.createElement("span");
  name.className = "cardbtn-pill-name";
  name.textContent = choice.label;
  name.title = choice.label;

  pill.append(mark, name);
  return pill;
}

// The preview card is filled with a REAL project, not invented data — this
// app's own project when it can be found in the scan, otherwise whichever
// project sorts first. Seeing your own stack, your own languages and your own
// path is a far better answer to "what am I changing" than a fake "Untitled"
// with plausible-looking chips, and it means the preview is wrong the moment
// the card rendering is wrong.
//
// Tasks are deliberately left out: the preview is about the badge rows and the
// action buttons, and a task list would double its height for nothing.
function previewProject() {
  if (!Array.isArray(projects) || projects.length === 0) return null;
  const mine = projects.find((p) => /coding\s*drives/i.test(p.name || ""));
  return mine || projects[0];
}

// Paint the preview from that project. Called whenever the editor re-renders
// and whenever one of the two badge switches is flipped, so the preview always
// shows the settings as they stand right now — including unsaved ones.
function renderCardPreview() {
  const card = document.querySelector(".cardbtn-preview");
  if (!card || !settingsState) return;
  const p = previewProject();

  const titleEl = card.querySelector(".card-title");
  const metaRow = card.querySelector(".card-meta");
  const stackHost = card.querySelector(".cardbtn-preview-stack");
  const indHost = card.querySelector(".indicators");
  const langRow = card.querySelector(".card-row-langs");
  const langHost = card.querySelector(".languages");
  const pathEl = card.querySelector(".card-path-text");
  const picker = card.querySelector(".status-picker");

  titleEl.textContent = p ? p.name : "No projects yet";
  pathEl.textContent = p ? p.path : "Add a scan folder to see a real project here";

  // Tech row — the stack badge (plus a second one for polyglot projects, same
  // as a card) and the GIT / VERCEL / ENV markers.
  metaRow.hidden = !settingsState.showStackBadge;
  stackHost.textContent = "";
  indHost.textContent = "";
  if (p && settingsState.showStackBadge) {
    for (const name of [p.stack, Array.isArray(p.stacks) ? p.stacks[1] : null].filter(Boolean)) {
      const b = document.createElement("span");
      b.className = "stack-badge";
      b.textContent = name;
      b.dataset.stack = name;
      stackHost.appendChild(b);
    }
    for (const kind of ["git", "vercel", "env"]) {
      if (!p.indicators?.[kind]) continue;
      const span = document.createElement("span");
      span.className = "ind";
      span.dataset.kind = kind;
      span.textContent = kind;
      indHost.appendChild(span);
    }
  }

  // Status row — every status, the project's own one selected, exactly as a
  // card paints it.
  picker.textContent = "";
  for (const s of statuses) {
    const pill = document.createElement("span");
    pill.className = "status-pill";
    pill.textContent = s.label;
    const on = !!p && p.status === s.id;
    pill.setAttribute("aria-selected", String(on));
    applyStatusColor(pill, s.color, on);
    picker.appendChild(pill);
  }

  // Language row — the project's real breakdown, through the same badge
  // builder the cards use, so the colours and percentages match.
  const langs = Array.isArray(p?.languages) ? p.languages : [];
  langRow.hidden = !settingsState.showLanguageBadges || langs.length === 0;
  langHost.textContent = "";
  for (const l of langs.slice(0, LANG_BADGE_MAX)) {
    langHost.appendChild(makeLangBadge(l.name, l.pct, l.color || LANG_OTHER_COLOR, ""));
  }
}

function renderCardButtonsEditor() {
  renderCardPreview();
  const slotsHost = document.getElementById("set-cardbtn-slots");
  const shelf = document.getElementById("set-cardbtn-grid");
  if (!slotsHost || !shelf || !settingsState) return;
  const list = settingsState.cardButtons;
  const placed = list.map(cardBtnSlotId);

  // ── Shelf ───────────────────────────────────────────────────────────────
  // A pill already on the board is dimmed and badged with its slot number, so
  // the shelf doubles as a map of what sits where.
  shelf.innerHTML = "";
  for (const choice of CARD_BUTTON_CHOICES) {
    const usedIn = placed.indexOf(choice.id);
    const isArmed = usedIn === cardBtnActiveSlot;
    const pill = cardBtnPill(choice.id);
    pill.classList.add("cardbtn-shelf-pill");
    pill.dataset.state = isArmed ? "here" : usedIn !== -1 ? "used" : "free";
    pill.tabIndex = 0;
    pill.setAttribute("role", "button");
    pill.setAttribute(
      "aria-label",
      isArmed
        ? `${choice.label} is already in Button ${cardBtnActiveSlot + 1}`
        : usedIn !== -1
          ? `Put ${choice.label} in Button ${cardBtnActiveSlot + 1}. It swaps places with Button ${usedIn + 1}.`
          : `Put ${choice.label} in Button ${cardBtnActiveSlot + 1}`
    );
    pill.title = pill.getAttribute("aria-label");

    if (usedIn !== -1) {
      const badge = document.createElement("span");
      badge.className = "cardbtn-pill-badge";
      badge.textContent = String(usedIn + 1);
      badge.setAttribute("aria-hidden", "true");
      pill.appendChild(badge);
    }

    pill.addEventListener("dragstart", (e) => {
      cardBtnDragging = { kind: "choice", id: choice.id };
      slotsHost.dataset.dragging = "true";
      shelf.dataset.dragging = "true";
      try {
        e.dataTransfer.setData("text/plain", `choice:${choice.id}`);
        e.dataTransfer.effectAllowed = "move";
      } catch { /* older engines — the module variable is the real payload */ }
    });

    const place = () => {
      if (cardBtnPlaceChoice(cardBtnActiveSlot, choice.id)) renderCardButtonsEditor();
    };
    pill.addEventListener("click", place);
    pill.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); place(); }
    });
    shelf.appendChild(pill);
  }

  // ── Slots ───────────────────────────────────────────────────────────────
  slotsHost.innerHTML = "";
  list.forEach((slot, i) => {
    const id = placed[i];
    const label = CARD_BUTTON_CHOICES.find((c) => c.id === id)?.label || VENDOR_TOOLS[slot.tool].label;
    const el = document.createElement("div");
    el.className = "cardbtn-slot";
    el.dataset.active = String(i === cardBtnActiveSlot);
    el.dataset.slot = String(i);
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.setAttribute("aria-label", `Button ${i + 1}: ${label}. Drop a tool here, or tap to choose one.`);

    // Names the slot, and ties it to the number the shelf badges onto
    // whichever tool is sitting in it.
    const num = document.createElement("span");
    num.className = "cardbtn-slot-num";
    num.textContent = `Button ${i + 1}`;
    num.setAttribute("aria-hidden", "true");

    const pill = cardBtnPill(id);
    pill.addEventListener("dragstart", (e) => {
      cardBtnDragging = { kind: "slot", index: i };
      slotsHost.dataset.dragging = "true";
      shelf.dataset.dragging = "true";
      try {
        e.dataTransfer.setData("text/plain", `slot:${i}`);
        e.dataTransfer.effectAllowed = "move";
      } catch { /* older engines — the module variable is the real payload */ }
    });

    el.append(num, pill);

    // Drop target. dragover must preventDefault or the browser refuses the
    // drop; dragleave is guarded with contains() so moving over the pill
    // inside the slot doesn't flicker the highlight off.
    el.addEventListener("dragover", (e) => {
      if (!cardBtnDragging) return;
      const self = cardBtnDragging.kind === "slot" && cardBtnDragging.index === i;
      const same = cardBtnDragging.kind === "choice" && placed[i] === cardBtnDragging.id;
      if (self || same) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.dataset.over = "true";
    });
    el.addEventListener("dragleave", (e) => {
      if (!el.contains(e.relatedTarget)) delete el.dataset.over;
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      delete el.dataset.over;
      const d = cardBtnDragging;
      cardBtnDragging = null;
      if (!d) return;
      const changed = d.kind === "slot" ? cardBtnSwapSlots(d.index, i) : cardBtnPlaceChoice(i, d.id);
      cardBtnActiveSlot = i;
      if (changed) renderCardButtonsEditor();
      else { delete slotsHost.dataset.dragging; delete shelf.dataset.dragging; }
    });

    // Tap / keyboard fallback: arm this slot, then tap a shelf pill.
    const arm = () => {
      cardBtnActiveSlot = i;
      renderCardButtonsEditor();
    };
    el.addEventListener("click", arm);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); arm(); }
    });
    slotsHost.appendChild(el);
  });
}

// One global dragend clears the board state, including a drag that was
// abandoned outside any slot (no drop event fires in that case).
document.addEventListener("dragend", () => {
  if (!cardBtnDragging) return;
  cardBtnDragging = null;
  const slots = document.getElementById("set-cardbtn-slots");
  const shelf = document.getElementById("set-cardbtn-grid");
  if (slots) { delete slots.dataset.dragging; slots.querySelectorAll("[data-over]").forEach((n) => delete n.dataset.over); }
  if (shelf) delete shelf.dataset.dragging;
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
  // Headless background terminals toggle
  const headlessEl = document.getElementById("set-headless-terminals");
  if (headlessEl) headlessEl.checked = !!settingsState.headlessTerminals;
  const openEditorEl = document.getElementById("set-open-task-editor");
  if (openEditorEl) openEditorEl.checked = !!settingsState.openTaskEditorOnCreate;
  const remoteEl = document.getElementById("set-remote-control");
  if (remoteEl) remoteEl.checked = !!settingsState.remoteControl;
  // Task agent segment
  setTaskAgentSegment(settingsState.taskAgent);
  renderTaskModelSelect();
  // Card-buttons editor (slots + tabs + tiles)
  renderCardButtonsEditor();

  // Logo preview — bust cache so a freshly uploaded file shows.
  document.getElementById("set-logo-preview").src = "/api/logo?t=" + Date.now();

  // Statuses
  const stHost = document.getElementById("set-status-list");
  stHost.innerHTML = "";
  // Each row IS the chip it configures: the name field is styled as the status
  // pill in its own colour, so what you type is what a card will show. It used
  // to be three nested boxes — a bordered row wrapping a bordered input and a
  // bordered dropdown — with a disconnected dot off to the side telling you
  // the colour that the dropdown beside it already named.
  settingsState.statuses.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "status-edit-row";

    const label = document.createElement("input");
    label.type = "text";
    label.className = "status-chip-input";
    label.value = s.label;
    label.placeholder = "Name this status";
    label.setAttribute("aria-label", "Status name");
    applyStatusColor(label, s.color, true);
    // Mutate in place without re-rendering — a re-render here would yank focus
    // out of the field on every keystroke.
    label.addEventListener("input", () => {
      settingsState.statuses[i].label = label.value;
      del.setAttribute("aria-label", `Remove ${label.value || "status"}`);
    });

    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "Status colour");
    // A legacy hex from the old customisation screen has no matching token.
    // Offer it as its own option so merely opening Settings doesn't silently
    // convert someone's existing color to a token.
    const opts = isHex(s.color) ? [s.color, ...STATUS_COLOR_TOKENS] : STATUS_COLOR_TOKENS;
    for (const t of opts) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = statusColorLabel(t);
      if (t === s.color) o.selected = true;
      sel.appendChild(o);
    }
    // Recolour the chip in place. No re-render, so the field keeps focus and
    // the list doesn't flicker.
    sel.addEventListener("change", () => {
      settingsState.statuses[i].color = sel.value;
      applyStatusColor(label, sel.value, true);
    });

    const del = document.createElement("button");
    del.className = "remove";
    del.type = "button";
    del.textContent = "\u2715";
    del.setAttribute("aria-label", `Remove ${s.label}`);
    del.disabled = settingsState.statuses.length <= 1;
    del.addEventListener("click", () => {
      settingsState.statuses.splice(i, 1);
      renderSettings();
    });

    row.append(label, sel, del);
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
    headlessTerminals: !!settingsState.headlessTerminals,
    openTaskEditorOnCreate: !!settingsState.openTaskEditorOnCreate,
    taskModels: settingsState.taskModels,
    remoteControl: !!settingsState.remoteControl,
    taskAgent: settingsState.taskAgent === "codex" ? "codex" : "claude",
    cardButtons: sanitizeCardButtons(settingsState.cardButtons),
    // Legacy mirrors of the slot modes — other server paths (and any older
    // build reading the same user-config) still honour these keys.
    openClaudeInDesktop: settingsState.cardButtons.some((b) => b.tool === "claude" && b.mode === "app"),
    openCodexInDesktop: settingsState.cardButtons.some((b) => b.tool === "codex" && b.mode === "app"),
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
// Reset is a two-state button rather than a confirm() dialog. First click arms
// it — the label changes to say what will happen and it turns red; a second
// click inside the window does it. Walk away and it disarms itself, so an
// accidental press costs nothing and never blocks the window the way a modal
// confirm does.
const RESET_ARMED_MS = 4000;
let resetArmTimer = null;
function disarmReset() {
  clearTimeout(resetArmTimer);
  resetArmTimer = null;
  const btn = document.getElementById("set-reset");
  if (!btn) return;
  btn.dataset.armed = "false";
  btn.textContent = "Reset all";
}
document.getElementById("set-reset").addEventListener("click", async () => {
  const btn = document.getElementById("set-reset");
  if (btn.dataset.armed !== "true") {
    btn.dataset.armed = "true";
    btn.textContent = "Sure? Resets everything";
    clearTimeout(resetArmTimer);
    resetArmTimer = setTimeout(disarmReset, RESET_ARMED_MS);
    return;
  }
  disarmReset();
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
    renderScheduleProjectSelect();
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
  const added = new Set(schedSelectedSlugs);
  const sorted = [...projects]
    .filter((p) => p.status !== "archived")
    .sort((a, b) => a.name.localeCompare(b.name));
  // Projects already attached stay in the list but are greyed and labelled,
  // so it's obvious why picking one again does nothing — and the first
  // selectable entry is pre-chosen so Add always does something useful.
  let firstFree = "";
  for (const p of sorted) {
    const o = document.createElement("option");
    o.value = p.slug;
    o.textContent = added.has(p.slug) ? `${p.name} — already added` : p.name;
    o.disabled = added.has(p.slug);
    schedProjectSel.appendChild(o);
    have.add(p.slug);
    if (!o.disabled && !firstFree) firstFree = p.slug;
  }
  if (selectedSlug && have.has(selectedSlug)) schedProjectSel.value = selectedSlug;
  else if (firstFree) schedProjectSel.value = firstFree;
  schedProjectSel._cdSync?.();
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

// ── Branded dropdowns ─────────────────────────────────────────────────────
// A native <select> paints its popup with the OPERATING SYSTEM's widget — a
// white Windows list in the middle of a dark violet app. No amount of CSS
// reaches inside it. So every <select> here is upgraded in place: the real
// element stays in the DOM as the value (every existing read of `.value`,
// every `change` listener and every form-fill keeps working untouched) and a
// styled button + listbox is rendered over it.
//
// Long lists (the project picker) get a filter box automatically, so picking
// one project out of forty is typing two letters rather than scrolling.
const CD_SELECT_FILTER_MIN = 8;   // options before a filter box appears

function upgradeSelect(sel) {
  if (!sel || sel._cdUpgraded || sel.multiple) return;
  sel._cdUpgraded = true;

  const wrap = document.createElement("div");
  wrap.className = "cdsel";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cdsel-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  const label = document.createElement("span");
  label.className = "cdsel-label";
  const caret = document.createElement("span");
  caret.className = "cdsel-caret";
  caret.setAttribute("aria-hidden", "true");
  caret.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  btn.append(label, caret);

  const pop = document.createElement("div");
  pop.className = "cdsel-pop";
  pop.setAttribute("role", "listbox");
  pop.hidden = true;
  const filter = document.createElement("input");
  filter.className = "cdsel-filter";
  filter.type = "text";
  filter.placeholder = "Type to filter…";
  filter.autocomplete = "off";
  filter.spellcheck = false;
  const list = document.createElement("div");
  list.className = "cdsel-list";
  const empty = document.createElement("div");
  empty.className = "cdsel-empty";
  empty.textContent = "No matches";
  empty.hidden = true;
  pop.append(filter, list, empty);

  sel.parentNode.insertBefore(wrap, sel);
  wrap.append(sel, btn, pop);
  if (sel.id) btn.id = sel.id + "-btn";
  if (sel.disabled) btn.disabled = true;

  const syncLabel = () => {
    const opt = sel.options[sel.selectedIndex];
    label.textContent = opt ? opt.textContent : "";
    label.dataset.placeholder = opt && opt.value === "" ? "true" : "false";
  };

  const buildRows = () => {
    list.textContent = "";
    [...sel.options].forEach((opt, i) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "cdsel-opt";
      row.setAttribute("role", "option");
      row.dataset.index = String(i);
      row.textContent = opt.textContent;
      row.setAttribute("aria-selected", String(i === sel.selectedIndex));
      if (opt.disabled) row.disabled = true;
      row.addEventListener("click", () => {
        sel.selectedIndex = i;
        // Dispatch on the real <select> so every existing listener fires
        // exactly as it did with the native widget.
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        syncLabel();
        close();
        btn.focus();
      });
      list.appendChild(row);
    });
    filter.hidden = sel.options.length < CD_SELECT_FILTER_MIN;
    applyFilter();
  };

  const applyFilter = () => {
    const q = filter.hidden ? "" : filter.value.trim().toLowerCase();
    let shown = 0;
    for (const row of list.children) {
      const hit = !q || row.textContent.toLowerCase().includes(q);
      row.hidden = !hit;
      if (hit) shown++;
    }
    empty.hidden = shown > 0;
  };
  filter.addEventListener("input", applyFilter);

  const close = () => {
    if (pop.hidden) return;
    pop.hidden = true;
    wrap.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    if (!pop.hidden || btn.disabled) return;
    closeAllSelects();
    buildRows();
    pop.hidden = false;
    wrap.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    // Drop upward when there isn't room below — the schedule form's Agent
    // picker sits near the bottom of a scrolling dialog.
    const r = btn.getBoundingClientRect();
    wrap.classList.toggle("drop-up", window.innerHeight - r.bottom < 240 && r.top > 260);
    filter.value = "";
    applyFilter();
    if (!filter.hidden) filter.focus();
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  };

  btn.addEventListener("click", (e) => { e.stopPropagation(); pop.hidden ? open() : close(); });
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); }
  });

  // Code that sets `.value` or refills `<option>`s (renderScheduleProjectSelect,
  // fillScheduleForm, …) must repaint the button. A native select updates
  // itself; ours needs telling, so watch both paths.
  sel.addEventListener("change", syncLabel);
  new MutationObserver(syncLabel).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "selected", "disabled"] });
  sel._cdSync = syncLabel;
  syncLabel();
}

function closeAllSelects(except) {
  document.querySelectorAll(".cdsel.is-open").forEach((w) => {
    if (w === except) return;
    w.classList.remove("is-open");
    w.querySelector(".cdsel-pop").hidden = true;
    w.querySelector(".cdsel-btn")?.setAttribute("aria-expanded", "false");
  });
}
document.addEventListener("click", (e) => {
  if (e.target instanceof Element && e.target.closest(".cdsel")) return;
  closeAllSelects();
}, true);

// Upgrade what's in the document now, and anything added later (the settings
// and schedule dialogs build rows on demand).
function upgradeAllSelects(root = document) {
  root.querySelectorAll("select:not([multiple])").forEach(upgradeSelect);
}
upgradeAllSelects();
new MutationObserver((records) => {
  for (const r of records) {
    for (const n of r.addedNodes) {
      if (!(n instanceof Element)) continue;
      if (n.tagName === "SELECT") upgradeSelect(n);
      else upgradeAllSelects(n);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

// ── Initial load ──────────────────────────────────────────────────────────
loadProjects().catch((err) => {
  toast({ kind: "error", title: "Couldn't load projects", sub: err.message });
});

// The masonry columns are balanced from measured card heights, and on the very
// first paint those heights are measured against fallback fonts — Inter and
// Bricolage arrive a beat later and change every card's line box. Re-run the
// layout once the webfonts have actually landed so the first thing the user
// sees is the balanced grid, not the fallback-metrics approximation.
document.fonts?.ready?.then(() => {
  if (cardDrag || cardPress) { pendingGridRender = true; return; }
  if (gridCardOrder.length) renderGrid();
}).catch(() => {});
