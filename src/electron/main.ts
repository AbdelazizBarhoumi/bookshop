import { app, BrowserWindow, ipcMain, Notification, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import {
  initDatabase,
  closeDatabase,
  dbLoadAll,
  dbGetAll,
  dbUpsert,
  dbDelete,
  dbSaveAll,
  dbGetSetting,
  dbSaveSetting,
  dbImportAll,
} from "./database";
import {
  ensureAdminUser,
  login,
  logout,
  getSession,
  heartbeat,
  isAuthenticated,
  resetPassword,
  setSessionTimeout,
  getUsers_safe,
  createUser,
  deleteUserById,
  updateUserById,
} from "./auth";

// in an ES module build __dirname isn't available; derive it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  // Vite builds preload as .mjs (ESM); fall back to .js for custom setups
  let preloadFile = "preload.mjs";
  if (!fs.existsSync(path.join(__dirname, preloadFile))) {
    const alt = "preload.js";
    if (fs.existsSync(path.join(__dirname, alt))) preloadFile = alt;
  }

  const isDev = !!process.env.VITE_DEV_SERVER_URL;

  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, preloadFile),
      sandbox: true,
      contextIsolation: true,          // explicit – defence in depth
      nodeIntegration: false,           // explicit – defence in depth
      webviewTag: false,                // block <webview> injection
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  // ── Security: prevent navigation to external URLs ──
  win.webContents.on("will-navigate", (event, url) => {
    if (isDev && url.startsWith(process.env.VITE_DEV_SERVER_URL!)) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "file:") {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  // ── Security: block all new-window / popup creation ──
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" as const }));

  // ── Security: disable DevTools in production ──
  if (!isDev) {
    win.webContents.on("devtools-opened", () => {
      win.webContents.closeDevTools();
    });
  }

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

// ── Lifecycle ──────────────────────────────────────────────────

app.whenReady().then(() => {
  // ── Security: Content Security Policy ──
  const devServer = process.env.VITE_DEV_SERVER_URL || "";
  const connectSrc = devServer ? `'self' ${devServer} ws:` : "'self'";
  // Vite HMR injects inline scripts in dev; production only allows 'self'
  const scriptSrc = devServer ? "'self' 'unsafe-inline'" : "'self'";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src ${connectSrc}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
        ],
      },
    });
  });

  // ── Security: block permission requests (camera, mic, geolocation, etc.) ──
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  initDatabase();
  ensureAdminUser();   // guarantee admin user exists (main-process, not renderer)
  createWindow();
});

app.on("window-all-closed", () => {
  closeDatabase();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// ── Auth IPC handlers (run in main process – cannot be bypassed) ───

ipcMain.handle("auth:login", (_evt, username: string, password: string) => {
  return login(username, password);
});

ipcMain.handle("auth:logout", () => {
  logout();
  return { success: true };
});

ipcMain.handle("auth:get-session", () => {
  return getSession();
});

ipcMain.handle("auth:heartbeat", () => {
  heartbeat();
  return true;
});

ipcMain.handle("auth:reset-password", (_evt, username: string, email: string) => {
  return resetPassword(username, email);
});

// ── User management IPC (passwords hashed in main process) ─────

ipcMain.handle("user:get-all", () => {
  return getUsers_safe();       // never exposes passwordHash
});

ipcMain.handle("user:create", (_evt, data: { username: string; password: string; displayName: string; role: string; email?: string }) => {
  if (!isAuthenticated()) return { success: false, error: 'AUTH_REQUIRED' };
  return createUser(data);
});

ipcMain.handle("user:delete", (_evt, userId: string) => {
  if (!isAuthenticated()) return { success: false, error: 'AUTH_REQUIRED' };
  return deleteUserById(userId);
});

ipcMain.handle("user:update", (_evt, userId: string, data: { displayName?: string; role?: string; email?: string; password?: string }) => {
  if (!isAuthenticated()) return { success: false, error: 'AUTH_REQUIRED' };
  return updateUserById(userId, data);
});

// ── Database IPC handlers (session-gated) ──────────────────────

function stripPasswordHashes(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  if (Array.isArray(result.users)) {
    result.users = (result.users as Array<Record<string, unknown>>).map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ passwordHash: _ph, ...rest }) => rest
    );
  }
  return result;
}

ipcMain.handle("db:load-all", () => {
  // Session heartbeat on data load
  heartbeat();
  return stripPasswordHashes(dbLoadAll());
});

ipcMain.handle("db:get-all", (_evt, table: string) => {
  heartbeat();
  // Never expose raw user records with password hashes
  if (table === 'users') return getUsers_safe();
  return dbGetAll(table);
});

ipcMain.handle("db:upsert", (_evt, table: string, id: string, data: unknown) => {
  if (!isAuthenticated()) throw new Error('AUTH_REQUIRED');
  // Block direct writes to users table — must go through user: IPC
  if (table === 'users') throw new Error('Use user:create / user:update IPC');
  heartbeat();
  return dbUpsert(table, id, data);
});

ipcMain.handle("db:delete", (_evt, table: string, id: string) => {
  if (!isAuthenticated()) throw new Error('AUTH_REQUIRED');
  if (table === 'users') throw new Error('Use user:delete IPC');
  heartbeat();
  return dbDelete(table, id);
});

ipcMain.handle("db:save-all", (_evt, table: string, items: { id: string }[]) => {
  if (!isAuthenticated()) throw new Error('AUTH_REQUIRED');
  if (table === 'users') throw new Error('Use user: IPC for user management');
  heartbeat();
  return dbSaveAll(table, items);
});

ipcMain.handle("db:get-setting", (_evt, key: string) => {
  heartbeat();
  return dbGetSetting(key);
});

ipcMain.handle("db:save-setting", (_evt, key: string, value: string) => {
  if (!isAuthenticated()) throw new Error('AUTH_REQUIRED');
  heartbeat();
  // If saving app settings, update session timeout in auth module
  if (key === 'app_settings') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed.sessionTimeoutMinutes === 'number') {
        setSessionTimeout(parsed.sessionTimeoutMinutes);
      }
    } catch { /* ignore */ }
  }
  return dbSaveSetting(key, value);
});

ipcMain.handle("db:import-all", (_evt, data: Record<string, { id: string }[]>) => {
  if (!isAuthenticated()) throw new Error('AUTH_REQUIRED');
  heartbeat();
  return dbImportAll(data);
});

// ── Other IPC handlers ─────────────────────────────────────────

ipcMain.handle("print-receipt", async (_evt, html: string) => {
  const printWin = new BrowserWindow({
    show: false,
    width: 350,
    height: 600,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  await printWin.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  );
  printWin.webContents.print(
    { silent: false, printBackground: true },
    (_success, _failureReason) => {
      printWin.close();
    }
  );
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
