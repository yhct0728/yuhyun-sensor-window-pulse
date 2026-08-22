// ─────────────────────────────────────────────────────────────────────────────
// preload — 렌더러에 안전한 IPC 브리지(electronAPI)를 노출.
// contextIsolation 환경에서 window.electronAPI 로만 메인 프로세스와 통신합니다.
// 참고: https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// ─────────────────────────────────────────────────────────────────────────────
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 데이터 폴더
  getDefaultFolder: () => ipcRenderer.invoke('folder:get-default'),
  getRootFolder: () => ipcRenderer.invoke('folder:get-root'),
  setRootFolder: (folderPath) => ipcRenderer.invoke('folder:set-root', folderPath),
  resetToDefault: () => ipcRenderer.invoke('folder:reset-default'),
  validateFolder: (folderPath) => ipcRenderer.invoke('folder:validate', folderPath),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  scanFolder: (rootPath) => ipcRenderer.invoke('folder:scan', rootPath),
  analyzeFile: (fullPath) => ipcRenderer.invoke('files:analyze', fullPath),
  // 백엔드 연결 (노드 등록 실전송). API 키는 메인에만 보관.
  getBackendConfig: () => ipcRenderer.invoke('backend:get-config'),
  setBackendConfig: (cfg) => ipcRenderer.invoke('backend:set-config', cfg),
  registerNode: (payload) => ipcRenderer.invoke('nodes:register', payload),
  setSensorRanges: (payload) => ipcRenderer.invoke('nodes:set-ranges', payload),
  setMonitoringFrom: (payload) => ipcRenderer.invoke('nodes:set-monitoring-from', payload),
  deleteNode: (nodeCode) => ipcRenderer.invoke('nodes:delete', nodeCode),
  setNodeInterval: (nodeCode, intervalMin) => ipcRenderer.invoke('nodes:set-interval', { nodeCode, intervalMin }),
  listNodes: () => ipcRenderer.invoke('nodes:list'),
  // 데이터 파이프라인: 파일 신규행 읽기 + ingest 전송
  readMeasurements: (fullPath, sinceTs) => ipcRenderer.invoke('files:read-measurements', { fullPath, sinceTs }),
  ingest: (payload) => ipcRenderer.invoke('nodes:ingest', payload),
  sendHeartbeat: (p) => ipcRenderer.invoke('pulse:heartbeat', p),
  setSensorStatus: (sensorCode, status) => ipcRenderer.invoke('sensors:set-status', { sensorCode, status }),

  // 자동 업데이트 (GitHub Releases). 설치본에서만 실동작 — 개발/미설치본은 unsupported.
  getUpdateStatus: () => ipcRenderer.invoke('update:status'),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  restartForUpdate: () => ipcRenderer.invoke('update:restart'),
});
