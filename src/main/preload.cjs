const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("leaklens", {
  init: () => ipcRenderer.invoke("engine:init"),
  pickFile: (kind) => ipcRenderer.invoke("engine:pick-file", kind),
  analyze: (paths) => ipcRenderer.invoke("engine:analyze", paths),
  explain: (finding) => ipcRenderer.invoke("engine:explain", finding),
  useSamples: () => ipcRenderer.invoke("engine:use-samples"),
  askData: (question, paths) => ipcRenderer.invoke("engine:ask-data", { question, paths }),
  onStatus: (cb) => ipcRenderer.on("engine:status", (_e, s) => cb(s)),
});
