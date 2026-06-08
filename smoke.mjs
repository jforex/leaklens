import { loadModel, completion, unloadModel, QWEN3_1_7B_INST_Q4 } from "@qvac/sdk";
console.log("SDK imported OK");
const id = await loadModel({ modelSrc: QWEN3_1_7B_INST_Q4, modelType: "llm", modelConfig: { ctx_size: 4096, tools: true, gpu_layers: 0 } });
console.log("model loaded:", id ? "OK" : "FAIL");
const r = completion({ modelId: id, history: [{ role: "user", content: "Say 'ready' in one word." }], stream: false });
console.log("response:", (await r.final).contentText.trim());
await unloadModel({ modelId: id });
console.log("[smoke done]");
