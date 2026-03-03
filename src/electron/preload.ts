import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  printReceipt: (html: string) => ipcRenderer.invoke("print-receipt", html),
  backupData: (json: string) => ipcRenderer.invoke("backup-data", json),
  restoreData: () => ipcRenderer.invoke("restore-data"),
  autoBackup: (json: string) => ipcRenderer.invoke("auto-backup", json),
  showNotification: (title: string, body: string) =>
    ipcRenderer.send("show-notification", { title, body }),
  importCSV: () => ipcRenderer.invoke("import-csv"),
});
