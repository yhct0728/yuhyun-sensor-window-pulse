// ─────────────────────────────────────────────────────────────────────────────
// backendApi — 백엔드(GeoMonitor) 호출 계약 단일 소스
//
// 2026-05-30 백엔드 트랙 이전: 레거시(/api/legacy/*) 폐지 → 펄스 전용(/api/pulse/v1/*).
//   base = 백엔드 URL + /api
//   POST /api/pulse/v1/heartbeat   { pulseId, status, info? }
//   POST /api/pulse/v1/nodes       { node_code, sensor_type, name?, location_desc?, site_id? }
//   GET  /api/pulse/v1/status      (웹/운영용 — 펄스 무관)
//   POST /api/pulse/v1/ingest      { sensorCode, measurements:[{measuredAt, value, depthLabel?}], rawFile? }
// 인증: 헤더 X-API-Key: <키> (서버 PULSE_API_KEY 우선, AGENT_API_KEY 폴백)
//
// ⚠️ 현재 상태: 펄스는 아직 이 API 를 "호출하지 않습니다"(연결 미구현).
//   이 파일은 새 계약을 한곳에 못박아 두는 용도 + 실제 연동 시 그대로 쓰는 클라이언트.
//   레거시 별칭은 서버에서 404 로 사라졌으니 어디에도 옛 경로를 두지 않습니다.
// ─────────────────────────────────────────────────────────────────────────────

import { classifyChannel } from './classifyChannel.js';

/** 인증 헤더 이름 (값은 변경 없음 — 쓰던 키 그대로). */
export const AUTH_HEADER = 'X-API-Key';

/** 엔드포인트 경로 (base = 백엔드 URL + /api 기준 절대 경로). */
export const PATHS = {
  heartbeat: '/api/pulse/v1/heartbeat',
  nodes: '/api/pulse/v1/nodes',
  status: '/api/pulse/v1/status',
  ingest: '/api/pulse/v1/ingest',
};

/**
 * 백엔드가 허용하는 계측기 종류(sensor_type) — 이 코드만 nodes 등록에 보낼 수 있음.
 * label 은 화면 표시용 한글. (서버가 sensor_type 으로 센서 자동 생성)
 * ch 는 채널 코드 약어 — 등록 위저드에서 채널 이름을 자동 생성할 때 사용(예: WL-1, WL-2).
 * (약어는 channelCatalog 컨벤션과 맞춤: 지하수위계 WL · 지중경사계 GI 등)
 */
export const SENSOR_TYPES = [
  { code: 'water_level', label: '수위계', ch: 'WL' },
  { code: 'rainfall', label: '우량계', ch: 'RF' },
  { code: 'crack', label: '균열계', ch: 'CR' },
  { code: 'inclinometer', label: '지중경사계', ch: 'GI' },
  { code: 'settlement', label: '침하계', ch: 'SP' },
  { code: 'tilt', label: '경사계', ch: 'BT' },
  { code: 'strut', label: 'ST하중계(버팀보)', ch: 'LC' },
  { code: 'anchor', label: 'EA하중계(앵커)', ch: 'EA' },
  { code: 'vibration', label: '진동계', ch: 'VB' },
  { code: 'strain', label: '변형률계', ch: 'SG' },
  { code: 'wind', label: '풍향·풍속계', ch: 'WS' },
  { code: 'thermo_hygro', label: '기온·습도계', ch: 'TH' },
  { code: 'seismic', label: '지진계', ch: 'EQ' },
  { code: 'survey_3d', label: '광파타겟(3D)', ch: 'TG' },
  { code: 'groundwater', label: '지하수위계', ch: 'GW' },
  { code: 'pore_pressure', label: '간극수압계', ch: 'PWP' },
];

const LABEL_BY_CODE = Object.fromEntries(SENSOR_TYPES.map((t) => [t.code, t.label]));
const CH_BY_CODE = Object.fromEntries(SENSOR_TYPES.map((t) => [t.code, t.ch]));

/** sensor_type 코드 → 한글 라벨 (없으면 코드 그대로). */
export function sensorTypeLabel(code) {
  return LABEL_BY_CODE[code] || code || '';
}

