// ─────────────────────────────────────────────────────────────────────────────
// Modal — 재사용 모달 (오버레이 + 패널 + 헤더/본문/푸터)
//   - Esc 키 또는 바깥 클릭으로 닫힘
//   - 본문이 길면 스크롤, 헤더/푸터는 고정
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  title,
  icon: Icon,
  onClose,
  children,
  footer,
  width = 480,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 dark:bg-zinc-950/70 backdrop-blur-sm p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-w-full flex flex-col max-h-[88vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg dark:shadow-black/40"
        style={{ width, animation: 'pulse-fade 0.18s ease both' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <span className="inline-grid place-items-center w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700 shrink-0">
                <Icon size={15} />
              </span>
            )}
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            title="닫기"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-150 shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
