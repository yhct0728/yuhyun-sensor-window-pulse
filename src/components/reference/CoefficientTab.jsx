// ─────────────────────────────────────────────────────────────────────────────
// CoefficientTab — 탭③ 계수 사전 (공식타입 서브탭 + 공식 박스 + 계수 리스트)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { FORMULA_DEFS } from '../../lib/sensorReference.js';
import { TYPE_TINT, SRC_TINT } from './referenceColors.js';

export default function CoefficientTab() {
  const [type, setType] = useState('VW Linear');
  const def = FORMULA_DEFS.find((d) => d.type === type);

  return (
    <div style={{ animation: 'pulse-fade 0.2s ease both' }}>
      {/* 공식 타입 서브탭 */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FORMULA_DEFS.map((d) => {
          const active = type === d.type;
          return (
            <button
              key={d.type}
              onClick={() => setType(d.type)}
              className={`px-3.5 h-8 rounded-md font-mono text-[12px] font-semibold border transition-colors duration-150 ${
                active
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              {d.type}
            </button>
          );
        })}
      </div>

      {/* 공식 박스 */}
      <div className="flex items-center gap-3 flex-wrap px-[18px] py-4 mb-4 rounded-md bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
        <span className={`inline-block font-mono text-[10px] font-bold tracking-wide px-2.5 py-0.5 rounded-full ring-1 ring-inset ${TYPE_TINT[def.type]}`}>
          {def.type}
        </span>
        <code className="font-mono text-[16px] font-semibold text-zinc-900 dark:text-zinc-50">{def.formula}</code>
      </div>

      {/* 계수 리스트 */}
      <div className="flex flex-col gap-2">
        {def.coeffs.map((c) => (
          <div
            key={c.sym}
            className="grid items-center gap-3.5 px-4 py-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            style={{ gridTemplateColumns: '44px 1fr auto' }}
          >
            <div className="font-mono text-[15px] font-bold text-zinc-900 dark:text-zinc-50">{c.sym}</div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{c.name}</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0.5">{c.desc}</div>
            </div>
            <span className={`justify-self-end font-mono text-[10px] font-bold tracking-wide px-2.5 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap ${SRC_TINT[c.source]}`}>
              {c.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
