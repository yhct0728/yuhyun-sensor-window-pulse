// ─────────────────────────────────────────────────────────────────────────────
// MonitorTab — 모니터링 탭 §3-A
//   메트릭5 + 필터바(뷰·수신칩·정렬·검색) + 뷰(테이블/카드/컴팩트) + 빈 상태
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Radio, Wifi, Clock, WifiOff, UploadCloud, Search, HelpCircle } from 'lucide-react';
import MetricCard from '../ui/MetricCard.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import ViewToggle from '../ui/ViewToggle.jsx';
import Select from '../ui/Select.jsx';
import Button from '../ui/Button.jsx';
import ReceptionGuide from '../onboarding/ReceptionGuide.jsx';
import NodeTable from './NodeTable.jsx';
import NodeCardGrid from './NodeCardGrid.jsx';
import NodeCompactList from './NodeCompactList.jsx';
import { usePulse } from '../../lib/store.jsx';
import { RX_RANK, TX_RANK } from '../../lib/reception.js';

const RX_CHIPS = [
  { id: 'all', label: '전체' },
  { id: 'live', label: '수신중' },
  { id: 'delayed', label: '지연' },
  { id: 'lost', label: '끊김' },
];

const SORTS = [
  { value: 'rx', label: '수신 상태순' },
  { value: 'id', label: '노드 ID순' },
  { value: 'recent', label: '최근 수신순' },
  { value: 'tx', label: '전송 상태순' },
];

export default function MonitorTab({ onOpenNode, onGoDetect }) {
  const { nodes } = usePulse();
  const [view, setView] = useState('table');
  const [rxFilter, setRxFilter] = useState('all');
  const [sort, setSort] = useState('rx');
  const [q, setQ] = useState('');
  const [rxGuide, setRxGuide] = useState(false);

  const metrics = useMemo(() => {
    const m = { total: nodes.length, live: 0, delayed: 0, lost: 0, pending: 0, tomb: 0, err: 0 };
    for (const n of nodes) {
      if (n.tombstone) { m.tomb += 1; continue; } // 원본 없음 노드는 수신·전송 집계에서 제외
      if (n.formatError) { m.err += 1; continue; } // 형식 오류 노드도 수신·전송 집계에서 제외(수신중 오인 방지)
      m[n.reception] = (m[n.reception] || 0) + 1;
      if (n.transmit !== 'sent') m.pending += 1;
    }
    return m;
  }, [nodes]);

  const shown = useMemo(() => {
    let list = nodes;
    if (rxFilter !== 'all') list = list.filter((n) => n.reception === rxFilter);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (n) =>
          n.id.toLowerCase().includes(query) ||
          n.chans.some(
            (c) =>
              c.code.toLowerCase().includes(query) ||
              c.label.toLowerCase().includes(query),
          ),
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === 'id') return a.id.localeCompare(b.id);
      if (sort === 'recent') return (b.lastRx || 0) - (a.lastRx || 0);
      if (sort === 'tx') return TX_RANK[a.transmit] - TX_RANK[b.transmit];
      return RX_RANK[a.reception] - RX_RANK[b.reception]; // rx
    });
    return sorted;
  }, [nodes, rxFilter, q, sort]);

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        title="아직 수신 중인 노드가 없습니다"
        desc={'장비가 데이터를 쏘기 시작하면 노드 ID 기준으로 자동 감지됩니다.\n감지된 .txt 를 노드로 등록해 수신을 시작하세요.'}
        dashed
        action={
          <Button variant="primary" onClick={() => onGoDetect?.()}>
            감지 · 등록 탭으로
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* 메트릭 5 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="전체 노드" value={metrics.total} icon={Radio} tone="default" />
        <MetricCard label="수신중" value={metrics.live} icon={Wifi} tone="emerald" />
        <MetricCard label="지연" value={metrics.delayed} icon={Clock} tone="amber" />
        <MetricCard label="끊김" value={metrics.lost} icon={WifiOff} tone="red" />
        <MetricCard label="전송 대기" value={metrics.pending} icon={UploadCloud} tone="zinc" />
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <ViewToggle value={view} onChange={setView} />
        <div className="inline-flex items-center p-0.5 gap-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          {RX_CHIPS.map((c) => {
            const active = rxFilter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setRxFilter(c.id)}
                className={`h-7 px-2.5 rounded text-[12px] font-medium transition-colors duration-150 ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setRxGuide(true)}
          title="수신 상태 안내"
          className="inline-grid place-items-center w-8 h-8 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <HelpCircle size={15} />
        </button>
        <Select value={sort} onChange={setSort} options={SORTS} className="w-36" />
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="노드 ID · 센서 검색"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* 뷰 */}
      {shown.length === 0 ? (
        <div className="py-12 text-center text-[13px] text-zinc-400">
          조건에 맞는 노드가 없습니다.
        </div>
      ) : view === 'table' ? (
        <NodeTable nodes={shown} sort={sort} onSort={setSort} onOpenNode={onOpenNode} />
      ) : view === 'card' ? (
        <NodeCardGrid nodes={shown} onOpenNode={onOpenNode} />
      ) : (
        <NodeCompactList nodes={shown} onOpenNode={onOpenNode} />
      )}

      <ReceptionGuide open={rxGuide} onClose={() => setRxGuide(false)} />
    </div>
  );
}
