// ─────────────────────────────────────────────────────────────────────────────
// reception — 수신 상태 + 전송 상태의 판정·표현 (현장-블라인드)
//
// Pulse 는 안전 판정(정상/의심/오류)을 하지 않습니다. 오직:
//   - 수신(Reception): 마지막 수신 시각이 주기 대비 얼마나 늦었는가
//       live    수신중   age ≤ 1.5 × interval
//       delayed 지연     age ≤ 3   × interval
//       lost    끊김     그 외 / 미수신
//   - 전송(Transmit): 백엔드 인제스트로의 전송 큐 상태 (sent/queued/retry/failed)
//
// 색 토큰: 수신중/전송완료 = 에메랄드(액센트), 지연/재전송 = 앰버, 끊김/실패 = 레드.
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {import('./types.js').Reception} Reception */
/** @typedef {import('./types.js').Transmit} Transmit */

/**
 * 마지막 수신 시각과 주기로 수신 상태를 판정.
 * @param {number|null} lastRxMs 마지막 수신 epoch ms (없으면 'lost')
 * @param {number} intervalMin   수신 주기(분)
 * @param {number} [nowMs]       기준 현재 시각 (테스트 주입용)
 * @returns {Reception}
 */
export function receptionOf(lastRxMs, intervalMin, nowMs = Date.now()) {
  if (lastRxMs == null) return 'lost';
  const ageMin = (nowMs - lastRxMs) / 60000;
  const iv = intervalMin > 0 ? intervalMin : 60;
  if (ageMin <= iv * 1.5) return 'live';
  if (ageMin <= iv * 3) return 'delayed';
  return 'lost';
}

// 수신 상태 메타 — 라벨 / 색 클래스 / ping 여부
export const RX_META = {
  live: {
    label: '수신중',
    tone: 'emerald',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    pill:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 ' +
      'dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
    ping: true,
  },
  delayed: {
    label: '지연',
    tone: 'amber',
    dot: 'bg-amber-500 dark:bg-amber-400',
    pill:
      'bg-amber-50 text-amber-700 ring-amber-200 ' +
      'dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
    ping: false,
  },
  lost: {
    label: '끊김',
    tone: 'red',
    dot: 'bg-red-500 dark:bg-red-400',
    pill:
      'bg-red-50 text-red-700 ring-red-200 ' +
      'dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
    ping: false,
  },
};

// 전송 상태 메타 — 라벨(카운트 N 주입형) / 색 클래스
export const TX_META = {
  sent: {
    label: () => '전송 완료',
    tone: 'emerald',
    pill:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 ' +
      'dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  },
  queued: {
    label: (n) => (n ? `버퍼 ${n}` : '버퍼 대기'),
    tone: 'zinc',
    pill:
      'bg-zinc-100 text-zinc-600 ring-zinc-200 ' +
      'dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  },
  retry: {
    label: (n) => (n ? `재전송 ${n}` : '재전송'),
    tone: 'amber',
    pill:
      'bg-amber-50 text-amber-700 ring-amber-200 ' +
      'dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  },
  failed: {
    label: (n) => (n ? `실패 ${n}` : '실패'),
    tone: 'red',
    pill:
      'bg-red-50 text-red-700 ring-red-200 ' +
      'dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
  },
};

// 정렬 우선순위 (작을수록 위/문제 우선)
export const RX_RANK = { lost: 0, delayed: 1, live: 2 };
export const TX_RANK = { failed: 0, retry: 1, queued: 2, sent: 3 };
