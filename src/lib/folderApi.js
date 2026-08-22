// ─────────────────────────────────────────────────────────────────────────────
// 워치 폴더 API (렌더러 측) — 현장-블라인드 v2
//
// 실제 Electron 환경에서는 preload 가 노출한 window.electronAPI(= 메인 프로세스의
// folderService)를 호출합니다. Electron 이 아닌 환경(브라우저 프리뷰/Playwright)
// 에서는 window.electronAPI 가 없으므로 **제로 디폴트**(빈 배열/미설정)로 폴백합니다.
// 더미 시드는 사용하지 않습니다.
//
// 메인 구현: src/folderService.js
//   getDefaultFolder() / getRootFolder() / setRootFolder(p) / resetToDefault()
//   validateFolder(p)  → { accessible, exists, txtCount, error }
//   pickFolder()       → OS 네이티브 폴더 선택 다이얼로그
//   scanFolder(p)      → DetectedFile 원시 목록 (fileName/fullPath/rowCount/lastModified ...)
//   analyzeFile(path)  → { encoding, rowCount, columnCount, delimiter, intervalGuess, preview }
// ─────────────────────────────────────────────────────────────────────────────

import { inferNodeId } from './nodeId.js';
import { classifyFormat } from './formatClassify.js';
import { normalizeBackendNode } from './backendApi.js';

function bridge() {
  return typeof window !== 'undefined' ? window.electronAPI : undefined;
}

/** Electron(실제 IPC) 환경인지 여부. */
export function isElectron() {
  return !!bridge();
}

/** 폴더 접근 실패 시 사용자에게 보여줄 친절한 문구. */
export const FOLDER_ERROR_MESSAGE = {
  empty: '폴더 경로를 입력하거나 찾아보기로 선택하세요',
  permission: '권한이 없습니다 · 폴더에 접근할 수 없습니다',
  notfound: '폴더를 찾을 수 없습니다',
  notdir: '폴더가 아닙니다 · 파일 경로입니다',
};

export async function getDefaultFolder() {
  const api = bridge();
  if (api?.getDefaultFolder) return api.getDefaultFolder();
  return '';
}

export async function getRootFolder() {
  const api = bridge();
  if (api?.getRootFolder) return api.getRootFolder();
  return '';
}

export async function setRootFolder(folderPath) {
  const api = bridge();
  if (api?.setRootFolder) return api.setRootFolder(folderPath);
  return folderPath;
}

/** 데이터 폴더 설정을 지우고 기본값(바탕화면)으로 되돌린 뒤, 그 경로를 반환. */
export async function resetToDefault() {
  const api = bridge();
  if (api?.resetToDefault) return api.resetToDefault();
  return '';
}

export async function pickFolder() {
  const api = bridge();
  if (api?.pickFolder) return api.pickFolder();
  return null;
}

export async function validateFolder(folderPath) {
  const api = bridge();
  if (api?.validateFolder) return api.validateFolder(folderPath);
  return { accessible: false, exists: false, txtCount: 0, error: 'empty' };
}

/**
 * 워치 폴더를 스캔해 감지된 .txt 파일을 v2 DetectedFile[] 로 매핑.
 * 비-Electron 환경에서는 빈 배열(제로 디폴트).
 * @param {string} [rootPath]
 * @returns {Promise<import('./types.js').DetectedFile[]>}
 */
export async function scanFolder(rootPath) {
  const api = bridge();
  if (!api?.scanFolder) return [];
  const raw = await api.scanFolder(rootPath);
  return (raw || []).map((f) => ({
    name: f.fileName,
    fullPath: f.fullPath,
    nodeId: inferNodeId(f.fileName),
    // ⚠️ modified 는 **파일 저장시각(mtime)** 이지 "마지막 수신"이 아니다.
    //    로거가 덮어쓰기만 해도 갱신되므로 수신 판정에 쓰면 끊긴 노드를 놓친다.
    //    "마지막 수신"은 dataEnd(파일 안 마지막 데이터 행의 시각)를 쓴다.
    modified: f.lastModified,
    dataStart: f.periodStart ?? null, // 파일 안 첫 데이터 시각
    dataEnd: f.periodEnd ?? null,     // 파일 안 마지막 데이터 시각 ← 수신 판정의 정본
    rows: f.rowCount ?? 0,
    // 포맷 패턴 + 유효성 판정 (등록 게이트) — header/sampleRow 는 메인 스캔에서 전달
    format: classifyFormat(f.header || null, f.sampleRow || null),
    registered: false, // 등록 여부는 스토어가 노드 목록과 대조해 채움
  }));
}

/**
 * 한 .txt 파일의 구조를 분석 (위저드 Step 2/3 용).
 * 비-Electron 환경에서는 null.
 * @param {string} fullPath
 * @returns {Promise<null|{nodeId,encoding,rowCount,columnCount,delimiter,intervalGuess,preview}>}
 */
export async function analyzeFile(fullPath) {
  const api = bridge();
  if (!api?.analyzeFile) return null;
  return api.analyzeFile(fullPath);
}

// ── 백엔드 연결 (노드 등록 실전송) ────────────────────────────────────────────
/** 백엔드 설정 조회 — { url, hasKey } (키 값은 반환 안 함). */
export async function getBackendConfig() {
  const api = bridge();
  if (api?.getBackendConfig) return api.getBackendConfig();
  return { url: '', hasKey: false };
}

