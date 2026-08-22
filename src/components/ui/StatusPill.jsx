// ─────────────────────────────────────────────────────────────────────────────
// StatusPill — 수신(Reception) / 전송(Transmit) 상태 표현 (현장-블라인드 v2)
//
// 안전 판정용 Badge.jsx 의 StatusPill 과는 별개입니다(그건 정상/의심/오류).
// 여기서는 §8 규칙대로 수신중/지연/끊김, 전송완료/버퍼/재전송/실패만 다룹니다.
//   - 수신중/전송완료 = 에메랄드(액센트, live 는 ping)
//   - 지연/재전송 = 앰버, 끊김/실패 = 레드, 버퍼대기 = 무채색
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { RX_META, TX_META } from '../../lib/reception.js';

/** 수신 상태 점 (테이블 셀 등 컴팩트 표시용). live 면 ping 애니메이션. */
export function RxDot({ reception, size = 'md' }) {
  const meta = RX_META[reception] || RX_META.lost;
  const s = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  return (
    <span className={`relative inline-flex shrink-0 ${s}`}>
      {meta.ping && (
        <span
          className={`absolute inset-0 rounded-full ${meta.dot} opacity-60 animate-ping`}
        />
      )}
      <span className={`relative inline-block rounded-full w-full h-full ${meta.dot}`} />
    </span>
  );
}

/** 수신 상태 핀(pill). */
export function RxPill({ reception }) {
  const meta = RX_META[reception] || RX_META.lost;
  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset tabular-nums ${meta.pill}`}
    >
      <RxDot reception={reception} size="sm" />
      <span>{meta.label}</span>
    </span>
  );
}

/** 원본 파일이 사라진 노드(tombstone) 표시 핀. */
export function TombstoneBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset bg-zinc-100 text-zinc-500 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-600 tabular-nums">
      원본 없음
    </span>
  );
}

/** 등록 후 원본 .txt 형식이 깨진 노드 표시 핀(낙서·표 깨짐 등). 전송 중단됨. */
export function FormatErrorBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900 tabular-nums">
      형식 오류
    </span>
  );
}

/** 전송 상태 핀(pill). count 는 버퍼/재전송/실패 수. */
export function TxPill({ transmit, count }) {
  const meta = TX_META[transmit] || TX_META.queued;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset tabular-nums ${meta.pill}`}
    >
      {meta.label(count)}
    </span>
  );
}
