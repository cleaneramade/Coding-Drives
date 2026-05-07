// Electron main process — wraps Project Tracker in a native Windows window.
// The Express server is loaded in-process via dynamic ESM import so there's
// no child process to manage and no startup timing race.

const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const url = require("node:url");

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, "config.json");

// Use a stable productName so userData lands under "Coding Drives".
app.setName("Coding Drives");

// Marker for server.js so it knows it's running inside the Electron main process
// (and can therefore use the native dialog).
process.env.PT_ELECTRON = "1";

const ICON_PATH = path.join(ROOT, "assets", "icon.ico");
const PRELOAD_PATH = path.join(ROOT, "preload.cjs");

// Resolve the icon to use for BrowserWindow at boot. If the user has uploaded
// a custom logo (via Settings → App logo), and it's a raster format that
// Electron can use as a window icon (PNG/JPG/WEBP/ICO), we use that path.
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
      if ([".png", ".jpg", ".jpeg", ".webp", ".ico"].includes(ext)) return custom;
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

function loadPort() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")).port || 5179; }
  catch { return 5179; }
}
const PORT = loadPort();

let mainWindow = null;

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
    icon: fs.existsSync(windowIcon) ? windowIcon : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: PRELOAD_PATH,      // Bridges window:minimize/maximize/close
    },
  });

  Menu.setApplicationMenu(null);

  // Open external links in the user's default browser, never in-window.
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: "deny" };
  });

  // Notify renderer when maximize state flips so the maximize/restore icon swaps.
  mainWindow.on("maximize",   () => mainWindow.webContents.send("window:maximize-changed", true));
  mainWindow.on("unmaximize", () => mainWindow.webContents.send("window:maximize-changed", false));

  // Expose the window so the in-process server can pop native dialogs.
  global.__codingDrivesWindow = mainWindow;

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

// Window control IPC handlers (paired with preload.cjs).
ipcMain.on("window:minimize", () => mainWindow?.minimize());
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

app.whenReady().then(async () => {
  log("[main] app ready, ROOT =", ROOT, "USER_DATA =", USER_DATA);
  try {
    await startServerInProcess();
    log(`[main] server up on ${PORT}`);
  } catch (err) {
    log("[main] server failed to start:", err && err.stack ? err.stack : String(err));
    dialog.showErrorBox("Project Tracker — startup failed",
      `${err.message}\n\nCheck log at:\n${LOG_PATH}`);
    app.quit();
    return;
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
