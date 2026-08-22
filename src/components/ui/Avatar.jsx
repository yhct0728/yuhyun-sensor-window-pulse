// ─────────────────────────────────────────────────────────────────────────────
// Avatar — 사이드바 하단 사용자 아바타. 이미지가 없을 때 이니셜 fallback.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

export default function Avatar({ name = '관', src, size = 28 }) {
  const initial = name.trim().slice(0, 1);
  return (
    <div
      className="rounded-full bg-zinc-200 dark:bg-zinc-700 grid place-items-center font-semibold text-zinc-700 dark:text-zinc-200 shrink-0 overflow-hidden"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}
