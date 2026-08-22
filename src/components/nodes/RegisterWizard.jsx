// ─────────────────────────────────────────────────────────────────────────────
// RegisterWizard — 노드 등록 (중앙 모달, 3단계) §4
//   1 분석 → 2 채널 매핑 → 3 확인  (파일은 감지·등록 탭에서 선택해 진입)
// 현장-블라인드: 현장 입력 단계 없음. 전송 페이로드 { nodeId, channel, ts, value }.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { FilePlus2, FileText, Check, AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Select from '../ui/Select.jsx';
import { usePulse } from '../../lib/store.jsx';
import * as folderApi from '../../lib/folderApi.js';
import { inferNodeId } from '../../lib/nodeId.js';
import { seriesSummary } from '../../lib/series.js';
import { FORMAT_TINT } from '../../lib/formatClassify.js';
import { resolveSensors, defaultDepthCode } from '../../lib/sensorModel.js';
import { SENSOR_TYPES, sensorTypeLabel, guessSensorType, sensorTypeUnit } from '../../lib/backendApi.js';
import { SensorTypeIcon } from '../reference/sensorIcons.jsx';
import { intervalLabel, fmtNum, timeAgo, fmtDateTime } from '../../lib/format.js';
import { showToast } from '../ui/Toast.jsx';

const STEPS = ['분석', '채널 매핑', '확인'];
// 기록 간격 선택지(분) — 이 장비가 값을 기록하는 간격. 수집 빈도가 아니라 지연/끊김 판정 기준.
// 통상 1일이 기본, 1시간이 흔함 → 분 단위~주 단위로 넓게.
const INTERVAL_OPTS = [10, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080].map((m) => ({
  value: String(m),
  label: intervalLabel(m),
}));
const DEFAULT_INTERVAL = 1440; // 1일 (통상 디폴트)
// 계측기 종류 = 백엔드 nodes 등록 enum(고정 목록). 값=코드, 라벨=한글. 미지정 허용.
// 각 종류 왼쪽에 성격별 아이콘(SensorTypeIcon)을 표시.
const SENSOR_TYPE_OPTS = [
  { value: '', label: '(미지정)' },
  ...SENSOR_TYPES.map((t) => ({
    value: t.code,
    label: t.label,
    icon: <SensorTypeIcon code={t.code} size={15} />,
  })),
];

