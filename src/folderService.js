// ─────────────────────────────────────────────────────────────────────────────
// folderService — 데이터 폴더 관련 메인 프로세스 로직 (실제 OS / 파일시스템)
//
//   - 기본 폴더 = app.getPath('desktop')  (하드코딩 금지, OS 에서 동적 획득)
//   - 선택한 폴더는 userData 의 설정 파일에 저장되어 재시작해도 유지
//   - 폴더 검증 시 **.txt 파일만**, **하위 폴더까지 재귀적으로** 개수를 셉니다 (READ_EXTENSIONS)
//   - 폴더 선택은 OS 네이티브 다이얼로그 (dialog.showOpenDialog)
//
// 렌더러에서는 preload 의 contextBridge → ipcRenderer.invoke 로 호출합니다.
// ─────────────────────────────────────────────────────────────────────────────
import { app, dialog, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PATHS, AUTH_HEADER, heartbeatBody, nodeRegisterBody, nodeRangeBody, nodeMonitoringBody, nodeDeletePath, nodePath, intervalPatchBody, ingestBody, sensorStatusPath } from './lib/backendApi.js';

// 기본적으로 .txt 파일만 데이터로 인식합니다. 확장이 필요하면 여기에 추가.
const READ_EXTENSIONS = ['.txt'];
const CONFIG_FILE = 'pulse-config.json';

function configPath() {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.error('[folderService] 설정 저장 실패:', err);
  }
}

/** OS 의 바탕화면 경로. 사용자/PC 마다 다르므로 절대 하드코딩하지 않습니다. */
export function getDefaultFolder() {
  return app.getPath('desktop');
}

/** 사용자가 설정한 데이터 폴더. 없으면 기본(바탕화면). */
export function getRootFolder() {
  return readConfig().rootFolder || getDefaultFolder();
}

/** 데이터 폴더를 저장(영속). */
export function setRootFolder(p) {
  const cfg = readConfig();
  cfg.rootFolder = p;
  writeConfig(cfg);
  return p;
}

/** 데이터 폴더를 기본(바탕화면)으로 복원. */
export function resetToDefault() {
  const cfg = readConfig();
  delete cfg.rootFolder;
  writeConfig(cfg);
  return getDefaultFolder();
}

/**
 * 폴더 트리를 재귀적으로 훑어 .txt 파일의 전체 경로 목록을 모읍니다.
 *   - 모든 하위 폴더까지 내려갑니다.
 *   - 접근할 수 없는 하위 폴더는 건너뜁니다 (전체가 실패하지 않도록).
 *   - 심볼릭 링크 디렉터리는 따라가지 않습니다 (무한 루프 방지).
 *
 * validateFolder(개수) 와 scanFolder(목록) 가 **동일한 이 함수**를 사용하므로
 * 설정의 ".txt N개 발견" 과 대시보드 "감지된 파일" 개수가 항상 일치합니다.
 * @param {string} dir
 * @returns {Promise<string[]>}  .txt 파일들의 전체 경로
 */
async function collectTxtFiles(dir) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return []; // 접근 불가한 하위 폴더는 건너뜀
  }
  const out = [];
  for (const d of entries) {
    const full = path.join(dir, d.name);
    if (d.isFile()) {
      if (READ_EXTENSIONS.includes(path.extname(d.name).toLowerCase())) out.push(full);
    } else if (d.isDirectory()) {
      // isDirectory() 는 심볼릭 링크엔 false → 링크는 자동으로 제외됨
      const sub = await collectTxtFiles(full);
      for (const f of sub) out.push(f);
    }
  }
  return out;
}

/**
 * 폴더 유효성 검사 (실제 파일시스템).
 *   - 폴더와 **모든 하위 폴더**의 .txt 파일을 재귀적으로 세어 txtCount 로 반환
 * @param {string} p
 * @returns {Promise<{accessible:boolean, exists:boolean, txtCount:number,
 *                     error: null|'empty'|'permission'|'notfound'|'notdir'}>}
 */
