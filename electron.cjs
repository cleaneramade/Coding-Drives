// Electron main process — wraps Coding Drives in a native Windows window.
// The Express server is loaded in-process via dynamic ESM import so there's
// no child process to manage and no startup timing race.

const { app, BrowserWindow, shell, Menu, Tray, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const url = require("node:url");

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, "config.json");

// Use a stable productName so userData lands under "Coding Drives".
app.setName("Coding Drives");

// Single instance — launching the exe again while the app sits in the tray
// must surface the existing window, not boot a second copy that dies on the
// already-bound server port. The second-instance handler lives further down
// (needs mainWindow in scope).
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

// Marker for server.js so it knows it's running inside the Electron main process
// (and can therefore use the native dialog).
process.env.PT_ELECTRON = "1";

const ICON_PATH = path.join(ROOT, "assets", "icon.ico");
const PRELOAD_PATH = path.join(ROOT, "preload.cjs");

// Resolve the icon to use for BrowserWindow at boot. If the user has uploaded
// a custom logo (via Settings → App logo), and it's a raster format that
// Electron can use as a window icon (PNG/JPG/ICO), we use that path.
// SVG is intentionally rejected here — Electron can't render SVG to a window
// icon on Windows. The bundled .ico is the fallback.
function resolveWindowIconPath(userDataDir) {
  try {
    const userConfigPath = path.join(userDataDir, "data", "user-config.json");
    if (!fs.existsSync(userConfigPath)) return ICON_PATH;
    const u = JSON.parse(fs.readFileSync(userConfigPath, "utf8"));
    const custom = u.customLogo;
    if (custom && fs.existsSync(custom)) {
      const ext = path.extname(custom).toLowerCase();
      if ([".png", ".jpg", ".jpeg", ".ico"].includes(ext)) return custom;
    }
  } catch {}
  return ICON_PATH;
}

// Point the server's writable paths at userData so portable .exe runs share data.
const USER_DATA = app.getPath("userData");
process.env.PT_DATA_DIR = path.join(USER_DATA, "data");
process.env.PT_DS_DIR   = path.join(USER_DATA, "ds");
fs.mkdirSync(process.env.PT_DATA_DIR, { recursive: true });
fs.mkdirSync(process.env.PT_DS_DIR,   { recursive: true });

// File-based logger — portable .exe is GUI subsystem so console output is invisible.
const LOG_PATH = path.join(USER_DATA, "tracker.log");
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ")}\n`;
  try { fs.appendFileSync(LOG_PATH, line); } catch {}
  console.log(...args);
}
process.on("uncaughtException",  (err) => log("uncaughtException:",  err && err.stack ? err.stack : String(err)));
process.on("unhandledRejection", (err) => log("unhandledRejection:", err && err.stack ? err.stack : String(err)));

// Mirrors server.js loadConfig() precedence: user-config.json (userData —
// survives updates) wins over config.json (install dir — replaced on update).
// Read straight from disk rather than reusing server.js: this runs before the
// server is imported, and only one key is needed. Keep the two in sync — if
// they disagree, the window loads a different port than the server listens on.
function loadPort() {
  const read = (p) => {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return {}; }
  };
  const bundled = read(CONFIG_PATH);
  const user = read(path.join(process.env.PT_DATA_DIR, "user-config.json"));
  return user.port || bundled.port || 5179;
}
const PORT = loadPort();

let mainWindow = null;
let tray = null;
// Set by before-quit (tray "Quit", installer, OS shutdown). Distinguishes a
// real quit from the user clicking the window's ✕ — which only HIDES the app
// so the scheduler (30s ticker in server.js) keeps firing scheduled tasks.
let quittingForReal = false;
// The tray balloon is shown once per app run, the first time the window is
// closed to the background — enough to teach the behaviour without nagging.
let hideBalloonShown = false;

// Bring the (possibly hidden or minimized) window back to the foreground.
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); return; }
  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

