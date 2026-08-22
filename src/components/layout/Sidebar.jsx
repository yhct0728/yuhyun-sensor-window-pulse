// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — 좌측 네비 (240px 고정) · 현장-블라인드 v2
//   브랜드 / 4개 메뉴 / "현장-블라인드" 안내 / PC식별·계정
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  Activity,
  Radio,
  Send,
  BookOpen,
  Settings,
  EyeOff,
  Server,
  ChevronUp,
} from 'lucide-react';
import Avatar from '../ui/Avatar.jsx';

const ITEMS = [
  { id: 'nodes', icon: Radio, label: '노드 모니터' },
  { id: 'transmit', icon: Send, label: '전송 큐' },
  { id: 'reference', icon: BookOpen, label: '계측기 도감' },
  { id: 'settings', icon: Settings, label: '설정' },
];

export default function Sidebar({ active = 'nodes', onNavigate }) {
  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 self-start bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 flex flex-col px-2.5 py-3.5">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 pb-3.5">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 text-white grid place-items-center shadow-sm">
          <Activity size={15} />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pulse
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">유현건설 · 수집기</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-px px-0.5 pt-1">
        {ITEMS.map((it) => {
          const isActive = active === it.id;
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => onNavigate?.(it.id)}
              className={`group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] select-none transition-colors duration-150 text-left ${
                isActive
                  ? 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-emerald-500 rounded-r" />
              )}
              <Icon
                size={15.5}
                className={
                  isActive
                    ? ''
                    : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200'
                }
              />
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 현장-블라인드 안내 */}
      <div className="mx-1 my-3 px-3 py-2.5 rounded-md bg-zinc-100/70 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300 mb-1 font-medium">
          <EyeOff size={12} />
          <span>현장-블라인드</span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Pulse 는 노드 ID 단위로만 수집·전송합니다. 현장 배치는 GeoMonitor 가 관리합니다.
        </p>
      </div>

      {/* PC 식별 + 계정 */}
      <div className="mt-1 pt-2.5 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
        <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          <Server size={12} className="shrink-0" />
          <span className="truncate font-mono">수집기 PC · COLLECTOR-01</span>
        </div>
        <button
          onClick={() => onNavigate?.('settings')}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-zinc-200/40 dark:hover:bg-zinc-800/50 transition-colors duration-150"
        >
          <Avatar name="관" size={28} />
          <div className="leading-tight flex-1 text-left min-w-0">
            <div className="text-[12.5px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
              관리자
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              operator@yoohyun.kr
            </div>
          </div>
          <ChevronUp size={13} className="text-zinc-400 shrink-0" />
        </button>
      </div>
    </aside>
  );
}
