// ─────────────────────────────────────────────────────────────────────────────
// UpdateCard — 설정 페이지의 "앱 업데이트" 카드
//
// 현재 버전 표시 + 지금 확인 + 받아둔 버전으로 재시작.
// 실동작은 메인 프로세스(updateService.js). 이 컴포넌트는 상태를 읽어 보여주기만 한다.
//
// 자동 갱신이 안 되는 환경이면 **왜 안 되는지**를 그대로 말해준다 —
// 조용히 아무 일도 안 일어나는 것이 가장 나쁜 경우라서.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpCircle, RefreshCw, Download, Check, AlertCircle } from 'lucide-react';
import Button from '../ui/Button.jsx';
import { showToast } from '../ui/Toast.jsx';

/** 상태 코드 → 사람이 읽는 한 줄. */
const STATE_TEXT = {
  idle: '아직 확인하지 않았습니다',
  checking: '확인 중…',
  available: '새 버전을 찾았습니다',
  downloading: '새 버전을 내려받는 중…',
  ready: '새 버전 준비 완료 — 다시 시작하면 적용됩니다',
  none: '최신 버전입니다',
  error: '확인하지 못했습니다',
  unsupported: '이 실행 방식에서는 자동 업데이트가 동작하지 않습니다',
};

/** unsupported 사유 → 사용자가 뭘 해야 하는지. */
const REASON_TEXT = {
  dev: '개발 모드로 실행 중입니다. 설치본(Setup.exe)에서만 동작합니다.',
  'not-installed':
    'Setup.exe 로 설치하지 않고 폴더의 exe 를 직접 실행하셨습니다. ' +
    '자동 업데이트를 쓰려면 Setup.exe 로 한 번 설치해 주세요.',
};

export default function UpdateCard({ isElectron }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (!api?.getUpdateStatus) return;
    try { setSt(await api.getUpdateStatus()); } catch { /* 무시 — 카드만 비워둔다 */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 내려받는 중에는 진행 상황이 바뀌므로 잠깐 주기 조회
  useEffect(() => {
    if (!st || !['checking', 'available', 'downloading'].includes(st.state)) return undefined;
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [st, load]);

  const handleCheck = async () => {
    const api = window.electronAPI;
    if (!api?.checkForUpdate) return;
    setBusy(true);
    try {
      const r = await api.checkForUpdate();
      setSt(r);
      if (r?.state === 'unsupported') showToast('자동 업데이트를 쓸 수 없는 실행 방식입니다');
      else if (r?.state === 'none') showToast('최신 버전입니다');
      else showToast('업데이트를 확인하고 있습니다');
    } finally {
      setBusy(false);
    }
  };

  const handleRestart = async () => {
    const api = window.electronAPI;
    if (!api?.restartForUpdate) return;
    const r = await api.restartForUpdate();
    if (!r?.ok) showToast('아직 받아둔 새 버전이 없습니다');
  };

  const state = st?.state ?? 'idle';
  const ready = state === 'ready';
  const bad = state === 'error' || state === 'unsupported';

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-2.5 px-5 h-12 border-b border-zinc-200 dark:border-zinc-800">
        <ArrowUpCircle size={15} className="text-zinc-400" />
        <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">앱 업데이트</span>
        <span className="text-[12px] text-zinc-400 dark:text-zinc-500">— 새 버전이 나오면 자동으로 받아둡니다</span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mb-0.5">현재 버전</div>
            <div className="text-[13px] font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
              {st?.version ?? '—'}
              {ready && st?.newVersion && (
                <span className="ml-2 text-emerald-700 dark:text-emerald-400">→ {st.newVersion}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={handleCheck} disabled={busy || !isElectron}>
              <RefreshCw size={14} /> 지금 확인
            </Button>
            {ready && (
              <Button variant="primary" size="md" onClick={handleRestart}>
                <Download size={14} /> 다시 시작해서 적용
              </Button>
            )}
          </div>
        </div>

        <div
          className={`flex items-start gap-1.5 text-[11.5px] ${
            bad
              ? 'text-amber-700 dark:text-amber-400'
              : ready
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-zinc-400 dark:text-zinc-500'
          }`}
        >
          {bad ? <AlertCircle size={12} className="mt-px shrink-0" /> : ready ? <Check size={12} className="mt-px shrink-0" /> : null}
          <span>
            {STATE_TEXT[state] ?? state}
            {st?.reason && REASON_TEXT[st.reason] ? ` — ${REASON_TEXT[st.reason]}` : ''}
            {state === 'error' && st?.error ? ` (${st.error})` : ''}
          </span>
        </div>

        {!isElectron && (
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
            업데이트는 데스크톱 앱에서만 동작합니다.
          </div>
        )}
      </div>
    </section>
  );
}