// System-tray icon — the app's home while it runs in the background. Created
// once at startup (not on first hide) so the user can always see the app is
// alive, and can reopen or fully quit it from here.
function createTray(iconPath) {
  try {
    tray = new Tray(iconPath);
    tray.setToolTip("Coding Drives — running in the background; scheduled tasks fire on time");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open Coding Drives", click: () => showMainWindow() },
      { type: "separator" },
      { label: "Quit (stops scheduled tasks)", click: () => { quittingForReal = true; app.quit(); } },
    ]));
    tray.on("click", () => showMainWindow());
    tray.on("double-click", () => showMainWindow());
  } catch (err) {
    log("[tray] failed to create:", err?.message || err);
  }
}

async function startServerInProcess() {
  // server.js is ESM and now awaits app.listen() at top-level.
  // The import() promise resolves once the server is ready.
  // Use pathToFileURL so paths with spaces (e.g., "Coding Projects") encode correctly.
  const serverUrl = url.pathToFileURL(path.join(ROOT, "server.js")).href;
  log("[main] importing server from", serverUrl);
  await import(serverUrl);
  log("[main] server import resolved");
}

function createWindow() {
  const windowIcon = resolveWindowIconPath(USER_DATA);
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 760,
    minHeight: 540,
    backgroundColor: "#131316",
    title: "Coding Drives",
    autoHideMenuBar: true,
    frame: false,                 // Frameless — we render our own controls (Apple-like blend)
    show: false,                  // Hidden until maximized to avoid a default-size flash
    icon: fs.existsSync(windowIcon) ? windowIcon : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: PRELOAD_PATH,      // Bridges window:minimize/maximize/close
    },
  });

  // Launch maximized (not true full-screen) so the Windows taskbar stays
  // visible. F11-style full-screen hides the shell which the user explicitly
  // doesn't want.
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  Menu.setApplicationMenu(null);

  // Manual reload shortcuts. The app runs with NO native menu (frameless custom
  // UI), and the menu is exactly what normally registers the default Ctrl+R /
  // F5 reload accelerators — so without this, refresh does nothing in the
  // packaged app. We intercept the keys on the window itself instead.
  //   Ctrl+R / F5         → reload (ignore cache, so freshly-synced public/*
  //                         CSS/JS is always picked up, never a stale copy)
  //   Ctrl+Shift+R        → same hard reload (familiar muscle-memory alias)
  // meta is included alongside control so Cmd+R also works if ever run on macOS.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const key = (input.key || "").toLowerCase();
    const reload = key === "f5" || ((input.control || input.meta) && key === "r");
    if (reload) {
      event.preventDefault();
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  // Open external links in the user's default browser, never in-window.
  // http(s) only: anything else (file:, smb:, custom app schemes) handed to
  // the OS from renderer-controlled markup is an unnecessary risk.
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:\/\//i.test(u)) shell.openExternal(u);
    return { action: "deny" };
  });

  // Notify renderer when maximize state flips so the green-button icon swaps.
  mainWindow.on("maximize",   () => mainWindow.webContents.send("window:maximize-changed", true));
  mainWindow.on("unmaximize", () => mainWindow.webContents.send("window:maximize-changed", false));

  // Closing the window does NOT quit the app — it hides to the system tray so
  // the in-process server (and its 30s schedule ticker) keeps running and
  // scheduled tasks still fire on time. A real quit comes from the tray menu,
  // the installer, or OS shutdown (all of which raise before-quit first).
  mainWindow.on("close", (e) => {
    if (quittingForReal) return;
    e.preventDefault();
    mainWindow.hide();
    if (tray && !hideBalloonShown) {
      hideBalloonShown = true;
      try {
        tray.displayBalloon({
          title: "Coding Drives is still running",
          content: "Scheduled tasks will fire on time. Reopen or quit from this tray icon.",
          iconType: "info",
        });
      } catch {}
    }
  });

  // Expose the window so the in-process server can pop native dialogs.
  global.__codingDrivesWindow = mainWindow;

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  // Dev-only live reload — watches the renderer source dirs and reloads the
  // window on any change. `app.isPackaged` is false when running via
  // `npm run dev` (`electron .`) and true inside the built installer, so the
  // watcher never fires in production. fs.watch with recursive:true is
  // supported on Windows and macOS (the target platforms for this app); we
  // debounce so a burst of saves (editors often write multiple events per
  // save) results in a single reload.
  //
  // Two reload modes:
  //   1. Renderer-only — public/* and assets/*. Cheap webContents reload.
  //   2. Full relaunch — server.js. The express server is loaded once at
  //      startup via dynamic import; there's no clean way to swap it in
  //      place, so we relaunch the whole Electron process. Same restart cost
  //      the user would pay manually, just automatic.
  if (!app.isPackaged) {
    const rendererWatchDirs = [
      path.join(ROOT, "public"),
      path.join(ROOT, "assets"),
    ].filter((p) => fs.existsSync(p));

    const SERVER_FILE = path.join(ROOT, "server.js");

    let reloadTimer = null;
    let relaunchTimer = null;
    let relaunching = false;

    const scheduleReload = (reason) => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        log("[dev] reloading window:", reason);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reloadIgnoringCache();
        }
      }, 150);
    };

    const scheduleRelaunch = (reason) => {
      if (relaunching) return;
      clearTimeout(relaunchTimer);
      // Longer debounce than the renderer path — editors sometimes touch a
      // file twice and we don't want two app.relaunch() calls racing.
      relaunchTimer = setTimeout(() => {
        relaunching = true;
        log("[dev] relaunching app:", reason);
        app.relaunch();
        app.exit(0);
      }, 350);
    };

    for (const dir of rendererWatchDirs) {
      try {
        fs.watch(dir, { recursive: true }, (_event, filename) => {
          if (!filename) return;
          // Ignore editor swap/temp files so half-written saves don't trigger.
          if (/(^|[\\/])\.|~$|\.swp$|\.tmp$/.test(filename)) return;
          scheduleReload(`${dir}/${filename}`);
        });
        log("[dev] watching", dir);
      } catch (err) {
        log("[dev] watch failed for", dir, "—", err.message);
      }
    }

    try {
      fs.watch(SERVER_FILE, (_event) => scheduleRelaunch("server.js"));
      log("[dev] watching", SERVER_FILE, "(triggers full relaunch)");
    } catch (err) {
      log("[dev] watch failed for", SERVER_FILE, "—", err.message);
    }
  }
}

