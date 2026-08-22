// ─────────────────────────────────────────────────────────────────────────────
// EmptyState — 범용 빈 상태 (아이콘 + 제목 + 설명 + 선택 액션)
// 제로 디폴트가 기본인 v2 의 모든 화면에서 사용합니다.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

export default function EmptyState({ icon: Icon, title, desc, action, dashed = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-16 rounded-lg ${
        dashed
          ? 'border border-dashed border-zinc-300 dark:border-zinc-700'
          : ''
      }`}
    >
      {Icon && (
        <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 mb-4">
          <Icon size={22} />
        </span>
      )}
      <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-100">
        {title}
      </h3>
      {desc && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400 max-w-sm whitespace-pre-line">
          {desc}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
