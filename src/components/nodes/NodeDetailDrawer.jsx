// ─────────────────────────────────────────────────────────────────────────────
// NodeDetailDrawer — 노드 상세 (우측 슬라이드 드로어, 560px) §3-A
//   헤더(노드 ID·모델·수신 배지 + 메타) + 탭3(채널 스트림 / 전송 큐 / 진단 로그)
// 현장-블라인드: 현장 정보·안전 판정 없음. 수신·전송·통신 로그만.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import {
  X, Cpu, Activity, UploadCloud, ScrollText, RefreshCw, Trash2, Wifi, AlertCircle, MapPin, Save, CopyPlus,
} from 'lucide-react';
import Button from '../ui/Button.jsx';
import Select from '../ui/Select.jsx';
import { RxPill, TxPill } from '../ui/StatusPill.jsx';
import { usePulse, rangeKey } from '../../lib/store.jsx';
import { seriesSummary } from '../../lib/series.js';
import { sensorTypeLabel, DELETE_ERROR_MESSAGE, SENSOR_LIFECYCLE, lifecycleLabel, SENSOR_TYPES, sensorTypeUnit } from '../../lib/backendApi.js';
import * as folderApi from '../../lib/folderApi.js';
import { timeAgo, intervalLabel, fmtNum, fmtDateTime } from '../../lib/format.js';
import { showToast } from '../ui/Toast.jsx';

const TABS = [
  { id: 'stream', label: '채널 스트림', icon: Activity },
  { id: 'queue', label: '전송 큐', icon: UploadCloud },
  { id: 'log', label: '진단 로그', icon: ScrollText },
];

// 수신 주기 선택지(분) — 등록 위저드와 동일. 통상 1일 기본, 1시간 흔함.
const INTERVAL_OPTS = [10, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080].map((m) => ({
  value: String(m),
  label: intervalLabel(m),
}));

