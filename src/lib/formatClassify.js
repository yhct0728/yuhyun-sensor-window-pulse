// ─────────────────────────────────────────────────────────────────────────────
// formatClassify — 로거 .txt 헤더/샘플행을 보고 포맷 패턴 + 유효성을 판정
//
// 통상 로거 출력은 4가지로 귀결: 번호형(1,2,3) / 이름형(GI-A) / 깊이형(0.0M…) / 값+온도형.
// 여기선 "표로서 멀쩡한가(유효성)"와 "어떤 패턴인가(힌트)"를 함께 판정한다.
//
// 등록 게이트(엄격): status === 'ok' 인 파일만 노드로 승격 허용.
//   ok    🟢 표 멀쩡 + 패턴 인식됨
//   warn  🟡 파싱은 되나 비정형(제목 일부 누락·열 수 불일치 등) → 차단
//   error 🔴 표가 아님(시각 열 없음·값 열 없음 등) → 차단
// ─────────────────────────────────────────────────────────────────────────────
import { detectSeries } from './series.js';

const TEMP_RE = /(temp|온도|_t$|\(℃\)|\(°c\))/i;

function isInt(s) {
  return /^-?\d+$/.test(String(s).trim());
}

/** 날짜/시각처럼 보이면 true. 흔한 형식(-, /, .)을 넓게 인정. */
export function isDateLike(s) {
  if (s == null) return false;
  const v = String(s).trim();
  if (!v || isInt(v)) return false; // 순수 정수는 시각으로 보지 않음
  if (/\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(v)) return true; // 2026-05-01 / 2026/05/01 / 2026.05.01
  if (/\d{1,2}:\d{2}/.test(v)) return true;                    // HH:mm 포함
  const t = Date.parse(v.replace(' ', 'T'));
  return !isNaN(t) || !isNaN(Date.parse(v));
}

const PATTERN_LABEL = {
  numbered: '번호형',
  named: '이름형',
  depth: '깊이형',
  valuetemp: '값+온도형',
};

const ok = (pattern, valueCount) => ({
  status: 'ok',
  pattern,
  patternLabel: PATTERN_LABEL[pattern],
  reason: '',
  valueCount,
});
const warn = (reason) => ({ status: 'warn', pattern: null, patternLabel: '비정형', reason });
const error = (reason) => ({ status: 'error', pattern: null, patternLabel: '형식 오류', reason });

/**
 * @param {string[]|null} header   첫 줄(제목)을 구분자로 나눈 배열
 * @param {string[]|null} sampleRow 첫 데이터 줄을 나눈 배열
 * @returns {{status:'ok'|'warn'|'error', pattern:string|null, patternLabel:string, reason:string, valueCount?:number}}
 */
export function classifyFormat(header, sampleRow) {
  const cols = Math.max(header?.length || 0, sampleRow?.length || 0);
  // 진짜 막아야 하는 것만 error: 표가 아님(열 1개 이하 = 값 열 없음)
  if (cols < 2) return error('표 형식이 아닙니다 (시각 + 값 열이 필요)');

  const valueCount = cols - 1;
  const hasSample = !!(sampleRow && sampleRow.length);
  // 데이터가 있는데 첫 칸이 시각이 아니다 → 의심(warn). 데이터가 아직 없으면 패턴으로만 판단.
  const tsBad = hasSample && !isDateLike(sampleRow[0]);

  // 헤더 유무: 헤더 첫 셀이 날짜가 아니면(예: 'DateTime') 헤더로 간주
  const hasHeader = header && header.length >= 2 && !isDateLike(header[0]);
  if (!hasHeader) {
    if (!hasSample) return warn('제목·데이터가 없어 형식을 확인할 수 없습니다');
    return tsBad ? warn('첫 열이 시각(DateTime)이 아닐 수 있습니다') : ok('numbered', valueCount);
  }

  // 헤더와 데이터의 열 수 불일치 → 비정형
  if (hasSample && header.length !== sampleRow.length) {
    return warn('헤더와 데이터의 열 개수가 다릅니다');
  }

  const labels = header.slice(1).map((s) => String(s ?? '').trim());
  if (labels.some((l) => l === '')) return warn('일부 열에 제목이 없습니다');

  let pattern = null;
  if (detectSeries(labels)) pattern = 'depth';
  else if (labels.some((l) => TEMP_RE.test(l))) pattern = 'valuetemp';
  else if (labels.every(isInt)) pattern = 'numbered';
  else if (labels.every((l) => l.length > 0)) pattern = 'named';

  if (!pattern) return warn('패턴을 인식하지 못했습니다');
  if (tsBad) return warn('첫 열이 시각(DateTime)이 아닐 수 있습니다');
  return ok(pattern, valueCount); // 헤더만 있고 데이터 전이어도 패턴 명확하면 정상
}

/** 상태별 표시 색(틴트 클래스). */
export const FORMAT_TINT = {
  ok: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  error: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
};
