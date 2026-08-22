// ─────────────────────────────────────────────────────────────────────────────
// DetectRegisterTab — 감지 · 등록 탭 §3-B (디자인 프로토타입 pulse2-views 기준)
//   감시 폴더 카드 + 요약3(감지/등록/미등록) + 감지된 파일 카드(헤더+행) + 안내
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Folder, RefreshCw, FileText, Info, FolderSearch, FolderCog, HelpCircle } from 'lucide-react';
import EmptyState from '../ui/EmptyState.jsx';
import DetectedFileRow from './DetectedFileRow.jsx';
import FormatGuide from '../onboarding/FormatGuide.jsx';
import { RxDot } from '../ui/StatusPill.jsx';
import { usePulse } from '../../lib/store.jsx';
import * as folderApi from '../../lib/folderApi.js';
import { showToast } from '../ui/Toast.jsx';

export default function DetectRegisterTab({ onRegister }) {
  const { detectedFiles, watchFolder, refreshFiles, setWatchFolder } = usePulse();
  const [fmtGuide, setFmtGuide] = useState({ open: false, focus: null });
  const showFormat = (focus) => setFmtGuide({ open: true, focus });

  const total = detectedFiles.length;
  const registered = detectedFiles.filter((f) => f.registered).length;
  const unregistered = total - registered;

  // 등록(모니터링 중) 먼저, 미등록 나중 — 디자인 순서
  const ordered = useMemo(
    () => [...detectedFiles].sort((a, b) => (a.registered === b.registered ? 0 : a.registered ? -1 : 1)),
    [detectedFiles],
  );

  const handlePick = async () => {
    const picked = await folderApi.pickFolder();
    if (picked) {
      await setWatchFolder(picked);
      showToast('감시 폴더를 변경했습니다');
    }
  };

  return (
    <div className="flex flex-col gap-4" style={{ animation: 'pulse-fade 0.3s ease both' }}>
      {/* 감시 폴더 카드 */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 flex items-center gap-3">
        <span className="inline-grid place-items-center w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
          <Folder size={17} />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">감시 폴더</div>
          <div className="font-mono text-[12.5px] text-zinc-700 dark:text-zinc-200 truncate">
            {watchFolder || '감시 폴더가 설정되지 않았습니다'}
          </div>
        </div>
        <div className="flex-1" />
        {watchFolder ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 h-7 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-emerald-700 dark:text-emerald-400">
            <RxDot reception="live" size="sm" /> 감시 중
          </span>
        ) : (
          <button
            onClick={handlePick}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <FolderCog size={14} /> 폴더 선택
          </button>
        )}
        <button
          onClick={() => refreshFiles()}
          title="다시 스캔"
          className="inline-grid place-items-center w-8 h-8 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shrink-0"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* 요약 3 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '감지 파일', value: total, accent: false },
          { label: '등록됨', value: registered, accent: false },
          { label: '미등록', value: unregistered, accent: true },
        ].map((s) => (
          <div key={s.label} className="px-5 py-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium mb-1">{s.label}</div>
            <div className={`text-[26px] font-semibold tabular-nums leading-none ${
              s.accent ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-50'
            }`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* 감지된 파일 카드 */}
      {total === 0 ? (
        <EmptyState
          icon={FolderSearch}
          title="감지된 파일이 없습니다"
          desc={'로거가 감시 폴더에 .txt 를 떨구면 자동으로 표시됩니다.\n폴더를 지정했다면 "다시 스캔"을 눌러 확인하세요.'}
          dashed
        />
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 px-4 h-11 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40">
            <FileText size={13} className="text-zinc-400" />
            <span className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">감지된 파일</span>
            <span className="text-[12px] text-zinc-400 dark:text-zinc-500 hidden sm:inline">— 미등록 파일을 노드로 등록하세요</span>
            <div className="flex-1" />
            {/* 신호등 범례 */}
            <div className="hidden md:flex items-center gap-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {[
                ['bg-emerald-500', '등록 가능'],
                ['bg-amber-500', '비정형'],
                ['bg-red-500', '형식 오류'],
              ].map(([dot, label]) => (
                <span key={label} className="inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {label}
                </span>
              ))}
            </div>
            <button
              onClick={() => showFormat(null)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 ml-1"
            >
              <HelpCircle size={12} /> 형식 안내
            </button>
          </div>
          {ordered.map((f, i) => (
            <DetectedFileRow key={f.fullPath || f.name} file={f} first={i === 0} onRegister={onRegister} onShowFormat={showFormat} />
          ))}
        </div>
      )}

      {/* 안내 */}
      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-start gap-1.5">
        <Info size={11} className="mt-px shrink-0" />
        <span>
          로거가 폴더에 떨군 .txt 를 자동 감지합니다. 파일명에서 노드 ID 를 추론하며(node-99.txt → YH-0099), 폴더 경로에는 현장 개념이 없습니다.
        </span>
      </div>

      <FormatGuide
        open={fmtGuide.open}
        focus={fmtGuide.focus}
        onClose={() => setFmtGuide({ open: false, focus: null })}
      />
    </div>
  );
}