export async function validateFolder(p) {
  const folder = (p || '').trim();
  if (!folder) return { accessible: false, exists: false, txtCount: 0, error: 'empty' };
  try {
    const st = await fs.promises.stat(folder);
    if (!st.isDirectory())
      return { accessible: false, exists: true, txtCount: 0, error: 'notdir' };
    await fs.promises.access(folder, fs.constants.R_OK);
    const txtCount = (await collectTxtFiles(folder)).length; // 하위 폴더까지 재귀
    return { accessible: true, exists: true, txtCount, error: null };
  } catch (err) {
    if (err.code === 'ENOENT')
      return { accessible: false, exists: false, txtCount: 0, error: 'notfound' };
    if (err.code === 'EACCES' || err.code === 'EPERM')
      return { accessible: false, exists: true, txtCount: 0, error: 'permission' };
    return { accessible: false, exists: false, txtCount: 0, error: 'notfound' };
  }
}

// ── 파일 메타 분석 (인코딩 / 행수) ───────────────────────────────────────────
function detectEncoding(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
    return 'UTF-8 (BOM)';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return 'UTF-16 LE';
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return 'UTF-16 BE';
  return 'UTF-8';
}

function countLines(buf, encoding) {
  const text = encoding.startsWith('UTF-16')
    ? buf.toString('utf16le')
    : buf.toString('utf8');
  if (text.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') n += 1;
  if (!text.endsWith('\n')) n += 1; // 마지막 줄에 개행이 없으면 +1
  return n;
}

/**
 * 한 .txt 파일을 DetectedFile 형태로 분석.
 * sensorCount / period 는 센서 파일 포맷 미상이라 현재 null (추후 파싱으로 채움).
 * @param {string} fullPath
 */
async function buildDetectedFile(fullPath) {
  const st = await fs.promises.stat(fullPath);
  let rowCount = 0;
  let encoding = 'UTF-8';
  let header = null;   // 첫 줄(제목)을 구분자로 나눈 배열
  let sampleRow = null; // 첫 데이터 줄을 나눈 배열
  let periodStart = null; // 파일 안 **첫** 데이터 행의 시각 (ISO)
  let periodEnd = null;   // 파일 안 **마지막** 데이터 행의 시각 (ISO) ← "마지막 수신"의 정본
  try {
    const buf = await fs.promises.readFile(fullPath);
    encoding = detectEncoding(buf);
    rowCount = countLines(buf, encoding);
    const text = encoding.startsWith('UTF-16') ? buf.toString('utf16le') : buf.toString('utf8');
    const allLines = text.split(/\r?\n/).filter((l) => l.trim().length);
    // 포맷 패턴 판정을 위해 앞 2줄(제목+첫 데이터) 파싱 (렌더러가 classifyFormat)
    if (allLines.length) {
      const { char } = detectDelimiter(allLines.slice(0, 2));
      const split = (l) => l.split(char).map((c) => c.trim().replace(/^"|"$/g, ''));
      header = split(allLines[0]);
      if (allLines[1]) sampleRow = split(allLines[1]);

      // 데이터 구간(첫/마지막 유효 타임스탬프). 0열이 시각으로 읽히는 행만 인정하고,
      // 못 읽는 행(제목·낙서)은 건너뛴다. 한 줄도 없으면 null 로 남긴다.
      // ⚠️ mtime 으로 때우지 말 것 — 로거가 덮어쓰기만 해도 mtime 은 갱신되므로
      //    "데이터는 끊겼는데 수신중으로 보이는" 바로 그 오류가 된다.
      const tsOf = (line) => parseTs(split(line)[0]);
      for (let i = 0; i < allLines.length; i += 1) {
        const t = tsOf(allLines[i]);
        if (!isNaN(t)) { periodStart = new Date(t).toISOString(); break; }
      }
      for (let i = allLines.length - 1; i >= 0; i -= 1) {
        const t = tsOf(allLines[i]);
        if (!isNaN(t)) { periodEnd = new Date(t).toISOString(); break; }
      }
    }
  } catch {
    // 읽기 실패 시 메타데이터만 채움
  }
  return {
    fileName: path.basename(fullPath),
    fullPath,
    sizeBytes: st.size,
    rowCount,
    encoding,
    lastModified: st.mtime.toISOString(),
    header,
    sampleRow,
    sensorCount: null, // TODO: 파일 포맷 파싱 시 컬럼 수로 채움
    periodStart,
    periodEnd,
    isRegistered: false, // 등록 여부는 렌더러(앱 상태)에서 관리
  };
}

/**
 * 데이터 폴더를 스캔해 감지된 .txt 파일 목록(DetectedFile[])을 반환.
 * rootPath 가 없으면 설정된 데이터 폴더(getRootFolder)를 사용 →
 * 설정 탭의 검증 대상과 동일한 폴더를 봅니다.
 * @param {string} [rootPath]
 * @returns {Promise<object[]>}
 */
export async function scanFolder(rootPath) {
  const root = (rootPath || '').trim() || getRootFolder();
  try {
    const st = await fs.promises.stat(root);
    if (!st.isDirectory()) return [];
  } catch {
    return [];
  }
  const paths = await collectTxtFiles(root);
  const out = [];
  for (const f of paths) {
    try {
      out.push(await buildDetectedFile(f));
    } catch {
      // 개별 파일 분석 실패는 건너뜀
    }
  }
  out.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified)); // 최신순
  return out;
}

