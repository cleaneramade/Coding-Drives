// Preload — bridges renderer ↔ main for window controls.
// Runs in a sandboxed context, so only Electron's preload-safe APIs are
// available (contextBridge, ipcRenderer). No Node fs/path/etc.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cdAPI", {
  window: {
    minimize:    () => ipcRenderer.send("window:minimize"),
    maximize:    () => ipcRenderer.send("window:maximize"),
    close:       () => ipcRenderer.send("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChanged: (cb) => ipcRenderer.on("window:maximize-changed", (_e, isMax) => cb(isMax)),
  },
  app: {
    // Triggers app.relaunch() + app.exit() in the main process. Used after the
    // user replaces / resets their custom logo so the new icon is picked up by
    // BrowserWindow's `icon` constructor option on the next boot.
    relaunch: () => ipcRenderer.send("app:relaunch"),
  },
});
