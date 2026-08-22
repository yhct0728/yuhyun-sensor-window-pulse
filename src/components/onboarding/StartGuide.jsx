// ─────────────────────────────────────────────────────────────────────────────
// StartGuide — 시작 가이드 (파일 감지 → 노드 등록 절차 안내)
//   빈 상태(노드/파일 0)에서 자동 1회, 이후 헤더 ? 버튼으로 재호출.
//   현장-블라인드: 현장 개념 없이 "폴더 → 파일 → 노드" 흐름만 설명.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Compass, FolderCog, FileText, ScanLine, Plus, Radio } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

const STEPS = [
  { icon: FolderCog, title: '감시 폴더 지정', desc: '설정에서 로거가 .txt 를 떨구는 폴더를 지정합니다.' },
  { icon: FileText, title: '.txt 자동 감지', desc: '로거가 폴더에 파일을 저장하면 파일명에서 노드 ID 를 추론해 자동 감지합니다.' },
  { icon: ScanLine, title: '형식 확인', desc: '감지·등록 탭에서 파일 패턴(신호등)을 확인합니다.' },
  { icon: Plus, title: '노드 등록', desc: '등록하면 노드로 승격됩니다. 깊이형(0.0M…)은 프로파일 1개로 묶입니다.' },
  { icon: Radio, title: '수신 확인', desc: '노드 모니터에서 노드별 수신·전송 상태를 봅니다.' },
];

const LEGEND = [
  { dot: 'bg-emerald-500', label: '등록 가능', desc: '표 정상 + 패턴 인식 (번호형·이름형·깊이형·값+온도형)' },
  { dot: 'bg-amber-500', label: '비정형', desc: '파싱은 되나 형식이 애매 — 확인 후 등록 가능' },
  { dot: 'bg-red-500', label: '형식 오류', desc: '시각·값 열이 없어 표가 아님 — 등록 불가' },
];

export default function StartGuide({ open, onClose, onGoDetect }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="시작 가이드"
      icon={Compass}
      width={540}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button variant="primary" onClick={onGoDetect}>감지 · 등록 탭으로</Button>
        </>
      }
    >
      <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mb-4">
        타사 로거가 폴더에 저장한 <span className="font-mono">.txt</span> 를 감지해 노드로 등록하고, 수신·전송을 모니터링합니다.
      </p>

      {/* 절차 5단계 */}
      <ol className="space-y-2.5 mb-5">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={i} className="flex items-start gap-3">
              <span className="relative inline-grid place-items-center w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
                <Icon size={16} />
                <span className="absolute -top-1.5 -left-1.5 inline-grid place-items-center w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-semibold tabular-nums">
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{s.title}</div>
                <div className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{s.desc}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* 신호등 범례 */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-3">
        <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-2">파일 형식 신호등</div>
        <div className="space-y-1.5">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-start gap-2 text-[12px]">
              <span className={`inline-block w-2 h-2 rounded-full mt-1 shrink-0 ${l.dot}`} />
              <span className="text-zinc-700 dark:text-zinc-300 font-medium shrink-0 w-16">{l.label}</span>
              <span className="text-zinc-500 dark:text-zinc-400">{l.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
