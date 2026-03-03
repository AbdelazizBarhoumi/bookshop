import { app, BrowserWindow, ipcMain, Notification } from "electron";
import path from "path";
import { fileURLToPath } from "url";

// in an ES module build __dirname isn’t available; derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'fs';

function createWindow() {
  // determine whether preload.js or preload.mjs exists (TS build may use mjs when
  // project is ESM). fall back gracefully.
  let preloadFile = 'preload.js';
  if (!fs.existsSync(path.join(__dirname, preloadFile))) {
    const alt = 'preload.mjs';
    if (fs.existsSync(path.join(__dirname, alt))) preloadFile = alt;
  }

  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, preloadFile),
      // enable sandboxed renderer for security
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // when packaged, index.html will be inside the asar under dist
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// example IPC handlers that mirror your renderer usage
ipcMain.handle("print-receipt", async (_evt, html: string) => {
  // implement native printing here
  console.log("print-receipt", html);
});

ipcMain.handle("backup-data", async (_evt, json: string) => {
  console.log("backup-data", json);
  return { success: true };
});

ipcMain.handle("restore-data", async () => {
  console.log("restore-data");
  return { success: true };
});

ipcMain.handle("auto-backup", async (_evt, json: string) => {
  console.log("auto-backup", json);
  return { success: true };
});

ipcMain.handle("import-csv", async () => {
  console.log("import-csv");
  return { canceled: true };
});

ipcMain.on("show-notification", (_evt, { title, body }) => {
  new Notification({ title, body }).show();
});
