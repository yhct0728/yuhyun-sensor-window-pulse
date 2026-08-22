// ─────────────────────────────────────────────────────────────────────────────
// Sparkline — 인라인 SVG 라인+에어리어 차트
// 24포인트 정도의 짧은 시계열에 최적화. status 에 따라 색상이 바뀜.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

export default function Sparkline({
  data,
  status = 'ok',
  width = 64,
  height = 22,
}) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [
    i * step,
    height - 2 - ((v - min) / range) * (height - 6),
  ]);
  const path = 'M ' + pts.map((p) => p.join(',')).join(' L ');
  const area = `${path} L ${width},${height} L 0,${height} Z`;

  const colorClass =
    status === 'danger'
      ? 'text-red-500 dark:text-red-400'
      : status === 'warn'
      ? 'text-amber-500 dark:text-amber-400'
      : 'text-zinc-400 dark:text-zinc-500';
  const gid = `spark-grad-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={colorClass}
    >
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.20" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} stroke="none" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
