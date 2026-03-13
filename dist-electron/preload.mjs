"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // ── Authentication (runs in main process – secure) ──
  auth: {
    login: (username, password) => electron.ipcRenderer.invoke("auth:login", username, password),
    logout: () => electron.ipcRenderer.invoke("auth:logout"),
    getSession: () => electron.ipcRenderer.invoke("auth:get-session"),
    heartbeat: () => electron.ipcRenderer.invoke("auth:heartbeat"),
    resetPassword: (username, email) => electron.ipcRenderer.invoke("auth:reset-password", username, email)
  },
  // ── User management (passwords hashed in main process) ──
  users: {
    getAll: () => electron.ipcRenderer.invoke("user:get-all"),
    create: (data) => electron.ipcRenderer.invoke("user:create", data),
    delete: (userId) => electron.ipcRenderer.invoke("user:delete", userId),
    update: (userId, data) => electron.ipcRenderer.invoke("user:update", userId, data)
  },
  // ── Database operations ──
  db: {
    loadAll: () => electron.ipcRenderer.invoke("db:load-all"),
    getAll: (table) => electron.ipcRenderer.invoke("db:get-all", table),
    upsert: (table, id, data) => electron.ipcRenderer.invoke("db:upsert", table, id, data),
    delete: (table, id) => electron.ipcRenderer.invoke("db:delete", table, id),
    saveAll: (table, items) => electron.ipcRenderer.invoke("db:save-all", table, items),
    getSetting: (key) => electron.ipcRenderer.invoke("db:get-setting", key),
    saveSetting: (key, value) => electron.ipcRenderer.invoke("db:save-setting", key, value),
    importAll: (data) => electron.ipcRenderer.invoke("db:import-all", data)
  },
  // ── Existing methods ──
  printReceipt: (html) => electron.ipcRenderer.invoke("print-receipt", html),
  backupData: (json) => electron.ipcRenderer.invoke("backup-data", json),
  restoreData: () => electron.ipcRenderer.invoke("restore-data"),
  autoBackup: (json) => electron.ipcRenderer.invoke("auto-backup", json),
  showNotification: (title, body) => electron.ipcRenderer.send("show-notification", { title, body }),
  importCSV: () => electron.ipcRenderer.invoke("import-csv")
});
