// ─────────────────────────────────────────────────────────────────────────────
// store — Pulse v2 전역 상태 (React Context, useState 기반)
//
// 외부 상태 라이브러리 없이 Context 하나로 노드/감지파일/채널타입/인제스트를
// 공유합니다. 모든 컬렉션은 제로 디폴트(빈 배열)로 시작합니다.
//
// Phase 1 영속성: 메모리만 (재시작 시 휘발). 노드 등록/전송 상태 변경은
// useState 시뮬레이션이며, 실제 IPC 연결은 아래 주석의 TODO 로 표시했습니다.
//   nodes:register / ingest:status,retry,flush / channels:list,add /
//   nodes:rx-tick / poll:next  →  Phase 2 (SQLite) + 폴링 워커에서 구현.
// 현장-블라인드: 어떤 상태에도 현장(site) 필드가 없습니다.
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { receptionOf } from './reception.js';
import { CHANNEL_TYPE_SEED } from './channelCatalog.js';
import { resolveSensors } from './sensorModel.js';
import { classifyFormat, isDateLike } from './formatClassify.js';
import { ingestSensorCode, sensorTypeUnit, guessSensorTypeFromName } from './backendApi.js';
import * as folderApi from './folderApi.js';

/** 파일 시각 문자열 → ISO8601(공백→T). 벽시계 그대로 유지(타임존 변형 없음). */
function toIso(at) {
  const s = String(at ?? '').trim();
  return s.includes(' ') && !s.includes('T') ? s.replace(' ', 'T') : s;
}

const PulseContext = createContext(null);

const RANGES_KEY = 'pulse:channelRanges'; // 정상범위(raw 글리치 컷) 입력값 임시 영속(Phase 2 SQLite 이관)

/**
 * 자동 수집 주기 — 감시 폴더의 .txt 를 다시 읽어 신규 행을 전송하는 간격.
 * App.jsx 의 setInterval 과 화면 문구가 같은 값을 쓰도록 여기서 한 번만 정의한다.
 * ⚠️ 노드의 intervalMin("기록 간격")과 무관하다 — 그건 장비가 기록하는 간격이고
 *    지연/끊김 판정에만 쓰인다. 수집은 노드 설정과 상관없이 항상 이 주기로 돈다.
 */
export const SYNC_INTERVAL_MS = 60_000;

/** 채널 범위 맵 키 — { [rangeKey(nodeId,code)]: { min, max } }. 판정 아님(입력 보관용 키). */
export function rangeKey(nodeId, channelCode) {
  return `${nodeId ?? ''}::${channelCode ?? ''}`;
}

/** localStorage 에서 채널 범위 맵을 읽음(없거나 깨졌으면 빈 맵). */
function loadChannelRanges() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RANGES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** 등록 노드의 대표 채널 트렌드/현재값을 raw 미리보기에서 유도 (있으면). */
function deriveFromRaw(raw, chans) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { chans, trend: [] };
  }
  // raw 각 행: [ts, v1, v2, ...]. 마지막 행의 값으로 현재값 채움.
  const last = raw[raw.length - 1];
  const filled = chans.map((c, i) => {
    const v = Number(last?.[i + 1]);
    return { ...c, value: Number.isFinite(v) ? v : null };
  });
  // 대표 채널(첫 채널) 트렌드 = 각 행의 첫 값
  const trend = raw
    .map((r) => Number(r?.[1]))
    .filter((n) => Number.isFinite(n))
    .slice(-24);
  return { chans: filled, trend };
}

// ── 개발용 자동 등록(시드) 헬퍼 ──────────────────────────────────────────────
// 운영 코드 아님: 더미 .txt 로 앱을 채워 테스트하기 위한 헤드리스 등록 보조.

