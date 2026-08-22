// ─────────────────────────────────────────────────────────────────────────────
// FormulaTab — 탭② 공식 타입 (카테고리 필터 + 공식 테이블)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { FORMULAS, CATEGORIES, CAT_LABEL } from '../../lib/sensorReference.js';
import { CAT_DOT, TYPE_TINT } from './referenceColors.js';

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

export default function FormulaTab() {
  const [cat, setCat] = useState('all');
  const rows = cat === 'all' ? FORMULAS : FORMULAS.filter((x) => x.cat === cat);

  return (
    <div style={{ animation: 'pulse-fade 0.2s ease both' }}>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <FilterChip active={cat === 'all'} onClick={() => setCat('all')}>전체</FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</FilterChip>
        ))}
      </div>

      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <table className="w-full text-[13px] border-collapse" style={{ minWidth: 820 }}>
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/60">
              {['현장', '계측기', '신호 방식', '공식 타입', '공식', '계수'].map((h) => (
                <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold tracking-wider uppercase text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800/70 hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                <td className="px-3.5 py-2.5 whitespace-nowrap text-[12px] text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${CAT_DOT[r.cat]}`} />
                    {CAT_LABEL[r.cat]}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 font-semibold whitespace-nowrap text-zinc-900 dark:text-zinc-100">{r.sensor}</td>
                <td className="px-3.5 py-2.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{r.signal}</td>
                <td className="px-3.5 py-2.5">
                  <span className={`inline-block font-mono text-[10px] font-bold tracking-wide px-2.5 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap ${TYPE_TINT[r.type]}`}>
                    {r.type}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 font-mono text-[12px] text-zinc-800 dark:text-zinc-200">{r.formula}</td>
                <td className="px-3.5 py-2.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">{r.coeffs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
