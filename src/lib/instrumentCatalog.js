// ─────────────────────────────────────────────────────────────────────────────
// instrumentCatalog — 백엔드 GET /api/profiles/catalog 의 부분 미러(정본=백엔드, 수동 동기화).
//   point:'single'   = 한 센서(다채널→raw_channels / 단일채널은 미러 밖=value).
//   point:'siblings' = outputs[] 대로 형제 센서 N개(각자 raw 부분집합).
//   point:'depth'    = inclinometer (Phase 3, 미반영).
//   channels[].col = 0-based 데이터열(타임스탬프 제외) → 파일 열 인덱스 = col + 1.
//     (예: anchor.channels[0].col=0 → 파일 2번째 열 = 1-indexed 1열. resolveSensors 가 col+1 로 매핑.)
//   약어(접두)는 미러에 두지 않고 backendApi.sensorChannelCode(=SENSOR_TYPES.ch) 단일 소스 사용.
//   미러에 없는 키(water_level·crack·groundwater·rainfall·strain·settlement·optical)는 기존 value 경로.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Record<string, {point:'single'|'siblings', channels:{key:string,col:number}[], outputs?:{suffix:string,raw:string[]}[]}>} */
export const INSTRUMENT_PROFILES = {
  // point:'single' — 다채널이 한 센서(raw_channels). EA/ST하중계는 동일 raw 구조·별도 키.
  anchor:        { point: 'single', channels: [{ key: 'A', col: 0 }, { key: 'B', col: 1 }, { key: 'C', col: 2 }] },
  strut:         { point: 'single', channels: [{ key: 'A', col: 0 }, { key: 'B', col: 1 }, { key: 'C', col: 2 }] },
  vibration:     { point: 'single', channels: [{ key: 'X', col: 0 }, { key: 'Y', col: 1 }, { key: 'Z', col: 2 }] },
  seismic:       { point: 'single', channels: [{ key: 'X', col: 0 }, { key: 'Y', col: 1 }, { key: 'Z', col: 2 }] },
  pore_pressure: { point: 'single', channels: [{ key: 'R', col: 0 }] },

  // point:'siblings' — outputs[] 대로 형제 센서로 분할(각 형제 = raw 부분집합).
  tilt:          { point: 'siblings', channels: [{ key: 'A0', col: 0 }, { key: 'A180', col: 1 }, { key: 'B0', col: 2 }, { key: 'B180', col: 3 }],
                   outputs: [{ suffix: 'X', raw: ['A0', 'A180'] }, { suffix: 'Y', raw: ['B0', 'B180'] }] },
  survey_3d:     { point: 'siblings', channels: [{ key: 'N', col: 0 }, { key: 'E', col: 1 }, { key: 'Z', col: 2 }],
                   outputs: [{ suffix: 'N', raw: ['N'] }, { suffix: 'E', raw: ['E'] }, { suffix: 'Z', raw: ['Z'] }] },
  wind:          { point: 'siblings', channels: [{ key: 'WD', col: 0 }, { key: 'WS', col: 1 }],
                   outputs: [{ suffix: 'WD', raw: ['WD'] }, { suffix: 'WS', raw: ['WS'] }] },
  thermo_hygro:  { point: 'siblings', channels: [{ key: 'T', col: 0 }, { key: 'H', col: 1 }],
                   outputs: [{ suffix: 'T', raw: ['T'] }, { suffix: 'H', raw: ['H'] }] },
};

/** 프로파일 키 → 항목(없으면 null). */
export function profileOf(key) {
  return INSTRUMENT_PROFILES[key] || null;
}

/** 프로파일 → point('single'|'siblings') 또는 null. */
export function profilePoint(key) {
  const p = profileOf(key);
  return p ? p.point : null;
}

/** 프로파일 채널 [{key,col}] 사본(없으면 []). */
export function profileChannels(key) {
  const p = profileOf(key);
  return p && Array.isArray(p.channels) ? p.channels.map((c) => ({ ...c })) : [];
}

/** 프로파일 형제 출력 [{suffix,raw}] 사본. null = 미존재 또는 비-siblings(single). 구분은 profilePoint() 로. */
export function profileOutputs(key) {
  const p = profileOf(key);
  return p && Array.isArray(p.outputs) ? p.outputs.map((o) => ({ suffix: o.suffix, raw: [...o.raw] })) : null;
}

/** single 프로파일의 원시 키 배열(채널 순서) 사본. siblings/없음은 []. (Phase 1 다채널 경로용) */
export function profileRawKeys(key) {
  const p = profileOf(key);
  return p && p.point === 'single' && Array.isArray(p.channels) ? p.channels.map((c) => c.key) : [];
}

/** 프로파일이 raw_channels 방출 대상인지(미러에 있으면 raw). */
export function isRawEnabled(key) {
  return !!profileOf(key);
}
