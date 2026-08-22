// ─────────────────────────────────────────────────────────────────────────────
// SensorListTab — 탭① 계측기 목록 (카테고리 필터 + 카드 그리드)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { SENSORS, CATEGORIES, CAT_LABEL } from '../../lib/sensorReference.js';
import { CAT_TINT } from './referenceColors.js';
import { SensorIcon } from './sensorIcons.jsx';

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-7 rounded-full text-[12px] font-medium border transition-colors duration-150 ${
        active
          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
          : 'bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function SensorListTab() {
  const [cat, setCat] = useState('all');
  const rows = cat === 'all' ? SENSORS : SENSORS.filter((x) => x.cat === cat);

  return (
    <div style={{ animation: 'pulse-fade 0.2s ease both' }}>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={cat === 'all'} onClick={() => setCat('all')}>전체</FilterChip>
          {CATEGORIES.map((c) => (
            <FilterChip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</FilterChip>
          ))}
        </div>
        <div className="text-[12px] font-mono text-zinc-400 whitespace-nowrap">
          {cat === 'all' ? '전체' : CAT_LABEL[cat]} <strong className="text-zinc-900 dark:text-zinc-100 text-[14px] mx-0.5">{rows.length}</strong>종
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        {rows.map((row) => (
          <div
            key={row.no}
            className="flex flex-col p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150"
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-grid place-items-center w-[34px] h-[34px] rounded-md ring-1 ring-inset ${CAT_TINT[row.cat]}`}>
                <SensorIcon ko={row.ko} />
              </span>
              <span className={`font-mono text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap ${CAT_TINT[row.cat]}`}>
                {CAT_LABEL[row.cat]}
              </span>
            </div>
            <div className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{row.ko}</div>
            <div className="font-mono text-[11px] text-zinc-400 mt-0.5">{row.en}</div>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-3" />
            <div className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{row.measure}</div>
            <div className="font-mono text-[11px] text-zinc-400 mt-1.5">{row.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
