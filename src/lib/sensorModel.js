// ─────────────────────────────────────────────────────────────────────────────
// sensorModel — "열 → 센서" 구조 해석기 (단일 진실원)
//
// 로거 .txt 의 헤더/샘플을 보고 "센서 몇 개이며, 각 센서가 어느 열을 쓰는가"를 도출한다.
// 핵심 원칙(2026-05-31 확정): **값 열 개수 ≠ 센서 개수.** 패턴마다 매핑이 다르다.
//
//   번호형 1,2,3      → 1열 = 1센서            (N개)
//   이름형 W-3,W-4    → 1열 = 1센서(이름=코드) (N개)
//   깊이형 0.0M…40.0M → 전체 = 1센서(깊이 프로파일), 깊이는 ingest depthLabel  (1개)
//   값+온도형 값,온도 → 값=센서, 온도는 부속(센서 아님)                        (값 개수)
//
// 이 sensors[] 가 등록(channels 개수)과 전송(ingest 열 매핑)의 공통 소스다.
// → 등록한 센서 수와 실제 보내는 데이터 구조가 구조적으로 항상 일치한다.
//
// 온전성(integrity): 막지는 않고(권장/느슨 게이트 유지) 경고만 — 죽은 열(전부 0),
// 이름은 2축(AB)인데 프로파일 1세트만 등.
// ─────────────────────────────────────────────────────────────────────────────
import { detectSeries } from './series.js';
import { classifyFormat } from './formatClassify.js';
import { sensorChannelCode, guessSensorTypeFromCode } from './backendApi.js';
import { profileRawKeys, isRawEnabled, profilePoint, profileChannels, profileOutputs } from './instrumentCatalog.js';

const TEMP_RE = /(temp|온도|_t$|\(℃\)|\(°c\))/i;

function looksHeader(row) {
  if (!row || row.length < 2) return false;
  // 첫 칸이 'DateTime' 같은 라벨(숫자도 날짜도 아님)이면 헤더 — 번호형('1','2','3') 헤더도 잡힘
  const first = String(row[0] ?? '').trim();
  if (first !== '' && isNaN(Number(first)) && isNaN(Date.parse(first))) return true;
  // 이름형 등: 둘째 칸부터 비숫자가 있으면 헤더
  return row.slice(1).some((c) => c !== '' && isNaN(Number(c)));
}

/** 깊이 프로파일(시리즈) 단일 센서의 기본 코드. 인클리노미터는 주축 관례 'A'(편집 가능), 그 외 'P'. */
export function defaultDepthCode(sensorType /*, nodeId */) {
  return sensorType === 'inclinometer' ? 'A' : 'P';
}

/**
 * @param {{columnCount:number, preview:string[][], name?:string}} analysis  files:analyze 결과
 * @param {{sensorType?:string, nodeId?:string, depthCode?:string, channelTypes?:Object<number,string>}} opts
 *   channelTypes: 채널 순번(seq, 1-based) → sensor_type override. 코드 접두가 이 종류를 따라간다.
 * @returns {{
 *   status:'ok'|'warn'|'error', pattern:string|null, patternLabel:string, reason:string,
 *   series: object|null,
 *   sensors: { code:string, role:'value'|'profile', ch:number, seq:number, sensorType:string, columns:number[], tempColumn:number|null, depthProfile?:object }[],
 *   sensorCount: number,
 *   integrity: { level:'warn'|'info', code:string, message:string }[],
 * }}
 */