// ── 파일 구조 분석 (위저드 Step 2/3) ─────────────────────────────────────────
const DELIMITERS = [
  { char: ',', name: '쉼표 (,)' },
  { char: '\t', name: '탭' },
  { char: ';', name: '세미콜론 (;)' },
];

/** 첫 비어있지 않은 줄에서 구분자 빈도를 세어 가장 많은 것을 선택. */
function detectDelimiter(lines) {
  const sample = lines.find((l) => l.trim().length) || '';
  let best = DELIMITERS[0];
  let bestN = -1;
  for (const d of DELIMITERS) {
    const n = sample.split(d.char).length - 1;
    if (n > bestN) {
      bestN = n;
      best = d;
    }
  }
  return best;
}

/** 'YYYY-MM-DD HH:mm' 류 또는 ISO 를 epoch ms 로. 실패 시 NaN. */
function parseTs(s) {
  if (s == null) return NaN;
  const t = Date.parse(String(s).trim().replace(' ', 'T'));
  return isNaN(t) ? Date.parse(String(s).trim()) : t;
}

/**
 * 한 .txt 파일의 구조를 분석. (현장-블라인드: 현장 추론 없음)
 * @param {string} fullPath
 * @returns {Promise<{encoding,rowCount,columnCount,delimiter,intervalGuess,preview}>}
 */
export async function analyzeFile(fullPath) {
  const buf = await fs.promises.readFile(fullPath);
  const encoding = detectEncoding(buf);
  const text = encoding.startsWith('UTF-16')
    ? buf.toString('utf16le')
    : buf.toString('utf8');
  const lines = text.split(/\r?\n/).filter((l, i, arr) => l.length || i < arr.length - 1);
  const nonEmpty = lines.filter((l) => l.trim().length);
  const rowCount = nonEmpty.length;

  const { char: delChar, name: delName } = detectDelimiter(nonEmpty);
  const split = (l) => l.split(delChar).map((c) => c.trim().replace(/^"|"$/g, ''));

  const preview = nonEmpty.slice(0, 10).map(split);
  const columnCount = preview.reduce((m, r) => Math.max(m, r.length), 0);

  // 주기 추정: 첫 컬럼이 날짜로 파싱되는 첫 두 데이터행의 차이(분)
  let intervalGuess = null;
  const tsRows = preview.map((r) => parseTs(r[0])).filter((t) => !isNaN(t));
  if (tsRows.length >= 2) {
    const diffMin = Math.abs(tsRows[1] - tsRows[0]) / 60000;
    if (diffMin > 0) intervalGuess = Math.round(diffMin);
  }

  return { encoding, rowCount, columnCount, delimiter: delName, intervalGuess, preview };
}

