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

// Publish-to-GitHub modal
const ghModal    = document.getElementById("modal-github");
const ghPrior    = document.getElementById("gh-prior");
const ghSummary  = document.getElementById("gh-summary");
const ghRepoName = document.getElementById("gh-repo-name");
const ghDest     = document.getElementById("gh-dest");
const ghProgress = document.getElementById("gh-progress");
const ghStepsEl  = document.getElementById("gh-steps");
const ghError    = document.getElementById("gh-error");
const ghStatus   = document.getElementById("gh-status");
const ghSubmit   = document.getElementById("gh-submit");
const ghFoot     = document.getElementById("gh-foot");

// Card popover menu
const popover    = document.getElementById("card-popover");

let projects = [];
let statuses = [];
let backupPath = "";
let activeStatus = "all";
let query = "";
let popoverTargetSlug = null;

// ── Helpers ─────────────────────────────────────────────────────────────
function relativeTime(ms) {
  const diff = Date.now() - ms;
  const m = 60_000, h = 60 * m, d = 24 * h;
  if (diff < m)        return "just now";
  if (diff < h)        return Math.floor(diff / m) + "m ago";
  if (diff < d)        return Math.floor(diff / h) + "h ago";
  if (diff < 30 * d)   return Math.floor(diff / d) + "d ago";
  if (diff < 365 * d)  return Math.floor(diff / (30 * d)) + "mo ago";
  return Math.floor(diff / (365 * d)) + "y ago";
}
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
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
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
  renderChips();
  renderGrid();
  renderKpis();
}

// ── Render: KPIs ──────────────────────────────────────────────────────────
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
}
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
    btn.addEventListener("click", () => {
      activeStatus = item.id;
      renderChips();
      renderGrid();
    });
    chipRow.appendChild(btn);
  }
}

// ── Render: card grid ─────────────────────────────────────────────────────
function renderGrid() {
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

function buildCard(p) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.slug = p.slug;
  node.dataset.status = p.status;
  node.querySelector(".card-title").textContent = p.name;

  const stackEl = node.querySelector(".stack-badge");
  stackEl.textContent = p.stack;
  stackEl.dataset.stack = p.stack;

  // Indicators — only the technical ones. Claude is dropped (everything's vibe-coded
  // so the badge would be ambient noise).
  const inds = node.querySelector(".indicators");
  const VISIBLE_INDS = ["git", "vercel", "env"];
  for (const kind of VISIBLE_INDS) {
    if (!p.indicators[kind]) continue;
    const span = document.createElement("span");
    span.className = "ind";
    span.dataset.kind = kind;
    span.textContent = kind;
    inds.appendChild(span);
  }

  const pathEl = node.querySelector(".card-path");
  pathEl.textContent = p.path;
  pathEl.title = p.path;

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
    // Re-clicking the same card's menu while it's open should close it.
    if (isPopoverOpen() && popoverTargetSlug === p.slug) {
      closePopover();
      return;
    }
    openPopoverFor(p, menuBtn);
  });

  // Action buttons
  node.querySelector(".action-vscode").addEventListener("click", () => openTool(p.slug, "vscode"));
  node.querySelector(".action-claude").addEventListener("click", () => openTool(p.slug, "claude"));
  node.querySelector(".action-codex")?.addEventListener("click",  () => openTool(p.slug, "codex"));

  // Backup is invoked from the 3-dot menu — the last-backup pill is the live status display.
  const lastBackupEl = node.querySelector(".last-backup");
  if (p.lastBackedUpAt) {
    lastBackupEl.textContent = `Last backup · ${fmtTimestamp(p.lastBackedUpAt)}`;
    lastBackupEl.hidden = false;
  }

  return node;
}

