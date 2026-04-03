import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Authentication (runs in main process – secure) ──
  auth: {
    login: (username: string, password: string) =>
      ipcRenderer.invoke("auth:login", username, password),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getSession: () => ipcRenderer.invoke("auth:get-session"),
    heartbeat: () => ipcRenderer.invoke("auth:heartbeat"),
    requestReset: (username: string, email: string) =>
      ipcRenderer.invoke("auth:request-reset", username, email),
    verifyAndReset: (username: string, code: string, newPassword: string) =>
      ipcRenderer.invoke("auth:verify-and-reset", username, code, newPassword),
    checkCode: (username: string) =>
      ipcRenderer.invoke("auth:check-code", username),
  },

  // ── User management (passwords hashed in main process) ──
  users: {
    getAll: () => ipcRenderer.invoke("user:get-all"),
    create: (data: { username: string; password: string; displayName: string; role: string; email?: string }) =>
      ipcRenderer.invoke("user:create", data),
    delete: (userId: string) => ipcRenderer.invoke("user:delete", userId),
    update: (userId: string, data: { displayName?: string; role?: string; email?: string; password?: string }) =>
      ipcRenderer.invoke("user:update", userId, data),
  },

  // ── Database operations ──
  db: {
    loadAll: () => ipcRenderer.invoke("db:load-all"),
    getAll: (table: string) => ipcRenderer.invoke("db:get-all", table),
    upsert: (table: string, id: string, data: unknown) =>
      ipcRenderer.invoke("db:upsert", table, id, data),
    delete: (table: string, id: string) =>
      ipcRenderer.invoke("db:delete", table, id),
    saveAll: (table: string, items: unknown[]) =>
      ipcRenderer.invoke("db:save-all", table, items),
    getSetting: (key: string) => ipcRenderer.invoke("db:get-setting", key),
    saveSetting: (key: string, value: string) =>
      ipcRenderer.invoke("db:save-setting", key, value),
    importAll: (data: Record<string, unknown[]>) =>
      ipcRenderer.invoke("db:import-all", data),
  },

  // ── Existing methods ──
  printReceipt: (html: string) => ipcRenderer.invoke("print-receipt", html),
  backupData: (json: string) => ipcRenderer.invoke("backup-data", json),
  restoreData: () => ipcRenderer.invoke("restore-data"),
  autoBackup: (json: string) => ipcRenderer.invoke("auto-backup", json),
  showNotification: (title: string, body: string) =>
    ipcRenderer.send("show-notification", { title, body }),
  importCSV: () => ipcRenderer.invoke("import-csv"),
});
