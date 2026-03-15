import { app as R, Menu as j, session as A, ipcMain as a, BrowserWindow as D, Notification as B } from "electron";
import w from "path";
import { fileURLToPath as W } from "url";
import L from "fs";
import F from "better-sqlite3";
import d from "crypto";
let i;
const h = [
  "products",
  "transactions",
  "customers",
  "users",
  "suppliers",
  "purchase_orders",
  "expenses",
  "audit_logs"
];
function Y() {
  const s = w.join(R.getPath("userData"), "bookshop.db");
  console.log("[database] Opening SQLite DB at:", s), i = new F(s), i.pragma("journal_mode = WAL");
  for (const e of h)
    i.exec(`
      CREATE TABLE IF NOT EXISTS ${e} (
        id   TEXT PRIMARY KEY,
        json TEXT NOT NULL
      )
    `);
  i.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `), console.log("[database] Initialised successfully");
}
function v(s) {
  return h.includes(s) ? i.prepare(`SELECT json FROM ${s}`).all().map((t) => JSON.parse(t.json)) : [];
}
function f(s, e, t) {
  h.includes(s) && i.prepare(`INSERT OR REPLACE INTO ${s} (id, json) VALUES (?, ?)`).run(e, JSON.stringify(t));
}
function M(s, e) {
  h.includes(s) && i.prepare(`DELETE FROM ${s} WHERE id = ?`).run(e);
}
function N(s, e) {
  if (!h.includes(s)) return;
  const t = i.prepare(`DELETE FROM ${s}`), n = i.prepare(`INSERT INTO ${s} (id, json) VALUES (?, ?)`);
  i.transaction(() => {
    t.run();
    for (const r of e)
      n.run(r.id, JSON.stringify(r));
  })();
}
function U(s) {
  const e = i.prepare("SELECT value FROM settings WHERE key = ?").get(s);
  return (e == null ? void 0 : e.value) ?? null;
}
function Q(s, e) {
  i.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(s, e);
}
function X() {
  const s = {};
  for (const t of h)
    s[t] = v(t);
  const e = U("app_settings");
  return s.settings = e ? JSON.parse(e) : null, s;
}
function J(s) {
  i.transaction(() => {
    for (const [e, t] of Object.entries(s))
      h.includes(e) && Array.isArray(t) && N(e, t);
  })();
}
function q() {
  i && (console.log("[database] Closing"), i.close());
}
const O = 64, H = 16384, P = 8, $ = 1;
let u = null, I = 30;
const _ = /* @__PURE__ */ new Map(), k = 5, K = 15 * 60 * 1e3;
function g(s) {
  const e = d.randomBytes(16).toString("hex"), t = d.scryptSync(s, e, O, {
    N: H,
    r: P,
    p: $
  });
  return `scrypt$${e}$${t.toString("hex")}`;
}
function G(s, e) {
  const t = e.split("$");
  if (t[0] !== "scrypt" || t.length !== 3) return !1;
  const n = t[1], r = t[2], o = d.scryptSync(s, n, O, {
    N: H,
    r: P,
    p: $
  }).toString("hex");
  try {
    return d.timingSafeEqual(
      Buffer.from(r, "hex"),
      Buffer.from(o, "hex")
    );
  } catch {
    return !1;
  }
}
function z(s) {
  const e = "ric_library_salt_v3_secure", t = e + s + e;
  let n = 3735928559, r = 1103547991;
  for (let l = 0; l < 200; l++) {
    const p = l === 0 ? t : `${n.toString(16)}:${t}:${r.toString(16)}`;
    for (let T = 0; T < p.length; T++) {
      const b = p.charCodeAt(T);
      n = Math.imul(n ^ b, 2654435761), r = Math.imul(r ^ b, 1597334677);
    }
    n = Math.imul(n ^ n >>> 16, 2246822507), n ^= Math.imul(r ^ r >>> 13, 3266489909), r = Math.imul(r ^ r >>> 16, 2246822507), r ^= Math.imul(n ^ n >>> 13, 3266489909);
  }
  return "v2_" + (4294967296 * (2097151 & r) + (n >>> 0)).toString(36);
}
function Z(s) {
  const e = "ric_library_salt_v2", t = e + s + e;
  let n = 3735928559, r = 1103547991;
  for (let l = 0; l < t.length; l++) {
    const p = t.charCodeAt(l);
    n = Math.imul(n ^ p, 2654435761), r = Math.imul(r ^ p, 1597334677);
  }
  return n = Math.imul(n ^ n >>> 16, 2246822507), n ^= Math.imul(r ^ r >>> 13, 3266489909), r = Math.imul(r ^ r >>> 16, 2246822507), r ^= Math.imul(n ^ n >>> 13, 3266489909), "sha_" + (4294967296 * (2097151 & r) + (n >>> 0)).toString(36) + "_" + s.length;
}
function ee(s, e) {
  return e.startsWith("scrypt$") ? G(s, e) : e.startsWith("v2_") ? e === z(s) : e.startsWith("sha_") ? e === Z(s) : !1;
}
function se(s) {
  return !s.startsWith("scrypt$");
}
function te(s) {
  const e = s.trim().toLowerCase(), t = _.get(e);
  if (!t || t.count < k) return { locked: !1, remainingMs: 0 };
  const n = t.lockedUntil - Date.now();
  return n <= 0 ? (_.delete(e), { locked: !1, remainingMs: 0 }) : { locked: !0, remainingMs: n };
}
function C(s) {
  const e = s.trim().toLowerCase(), t = _.get(e) ?? { count: 0, lockedUntil: 0 };
  t.count++, t.count >= k && (t.lockedUntil = Date.now() + K), _.set(e, t);
}
function ne(s) {
  _.delete(s.trim().toLowerCase());
}
function S(s) {
  return {
    id: s.id,
    username: s.username,
    displayName: s.displayName,
    role: s.role,
    email: s.email,
    createdAt: s.createdAt,
    lastLogin: s.lastLogin
  };
}
function E() {
  return v("users");
}
function re() {
  try {
    const s = U("app_settings");
    if (s) {
      const e = JSON.parse(s);
      typeof e.sessionTimeoutMinutes == "number" && (I = e.sessionTimeoutMinutes);
    }
  } catch {
  }
}
function oe(s, e) {
  re();
  const t = s.trim().toLowerCase(), n = te(t);
  if (n.locked)
    return { success: !1, error: "account_locked", lockedMs: n.remainingMs };
  const o = E().find((l) => l.username.toLowerCase() === t);
  return o ? ee(e, o.passwordHash) ? (ne(t), se(o.passwordHash) && (o.passwordHash = g(e), f("users", o.id, o), console.log(`[auth] Upgraded password hash for "${o.username}" to scrypt`)), o.lastLogin = (/* @__PURE__ */ new Date()).toISOString(), f("users", o.id, o), u = {
    userId: o.id,
    username: o.username,
    displayName: o.displayName,
    role: o.role,
    email: o.email,
    loginTime: Date.now(),
    lastActivity: Date.now()
  }, { success: !0, user: S(o) }) : (C(t), { success: !1, error: "invalid_credentials" }) : (C(t), { success: !1, error: "invalid_credentials" });
}
function ae() {
  u = null;
}
function x() {
  return u ? (Date.now() - u.lastActivity) / 1e3 / 60 > I ? (console.log("[auth] Session expired after inactivity"), u = null, null) : {
    ...u,
    user: {
      id: u.userId,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      email: u.email,
      createdAt: "",
      // not tracked in session
      lastLogin: void 0
    }
  } : null;
}
function c() {
  u && (u.lastActivity = Date.now());
}
function m() {
  return x() !== null;
}
function ie(s) {
  I = s;
}
function ue(s, e) {
  const n = E().find((o) => o.username === s);
  if (!n) return { success: !1, error: "user_not_found" };
  if (!n.email || n.email.toLowerCase() !== e.toLowerCase())
    return { success: !1, error: "email_mismatch" };
  const r = "reset_" + d.randomBytes(4).toString("hex");
  return n.passwordHash = g(r), f("users", n.id, n), { success: !0, newPassword: r };
}
function V() {
  return E().map(S);
}
function le(s) {
  var r;
  if (E().find((o) => o.username.toLowerCase() === s.username.trim().toLowerCase()))
    return { success: !1, error: "Username already exists" };
  const t = (/* @__PURE__ */ new Date()).toISOString(), n = {
    id: d.randomUUID(),
    username: s.username.trim(),
    passwordHash: g(s.password),
    displayName: s.displayName.trim() || s.username.trim(),
    role: s.role,
    email: ((r = s.email) == null ? void 0 : r.trim()) || void 0,
    createdAt: t
  };
  return f("users", n.id, n), { success: !0, user: S(n) };
}
function ce(s) {
  return M("users", s), { success: !0 };
}
function de(s, e) {
  var o, l;
  const n = E().find((p) => p.id === s);
  if (!n) return { success: !1, error: "User not found" };
  const r = {
    ...n,
    displayName: ((o = e.displayName) == null ? void 0 : o.trim()) || n.displayName,
    role: e.role || n.role,
    email: ((l = e.email) == null ? void 0 : l.trim()) || n.email,
    passwordHash: e.password ? g(e.password) : n.passwordHash
  };
  return f("users", r.id, r), { success: !0, user: S(r) };
}
function fe() {
  const s = E();
  if (s.length === 0) {
    const e = (/* @__PURE__ */ new Date()).toISOString(), t = {
      id: d.randomUUID(),
      username: "admin",
      passwordHash: g("admin"),
      displayName: "Owner",
      role: "owner",
      email: "admin@RIC_Library.local",
      createdAt: e
    };
    f("users", t.id, t), console.log("[auth] Created default admin user (admin/admin)");
    return;
  }
  if (!s.some((e) => e.username.toLowerCase() === "admin")) {
    const e = (/* @__PURE__ */ new Date()).toISOString(), t = {
      id: d.randomUUID(),
      username: "admin",
      passwordHash: g("admin"),
      displayName: "Owner",
      role: "owner",
      email: "admin@RIC_Library.local",
      createdAt: e
    };
    f("users", t.id, t), console.log("[auth] Created missing admin user");
  }
}
const me = W(import.meta.url), y = w.dirname(me);
function pe() {
  let s = "preload.mjs";
  if (!L.existsSync(w.join(y, s))) {
    const n = "preload.js";
    L.existsSync(w.join(y, n)) && (s = n);
  }
  const e = !!process.env.VITE_DEV_SERVER_URL, t = new D({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: w.join(y, s),
      sandbox: !0,
      contextIsolation: !0,
      // explicit – defence in depth
      nodeIntegration: !1,
      // explicit – defence in depth
      webviewTag: !1,
      // block <webview> injection
      allowRunningInsecureContent: !1,
      experimentalFeatures: !1,
      devTools: !1
      // disable DevTools completely
    }
  });
  t.webContents.on("will-navigate", (n, r) => {
    if (!(e && r.startsWith(process.env.VITE_DEV_SERVER_URL)))
      try {
        new URL(r).protocol !== "file:" && n.preventDefault();
      } catch {
        n.preventDefault();
      }
  }), t.webContents.setWindowOpenHandler(() => ({ action: "deny" })), t.webContents.on("devtools-opened", () => {
    t.webContents.closeDevTools();
  }), e ? t.loadURL(process.env.VITE_DEV_SERVER_URL) : t.loadFile(w.join(y, "../dist/index.html"));
}
R.whenReady().then(() => {
  j.setApplicationMenu(null);
  const s = process.env.VITE_DEV_SERVER_URL || "", e = s ? `'self' ${s} ws:` : "'self'", t = s ? "'self' 'unsafe-inline'" : "'self'";
  A.defaultSession.webRequest.onHeadersReceived((n, r) => {
    r({
      responseHeaders: {
        ...n.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self'; script-src ${t}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src ${e}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
        ]
      }
    });
  }), A.defaultSession.setPermissionRequestHandler((n, r, o) => {
    o(!1);
  }), Y(), fe(), pe();
});
R.on("window-all-closed", () => {
  q(), process.platform !== "darwin" && R.quit();
});
a.handle("auth:login", (s, e, t) => oe(e, t));
a.handle("auth:logout", () => (ae(), { success: !0 }));
a.handle("auth:get-session", () => x());
a.handle("auth:heartbeat", () => (c(), !0));
a.handle("auth:reset-password", (s, e, t) => ue(e, t));
a.handle("user:get-all", () => V());
a.handle("user:create", (s, e) => m() ? le(e) : { success: !1, error: "AUTH_REQUIRED" });
a.handle("user:delete", (s, e) => m() ? ce(e) : { success: !1, error: "AUTH_REQUIRED" });
a.handle("user:update", (s, e, t) => m() ? de(e, t) : { success: !1, error: "AUTH_REQUIRED" });
function he(s) {
  const e = { ...s };
  return Array.isArray(e.users) && (e.users = e.users.map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ passwordHash: t, ...n }) => n
  )), e;
}
a.handle("db:load-all", () => (c(), he(X())));
a.handle("db:get-all", (s, e) => (c(), e === "users" ? V() : v(e)));
a.handle("db:upsert", (s, e, t, n) => {
  if (!m()) throw new Error("AUTH_REQUIRED");
  if (e === "users") throw new Error("Use user:create / user:update IPC");
  return c(), f(e, t, n);
});
a.handle("db:delete", (s, e, t) => {
  if (!m()) throw new Error("AUTH_REQUIRED");
  if (e === "users") throw new Error("Use user:delete IPC");
  return c(), M(e, t);
});
a.handle("db:save-all", (s, e, t) => {
  if (!m()) throw new Error("AUTH_REQUIRED");
  if (e === "users") throw new Error("Use user: IPC for user management");
  return c(), N(e, t);
});
a.handle("db:get-setting", (s, e) => (c(), U(e)));
a.handle("db:save-setting", (s, e, t) => {
  if (!m()) throw new Error("AUTH_REQUIRED");
  if (c(), e === "app_settings")
    try {
      const n = JSON.parse(t);
      typeof n.sessionTimeoutMinutes == "number" && ie(n.sessionTimeoutMinutes);
    } catch {
    }
  return Q(e, t);
});
a.handle("db:import-all", (s, e) => {
  if (!m()) throw new Error("AUTH_REQUIRED");
  return c(), J(e);
});
a.handle("print-receipt", async (s, e) => {
  const t = new D({
    show: !1,
    width: 350,
    height: 600,
    webPreferences: { nodeIntegration: !1, contextIsolation: !0 }
  });
  await t.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(e)}`
  ), t.webContents.print(
    { silent: !1, printBackground: !0 },
    (n, r) => {
      t.close();
    }
  );
});
a.handle("backup-data", async (s, e) => (console.log("backup-data", e), { success: !0 }));
a.handle("restore-data", async () => (console.log("restore-data"), { success: !0 }));
a.handle("auto-backup", async (s, e) => (console.log("auto-backup", e), { success: !0 }));
a.handle("import-csv", async () => (console.log("import-csv"), { canceled: !0 }));
a.on("show-notification", (s, { title: e, body: t }) => {
  new B({ title: e, body: t }).show();
});
