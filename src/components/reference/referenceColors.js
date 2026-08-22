// ─────────────────────────────────────────────────────────────────────────────
// 계측기 도감 색 매핑 — 원본 reference.module.css 의 oklch 카테고리/타입/출처 색을
// Pulse(Tailwind v3) 색군으로 1:1 매핑 (§6 폴백: 상대 oklch 대신 풀어 정의).
//   water 파랑 / construction 코랄(rose) / slope 앰버 / weather teal / facility 보라(violet)
// 톤: 채움 ~12%, 보더 ~28% 느낌 → bg-50/ring-200 (다크 950·40/300/900) 패턴.
// ─────────────────────────────────────────────────────────────────────────────

// 카테고리 → 틴트 핀/아이콘 배경
export const CAT_TINT = {
  water:        'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
  construction: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
  slope:        'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  weather:      'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900',
  facility:     'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900',
};

// 카테고리 → 솔리드 점(dot)
export const CAT_DOT = {
  water:        'bg-sky-500',
  construction: 'bg-rose-500',
  slope:        'bg-amber-500',
  weather:      'bg-teal-500',
  facility:     'bg-violet-500',
};

// 공식 타입 → 틴트 뱃지
export const TYPE_TINT = {
  'VW Linear': 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
  'VW Poly':   'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:ring-fuchsia-900',
  '4~20mA':    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  'Voltage':   'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  'Bridge':    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
};

// 계수 출처 → 틴트 뱃지 (원본 CSS 그대로: cal·install 둘 다 red 계열, logger green, result 무채색)
export const SRC_TINT = {
  '캘리브레이션 시트': 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
  '설치 시 현장 입력': 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
  '로거 실시간 수신':  'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  '계산 결과':         'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
};
