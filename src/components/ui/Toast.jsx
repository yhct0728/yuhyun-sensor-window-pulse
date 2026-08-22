// ─────────────────────────────────────────────────────────────────────────────
// Toast — 우하단에 잠깐 떴다 사라지는 알림
//
// 모듈 외부에서는 showToast(message, opts) 만 호출하면 됩니다.
// 어딘가에 <ToastHost/> 가 한 번 렌더되어 있어야 동작 (App.jsx 에 박혀있음).
//
// 의도적으로 가벼운 자체 구현 — 외부 라이브러리(`sonner` 등)로 바꿔도 무방.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';

const SUBSCRIBERS = new Set();
let nextId = 1;

export function showToast(message, { duration = 2400 } = {}) {
  const id = nextId++;
  const toast = { id, message };
  SUBSCRIBERS.forEach((cb) => cb({ type: 'add', toast }));
  setTimeout(() => {
    SUBSCRIBERS.forEach((cb) => cb({ type: 'remove', id }));
  }, duration);
}

export function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onEvent = (e) => {
      if (e.type === 'add') setToasts((cur) => [...cur, e.toast]);
      if (e.type === 'remove') setToasts((cur) => cur.filter((t) => t.id !== e.id));
    };
    SUBSCRIBERS.add(onEvent);
    return () => SUBSCRIBERS.delete(onEvent);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto inline-flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[12.5px] font-medium shadow-lg"
          style={{ animation: 'pulse-fade 0.18s ease both' }}
        >
          <Info size={13} className="opacity-80" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
