// ─────────────────────────────────────────────────────────────────────────────
// FormatGuide — 파일 형식 안내 (가운데 팝업)
//   로거 .txt 가 보통 어떤 모양으로 오는지 아주 쉽게. focus 로 해당 항목 강조.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { ScanLine } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

const ITEMS = [
  { key: 'numbered', label: '번호형', desc: '칸을 1, 2, 3 번호로만 적어요. 무슨 센서인지는 등록할 때 정합니다.', ex: '"DateTime","1","2","3"' },
  { key: 'named', label: '이름형', desc: '칸마다 이름이 붙어 있어요. 가장 알아보기 쉬워요.', ex: '"DateTime","W-3","W-4"' },
  { key: 'depth', label: '깊이형', desc: '땅속 깊이별로 쭉 적혀요(지중경사계 같은 거). 등록하면 하나로 묶입니다.', ex: '"DateTime","0.0M","0.5M", …' },
  { key: 'valuetemp', label: '값+온도형', desc: '측정값과 온도를 함께 적어요.', ex: '"DateTime","값","온도"' },
];

const NOTES = [
  { key: 'warn', dot: 'bg-amber-500', label: '비정형', desc: '형식이 조금 이상해요. 확인하고 등록할 수 있어요.' },
  { key: 'error', dot: 'bg-red-500', label: '형식 오류', desc: '표가 아니라서 등록할 수 없어요.' },
];

export default function FormatGuide({ open, focus, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="파일 형식 안내"
      icon={ScanLine}
      width={440}
      footer={<Button variant="primary" onClick={onClose}>닫기</Button>}
    >
      <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mb-3">
        로거가 만든 <span className="font-mono">.txt</span> 는 보통 이 4가지 모양이에요.
      </p>

      {/* 4가지 형식 — 테두리 하나에 줄 구분 */}
      <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
        {ITEMS.map((it) => (
          <li
            key={it.key}
            className={`px-3.5 py-3 ${focus === it.key ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{it.label}</span>
            </div>
            <p className="text-[12.5px] text-zinc-600 dark:text-zinc-300 leading-relaxed">{it.desc}</p>
            <p className="mt-1 text-[11.5px] text-zinc-400">
              예) <span className="font-mono text-zinc-500 dark:text-zinc-400">{it.ex}</span>
            </p>
          </li>
        ))}
      </ul>

      {/* 등록 여부 색 안내 */}
      <div className="mt-3.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-zinc-600 dark:text-zinc-300">위 4가지는 모두 <span className="font-medium text-zinc-800 dark:text-zinc-100">등록 가능</span>해요.</span>
        </div>
        {NOTES.map((n) => (
          <div key={n.key} className="flex items-center gap-1.5 text-[12px]">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.dot}`} />
            <span className="text-zinc-600 dark:text-zinc-300">
              <span className="font-medium text-zinc-800 dark:text-zinc-100">{n.label}</span> — {n.desc}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