export default function NodeDetailDrawer({ node, onClose }) {
  const { ingest, syncNode, flushNode, deleteNode, setSensorLifecycle, updateNodeInterval, updateMonitoringFrom, channelRanges, setChannelRange, saveChannelRanges, setChannelSensorType } = usePulse();
  const [tab, setTab] = useState('stream');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [savingRanges, setSavingRanges] = useState(false);
  const [savingMon, setSavingMon] = useState(false);

  useEffect(() => {
    if (!node) return;
    setTab('stream');
    setConfirming(false);
    setDeleting(false);
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [node, onClose]);

  if (!node) return null;

  // 노드 영구 삭제 — 백엔드(DELETE)가 배치/데이터 보호를 강제. 펄스는 호출 후 응답대로 처리.
  const handleDelete = async () => {
    const id = node.id;
    // 비-Electron(브라우저/프리뷰): 백엔드 없음 → 메모리에서만 제거
    if (!folderApi.isElectron()) {
      deleteNode(id);
      showToast(`${id} 삭제(메모리)`);
      onClose?.();
      return;
    }
    setDeleting(true);
    const r = await folderApi.deleteNodeBackend(id);
    setDeleting(false);
    if (r?.ok) {
      deleteNode(id);
      showToast(r.message || `${id} 삭제 완료`);
      onClose?.();
      return;
    }
    // 실패 — 사유 로그 + 안내. 'rejected'(배치/데이터)면 보호되어 목록 유지.
    console.warn('[node-delete] 실패', id, r);
    if (r?.error === 'not_found' || r?.error === 'unconfigured' || r?.error === 'no_electron') {
      // 백엔드에 없거나 미설정 → 펄스 목록에서만 정리
      deleteNode(id);
      showToast(`${id} 목록에서 제거 · ${DELETE_ERROR_MESSAGE[r.error] || ''}`);
      onClose?.();
      return;
    }
    showToast(r?.message || DELETE_ERROR_MESSAGE[r?.error] || `${id} 삭제 실패`);
    setConfirming(false);
  };

  // 기록 간격 변경 → 로컬 즉시 반영 + 백엔드 저장(interval_min).
  // ⚠️ 수집 빈도가 아니다 — 수집은 SYNC_INTERVAL_MS 고정. 이 값은 지연/끊김 판정 기준.
  const onChangeInterval = async (min) => {
    if (min === node.intervalMin) return;
    setSavingInterval(true);
    const r = await updateNodeInterval(node.id, min);
    setSavingInterval(false);
    if (r?.ok && !r.local) showToast(`기록 간격 → ${intervalLabel(min)} (백엔드 저장)`);
    else if (r?.local) showToast(`기록 간격 → ${intervalLabel(min)} (메모리 · 백엔드 미연결)`);
    else if (r?.error === 'unconfigured') showToast(`기록 간격 변경(메모리) · 백엔드 미설정`);
    else showToast(`기록 간격 변경(메모리) · 백엔드 저장 실패`);
  };

  // 운영 시작일 변경 → 로컬 즉시 반영 + 백엔드 POST /nodes(monitoring_from). 빈값=해제(null).
  const onChangeMonitoringFrom = async (dateStr) => {
    const iso = dateStr ? `${dateStr}T00:00:00+09:00` : null;
    setSavingMon(true);
    const r = await updateMonitoringFrom(node.id, iso);
    setSavingMon(false);
    if (r?.ok && !r.local) showToast(iso ? `운영 시작일 → ${dateStr} (백엔드 저장)` : '운영 시작일 해제 (백엔드 저장)');
    else if (r?.local) showToast(`운영 시작일 변경 (메모리 · 백엔드 미연결)`);
    else if (r?.error === 'no_sensor_type') showToast('계측기 종류가 없어 저장할 수 없습니다');
    else if (r?.error === 'unconfigured') showToast('운영 시작일 변경(메모리) · 백엔드 미설정');
    else showToast('운영 시작일 변경(메모리) · 백엔드 저장 실패');
  };

  // 정상범위 저장 → 백엔드(POST /nodes, 같은 node_code 로 valid_min/max 갱신). 화면값 그대로 전송.
  // 판정은 백엔드 — 펄스는 raw 글리치 컷 기준만 보냄.
  const onSaveRanges = async () => {
    setSavingRanges(true);
    let r;
    try {
      r = await saveChannelRanges(node);
    } catch (e) {
      r = { ok: false, error: 'ipc', message: String(e?.message || e) };
    } finally {
      setSavingRanges(false); // 무슨 일이 있어도 "저장 중" 해제
    }
    if (r?.ok) showToast('정상범위를 백엔드에 저장했습니다');
    else if (r?.error === 'no_sensor_type') showToast('계측기 종류가 없어 저장할 수 없습니다');
    else if (r?.error === 'ipc') showToast('저장 기능이 아직 로드되지 않았습니다 — 앱을 재시작하세요');
    else if (r?.error === 'unconfigured' || r?.error === 'no_electron') showToast('백엔드 미설정 — 설정에서 연결하세요');
    else if (r?.error === 'unauthorized') showToast('인증 실패(401) — API 키를 확인하세요');
    else showToast('정상범위 저장 실패 — 다시 시도하세요');
  };

  // 채널별 계측 종류 변경 → 로컬 즉시 + 백엔드 POST /nodes(additive). 단위는 종류 기본값 자동.
  const onSetChannelType = async (channelCode, type) => {
    const r = await setChannelSensorType(node.id, channelCode, type);
    if (r?.ok && !r.local) showToast(`${channelCode} 종류 → ${type ? sensorTypeLabel(type) : '노드 대표'} (백엔드 저장)`);
    else if (r?.local) showToast(`${channelCode} 종류 변경 (메모리 · 백엔드 미연결)`);
    else if (r?.error === 'no_sensor_type') showToast('노드 대표 계측기 종류가 없어 저장할 수 없습니다');
    else if (r?.error === 'unconfigured') showToast(`${channelCode} 종류 변경(메모리) · 백엔드 미설정`);
    else showToast('채널 종류 변경(메모리) · 백엔드 저장 실패');
  };

  // 센서 생명주기 변경 (정상/비활성) → 백엔드 PATCH. inactive 는 백엔드 평균·offline 추론에서 제외(sticky).
  const onSetLifecycle = async (channelCode, status) => {
    const r = await setSensorLifecycle(node.id, channelCode, status);
    if (r?.ok) showToast(`${channelCode} → ${lifecycleLabel(status)}`);
    else if (r?.error === 'unconfigured' || r?.error === 'no_electron') showToast('백엔드 미설정 — 상태 전송 불가');
    else if (r?.error === 'not_found') showToast(`${channelCode} 백엔드에 센서가 없습니다(404)`);
    else showToast('상태 변경 실패 — 다시 시도하세요');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-zinc-950/40 dark:bg-zinc-950/70 backdrop-blur-sm" />
      <aside
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-[560px] max-w-full h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
        style={{ animation: 'pulse-slide-left 0.2s ease both' }}
      >
        {/* 헤더 */}
        <div className="px-5 pt-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-grid place-items-center w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
                <Cpu size={18} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-[16px] text-zinc-900 dark:text-zinc-50">{node.id}</span>
                  {node.name && node.name !== node.id && <span className="text-[13px] text-zinc-500 dark:text-zinc-400 truncate">{node.name}</span>}
                  <RxPill reception={node.reception} />
                </div>
                <div className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate">
                  {node.sensorType ? `${sensorTypeLabel(node.sensorType)} · ` : ''}{node.model} · {node.type}
                </div>
                {/* 배치 현장 (읽기 전용 — 백엔드가 정함, 펄스는 표시만) */}
                <div className="mt-1 flex items-center gap-1.5 text-[11.5px]">
                  <MapPin size={12} className="text-zinc-400 shrink-0" />
                  {node.siteName ? (
                    <span className="text-zinc-600 dark:text-zinc-300 truncate">{node.siteName}</span>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500">미배치</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="inline-grid place-items-center w-7 h-7 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0">
              <X size={15} />
            </button>
          </div>
          {/* 메타 — "마지막 데이터"와 "파일 저장"을 나란히. 두 값이 갈라지면 그 자체가 진단이다:
              둘 다 옛날 = 로거가 멈춤 / 파일 저장만 최신 = 로거는 도는데 센서가 값을 못 줌 */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[
              ['채널', node.series ? `프로파일 ${node.series.count}점` : `${node.chans.length}`],
              ['마지막 데이터', fmtDateTime(node.lastRx), `.txt 안 마지막 줄의 시각 — 센서가 실제로 준 값 (${timeAgo(node.lastRx)})`],
              ['파일 저장', fmtDateTime(node.lastFileWrite), `로거가 이 파일을 마지막으로 건드린 시각 (${timeAgo(node.lastFileWrite)})`],
            ].map(([k, v, tip]) => (
              <div key={k} className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-1.5" title={tip || undefined}>
                <div className="text-[10.5px] text-zinc-400">{k}</div>
                <div className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200 truncate tabular-nums">{v}</div>
              </div>
            ))}
            {/* 기록 간격 — 인라인 편집(지연·끊김 판정 기준, 백엔드 저장). 수집 빈도가 아님. */}
            <div className="px-0.5">
              <div
                className="text-[10.5px] text-zinc-400 mb-0.5"
                title="이 장비가 값을 기록하는 간격입니다. 이보다 늦어지면 지연·끊김으로 표시됩니다. 수집은 이 설정과 무관하게 항상 1분마다 돕니다."
              >
                기록 간격{savingInterval ? ' · 저장중' : ''}
              </div>
              <Select
                value={String(node.intervalMin)}
                onChange={(v) => onChangeInterval(Number(v))}
                options={INTERVAL_OPTS}
              />
            </div>
          </div>
          {/* 운영 시작일 — 이 날짜 이전 데이터는 백엔드 분석/고장의심/기본차트 제외(raw 보존). 비우면 해제. */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10.5px] text-zinc-400 shrink-0">운영 시작일{savingMon ? ' · 저장중' : ''}</span>
            <input
              type="date" aria-label="운영 시작일"
              value={(node.monitoringFrom || '').slice(0, 10)}
              onChange={(e) => onChangeMonitoringFrom(e.target.value)}
              className="h-7 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] tabular-nums text-zinc-800 dark:text-zinc-100"
            />
            <span className="text-[10.5px] text-zinc-400 truncate">시운전 완료 시점 · 이전 데이터는 분석 제외</span>
          </div>
        </div>

        {/* 탭 */}
        <div className="px-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-1 -mb-px">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-9 text-[12.5px] font-medium border-b-2 transition-colors duration-150 ${
                    active
                      ? 'border-emerald-500 text-zinc-900 dark:text-zinc-50'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Icon size={13.5} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {node.tombstone && (
            <div className="mb-3 flex items-start gap-2 rounded-md px-3 py-2.5 text-[12px] ring-1 ring-inset bg-zinc-100 text-zinc-600 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-600">
              <AlertCircle size={14} className="mt-px shrink-0" />
              <div>
                <div className="font-medium">원본 파일이 없습니다</div>
                <div className="opacity-80">이름이 바뀌었거나 삭제됐을 수 있어요. 새 파일은 감지·등록 탭에서 다시 등록하거나, 아래에서 이 노드를 삭제하세요. (수집은 중단된 상태)</div>
              </div>
            </div>
          )}
          {!node.tombstone && node.formatError && (
            <div className="mb-3 flex items-start gap-2 rounded-md px-3 py-2.5 text-[12px] ring-1 ring-inset bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
              <AlertCircle size={14} className="mt-px shrink-0" />
              <div>
                <div className="font-medium">원본 형식이 깨졌습니다</div>
                <div className="opacity-80">표 형식이 아니게 됐어요(낙서·열 손상 등). 형식이 정상으로 돌아오면 자동으로 전송을 재개합니다. (그 전까지 전송 중단)</div>
              </div>
            </div>
          )}
          {tab === 'stream' && <ChannelStream node={node} onSetLifecycle={onSetLifecycle} onSetChannelType={onSetChannelType} channelRanges={channelRanges} setChannelRange={setChannelRange} onSaveRanges={onSaveRanges} savingRanges={savingRanges} />}
          {tab === 'queue' && (
            <TransmitPanel
              node={node}
              ingest={ingest}
              onRetry={async () => {
                const r = await syncNode(node);
                if (r?.skipped) showToast('원본 파일이 없어 전송할 수 없습니다');
                else if (r?.error === 'unconfigured') showToast('백엔드 미설정 — 설정에서 연결하세요');
                else if (!r?.ok) showToast('전송 실패 — 다시 시도하세요');
                else showToast(r.sent ? `측정값 ${r.sent}건 전송` : '전송할 새 데이터가 없습니다');
              }}
              onFlush={() => { flushNode(node.id); showToast('버퍼를 비웠습니다'); }}
            />
          )}
          {tab === 'log' && <DiagnosticLog node={node} />}
        </div>

        {/* 푸터 — 노드 영구 삭제 */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-zinc-600 dark:text-zinc-300 flex-1 min-w-0">
                이 노드를 영구 삭제할까요? 현장 배치·데이터가 없을 때만 삭제됩니다.
              </span>
              <Button variant="secondary" size="md" onClick={() => setConfirming(false)} disabled={deleting}>
                취소
              </Button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-600 hover:bg-red-700 text-white text-[13px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <Trash2 size={14} /> {deleting ? '삭제 중…' : '영구 삭제'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 size={14} /> 노드 삭제
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

// 센서 생명주기 선택 (정상/비활성). 컴팩트 드롭다운.
function LifecycleSelect({ value, onChange }) {
  return <Select value={value || 'active'} onChange={onChange} options={SENSOR_LIFECYCLE} className="w-24 shrink-0" />;
}

// 채널별 계측 종류 선택 (노드 1개에 종류 혼재). 빈값=노드 대표 종류 폴백.
const CH_TYPE_OPTS = [{ value: '', label: '(노드 대표)' }, ...SENSOR_TYPES.map((t) => ({ value: t.code, label: t.label }))];
function ChannelTypeSelect({ value, onChange }) {
  return <Select value={value || ''} onChange={onChange} options={CH_TYPE_OPTS} placeholder="(노드 대표)" className="w-32 shrink-0" />;
}

// ── 채널 스트림 ──────────────────────────────────────────────────────────────
function ChannelStream({ node, onSetLifecycle, onSetChannelType, channelRanges, setChannelRange, onSaveRanges, savingRanges }) {
  return (
    <div className="space-y-4">
      {/* 센서 — 채널별 계측 종류(노드 1개에 종류 혼재) + 생명주기(고장/비활성) */}
      <section>
        <h4 className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2">
          센서 <span className="normal-case text-zinc-300 dark:text-zinc-600">— 채널별 계측 종류 · 고장 시 비활성</span>
        </h4>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {node.chans.map((c) => {
            const off = c.lifecycle && c.lifecycle !== 'active';
            return (
              <div key={c.ch} className="flex items-center gap-2 px-3 py-2">
                <span className={`font-mono text-[12px] w-16 shrink-0 truncate ${off ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {c.code}
                </span>
                <div className="flex-1 min-w-0">
                  <ChannelTypeSelect value={c.sensorType || ''} onChange={(v) => onSetChannelType?.(c.code, v)} />
                </div>
                <span className="text-[10.5px] text-zinc-400 w-8 shrink-0 text-right tabular-nums">{sensorTypeUnit(c.sensorType) || c.unit || '—'}</span>
                <LifecycleSelect value={c.lifecycle === 'active' ? 'active' : 'inactive'} onChange={(v) => onSetLifecycle?.(c.code, v)} />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">
          채널마다 계측 종류를 지정합니다(빈값=노드 대표 종류). 백엔드는 같은 종류·단위끼리만 평균을 냅니다. "비활성"은 고장/배터리로 멈춘 센서 — 평균·offline·전송에서 제외, 복구 시 "정상".
        </p>
      </section>

      <ValidRangeSection node={node} channelRanges={channelRanges} setChannelRange={setChannelRange} onSaveRanges={onSaveRanges} savingRanges={savingRanges} />

      {node.series && <DepthProfile node={node} />}
    </div>
  );
}

// ── 정상 범위(raw 글리치 컷) ─────────────────────────────────────────────────
// 펄스는 입력·전송만. 범위 밖 raw 값 판정(invalid)은 백엔드가 수행 — 로컬 이상치 표시 없음.
function ValidRangeSection({ node, channelRanges, setChannelRange, onSaveRanges, savingRanges }) {
  // fill-down: 한 행의 범위를 노드 전체 채널에 복사(기존 값 덮어쓰기). 로컬만 갱신 — 저장은 "정상범위 저장".
  const applyToAll = (range) => {
    node.chans.forEach((c) => setChannelRange?.(node.id, c.code, range));
    showToast(`${node.chans.length}개 채널에 정상범위를 적용했습니다`);
  };
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
          정상 범위 <span className="normal-case text-zinc-300 dark:text-zinc-600">— 범위 밖 raw 는 백엔드가 자동 무효 처리(값은 그대로 전송)</span>
        </h4>
        <Button variant="secondary" size="sm" onClick={onSaveRanges} disabled={savingRanges}>
          <Save size={13} /> {savingRanges ? '저장 중…' : '정상범위 저장'}
        </Button>
      </div>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/70">
        {node.chans.map((c) => (
          <RangeRow
            key={c.ch}
            chan={c}
            range={channelRanges?.[rangeKey(node.id, c.code)]}
            onCommit={(r) => setChannelRange?.(node.id, c.code, r)}
            onApplyAll={applyToAll}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">
        물리적으로 불가능한 raw 만 보수적으로 잡으세요(예: 평소 8000대인데 0). 너무 좁히면 진짜 실측까지 무효 처리됩니다. 비워두면 검사하지 않습니다 · 과거 데이터엔 소급 안 됨.
      </p>
    </section>
  );
}

// 한 채널의 범위 입력 행. 블러/Enter 시 커밋, 하한>상한·비숫자는 인라인 경고. 판정 표시 없음(설정됨/검사 안 함).
function RangeRow({ chan, range, onCommit, onApplyAll }) {
  const [min, setMin] = useState(range?.min != null ? String(range.min) : '');
  const [max, setMax] = useState(range?.max != null ? String(range.max) : '');
  const [err, setErr] = useState('');

  useEffect(() => {
    setMin(range?.min != null ? String(range.min) : '');
    setMax(range?.max != null ? String(range.max) : '');
  }, [range?.min, range?.max]);

  // 현재 입력값 파싱·검증 → 유효하면 { min, max }, 아니면 null(에러 표시). commit·전체적용 공용.
  const parseRange = () => {
    const parse = (s) => {
      const t = String(s).trim();
      if (t === '') return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : NaN;
    };
    const mn = parse(min);
    const mx = parse(max);
    if (Number.isNaN(mn) || Number.isNaN(mx)) { setErr('숫자를 입력하세요'); return null; }
    if (mn != null && mx != null && mn > mx) { setErr('하한이 상한보다 큽니다'); return null; }
    setErr('');
    return { min: mn, max: mx };
  };

  const commit = () => {
    const r = parseRange();
    if (r) onCommit?.(r);
  };

  // 이 행 값을 노드 전체 채널에 적용(덮어쓰기). 둘 다 비면 막음.
  const applyAll = () => {
    const r = parseRange();
    if (r && (r.min != null || r.max != null)) onApplyAll?.(r);
  };
  const canApply = min.trim() !== '' || max.trim() !== '';

  const checked = (range?.min ?? null) != null || (range?.max ?? null) != null;
  const inputCls =
    'w-16 h-7 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[12px] tabular-nums text-zinc-800 dark:text-zinc-100';

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300 w-16 shrink-0 truncate">{chan.code}</span>
        <span className="text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400 w-16 shrink-0 text-right">
          {chan.value == null ? '—' : fmtNum(chan.value)}
        </span>
        <input
          type="number" inputMode="decimal" aria-label={`${chan.code} 하한`} placeholder="하한"
          value={min} onChange={(e) => setMin(e.target.value)} onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()} className={inputCls}
        />
        <span className="text-zinc-300 dark:text-zinc-600 text-[12px]">~</span>
        <input
          type="number" inputMode="decimal" aria-label={`${chan.code} 상한`} placeholder="상한"
          value={max} onChange={(e) => setMax(e.target.value)} onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()} className={inputCls}
        />
        <span className="text-[11px] text-zinc-400 w-8 shrink-0 truncate">{chan.unit || ''}</span>
        <button
          type="button"
          onClick={applyAll}
          disabled={!canApply}
          title="이 범위를 노드 전체 채널에 적용"
          aria-label={`${chan.code} 범위를 전체 채널에 적용`}
          className="shrink-0 p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
        >
          <CopyPlus size={14} />
        </button>
        <span className="flex-1" />
        {checked ? (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0">설정됨</span>
        ) : (
          <span className="text-[11px] text-zinc-300 dark:text-zinc-600 shrink-0">검사 안 함</span>
        )}
      </div>
      {err && <div className="mt-1 text-[10.5px] text-red-600 dark:text-red-400">{err}</div>}
    </div>
  );
}

// ── 깊이 프로파일(시리즈) ────────────────────────────────────────────────────
function DepthProfile({ node }) {
  const s = node.series;
  const vUnit = s.valueUnit || node.chans[0]?.unit || '';
  const pts = s.points
    .map((p, i) => ({ pos: p.pos, value: Number(node.chans[i]?.value) }))
    .filter((p) => Number.isFinite(p.value));

  const W = 480, H = 300, padL = 46, padR = 14, padT = 12, padB = 30;
  const depths = s.points.map((p) => p.pos);
  const dMin = Math.min(...depths), dMax = Math.max(...depths);
  let vMin = pts.length ? Math.min(...pts.map((p) => p.value)) : 0;
  let vMax = pts.length ? Math.max(...pts.map((p) => p.value)) : 1;
  if (vMin === vMax) { vMin -= 1; vMax += 1; }
  const x = (v) => padL + ((v - vMin) / (vMax - vMin)) * (W - padL - padR);
  const y = (d) => padT + ((d - dMin) / (dMax - dMin || 1)) * (H - padT - padB);
  const line = pts.length ? 'M ' + pts.map((p) => `${x(p.value).toFixed(1)},${y(p.pos).toFixed(1)}`).join(' L ') : '';

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">깊이 프로파일</h4>
        <span className="text-[11px] font-mono text-zinc-400 tabular-nums">{seriesSummary(s)}</span>
      </div>
      {pts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 px-3 py-8 text-center text-[12px] text-zinc-400">
          수신된 값이 없어 프로파일을 표시할 수 없습니다
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2">
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="text-emerald-500 dark:text-emerald-400">
            {/* 축 */}
            <line x1={padL} y1={padT} x2={padL} y2={H - padB} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth="1" />
            <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth="1" />
            {/* 0 기준선 */}
            {vMin < 0 && vMax > 0 && (
              <line x1={x(0)} y1={padT} x2={x(0)} y2={H - padB} className="stroke-zinc-300 dark:stroke-zinc-600" strokeWidth="1" strokeDasharray="3 3" />
            )}
            {/* 프로파일 라인 */}
            <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={x(p.value)} cy={y(p.pos)} r="2" fill="currentColor" />
            ))}
            {/* 라벨 */}
            <text x={padL} y={H - padB + 16} className="fill-zinc-400 text-[9px]" textAnchor="middle">{vMin.toFixed(1)}</text>
            <text x={W - padR} y={H - padB + 16} className="fill-zinc-400 text-[9px]" textAnchor="end">{vMax.toFixed(1)}{vUnit && ` ${vUnit}`}</text>
            <text x={padL - 6} y={y(dMin) + 3} className="fill-zinc-400 text-[9px]" textAnchor="end">{dMin}{s.axisUnit}</text>
            <text x={padL - 6} y={y(dMax) + 3} className="fill-zinc-400 text-[9px]" textAnchor="end">{dMax}{s.axisUnit}</text>
          </svg>
          <div className="flex items-center justify-between px-2 pb-1 text-[10.5px] text-zinc-400">
            <span>값 ({vUnit || '—'}) →</span>
            <span>↓ 깊이 ({s.axisUnit})</span>
          </div>
        </div>
      )}
      <p className="mt-2 text-[11px] text-zinc-400">
        {s.count}개 깊이 지점을 1개 프로파일로 표시합니다. 최신 수신 행 기준 · 백엔드에는 지점별로 전송됩니다.
      </p>
    </section>
  );
}

// ── 전송 큐 ──────────────────────────────────────────────────────────────────
function TransmitPanel({ node, ingest, onRetry, onFlush }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['버퍼 행', fmtNum(node.buffer, 0)],
          ['재전송', fmtNum(node.retry, 0)],
          ['24h 수신', fmtNum(node.rows24h, 0)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
            <div className="text-[11px] text-zinc-400">{k}</div>
            <div className="text-[18px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[12px] text-zinc-500 dark:text-zinc-400">현재 전송 상태</span>
        <TxPill transmit={node.transmit} count={node.transmit === 'queued' ? node.buffer : node.retry} />
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 flex items-center gap-2.5">
        <Wifi size={15} className="text-zinc-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-zinc-700 dark:text-zinc-300 truncate">
            인제스트 {ingest.status === 'connected' ? '연결됨' : '미연결'}
          </div>
          <div className="text-[11px] text-zinc-400 truncate font-mono">{ingest.endpoint || '엔드포인트 미설정'}</div>
        </div>
        <span className={`w-2 h-2 rounded-full shrink-0 ${ingest.status === 'connected' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" size="md" onClick={onRetry} className="flex-1">
          <RefreshCw size={14} /> 지금 재전송
        </Button>
        <Button variant="secondary" size="md" onClick={onFlush} className="flex-1">
          <Trash2 size={14} /> 버퍼 비우기
        </Button>
      </div>
      <p className="text-[11px] text-zinc-400">전송 페이로드엔 노드 ID·채널·타임스탬프·값만 담깁니다. 현장 stamp 는 백엔드가 부여합니다.</p>
    </div>
  );
}

// ── 진단 로그 ────────────────────────────────────────────────────────────────
function DiagnosticLog({ node }) {
  // 제로 디폴트: 노드 상태에서 유도한 최소 이벤트만. 전체 타임라인은 진단 로그 페이지(추후).
  const events = [];
  if (node.lastRx) events.push({ level: 'rx', text: `마지막 데이터 — ${fmtDateTime(node.lastRx)} (${timeAgo(node.lastRx)})` });
  else events.push({ level: 'lost', text: '이 파일에서 읽을 수 있는 데이터가 없습니다' });
  if (node.lastFileWrite) events.push({ level: 'info', text: `파일 저장 — ${fmtDateTime(node.lastFileWrite)} (${timeAgo(node.lastFileWrite)})` });
  // 로거는 파일을 계속 덮어쓰는데 안에 새 값이 없는 상태 — 센서/배선 쪽 의심 신호
  if (node.lastRx && node.lastFileWrite && node.lastFileWrite - node.lastRx > node.intervalMin * 3 * 60000) {
    events.push({ level: 'delayed', text: '파일은 계속 저장되는데 새 데이터가 없습니다 — 로거는 동작, 센서 값 유입이 끊긴 것으로 보입니다' });
  }
  events.push({ level: 'info', text: `기록 간격 ${intervalLabel(node.intervalMin)} · 채널 ${node.chans.length}개` });
  if (node.reception === 'lost') events.push({ level: 'lost', text: '수신 끊김 — 기록 간격의 3배를 초과했습니다' });
  if (node.reception === 'delayed') events.push({ level: 'delayed', text: '수신 지연 — 기록 간격을 초과했습니다' });

  const dot = {
    rx: 'bg-emerald-500',
    info: 'bg-zinc-300 dark:bg-zinc-600',
    delayed: 'bg-amber-500',
    lost: 'bg-red-500',
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {events.map((e, i) => (
          <li key={i} className="flex items-center gap-2.5 text-[12.5px] text-zinc-700 dark:text-zinc-300">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[e.level]}`} />
            {e.text}
          </li>
        ))}
      </ul>
      <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 px-3 py-4 text-center text-[11.5px] text-zinc-400">
        폴링/타임아웃/시각동기 등 상세 통신 로그는 진단 로그 페이지에서 제공될 예정입니다.
      </div>
    </div>
  );
}
