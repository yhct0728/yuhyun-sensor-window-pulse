// ─────────────────────────────────────────────────────────────────────────────
// NodeMonitor — 노드 모니터 페이지 §3
//   헤더(자동 확인 상태 · 지금 전송 · 새로고침) + 탭(모니터링 / 감지·등록)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { RefreshCw, Timer, HelpCircle, Send } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import MonitorTab from '../components/nodes/MonitorTab.jsx';
import DetectRegisterTab from '../components/nodes/DetectRegisterTab.jsx';
import StartGuide from '../components/onboarding/StartGuide.jsx';
import { usePulse, SYNC_INTERVAL_MS } from '../lib/store.jsx';
import { useTick } from '../hooks/useTick.js';
import { timeAgo } from '../lib/format.js';
import { showToast } from '../components/ui/Toast.jsx';

const GUIDE_SEEN_KEY = 'pulse:guideSeen';

/** 자동 확인 주기(ms) → 사람이 읽는 라벨. 60000 → '1분' */
function everyLabel(ms) {
  const min = Math.round(ms / 60000);
  return min >= 1 ? `${min}분` : `${Math.round(ms / 1000)}초`;
}

export default function NodeMonitor({ dark, setDark, onOpenNode, onRegister }) {
  const { detectedFiles, refreshFiles, loadNodesFromBackend, syncAll, lastSyncAt, syncing } = usePulse();
  const [tab, setTab] = useState('monitor'); // 'monitor' | 'detect'
  const [guideOpen, setGuideOpen] = useState(false);

  // 첫 실행 1회 자동 안내 (이후엔 헤더 ? 버튼으로)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && !window.localStorage.getItem(GUIDE_SEEN_KEY)) {
        setGuideOpen(true);
      }
    } catch { /* localStorage 불가 환경 무시 */ }
  }, []);

  const closeGuide = () => {
    setGuideOpen(false);
    try { window.localStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch { /* noop */ }
  };

  // 상대시간("2분 전 확인함")이 멈춰 보이지 않도록 주기적으로 현재 시각만 갱신.
  // ⚠️ 이 틱은 수집을 트리거하지 않는다 — 수집은 App.jsx 의 SYNC_INTERVAL_MS 타이머 담당.
  const now = useTick(10_000);

  const unregistered = detectedFiles.filter((f) => !f.registered).length;

  const handleRefresh = async () => {
    refreshFiles();
    // 백엔드 노드 목록 동기화 (설정/Electron 일 때만 의미 있음)
    const r = await loadNodesFromBackend();
    if (r?.ok) showToast(`백엔드 노드 ${r.shown ?? r.nodes.length}개 동기화`);
    else if (r && r.error && !['unconfigured', 'no_electron'].includes(r.error)) {
      showToast('백엔드 노드 동기화 실패');
    }
    // 신규 측정값 증분 전송(ingest)
    const s = await syncAll();
    if (s?.sent) showToast(`측정값 ${s.sent}건 전송 (${s.nodes}개 노드)`);
  };

  // 자동 주기를 기다리지 않고 즉시 파일 확인 + 전송. 보낼 게 없으면 그 사실을 알린다.
  const handleSyncNow = async () => {
    if (syncing) return;
    const s = await syncAll();
    if (s?.sent) showToast(`측정값 ${s.sent}건 전송 (${s.nodes}개 노드)`);
    else showToast('새로 보낼 측정값이 없습니다');
  };

  const TABS = [
    { id: 'monitor', label: '모니터링' },
    { id: 'detect', label: '감지 · 등록', badge: unregistered || null },
  ];

  return (
    <>
      <PageHeader
        title="노드 모니터"
        subtitle="이 수집기에 연결된 장비의 실시간 수신·전송 현황"
        dark={dark}
        setDark={setDark}
        actions={
          <>
            <span
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-zinc-200 dark:border-zinc-800 text-[12px] text-zinc-500 dark:text-zinc-400"
              title={`감시 폴더의 .txt 를 ${everyLabel(SYNC_INTERVAL_MS)}마다 다시 읽어 새 측정값만 전송합니다`}
            >
              <Timer size={13} />
              {everyLabel(SYNC_INTERVAL_MS)}마다 자동 확인
              {lastSyncAt && (
                <span className="text-zinc-400 dark:text-zinc-500">
                  · {timeAgo(lastSyncAt, now)} 확인함
                </span>
              )}
            </span>
            <Button variant="secondary" size="md" onClick={handleSyncNow} disabled={syncing}>
              <Send size={14} />
              지금 전송
            </Button>
            <Button variant="icon" size="iconMd" onClick={handleRefresh} title="새로고침">
              <RefreshCw size={15} />
            </Button>
            <Button variant="icon" size="iconMd" onClick={() => setGuideOpen(true)} title="시작 가이드">
              <HelpCircle size={15} />
            </Button>
          </>
        }
      />

      {/* 탭 */}
      <div className="px-8 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-1 -mb-px">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative inline-flex items-center gap-1.5 px-3 h-10 text-[13px] font-medium border-b-2 transition-colors duration-150 ${
                  active
                    ? 'border-emerald-500 text-zinc-900 dark:text-zinc-50'
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {t.label}
                {t.badge != null && (
                  <span className="inline-grid place-items-center min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold tabular-nums">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-8 py-6 overflow-y-auto">
        {tab === 'monitor' ? (
          <MonitorTab onOpenNode={onOpenNode} onGoDetect={() => setTab('detect')} />
        ) : (
          <DetectRegisterTab onRegister={onRegister} />
        )}
      </div>

      <StartGuide
        open={guideOpen}
        onClose={closeGuide}
        onGoDetect={() => { setTab('detect'); closeGuide(); }}
      />
    </>
  );
}
