// ─────────────────────────────────────────────────────────────────────────────
// useTick — 주기적으로 현재 시각을 갱신해 상대시간 표시("2분 전")를 살아있게 한다.
//
// 사용법:
//   const now = useTick(10_000);
//   <span>{timeAgo(lastSyncAt, now)}</span>
//
// 배경: 이 훅은 usePolling(삭제됨)을 대체한다. usePolling 은 "다음 폴링까지 mm:ss"
//   카운트다운을 그렸지만 0이 되어도 아무것도 트리거하지 않는 장식이었고,
//   nodes[0].intervalMin 하나만 보고 만들어져 노드가 여러 대면 무의미했다.
//   실제 수집은 App.jsx 의 SYNC_INTERVAL_MS 고정 타이머가 담당한다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

/**
 * @param {number} [everyMs] 갱신 간격(ms). 기본 10초 — timeAgo 가 분 단위라 충분하다.
 * @returns {number} 현재 시각(epoch ms)
 */
export function useTick(everyMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);

  return now;
}
