import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerFolderIpc } from './folderService.js';
import { initAutoUpdate, registerUpdateIpc } from './updateService.js';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  // 기준 해상도 1440×900 (README §8 — Electron BrowserWindow 기본).
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  // 개발/테스트 시드: PULSE_AUTOIMPORT 가 설정되면 렌더러에 ?test=import 를 실어
  // 감시 폴더의 더미 .txt 를 부팅 직후 헤드리스 자동 등록한다(운영 무관).
  const seed = process.env.PULSE_AUTOIMPORT ? 'test=import' : '';
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(seed ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}?${seed}` : MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      seed ? { search: seed } : undefined,
    );
  }

  // DevTools 는 **개발 중에만** 자동으로 연다. 자동 업데이트로 배포되는 설치본에서
  // 매 실행마다 열리면 사용자에게 방해가 된다. (필요하면 Ctrl+Shift+I)
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerFolderIpc(); // 데이터 폴더 IPC 핸들러 등록
  registerUpdateIpc(); // 자동 업데이트 IPC 핸들러 등록
  createWindow();
  initAutoUpdate();    // 설치본에서만 동작 — 개발/미설치본이면 조용히 비활성

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
