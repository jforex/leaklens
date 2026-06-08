// LeakLens detection engine — deterministic rules. No AI here; this is the trustworthy core.
import { readFileSync } from "node:fs";

export function parseCSV(path) {
  const lines = readFileSync(path, "utf8").trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => row[h] = (cells[i] ?? "").trim());
    return row;
  });
}

export function auditExpenses(rows) {
  const findings = [];
  const amounts = rows.map(r => Number(r.amount)).filter(n => !isNaN(n));
  const mean = amounts.reduce((a,b)=>a+b,0) / (amounts.length || 1);

  for (let i = 0; i < rows.length; i++) {
    for (let j = i+1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.date === b.date && a.vendor === b.vendor && a.amount === b.amount && a.category === b.category && a.vendor !== "") {
        const mins = Math.abs(toMin(a.time) - toMin(b.time));
        findings.push({
          type: "Duplicate expense",
          severity: mins <= 15 ? "high" : "medium",
          detail: `${a.category} N${a.amount} from ${a.vendor} recorded twice on ${a.date}${mins<=60?` (${mins} min apart)`:""} - rows ${a.id} & ${b.id}.`,
        });
      }
    }
  }

  for (const r of rows) {
    const missing = [];
    if (!r.approved_by) missing.push("approval");
    if (!r.vendor) missing.push("vendor");
    if (!r.description) missing.push("description");
    if (missing.length) findings.push({
      type: "Missing record",
      severity: missing.includes("approval") ? "high" : "low",
      detail: `Expense row ${r.id} (${r.category} N${r.amount}) is missing: ${missing.join(", ")}.`,
    });
  }

  for (const r of rows) {
    const amt = Number(r.amount);
    if (!isNaN(amt) && amt > 3 * mean) findings.push({
      type: "Spending spike",
      severity: "high",
      detail: `Expense row ${r.id} (${r.category} N${amt}) is ${(amt/mean).toFixed(1)}x the average expense (N${Math.round(mean)}).`,
    });
  }

  const groups = {};
  for (const r of rows) {
    if (!r.vendor) continue;
    const k = `${r.vendor}|${r.amount}|${r.category}`;
    (groups[k] ??= []).push(r.id);
  }
  for (const [k, ids] of Object.entries(groups)) {
    if (ids.length >= 3) {
      const [vendor, amount, cat] = k.split("|");
      findings.push({
        type: "Recurring charge",
        severity: "medium",
        detail: `${cat} N${amount} from ${vendor} recurs ${ids.length} times (rows ${ids.join(", ")}) - verify it is not repeated logging.`,
      });
    }
  }
  return findings;
}

export function auditInventory({ inventory, purchases, sales }) {
  const findings = [];
  // Sum purchases and sales per item across the whole period (multi-day).
  const purByItem = {}, salByItem = {};
  for (const p of purchases || []) purByItem[p.item] = (purByItem[p.item] || 0) + Number(p.quantity || 0);
  for (const s of sales || []) salByItem[s.item] = (salByItem[s.item] || 0) + Number(s.quantity_sold || 0);

  for (const r of inventory || []) {
    const initial = Number(r.initial_stock), counted = Number(r.counted_closing);
    if (isNaN(initial) || isNaN(counted)) {
      findings.push({ type: "Missing record", severity: "low", detail: `Inventory master for ${r.item} has invalid/missing stock numbers.` });
      continue;
    }
    const bought = purByItem[r.item] || 0;
    const sold = salByItem[r.item] || 0;
    const expected = initial + bought - sold;
    const leak = expected - counted;
    const u = r.unit || "";
    const breakdown = `initial ${initial}${u} + purchased ${bought}${u} - sold ${sold}${u} = expected ${expected}${u}, but counted ${counted}${u}`;
    if (leak > 0) findings.push({
      type: "Unexplained loss",
      severity: leak >= 0.2 * Math.max(expected,1) ? "high" : "medium",
      detail: `${r.item}: ${leak}${u} unaccounted (${breakdown}). Possible theft, spoilage, or unrecorded sale.`,
    });
    else if (leak < 0) findings.push({
      type: "Stock surplus / ghost entry",
      severity: "medium",
      detail: `${r.item}: ${-leak}${u} more in stock than expected (${breakdown}). Possible unrecorded purchase or logging error.`,
    });
  }
  return findings;
}

function toMin(t) { const [h,m] = (t||"0:0").split(":").map(Number); return (h||0)*60 + (m||0); }
