// ─────────────────────────────────────────────────────────────────────────────
// updateService — 자동 업데이트 (GitHub Releases + update.electronjs.org)
//
// 흐름:
//   npm run publish  →  GitHub Releases 에 새 버전 업로드
//   설치본이 주기적으로 update.electronjs.org 조회  →  있으면 백그라운드 다운로드
//   다운로드 끝나면 사용자에게 "다시 시작할까요?" 안내  →  재시작 시 교체
//
// 전제 3가지 (하나라도 어긋나면 자동 갱신이 조용히 멈춘다):
//   1. 저장소가 **공개** — update.electronjs.org 가 비공개 저장소는 못 읽는다
//   2. **Squirrel 설치본**(Setup.exe)으로 설치 — 패키지 폴더의 exe 직접 실행은 불가
//   3. 릴리스가 draft 가 아님 — draft 는 업데이트 서버에 안 보인다
//
// 부트스트랩: 지금 설치된 1.1.0 에는 이 코드가 없으므로 스스로 갱신하지 못한다.
//   이 기능이 담긴 버전은 **한 번은 수동 설치**해야 하고, 그다음부터 자동이다.
// ─────────────────────────────────────────────────────────────────────────────
import { app, ipcMain, autoUpdater } from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

const REPO = 'yhct0728/yuhyun-sensor-window-pulse';
const CHECK_INTERVAL = '1 hour'; // update-electron-app 이 받는 문자열 형식

/**
 * 업데이트 상태. 렌더러(설정 페이지)가 update:status 로 읽어간다.
 * state: idle | checking | available | downloading | ready | none | error | unsupported
 */
const state = {
  state: 'idle',
  version: app.getVersion(),
  newVersion: null,
  error: null,
  reason: null,     // unsupported 일 때 왜 안 되는지
  lastCheckedAt: null,
};

/** 자동 갱신이 가능한 환경인지. 개발 모드/미설치본이면 false. */
function supportCheck() {
  if (!app.isPackaged) return { ok: false, reason: 'dev' };
  // Squirrel 설치본은 ...\AppData\Local\<AppName>\app-<version>\ 아래에서 실행된다.
  // 그 밖(압축 해제 폴더 등)이면 autoUpdater 가 동작하지 않는다.
  if (process.platform === 'win32' && !/[\\/]app-[\d.]+[\\/]/.test(process.execPath)) {
    return { ok: false, reason: 'not-installed' };
  }
  return { ok: true, reason: null };
}

/** autoUpdater 이벤트를 state 에 반영. updateElectronApp 이 안쪽에서 쓰는 것과 같은 객체다. */
function wireEvents() {
  autoUpdater.on('checking-for-update', () => {
    state.state = 'checking';
    state.error = null;
  });
  autoUpdater.on('update-available', () => {
    state.state = 'downloading';
  });
  autoUpdater.on('update-not-available', () => {
    state.state = 'none';
    state.lastCheckedAt = Date.now();
  });
  autoUpdater.on('update-downloaded', (_e, _notes, releaseName) => {
    state.state = 'ready';
    state.newVersion = releaseName || null;
    state.lastCheckedAt = Date.now();
    console.log(`[update] 새 버전 준비됨: ${releaseName} — 다시 시작하면 적용됩니다`);
  });
  autoUpdater.on('error', (err) => {
    state.state = 'error';
    state.error = err?.message || String(err);
    console.warn(`[update] 실패: ${state.error}`);
  });
}

/** 앱 시작 시 1회 호출. 자동 확인 루프를 건다(가능한 환경에서만). */
export function initAutoUpdate() {
  const sup = supportCheck();
  if (!sup.ok) {
    state.state = 'unsupported';
    state.reason = sup.reason;
    console.log(`[update] 자동 갱신 비활성 (${sup.reason})`);
    return;
  }
  wireEvents();
  try {
    updateElectronApp({
      updateSource: { type: UpdateSourceType.ElectronPublicUpdateService, repo: REPO },
      updateInterval: CHECK_INTERVAL,
      logger: console,
      notifyUser: true, // 다운로드 끝나면 "지금 다시 시작" 안내 대화상자
    });
    console.log(`[update] 자동 갱신 활성 — ${REPO}, ${CHECK_INTERVAL} 주기`);
  } catch (err) {
    state.state = 'error';
    state.error = err?.message || String(err);
    console.warn(`[update] 초기화 실패: ${state.error}`);
  }
}

/** 지금 확인 (설정 페이지의 "업데이트 확인" 버튼). */
function checkNow() {
  const sup = supportCheck();
  if (!sup.ok) return { ...state, state: 'unsupported', reason: sup.reason };
  try {
    autoUpdater.checkForUpdates();
    state.state = 'checking';
  } catch (err) {
    state.state = 'error';
    state.error = err?.message || String(err);
  }
  return { ...state };
}

/** 받아둔 새 버전으로 지금 재시작. ready 상태에서만 의미 있다. */
function restartNow() {
  if (state.state !== 'ready') return { ok: false, error: 'not-ready' };
  autoUpdater.quitAndInstall();
  return { ok: true };
}

/** IPC 등록. main.js 의 app.whenReady 에서 1회 호출. */
export function registerUpdateIpc() {
  ipcMain.handle('update:status', () => ({ ...state }));
  ipcMain.handle('update:check', () => checkNow());
  ipcMain.handle('update:restart', () => restartNow());
}