function findCardEls(slug) {
  const card = document.querySelector(`.card[data-slug="${slug}"]`);
  if (!card) return null;
  return {
    card,
    last: card.querySelector(".last-backup"),
  };
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
    await api(`/api/projects/${slug}/open`, { method: "POST", body: { tool } });
    const labels = { vscode: "VS Code", claude: "Claude Code", codex: "Codex", explorer: "File Explorer" };
    toast({ kind: "info", title: `Opening ${labels[tool] || tool}…` });
  } catch (err) {
    toast({ kind: "error", title: "Couldn't open", sub: err.message });
  }
}

// ── Backup ────────────────────────────────────────────────────────────────
async function doBackup(project) {
  const els = findCardEls(project.slug);
  if (!els) return;
  const { last: lastEl } = els;
  lastEl.hidden = false;
  lastEl.dataset.state = "busy";
  lastEl.textContent = "Backing up…";
  toast({ kind: "info", title: `Backing up ${project.name}…` });
  try {
    const data = await api(`/api/projects/${project.slug}/backup`, { method: "POST" });
    if (data.ok) {
      project.lastBackedUpAt = new Date().toISOString();
      lastEl.dataset.state = "success";
      lastEl.textContent = `Backup · ${fmtDuration(data.durationMs)} · ${fmtTimestamp(project.lastBackedUpAt)}`;
      toast({
        kind: "success",
        title: `${project.name} backed up`,
        sub: `${data.dest} · ${fmtDuration(data.durationMs)}`,
      });
    } else {
      lastEl.dataset.state = "error";
      lastEl.textContent = `Robocopy exit ${data.exitCode}`;
      toast({ kind: "error", title: "Backup failed", sub: data.stderr || `Exit code ${data.exitCode}` });
    }
  } catch (err) {
    lastEl.dataset.state = "error";
    lastEl.textContent = "Failed";
    toast({ kind: "error", title: "Backup failed", sub: err.message });
  }
}

// ── Add Project modal ─────────────────────────────────────────────────────
// We toggle a class AND clear/restore the inline `display:none` baked into the
// HTML. Three independent layers (base CSS, [hidden] rule, inline style) make
// it impossible for the modal to appear unless code explicitly opens it.
function openAddModal() {
  modal.style.display = "";
  modal.classList.add("is-open");
  modalError.textContent = "";
  modalPath.value = "";
  setTimeout(() => modalPath.focus(), 0);
}
function closeAddModal() {
  modal.classList.remove("is-open");
  modal.style.display = "none";
}
btnAdd.addEventListener("click", openAddModal);
modal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) =>
  el.addEventListener("click", closeAddModal)
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAddModal();
    closeGithubModal();
    closePopover();
  }
});

modalPick.addEventListener("click", async () => {
  modalError.textContent = "";
  try {
    const result = await api("/api/dialog/pick-folder", { method: "POST", body: {} });
    if (result.canceled) return;
    if (result.path) modalPath.value = result.path;
  } catch (err) {
    // Native picker only available in desktop app — fall back to manual paste.
    modalError.textContent = err.message + "  Paste the folder path instead.";
  }
});

modalSubmit.addEventListener("click", async () => {
  modalError.textContent = "";
  const folder = modalPath.value.trim();
  if (!folder) { modalError.textContent = "Pick or paste a folder path first."; return; }
  modalSubmit.disabled = true;
  try {
    const result = await api("/api/projects/add", { method: "POST", body: { path: folder } });
    if (result.alreadyTracked) {
      toast({ kind: "info", title: "Already tracked", sub: `${result.project?.name || folder} is in a scan path.` });
    } else {
      toast({ kind: "success", title: "Project added", sub: result.project?.name || folder });
    }
    closeAddModal();
    await loadProjects();
  } catch (err) {
    modalError.textContent = err.message;
  } finally {
    modalSubmit.disabled = false;
  }
});

// Submit on Enter when path field is focused
modalPath.addEventListener("keydown", (e) => {
  if (e.key === "Enter") modalSubmit.click();
});

// ── Publish to GitHub ────────────────────────────────────────────────────
let ghProject = null;
let ghPublishing = false;