/** sensor_type 코드 → 채널 코드 약어 (예: 'groundwater' → 'WL'). 미지정/미지의 코드는 ''. */
export function sensorChannelCode(code) {
  return CH_BY_CODE[code] || '';
}

// 파일명 한글 키워드 → sensor_type 코드 (구체적인 것부터). 못 찾으면 ''.
const GUESS_RULES = [
  ['지중경사', 'inclinometer'],
  ['간극수압', 'pore_pressure'],
  ['간극', 'pore_pressure'],
  ['지하수위', 'groundwater'],
  ['수위', 'water_level'],
  ['우량', 'rainfall'],
  ['강우', 'rainfall'],
  ['균열', 'crack'],
  ['침하', 'settlement'],
  ['경사', 'tilt'],
  ['축력', 'strut'],
  ['하중', 'strut'],
  ['버팀', 'strut'],
  ['변형률', 'strain'],
  ['응력', 'strain'],
  ['진동', 'vibration'],
  ['지진', 'seismic'],
  ['풍', 'wind'],
  ['기온', 'thermo_hygro'],
  ['습도', 'thermo_hygro'],
];

/** 파일명에서 계측기 종류 코드를 추론 (예: '지중경사계_(I-3).txt' → inclinometer). */
export function guessSensorType(fileName = '') {
  const name = String(fileName);
  for (const [kw, code] of GUESS_RULES) if (name.includes(kw)) return code;
  return '';
}

/** node_code 가 유효한지(빈값 아님) + sensor_type 이 허용 목록인지. */
export function isValidSensorType(code) {
  return SENSOR_TYPES.some((t) => t.code === code);
}

// 채널 약어(ch) → sensor_type 코드 역매핑 (예: 'WL' → 'water_level', 'CR' → 'crack').
const TYPE_BY_CH = Object.fromEntries(SENSOR_TYPES.map((t) => [t.ch, t.code]));

/**
 * 채널 코드 → sensor_type 추론 (채널별 종류 자동 채움). 접두로 분류 후 약어 역매핑.
 *   'WL-1' → 'water_level', 'CR-1' → 'crack', 'GI-A' → 'inclinometer', 'TX' → 'tilt'(BT).
 *   매칭 안 되면 '' (호출부에서 노드 대표 종류로 폴백).
 */
export function guessSensorTypeFromCode(code) {
  return TYPE_BY_CH[classifyChannel(code)] || '';
}

/**
 * 파일명/이름에서 sensor_type 추론 — 헤더 코드로 못 잡을 때의 폴백.
 *   '03_groundwater.txt' → 'groundwater', '지중경사계_(I-3-AB)' → 'inclinometer'.
 *   enum 코드(영문) 또는 라벨(한글)을 부분일치로 찾되, 더 긴(구체적) 키를 우선
 *   ('지하수위계'가 '수위계'보다 먼저). 매칭 없으면 '' (호출부에서 폴백).
 */
const NAME_TYPE_HINTS = SENSOR_TYPES
  .flatMap((t) => [{ key: t.code.toLowerCase(), code: t.code }, { key: t.label, code: t.code }])
  .filter((h) => h.key)
  .sort((a, b) => b.key.length - a.key.length);
export function guessSensorTypeFromName(name) {
  const s = String(name || '').toLowerCase();
  for (const h of NAME_TYPE_HINTS) {
    if (s.includes(h.key)) return h.code;
  }
  return '';
}

// sensor_type → 기본 단위 (확실한 것만; 없으면 ''=백엔드 카탈로그 폴백). 채널 단위 표시·전송용.
export const SENSOR_TYPE_UNIT = {
  water_level: 'm', groundwater: 'm', pore_pressure: 'kPa', rainfall: 'mm',
  crack: 'mm', inclinometer: 'mm', settlement: 'mm', tilt: '°',
  strut: 'kN', strain: 'με', wind: 'm/s', thermo_hygro: '℃',
};
/** sensor_type → 기본 단위 (모르면 ''). */
export function sensorTypeUnit(code) {
  return SENSOR_TYPE_UNIT[code] || '';
}

