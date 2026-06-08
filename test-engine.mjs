import { initEngine, detect, explainFinding, shutdown } from "./src/engine.mjs";

await initEngine(s => console.log("[status]", s));
const findings = detect({ expensesPath: "./sample-data/expenses.csv", inventoryPath: "./sample-data/inventory.csv" });
console.log(`\nDetected ${findings.length} findings. Explaining the first 3 with local AI…\n`);

for (const f of findings.slice(0, 3)) {
  const explanation = await explainFinding(f);
  console.log(`● [${f.severity.toUpperCase()}] ${f.type}`);
  console.log(`  Finding: ${f.detail}`);
  console.log(`  AI: ${explanation}\n`);
}
await shutdown();
console.log("[done]");