export default function RegisterWizard({ open, initialFile, onClose }) {
  const { registerNode } = usePulse();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [nodeId, setNodeId] = useState('');
  const [intervalMin, setIntervalMin] = useState(DEFAULT_INTERVAL);
  const [sensorType, setSensorType] = useState(''); // 계측기 종류(노드 메타)
  const [depthCode, setDepthCode] = useState('');   // 깊이형 단일 센서 코드(편집 가능)
  const [monitoringFrom, setMonitoringFrom] = useState(''); // 운영 시작일 (YYYY-MM-DD, 빈값=미설정)
  const [chTypes, setChTypes] = useState({}); // 채널 순번(seq) → sensor_type 수동 지정. 코드 접두가 이 종류를 따라감(없으면 헤더추론/노드 대표 폴백)

  // 열기/초기 파일에 따라 리셋
  useEffect(() => {
    if (!open) return;
    setFile(initialFile || null);
    setStep(0);
    setAnalysis(null);
    setNodeId('');
    setIntervalMin(DEFAULT_INTERVAL);
    setSensorType(guessSensorType(initialFile?.name));
    setDepthCode('');
    setMonitoringFrom('');
    setChTypes({});
  }, [open, initialFile]);

  // 분석 단계 진입 시 파일 구조 분석
  useEffect(() => {
    if (!open || step !== 0 || !file) return;
    let alive = true;
    setAnalyzing(true);
    folderApi.analyzeFile(file.fullPath).then((res) => {
      if (!alive) return;
      setAnalyzing(false);
      const id = inferNodeId(file.name);
      const st = guessSensorType(file.name);
      setNodeId(id);
      setSensorType(st);
      setAnalysis(res || null);
      if (res?.intervalGuess) setIntervalMin(res.intervalGuess);
      // 깊이형이면 단일 센서 코드 기본값 채움(편집 가능)
      const m = res ? resolveSensors(res, { sensorType: st, nodeId: id }) : null;
      setDepthCode(m?.series ? defaultDepthCode(st, id) : '');
    });
    return () => { alive = false; };
  }, [open, step, file]);

  if (!open) return null;

  // 단일 진실원: 열→센서 구조를 해석기로 도출(센서 수·코드·종류·온전성).
  //   ★채널 종류 override(chTypes, seq 키)를 넘겨 코드 접두가 종류를 따라가게(GI-1→GW-1). 코드↔종류 항상 일치.
  const model = analysis ? resolveSensors(analysis, { sensorType, nodeId, depthCode, channelTypes: chTypes }) : null;
  const series = model?.series || null;
  const sensors = model ? model.sensors : [{ ch: 1, code: 'CH1', role: 'value', seq: 1, sensorType: '', columns: [1], tempColumn: null }];
  const integrity = model?.integrity || [];

  // 채널별 계측 종류 수동 지정 — 순번(seq)으로 키잉(코드는 종류를 따라 바뀌므로 코드 키는 불안정).
  const setChType = (seq, t) => setChTypes((m) => ({ ...m, [seq]: t }));

  const canNext =
    step === 0 ? !analyzing && (!analysis || model?.status !== 'error')
      : step === 1 ? !!nodeId.trim() && !!sensorType // 계측기 종류 미선택 시 다음 단계로 못 넘어감
      : true;

  const go = (d) => setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + d)));

  const submit = async () => {
    const id = nodeId.trim();
    const dataRows = analysis ? stripHeader(analysis.preview) : [];
    // 해석기가 도출한 센서 = 등록 채널의 단일 소스 (깊이형=1, 번호/이름형=N, 온도열 제외).
    // ★코드·종류는 해석기가 함께 도출(s.code 접두 = s.sensorType 약어, 항상 일치). 미지정은 노드 대표로 폴백.
    const channels = sensors.map((s) => ({
      ch: s.ch,
      code: s.code,
      sensorType: s.sensorType || undefined,
      unit: sensorTypeUnit(s.sensorType) || undefined,
    }));
    // 운영 시작일 → ISO(KST). 빈값이면 undefined(미전송 = 백엔드 기존값 유지).
    const monIso = monitoringFrom ? `${monitoringFrom}T00:00:00+09:00` : undefined;
    registerNode({
      id,
      model: 'YH-DL16',
      type: '데이터로거',
      proto: 'Modbus TCP',
      sensorType, // 계측기 종류(노드 메타) — 데이터 전송 페이로드엔 미포함
      name: id, // nodes 등록 시 name 으로 노드 ID 를 그대로 전송(가칭 입력 폐지)
      intervalMin,
      channels, // { ch, code } — 센서 1개당 1개
      sensors,  // 열→센서 매핑(columns/depthProfile) — ingest 전송 시 사용
      sourceFile: file?.fullPath || '',
      // 수신 시각 = 파일 안 마지막 데이터 시각(dataEnd). 파일 저장시각(mtime)이 아니다 —
      // 덮어쓰기 로거는 데이터가 끊겨도 mtime 을 갱신하므로 끊긴 노드를 놓치게 된다.
      lastRx: file?.dataEnd ? Date.parse(file.dataEnd) : null,
      lastFileWrite: file?.modified ? Date.parse(file.modified) : null,
      dataStart: file?.dataStart ? Date.parse(file.dataStart) : null,
      rows: analysis?.rowCount ?? file?.rows ?? 0,
      raw: dataRows,
      series: series || null,
      monitoringFrom: monIso ?? null,
    });
    onClose?.();
    // 백엔드로 노드 등록 전송 (메인 프로세스가 키로 POST). 미설정/비-Electron 이면 메모리만.
    if (!folderApi.isElectron()) { showToast(`${id} 등록 완료 (메모리)`); return; }
    if (!sensorType) { showToast(`${id} 등록(메모리) · 계측기 종류 미지정으로 백엔드 전송 생략`); return; }
    // 센서 수 = 해석기 결과. 깊이형도 채널 1개를 명시 전송 → 백엔드가 종류 템플릿(예 인클리노미터 A/B 2개)
    // 대신 정확히 1개를 만들게 함. 깊이는 ingest 때 depthLabel 로.
    const payload = {
      nodeId: id,
      sensorType,
      channels,
      sensorCount: channels.length,
      intervalMin, // 수신 주기도 함께 저장(재시작 후 GET 으로 복원)
      monitoringFrom: monIso, // 운영 시작일(ISO/KST). undefined 면 nodeRegisterBody 가 키 생략.
      // 펄스가 파일 패턴으로 센서 집합을 단언 → channels 에 없는 기존 잉여 센서는 백엔드가 정리(자가 정합).
      sensorSync: 'replace',
    };
    // 디버그: 렌더러 DevTools Console 에서 실제 전송 payload 확인 (Network 엔 안 잡힘 — IPC라서)
    console.log('[register] nodes:register payload →', JSON.parse(JSON.stringify(payload)));
    const r = await folderApi.registerNodeBackend(payload);
    console.log('[register] nodes:register result →', r);
    if (r?.ok) showToast(`${id} 백엔드 등록 완료 · 채널 ${channels.length}개 전송`);
    else if (r?.error === 'unconfigured') showToast(`${id} 등록(메모리) · 백엔드 미설정 — 설정에서 연결`);
    else if (r?.error === 'unauthorized') showToast(`${id} 백엔드 인증 실패(401) — API 키 확인`);
    else showToast(`${id} 백엔드 전송 실패 — 메모리에는 등록됨`);
  };

  return (
    <Modal open={open} onClose={onClose} title="노드 등록" icon={FilePlus2} width={780}>
      {/* 스테퍼 */}
      <div className="flex items-center gap-1 mb-5">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-grid place-items-center w-5 h-5 rounded-full text-[11px] font-semibold tabular-nums ${
                  i < step
                    ? 'bg-emerald-500 text-white'
                    : i === step
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                }`}
              >
                {i < step ? <Check size={12} /> : i + 1}
              </span>
              <span className={`text-[12px] ${i === step ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />}
          </React.Fragment>
        ))}
      </div>

      <div className="min-h-[380px]">
        {step === 0 && (
          <StepAnalyze file={file} analysis={analysis} analyzing={analyzing} nodeId={nodeId} model={model} />
        )}
        {step === 1 && (
          <StepMapping
            nodeId={nodeId}
            setNodeId={setNodeId}
            sensors={sensors}
            intervalMin={intervalMin}
            setIntervalMin={setIntervalMin}
            sensorType={sensorType}
            setSensorType={setSensorType}
            series={series}
            depthCode={depthCode}
            setDepthCode={setDepthCode}
            integrity={integrity}
            setChType={setChType}
          />
        )}
        {step === 2 && (
          <StepConfirm
            file={file}
            nodeId={nodeId}
            sensors={sensors}
            intervalMin={intervalMin}
            sensorType={sensorType}
            analysis={analysis}
            series={series}
            integrity={integrity}
            monitoringFrom={monitoringFrom}
            setMonitoringFrom={setMonitoringFrom}
          />
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <div className="flex items-center gap-2">
          {step > 0 && <Button variant="secondary" onClick={() => go(-1)}>이전</Button>}
          {step < STEPS.length - 1 ? (
            <Button variant="primary" disabled={!canNext} onClick={() => go(1)}>다음</Button>
          ) : (
            <Button variant="primary" disabled={!canNext} onClick={submit}>등록 완료</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function looksHeader(row) {
  // 첫 칸이 라벨('DateTime' 등)이거나 둘째 칸부터 비숫자가 있으면 헤더로 간주(번호형 헤더 포함)
  if (!row || row.length < 2) return false;
  const first = String(row[0] ?? '').trim();
  if (first !== '' && isNaN(Number(first)) && isNaN(Date.parse(first))) return true;
  return row.slice(1).some((c) => c !== '' && isNaN(Number(c)));
}
function stripHeader(preview) {
  if (!preview || !preview.length) return [];
  return looksHeader(preview[0]) ? preview.slice(1) : preview;
}

// 온전성(integrity) 경고/안내 박스 — 등록을 막지 않고 표시만 한다.
function IntegrityNotes({ integrity }) {
  if (!integrity?.length) return null;
  return (
    <div className="space-y-1.5">
      {integrity.map((n, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-md px-3 py-2 text-[11.5px] ring-1 ring-inset ${
            n.level === 'warn' ? FORMAT_TINT.warn : 'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300 dark:ring-zinc-700'
          }`}
        >
          <AlertCircle size={13} className="mt-px shrink-0" />
          <span>{n.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Step 1: 분석 ──────────────────────────────────────────────────────────────
function StepAnalyze({ file, analysis, analyzing, nodeId, model }) {
  if (analyzing) {
    return <div className="py-16 text-center text-[13px] text-zinc-400">파일 분석 중…</div>;
  }
  const ok = !model || model.status === 'ok';
  const sensorDesc = model
    ? model.series
      ? `1개 (깊이 프로파일 ${model.series.count}점)`
      : `${model.sensorCount}개`
    : '—';
  const stats = analysis
    ? [
        ['노드 ID', nodeId],
        ['인코딩', analysis.encoding],
        ['행 수', `${fmtNum(analysis.rowCount, 0)}`],
        ['추정 기록 간격', analysis.intervalGuess ? intervalLabel(analysis.intervalGuess) : '판정 불가'],
        ['값(열) 수', `${Math.max(0, analysis.columnCount - 1)}`],
        ['센서 수', sensorDesc],
      ]
    : [
        ['노드 ID', nodeId],
        ['상태', 'Electron 외 환경 — 구조 분석 불가'],
      ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12.5px] text-zinc-700 dark:text-zinc-300">
        <FileText size={15} className="text-zinc-400" />
        <span className="font-mono truncate">{file?.name}</span>
        {model?.patternLabel && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${FORMAT_TINT[model.status]}`}>
            {model.patternLabel}
          </span>
        )}
      </div>

      {/* 포맷 안내: error 만 차단, warn(비정형)은 경고 후 등록 허용 */}
      {!ok && (
        <div className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-[12px] ring-1 ring-inset ${FORMAT_TINT[model.status]}`}>
          <AlertCircle size={14} className="mt-px shrink-0" />
          <div>
            <div className="font-medium">
              {model.status === 'error' ? '등록할 수 없는 형식입니다' : '비정형 형식 — 확인 후 등록할 수 있습니다'}
            </div>
            <div className="opacity-80">{model.reason}</div>
          </div>
        </div>
      )}

      {ok && <IntegrityNotes integrity={model?.integrity} />}

      <div className="grid grid-cols-2 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
            <div className="text-[10.5px] text-zinc-400">{k}</div>
            <div className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200 tabular-nums truncate">{v}</div>
          </div>
        ))}
      </div>
      {analysis?.preview?.length > 0 && (
        <div>
          <div className="text-[11px] text-zinc-400 mb-1.5">원본 {analysis.columnCount}열 미리보기</div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <tbody>
                {analysis.preview.slice(0, 6).map((row, i) => (
                  <tr key={i} className="border-b last:border-0 border-zinc-100 dark:border-zinc-800/70">
                    {row.map((cell, j) => (
                      <td key={j} className={`px-2 py-1 whitespace-nowrap tabular-nums ${j === 0 ? 'text-zinc-500' : 'text-zinc-800 dark:text-zinc-200'}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: 채널 매핑 (노드 ID + 수신 주기 + 계측기 종류. 채널은 자동 도출) ──────
function StepMapping({ nodeId, setNodeId, sensors, intervalMin, setIntervalMin, sensorType, setSensorType, series, depthCode, setDepthCode, integrity, setChType }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">노드 ID</label>
          <input
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
          />
        </div>
        <div>
          <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">기록 간격</label>
          <Select value={String(intervalMin)} onChange={(v) => setIntervalMin(Number(v))} options={INTERVAL_OPTS} />
          <p className="mt-1 text-[10.5px] text-zinc-400 dark:text-zinc-500 leading-snug">
            이 장비가 값을 기록하는 간격입니다. 이보다 늦어지면 지연·끊김으로 표시됩니다.
            <br />수집은 이 설정과 무관하게 항상 1분마다 돕니다.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">노드 대표 계측기 종류 <span className="text-amber-600 dark:text-amber-400">(필수)</span> <span className="text-zinc-400">— 채널 미지정 시 폴백</span></label>
        <Select value={sensorType} onChange={setSensorType} options={SENSOR_TYPE_OPTS} placeholder="(미지정)" />
      </div>

      {/* 센서(채널) 미리보기 (읽기 전용) — 라벨·단위는 백엔드가 정함 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] text-zinc-500 dark:text-zinc-400">센서</label>
          <span className="text-[11px] text-zinc-400 tabular-nums">
            {series ? `깊이 프로파일 · ${series.count}점` : `${sensors.length}개`}
          </span>
        </div>

        {series ? (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">깊이 프로파일</span>
              <span className="text-[12px] font-mono text-zinc-600 dark:text-zinc-300 tabular-nums">{seriesSummary(series)}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">여러 깊이 지점 = <b>센서 1개</b>로 등록합니다. 깊이별 값은 전송 시 그 센서의 깊이 라벨로 보냅니다.</p>
            <div className="mt-2.5 flex items-center gap-2">
              <label className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">센서 코드</label>
              <input
                value={depthCode}
                onChange={(e) => setDepthCode(e.target.value)}
                className="w-28 h-7 px-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
              />
              <span className="text-[10.5px] text-zinc-400">백엔드 센서코드 = <span className="font-mono">{nodeId}-{depthCode || 'A'}</span></span>
            </div>
          </div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {sensors.map((c) => (
              <div key={c.ch} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300 w-20 shrink-0 truncate">
                  {c.code}{c.tempColumn != null && <span className="text-[9.5px] text-zinc-400"> +온도</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <Select value={c.sensorType || ''} onChange={(v) => setChType(c.seq, v)} options={SENSOR_TYPE_OPTS} placeholder="(노드 대표)" />
                </div>
                <span className="text-[11px] text-zinc-400 w-10 shrink-0 text-right tabular-nums">{sensorTypeUnit(c.sensorType) || '—'}</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-2 text-[11px] text-zinc-400">
          센서는 파일 패턴으로 자동 도출합니다(번호/이름형=열마다 1개, 깊이형=1개, 온도열은 부속). <b>채널마다 계측 종류를 지정</b>할 수 있어 한 노드에 종류가 섞여도 됩니다(코드 접두로 자동 채움 · 단위는 종류 기본값). 백엔드는 같은 종류·단위끼리만 평균을 냅니다.
        </p>
      </div>

      <IntegrityNotes integrity={integrity} />
    </div>
  );
}

// ── Step 3: 확인 ──────────────────────────────────────────────────────────────
function StepConfirm({ file, nodeId, sensors, intervalMin, sensorType, analysis, series, integrity, monitoringFrom, setMonitoringFrom }) {
  const sampleTs = analysis ? stripHeader(analysis.preview)[0]?.[0] : null;
  const payload = {
    nodeId,
    channel: sensors[0]?.code || 'CH1',
    ts: sampleTs || '2026-05-29T12:00:00',
    value: 0,
  };
  const sensorDesc = series ? `1개 (깊이 프로파일 ${series.count}점)` : `${sensors.length}개`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {[
          ['소스 파일', file?.name],
          ['노드 ID', nodeId],
          ['계측기 종류', sensorType ? sensorTypeLabel(sensorType) : '미지정'],
          ['센서 수', sensorDesc],
          ['기록 간격', intervalLabel(intervalMin)],
          ['인코딩', analysis?.encoding || '—'],
          ['마지막 데이터', file?.dataEnd ? fmtDateTime(file.dataEnd) : '데이터 없음'],
          ['파일 저장', file?.modified ? fmtDateTime(file.modified) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
            <div className="text-[10.5px] text-zinc-400">{k}</div>
            <div className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200 truncate tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {/* 운영 시작일(monitoring_from) — 이 날짜부터 진짜 운영 데이터(시운전 완료). 이전 데이터는 백엔드 분석/고장의심/기본차트 제외(raw 보존). 미입력 가능. */}
      <div>
        <label htmlFor="reg-monitoring-from" className="block text-[11.5px] font-medium text-zinc-600 dark:text-zinc-300 mb-1">
          운영 시작일 <span className="font-normal text-zinc-400">— 시운전 완료 시점(선택). 이전 데이터는 분석에서 제외</span>
        </label>
        <input
          id="reg-monitoring-from" type="date" aria-label="운영 시작일"
          value={monitoringFrom} onChange={(e) => setMonitoringFrom?.(e.target.value)}
          className="h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[13px] tabular-nums text-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mb-1.5">
          <AlertCircle size={12} /> 전송 페이로드 미리보기 — 현장 필드 없음
        </div>
        <pre className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2.5 text-[11.5px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto">
{JSON.stringify(payload, null, 2)}
        </pre>
        <p className="mt-1.5 text-[11px] text-zinc-400">
          현장 stamp 는 백엔드 인제스트 계층이 노드의 현재 배치를 조회해 부여합니다.
        </p>
      </div>

      <IntegrityNotes integrity={integrity} />
    </div>
  );
}
