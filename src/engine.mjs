// LeakLens engine — connects deterministic detectors to the local QVAC LLM for plain-English explanations.
import { loadModel, completion, unloadModel, QWEN3_1_7B_INST_Q4 } from "@qvac/sdk";
import { parseCSV, auditExpenses, auditInventory } from "./detectors.mjs";

let llmId = null;

export async function initEngine(onStatus = () => {}) {
  if (llmId) return;
  onStatus("Loading local AI model (QVAC)…");
  llmId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelType: "llm",
    modelConfig: { ctx_size: 4096, gpu_layers: 0 },
  });
  onStatus("Ready — all analysis runs locally on this device.");
}

// Run deterministic detection on whichever files are provided.
export function detect({ expensesPath, inventoryPath, purchasesPath, salesPath }) {
  const findings = [];
  if (expensesPath) findings.push(...auditExpenses(parseCSV(expensesPath)));
  if (inventoryPath) {
    findings.push(...auditInventory({
      inventory: parseCSV(inventoryPath),
      purchases: purchasesPath ? parseCSV(purchasesPath) : [],
      sales: salesPath ? parseCSV(salesPath) : [],
    }));
  }
  return findings;
}

// Ask the local LLM to explain a single finding in plain business English.
export async function explainFinding(finding) {
  if (!llmId) throw new Error("Engine not initialised");
  const history = [
    {
      role: "system",
      content:
        "You are LeakLens, a local business auditor. You are given ONE anomaly already detected in a business's records. " +
        "In 1-2 short sentences, explain in plain language why it matters and suggest one concrete next step. " +
        "Be direct and practical. Do not invent extra numbers or facts beyond what is given. No preamble.",
    },
    { role: "user", content: `Anomaly (${finding.severity} severity): ${finding.detail}` },
  ];
  const r = completion({ modelId: llmId, history, stream: false });
  const out = (await r.final).contentText || "";
  return out.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<\/?think>/g, "").trim();
}

// Compute an accurate factual summary of the data IN CODE (the model never does math).
export function buildSummary({ expensesPath, inventoryPath, purchasesPath, salesPath }) {
  const lines = [];
  if (salesPath) {
    const sales = parseCSV(salesPath);
    const byItem = {};
    for (const r of sales) byItem[r.item] = (byItem[r.item] || 0) + Number(r.quantity_sold || 0);
    const sorted = Object.entries(byItem).sort((a,b)=>b[1]-a[1]);
    lines.push("SALES (units sold per item): " + sorted.map(([k,v])=>`${k}=${v}`).join(", "));
    if (sorted.length) {
      lines.push(`Best-selling item: ${sorted[0][0]} (${sorted[0][1]} units).`);
      lines.push(`Worst-selling item: ${sorted[sorted.length-1][0]} (${sorted[sorted.length-1][1]} units).`);
    }
  }
  if (inventoryPath) {
    const inv = parseCSV(inventoryPath);
    // pre-compute purchases and sales per item so figures are clearly labeled
    const purByItem = {}, salByItem = {};
    if (purchasesPath) for (const p of parseCSV(purchasesPath)) purByItem[p.item] = (purByItem[p.item]||0) + Number(p.quantity||0);
    if (salesPath) for (const sl of parseCSV(salesPath)) salByItem[sl.item] = (salByItem[sl.item]||0) + Number(sl.quantity_sold||0);
    const soldItems = new Set(Object.keys(salByItem));
    const noSales = inv.map(r=>r.item).filter(it=>!soldItems.has(it) || (salByItem[it]||0)===0);
    if (noSales.length) lines.push("Items with NO recorded sales: " + noSales.join(", "));
    lines.push("INVENTORY DETAIL (per item):");
    for (const r of inv) {
      const initial = Number(r.initial_stock)||0;
      const purchased = purByItem[r.item]||0;
      const available = initial + purchased;           // total we had access to
      const sold = salByItem[r.item]||0;
      const counted = Number(r.counted_closing)||0;    // units remaining (physically counted)
      const expected = available - sold;               // what should remain
      const leak = expected - counted;                 // unaccounted
      const u = r.unit||"";
      lines.push(`  ${r.item}: initial stock ${initial}${u}; purchased ${purchased}${u}; total available ${available}${u}; sold ${sold}${u}; units remaining (counted) ${counted}${u}; expected remaining ${expected}${u}; unaccounted/leak ${leak}${u}.`);
    }
  }
  if (purchasesPath) {
    const pur = parseCSV(purchasesPath);
    const byItem = {}, cost = {};
    for (const r of pur) { byItem[r.item]=(byItem[r.item]||0)+Number(r.quantity||0); cost[r.item]=(cost[r.item]||0)+Number(r.cost||0); }
    lines.push("PURCHASES (units bought): " + Object.entries(byItem).map(([k,v])=>`${k}=${v}`).join(", "));
    lines.push("Purchase spend per item: " + Object.entries(cost).map(([k,v])=>`${k}=N${v}`).join(", "));
  }
  if (expensesPath) {
    const exp = parseCSV(expensesPath);
    const byCat = {};
    for (const r of exp) byCat[r.category]=(byCat[r.category]||0)+Number(r.amount||0);
    const total = Object.values(byCat).reduce((a,b)=>a+b,0);
    lines.push("EXPENSES total: N" + total + ". By category: " + Object.entries(byCat).map(([k,v])=>`${k}=N${v}`).join(", "));
  }
  return lines.join("\n");
}

