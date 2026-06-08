import { parseCSV, auditInventory } from "./src/detectors.mjs";
const findings = auditInventory({
  inventory: parseCSV("./sample-data/inventory.csv"),
  purchases: parseCSV("./sample-data/purchases.csv"),
  sales: parseCSV("./sample-data/sales.csv"),
});
for (const f of findings) console.log(`[${f.severity.toUpperCase()}] ${f.type}: ${f.detail}`);
console.log(`\n${findings.length} inventory findings`);
