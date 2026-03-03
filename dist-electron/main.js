import { app as s, ipcMain as n, Notification as c, BrowserWindow as l } from "electron";
import t from "path";
import { fileURLToPath as d } from "url";
import i from "fs";
const p = d(import.meta.url), a = t.dirname(p);
function u() {
  let o = "preload.js";
  if (!i.existsSync(t.join(a, o))) {
    const r = "preload.mjs";
    i.existsSync(t.join(a, r)) && (o = r);
  }
  const e = new l({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: t.join(a, o),
      // enable sandboxed renderer for security
      sandbox: !0
    }
  });
  process.env.VITE_DEV_SERVER_URL ? e.loadURL(process.env.VITE_DEV_SERVER_URL) : e.loadFile(t.join(a, "../dist/index.html"));
}
s.whenReady().then(u);
s.on("window-all-closed", () => {
  process.platform !== "darwin" && s.quit();
});
n.handle("print-receipt", async (o, e) => {
  console.log("print-receipt", e);
});
n.handle("backup-data", async (o, e) => (console.log("backup-data", e), { success: !0 }));
n.handle("restore-data", async () => (console.log("restore-data"), { success: !0 }));
n.handle("auto-backup", async (o, e) => (console.log("auto-backup", e), { success: !0 }));
n.handle("import-csv", async () => (console.log("import-csv"), { canceled: !0 }));
n.on("show-notification", (o, { title: e, body: r }) => {
  new c({ title: e, body: r }).show();
});
