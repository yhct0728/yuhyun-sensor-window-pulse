// ─────────────────────────────────────────────────────────────────────────────
// useDarkMode — Tailwind class strategy 기반 다크모드 훅
//
// 사용법:
//   const [dark, setDark] = useDarkMode();
//   <button onClick={() => setDark(!dark)}>...</button>
//
// 동작:
//   - localStorage('pulse:theme') 에서 초기값을 읽음 (없으면 light)
//   - dark === true 일 때 <html> 에 `dark` 클래스 부착
//   - 변경 시 localStorage 에 다시 저장
//
// TODO: Electron 이식 시 — OS 다크모드와 연동하려면
//   nativeTheme.shouldUseDarkColors 를 preload 에서 노출하고
//   window.electronAPI.onThemeChange(callback) 로 구독.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pulse:theme';

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      window.localStorage.setItem(STORAGE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem(STORAGE_KEY, 'light');
    }
  }, [dark]);

  return [dark, setDark];
}
