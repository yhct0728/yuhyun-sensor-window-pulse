// ─────────────────────────────────────────────────────────────────────────────
// ReceptionGuide — 수신 상태 안내 (가운데 팝업)
//   수신중/지연/끊김이 어떤 기준인지 아주 쉽게. (lib/reception.js 의 1.5×/3× 규칙)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Radio } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

const ITEMS = [
  { dot: 'bg-emerald-500', label: '수신중', desc: '제때 잘 들어오고 있어요. (기록 간격의 1.5배 이내)' },
  { dot: 'bg-amber-500', label: '지연', desc: '평소보다 늦어요. (기록 간격의 3배 이내)' },
  { dot: 'bg-red-500', label: '끊김', desc: '오래 안 들어왔어요. (기록 간격의 3배 초과) 또는 아직 한 번도 안 옴' },
];

export default function ReceptionGuide({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="수신 상태 안내"
      icon={Radio}
      width={420}
      footer={<Button variant="primary" onClick={onClose}>닫기</Button>}
    >
      <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mb-3">
        로거가 파일을 <span className="font-medium text-zinc-700 dark:text-zinc-200">얼마나 최근에 갱신했는지</span>로 표시해요.
      </p>

      <div className="space-y-2.5">
        {ITEMS.map((it) => (
          <div key={it.label} className="flex items-start gap-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${it.dot}`} />
            <div>
              <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{it.label}</div>
              <div className="text-[12px] text-zinc-600 dark:text-zinc-300 leading-relaxed">{it.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 rounded-md bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 text-[11.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
        예) 기록 간격이 <b className="text-zinc-700 dark:text-zinc-200">1시간</b>이면 — 1.5시간 이내 <b className="text-emerald-600 dark:text-emerald-400">수신중</b> · 3시간 이내 <b className="text-amber-600 dark:text-amber-400">지연</b> · 그 이상 <b className="text-red-600 dark:text-red-400">끊김</b>.
        <br />※ "마지막 수신"은 그 .txt 파일이 마지막으로 저장된 시각 기준이에요.
      </div>
    </Modal>
  );
}
