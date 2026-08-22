// ─────────────────────────────────────────────────────────────────────────────
// series — 등간격 "프로파일" 열 감지 (지중경사계 깊이열 등)
//
// 지중경사계처럼 헤더가 0.0M, 0.5M, … 40.0M 로 등간격 + 단위 접미사를 가지면
// 81개 독립 채널이 아니라 "깊이 프로파일 1개"로 묶어 표시합니다.
// (백엔드 전송은 여전히 점(point)별로 — 묶음은 표시·등록 UX 용)
//
// 주의: "1","2","3" 같은 순수 채널 번호(단위 접미사 없음)는 묶지 않습니다.
//   → 접미사(M, m, cm 등 알파벳)가 있을 때만 시리즈로 인정.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_POINTS = 5; // 이보다 적으면 시리즈로 보지 않음(값+온도 2열 등 오인 방지)

/** '12.5M' → { pos: 12.5, suffix: 'M' } / 파싱 실패 시 null */
export function parsePoint(code) {
  const m = String(code).trim().match(/^(-?\d+(?:\.\d+)?)\s*([A-Za-z]+)$/);
  if (!m) return null;
  return { pos: parseFloat(m[1]), suffix: m[2] };
}

/**
 * 채널 코드 배열이 등간격 + 동일 단위접미사 시리즈인지 감지.
 * @param {string[]} codes
 * @returns {null | {kind:'series', axisUnit:string, start:number, end:number,
 *                   step:number, count:number, points:{code:string,pos:number}[]}}
 */
export function detectSeries(codes) {
  if (!Array.isArray(codes) || codes.length < MIN_POINTS) return null;
  const pts = codes.map(parsePoint);
  if (pts.some((p) => !p)) return null;
  const suffix = pts[0].suffix;
  if (!suffix) return null; // 단위 접미사 없으면(순수 번호) 묶지 않음
  if (!pts.every((p) => p.suffix === suffix)) return null;

  const positions = pts.map((p) => p.pos);
  const step = positions[1] - positions[0];
  if (!(Math.abs(step) > 0)) return null;
  const eps = Math.abs(step) * 0.05 || 1e-6;
  for (let i = 1; i < positions.length; i++) {
    if (Math.abs(positions[i] - positions[i - 1] - step) > eps) return null;
  }

  return {
    kind: 'series',
    axisUnit: suffix.toLowerCase() === 'm' ? 'm' : suffix.toLowerCase(),
    start: positions[0],
    end: positions[positions.length - 1],
    step,
    count: positions.length,
    points: codes.map((code, i) => ({ code, pos: positions[i] })),
  };
}

/** 시리즈 요약 문구: "0~40m · 0.5m 간격 · 81점" */
export function seriesSummary(s) {
  if (!s) return '';
  const u = s.axisUnit;
  return `${s.start}~${s.end}${u} · ${Math.abs(s.step)}${u} 간격 · ${s.count}점`;
}