// ── 요청 본문 빌더 (경로만 바뀌고 본문은 동일) ───────────────────────────────
export function heartbeatBody({ pulseId, status, info }) {
  return info === undefined ? { pulseId, status } : { pulseId, status, info };
}

/**
 * 노드 등록 본문. 현장-블라인드: site_id 는 보내지 않음(서버 선택 필드).
 * 가칭 입력은 폐지 → name 에는 노드 ID(node_code)를 그대로 전송한다.
 *
 * channels: 파일 열(채널) 목록 [{ ch, code }]. **백엔드가 열마다 센서를 생성**하도록 전송.
 *   (현재 백엔드는 이 필드를 무시하고 sensor_type 템플릿대로 생성 — 백엔드 구현 후 채널별 생성)
 */
export function nodeRegisterBody({ nodeId, sensorType, name, locationDesc, channels, sensorCount, sensorSync, unit, intervalMin, monitoringFrom }) {
  const b = { node_code: nodeId, sensor_type: sensorType };
  b.name = (name && String(name).trim()) || nodeId; // 가칭 없으면 노드 ID 를 name 으로
  if (locationDesc) b.location_desc = locationDesc;
  // 수신 주기(분): 백엔드 저장 키는 report_interval_min (2026-06-01 확정). 등록 시 함께 저장.
  // 주기만 바꿀 땐 PATCH(intervalPatch*)를 쓰는 게 안전(센서 동기화 안 딸려옴).
  if (intervalMin != null) b.report_interval_min = Number(intervalMin);
  // 운영 시작 기준일(monitoring_from, ISO/KST): 미전송=유지, null=해제. undefined 면 키 생략.
  if (monitoringFrom !== undefined) b.monitoring_from = monitoringFrom;
  // 단위(선택): 안 보내면 백엔드 카탈로그 폴백. 우선순위 채널 unit > 노드 unit > 카탈로그.
  if (unit) b.unit = String(unit);
  const chs = Array.isArray(channels)
    ? channels.map((c, i) => {
        const ch = { ch: c.ch ?? i + 1, code: String(c.code ?? c) };
        // ★채널별 계측 종류(2026-06-05): 한 노드에 종류 혼재 허용. 미전송 시 노드 sensor_type 폴백.
        if (c && c.sensorType) ch.sensor_type = String(c.sensorType);
        if (c && c.unit) ch.unit = String(c.unit); // 종류가 다르면 단위도 보통 다름
        if (c && c.validMin !== undefined) ch.valid_min = c.validMin;
        if (c && c.validMax !== undefined) ch.valid_max = c.validMax;
        return ch;
      })
    : [];
  if (chs.length) b.channels = chs;
  // 센서 개수도 명시 전송: 시리즈=1, 비시리즈=열 개수. (백엔드가 이 수만큼 센서 생성하도록)
  const count = sensorCount != null ? sensorCount : (chs.length || undefined);
  if (count != null) b.sensor_count = count;
  // 채널 동기화 정책(백엔드 확정 2026-05-31): 생략/'additive'=빠진 센서 유지, 'replace'=channels 에 없는 기존 센서 정리.
  // replace 는 channels 가 있을 때만 백엔드가 동작(빈 channels=대량삭제 방지 안전장치). 펄스는 파일 패턴으로
  // 센서 집합을 단언하므로 channels 와 함께 'replace' 를 보내 스스로 정합을 맞춘다.
  if (sensorSync && chs.length) b.sensor_sync = sensorSync;
  return b;
}

/**
 * ingest 용 센서 코드 = `{node_code}-{channel code}` (백엔드 확정 2026-05-31).
 * register 에는 bare code(WL-1)를 보내고, 백엔드가 `{node_code}-{code}` 로 센서를 만든다.
 * 따라서 ingest 의 sensorCode 도 동일하게 prefix 해야 매칭된다.
 * 이미 `{nodeId}-` 로 시작하면 중복 prefix 하지 않는다(GET 으로 받은 sensor_code 그대로 써도 안전).
 */
export function ingestSensorCode(nodeId, channelCode) {
  const node = String(nodeId ?? '').trim();
  const code = String(channelCode ?? '').trim();
  if (!node) return code;
  if (!code) return node;
  return code.startsWith(`${node}-`) ? code : `${node}-${code}`;
}

