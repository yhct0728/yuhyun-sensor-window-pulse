// ─────────────────────────────────────────────────────────────────────────────
// Vite + React 진입점
// Electron 메인 프로세스에서 BrowserWindow.loadURL/loadFile 로 이 index.html
// 을 로드하면 여기서부터 렌더러가 시작됩니다.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