function openGithubModal() {
  ghModal.style.display = "";
  ghModal.classList.add("is-open");
  ghError.textContent = "";
  ghStatus.textContent = "";
  ghProgress.hidden = true;
  ghStepsEl.innerHTML = "";
  ghPrior.hidden = true;
  ghPrior.innerHTML = "";
  ghSummary.innerHTML = '<div class="gh-audit-loading">Checking GitHub CLI…</div>';
  ghSubmit.hidden = true;
  ghSubmit.onclick = null;
  ghFoot.hidden = true;
}
function closeGithubModal() {
  ghModal.classList.remove("is-open");
  ghModal.style.display = "none";
  ghProject = null;
}
ghModal.querySelectorAll(".modal-close, .modal-backdrop").forEach((el) =>
  el.addEventListener("click", closeGithubModal)
);

// Click the popover item → open modal → run audit + gh check → if gh is ready,
// auto-fire publish. No extra click required.
async function startPublishFlow(project) {
  if (ghPublishing) return;
  ghProject = project;
  openGithubModal();

  let audit, check;
  try {
    [audit, check] = await Promise.all([
      api(`/api/projects/${project.slug}/github/audit`),
      api(`/api/github/check`),
    ]);
  } catch (err) {
    ghSummary.innerHTML = "";
    ghError.textContent = err.message;
    return;
  }

  ghRepoName.value = project.name;
  ghDest.value     = audit.suggestedDest;

  if (audit.prior) {
    ghPrior.hidden = false;
    ghPrior.innerHTML = `
      <div class="gh-prior-banner">
        <div><strong>Already published</strong> on ${fmtTimestamp(audit.prior.createdAt)}</div>
        <div>Repo: <a href="${audit.prior.repoUrl}" target="_blank" rel="noopener">${audit.prior.repoUrl}</a></div>
        <div>Public copy: <code>${audit.prior.publicCopyPath}</code></div>
      </div>`;
  }

  // gh not ready — show error state, don't auto-publish.
  if (!check.installed || !check.authed) {
    ghSummary.innerHTML = `
      <div class="gh-row gh-row-red"><span class="gh-dot"></span>
        <div>${!check.installed
          ? "<strong>GitHub CLI not found.</strong> Install <code>gh</code> from <a href=\"https://cli.github.com\" target=\"_blank\" rel=\"noopener\">cli.github.com</a>, then try again."
          : "<strong>GitHub CLI not authenticated.</strong> Run <code>gh auth login</code> in a terminal, then try again."
        }</div></div>`;
    return;
  }

  // Show what's about to happen, then auto-fire.
  const summaryRows = [
    `<div class="gh-row gh-row-green"><span class="gh-dot"></span>
      <div>Signed in to GitHub as <code>${check.user || "(unknown)"}</code> — publishing as <code>${project.name}</code> (public).</div></div>`,
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
  ghFoot.hidden = false;
  ghProgress.hidden = false;
  ghStepsEl.innerHTML = "";

  const repoName = ghRepoName.value.trim() || ghProject.name;
  const dest     = ghDest.value.trim();

  let resp;
  try {
    resp = await fetch(`/api/projects/${ghProject.slug}/github/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ repoName, dest, visibility: "public" }),
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
    ghStatus.textContent = "Published.";
    ghSubmit.hidden = false;
    ghSubmit.textContent = "Open on GitHub";
    ghSubmit.onclick = () => window.open(finalEvent.repoUrl, "_blank");
    toast({ kind: "success", title: "Published to GitHub", sub: finalEvent.repoUrl });
    await loadProjects();
  } else {
    ghStatus.textContent = "Failed.";
    ghError.textContent = "Publish did not complete. See log above.";
  }
}

// ── Card popover menu ─────────────────────────────────────────────────────
function isPopoverOpen() { return popover.classList.contains("is-open"); }

function openPopoverFor(project, anchor) {
  popoverTargetSlug = project.slug;

  // Hide irrelevant items based on context (these use the `hidden` attribute,
  // which is fine for inert items inside the popover).
  popover.querySelector('[data-action="archive"]').hidden   = project.status === "archived";
  popover.querySelector('[data-action="unarchive"]').hidden = project.status !== "archived";
  popover.querySelector('[data-action="untrack"]').hidden   = project.source !== "extra";

  // Position below-left of the anchor button.
  const r = anchor.getBoundingClientRect();
  const pw = 220;
  const left = Math.min(window.innerWidth - pw - 8, Math.max(8, r.right - pw));
  popover.style.left = `${left}px`;
  popover.style.top  = `${r.bottom + 6}px`;
  popover.style.display = "";
  popover.classList.add("is-open");
  anchor.setAttribute("aria-expanded", "true");
}
function closePopover() {
  if (!isPopoverOpen()) return;
  popover.classList.remove("is-open");
  popover.style.display = "none";
  popoverTargetSlug = null;
  document.querySelectorAll(".card-menu[aria-expanded='true']").forEach((b) => b.setAttribute("aria-expanded", "false"));
}
document.addEventListener("click", (e) => {
  if (!isPopoverOpen()) return;
  if (!popover.contains(e.target)) closePopover();
});
window.addEventListener("resize", closePopover);
window.addEventListener("scroll", closePopover, true);

popover.addEventListener("click", async (e) => {
  const item = e.target.closest(".popover-item");
  if (!item) return;
  const action = item.dataset.action;
  const slug = popoverTargetSlug;
  closePopover();
  const project = projects.find((p) => p.slug === slug);
  if (!project) return;

  if (action === "backup")              await doBackup(project);
  else if (action === "publish-github") startPublishFlow(project);
  else if (action === "archive")        await updateStatus(slug, "archived");
  else if (action === "unarchive")      await updateStatus(slug, "in-progress");
  else if (action === "copy-path") {
    try { await navigator.clipboard.writeText(project.path); toast({ kind: "info", title: "Path copied" }); }
    catch (err) { toast({ kind: "error", title: "Copy failed", sub: err.message }); }
  }
  else if (action === "untrack") {
    if (!confirm(`Untrack "${project.name}"? The folder is NOT deleted — it just stops appearing in this list.`)) return;
    try {
      await api(`/api/projects/extra/${slug}`, { method: "DELETE" });
      toast({ kind: "info", title: "Untracked", sub: project.name });
      await loadProjects();
    } catch (err) {
      toast({ kind: "error", title: "Untrack failed", sub: err.message });
    }
  }
});

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
      customLogo: cfg.customLogo || null,
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

function renderSettings() {
  // Backup path
  document.getElementById("set-backup-path").value = settingsState.backupPath || "";

  // Logo preview — bust cache so a freshly uploaded file shows.
  document.getElementById("set-logo-preview").src = "/api/logo?t=" + Date.now();

  // Statuses
  const statusHost = document.getElementById("set-statuses");
  statusHost.innerHTML = "";
  for (const s of settingsState.statuses) {
    const row = document.createElement("div");
    row.className = "status-row";
    // Label is read-only — status names are part of the data model and
    // shouldn't be edited from the UI (changing them would orphan stored
    // status IDs). We render it as a disabled input so it visually matches
    // the row but can't be focused/typed into.
    const label = document.createElement("input");
    label.type = "text"; label.value = s.label; label.dataset.id = s.id;
    label.readOnly = true;
    label.tabIndex = -1;
    label.title = "Status names are fixed";

    // Static swatch (div, not <input type=color>). Clicking it does nothing —
    // the hex field is the single source of truth for the color, and the
    // swatch reflects whatever's there.
    const initialHex = isHex(s.color) ? s.color : tokenToHex(s.color);
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = initialHex;
    swatch.title = initialHex.toUpperCase();

    const hex = document.createElement("input");
    hex.type = "text"; hex.value = initialHex.toUpperCase(); hex.className = "hex"; hex.maxLength = 7;
    // Live update: any time the field's value is a valid hex, immediately
    // sync it into the swatch + status state. The user sees the colour change
    // as they type the last character of a 6-digit hex (or 3-digit shorthand).
    const applyHex = (raw) => {
      const v = raw.trim();
      if (isHex(v)) {
        s.color = v.toLowerCase();
        swatch.style.backgroundColor = v;
        swatch.title = v.toUpperCase();
        return true;
      }
      return false;
    };
    hex.addEventListener("input", () => { applyHex(hex.value); });
    // On blur / Enter, snap the field text to a normalised uppercase form, or
    // revert to the last good value if what they typed isn't valid hex.
    const normaliseHex = () => {
      if (applyHex(hex.value)) {
        hex.value = hex.value.trim().toUpperCase();
      } else {
        hex.value = (isHex(s.color) ? s.color : initialHex).toUpperCase();
      }
    };
    hex.addEventListener("change", normaliseHex);
    hex.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); normaliseHex(); hex.blur(); }
    });

    row.append(label, swatch, hex);
    statusHost.appendChild(row);
  }

  // Scan paths
  const scanHost = document.getElementById("set-scan-paths");
  scanHost.innerHTML = "";
  settingsState.scanPaths.forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "path-item";
    item.innerHTML = `<span></span><button class="remove" type="button" aria-label="Remove">✕</button>`;
    item.querySelector("span").textContent = p;
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

// Map the design-system token names back to a hex so the color picker can show
// a real swatch even when the user hasn't customized the color yet.
const TOKEN_HEX = {
  warning:  "#fbbf24",
  danger:   "#f87171",
  success:  "#34d399",
  info:     "#60a5fa",
  brand:    "#6a4dff",
  archived: "#3a3a40",
  muted:    "#71717a",
};
function tokenToHex(token) { return TOKEN_HEX[token] || "#888888"; }

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
document.getElementById("set-logo-pick").addEventListener("click", async () => {
  try {
    const r = await api("/api/dialog/pick-file", {
      method: "POST",
      body: { filters: [{ name: "Image", extensions: ["svg", "png", "jpg", "jpeg", "webp", "ico"] }] },
    });
    if (r.canceled || !r.path) return;
    const u = await api("/api/settings/logo", { method: "POST", body: { path: r.path } });
    settingsState.customLogo = u.customLogo;
    refreshLogoEverywhere();
    relaunchAfter({ kind: "success", title: "Logo updated", sub: "Restarting to apply new icon…" });
  } catch (err) { settingsError(err.message); }
});
document.getElementById("set-logo-reset").addEventListener("click", async () => {
  try {
    await api("/api/settings/logo/reset", { method: "POST", body: {} });
    settingsState.customLogo = null;
    refreshLogoEverywhere();
    relaunchAfter({ kind: "info", title: "Logo reset to default", sub: "Restarting to apply…" });
  } catch (err) { settingsError(err.message); }
});
function refreshLogoEverywhere() {
  const t = "?t=" + Date.now();
  document.getElementById("set-logo-preview").src = "/api/logo" + t;
  document.getElementById("brand-mark").src       = "/api/logo" + t;
  document.getElementById("credit-mark").src      = "/api/logo" + t;
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
  const patch = {
    backupPath: settingsState.backupPath || undefined,
    scanPaths: settingsState.scanPaths,
    excludeFolders: settingsState.excludeFolders,
    statusOverrides: {},
  };
  for (const s of settingsState.statuses) {
    patch.statusOverrides[s.id] = { label: s.label, color: s.color };
  }
  try {
    await api("/api/config", { method: "POST", body: patch });
    closeSettings();
    await loadProjects();
    toast({ kind: "success", title: "Settings saved" });
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
    toast({ kind: "info", title: "Settings reset to defaults" });
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
    maxBtn.setAttribute("title",      isMax ? "Restore" : "Maximize");
  };
  winApi.isMaximized?.().then(setMaxState).catch(() => {});
  winApi.onMaximizeChanged?.(setMaxState);
}

// ── Initial load ──────────────────────────────────────────────────────────
loadProjects().catch((err) => {
  toast({ kind: "error", title: "Couldn't load projects", sub: err.message });
});
