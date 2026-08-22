// ─────────────────────────────────────────────────────────────────────────────
// format — 표시용 포매터 (바이트 / 상대시간 / 숫자)
// ─────────────────────────────────────────────────────────────────────────────

/** 1536 → '1.5 KB' */
export function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/**
 * 상대 시간 ('3분 전'). 입력은 epoch ms 또는 ISO 문자열.
 * @param {number|string|null} when
 * @param {number} [nowMs]
 */
export function timeAgo(when, nowMs = Date.now()) {
  if (when == null) return '—';
  const t = typeof when === 'number' ? when : Date.parse(when);
  if (isNaN(t)) return '—';
  const sec = Math.max(0, Math.round((nowMs - t) / 1000));
  if (sec < 60) return '방금';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.round(hr / 24);
  return `${day}일 전`;
}

/** 주기(분) → 사람이 읽는 라벨. 60 → '1시간', 1440 → '1일' */
export function intervalLabel(min) {
  if (min == null) return '—';
  if (min < 60) return `${min}분`;
  if (min < 1440) {
    const h = min / 60;
    return Number.isInteger(h) ? `${h}시간` : `${h.toFixed(1)}시간`;
  }
  const d = min / 1440;
  return Number.isInteger(d) ? `${d}일` : `${d.toFixed(1)}일`;
}

/** 숫자 포맷 (tabular). null → '—' */
export function fmtNum(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}
