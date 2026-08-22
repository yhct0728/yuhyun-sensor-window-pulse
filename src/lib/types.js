// ─────────────────────────────────────────────────────────────────────────────
// Pulse v2 — 데이터 모델 (JSDoc typedef)
//
// 현장-블라인드 원칙: 어떤 타입에도 현장(site) 필드가 없습니다.
// Pulse 는 노드(장비 ID) 단위로만 수신·전송하며, 안전 판정(정상/의심/오류)은
// 하지 않습니다. 다루는 상태는 수신(reception) + 전송(transmit) 뿐입니다.
//
// 모든 런타임 컬렉션은 제로 디폴트(빈 배열)로 시작합니다 — lib/store.jsx 참조.
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {'live'|'delayed'|'lost'} Reception 수신중 / 지연 / 끊김 */
/** @typedef {'sent'|'queued'|'retry'|'failed'} Transmit 전송완료 / 버퍼대기 / 재전송 / 실패 */

/**
 * @typedef {Object} Channel
 * @property {number} ch        채널(열) 번호 1..N
 * @property {string} code      채널 코드 (예: 'GI-A', 'AX', 'TMP')
 * @property {string} label     사람이 읽는 라벨 (예: 'A축 변위')
 * @property {string} unit      단위 (예: 'mm', 'kN', '℃')
 * @property {number|null} value 최근 값 (미수신이면 null)
 */

/**
 * @typedef {Object} Node
 * @property {string} id         노드(장비) ID — 불변 식별자 (예: 'YH-0007'). 현장 무관.
 * @property {string} model      로거 모델 (예: 'YH-DL16')
 * @property {string} type       타입 (예: '데이터로거')
 * @property {string} proto      통신 프로토콜 (예: 'Modbus TCP', 'RS-485')
 * @property {Reception} reception
 * @property {number|null} lastRx 마지막 수신 시각 (epoch ms, 미수신이면 null)
 * @property {number} intervalMin 수신/샘플링 주기(분)
 * @property {Transmit} transmit
 * @property {number} buffer     전송 대기 버퍼 행 수
 * @property {number} retry      재전송 횟수
 * @property {number} rows24h    최근 24시간 수신 행 수
 * @property {Channel[]} chans
 * @property {number[]} trend    대표 채널 스파크라인용 (없으면 [])
 * @property {(string|number)[][]} raw 최근 raw 로우데이터 [ [ts, v1, v2, ...], ... ]
 * @property {string} [sourceFile] 등록 출처 .txt 전체 경로
 */

/**
 * @typedef {Object} DetectedFile 워치 폴더에서 감지된 로거 파일
 * @property {string} name       파일명 ('node-7.txt')
 * @property {string} fullPath   전체 경로
 * @property {string} nodeId     파일명에서 추론한 노드 ID ('YH-0007')
 * @property {string} modified   갱신 시각 (ISO 문자열)
 * @property {number} rows       행 수
 * @property {boolean} registered 노드로 등록됐는지
 */

/**
 * @typedef {Object} ChannelType 채널(센서) 타입 카탈로그. 제로 디폴트 = 빈 카탈로그.
 * @property {string} code   'GI'
 * @property {string} name   '지중경사계'
 * @property {string} unit   'mm'
 * @property {string} range  '0~20 mm'
 * @property {string} group  '변위' | '하중' | '수리' | '환경' | '보정' (자유)
 * @property {string} [desc] 도감 설명 (선택)
 */

/**
 * @typedef {Object} Ingest 백엔드 인제스트 연결 상태
 * @property {string} endpoint
 * @property {'connected'|'disconnected'} status
 * @property {string} latency  '—' | '42ms'
 * @property {string} lastAck  '—' | 상대시간
 */

export {};