/** OS 네이티브 폴더 선택 다이얼로그. 취소 시 null. */
export async function pickFolder() {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
  const opts = {
    title: '데이터 폴더 선택',
    properties: ['openDirectory'],
    defaultPath: getRootFolder(),
  };
  const res = win
    ? await dialog.showOpenDialog(win, opts)
    : await dialog.showOpenDialog(opts);
  if (res.canceled || !res.filePaths || !res.filePaths.length) return null;
  return res.filePaths[0];
}

// ── 백엔드 연결 (노드 등록 실전송) ───────────────────────────────────────────
// API 키는 메인 프로세스에만 보관(렌더러에 노출 안 함). config 파일에 영속.

/** 렌더러용 백엔드 설정 — URL 과 "키 저장 여부"만(키 값은 반환 안 함). */
export function getBackendConfig() {
  const cfg = readConfig();
  return { url: cfg.backendUrl || '', hasKey: !!cfg.apiKey };
}

/** URL/키 저장. apiKey 가 빈값이면 기존 키 유지(덮어쓰지 않음). */
export function setBackendConfig({ url, apiKey } = {}) {
  const cfg = readConfig();
  if (url !== undefined) cfg.backendUrl = String(url || '').trim();
  if (apiKey) cfg.apiKey = String(apiKey).trim();
  writeConfig(cfg);
  return getBackendConfig();
}

/**
 * 노드 등록을 백엔드로 POST (/api/pulse/v1/nodes). node_code 멱등.
 * @param {{nodeId, sensorType, name?, locationDesc?}} p
 * @returns {Promise<{ok:boolean, status?:number, node?:object, error?:string}>}
 */
