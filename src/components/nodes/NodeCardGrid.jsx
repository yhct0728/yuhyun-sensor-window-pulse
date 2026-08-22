// ─────────────────────────────────────────────────────────────────────────────
// NodeCardGrid — 노드 모니터 카드 뷰
//   노드별 카드: 노드 ID·수신 배지 / 모델 / 스파크라인 / 채널 목록 / 전송 상태
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { MapPin } from 'lucide-react';
import Sparkline from '../ui/Sparkline.jsx';
import { RxPill, TxPill, TombstoneBadge, FormatErrorBadge } from '../ui/StatusPill.jsx';
import { timeAgo, intervalLabel, fmtNum, fmtDateTime } from '../../lib/format.js';

export default function NodeCardGrid({ nodes, onOpenNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {nodes.map((n) => (
        <button
          key={n.id}
          onClick={() => onOpenNode?.(n.id)}
          className={`text-left rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150 ${n.tombstone ? 'opacity-55' : ''}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono font-semibold text-[14px] text-zinc-900 dark:text-zinc-100">
                {n.id}
              </div>
              <div className="text-[11.5px] text-zinc-500 dark:text-zinc-400 truncate">
                {n.model} · {n.proto}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] truncate">
                <MapPin size={11} className="text-zinc-400 shrink-0" />
                {n.siteName
                  ? <span className="text-zinc-500 dark:text-zinc-400 truncate">{n.siteName}</span>
                  : <span className="text-zinc-300 dark:text-zinc-600">미배치</span>}
              </div>
            </div>
            {n.tombstone ? <TombstoneBadge /> : n.formatError ? <FormatErrorBadge /> : <RxPill reception={n.reception} />}
          </div>

          <div className="my-3 h-8 flex items-end">
            {n.trend && n.trend.length > 1 ? (
              <Sparkline data={n.trend} width={220} height={32} status={n.reception === 'lost' ? 'danger' : n.reception === 'delayed' ? 'warn' : 'ok'} />
            ) : (
              <div className="w-full text-[11px] text-zinc-300 dark:text-zinc-600">수신 데이터 없음</div>
            )}
          </div>

          <div className="space-y-1 mb-3">
            {n.chans.slice(0, 4).map((c) => (
              <div key={c.ch} className="flex items-center justify-between text-[12px]">
                <span className="text-zinc-500 dark:text-zinc-400 truncate">
                  <span className="font-mono text-zinc-400 dark:text-zinc-500 mr-1.5">{c.code}</span>
                  {c.label}
                </span>
                <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300 shrink-0">
                  {fmtNum(c.value)} {c.unit}
                </span>
              </div>
            ))}
            {n.chans.length > 4 && (
              <div className="text-[11px] text-zinc-400">외 {n.chans.length - 4}개 센서</div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[11.5px] text-zinc-400">
            <span className="tabular-nums">{intervalLabel(n.intervalMin)} · <span title={timeAgo(n.lastRx)}>{fmtDateTime(n.lastRx)}</span></span>
            <TxPill transmit={n.transmit} count={n.transmit === 'queued' ? n.buffer : n.retry} />
          </div>
        </button>
      ))}
    </div>
  );
}
