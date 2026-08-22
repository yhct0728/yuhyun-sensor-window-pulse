// ─────────────────────────────────────────────────────────────────────────────
// Select — 커스텀 드롭다운 (외부 클릭 시 닫힘, 다크모드 지원)
//   options: { value, label, icon? }[]  — icon 은 라벨 왼쪽에 표시할 React 노드(선택)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({
  value,
  onChange,
  options,
  placeholder = '선택',
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full inline-flex items-center justify-between gap-2 h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
      >
        <span className="flex items-center gap-2 min-w-0">
          {current?.icon && (
            <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{current.icon}</span>
          )}
          <span className={`truncate ${current ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>
            {current ? current.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={13}
          className={`text-zinc-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 py-1 max-h-56 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg dark:shadow-black/40">
          {options.length === 0 && (
            <div className="px-3 py-1.5 text-[12.5px] text-zinc-400">옵션 없음</div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-[13px] transition-colors duration-100 ${
                o.value === value
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              {o.icon && (
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{o.icon}</span>
              )}
              <span className="flex-1 truncate">{o.label}</span>
              {o.value === value && <Check size={12} className="text-zinc-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