export function ingestBody({ sensorCode, nodeId, channelCode, measurements, rawFile }) {
  // sensorCode 직접 주면 그대로, 아니면 nodeId+channelCode 로 prefix 조합.
  const code = sensorCode != null ? sensorCode : ingestSensorCode(nodeId, channelCode);
  const b = { sensorCode: code, measurements };
  if (rawFile) b.rawFile = rawFile;
  return b;
}

/**
 * 센서 코드(`{node_code}-{code}`)에서 bare 채널 코드만 떼어냄(ingestSensorCode 의 역).
 * 등록/범위 본문의 channels[].code 는 bare 여야 함(예: '80053-WL-1' → 'WL-1').
 * 이미 bare(접두 없음)면 그대로.
 */
export function bareSensorCode(nodeId, sensorCode) {
  const node = String(nodeId ?? '').trim();
  const code = String(sensorCode ?? '').trim();
  if (node && code.startsWith(`${node}-`)) return code.slice(node.length + 1);
  return code;
}

/**
 * 센서 정상범위(raw 글리치 컷) 갱신 본문 — 별도 API 가 아니라 노드 등록(POST /nodes)을
 * 같은 node_code 로 다시 보내 기존 센서의 valid_min/valid_max 를 갱신(sticky, 센서 백엔드 확정).
 *   목적: 정상 센서가 가끔 뱉는 "튄 값(raw 0 등)" 1개를 백엔드가 자동 invalid 처리(평균·상태·알람 제외).
 *   channels[].code = bare 채널 코드, valid_min/valid_max = **raw 기준**(number 또는 null=해제).
 *   undefined 인 경계는 키 생략 → 백엔드 기존값 유지. (number/null 은 명시 전송)
 *   ⚠️ sensor_sync 는 넣지 않는다(기본 additive). name/sensor_count 도 안 보냄(범위만 최소 갱신).
 *   바꿀 채널만 channels 에 넣어도 나머지 센서엔 영향 없음. spike 는 백엔드가 무시하므로 안 보냄.
 *   채널별 sensor_type/unit 도 함께 실어 분류를 유지(있을 때만; 노드 1개에 종류 혼재 지원).
 */
export function nodeRangeBody({ nodeId, sensorType, channels }) {
  const node = String(nodeId ?? '').trim();
  const chs = (Array.isArray(channels) ? channels : []).map((c) => {
    const out = { code: bareSensorCode(node, c.code ?? c) };
    if (c && c.sensorType) out.sensor_type = String(c.sensorType);
    if (c && c.unit) out.unit = String(c.unit);
    if (c && c.validMin !== undefined) out.valid_min = c.validMin;
    if (c && c.validMax !== undefined) out.valid_max = c.validMax;
    return out;
  });
  return { node_code: node, sensor_type: sensorType, channels: chs };
}

/**
 * 운영 시작 기준일(monitoring_from) 갱신 본문 — 별도 API 아님, 노드 등록(POST /nodes)을 같은
 * node_code 로 재전송해 노드 단위 monitoring_from 만 갱신(센서/채널 무영향).
 *   monitoringFrom = ISO 문자열(KST 권장) 또는 null(해제). 채널은 안 보냄(monitoring_from 만 최소 갱신).
 *   ⚠️ sensor_sync/name/sensor_count 안 보냄(다른 설정 무영향, additive 기본).
 */
export function nodeMonitoringBody({ nodeId, sensorType, monitoringFrom }) {
  return {
    node_code: String(nodeId ?? '').trim(),
    sensor_type: sensorType,
    monitoring_from: monitoringFrom == null ? null : monitoringFrom,
  };
}

/** 노드 삭제 경로 — DELETE /api/pulse/v1/nodes/{node_code} (코드 URL 인코딩). */
export function nodeDeletePath(nodeCode) {
  return `${PATHS.nodes}/${encodeURIComponent(String(nodeCode || '').trim())}`;
}

/** 노드 단건 경로 — PATCH(주기 변경)/GET 단건에 사용. 삭제 경로와 동일 URL. */
export function nodePath(nodeCode) {
  return nodeDeletePath(nodeCode);
}

