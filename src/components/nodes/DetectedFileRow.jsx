// ─────────────────────────────────────────────────────────────────────────────
// DetectedFileRow — 감지 파일 1행
//   파일명 / 노드ID·행수·갱신 / 포맷 패턴 뱃지 / 등록 (또는 모니터링 중 · 등록 불가)
//   포맷 status 가 ok 가 아니면(비정형/형식 오류) 등록 차단(엄격).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { FileText, Plus, Ban } from 'lucide-react';
import { RxDot } from '../ui/StatusPill.jsx';
import { FORMAT_TINT } from '../../lib/formatClassify.js';
import { timeAgo, fmtNum } from '../../lib/format.js';

export default function DetectedFileRow({ file, first, onRegister, onShowFormat }) {
  const reg = file.registered;
  const fmt = file.format || { status: 'ok', patternLabel: '', reason: '' };
  const blocked = fmt.status === 'error'; // 권장(느슨): 진짜 깨진 표만 차단, 비정형(warn)은 허용

  const rowBg = reg
    ? ''
    : blocked
    ? 'bg-red-50/40 dark:bg-red-950/15'
    : 'bg-amber-50/30 dark:bg-amber-950/10';

  return (
    <div className={`flex items-center gap-3 px-4 h-14 ${first ? '' : 'border-t border-zinc-100 dark:border-zinc-800'} ${rowBg}`}>
      <FileText size={16} className={`shrink-0 ${reg ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-300'}`} />
      <div className="min-w-0">
        <div className="font-mono text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate">{file.name}</div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums truncate">
          {file.nodeId} · {fmtNum(file.rows, 0)}행 · {timeAgo(file.modified)} 갱신
        </div>
      </div>
      <div className="flex-1" />

      {/* 포맷 패턴 뱃지 (클릭 → 형식 안내) */}
      {fmt.patternLabel && (
        <button
          onClick={() => onShowFormat?.(fmt.pattern || fmt.status)}
          title="형식 설명 보기"
          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset whitespace-nowrap transition-opacity hover:opacity-80 ${FORMAT_TINT[fmt.status]}`}
        >
          {fmt.patternLabel}
        </button>
      )}

      {reg ? (
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-400">
          <RxDot reception="live" size="sm" /> 모니터링 중
        </span>
      ) : !blocked ? (
        <button
          onClick={() => onRegister?.(file)}
          className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[12.5px] font-medium hover:bg-zinc-800 dark:hover:bg-white transition-colors active:scale-[0.98]"
        >
          <Plus size={13} /> 등록
        </button>
      ) : (
        <>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[150px] hidden lg:block">{fmt.reason}</span>
          <button
            disabled
            title={fmt.reason}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 text-[12.5px] font-medium cursor-not-allowed"
          >
            <Ban size={13} /> 등록 불가
          </button>
        </>
      )}
    </div>
  );
}