/** 백엔드 URL/키 저장. apiKey 빈값이면 기존 키 유지. */
export async function setBackendConfig(cfg) {
  const api = bridge();
  if (api?.setBackendConfig) return api.setBackendConfig(cfg);
  return { url: '', hasKey: false };
}

/**
 * 노드 등록을 백엔드로 전송 (POST /api/pulse/v1/nodes). 메인 프로세스가 키로 호출.
 * @param {{nodeId, sensorType, name?, locationDesc?}} payload
 * @returns {Promise<{ok:boolean, status?:number, node?:object, error?:string}>}
 */
export async function registerNodeBackend(payload) {
  const api = bridge();
  if (api?.registerNode) return api.registerNode(payload);
  return { ok: false, error: 'no_electron' };
}

/**
 * 센서 정상범위(valid_min/max) 갱신을 백엔드로 전송 (POST /nodes, 같은 node_code 멱등).
 * 메인이 키로 호출. 비-Electron 이면 no_electron.
 * @param {{nodeId, sensorType, channels:{code, validMin?, validMax?}[]}} payload
 * @returns {Promise<{ok:boolean, status?:number, node?:object, error?:string}>}
 */
export async function setSensorRangesBackend(payload) {
  const api = bridge();
  if (!api?.setSensorRanges) return { ok: false, error: 'no_electron' };
  try {
    return await api.setSensorRanges(payload);
  } catch (e) {
    // 메인에 핸들러 미등록(앱 재시작 전) 등 IPC 거부 시 throw 대신 결과로 흡수.
    return { ok: false, error: 'ipc', message: String(e?.message || e) };
  }
}

/**
 * 노드를 백엔드에서 영구 삭제 (DELETE /api/pulse/v1/nodes/{node_code}). 메인 프로세스가 키로 호출.
 * @param {string} nodeCode
 * @returns {Promise<{ok:boolean, status?:number, error?:string, message?:string, node_code?:string}>}
 */
export async function deleteNodeBackend(nodeCode) {
  const api = bridge();
  if (api?.deleteNode) return api.deleteNode(nodeCode);
  return { ok: false, error: 'no_electron' };
}

/**
 * 노드 수신 주기 변경 (PATCH /api/pulse/v1/nodes/{node_code}). 주기만 바뀜(센서 무영향).
 * @param {string} nodeCode @param {number|null} intervalMin
 * @returns {Promise<{ok:boolean, status?:number, error?:string, node?:object}>}
 */
export async function setNodeIntervalBackend(nodeCode, intervalMin) {
  const api = bridge();
  if (api?.setNodeInterval) return api.setNodeInterval(nodeCode, intervalMin);
  return { ok: false, error: 'no_electron' };
}

/**
 * 백엔드에서 노드 목록을 조회 (GET /api/pulse/v1/nodes) 후 펄스 모델로 정규화.
 * @returns {Promise<{ok:boolean, status?:number, error?:string,
 *   nodes:{nodeId,sensorType,name,intervalMin,lastRx,channels}[]}>}
 */
export async function listNodesBackend() {
  const api = bridge();
  if (!api?.listNodes) return { ok: false, error: 'no_electron', nodes: [] };
  const r = await api.listNodes();
  const nodes = (r?.nodes || []).map(normalizeBackendNode);
  return { ...r, nodes };
}

// ── 데이터 파이프라인 (파일 신규행 → ingest 전송) ─────────────────────────────
/**
 * 워치 파일의 sinceTs(ms) 이후 신규 데이터 행을 읽음.
 * @returns {Promise<{ok:boolean, error?:string, columnCount?:number, rows:{at,ts,cells}[]}>}
 */
export async function readMeasurements(fullPath, sinceTs = 0) {
  const api = bridge();
  if (api?.readMeasurements) return api.readMeasurements(fullPath, sinceTs);
  return { ok: false, error: 'no_electron', rows: [] };
}

/**
 * 한 센서의 측정값을 백엔드로 전송. sensorCode 는 메인이 {node_code}-{code} 로 조합.
 * @param {{nodeId, channelCode, measurements}} payload
 */
export async function ingestBackend(payload) {
  const api = bridge();
  if (api?.ingest) return api.ingest(payload);
  return { ok: false, error: 'no_electron' };
}

/**
 * 센서 생명주기 상태 변경 (PATCH /sensors/{sensor_code}). status: active | inactive.
 * @param {string} sensorCode  {node_code}-{code}
 * @param {string} status
 */
export async function setSensorStatusBackend(sensorCode, status) {
  const api = bridge();
  if (api?.setSensorStatus) return api.setSensorStatus(sensorCode, status);
  return { ok: false, error: 'no_electron' };
}

/**
 * 운영 시작 기준일(monitoring_from) 갱신을 백엔드로 전송 (POST /nodes, 같은 node_code 멱등).
 * @param {{nodeId, sensorType, monitoringFrom: string|null}} payload
 * @returns {Promise<{ok:boolean, status?:number, node?:object, error?:string}>}
 */
export async function setMonitoringFromBackend(payload) {
  const api = bridge();
  if (!api?.setMonitoringFrom) return { ok: false, error: 'no_electron' };
  try {
    return await api.setMonitoringFrom(payload);
  } catch (e) {
    return { ok: false, error: 'ipc', message: String(e?.message || e) };
  }
}