/**
 * 주기 변경 PATCH 본문 — PATCH /api/pulse/v1/nodes/{node_code} (2026-06-01 신설).
 *   숫자(≥1)=설정/변경, null=해제. 센서/채널은 안 건드림.
 *   키는 snake_case report_interval_min.
 */
export function intervalPatchBody(intervalMin) {
  return { report_interval_min: intervalMin == null ? null : Number(intervalMin) };
}

/**
 * 노드 목록 조회 응답(노드 1건) → 펄스 내부 모델로 정규화.
 *
 * ⚠️ 가정한 계약 (백엔드 확정 시 이 매퍼만 고치면 됨):
 *   GET /api/pulse/v1/nodes → [{ node_code, sensor_type, name?, interval_min?,
 *                                last_seen?, channels?: (string | {code})[] }]
 *   (배열이 아니라 { nodes:[...] } / { data:[...] } 로 와도 호출부에서 흡수)
 * snake_case(등록 본문과 동일 컨벤션)를 우선하되 camelCase 변형도 허용.
 */
export function normalizeBackendNode(raw = {}) {
  const nodeId = raw.node_code ?? raw.nodeId ?? raw.id ?? '';
  const sensorType = raw.sensor_type ?? raw.sensorType ?? '';
  const name = raw.name ?? '';
  const intervalMin = raw.report_interval_min ?? raw.reportIntervalMin ?? raw.interval_min ?? raw.intervalMin ?? null;

  const lastRaw = raw.last_seen ?? raw.lastSeen ?? raw.last_data_at ?? raw.lastDataAt ?? raw.last_rx ?? null;
  let lastRx = null;
  if (lastRaw != null) {
    const n = typeof lastRaw === 'number' ? lastRaw : Date.parse(lastRaw);
    lastRx = Number.isFinite(n) ? n : null;
  }

  const rawCh = raw.channels ?? raw.chans ?? raw.sensors ?? [];
  const channels = (Array.isArray(rawCh) ? rawCh : []).map((c, i) => {
    // 백엔드 센서 식별키는 sensor_code (예: YH-80053-PWP) — ingest 의 sensorCode 로 쓰임.
    const code = typeof c === 'string'
      ? c
      : (c?.code ?? c?.sensor_code ?? c?.channel_code ?? c?.channelCode ?? c?.sensorCode ?? c?.name ?? `CH${i + 1}`);
    // 생명주기 상태(active/inactive) — 드로어 토글 표시·전송에 사용. 측정상태(offline 등)와 별개.
    // 레거시 dead/disabled 도 흡수(lifecycleLabel 이 '비활성'으로 표기).
    const lifecycle = (typeof c === 'object' && (c?.lifecycle_state ?? c?.lifecycleState)) || 'active';
    // 채널별 계측 종류/단위(노드 1개에 종류 혼재). 없으면 빈값 → 노드 대표 종류로 표시 폴백.
    const sensorType = (typeof c === 'object' && (c?.sensor_type ?? c?.sensorType)) || '';
    const unit = (typeof c === 'object' && c?.unit) || '';
    return { ch: i + 1, code: String(code), lifecycle, sensorType, unit };
  });

  // 배치 현장(읽기 전용 표시용). 펄스는 현장을 관리하지 않지만, 백엔드가 배치한 현장을 보여주기만 함.
  // 미배치면 null. 전송 페이로드엔 절대 안 들어감(현장-블라인드 유지).
  const siteName = raw.site_name ?? raw.siteName ?? null;
  const siteCode = raw.site_code ?? raw.siteCode ?? null;

  // 운영 시작 기준일(monitoring_from) — 이 시점 이전은 분석/고장의심/기본차트에서 제외(raw 는 보존). 미설정=null.
  const monitoringFrom = raw.monitoring_from ?? raw.monitoringFrom ?? null;

  return { nodeId: String(nodeId), sensorType, name, intervalMin, lastRx, channels, siteName, siteCode, monitoringFrom };
}

/** 센서 생명주기 상태 경로 — PATCH /api/pulse/v1/sensors/{sensor_code} (코드 URL 인코딩). */
export function sensorStatusPath(sensorCode) {
  return `/api/pulse/v1/sensors/${encodeURIComponent(String(sensorCode || '').trim())}`;
}

