// ─────────────────────────────────────────────────────────────────────────────
// ViewToggle — 뷰 전환 (컴팩트 · 테이블 · 카드)
// 노드 모니터 모니터링 탭에서 사용. value: 'table'|'card'|'compact'
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Table2, LayoutGrid, Rows3 } from 'lucide-react';

const VIEWS = [
  { id: 'table', icon: Table2, label: '테이블' },
  { id: 'card', icon: LayoutGrid, label: '카드' },
  { id: 'compact', icon: Rows3, label: '컴팩트' },
];

export default function ViewToggle({ value = 'table', onChange }) {
  return (
    <div className="inline-flex items-center p-0.5 gap-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
      {VIEWS.map((v) => {
        const Icon = v.icon;
        const active = value === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onChange?.(v.id)}
            title={v.label}
            className={`inline-flex items-center gap-1.5 h-7 px-2 rounded text-[12px] font-medium transition-colors duration-150 ${
              active
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}
