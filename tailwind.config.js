/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind 클래스 스캔 대상.
  // Electron Forge Vite 템플릿에서 렌더러는 src/ 아래에 위치합니다.
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'ui-monospace',
          'Menlo',
          'monospace',
        ],
      },
      keyframes: {
        'pulse-fade': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'pulse-fade': 'pulse-fade 0.3s ease',
      },
    },
  },
  plugins: [],
};
