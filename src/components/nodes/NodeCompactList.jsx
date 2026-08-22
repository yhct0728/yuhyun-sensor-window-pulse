// ─────────────────────────────────────────────────────────────────────────────
// NodeCompactList — 노드 모니터 컴팩트 뷰 (1줄 노드 행)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { RxDot, TxPill } from '../ui/StatusPill.jsx';
import { RX_META } from '../../lib/reception.js';
import { timeAgo, intervalLabel } from '../../lib/format.js';

export default function NodeCompactList({ nodes, onOpenNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/70 overflow-hidden">
      {nodes.map((n) => (
        <button
          key={n.id}
          onClick={() => onOpenNode?.(n.id)}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors duration-100 ${n.tombstone ? 'opacity-55' : ''}`}
        >
          {n.tombstone ? <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" /> : n.formatError ? <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> : <RxDot reception={n.reception} />}
          <span className="font-mono font-medium text-[13px] text-zinc-900 dark:text-zinc-100 w-24 shrink-0">
            {n.id}
          </span>
          <span className="text-[12px] text-zinc-500 dark:text-zinc-400 w-28 shrink-0 truncate hidden sm:block">
            {n.model}
          </span>
          <span className="text-[11.5px] w-28 shrink-0 truncate hidden lg:block">
            {n.siteName
              ? <span className="text-zinc-500 dark:text-zinc-400">{n.siteName}</span>
              : <span className="text-zinc-300 dark:text-zinc-600">미배치</span>}
          </span>
          <span className="text-[11.5px] text-zinc-400 shrink-0 w-20 hidden md:block">
            {n.tombstone ? '원본 없음' : n.formatError ? '형식 오류' : `${RX_META[n.reception]?.label} · ${n.chans.length}ch`}
          </span>
          <span className="flex-1" />
          <span className="text-[11.5px] text-zinc-400 tabular-nums hidden lg:block">
            {intervalLabel(n.intervalMin)} · {timeAgo(n.lastRx)}
          </span>
          <TxPill transmit={n.transmit} count={n.transmit === 'queued' ? n.buffer : n.retry} />
          <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
        </button>
      ))}
    </div>
  );
}
