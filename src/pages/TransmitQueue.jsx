// ─────────────────────────────────────────────────────────────────────────────
// TransmitQueue — 전송 큐 페이지 §5
//   인제스트 연결 카드 + 요약5 + 큐 테이블 + 빈 상태
//   현장-블라인드: 페이로드엔 노드 ID·채널·ts·값만. 현장 stamp 는 백엔드.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { Send, Wifi, RefreshCw, ChevronRight } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { TxPill } from '../components/ui/StatusPill.jsx';
import { usePulse } from '../lib/store.jsx';
import { TX_RANK } from '../lib/reception.js';
import { timeAgo, fmtNum, fmtDateTime } from '../lib/format.js';
import { showToast } from '../components/ui/Toast.jsx';

export default function TransmitQueue({ dark, setDark, onOpenNode }) {
  const { nodes, ingest, retryNode, retryAll } = usePulse();

  const sum = useMemo(() => {
    const s = { sent: 0, queued: 0, retry: 0, failed: 0, buffer: 0 };
    for (const n of nodes) {
      s[n.transmit] = (s[n.transmit] || 0) + 1;
      s.buffer += n.buffer || 0;
    }
    return s;
  }, [nodes]);

  const pending = sum.queued + sum.retry + sum.failed;
  const queue = useMemo(
    () => [...nodes].sort((a, b) => TX_RANK[a.transmit] - TX_RANK[b.transmit]),
    [nodes],
  );

  return (
    <>
      <PageHeader
        title="전송 큐"
        subtitle="노드별 로우데이터를 백엔드 인제스트 계층으로 전송하는 상태"
        dark={dark}
        setDark={setDark}
        actions={
          pending > 0 && (
            <Button variant="primary" size="md" onClick={() => { retryAll(); showToast('전체 재전송을 요청했습니다'); }}>
              <RefreshCw size={15} /> 전체 재전송
            </Button>
          )
        }
      />

      <div className="flex-1 px-6 py-5 overflow-y-auto space-y-5">
        {/* 인제스트 연결 카드 */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-3">
          <span className={`inline-grid place-items-center w-9 h-9 rounded-md shrink-0 ${ingest.status === 'connected' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
            <Wifi size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
              인제스트 {ingest.status === 'connected' ? '연결됨' : '미연결'}
            </div>
            <div className="text-[11.5px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
              {ingest.endpoint || '엔드포인트 미설정 — 설정에서 지정'}
            </div>
          </div>
          <div className="flex items-center gap-5 shrink-0 text-right">
            <div>
              <div className="text-[10.5px] text-zinc-400">지연</div>
              <div className="text-[13px] font-medium tabular-nums text-zinc-700 dark:text-zinc-200">{ingest.latency}</div>
            </div>
            <div>
              <div className="text-[10.5px] text-zinc-400">마지막 ack</div>
              <div className="text-[13px] font-medium tabular-nums text-zinc-700 dark:text-zinc-200">{ingest.lastAck}</div>
            </div>
          </div>
        </div>

        {/* 요약 5 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ['전송 완료', sum.sent],
            ['버퍼 대기', sum.queued],
            ['재전송', sum.retry],
            ['전송 실패', sum.failed],
            ['총 버퍼 행', fmtNum(sum.buffer, 0)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{k}</div>
              <div className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">{v}</div>
            </div>
          ))}
        </div>

        {/* 큐 테이블 / 빈 상태 */}
        {nodes.length === 0 ? (
          <EmptyState
            icon={Send}
            title="전송 대기 중인 데이터가 없습니다"
            desc={'노드를 등록하면 노드별 전송 상태가 여기에 표시됩니다.'}
            dashed
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 text-left">
                  {['전송 상태', '노드 ID', '버퍼 행', '재전송', '24시간 수신', '마지막 수신', '액션'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((n) => (
                  <tr
                    key={n.id}
                    className={`border-t border-zinc-100 dark:border-zinc-800/70 ${n.transmit === 'failed' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
                  >
                    <td className="px-3 py-2.5"><TxPill transmit={n.transmit} count={n.transmit === 'queued' ? n.buffer : n.retry} /></td>
                    <td className="px-3 py-2.5 font-mono font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      <button onClick={() => onOpenNode?.(n.id)} className="hover:underline inline-flex items-center gap-1">
                        {n.id}<ChevronRight size={12} className="text-zinc-300 dark:text-zinc-600" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-300">{fmtNum(n.buffer, 0)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-300">{fmtNum(n.retry, 0)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-600 dark:text-zinc-300">{fmtNum(n.rows24h, 0)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-500 dark:text-zinc-400 whitespace-nowrap"><span title={timeAgo(n.lastRx)}>{fmtDateTime(n.lastRx)}</span></td>
                    <td className="px-3 py-2.5">
                      {n.transmit !== 'sent' && (
                        <Button variant="secondary" size="sm" onClick={() => { retryNode(n.id); showToast(`${n.id} 재전송 요청`); }}>
                          재전송
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-zinc-400">
          전송 페이로드엔 노드 ID·채널·타임스탬프·값만 담깁니다. 현장 stamp 는 백엔드가 부여합니다.
        </p>
      </div>
    </>
  );
}
