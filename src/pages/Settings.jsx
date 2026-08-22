// ─────────────────────────────────────────────────────────────────────────────
// Settings — 설정 §7
//   데이터 폴더(감시 폴더) 설정: 경로 표시·입력·검증·찾아보기·저장·기본값 복원
//   백엔드 IPC: getDefaultFolder / validateFolder / pickFolder / setRootFolder /
//              resetToDefault (folderService.js)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import {
  HardDrive, FolderSearch, Save, RotateCcw, Check, AlertCircle, Info, Link2, KeyRound,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import { usePulse } from '../lib/store.jsx';
import * as folderApi from '../lib/folderApi.js';
import { showToast } from '../components/ui/Toast.jsx';
import UpdateCard from '../components/settings/UpdateCard.jsx';

export default function Settings({ dark, setDark }) {
  const { watchFolder, setWatchFolder, refreshFiles, isElectron } = usePulse();
  const [pathInput, setPathInput] = useState(watchFolder || '');
  const [savedPath, setSavedPath] = useState(watchFolder || ''); // 현재 저장된(영속) 폴더
  const [defaultPath, setDefaultPath] = useState('');
  const [validation, setValidation] = useState(null); // { accessible, exists, txtCount, error }
  const [busy, setBusy] = useState(false);

  // 외부(감지·등록 탭 등)에서 watchFolder 가 바뀌면 동기화
  useEffect(() => {
    if (watchFolder) { setSavedPath(watchFolder); setPathInput(watchFolder); }
  }, [watchFolder]);

  // 최초 진입 시 기본 폴더 + 현재 설정된 폴더(config) 로드·검증
  useEffect(() => {
    let alive = true;
    (async () => {
      const [def, root] = await Promise.all([
        folderApi.getDefaultFolder(),
        folderApi.getRootFolder(),
      ]);
      if (!alive) return;
      setDefaultPath(def || '');
      const cur = watchFolder || root || '';
      if (cur) {
        setSavedPath(cur);
        setPathInput(cur);
        const r = await folderApi.validateFolder(cur);
        if (alive) setValidation(r);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doValidate = async (p) => {
    const r = await folderApi.validateFolder(p);
    setValidation(r);
    return r;
  };

  const handleBrowse = async () => {
    const picked = await folderApi.pickFolder();
    if (picked) {
      setPathInput(picked);
      doValidate(picked);
    }
  };

  const handleSave = async () => {
    const p = pathInput.trim();
    if (!p) return;
    setBusy(true);
    await setWatchFolder(p);
    setSavedPath(p);
    await doValidate(p);
    setBusy(false);
    showToast('데이터 폴더를 저장했습니다');
  };

  const handleReset = async () => {
    setBusy(true);
    const def = await folderApi.resetToDefault();
    await refreshFiles();
    setSavedPath(def || '');
    setPathInput(def || '');
    await doValidate(def || '');
    setBusy(false);
    showToast('기본 폴더로 복원했습니다');
  };

  const dirty = pathInput.trim() !== savedPath.trim();
  const ok = validation && validation.accessible && validation.exists;

  // ── 백엔드 연결 ─────────────────────────────────────────────────────────────
  const [backendUrl, setBackendUrl] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [backendBusy, setBackendBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    folderApi.getBackendConfig().then((c) => {
      if (!alive) return;
      setBackendUrl(c.url || '');
      setHasKey(!!c.hasKey);
    });
    return () => { alive = false; };
  }, []);

  const handleBackendSave = async () => {
    setBackendBusy(true);
    const c = await folderApi.setBackendConfig({ url: backendUrl.trim(), apiKey: apiKeyInput });
    setBackendUrl(c.url || '');
    setHasKey(!!c.hasKey);
    setApiKeyInput('');
    setBackendBusy(false);
    showToast('백엔드 연결을 저장했습니다');
  };

  return (
    <>
      <PageHeader
        title="설정"
        subtitle="데이터 폴더 · 수집 환경 설정"
        dark={dark}
        setDark={setDark}
      />

      <div className="flex-1 px-8 py-6 overflow-y-auto">
        <div className="max-w-2xl space-y-4">
          {/* 데이터 폴더 카드 */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-2.5 px-5 h-12 border-b border-zinc-200 dark:border-zinc-800">
              <HardDrive size={15} className="text-zinc-400" />
              <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">데이터 폴더</span>
              <span className="text-[12px] text-zinc-400 dark:text-zinc-500">— 로거가 .txt 를 떨구는 감시 폴더</span>
            </div>

            <div className="px-5 py-4 space-y-3">
              <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">폴더 경로</label>
              <div className="flex items-center gap-2">
                <input
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  placeholder="예: C:\\pulse\\incoming"
                  spellCheck={false}
                  className="flex-1 min-w-0 h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12.5px] font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
                />
                <Button variant="secondary" size="lg" onClick={handleBrowse} disabled={!isElectron}>
                  <FolderSearch size={14} /> 찾아보기
                </Button>
              </div>

              {/* 검증 결과 */}
              {validation && (
                ok ? (
                  <div className="flex items-center gap-1.5 text-[12px] text-emerald-700 dark:text-emerald-400">
                    <Check size={13} className="shrink-0" />
                    접근 가능 · .txt {validation.txtCount}개 감지
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
                    <AlertCircle size={13} className="shrink-0" />
                    {folderApi.FOLDER_ERROR_MESSAGE[validation.error] || '폴더에 접근할 수 없습니다'}
                  </div>
                )
              )}

              {/* 액션 */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button variant="ghost" size="md" onClick={handleReset} disabled={busy || !isElectron}>
                  <RotateCcw size={13} /> 기본값으로 복원
                </Button>
                <Button variant="primary" size="lg" onClick={handleSave} disabled={busy || !dirty || !pathInput.trim()}>
                  <Save size={14} /> 저장
                </Button>
              </div>
            </div>

            {/* 기본 경로 안내 */}
            <div className="px-5 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Info size={11} className="shrink-0" />
              기본 폴더: <span className="font-mono text-zinc-500 dark:text-zinc-400">{defaultPath || '바탕화면'}</span>
            </div>
          </section>

          {/* 백엔드 연결 카드 */}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-2.5 px-5 h-12 border-b border-zinc-200 dark:border-zinc-800">
              <Link2 size={15} className="text-zinc-400" />
              <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">백엔드 연결</span>
              <span className="text-[12px] text-zinc-400 dark:text-zinc-500">— 노드 등록·전송을 보낼 서버</span>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mb-1.5">백엔드 URL</label>
                <input
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="예: https://geomonitor.example.com"
                  spellCheck={false}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12.5px] font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
                />
                <div className="mt-1 text-[11px] text-zinc-400">호출 경로: <span className="font-mono">{(backendUrl || '<URL>')}/api/pulse/v1/*</span></div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mb-1.5">
                  <KeyRound size={12} /> API 키 (X-API-Key)
                  {hasKey && <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><Check size={11} /> 저장됨</span>}
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={hasKey ? '저장됨 · 변경하려면 새 키 입력' : 'API 키 입력'}
                  spellCheck={false}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12.5px] font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
                />
                <div className="mt-1 text-[11px] text-zinc-400">키는 이 PC(메인 프로세스)에만 저장되고 화면엔 표시되지 않습니다.</div>
              </div>
              <div className="flex justify-end pt-1">
                <Button variant="primary" size="lg" onClick={handleBackendSave} disabled={backendBusy || !isElectron}>
                  <Save size={14} /> 연결 저장
                </Button>
              </div>
            </div>
          </section>

          {/* 앱 업데이트 카드 */}
          <UpdateCard isElectron={isElectron} />

          {!isElectron && (
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-start gap-1.5">
              <AlertCircle size={11} className="mt-px shrink-0" />
              <span>폴더·백엔드 설정은 데스크톱(Electron) 앱에서만 동작합니다. 브라우저 미리보기에서는 변경할 수 없습니다.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