export async function registerNodeToBackend(p) {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured' };
  if (!p?.nodeId) return { ok: false, error: 'no_node_code' };
  if (!p?.sensorType) return { ok: false, error: 'no_sensor_type' };
  const body = nodeRegisterBody(p);
  // 디버그: 실제 전송되는 본문(특히 channels 개수)을 메인 콘솔에 남김 — 백엔드 측 切り分け용.
  console.log(`[nodes:register] POST ${base + PATHS.nodes} · ${p.nodeId} · channels=${body.channels?.length ?? 0} · sensor_count=${body.sensor_count ?? '-'} ::`, JSON.stringify(body));
  try {
    const res = await fetch(base + PATHS.nodes, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: cfg.apiKey },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) {
      return { ok: false, status: res.status, error: res.status === 401 ? 'unauthorized' : `http_${res.status}` };
    }
    return { ok: true, status: res.status, node: data };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/**
 * 센서 정상범위(valid_min/max) 갱신을 백엔드로 POST (/api/pulse/v1/nodes, 같은 node_code 멱등).
 * 별도 API 아님 — 노드 등록을 범위만 담아 다시 보내 기존 센서 범위를 갱신.
 * 목적: 정상 센서의 raw 글리치(튄 값) 1개를 백엔드가 범위 밖으로 자동 invalid 처리.
 * @param {{nodeId, sensorType, channels:{code, validMin?, validMax?}[]}} p
 * @returns {Promise<{ok:boolean, status?:number, node?:object, error?:string}>}
 */
export async function setSensorRangesToBackend(p) {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured' };
  if (!p?.nodeId) return { ok: false, error: 'no_node_code' };
  if (!p?.sensorType) return { ok: false, error: 'no_sensor_type' };
  const body = nodeRangeBody(p);
  console.log(`[nodes:set-ranges] POST ${base + PATHS.nodes} · ${p.nodeId} · channels=${body.channels?.length ?? 0} ::`, JSON.stringify(body));
  try {
    const res = await fetch(base + PATHS.nodes, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: cfg.apiKey },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) {
      return { ok: false, status: res.status, error: res.status === 401 ? 'unauthorized' : `http_${res.status}` };
    }
    return { ok: true, status: res.status, node: data };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/**
 * 운영 시작 기준일(monitoring_from) 갱신을 백엔드로 POST (/api/pulse/v1/nodes, 같은 node_code 멱등).
 * 별도 API 아님 — 노드 등록을 monitoring_from 만 담아 재전송(센서/채널 무영향). null=해제.
 * @param {{nodeId, sensorType, monitoringFrom: string|null}} p
 * @returns {Promise<{ok:boolean, status?:number, node?:object, error?:string}>}
 */
export async function setMonitoringFromToBackend(p) {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured' };
  if (!p?.nodeId) return { ok: false, error: 'no_node_code' };
  if (!p?.sensorType) return { ok: false, error: 'no_sensor_type' };
  const body = nodeMonitoringBody(p);
  console.log(`[nodes:set-monitoring-from] POST ${base + PATHS.nodes} · ${p.nodeId} · ${body.monitoring_from ?? '(해제)'} ::`, JSON.stringify(body));
  try {
    const res = await fetch(base + PATHS.nodes, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: cfg.apiKey },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) {
      return { ok: false, status: res.status, error: res.status === 401 ? 'unauthorized' : `http_${res.status}` };
    }
    return { ok: true, status: res.status, node: data };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/**
 * 노드 수신 주기 변경 (PATCH /api/pulse/v1/nodes/{node_code}, 2026-06-01 신설).
 * 주기만 바뀜(센서/채널 무영향). intervalMin=null 이면 주기 해제.
 * @param {{nodeCode:string, intervalMin:number|null}} p
 * @returns {Promise<{ok:boolean, status?:number, node?:object, error?:string}>}
 */
export async function setNodeIntervalToBackend({ nodeCode, intervalMin }) {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured' };
  if (!nodeCode) return { ok: false, error: 'no_node_code' };
  const body = intervalPatchBody(intervalMin);
  console.log(`[nodes:set-interval] PATCH ${base + nodePath(nodeCode)} · ${nodeCode} ::`, JSON.stringify(body));
  try {
    const res = await fetch(base + nodePath(nodeCode), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: cfg.apiKey },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) {
      const error = res.status === 401 ? 'unauthorized' : res.status === 404 ? 'not_found' : res.status === 400 ? 'rejected' : `http_${res.status}`;
      console.warn(`[nodes:set-interval] ${nodeCode} → ${res.status} ${error}`);
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, node: data };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/**
 * 노드를 백엔드에서 영구 삭제 (DELETE /api/pulse/v1/nodes/{node_code}).
 * 삭제 가능 여부(현장 배치/데이터 유무)는 백엔드가 판정 — 펄스는 호출 후 응답만 해석.
 * @param {string} nodeCode
 * @returns {Promise<{ok:boolean, status?:number, error?:string, message?:string, node_code?:string}>}
 *   error: 'rejected'(400) | 'not_found'(404) | 'unauthorized'(401) | 'unconfigured' | 'no_node_code' | 'network' | 'http_NNN'
 */
export async function deleteNodeFromBackend(nodeCode) {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured' };
  if (!nodeCode) return { ok: false, error: 'no_node_code' };
  try {
    const res = await fetch(base + nodeDeletePath(nodeCode), {
      method: 'DELETE',
      headers: { [AUTH_HEADER]: cfg.apiKey },
    });
    let data = null;
    try { data = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) {
      const error =
        res.status === 400 ? 'rejected'
        : res.status === 404 ? 'not_found'
        : res.status === 401 ? 'unauthorized'
        : `http_${res.status}`;
      // 백엔드 거부/오류 메시지는 운영 추적을 위해 메인 로그에 남김
      console.warn(`[nodes:delete] ${nodeCode} → ${res.status} ${error}: ${data?.message || ''}`);
      return { ok: false, status: res.status, error, message: data?.message || '' };
    }
    return { ok: true, status: res.status, message: data?.message || '', node_code: data?.node_code || nodeCode };
  } catch (err) {
    console.warn(`[nodes:delete] ${nodeCode} → network error: ${err?.message || err}`);
    return { ok: false, error: 'network' };
  }
}

/**
 * 백엔드에서 이 펄스의 노드 목록을 조회 (GET /api/pulse/v1/nodes).
 * @returns {Promise<{ok:boolean, status?:number, error?:string, nodes:object[]}>}
 *   nodes 는 백엔드 원본 배열(정규화는 렌더러 normalizeBackendNode 가 담당).
 */
export async function listNodesFromBackend() {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured', nodes: [] };
  try {
    const res = await fetch(base + PATHS.nodes, {
      method: 'GET',
      headers: { [AUTH_HEADER]: cfg.apiKey },
    });
    let data = null;
    try { data = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) {
      const error = res.status === 401 ? 'unauthorized' : `http_${res.status}`;
      console.warn(`[nodes:list] → ${res.status} ${error}`);
      return { ok: false, status: res.status, error, nodes: [] };
    }
    // 배열 / { nodes:[...] } / { data:[...] } 형태 모두 흡수
    const arr = Array.isArray(data) ? data : (data?.nodes ?? data?.data ?? []);
    return { ok: true, status: res.status, nodes: Array.isArray(arr) ? arr : [] };
  } catch (err) {
    console.warn(`[nodes:list] network error: ${err?.message || err}`);
    return { ok: false, error: 'network', nodes: [] };
  }
}

/**
 * 한 .txt 의 데이터 행을 파싱해 **sinceTs 이후(증분)** 행만 반환.
 * 타사 로거가 덮어쓰기라 "행 위치" 대신 **시각(0열) 워터마크**로 증분 판정.
 * @param {string} fullPath
 * @param {number} [sinceTs] epoch ms — 이 시각보다 뒤(>) 행만
 * @returns {Promise<{ok:boolean, error?:string, columnCount:number, rows:{at:string, ts:number, cells:string[]}[]}>}
 */
export async function readMeasurements(fullPath, sinceTs = 0) {
  try {
    const buf = await fs.promises.readFile(fullPath);
    const encoding = detectEncoding(buf);
    const text = encoding.startsWith('UTF-16') ? buf.toString('utf16le') : buf.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return { ok: true, columnCount: 0, rows: [] };
    const { char } = detectDelimiter(lines.slice(0, 5));
    const split = (l) => l.split(char).map((c) => c.trim().replace(/^"|"$/g, ''));
    const all = lines.map(split);
    // 헤더 판정: 첫 행의 둘째 칸부터 비숫자가 있으면 제목 줄로 보고 제외
    const hasHeader = all[0] && all[0].slice(1).some((c) => c !== '' && isNaN(Number(c)));
    const dataRows = hasHeader ? all.slice(1) : all;
    const columnCount = all.reduce((m, r) => Math.max(m, r.length), 0);
    const rows = [];
    for (const cells of dataRows) {
      const ts = parseTs(cells[0]);
      if (isNaN(ts)) continue;          // 시각 못 읽는 행은 건너뜀
      if (ts > sinceTs) rows.push({ at: cells[0], ts, cells });
    }
    rows.sort((a, b) => a.ts - b.ts);   // 오래된 것부터
    // head/sample = 원본 첫 두 줄(분할). 렌더러가 등록 때와 동일한 classifyFormat 으로 형식 재검증.
    return { ok: true, columnCount, rows, head: all[0] || null, sample: all[1] || null };
  } catch {
    return { ok: false, error: 'read_failed', columnCount: 0, rows: [] };
  }
}

/**
 * 측정값을 백엔드로 전송 (POST /api/pulse/v1/ingest). sensorCode = {node_code}-{code}.
 * @param {{nodeId, channelCode, measurements, rawFile?}} p
 * @returns {Promise<{ok:boolean, status?:number, error?:string}>}
 */
export async function ingestToBackend(p) {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured' };
  if (!p?.measurements?.length) return { ok: true, status: 204, skipped: true };
  const body = ingestBody(p);
  // 디버그: 실제 전송 body(센서코드·측정 개수) — register 로그와 같은 패턴, 터미널에서 확인.
  console.log(`[nodes:ingest] POST ${base + PATHS.ingest} · sensorCode=${body.sensorCode} · count=${body.measurements?.length ?? 0} :: ${JSON.stringify(body).slice(0, 400)}`);
  try {
    const res = await fetch(base + PATHS.ingest, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: cfg.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = res.status === 401 ? 'unauthorized' : `http_${res.status}`;
      console.warn(`[nodes:ingest] ${body.sensorCode} → ${res.status} ${error}`);
      return { ok: false, status: res.status, error };
    }
    console.log(`[nodes:ingest] ${body.sensorCode} → ${res.status} OK (${body.measurements.length}건)`);
    return { ok: true, status: res.status };
  } catch (err) {
    console.warn(`[nodes:ingest] ${body.sensorCode} network: ${err?.message || err}`);
    return { ok: false, error: 'network' };
  }
}

/**
 * 수집기 생존 신호 (POST /api/pulse/v1/heartbeat).
 *
 * 이걸 보내야 **이 PC 가 죽었을 때 서버가 알아챈다.** 펄스 스스로는 자기가 죽은 걸
 * 알릴 수 없으므로(죽었으니까), 서버가 침묵을 감지하는 구조여야 한다.
 * 백엔드 PulseMonitorService 가 last_seen 이 PULSE_OFFLINE_MINUTES(기본 3분) 넘게
 * 끊기면 offline 으로 전이시키고 알림을 1회 발송한다.
 *
 * pulseId = 이 PC 를 구분하는 고정 이름. 설정값이 없으면 호스트명을 쓴다.
 * @param {{status?:string, info?:object}} [p]
 * @returns {Promise<{ok:boolean, status?:number, error?:string}>}
 */
export async function sendHeartbeat(p = {}) {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured' };
  const pulseId = (cfg.pulseId || os.hostname() || 'pulse').slice(0, 50);
  const body = heartbeatBody({ pulseId, status: p.status || 'online', info: p.info });
  try {
    const res = await fetch(base + PATHS.heartbeat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: cfg.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = res.status === 401 ? 'unauthorized' : `http_${res.status}`;
      console.warn(`[pulse:heartbeat] ${pulseId} → ${res.status} ${error}`);
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, pulseId };
  } catch (err) {
    console.warn(`[pulse:heartbeat] network: ${err?.message || err}`);
    return { ok: false, error: 'network' };
  }
}

/**
 * 계측 현황 보고를 지금 즉시 발송 (POST /api/pulse/v1/report).
 *
 * 정기 발송(매일 아침)을 기다리지 않고 **지금 상태를 디스코드·이메일로 공유**한다.
 * 현황을 만드는 주체는 백엔드다 — 펄스는 자기 파일만 알지 전체 노드를 모르기 때문에
 * (타사 PC 가 담당하는 노드 포함) 서버가 모아서 보내는 게 맞다.
 * @returns {Promise<{ok:boolean, nodes?:number, live?:number, lost?:number, error?:string}>}
 */
export async function sendReport() {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured' };
  const by = (cfg.pulseId || os.hostname() || 'pulse').slice(0, 50);
  try {
    const res = await fetch(base + PATHS.report, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: cfg.apiKey },
      body: JSON.stringify({ by }),
    });
    if (!res.ok) {
      const error = res.status === 401 ? 'unauthorized' : `http_${res.status}`;
      console.warn(`[pulse:report] → ${res.status} ${error}`);
      return { ok: false, status: res.status, error };
    }
    const data = await res.json().catch(() => ({}));
    console.log(`[pulse:report] 발송 완료 ::`, JSON.stringify(data));
    return { ok: true, ...data };
  } catch (err) {
    console.warn(`[pulse:report] network: ${err?.message || err}`);
    return { ok: false, error: 'network' };
  }
}

/**
 * 센서 생명주기 상태 변경 (PATCH /api/pulse/v1/sensors/{sensor_code}).
 * status: 'active' | 'inactive'. inactive 는 sticky — 백엔드 평균·offline 추론에서 제외됨.
 * @param {{sensorCode, status}} p
 * @returns {Promise<{ok:boolean, status?:number, error?:string, lifecycle_state?:string}>}
 */
export async function setSensorStatus({ sensorCode, status } = {}) {
  const cfg = readConfig();
  const base = (cfg.backendUrl || '').replace(/\/+$/, '');
  if (!base || !cfg.apiKey) return { ok: false, error: 'unconfigured' };
  if (!sensorCode) return { ok: false, error: 'no_sensor_code' };
  try {
    const res = await fetch(base + sensorStatusPath(sensorCode), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: cfg.apiKey },
      body: JSON.stringify({ status }),
    });
    let data = null;
    try { data = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) {
      const error = res.status === 401 ? 'unauthorized' : res.status === 404 ? 'not_found' : `http_${res.status}`;
      console.warn(`[sensors:status] ${sensorCode} → ${status} → ${res.status} ${error}`);
      return { ok: false, status: res.status, error };
    }
    console.log(`[sensors:status] ${sensorCode} → ${data?.lifecycle_state || status} OK`);
    return { ok: true, status: res.status, lifecycle_state: data?.lifecycle_state || status };
  } catch (err) {
    console.warn(`[sensors:status] ${sensorCode} network: ${err?.message || err}`);
    return { ok: false, error: 'network' };
  }
}

