// ─────────────────────────────────────────────────────────────────────────────
// Pulse — 디자인 토큰 (JS 객체)
// globals.css 의 CSS 변수와 1:1 매칭됩니다. JS 에서 색을 계산하거나
// 차트 라이브러리에 색을 넘길 때 이 객체를 import 하세요.
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  light: {
    bg: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: 'rgba(244, 244, 245, 0.40)',
    border: '#e4e4e7',
    borderHover: '#d4d4d8',
    text: '#18181b',
    textMuted: '#71717a',
    textSubtle: '#a1a1aa',
    ok: '#10b981',
    warn: '#f59e0b',
    danger: '#ef4444',
    info: '#71717a',
  },
  dark: {
    bg: '#09090b',
    surface: '#18181b',
    surfaceMuted: 'rgba(24, 24, 27, 0.40)',
    border: '#27272a',
    borderHover: '#3f3f46',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    textSubtle: '#71717a',
    ok: '#34d399',
    warn: '#fbbf24',
    danger: '#f87171',
    info: '#a1a1aa',
  },
};

export const spacing = {
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
};

export const radius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '16px',
  full: '9999px',
};

export const shadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
  md: '0 4px 12px rgba(0, 0, 0, 0.06)',
  lg: '0 12px 32px rgba(0, 0, 0, 0.10)',
};

export const typography = {
  fontFamily: {
    sans:
      "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, " +
      "'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif",
    mono:
      "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace",
  },
  // 본문 12.5~13px, 제목 15~22px, 메트릭 32px — 대시보드 표준
  size: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '15px',
    xl: '17px',
    '2xl': '22px',
    metric: '32px',
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
};

// (제거됨) POLL_INTERVAL_SEC — 아무도 안 쓰는 데다 값(1시간)이 실제 수집 주기와 달랐다.
// 자동 수집 주기의 정본은 lib/store.jsx 의 SYNC_INTERVAL_MS.
