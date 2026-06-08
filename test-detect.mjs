import { parseCSV, auditExpenses, auditInventory } from "./src/detectors.mjs";
const exp = auditExpenses(parseCSV("./sample-data/expenses.csv"));
const inv = auditInventory(parseCSV("./sample-data/inventory.csv"));
console.log("=== EXPENSE FINDINGS ===");
for (const f of exp) console.log(`[${f.severity.toUpperCase()}] ${f.type}: ${f.detail}`);
console.log("\n=== INVENTORY FINDINGS ===");
for (const f of inv) console.log(`[${f.severity.toUpperCase()}] ${f.type}: ${f.detail}`);
console.log(`\nTotal: ${exp.length + inv.length} findings (${exp.length} expense, ${inv.length} inventory)`);
