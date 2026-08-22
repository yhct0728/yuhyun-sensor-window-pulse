// ─────────────────────────────────────────────────────────────────────────────
// Checkbox — div 기반 커스텀 체크박스 (다크모드 지원)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Check } from 'lucide-react';

export default function Checkbox({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-grid place-items-center w-[18px] h-[18px] rounded-[5px] border shrink-0 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15 dark:focus-visible:ring-zinc-100/20 disabled:opacity-40 disabled:pointer-events-none ${
        checked
          ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900'
          : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
      }`}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </button>
  );
}