/**
 * 센서 생명주기 — 정상 ↔ 비활성 2단(2026-06-05 백엔드 확정: `inactive` 하나로 통합).
 *   off 상태의 전송 값은 **`inactive`**(sticky·평균/offline 제외), 화면 라벨은 '비활성'.
 *   레거시 `dead`/`disabled` 는 더 이상 보내지 않지만, GET 으로 오면 '비활성'으로 표기해 흡수.
 *   (측정상태 offline 과 별개 — 펄스가 명시 보고)
 */
export const SENSOR_LIFECYCLE = [
  { value: 'active', label: '정상' },
  { value: 'inactive', label: '비활성' },
];
const LIFECYCLE_LABEL = { active: '정상', inactive: '비활성', dead: '비활성', disabled: '비활성' };
export function lifecycleLabel(v) {
  return LIFECYCLE_LABEL[v] || '정상';
}

/**
 * 노드 삭제 결과(error 코드) → 사용자/관리자 안내 문구.
 * 규칙은 백엔드가 강제: 펄스는 호출 후 응답에 따라 안내만 함.
 *   rejected(400)  — 현장 배치됨(웹에서 회수 먼저) 또는 측정 데이터 있음(데이터 보호)
 *   not_found(404) — 백엔드에 없는 node_code
 */
export const DELETE_ERROR_MESSAGE = {
  rejected: '삭제 거부 — 현장에 배치돼 있거나 측정 데이터가 있습니다. 웹에서 먼저 회수(unassign)하세요.',
  not_found: '백엔드에 없는 노드입니다 (404).',
  unauthorized: '인증 실패 (401) — API 키를 확인하세요.',
  unconfigured: '백엔드가 설정되지 않았습니다 — 설정에서 연결하세요.',
  network: '백엔드에 연결하지 못했습니다.',
  no_node_code: '노드 코드가 비어 있습니다.',
};

const trimBase = (baseUrl) => String(baseUrl || '').replace(/\/+$/, '');

/**
 * 백엔드 클라이언트 생성 (실제 연동 시 사용). 현재는 호출하는 곳이 없습니다.
 * @param {{ baseUrl: string, apiKey: string, fetchImpl?: typeof fetch }} cfg
 */
export function createBackendClient({ baseUrl, apiKey, fetchImpl } = {}) {
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const url = (path) => trimBase(baseUrl) + path;
  const headers = { 'Content-Type': 'application/json', [AUTH_HEADER]: apiKey };
  const post = async (path, body) => {
    if (!f) throw new Error('fetch 사용 불가 환경');
    const res = await f(url(path), { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${path} 실패: ${res.status}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  };
  const del = async (path) => {
    if (!f) throw new Error('fetch 사용 불가 환경');
    const res = await f(url(path), { method: 'DELETE', headers });
    if (!res.ok) throw new Error(`${path} 실패: ${res.status}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  };
  const get = async (path) => {
    if (!f) throw new Error('fetch 사용 불가 환경');
    const res = await f(url(path), { method: 'GET', headers });
    if (!res.ok) throw new Error(`${path} 실패: ${res.status}`);
    return res.json().catch(() => null);
  };
  const patch = async (path, body) => {
    if (!f) throw new Error('fetch 사용 불가 환경');
    const res = await f(url(path), { method: 'PATCH', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${path} 실패: ${res.status}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  };
  return {
    heartbeat: (p) => post(PATHS.heartbeat, heartbeatBody(p)),
    registerNode: (p) => post(PATHS.nodes, nodeRegisterBody(p)),
    deleteNode: (nodeCode) => del(nodeDeletePath(nodeCode)), // DELETE /nodes/{code}
    listNodes: () => get(PATHS.nodes),                        // GET /nodes (목록)
    setSensorStatus: (sensorCode, status) => patch(sensorStatusPath(sensorCode), { status }), // PATCH 생명주기
    ingest: (p) => post(PATHS.ingest, ingestBody(p)),
    statusUrl: () => url(PATHS.status), // GET — 펄스에선 보통 호출 안 함
  };
}
