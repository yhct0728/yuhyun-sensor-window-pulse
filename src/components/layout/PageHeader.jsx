// ─────────────────────────────────────────────────────────────────────────────
// PageHeader — 각 페이지 상단 sticky 헤더
//   제목 + 부제 (좌) / 액션 슬롯 + 다크모드 토글 (우)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Sun, Moon } from 'lucide-react';

export default function PageHeader({ title, subtitle, actions, dark, setDark }) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-4 px-6 h-16">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <button
            onClick={() => setDark?.(!dark)}
            title={dark ? '라이트 모드' : '다크 모드'}
            className="inline-grid place-items-center w-8 h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors duration-150"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </header>
  );
}