// Detect if a question targets a specific inventory item; if so, compute its exact breakdown.
export function itemBreakdown(question, { inventoryPath, purchasesPath, salesPath }) {
  if (!inventoryPath) return null;
  const inv = parseCSV(inventoryPath);
  const q = question.toLowerCase();
  const match = inv.find(r => q.includes((r.item || "").toLowerCase()));
  if (!match) return null;

  const purByItem = {}, salByItem = {};
  if (purchasesPath) for (const p of parseCSV(purchasesPath)) purByItem[p.item] = (purByItem[p.item]||0) + Number(p.quantity||0);
  if (salesPath) for (const sl of parseCSV(salesPath)) salByItem[sl.item] = (salByItem[sl.item]||0) + Number(sl.quantity_sold||0);

  const u = match.unit || "";
  const initial = Number(match.initial_stock)||0;
  const purchased = purByItem[match.item]||0;
  const available = initial + purchased;
  const sold = salByItem[match.item]||0;
  const counted = Number(match.counted_closing)||0;
  const expected = available - sold;
  const leak = expected - counted;

  return {
    item: match.item, unit: u, initial, purchased, available, sold, counted, expected, leak,
    rows: [
      ["Initial inventory", `${initial}${u}`],
      [purchased > 0 ? "Purchased (after initial)" : "Purchases recorded", purchased > 0 ? `${purchased}${u}` : "none"],
      ["Total available", `${available}${u}`],
      ["Total sold", `${sold}${u}`],
      ["Expected remaining", `${expected}${u}`],
      ["Counted remaining", `${counted}${u}`],
      ["Unaccounted / leak", `${leak}${u}`],
    ],
  };
}

export async function askData(question, summary) {
  if (!llmId) throw new Error("Engine not initialised");
  const history = [
    { role: "system", content:
      "You are LeakLens, a local business data assistant. Answer the user's question USING ONLY the data summary provided. " +
      "The numbers in the summary are already computed and correct — do not recompute or invent figures. " +
      "IMPORTANT distinctions: 'sold' / 'selling' / 'best/least selling' always refers to UNITS SOLD (sales volume), never stock remaining. " +
      "'remaining' / 'left' / 'in stock now' refers to units remaining (counted). 'had' / 'available' refers to total available (initial + purchased). " +
      "Treat the words stock, item, and product as the same thing. If a question has two parts (e.g. least selling AND how many left), answer BOTH parts explicitly with the correct figure for each. " +
      "If the answer is not in the summary, say you do not have that data. Answer in 1-3 short sentences, plain and direct." },
    { role: "user", content: `DATA SUMMARY:\n${summary}\n\nQUESTION: ${question}` },
  ];
  const r = completion({ modelId: llmId, history, stream: false });
  const out = (await r.final).contentText || "";
  return out.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<\/?think>/g, "").trim();
}

export async function askItemSentence(question, b) {
  if (!llmId) throw new Error("Engine not initialised");
  const facts = `Item: ${b.item}. Initial ${b.initial}${b.unit}, purchased ${b.purchased}${b.unit}, total available ${b.available}${b.unit}, sold ${b.sold}${b.unit}, expected remaining ${b.expected}${b.unit}, counted remaining ${b.counted}${b.unit}, unaccounted ${b.leak}${b.unit}.`;
  const history = [
    { role: "system", content:
      "You are LeakLens. You are given EXACT figures for one item (already shown to the user as a table). " +
      "Write ONE short sentence (max 25 words) directly answering the user's question using these figures. " +
      "Do NOT restate every number, do NOT contradict the figures, do NOT add facts. If a purchase value is 0, do not claim a purchase happened." },
    { role: "user", content: `${facts}\n\nQuestion: ${question}` },
  ];
  const r = completion({ modelId: llmId, history, stream: false });
  const out = (await r.final).contentText || "";
  return out.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<\/?think>/g, "").trim();
}

export async function shutdown() {
  if (llmId) { await unloadModel({ modelId: llmId }); llmId = null; }
}
