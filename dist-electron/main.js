import { app, session, ipcMain, BrowserWindow, Notification } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Database from "better-sqlite3";
import crypto from "crypto";
let db;
const ENTITY_TABLES = [
  "products",
  "transactions",
  "customers",
  "users",
  "suppliers",
  "purchase_orders",
  "expenses",
  "audit_logs"
];
function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "bookshop.db");
  console.log("[database] Opening SQLite DB at:", dbPath);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  for (const table of ENTITY_TABLES) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id   TEXT PRIMARY KEY,
        json TEXT NOT NULL
      )
    `);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  console.log("[database] Initialised successfully");
}
function dbGetAll(table) {
  if (!ENTITY_TABLES.includes(table)) return [];
  const rows = db.prepare(`SELECT json FROM ${table}`).all();
  return rows.map((r) => JSON.parse(r.json));
}
function dbUpsert(table, id, data) {
  if (!ENTITY_TABLES.includes(table)) return;
  db.prepare(`INSERT OR REPLACE INTO ${table} (id, json) VALUES (?, ?)`).run(id, JSON.stringify(data));
}
function dbDelete(table, id) {
  if (!ENTITY_TABLES.includes(table)) return;
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}
function dbSaveAll(table, items) {
  if (!ENTITY_TABLES.includes(table)) return;
  const del = db.prepare(`DELETE FROM ${table}`);
  const ins = db.prepare(`INSERT INTO ${table} (id, json) VALUES (?, ?)`);
  db.transaction(() => {
    del.run();
    for (const item of items) {
      ins.run(item.id, JSON.stringify(item));
    }
  })();
}
function dbGetSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return (row == null ? void 0 : row.value) ?? null;
}
function dbSaveSetting(key, value) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}
function dbLoadAll() {
  const result = {};
  for (const table of ENTITY_TABLES) {
    result[table] = dbGetAll(table);
  }
  const settingsRaw = dbGetSetting("app_settings");
  result.settings = settingsRaw ? JSON.parse(settingsRaw) : null;
  return result;
}
function dbImportAll(data) {
  db.transaction(() => {
    for (const [table, items] of Object.entries(data)) {
      if (ENTITY_TABLES.includes(table) && Array.isArray(items)) {
        dbSaveAll(table, items);
      }
    }
  })();
}
function closeDatabase() {
  if (db) {
    console.log("[database] Closing");
    db.close();
  }
}
const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
let _session = null;
let _sessionTimeoutMinutes = 30;
const _loginAttempts = /* @__PURE__ */ new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1e3;
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
function verifyScrypt(password, stored) {
  const parts = stored.split("$");
  if (parts[0] !== "scrypt" || parts.length !== 3) return false;
  const salt = parts[1];
  const hash = parts[2];
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  }).toString("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(derived, "hex")
    );
  } catch {
    return false;
  }
}
function legacyHashV2(password) {
  const salt = "riadh_library_salt_v3_secure";
  const input = salt + password + salt;
  let h1 = 3735928559, h2 = 1103547991;
  for (let round = 0; round < 200; round++) {
    const roundInput = round === 0 ? input : `${h1.toString(16)}:${input}:${h2.toString(16)}`;
    for (let i = 0; i < roundInput.length; i++) {
      const ch = roundInput.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507);
    h1 ^= Math.imul(h2 ^ h2 >>> 13, 3266489909);
    h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507);
    h2 ^= Math.imul(h1 ^ h1 >>> 13, 3266489909);
  }
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return "v2_" + hash.toString(36);
}
function legacyHashSha(password) {
  const salt = "riadh_library_salt_v2";
  const input = salt + password + salt;
  let h1 = 3735928559, h2 = 1103547991;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507);
  h1 ^= Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507);
  h2 ^= Math.imul(h1 ^ h1 >>> 13, 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return "sha_" + hash.toString(36) + "_" + password.length;
}
function verifyPassword(password, stored) {
  if (stored.startsWith("scrypt$")) return verifyScrypt(password, stored);
  if (stored.startsWith("v2_")) return stored === legacyHashV2(password);
  if (stored.startsWith("sha_")) return stored === legacyHashSha(password);
  return false;
}
function needsRehash(stored) {
  return !stored.startsWith("scrypt$");
}
function isLocked(username) {
  const key = username.trim().toLowerCase();
  const rec = _loginAttempts.get(key);
  if (!rec || rec.count < MAX_ATTEMPTS) return { locked: false, remainingMs: 0 };
  const remaining = rec.lockedUntil - Date.now();
  if (remaining <= 0) {
    _loginAttempts.delete(key);
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs: remaining };
}
function recordFail(username) {
  const key = username.trim().toLowerCase();
  const rec = _loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = Date.now() + LOCKOUT_MS;
  _loginAttempts.set(key, rec);
}
function clearFails(username) {
  _loginAttempts.delete(username.trim().toLowerCase());
}
function stripHash(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin
  };
}
function getAllUsers() {
  return dbGetAll("users");
}
function loadSessionTimeout() {
  try {
    const raw = dbGetSetting("app_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.sessionTimeoutMinutes === "number") {
        _sessionTimeoutMinutes = parsed.sessionTimeoutMinutes;
      }
    }
  } catch {
  }
}
function login(username, password) {
  loadSessionTimeout();
  const norm = username.trim().toLowerCase();
  const lock = isLocked(norm);
  if (lock.locked) {
    return { success: false, error: "account_locked", lockedMs: lock.remainingMs };
  }
  const users = getAllUsers();
  const user = users.find((u) => u.username.toLowerCase() === norm);
  if (!user) {
    recordFail(norm);
    return { success: false, error: "invalid_credentials" };
  }
  if (!verifyPassword(password, user.passwordHash)) {
    recordFail(norm);
    return { success: false, error: "invalid_credentials" };
  }
  clearFails(norm);
  if (needsRehash(user.passwordHash)) {
    user.passwordHash = hashPassword(password);
    dbUpsert("users", user.id, user);
    console.log(`[auth] Upgraded password hash for "${user.username}" to scrypt`);
  }
  user.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
  dbUpsert("users", user.id, user);
  _session = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    loginTime: Date.now(),
    lastActivity: Date.now()
  };
  return { success: true, user: stripHash(user) };
}
function logout() {
  _session = null;
}
function getSession() {
  if (!_session) return null;
  const elapsedMin = (Date.now() - _session.lastActivity) / 1e3 / 60;
  if (elapsedMin > _sessionTimeoutMinutes) {
    console.log("[auth] Session expired after inactivity");
    _session = null;
    return null;
  }
  return {
    ..._session,
    user: {
      id: _session.userId,
      username: _session.username,
      displayName: _session.displayName,
      role: _session.role,
      email: _session.email,
      createdAt: "",
      // not tracked in session
      lastLogin: void 0
    }
  };
}
function heartbeat() {
  if (_session) _session.lastActivity = Date.now();
}
function isAuthenticated() {
  return getSession() !== null;
}
function setSessionTimeout(minutes) {
  _sessionTimeoutMinutes = minutes;
}
function resetPassword(username, email) {
  const users = getAllUsers();
  const target = users.find((u) => u.username === username);
  if (!target) return { success: false, error: "user_not_found" };
  if (!target.email || target.email.toLowerCase() !== email.toLowerCase()) {
    return { success: false, error: "email_mismatch" };
  }
  const tempPassword = "reset_" + crypto.randomBytes(4).toString("hex");
  target.passwordHash = hashPassword(tempPassword);
  dbUpsert("users", target.id, target);
  return { success: true, newPassword: tempPassword };
}
function getUsers_safe() {
  return getAllUsers().map(stripHash);
}
function createUser(data) {
  var _a;
  const users = getAllUsers();
  if (users.find((u) => u.username.toLowerCase() === data.username.trim().toLowerCase())) {
    return { success: false, error: "Username already exists" };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newUser = {
    id: crypto.randomUUID(),
    username: data.username.trim(),
    passwordHash: hashPassword(data.password),
    displayName: data.displayName.trim() || data.username.trim(),
    role: data.role,
    email: ((_a = data.email) == null ? void 0 : _a.trim()) || void 0,
    createdAt: now
  };
  dbUpsert("users", newUser.id, newUser);
  return { success: true, user: stripHash(newUser) };
}
function deleteUserById(userId) {
  dbDelete("users", userId);
  return { success: true };
}
function updateUserById(userId, data) {
  var _a, _b;
  const users = getAllUsers();
  const existing = users.find((u) => u.id === userId);
  if (!existing) return { success: false, error: "User not found" };
  const updated = {
    ...existing,
    displayName: ((_a = data.displayName) == null ? void 0 : _a.trim()) || existing.displayName,
    role: data.role || existing.role,
    email: ((_b = data.email) == null ? void 0 : _b.trim()) || existing.email,
    passwordHash: data.password ? hashPassword(data.password) : existing.passwordHash
  };
  dbUpsert("users", updated.id, updated);
  return { success: true, user: stripHash(updated) };
}
function ensureAdminUser() {
  const users = getAllUsers();
  if (users.length === 0) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const admin = {
      id: crypto.randomUUID(),
      username: "admin",
      passwordHash: hashPassword("admin"),
      displayName: "Owner",
      role: "owner",
      email: "admin@riadhlibrary.local",
      createdAt: now
    };
    dbUpsert("users", admin.id, admin);
    console.log("[auth] Created default admin user (admin/admin)");
    return;
  }
  if (!users.some((u) => u.username.toLowerCase() === "admin")) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const admin = {
      id: crypto.randomUUID(),
      username: "admin",
      passwordHash: hashPassword("admin"),
      displayName: "Owner",
      role: "owner",
      email: "admin@riadhlibrary.local",
      createdAt: now
    };
    dbUpsert("users", admin.id, admin);
    console.log("[auth] Created missing admin user");
  }
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
function createWindow() {
  let preloadFile = "preload.mjs";
  if (!fs.existsSync(path.join(__dirname$1, preloadFile))) {
    const alt = "preload.js";
    if (fs.existsSync(path.join(__dirname$1, alt))) preloadFile = alt;
  }
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname$1, preloadFile),
      sandbox: true,
      contextIsolation: true,
      // explicit – defence in depth
      nodeIntegration: false,
      // explicit – defence in depth
      webviewTag: false,
      // block <webview> injection
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isDev && url.startsWith(process.env.VITE_DEV_SERVER_URL)) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "file:") {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  if (!isDev) {
    win.webContents.on("devtools-opened", () => {
      win.webContents.closeDevTools();
    });
  }
  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
}
app.whenReady().then(() => {
  const devServer = process.env.VITE_DEV_SERVER_URL || "";
  const connectSrc = devServer ? `'self' ${devServer} ws:` : "'self'";
  const scriptSrc = devServer ? "'self' 'unsafe-inline'" : "'self'";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src ${connectSrc}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
        ]
      }
    });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  initDatabase();
  ensureAdminUser();
  createWindow();
});
app.on("window-all-closed", () => {
  closeDatabase();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
ipcMain.handle("auth:login", (_evt, username, password) => {
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
ipcMain.handle("auth:reset-password", (_evt, username, email) => {
  return resetPassword(username, email);
});
ipcMain.handle("user:get-all", () => {
  return getUsers_safe();
});
ipcMain.handle("user:create", (_evt, data) => {
  if (!isAuthenticated()) return { success: false, error: "AUTH_REQUIRED" };
  return createUser(data);
});
ipcMain.handle("user:delete", (_evt, userId) => {
  if (!isAuthenticated()) return { success: false, error: "AUTH_REQUIRED" };
  return deleteUserById(userId);
});
ipcMain.handle("user:update", (_evt, userId, data) => {
  if (!isAuthenticated()) return { success: false, error: "AUTH_REQUIRED" };
  return updateUserById(userId, data);
});
function stripPasswordHashes(data) {
  const result = { ...data };
  if (Array.isArray(result.users)) {
    result.users = result.users.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ passwordHash: _ph, ...rest }) => rest
    );
  }
  return result;
}
ipcMain.handle("db:load-all", () => {
  heartbeat();
  return stripPasswordHashes(dbLoadAll());
});
ipcMain.handle("db:get-all", (_evt, table) => {
  heartbeat();
  if (table === "users") return getUsers_safe();
  return dbGetAll(table);
});
ipcMain.handle("db:upsert", (_evt, table, id, data) => {
  if (!isAuthenticated()) throw new Error("AUTH_REQUIRED");
  if (table === "users") throw new Error("Use user:create / user:update IPC");
  heartbeat();
  return dbUpsert(table, id, data);
});
ipcMain.handle("db:delete", (_evt, table, id) => {
  if (!isAuthenticated()) throw new Error("AUTH_REQUIRED");
  if (table === "users") throw new Error("Use user:delete IPC");
  heartbeat();
  return dbDelete(table, id);
});
ipcMain.handle("db:save-all", (_evt, table, items) => {
  if (!isAuthenticated()) throw new Error("AUTH_REQUIRED");
  if (table === "users") throw new Error("Use user: IPC for user management");
  heartbeat();
  return dbSaveAll(table, items);
});
ipcMain.handle("db:get-setting", (_evt, key) => {
  heartbeat();
  return dbGetSetting(key);
});
ipcMain.handle("db:save-setting", (_evt, key, value) => {
  if (!isAuthenticated()) throw new Error("AUTH_REQUIRED");
  heartbeat();
  if (key === "app_settings") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed.sessionTimeoutMinutes === "number") {
        setSessionTimeout(parsed.sessionTimeoutMinutes);
      }
    } catch {
    }
  }
  return dbSaveSetting(key, value);
});
ipcMain.handle("db:import-all", (_evt, data) => {
  if (!isAuthenticated()) throw new Error("AUTH_REQUIRED");
  heartbeat();
  return dbImportAll(data);
});
ipcMain.handle("print-receipt", async (_evt, html) => {
  const printWin = new BrowserWindow({
    show: false,
    width: 350,
    height: 600,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
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
ipcMain.handle("backup-data", async (_evt, json) => {
  console.log("backup-data", json);
  return { success: true };
});
ipcMain.handle("restore-data", async () => {
  console.log("restore-data");
  return { success: true };
});
ipcMain.handle("auto-backup", async (_evt, json) => {
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
