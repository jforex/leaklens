import { initEngine, detect, explainFinding, buildSummary, askData, itemBreakdown, askItemSentence, shutdown } from "../src/engine.mjs";

const ts = () => new Date().toISOString();
console.log(`[${ts()}] LeakLens inference log — all inference local via QVAC SDK on CPU-only Intel MacBook`);

const t0 = Date.now();
await initEngine(s => console.log(`[${ts()}] STATUS: ${s}`));
console.log(`[${ts()}] Model load time: ${((Date.now()-t0)/1000).toFixed(1)}s`);

const paths = {
  expensesPath: "./sample-data/expenses.csv",
  inventoryPath: "./sample-data/inventory.csv",
  purchasesPath: "./sample-data/purchases.csv",
  salesPath: "./sample-data/sales.csv",
};

const findings = detect(paths);
console.log(`[${ts()}] Deterministic detection: ${findings.length} findings`);

const f = findings[0];
const e0 = Date.now();
const ex = await explainFinding(f);
console.log(`[${ts()}] AI explanation (${((Date.now()-e0)/1000).toFixed(1)}s): ${ex}`);

const summary = buildSummary(paths);
const q = "what is our best-selling item?";
const a0 = Date.now();
const ans = await askData(q, summary);
console.log(`[${ts()}] Q: "${q}"`);
console.log(`[${ts()}] A (${((Date.now()-a0)/1000).toFixed(1)}s): ${ans}`);

await shutdown();
console.log(`[${ts()}] Shutdown complete. Total run: ${((Date.now()-t0)/1000).toFixed(1)}s`);