export function resolveSensors(analysis, opts = {}) {
  const { sensorType = '', nodeId = '', depthCode, channelTypes } = opts;
  const preview = analysis?.preview || [];
  const header = looksHeader(preview[0]) ? preview[0] : null;
  const dataRows = header ? preview.slice(1) : preview;
  const cols = analysis?.columnCount || header?.length || preview[0]?.length || 0;
  const fmt = classifyFormat(header, dataRows[0] || null);

  const labels = header ? header.slice(1).map((s) => String(s ?? '').trim()) : [];
  const valueCols = [];
  for (let i = 1; i < cols; i++) valueCols.push(i); // 0열=시각

  const series = detectSeries(labels);
  const integrity = [];
  let sensors = [];
  let pattern = fmt.pattern;

  if (series) {
    // 깊이형 — 여러 깊이 열 = 센서 1개(프로파일). 깊이는 ingest depthLabel 로.
    pattern = 'depth';
    const code = (depthCode && String(depthCode).trim()) || defaultDepthCode(sensorType, nodeId);
    const chType = channelTypes?.[1] || sensorType;
    sensors = [{ code, role: 'profile', ch: 1, seq: 1, sensorType: chType, columns: valueCols, tempColumn: null, depthProfile: series }];
    const nameStr = `${nodeId} ${analysis?.name || ''}`;
    if (/A\s*[-_/]?\s*B/i.test(nameStr)) {
      integrity.push({
        level: 'warn', code: 'axis-maybe-missing',
        message: '이름에 A·B 2축이 있는데 깊이 프로파일이 1세트만 감지됐습니다 — B축이 누락됐을 수 있습니다(1센서로 등록).',
      });
    }
  } else {
    // 비깊이형 — 온도 열은 부속(센서 아님). baseCols = 온도 제외 값열(없으면 전체).
    const isTemp = (i) => !!header && TEMP_RE.test(labels[i - 1] || '');
    const valueOnly = valueCols.filter((i) => !isTemp(i));
    const baseCols = valueOnly.length ? valueOnly : valueCols;
    const point = profilePoint(sensorType);

    // ★형제 분할(siblings, Phase 2): outputs[] 마다 센서 1개. raw키→channels.col→파일열(col+1).
    let siblingSensors = null;
    if (point === 'siblings') {
      const prefix = sensorChannelCode(sensorType);
      const chMap = Object.fromEntries(profileChannels(sensorType).map((c) => [c.key, c.col]));
      const outputs = profileOutputs(sensorType) || [];
      const keyMissing = outputs.some((o) => o.raw.some((k) => chMap[k] == null));
      const maxFileCol = keyMissing ? Infinity : Math.max(0, ...outputs.flatMap((o) => o.raw.map((k) => chMap[k] + 1)));
      if (keyMissing || !outputs.length || maxFileCol >= cols) {
        integrity.push({
          level: 'warn', code: 'siblings-col-out-of-range',
          message: '형제 분할에 필요한 열이 파일에 부족합니다 — 단일 채널로 처리합니다.',
        });
      } else {
        siblingSensors = outputs.map((o, idx) => {
          const columns = o.raw.map((k) => chMap[k] + 1); // col(데이터열) → 파일 열(0=시각)
          return { code: `${prefix}-${o.suffix}`, role: 'multiraw', ch: columns[0], seq: idx + 1, sensorType, columns, rawKeys: [...o.raw], tempColumn: null };
        });
      }
    }

    if (siblingSensors) {
      sensors = siblingSensors;
      pattern = 'siblings';
    } else {
      // ★다채널 원시 single(Phase 1) — 프로파일 raw-enabled & point:single & 값열수==키수.
      const rawKeys = profileRawKeys(sensorType);
      if (point === 'single' && isRawEnabled(sensorType) && rawKeys.length && baseCols.length === rawKeys.length) {
        // 온도 열은 multiraw 에서 무시(rawKeys 대응 열만 raw 전송).
        const prefix = sensorChannelCode(sensorType);
        const headerCode = header ? String(header[baseCols[0]] || '').trim() : '';
        const code = prefix ? `${prefix}-1` : headerCode || `CH${baseCols[0]}`;
        if (!prefix) {
          integrity.push({
            level: 'warn', code: 'rawprofile-no-abbrev',
            message: `'${sensorType}' 는 채널 약어가 없어 코드가 '${code}' 로 폴백됩니다 — 등록 전 종류/코드 확인 필요.`,
          });
        }
        sensors = [{ code, role: 'multiraw', ch: baseCols[0], seq: 1, sensorType, columns: [...baseCols], rawKeys: [...rawKeys], tempColumn: null }];
        pattern = 'multiraw';
      } else {
        // raw single 인데 값열 수 불일치 → 경고 후 per-column 폴백.
        if (point === 'single' && isRawEnabled(sensorType) && rawKeys.length) {
          integrity.push({
            level: 'warn', code: 'rawkey-count-mismatch',
            message: `원시 채널 수 불일치(값열 ${baseCols.length} ≠ 키 ${rawKeys.length}) — 단일값으로 처리합니다.`,
          });
        }
        const tempCols = valueCols.filter((i) => isTemp(i));
        const usedTemp = new Set();
        sensors = baseCols.map((i, idx) => {
          const t = tempCols.find((tc) => tc > i && !usedTemp.has(tc));
          if (t != null) usedTemp.add(t);
          const seq = idx + 1;
          const headerCode = header ? String(header[i] || '').trim() : '';
          const chType = channelTypes?.[seq] || guessSensorTypeFromCode(headerCode) || sensorType;
          const prefix = sensorChannelCode(chType);
          const code = prefix ? `${prefix}-${seq}` : headerCode || `CH${i}`;
          return { code, role: 'value', ch: i, seq, sensorType: chType, columns: [i], tempColumn: t ?? null };
        });
        if (tempCols.length) {
          integrity.push({
            level: 'info', code: 'temp-aux',
            message: `온도 열 ${tempCols.length}개는 센서로 세지 않고 해당 센서의 부속(보정용)으로 처리합니다.`,
          });
        }
        for (const s of sensors) {
          const vals = dataRows.map((r) => r?.[s.ch]).filter((v) => v != null && v !== '');
          if (vals.length && vals.every((v) => Number(v) === 0)) {
            integrity.push({
              level: 'warn', code: 'dead-column',
              message: `'${s.code}' 열이 샘플에서 전부 0 — 미사용/고장 채널일 수 있습니다(센서로는 유지).`,
            });
          }
        }
        if (!pattern && sensors.length) pattern = header ? 'named' : 'numbered';
      }
    }
  }

  return {
    status: fmt.status,
    pattern,
    patternLabel: fmt.patternLabel,
    reason: fmt.reason,
    series,
    sensors,
    sensorCount: sensors.length,
    integrity,
  };
}