// Window control IPC handlers (paired with preload.cjs).
ipcMain.on("window:minimize", () => mainWindow?.minimize());
// Green button — toggles maximize. Plain maximize (not full-screen) so the
// Windows taskbar always remains visible.
ipcMain.on("window:maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());
ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);

// Hard restart of the entire app. Used after the user changes their custom
// logo so the new icon flows through BrowserWindow's `icon:` constructor
// option (which only takes effect on creation).
ipcMain.on("app:relaunch", () => {
  app.relaunch();
  app.exit(0);
});

// Second launch of the exe (desktop shortcut, start menu) while we're already
// running — likely someone looking for the backgrounded window. Surface it.
app.on("second-instance", () => showMainWindow());

app.whenReady().then(async () => {
  log("[main] app ready, ROOT =", ROOT, "USER_DATA =", USER_DATA);
  try {
    await startServerInProcess();
    log(`[main] server up on ${PORT}`);
  } catch (err) {
    log("[main] server failed to start:", err && err.stack ? err.stack : String(err));
    dialog.showErrorBox("Coding Drives — startup failed",
      `${err.message}\n\nCheck log at:\n${LOG_PATH}`);
    app.quit();
    return;
  }
  createWindow();
  createTray(resolveWindowIconPath(USER_DATA));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Raised by tray Quit, app.quit(), the installer's close, or OS shutdown —
// flip the flag so the window's close handler stops intercepting.
app.on("before-quit", () => { quittingForReal = true; });

app.on("window-all-closed", () => {
  // Only reachable on a real quit: the window's close handler hides instead
  // of closing in every other case.
  if (process.platform !== "darwin") app.quit();
});
