// ─────────────────────────────────────────────────────────────────────────────
// NodeTable — 노드 모니터 테이블 뷰 (밀도 높음, 권장 기본)
//   컬럼: 수신 / 노드 ID / 모델·타입 / 센서 / 최근 수신 / 기록 간격 / 마지막 수신 / 전송 / →
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { ChevronRight } from 'lucide-react';
import Sparkline from '../ui/Sparkline.jsx';
import { RxPill, TxPill, TombstoneBadge, FormatErrorBadge } from '../ui/StatusPill.jsx';
import { timeAgo, intervalLabel } from '../../lib/format.js';
import { sensorTypeLabel } from '../../lib/backendApi.js';

const COLS = [
  { key: 'rx', label: '수신', sortable: 'rx' },
  { key: 'id', label: '노드 ID', sortable: 'id' },
  { key: 'model', label: '모델 · 타입' },
  { key: 'site', label: '현장' },
  { key: 'chans', label: '센서' },
  { key: 'trend', label: '최근 수신' },
  { key: 'interval', label: '기록 간격' },
  { key: 'lastRx', label: '마지막 수신', sortable: 'recent' },
  { key: 'tx', label: '전송', sortable: 'tx' },
  { key: 'go', label: '' },
];

export default function NodeTable({ nodes, sort, onSort, onOpenNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 text-left">
            {COLS.map((c) => (
              <th
                key={c.key}
                onClick={() => c.sortable && onSort?.(c.sortable)}
                className={`px-3 py-2 font-medium whitespace-nowrap ${
                  c.sortable ? 'cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200' : ''
                } ${sort === c.sortable ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr
              key={n.id}
              onClick={() => onOpenNode?.(n.id)}
              className={`border-t border-zinc-100 dark:border-zinc-800/70 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors duration-100 ${n.tombstone ? 'opacity-55' : ''}`}
            >
              <td className="px-3 py-2.5">{n.tombstone ? <TombstoneBadge /> : n.formatError ? <FormatErrorBadge /> : <RxPill reception={n.reception} />}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{n.id}</span>
                {n.name && n.name !== n.id && <span className="text-zinc-400 dark:text-zinc-500 ml-1.5">{n.name}</span>}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {n.sensorType
                  ? <><span className="text-zinc-700 dark:text-zinc-300">{sensorTypeLabel(n.sensorType)}</span><span className="text-zinc-400 dark:text-zinc-500"> · {n.model}</span></>
                  : <span className="text-zinc-500 dark:text-zinc-400">{n.model}<span className="text-zinc-300 dark:text-zinc-600"> · </span>{n.type}</span>}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {n.siteName
                  ? <span className="text-zinc-600 dark:text-zinc-300">{n.siteName}</span>
                  : <span className="text-zinc-300 dark:text-zinc-600">미배치</span>}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {n.series ? (
                  <span className="text-zinc-600 dark:text-zinc-300">
                    <span className="font-mono tabular-nums">{n.series.count}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 ml-1.5">깊이 프로파일</span>
                  </span>
                ) : (
                  <>
                    <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{n.chans.length}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 ml-1.5">
                      {n.chans.slice(0, 2).map((c) => c.code).join(', ')}
                      {n.chans.length > 2 ? ' …' : ''}
                    </span>
                  </>
                )}
              </td>
              <td className="px-3 py-2.5">
                {n.trend && n.trend.length > 1 ? (
                  <Sparkline data={n.trend} status={n.reception === 'lost' ? 'danger' : n.reception === 'delayed' ? 'warn' : 'ok'} />
                ) : (
                  <span className="text-zinc-300 dark:text-zinc-600">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                {intervalLabel(n.intervalMin)}
              </td>
              <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                {timeAgo(n.lastRx)}
              </td>
              <td className="px-3 py-2.5"><TxPill transmit={n.transmit} count={n.transmit === 'queued' ? n.buffer : n.retry} /></td>
              <td className="px-3 py-2.5 text-right">
                <ChevronRight size={15} className="text-zinc-300 dark:text-zinc-600 inline" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
