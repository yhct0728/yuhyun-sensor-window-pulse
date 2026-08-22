// ─────────────────────────────────────────────────────────────────────────────
// Button — Pulse 디자인 시스템 버튼
// variant: 'primary' | 'secondary' | 'ghost' | 'icon'
// size:    'sm' | 'md'  (기본 md = h-8/9)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium ' +
  'transition-colors duration-150 active:scale-[0.98] disabled:opacity-40 ' +
  'disabled:pointer-events-none select-none';

const variants = {
  primary:
    'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 ' +
    'hover:bg-zinc-800 dark:hover:bg-white shadow-sm',
  secondary:
    'border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 ' +
    'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 ' +
    'hover:border-zinc-300 dark:hover:border-zinc-700',
  ghost:
    'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 ' +
    'hover:text-zinc-900 dark:hover:text-zinc-100',
  icon:
    'border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 ' +
    'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 ' +
    'hover:border-zinc-300 dark:hover:border-zinc-700',
};

const sizes = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-9 px-4 text-[13.5px]',
  // 정사각형 아이콘 전용
  iconSm: 'w-7 h-7 p-0',
  iconMd: 'w-8 h-8 p-0',
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}) {
  const sizeCls = sizes[size] ?? sizes.md;
  const variantCls = variants[variant] ?? variants.secondary;
  return (
    <button className={`${base} ${variantCls} ${sizeCls} ${className}`} {...rest}>
      {children}
    </button>
  );
}
