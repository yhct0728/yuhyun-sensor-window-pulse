// ─────────────────────────────────────────────────────────────────────────────
// Toggle — 켜짐/꺼짐 스위치 (Linear/Vercel 스타일)
// 켜짐: emerald 트랙, 꺼짐: zinc 트랙. 썸은 흰색.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

export default function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15 dark:focus-visible:ring-zinc-100/20 disabled:opacity-40 disabled:pointer-events-none ${
        checked
          ? 'bg-emerald-500 dark:bg-emerald-500'
          : 'bg-zinc-200 dark:bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