/** preview[0] 이 헤더(라벨 행)인지 — sensorModel 의 looksHeader 와 동일 규칙. */
function looksHeaderRow(row) {
  if (!row || row.length < 2) return false;
  const first = String(row[0] ?? '').trim();
  if (first !== '' && isNaN(Number(first)) && isNaN(Date.parse(first))) return true;
  return row.slice(1).some((c) => c !== '' && isNaN(Number(c)));
}
/** 헤더 행 제거 → 데이터 행만. */
function stripHeaderRows(preview) {
  if (!preview || !preview.length) return [];
  return looksHeaderRow(preview[0]) ? preview.slice(1) : preview;
}
/** 보기 좋은 자릿수로 반올림(크기에 따라). */
function roundSig(n) {
  if (!Number.isFinite(n)) return n;
  const a = Math.abs(n);
  if (a === 0) return 0;
  const d = a >= 100 ? 0 : a >= 1 ? 1 : 3;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
/**
 * 샘플 행에서 한 센서가 쓰는 열들의 값으로 **보수적 정상범위(raw 글리치 컷)** 를 도출.
 * 관측 [min,max] 에 넉넉한 패딩(span×2, |값|×20%, 최소 1)을 줘서 진짜 실측은 통과,
 * 물리적으로 튄 극단값만 범위 밖으로 떨어지게 한다. (판정은 백엔드 — 여긴 입력 보조)
 * @returns {{min:number,max:number}|null}
 */
function deriveRangeFromRows(rows, sensor) {
  const cols = sensor?.columns?.length ? sensor.columns : [sensor?.ch].filter((c) => c != null);
  const vals = [];
  for (const row of rows || []) {
    for (const col of cols) {
      const v = Number(row?.[col]);
      if (Number.isFinite(v)) vals.push(v);
    }
  }
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min;
  const pad = Math.max(span * 2, Math.abs(max) * 0.2, Math.abs(min) * 0.2, 1);
  return { min: roundSig(min - pad), max: roundSig(max + pad) };
}
/** 채널들의 sensor_type 다수결 → 노드 대표 종류(백엔드 enum). 없으면 ''. */
function pickRepresentativeType(sensors) {
  const counts = {};
  for (const s of sensors) if (s.sensorType) counts[s.sensorType] = (counts[s.sensorType] || 0) + 1;
  let best = '', bestN = 0;
  for (const [t, n] of Object.entries(counts)) if (n > bestN) { best = t; bestN = n; }
  return best;
}

/**
 * 감시폴더 파일 하나(DetectedFile)에서 노드의 수신 시각들을 갱신한다.
 *
 * **Pulse 는 수집기다 — 자기 파일에 뭐가 들어왔는지를 보고한다.**
 *   lastRx        = 파일 안 마지막 데이터 행의 시각(dataEnd). 없으면 null(미상).
 *   lastFileWrite = 그 파일이 저장된 시각(mtime). 진단용으로만 보관·표시.
 *
 * 두 값이 갈라지는 순간이 곧 진단이다:
 *   둘 다 옛날      → 로거가 멈춤
 *   파일저장만 최신 → 로거는 도는데 센서가 값을 못 줌 (덮어쓰기만 하고 있음)
 *
 * ⚠️ dataEnd 가 없다고 mtime 으로 때우면 안 된다. 그게 원래 버그였다.
 * @param {object} node 스토어 노드
 * @param {object} file DetectedFile (folderApi.scanFolder 매핑 결과)
 */
function applyFileTimes(node, file) {
  const dataMs = file?.dataEnd ? Date.parse(file.dataEnd) : NaN;
  const lastRx = Number.isFinite(dataMs) ? dataMs : null;
  const writeMs = file?.modified ? Date.parse(file.modified) : NaN;
  return {
    ...node,
    lastRx,
    lastFileWrite: Number.isFinite(writeMs) ? writeMs : null,
    dataStart: file?.dataStart ? Date.parse(file.dataStart) : null,
    reception: receptionOf(lastRx, node.intervalMin),
  };
}

/** 등록/백엔드 조회 입력(p)을 표시용 노드 객체로 빌드. (메모리 노드의 단일 생성기) */
function buildNode(p) {
  const intervalMin = p.intervalMin ?? 60;
  const lastRx = p.lastRx ?? null;
  // 라벨/단위는 백엔드 몫이라 받지 않음 → 표시는 코드로 (단위 빈값)
  const baseChans = (p.channels || []).map((c) => ({
    ch: c.ch,
    code: c.code,
    label: c.label || c.code,
    unit: c.unit || '',
    value: null,
    lifecycle: c.lifecycle || 'active', // 생명주기(active/inactive) — 백엔드 GET 에서 옴, 기본 정상
    sensorType: c.sensorType || '',     // 채널별 계측 종류(노드 1개에 종류 혼재). 빈값=노드 대표 종류 폴백
  }));
  const { chans, trend } = deriveFromRaw(p.raw, baseChans);
  return {
    id: p.id,
    name: (p.name || p.id || '').trim(), // 가칭 폐지 → 노드 ID 를 name 으로(없으면 id 폴백)
    model: p.model || '—',
    type: p.type || '데이터로거',
    sensorType: p.sensorType || '', // 계측기 종류(메타) — 데이터 전송 페이로드엔 미포함
    proto: p.proto || '—',
    reception: receptionOf(lastRx, intervalMin),
    lastRx,
    // 원본 .txt 가 마지막으로 저장된 시각(mtime). lastRx 와 갈라지면 진단 신호가 된다
    // (둘 다 옛날=로거 멈춤 / 이것만 최신=로거는 도는데 값이 안 들어옴). 미상 null.
    lastFileWrite: p.lastFileWrite ?? null,
    dataStart: p.dataStart ?? null, // 파일 안 첫 데이터 시각 — 수집 구간 표시용
    intervalMin,
    transmit: p.transmit || 'queued',
    buffer: p.rows ?? 0,
    retry: 0,
    rows24h: 0,
    chans,
    trend,
    raw: Array.isArray(p.raw) ? p.raw : [],
    sourceFile: p.sourceFile || '',
    series: p.series || null, // 깊이 프로파일(시리즈) 메타 — 표시용
    // ingest 매핑용 센서 모델(열→센서) + 증분 워터마크(마지막 전송 시각).
    // 워터마크 미지정(신규 등록)이면 null → 첫 동기화 때 파일 전체 백필 전송.
    //   (백엔드 ingest 가 완전 멱등이라 겹침/재전송 안전. 재연결 노드는 백엔드 last_seen 을 워터마크로 받음.)
    // ⚠️ lastRx(=파일 수정시각)로 잡지 말 것 — 데이터 타임스탬프가 과거면 전부 제외돼 아무것도 안 감.
    sensors: Array.isArray(p.sensors) ? p.sensors : null,
    lastSentTs: p.lastSentTs ?? null,
    tombstone: !!p.tombstone, // 원본 .txt 가 사라짐(삭제/이름변경) → 수집 중단·회색 표시
    formatError: !!p.formatError, // 등록 후 원본 형식이 깨짐(낙서·표 파괴) → 수집 중단·빨강 표시
    // 배치 현장(읽기 전용, 백엔드가 정함). 미배치 null. 전송엔 안 쓰임(현장-블라인드).
    siteName: p.siteName ?? null,
    siteCode: p.siteCode ?? null,
    // 운영 시작 기준일(ISO/KST 문자열) — 이 시점 이전은 백엔드 분석/고장의심/기본차트 제외. 미설정 null.
    monitoringFrom: p.monitoringFrom ?? null,
  };
}

export function PulseProvider({ children }) {
  const [nodes, setNodes] = useState([]);
  // 자동 수집 주기의 단일 출처(SYNC_INTERVAL_MS)로 실제 타이머와 화면 문구가 갈라지지 않게 한다.
  const [lastSyncAt, setLastSyncAt] = useState(null); // 마지막으로 파일을 확인한 시각(epoch ms). 미확인 null
  const [syncing, setSyncing] = useState(false);      // 전송 진행 중 — 버튼 중복 클릭 방지
  const [detectedFiles, setDetectedFiles] = useState([]);
  // 채널 타입은 "도감"(참조 마스터)이라 표준 계측기 종류로 시드합니다.
  // 런타임 데이터(nodes/detectedFiles)는 제로 디폴트 — 이건 사전(dictionary)이라 예외.
  const [channelTypes, setChannelTypes] = useState(() => CHANNEL_TYPE_SEED.map((t) => ({ ...t })));
  const [watchFolder, setWatchFolderState] = useState('');
  const [ingest, setIngest] = useState({
    endpoint: '',
    status: 'disconnected',
    latency: '—',
    lastAck: '—',
  });
  // 정상범위(raw 글리치 컷) 입력값 — { [rangeKey(nodeId,code)]: { min, max } }. 임시 localStorage 영속.
  // 판정은 백엔드 — 펄스는 입력 보관 + POST /nodes 전송만.
  const [channelRanges, setChannelRanges] = useState(loadChannelRanges);

  // 감지 파일 목록의 registered 플래그를 현재 노드(sourceFile/nodeId)와 대조해 갱신
  const markRegistered = useCallback(
    (files, nodeList) =>
      files.map((f) => ({
        ...f,
        registered: nodeList.some(
          (n) => n.sourceFile === f.fullPath || n.id === f.nodeId,
        ),
      })),
    [],
  );

  /**
   * 워치 폴더를 다시 스캔. (folder:scan IPC)
   * + tombstone 판정: 등록 노드의 sourceFile 이 스캔 결과에 없으면 "원본 없음"으로 표시.
   *   단 폴더 접근 불가(오프라인)면 오탐 방지를 위해 판정을 건너뜀.
   * + **수신 시각 갱신**: 스캔할 때마다 파일 안 마지막 데이터 시각(dataEnd)으로
   *   lastRx 를 다시 채운다. 전송 성공에만 의존하면 보낼 게 없는 노드는 영영
   *   등록 당시 값에 박제된다.
   */
  const refreshFiles = useCallback(async () => {
    const root = await folderApi.getRootFolder();
    setWatchFolderState(root || '');
    const files = await folderApi.scanFolder(root);
    let folderOk = false;
    try {
      const v = await folderApi.validateFolder(root);
      folderOk = !!(v && v.accessible && v.exists);
    } catch { folderOk = false; }
    const scanned = new Set(files.map((f) => f.fullPath));
    const byPath = new Map(files.map((f) => [f.fullPath, f]));
    const byNodeId = new Map(files.map((f) => [f.nodeId, f]));
    setNodes((cur) => {
      // sourceFile 있는 노드만 판정. 폴더 오프라인이면 기존 상태 유지.
      const next = folderOk
        ? cur.map((n) => {
            const f = byPath.get(n.sourceFile) || byNodeId.get(n.id);
            const base = n.sourceFile ? { ...n, tombstone: !scanned.has(n.sourceFile) } : n;
            return f ? applyFileTimes(base, f) : base;
          })
        : cur;
      setDetectedFiles(markRegistered(files, next));
      return next;
    });
    return files;
  }, [markRegistered]);

  /** 워치 폴더 경로 설정 (folder:set-root IPC) 후 재스캔. */
  const setWatchFolder = useCallback(
    async (p) => {
      const saved = await folderApi.setRootFolder(p);
      setWatchFolderState(saved || '');
      const files = await folderApi.scanFolder(saved);
      setDetectedFiles(markRegistered(files, nodes));
      return saved;
    },
    [nodes, markRegistered],
  );

  /**
   * 노드 등록 (TODO IPC: nodes:register). Phase 1 = 메모리 추가.
   * @param {Object} p { id, model, type, proto, intervalMin, channels, sourceFile, lastRx, rows, raw }
   */
  const registerNode = useCallback((p) => {
    const node = buildNode(p);
    setNodes((cur) => {
      const next = [...cur.filter((n) => n.id !== node.id), node];
      setDetectedFiles((files) => markRegistered(files, next));
      return next;
    });
    return node;
  }, [markRegistered]);

  /** 여러 노드 일괄 등록. */
  const registerNodes = useCallback((list) => {
    list.forEach((p) => registerNode(p));
  }, [registerNode]);

  /** 노드 제거 (메모리). 백엔드 영구 삭제는 호출부에서 deleteNodeBackend 후 이걸로 목록 정리. */
  const deleteNode = useCallback((id) => {
    setNodes((cur) => {
      const next = cur.filter((n) => n.id !== id);
      setDetectedFiles((files) => markRegistered(files, next));
      return next;
    });
  }, [markRegistered]);

  /**
   * 센서 생명주기 상태 변경 (PATCH /sensors/{sensor_code}). 펄스가 명시 보고.
   *   active=정상 · inactive=고장/정지(교체필요·sticky). (레거시 dead/disabled 폐기)
   *   offline(시간추론)과 별개 — 백엔드는 inactive 를 평균·offline 판정에서 제외.
   * @param {string} nodeId  @param {string} channelCode  @param {'active'|'inactive'} status
   * @returns {Promise<{ok:boolean, error?:string}>}
   */
  const setSensorLifecycle = useCallback(async (nodeId, channelCode, status) => {
    const sensorCode = ingestSensorCode(nodeId, channelCode); // {node}-{code}
    const r = await folderApi.setSensorStatusBackend(sensorCode, status);
    if (r?.ok) {
      const applied = r.lifecycle_state || status;
      setNodes((cur) => cur.map((n) => (n.id !== nodeId ? n : {
        ...n,
        chans: n.chans.map((c) => (c.code === channelCode ? { ...c, lifecycle: applied } : c)),
      })));
    }
    return r;
  }, []);

  /**
   * 백엔드 노드 목록(GET /nodes)으로 모니터를 채움.
   * **자기 노드만 필터**: 백엔드는 전체를 주지만(펄스별 링크 없음), 이 수집기의
   * 감시폴더 파일에서 나온 node_code 와 일치하는 노드만 표시한다(남의 PC 노드 제외).
   * 아직 전송 안 된 로컬 등록 노드(id 미중복)는 그대로 보존.
   * @returns {Promise<{ok:boolean, error?:string, nodes:object[], shown?:number}>}
   */
  const loadNodesFromBackend = useCallback(async () => {
    const r = await folderApi.listNodesBackend();
    if (!(r?.ok && Array.isArray(r.nodes))) return r;

    // 내 감시폴더 파일 — node_code 매칭(자기 노드 필터) + 재연결(sourceFile/센서모델) 소스
    let files = [];
    try {
      const root = await folderApi.getRootFolder();
      files = (await folderApi.scanFolder(root)) || [];
    } catch { files = []; }
    const fileByCode = new Map(files.map((f) => [f.nodeId, f]));
    const myCodes = files.length ? new Set(files.map((f) => f.nodeId)) : null;

    const mine = r.nodes
      .filter((n) => n.nodeId)
      .filter((n) => !myCodes || myCodes.has(n.nodeId)); // 자기 노드만

    // 재연결: 같은 ID 파일에 sourceFile 연결 + 열→센서 매핑 재계산 → 재시작 후에도 ingest 가능.
    // (저장 불필요 — 백엔드 ingest 가 완전 멱등이라 겹쳐 보내도 안전. 매핑은 파일에서 매번 재도출.)
    const incoming = await Promise.all(mine.map(async (n) => {
      const file = fileByCode.get(n.nodeId);
      let sourceFile = '';
      let sensors = null;
      let series = null;
      if (file) {
        sourceFile = file.fullPath;
        try {
          const analysis = await folderApi.analyzeFile(file.fullPath);
          if (analysis) {
            const model = resolveSensors(analysis, { sensorType: n.sensorType, nodeId: n.nodeId });
            sensors = model.sensors;
            series = model.series;
            // 백엔드의 실제 센서코드를 ingest 에 사용(센서코드의 정본=백엔드). 타입/약어가 바뀌어도
            // 어긋나지 않게, 파일에서 도출한 센서 구조(컬럼·깊이 매핑)에 백엔드 코드를 위치로 덮어씀.
            // 개수가 다르면(잉여/누락) 위험하니 재계산 코드를 유지하고 다음 등록(replace)이 정합시킴.
            const beCodes = (n.channels || []).map((c) => c.code).filter(Boolean);
            if (sensors && beCodes.length === sensors.length) {
              sensors = sensors.map((s, i) => ({ ...s, code: beCodes[i] }));
            }
          }
        } catch { /* 분석 실패 시 연결만 — 전송은 다음 기회 */ }
      }
      // 수신 시각: **내 파일이 있으면 내 파일이 정본**(dataEnd). Pulse 는 수집기라
      // "내가 받은 것"을 보고해야 한다. 백엔드 last_seen 은 타사 PC 가 채웠을 수 있어서
      // 그대로 쓰면 내 파일이 끊겼는데 "수신중"으로 보인다(80053 사례).
      // 내 파일이 없는 노드(타사 담당)만 백엔드 값으로 폴백한다.
      const dataMs = file?.dataEnd ? Date.parse(file.dataEnd) : NaN;
      const writeMs = file?.modified ? Date.parse(file.modified) : NaN;
      const lastRx = file
        ? (Number.isFinite(dataMs) ? dataMs : null)
        : (n.lastRx ?? null);

      return buildNode({
        id: n.nodeId,
        name: n.name,
        sensorType: n.sensorType,
        intervalMin: n.intervalMin ?? undefined,
        lastRx,
        lastFileWrite: Number.isFinite(writeMs) ? writeMs : null,
        dataStart: file?.dataStart ? Date.parse(file.dataStart) : null,
        channels: n.channels || [],
        transmit: 'sent', // 백엔드에 이미 있는 노드 → 전송완료로 표시
        sourceFile,
        sensors,
        series,
        siteName: n.siteName ?? null, // 배치 현장(읽기 전용 표시)
        siteCode: n.siteCode ?? null,
        monitoringFrom: n.monitoringFrom ?? null, // 운영 시작 기준일(백엔드 보관값 복원)
        // 워터마크 = 백엔드 last_seen → 그 이후만 이어 전송(없으면 null → 백필). 멱등이라 겹쳐도 안전.
        lastSentTs: n.lastRx ?? null,
      });
    }));

    const ids = new Set(incoming.map((n) => n.id));
    setNodes((cur) => {
      const localOnly = cur.filter((n) => !ids.has(n.id)); // 로컬에만 있던 미전송 노드 보존
      const next = [...incoming, ...localOnly];
      setDetectedFiles((f) => markRegistered(f, next));
      return next;
    });
    return { ...r, shown: incoming.length };
  }, [markRegistered]);

  /**
   * 한 노드의 신규 측정값을 백엔드로 전송 (증분: 마지막 전송 시각 이후 행만).
   *   파일 신규행 읽기(files:read-measurements) → 센서별 measurements 구성 → ingest POST.
   *   전부 성공해야 워터마크(lastSentTs)를 전진 → 실패 시 다음 주기 재시도(중복/누락 없음).
   * @param {object} node  스토어 노드 객체
   * @returns {Promise<{ok:boolean, sent:number, error?:string, skipped?:boolean}>}
   */
  const syncNode = useCallback(async (node) => {
    if (!node?.sourceFile || !node.sensorType || !Array.isArray(node.sensors) || !node.sensors.length) {
      return { ok: false, sent: 0, skipped: true }; // 파일/센서모델 없는(예: 백엔드 조회) 노드는 전송 불가
    }
    // 워터마크 = 마지막 전송 시각(lastSentTs)만 사용. 없으면(신규 등록) 0 → 파일 전체 백필.
    // ⚠️ lastRx(=파일 수정시각/수신시각)로 잡지 말 것 — 데이터 타임스탬프가 그보다 과거면(예: 5월 데이터,
    //    파일은 오늘 생성) 전부 제외돼 0건이 됨. 백엔드 ingest 가 멱등이라 백필 겹침은 안전.
    const since = node.lastSentTs ?? 0;
    const r = await folderApi.readMeasurements(node.sourceFile, since);
    if (!r?.ok) return { ok: false, sent: 0, error: r?.error || 'read' };

    // 형식 재검증: 등록 후 원본이 깨졌으면(낙서·표 파괴) 전송 중단하고 "형식 오류" 표시.
    //   ① 표가 아님(classifyFormat='error', 예: 열 1개) 또는
    //   ② 데이터 줄 첫 칸이 더 이상 시각이 아님(쉼표 낙서 등 — 등록 땐 시각이었음).
    // 일시적 비정형(warn)은 통과(전송은 어차피 유효 행만 골라 보냄).
    const sampleTsBad = Array.isArray(r.sample) && r.sample.length >= 1 && r.sample[0] !== '' && !isDateLike(r.sample[0]);
    const bad = classifyFormat(r.head, r.sample).status === 'error' || sampleTsBad;
    if (node.formatError !== bad) {
      setNodes((cur) => cur.map((n) => (n.id === node.id ? { ...n, formatError: bad } : n)));
    }
    if (bad) return { ok: false, sent: 0, error: 'format', skipped: true }; // 깨진 동안 전송 보류

    const rows = r.rows || [];
    if (!rows.length) return { ok: true, sent: 0 }; // 새 데이터 없음

    // 셀 → ingest value (정직한 raw 전송 — 품질 판정은 백엔드 담당).
    //   undefined(열 자체 없음=구조적 깨짐) → 스킵 표식
    //   빈 셀/비숫자(측정 실패)            → null(결측) — 버리지 말고 보내 백엔드가 missing 판정
    //   0·저값 등 유효숫자                 → 그대로 — 백엔드가 유효범위로 invalid/ok 판정
    // ⚠️ Number('')===0 함정: 빈 셀이 0(정상값)으로 둔갑하지 않도록 빈 문자열을 먼저 null 처리.
    const num = (v) => {
      if (v === undefined) return undefined;        // 열 누락 = 구조적 깨짐 → 스킵
      const s = String(v).trim();
      if (s === '') return null;                    // 빈 셀 = 측정 실패 → 결측
      const n = Number(s);
      return Number.isFinite(n) ? n : null;         // 비숫자 = 결측
    };
    // 비활성(inactive) 센서는 전송 제외 — 펄스가 이미 상태를 보고했고 백엔드도 inactive 를 제외함.
    const inactive = new Set(
      (node.chans || [])
        .filter((c) => c.lifecycle && c.lifecycle !== 'active')
        .map((c) => ingestSensorCode(node.id, c.code)),
    );
    let allOk = true;
    let unconfigured = false;
    for (const s of node.sensors) {
      if (inactive.has(ingestSensorCode(node.id, s.code))) continue; // inactive → 전송 skip
      let measurements;
      if (s.role === 'profile' && s.depthProfile?.points) {
        // 깊이 프로파일: 행 × 깊이열 → 깊이별 측정값(depthLabel = 깊이 코드)
        measurements = [];
        rows.forEach((row) => {
          (s.columns || []).forEach((col, k) => {
            const value = num(row.cells[col]);
            if (value === undefined) return; // 열 누락만 스킵; null(결측)은 보존 전송
            measurements.push({ measuredAt: toIso(row.at), value, depthLabel: s.depthProfile.points[k]?.code });
          });
        });
      } else if (s.role === 'multiraw' && Array.isArray(s.rawKeys)) {
        // 다채널 원시: 행마다 raw_channels[{key,raw}]. value 는 안 보냄(백엔드가 계산).
        //   열 누락(undefined)만 제외; 빈셀·비숫자(null=결측)는 보존. 전부 누락이면 그 행 스킵.
        measurements = rows
          .map((row) => ({
            measuredAt: toIso(row.at),
            raw_channels: (s.columns || [])
              .map((col, i) => ({ key: s.rawKeys[i], raw: num(row.cells[col]) }))
              .filter((rc) => rc.key !== undefined && rc.raw !== undefined),
          }))
          .filter((m) => m.raw_channels.length);
      } else {
        const col = (s.columns && s.columns[0]) ?? s.ch;
        measurements = rows
          .map((row) => ({ measuredAt: toIso(row.at), value: num(row.cells[col]) }))
          .filter((m) => m.value !== undefined); // 열 누락만 제외; null(결측)은 보존 전송
      }
      if (!measurements.length) continue;
      const res = await folderApi.ingestBackend({ nodeId: node.id, channelCode: s.code, measurements });
      if (res?.error === 'unconfigured' || res?.error === 'no_electron') { unconfigured = true; break; }
      if (!res?.ok) allOk = false;
    }
    if (unconfigured) return { ok: false, sent: 0, error: 'unconfigured' }; // 상태 변경 없음

    const maxTs = rows[rows.length - 1].ts;
    setNodes((cur) => cur.map((n) => {
      if (n.id !== node.id) return n;
      return allOk
        ? { ...n, lastSentTs: maxTs, lastRx: maxTs, transmit: 'sent', buffer: 0, rows24h: (n.rows24h || 0) + rows.length }
        : { ...n, transmit: 'retry', buffer: (n.buffer || 0) + rows.length }; // 실패 → 워터마크 유지, 다음에 재시도
    }));
    return { ok: allOk, sent: allOk ? rows.length : 0 };
  }, []);

  /**
   * 모든 노드의 신규 측정값을 순차 전송.
   *   완료 시 lastSyncAt 을 찍어 UI 가 "언제 마지막으로 확인했는지"를 보여줄 수 있게 한다.
   *   (예전엔 UI 가 nodes[0].intervalMin 으로 가짜 카운트다운을 그렸다 — 실제 주기는
   *    App.jsx 의 60초 고정이며 노드 주기와 무관하다.)
   * @returns {{sent:number, nodes:number}}
   */
  const syncAll = useCallback(async () => {
    let sent = 0; let synced = 0;
    setSyncing(true);
    try {
      for (const n of nodes) {
        const res = await syncNode(n);
        if (res?.ok && res.sent) { sent += res.sent; synced += 1; }
      }
      setLastSyncAt(Date.now()); // 보낼 게 없었어도 "확인은 했다" — 자동 확인이 살아있다는 증거
    } finally {
      setSyncing(false);
    }
    return { sent, nodes: synced };
  }, [nodes, syncNode]);

  /** 지금 재전송 (TODO IPC: ingest:retry). 메모리 시뮬: 전송완료로. */
  const retryNode = useCallback((id) => {
    setNodes((cur) =>
      cur.map((n) =>
        n.id === id
          ? { ...n, transmit: 'sent', buffer: 0, retry: n.retry + 1 }
          : n,
      ),
    );
  }, []);

  /** 버퍼 비우기 (TODO IPC: ingest:flush). */
  const flushNode = useCallback((id) => {
    setNodes((cur) =>
      cur.map((n) => (n.id === id ? { ...n, buffer: 0, transmit: 'sent' } : n)),
    );
  }, []);

  /** 전체 재전송 (대기 건 일괄). */
  const retryAll = useCallback(() => {
    setNodes((cur) =>
      cur.map((n) =>
        n.transmit === 'sent'
          ? n
          : { ...n, transmit: 'sent', buffer: 0, retry: n.retry + 1 },
      ),
    );
  }, []);

  /**
   * 기록 간격 변경 — 로컬 즉시 반영(수신 판정 재계산) + 백엔드 PATCH(report_interval_min).
   * 전용 PATCH 라 센서/채널은 안 건드림(2026-06-01 백엔드 신설). intervalMin=null 이면 간격 해제.
   * @returns {Promise<{ok:boolean, error?:string, local?:boolean}>}
   */
  const updateNodeInterval = useCallback(async (id, intervalMin) => {
    setNodes((cur) => cur.map((n) =>
      n.id === id ? { ...n, intervalMin, reception: receptionOf(n.lastRx, intervalMin) } : n,
    ));
    if (!folderApi.isElectron()) return { ok: true, local: true };
    return folderApi.setNodeIntervalBackend(id, intervalMin);
  }, []);

  /**
   * 운영 시작 기준일(monitoring_from) 변경 — 로컬 즉시 반영 + 백엔드 POST /nodes(monitoring_from 만).
   *   monitoringFromIso = ISO/KST 문자열 또는 null(해제). sensor_type 없으면 전송 불가.
   * @returns {Promise<{ok:boolean, error?:string, local?:boolean}>}
   */
  const updateMonitoringFrom = useCallback(async (id, monitoringFromIso) => {
    const node = nodes.find((n) => n.id === id);
    setNodes((cur) => cur.map((n) => (n.id === id ? { ...n, monitoringFrom: monitoringFromIso ?? null } : n)));
    if (!folderApi.isElectron()) return { ok: true, local: true };
    if (!node?.sensorType) return { ok: false, error: 'no_sensor_type' };
    return folderApi.setMonitoringFromBackend({ nodeId: id, sensorType: node.sensorType, monitoringFrom: monitoringFromIso ?? null });
  }, [nodes]);

  /**
   * 채널(센서) 정상범위 입력. range={min,max}(숫자|null). 둘 다 null/빈값이면 키 삭제(검사 안 함).
   * 입력 보관 전용 — 판정은 백엔드. localStorage 즉시 영속(Phase 2 SQLite).
   */
  const setChannelRange = useCallback((nodeId, channelCode, range) => {
    const key = rangeKey(nodeId, channelCode);
    setChannelRanges((cur) => {
      const next = { ...cur };
      const min = range && range.min != null ? range.min : null;
      const max = range && range.max != null ? range.max : null;
      if (min != null || max != null) next[key] = { min, max };
      else delete next[key];
      if (typeof window !== 'undefined') {
        try { window.localStorage.setItem(RANGES_KEY, JSON.stringify(next)); } catch { /* 영속 실패 무시 */ }
      }
      return next;
    });
  }, []);

  /**
   * 개발/테스트용 자동 등록 — 감시 폴더의 모든 .txt 를 위저드와 동일 경로
   * (analyzeFile→resolveSensors→registerNode)로 헤드리스 일괄 등록한다.
   * 채널/종류/단위는 해석기가 추론, 정상범위(임계치)는 샘플 데이터에서 보수적으로 자동 도출.
   * 형식 오류(🔴 표 깨짐)는 건너뛴다(GUI 등록 게이트와 동일). 운영 트리거 아님(?test=import).
   * @param {{deriveRanges?:boolean, sendBackend?:boolean}} [opts]
   * @returns {Promise<{folder:string, scanned:number, registered:object[], skipped:object[]}>}
   */
  const autoImportFromFolder = useCallback(async (opts = {}) => {
    const { deriveRanges = true, sendBackend = true } = opts;
    const root = await folderApi.getRootFolder();
    const files = (await folderApi.scanFolder(root)) || [];
    const summary = { folder: root || '', scanned: files.length, registered: [], skipped: [] };
    for (const f of files) {
      try {
        if (f.format?.status === 'error') {
          summary.skipped.push({ id: f.nodeId, reason: f.format?.reason || '형식 오류(표 깨짐)' });
          continue;
        }
        const analysis = await folderApi.analyzeFile(f.fullPath);
        if (!analysis) { summary.skipped.push({ id: f.nodeId, reason: '분석 실패' }); continue; }
        // 헤더 코드로 종류를 못 잡는 번호형(1,2,3) 더미는 파일명에서 종류 추론
        // (예: '03_groundwater' → groundwater). resolveSensors 에 넘겨 종류·코드(GW-1) 동시 해결.
        const nameType = guessSensorTypeFromName(f.name || f.nodeId);
        const winner = resolveSensors(analysis, { nodeId: f.nodeId, sensorType: nameType });
        if (winner.status === 'error' || !winner.sensors.length) {
          summary.skipped.push({ id: f.nodeId, reason: winner.reason || '센서 없음' });
          continue;
        }
        const nodeSensorType = pickRepresentativeType(winner.sensors) || nameType;
        const channels = winner.sensors.map((s) => ({
          ch: s.ch, code: s.code,
          sensorType: s.sensorType || undefined,
          unit: sensorTypeUnit(s.sensorType) || undefined,
        }));
        const dataRows = stripHeaderRows(analysis.preview);
        registerNode({
          id: f.nodeId, model: 'YH-DL16', type: '데이터로거', proto: 'Modbus TCP',
          sensorType: nodeSensorType, name: f.nodeId, intervalMin: 60,
          channels, sensors: winner.sensors, sourceFile: f.fullPath,
          // 수신 시각 = 파일 안 마지막 데이터 시각. 없으면 null(미상) — mtime 으로 때우지 않는다.
          lastRx: f.dataEnd ? Date.parse(f.dataEnd) : null,
          lastFileWrite: f.modified ? Date.parse(f.modified) : null,
          dataStart: f.dataStart ? Date.parse(f.dataStart) : null,
          rows: analysis.rowCount ?? f.rows ?? 0, raw: dataRows,
          series: winner.series || null, monitoringFrom: null,
        });
        let ranged = 0;
        if (deriveRanges) {
          for (const s of winner.sensors) {
            const r = deriveRangeFromRows(dataRows, s);
            if (r) { setChannelRange(f.nodeId, s.code, r); ranged++; }
          }
        }
        // 백엔드 등록(설정 시) — 위저드와 동일 payload. 실패해도 로컬은 등록됨.
        if (sendBackend && folderApi.isElectron() && nodeSensorType) {
          try {
            await folderApi.registerNodeBackend({
              nodeId: f.nodeId, sensorType: nodeSensorType, channels,
              sensorCount: channels.length, intervalMin: 60, sensorSync: 'replace',
            });
          } catch { /* 백엔드 전송 실패 무시 */ }
        }
        summary.registered.push({
          id: f.nodeId, sensorType: nodeSensorType || '(미지정)',
          channels: channels.length, ranges: ranged, pattern: winner.pattern,
        });
      } catch (e) {
        summary.skipped.push({ id: f?.nodeId, reason: String(e?.message || e) });
      }
    }
    console.log('[auto-import] summary →', summary);
    return summary;
  }, [registerNode, setChannelRange]);

  /**
   * 현재 노드의 채널 정상범위를 백엔드로 저장 (POST /nodes, 같은 node_code 멱등 갱신).
   * 화면에 보이는 그대로 전송(WYSIWYG): 각 채널 valid_min/valid_max = 설정값 또는 null(해제).
   * 채널별 sensor_type/unit 도 함께 실어 분류 유지(노드 1개에 종류 혼재). sensor_type 없으면 전송 불가.
   * @returns {Promise<{ok:boolean, error?:string, ...}>}
   */
  const saveChannelRanges = useCallback(async (node) => {
    if (!node?.id) return { ok: false, error: 'no_node_code' };
    if (!node.sensorType) return { ok: false, error: 'no_sensor_type' };
    const channels = (node.chans || []).map((c) => {
      const r = channelRanges[rangeKey(node.id, c.code)];
      return { code: c.code, sensorType: c.sensorType || undefined, unit: c.unit || undefined, validMin: r?.min ?? null, validMax: r?.max ?? null };
    });
    return folderApi.setSensorRangesBackend({ nodeId: node.id, sensorType: node.sensorType, channels });
  }, [channelRanges]);

  /**
   * 채널별 계측 종류(sensor_type) 변경 — 로컬 즉시 반영 + 백엔드 POST /nodes(additive).
   *   단위(unit)는 종류 기본값으로 자동 갱신. 노드 대표 종류(node.sensorType)는 폴백으로 유지.
   *   바뀐 채널만이 아니라 현재 채널 종류/단위(+설정된 범위)를 함께 재전송해 분류를 일관 유지.
   * @returns {Promise<{ok:boolean, error?:string, local?:boolean}>}
   */
  const setChannelSensorType = useCallback(async (nodeId, channelCode, sensorType) => {
    const node = nodes.find((n) => n.id === nodeId);
    const unit = sensorTypeUnit(sensorType);
    setNodes((cur) => cur.map((n) => (n.id !== nodeId ? n : {
      ...n,
      chans: n.chans.map((c) => (c.code === channelCode ? { ...c, sensorType, unit: unit || c.unit } : c)),
    })));
    if (!folderApi.isElectron()) return { ok: true, local: true };
    if (!node?.sensorType) return { ok: false, error: 'no_sensor_type' };
    const channels = (node.chans || []).map((c) => {
      const isTarget = c.code === channelCode;
      const t = isTarget ? sensorType : c.sensorType;
      const u = isTarget ? (unit || c.unit) : c.unit;
      const r = channelRanges[rangeKey(nodeId, c.code)];
      return { code: c.code, sensorType: t || undefined, unit: u || undefined, validMin: r?.min ?? undefined, validMax: r?.max ?? undefined };
    });
    return folderApi.setSensorRangesBackend({ nodeId, sensorType: node.sensorType, channels });
  }, [nodes, channelRanges]);

  /** 채널 타입 추가/수정 (TODO IPC: channels:add). */
  const addChannelType = useCallback((t) => {
    setChannelTypes((cur) => [...cur.filter((x) => x.code !== t.code), t]);
  }, []);

  /** 채널 타입 제거. */
  const removeChannelType = useCallback((code) => {
    setChannelTypes((cur) => cur.filter((x) => x.code !== code));
  }, []);

  /** 표준 계측기 종류(도감 시드)를 다시 불러오기 (기존과 병합, 코드 기준). */
  const loadDefaults = useCallback(() => {
    setChannelTypes((cur) => {
      const codes = new Set(cur.map((t) => t.code));
      const add = CHANNEL_TYPE_SEED.filter((t) => !codes.has(t.code)).map((t) => ({ ...t }));
      return [...cur, ...add];
    });
  }, []);

  const value = useMemo(
    () => ({
      nodes,
      detectedFiles,
      channelTypes,
      watchFolder,
      ingest,
      channelRanges,
      setChannelRange,
      saveChannelRanges,
      setChannelSensorType,
      isElectron: folderApi.isElectron(),
      refreshFiles,
      setWatchFolder,
      registerNode,
      registerNodes,
      autoImportFromFolder,
      deleteNode,
      loadNodesFromBackend,
      syncNode,
      syncAll,
      lastSyncAt, // 마지막 자동/수동 확인 시각 — 헤더의 "N분 전 확인함" 표시용
      syncing,
      setSensorLifecycle,
      updateNodeInterval,
      updateMonitoringFrom,
      retryNode,
      flushNode,
      retryAll,
      addChannelType,
      removeChannelType,
      loadDefaults,
      setIngest,
    }),
    [
      nodes, detectedFiles, channelTypes, watchFolder, ingest,
      refreshFiles, setWatchFolder, registerNode, registerNodes, autoImportFromFolder, deleteNode, loadNodesFromBackend,
      syncNode, syncAll, lastSyncAt, syncing, setSensorLifecycle, updateNodeInterval, updateMonitoringFrom,
      retryNode, flushNode, retryAll, addChannelType, removeChannelType, loadDefaults,
      channelRanges, setChannelRange, saveChannelRanges, setChannelSensorType,
    ],
  );

  return <PulseContext.Provider value={value}>{children}</PulseContext.Provider>;
}

export function usePulse() {
  const ctx = useContext(PulseContext);
  if (!ctx) throw new Error('usePulse must be used within <PulseProvider>');
  return ctx;
}
