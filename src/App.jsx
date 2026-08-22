// ─────────────────────────────────────────────────────────────────────────────
// App — Pulse v2 최상위 셸 (현장-블라인드)
//
// 라우터 미도입: page state 로 페이지 전환.
//   'nodes'(기본) | 'transmit' | 'reference' | 'settings'
// 노드 상세는 우측 드로어, 노드 등록은 중앙 모달 위저드로 띄웁니다.
//
// 테스트 전용 훅: ?test=node 이면 합성 노드 1대를 스토어에 주입하고 상세 드로어를
// 자동으로 엽니다(E2E 가 등록 흐름에 의존하지 않도록). 운영 영향 없음.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { PulseProvider, usePulse, SYNC_INTERVAL_MS } from './lib/store.jsx';
import * as folderApi from './lib/folderApi.js';
import { useDarkMode } from './hooks/useDarkMode.js';
import Sidebar from './components/layout/Sidebar.jsx';
import NodeMonitor from './pages/NodeMonitor.jsx';
import TransmitQueue from './pages/TransmitQueue.jsx';
import Reference from './pages/Reference.jsx';
import Settings from './pages/Settings.jsx';
import NodeDetailDrawer from './components/nodes/NodeDetailDrawer.jsx';
import RegisterWizard from './components/nodes/RegisterWizard.jsx';
import { ToastHost, showToast } from './components/ui/Toast.jsx';

// 생존 신호 주기(ms). 서버의 오프라인 판정(기본 3분)보다 넉넉히 짧아야
// 정상 동작 중에 오탐 알림이 뜨지 않는다.
const HEARTBEAT_INTERVAL_MS = 60_000;

function testParam() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('test');
}

// E2E 합성 노드 (실데이터 없이 드로어/뷰를 검증하기 위한 1대)
const TEST_NODE = {
  id: 'YH-0007',
  model: 'YH-DL16',
  type: '데이터로거',
  sensorType: 'inclinometer', // 지중경사계 (채널 GI-A·GI-B) — 드로어/깊이프로파일 E2E 용
  proto: 'Modbus TCP',
  intervalMin: 60,
  sourceFile: 'C:\\pulse\\node-7.txt',
  lastRx: Date.now() - 20 * 60000,
  rows: 1280,
  raw: Array.from({ length: 12 }, (_, i) => [
    `2026-05-29 ${String(i).padStart(2, '0')}:00`,
    (12.3 + Math.sin(i) * 0.4).toFixed(2),
    (8.1 + Math.cos(i) * 0.3).toFixed(2),
  ]),
  channels: [
    { ch: 1, code: 'GI-A', label: 'A축 변위', unit: 'mm' },
    { ch: 2, code: 'GI-B', label: 'B축 변위', unit: 'mm' },
  ],
};

function Shell({ dark, setDark }) {
  const store = usePulse();
  const [page, setPage] = useState('nodes');
  const [openNode, setOpenNode] = useState(null); // 드로어 대상 노드 id
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardFile, setWizardFile] = useState(null); // 특정 파일에서 등록 진입

  // 마운트 시: 워치 폴더 1회 스캔 + 백엔드 노드 목록으로 모니터 채움
  // (Electron+백엔드 설정 시 실제 GET /nodes, 아니면 각각 빈 배열/무동작)
  useEffect(() => {
    store.refreshFiles();
    store.loadNodesFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 파일 폴링 워커: SYNC_INTERVAL_MS 마다 모든 노드의 신규 측정값을 백엔드로 증분 전송.
  //   주기는 노드의 intervalMin("기록 간격")과 무관한 고정값이다 — 화면 문구도 같은
  //   상수를 읽으므로 둘이 어긋나지 않는다.
  // (ref 로 최신 syncAll 참조 → 노드 목록이 갱신돼도 stale 안 됨. 미설정/비-Electron 이면 무동작)
  const syncRef = useRef(store.syncAll);
  syncRef.current = store.syncAll;
  useEffect(() => {
    const id = setInterval(() => { syncRef.current?.(); }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // 생존 신호(heartbeat): 이 PC 가 살아있다고 서버에 계속 알린다.
  //   **이 PC 가 죽으면 펄스 스스로는 아무것도 알릴 수 없다**(죽었으니까).
  //   그래서 서버가 이 신호의 침묵을 감지해 "수집기 응답 없음"을 대신 알린다.
  //   서버 판정 기준이 기본 3분(PULSE_OFFLINE_MINUTES)이므로 그보다 짧게 보낸다.
  useEffect(() => {
    const beat = () => { folderApi.sendHeartbeat({ status: 'online' }); };
    beat(); // 앱 켜자마자 1회 — 재시작 직후 공백을 줄인다
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // 테스트 훅:
  //   ?test=node   → 합성 노드 1대 주입 + 드로어 자동 오픈 (E2E 용)
  //   ?test=import → 감시 폴더의 더미 .txt 를 헤드리스 자동 등록 (개발/테스트 시드, PULSE_AUTOIMPORT)
  useEffect(() => {
    const tp = testParam();
    if (tp === 'node') {
      store.registerNode(TEST_NODE);
      setOpenNode(TEST_NODE.id);
    } else if (tp === 'import') {
      store.autoImportFromFolder().then((s) => {
        const n = s.registered.length;
        showToast(n ? `자동 등록 ${n}개 노드 · 스킵 ${s.skipped.length}` : `등록할 파일 없음 (스캔 ${s.scanned})`);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigate = (id) => setPage(id);

  const openWizard = (file = null) => {
    setWizardFile(file);
    setWizardOpen(true);
  };

  const activeNode = store.nodes.find((n) => n.id === openNode) || null;

  let content;
  if (page === 'transmit') {
    content = <TransmitQueue dark={dark} setDark={setDark} onOpenNode={setOpenNode} />;
  } else if (page === 'reference') {
    content = <Reference dark={dark} setDark={setDark} />;
  } else if (page === 'settings') {
    content = <Settings dark={dark} setDark={setDark} />;
  } else {
    content = (
      <NodeMonitor
        dark={dark}
        setDark={setDark}
        onOpenNode={setOpenNode}
        onRegister={openWizard}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Sidebar active={page} onNavigate={handleNavigate} />
      <main className="flex-1 min-w-0 flex flex-col">{content}</main>

      <NodeDetailDrawer
        node={activeNode}
        onClose={() => setOpenNode(null)}
      />
      <RegisterWizard
        open={wizardOpen}
        initialFile={wizardFile}
        onClose={() => setWizardOpen(false)}
      />
      <ToastHost />
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useDarkMode();
  return (
    <PulseProvider>
      <Shell dark={dark} setDark={setDark} />
    </PulseProvider>
  );
}
