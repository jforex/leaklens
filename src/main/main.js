const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

let win;
let engine = null; // loaded lazily as ESM

async function getEngine() {
  if (!engine) engine = await import(path.join(__dirname, "..", "engine.mjs"));
  return engine;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 820,
    backgroundColor: "#0d100f",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

ipcMain.handle("engine:init", async () => {
  const e = await getEngine();
  await e.initEngine((s) => win.webContents.send("engine:status", s));
  return { ok: true };
});

ipcMain.handle("engine:pick-file", async (_e, kind) => {
  const r = await dialog.showOpenDialog(win, { properties: ["openFile"], filters: [{ name: "CSV", extensions: ["csv"] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

ipcMain.handle("engine:analyze", async (_e, paths) => {
  const e = await getEngine();
  const findings = e.detect(paths);
  return findings;
});

ipcMain.handle("engine:explain", async (_e, finding) => {
  const e = await getEngine();
  return await e.explainFinding(finding);
});

ipcMain.handle("engine:ask-data", async (_e, { question, paths }) => {
  const e = await getEngine();
  const breakdown = e.itemBreakdown(question, paths);
  if (breakdown) {
    // Item-specific: numbers come from code (a table); model adds ONE short sentence it cannot contradict.
    const text = await e.askItemSentence(question, breakdown);
    return { breakdown, text };
  }
  const summary = e.buildSummary(paths);
  const text = await e.askData(question, summary);
  return { breakdown: null, text };
});

ipcMain.handle("engine:use-samples", async () => {
  const sd = (n) => path.join(__dirname, "..", "..", "sample-data", n);
  return {
    expensesPath: sd("expenses.csv"),
    inventoryPath: sd("inventory.csv"),
    purchasesPath: sd("purchases.csv"),
    salesPath: sd("sales.csv"),
  };
});
