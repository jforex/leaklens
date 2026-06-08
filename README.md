# LeakLens

**A local-first "truth layer" for small-business records.** LeakLens imports your business data (expenses, inventory, purchases, sales), detects leaks and anomalies with a deterministic engine, and uses a fully on-device AI model to explain each finding in plain language and answer free-form questions about your data. Nothing ever leaves your device.

Built for the **QVAC Unleash Edge AI Hackathon** — General Purpose track.

---

## The problem

Most small and medium businesses have data — sales records, expense logs, inventory counts — but no one verifies whether that data reflects *reality*. Records are entered manually, inconsistently, and sometimes dishonestly. Money leaks out silently: duplicate payments, unapproved spending, stock that disappears without a recorded sale. These losses stay invisible until it is far too late.

The records are not the problem. The absence of anyone cross-checking them against reality is.

## What LeakLens does

LeakLens answers one question: **"Does what your business claims match what actually happened?"**

It does this in three layers:

1. **Deterministic detection** — rules and arithmetic find anomalies. This layer cannot hallucinate; a leak is a leak because the math says so.
2. **Local AI explanation** — an on-device language model explains *why* each finding matters and suggests a next step, in plain business language.
3. **Ask your data** — free-form natural-language questions are answered from figures computed in code, so answers are grounded in real numbers, never invented.

### Detectors

**Expense anomalies**
- Duplicate / repeated expenses (same vendor, amount, category, close in time)
- Missing records (no approval, vendor, or description)
- Spending spikes (amounts far above the baseline average)
- Recurring identical charges (possible repeated logging)

**Inventory–sales reconciliation (multi-period)**
For each item, across the whole period:

    expected_remaining = initial_stock + purchases - sales
    leak               = expected_remaining - counted_closing

- **Unexplained loss** (leak > 0): stock gone without a matching sale — possible theft, spoilage, or unrecorded sale.
- **Stock surplus / ghost entry** (leak < 0): more stock than expected — possible unrecorded purchase or logging error.

Each finding shows the full breakdown (initial + purchased - sold = expected vs counted) so a human can see exactly how the number was reached. No black box.

## Why local-first matters here

Financial and inventory data is exactly the kind of information a business will **not** upload to a cloud service. LeakLens runs entirely on-device using the QVAC SDK — the detection engine is local code, and the AI model runs locally with no network calls. Your books never leave your machine.

## Architecture

The core design principle: **deterministic code computes the truth; the AI model only handles language.**

    CSV data -> Deterministic detectors -> Findings (facts)
                                             |
                                             +-> Local LLM -> plain-English explanation per finding
                                             |
    "Ask your data" -> figures computed in code -> Local LLM -> grounded answer

This split is what makes LeakLens trustworthy. The model never invents a leak and never does the arithmetic behind an answer — it phrases facts that were already computed. For item-specific questions, the exact figures are rendered directly from code as a breakdown table, with the model adding only a single sentence on top.

- **Detection engine:** src/detectors.mjs (pure functions, no AI)
- **AI + orchestration:** src/engine.mjs (QVAC model load, explanations, query answering)
- **Desktop shell:** Electron (src/main/), web-based UI (src/renderer/)

## Local model

- Model: Qwen3-1.7B-Q4_0 (GGUF)
- Runtime: QVAC SDK (@qvac/sdk)
- Inference: CPU-only (gpu_layers: 0)
- Context: 4096 tokens

## Requirements

- Node.js (tested on v25)
- macOS / Linux / Windows desktop
- ~1 GB disk for the model (downloaded and cached on first run)
- No GPU required — runs on CPU

## Setup & reproducibility

    git clone https://github.com/jforex/leaklens.git
    cd leaklens
    npm install
    npm start

On first launch:

1. Click **INITIALISE** — loads the local AI model (cached after first download).
2. Click **USE SAMPLE DATA** to try the bundled example files, or load your own CSVs with the + EXPENSES / INVENTORY / PURCHASES / SALES buttons.
3. Click **ANALYZE** — findings appear instantly, each with an AI explanation.
4. Use **Ask your data** to ask free-form questions ("what's our best-selling item?", "how much oil is unaccounted for?").

### Data formats

- expenses.csv — id, date, time, category, vendor, amount, description, approved_by
- inventory.csv — item, initial_stock, counted_closing, unit
- purchases.csv — date, item, quantity, cost
- sales.csv — date, item, quantity_sold

Bundled sample data (in sample-data/) contains deliberately planted anomalies so you can see every detector fire.

## Evidence

The evidence/ folder contains:
- hardware.txt — the constrained consumer hardware this was built and verified on (Intel Core i7, 16 GB, CPU-only, macOS).
- inference-log.txt — a timed end-to-end run showing local model load, detection, AI explanation, and Q&A, with the QVAC engine logs.

## Roadmap — from vertical to platform

LeakLens ships today as one focused vertical: a business leak detector for desktop. The architecture underneath is intentionally general — the same detection-plus-explanation engine is designed to extend to:

- **More verticals** — logistics/dispatch reconciliation, field-service records, retail multi-location stock, by swapping the detectors and knowledge.
- **Mobile** — the QVAC SDK is expanding hardware coverage; the same local-first engine is designed to run on-device on phones for field use.
- **Multi-day live ledgers** — rolling stock balances and continuous reconciliation rather than period snapshots.

The goal is a local-first "truth layer" that any business can point at its own records — ship the vertical, build the platform underneath.

## License

MIT — see LICENSE.
