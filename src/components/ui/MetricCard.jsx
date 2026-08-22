// ─────────────────────────────────────────────────────────────────────────────
// MetricCard — 상단 요약 메트릭 카드 (라벨 + 큰 숫자 + 아이콘)
// tone: 'default' | 'emerald' | 'amber' | 'red' | 'zinc'
// 제로 디폴트에서는 값이 0 으로 표시됩니다.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

const TONE = {
  default: 'text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800',
  emerald:
    'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-inset ring-emerald-200/60 dark:ring-emerald-900',
  amber:
    'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 ring-1 ring-inset ring-amber-200/60 dark:ring-amber-900',
  red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 ring-1 ring-inset ring-red-200/60 dark:ring-red-900',
  zinc: 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800',
};

export default function MetricCard({ label, value, icon: Icon, tone = 'default', hint }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      {Icon && (
        <span className={`inline-grid place-items-center w-9 h-9 rounded-md shrink-0 ${TONE[tone] || TONE.default}`}>
          <Icon size={17} />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
          {label}
        </div>
        <div className="text-[22px] leading-tight font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
          {value}
        </div>
        {hint && <div className="text-[11px] text-zinc-400 truncate">{hint}</div>}
      </div>
    </div>
  );
}