/** 폴더 관련 IPC 핸들러 등록. main.js 의 app.whenReady 에서 1회 호출. */
export function registerFolderIpc() {
  ipcMain.handle('folder:get-default', () => getDefaultFolder());
  ipcMain.handle('folder:get-root', () => getRootFolder());
  ipcMain.handle('folder:set-root', (_e, p) => setRootFolder(p));
  ipcMain.handle('folder:reset-default', () => resetToDefault());
  ipcMain.handle('folder:validate', (_e, p) => validateFolder(p));
  ipcMain.handle('folder:pick', () => pickFolder());
  ipcMain.handle('folder:scan', (_e, p) => scanFolder(p));
  ipcMain.handle('files:analyze', (_e, p) => analyzeFile(p));
  ipcMain.handle('backend:get-config', () => getBackendConfig());
  ipcMain.handle('backend:set-config', (_e, c) => setBackendConfig(c));
  ipcMain.handle('nodes:register', (_e, p) => registerNodeToBackend(p));
  ipcMain.handle('nodes:set-ranges', (_e, p) => setSensorRangesToBackend(p));
  ipcMain.handle('nodes:set-monitoring-from', (_e, p) => setMonitoringFromToBackend(p));
  ipcMain.handle('nodes:delete', (_e, nodeCode) => deleteNodeFromBackend(nodeCode));
  ipcMain.handle('nodes:set-interval', (_e, p) => setNodeIntervalToBackend(p));
  ipcMain.handle('nodes:list', () => listNodesFromBackend());
  ipcMain.handle('files:read-measurements', (_e, { fullPath, sinceTs } = {}) => readMeasurements(fullPath, sinceTs));
  ipcMain.handle('nodes:ingest', (_e, p) => ingestToBackend(p));
  ipcMain.handle('pulse:heartbeat', (_e, p) => sendHeartbeat(p));
  ipcMain.handle('pulse:report', () => sendReport());
  ipcMain.handle('sensors:set-status', (_e, p) => setSensorStatus(p));
}
