# 펄스 raw_channels Phase 2 — 형제 분할(siblings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `point:'siblings'` 계측기(tilt·survey_3d·wind·thermo_hygro)를 카탈로그 `outputs[]`대로 센서 N개로 분할 전송한다.

**Architecture:** 미러(`instrumentCatalog.js`)를 카탈로그 충실 형태(point/channels/outputs)로 통일하고, `resolveSensors`에 siblings 분기를 추가해 outputs마다 `role:'multiraw'` 센서 1개를 만든다(각자 raw 부분집합 + `{ch}-{suffix}` 코드). `syncNode`는 형제도 multiraw라 무변경.

**Tech Stack:** Electron/React, 순수 ESM JS, Playwright 테스트.

> ⚠️ **이 저장소는 git 미초기화** — 각 태스크의 "커밋"은 **테스트 체크포인트**로 대체.

설계 정본: `docs/superpowers/specs/2026-06-26-pulse-raw-channels-phase2-siblings-design.md`

---

## File Structure
- **Modify** `src/lib/instrumentCatalog.js` — 미러를 통일 형태로 교체 + 신규 헬퍼.
- **Modify** `src/lib/backendApi.js` — `SENSOR_TYPES`에 `survey_3d`(ch `TG`) 추가.
- **Modify** `src/lib/sensorModel.js` — `resolveSensors` 비-깊이 `else` 블록에 siblings 분기 추가.
- **Modify** `tests/raw-channels.spec.js` — 카탈로그·resolveSensors·syncNode siblings 테스트.

---

## Task 1: 미러 통일 (instrumentCatalog.js)

**Files:**
- Modify: `src/lib/instrumentCatalog.js` (전체 교체)
- Test: `tests/raw-channels.spec.js`

- [ ] **Step 1: Write the failing test** — `tests/raw-channels.spec.js` 의 `instrumentCatalog — 프로파일 조회` describe 끝(닫는 `});` 직전)에 추가. 또한 파일 상단 import 에 신규 헬퍼를 추가한다.

import 줄(현재 `import { profileOf, profileRawKeys, isRawEnabled } from '../src/lib/instrumentCatalog.js';`)을 아래로 교체:
```js
import { profileOf, profileRawKeys, isRawEnabled, profilePoint, profileChannels, profileOutputs } from '../src/lib/instrumentCatalog.js';
```
describe 끝에 추가:
```js
  test('Phase 2 — point/channels/outputs 헬퍼', () => {
    expect(profilePoint('strut')).toBe('single');
    expect(profilePoint('tilt')).toBe('siblings');
    expect(profilePoint('___nope___')).toBeNull();
    // tilt 형제 출력 2개 + 채널 col 매핑
    expect(profileOutputs('tilt')).toEqual([
      { suffix: 'X', raw: ['A0', 'A180'] },
      { suffix: 'Y', raw: ['B0', 'B180'] },
    ]);
    expect(profileChannels('tilt')).toEqual([
      { key: 'A0', col: 0 }, { key: 'A180', col: 1 }, { key: 'B0', col: 2 }, { key: 'B180', col: 3 },
    ]);
    // single 프로파일은 outputs 없음
    expect(profileOutputs('strut')).toBeNull();
  });

  test('Phase 2 — 헬퍼 사본 반환(원본 불변)', () => {
    const o = profileOutputs('tilt'); o[0].raw.push('ZZ'); o.push({});
    expect(profileOutputs('tilt')).toEqual([
      { suffix: 'X', raw: ['A0', 'A180'] }, { suffix: 'Y', raw: ['B0', 'B180'] },
    ]);
    const c = profileChannels('survey_3d'); c.pop();
    expect(profileChannels('survey_3d')).toHaveLength(3);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/raw-channels.spec.js -g "Phase 2 — point|Phase 2 — 헬퍼"`
Expected: FAIL — `profilePoint`/`profileOutputs`/`profileChannels` 가 export 되지 않음.

- [ ] **Step 3: Write minimal implementation** — `src/lib/instrumentCatalog.js` 전체를 아래로 교체:
```js
// ─────────────────────────────────────────────────────────────────────────────
// instrumentCatalog — 백엔드 GET /api/profiles/catalog 의 부분 미러(정본=백엔드, 수동 동기화).
//   point:'single'   = 한 센서(다채널→raw_channels / 단일채널은 미러 밖=value).
//   point:'siblings' = outputs[] 대로 형제 센서 N개(각자 raw 부분집합).
//   point:'depth'    = inclinometer (Phase 3, 미반영).
//   channels[].col = 0-based 데이터열(타임스탬프 제외) → 파일 열 인덱스 = col + 1.
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

/** 프로파일 형제 출력 [{suffix,raw}] 사본(없으면 null). */
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/raw-channels.spec.js -g "instrumentCatalog"`
Expected: PASS (Phase 1 헬퍼 회귀 3 + Phase 2 헬퍼 2 = 5 passed). 특히 `profileRawKeys('strut')`=['A','B','C'], `isRawEnabled('strut')`=true, `profileOf('optical_target')`=null 회귀 유지.

- [ ] **Step 5: Checkpoint** — Run: `npx playwright test tests/raw-channels.spec.js`. Expected: 기존 single multiraw 테스트(strut/anchor 등)도 그대로 PASS(미러 통일이 Phase 1 동작을 안 깨는지 확인).

---

## Task 2: SENSOR_TYPES 에 survey_3d 추가

**Files:**
- Modify: `src/lib/backendApi.js` (`SENSOR_TYPES` 배열)
- Test: (Task 3 에서 resolveSensors 로 검증 — 여기선 enum 만 추가)

- [ ] **Step 1: Write implementation** — `src/lib/backendApi.js` 의 `SENSOR_TYPES` 에서 `{ code: 'seismic', label: '지진계', ch: 'EQ' },` 줄 바로 아래에 추가:
```js
  { code: 'survey_3d', label: '광파타겟(3D)', ch: 'TG' },
```
(약어 `TG` 는 기존 ch 와 충돌 없음. tilt=BT·wind=WS·thermo_hygro=TH 는 이미 존재.)

- [ ] **Step 2: Verify no regression**

Run: `npx playwright test tests/sensor-code.spec.js tests/pulse-v2.spec.js`
Expected: PASS — SENSOR_TYPES 추가가 기존 분류/등록을 깨지 않는지 확인.

---

## Task 3: resolveSensors — siblings 분기

**Files:**
- Modify: `src/lib/sensorModel.js` (import + 비-깊이 `else` 블록 전체 교체)
- Test: `tests/raw-channels.spec.js`

- [ ] **Step 1: Write the failing test** — `tests/raw-channels.spec.js` 의 `resolveSensors — multiraw 그룹화` describe 끝(닫는 `});` 직전)에 추가:
```js
  test('tilt 4열 → 형제 2센서(BT-X, BT-Y)', () => {
    const r = resolveSensors(analysisOf(['DateTime', 'A0', 'A180', 'B0', 'B180'], ['t', '1', '2', '3', '4']), { sensorType: 'tilt', nodeId: 'T1' });
    expect(r.sensorCount).toBe(2);
    const [x, y] = r.sensors;
    expect(x.code).toBe('BT-X'); expect(x.role).toBe('multiraw');
    expect(x.columns).toEqual([1, 2]); expect(x.rawKeys).toEqual(['A0', 'A180']);
    expect(y.code).toBe('BT-Y');
    expect(y.columns).toEqual([3, 4]); expect(y.rawKeys).toEqual(['B0', 'B180']);
  });

  test('survey_3d 3열 → 형제 3센서(TG-N/E/Z, 각 1 raw)', () => {
    const r = resolveSensors(analysisOf(['DateTime', 'N', 'E', 'Z'], ['t', '1', '2', '3']), { sensorType: 'survey_3d', nodeId: 'S1' });
    expect(r.sensors.map((s) => s.code)).toEqual(['TG-N', 'TG-E', 'TG-Z']);
    expect(r.sensors.map((s) => s.rawKeys)).toEqual([['N'], ['E'], ['Z']]);
    expect(r.sensors.map((s) => s.columns)).toEqual([[1], [2], [3]]);
  });

  test('wind 2열 → 형제 2센서(WS-WD, WS-WS)', () => {
    const r = resolveSensors(analysisOf(['DateTime', 'WD', 'WS'], ['t', '180', '3']), { sensorType: 'wind', nodeId: 'W1' });
    expect(r.sensors.map((s) => s.code)).toEqual(['WS-WD', 'WS-WS']);
  });

  test('tilt 인데 열 부족(3열) → 경고 + 형제 분할 안 함', () => {
    const r = resolveSensors(analysisOf(['DateTime', 'A0', 'A180'], ['t', '1', '2']), { sensorType: 'tilt', nodeId: 'T1' });
    expect(r.sensors.every((s) => !/^BT-[XY]$/.test(s.code))).toBe(true);
    expect(r.integrity.some((i) => i.code === 'siblings-col-out-of-range')).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/raw-channels.spec.js -g "형제|tilt|survey_3d|wind"`
Expected: FAIL — siblings 분기 없음(현재 tilt 4열 → 4개 per-column 센서).

- [ ] **Step 3: Write implementation**

(3-a) `src/lib/sensorModel.js` 상단 import 교체 — 현재
```js
import { profileRawKeys, isRawEnabled } from './instrumentCatalog.js';
```
를
```js
import { profileRawKeys, isRawEnabled, profilePoint, profileChannels, profileOutputs } from './instrumentCatalog.js';
```

(3-b) 비-깊이 `else { ... }` 블록(현재 multiraw single + per-column 로직)을 **전체 아래로 교체**:
```js
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
      if (keyMissing || maxFileCol >= cols) {
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
```
IMPORTANT: 먼저 현재 `else` 블록을 READ 해 기존 로직(temp-aux·dead-column·per-column·multiraw single)이 위 교체본의 안쪽 `else` 와 동일한지 확인하라. 교체본은 그 로직을 보존하고 siblings 분기와 `point` 가드만 덧댄다. `cols`(=analysis columnCount)·`labels`·`valueCols`·`dataRows`·`channelTypes`·`TEMP_RE`·`sensorChannelCode`·`guessSensorTypeFromCode` 는 이미 스코프에 있다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/raw-channels.spec.js -g "형제|tilt|survey_3d|wind"`
Expected: PASS (4 passed).

- [ ] **Step 5: Regression checkpoint**

Run: `npx playwright test tests/raw-channels.spec.js tests/pulse-v2.spec.js tests/sensor-code.spec.js`
Expected: PASS — Phase 1 multiraw single(strut/anchor)·불일치 폴백·단일값·온도열·기존 번호형/이름형/깊이형 전부 회귀 없음.

---

## Task 4: syncNode 형제 전송 (UI E2E, 코드 변경 없음 검증)

**Files:**
- Test: `tests/raw-channels.spec.js` (syncNode describe 확장)

- [ ] **Step 1: Write the failing test** — `tests/raw-channels.spec.js` 의 `syncNode — multiraw raw_channels 방출` describe 끝에 추가:
```js
  test('건물경사계(tilt) → 형제 2센서 각각 raw_channels 전송(BT-X, BT-Y)', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__ingest = [];
      const header = ['DateTime', 'A0', 'A180', 'B0', 'B180'];
      const sample = ['2026-06-27 09:00:00', '10', '20', '30', '40'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: '건물경사계_T1.txt', fullPath: 'C:\\pulse\\incoming\\건물경사계_T1.txt', rowCount: 10, lastModified: '2026-06-27T09:00:00Z', header, sampleRow: sample },
        ],
        analyzeFile: async () => ({ encoding: 'UTF-8', rowCount: 10, columnCount: 5, delimiter: '쉼표 (,)', intervalGuess: 60, preview: [header, sample] }),
        listNodes: async () => ({ ok: true, status: 200, nodes: [] }),
        registerNode: async () => ({ ok: true, status: 201 }),
        readMeasurements: async () => ({ ok: true, columnCount: 5, head: header, sample, rows: [
          { at: '2026-06-27 09:00', ts: 1000, cells: ['2026-06-27 09:00', '10', '20', '30', '40'] },
        ] }),
        ingest: async (p) => { window.__ingest.push(p); return { ok: true, status: 200 }; },
      };
    });
    await page.goto('/');
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await page.getByRole('button', { name: '등록', exact: true }).first().click();
    await page.getByRole('button', { name: '다음' }).click();
    await page.getByRole('button', { name: '다음' }).click();
    await page.getByRole('button', { name: '등록 완료' }).click();
    await page.getByRole('button', { name: '새로고침' }).click();
    await page.waitForFunction(() => (window.__ingest || []).length >= 2);
    const calls = await page.evaluate(() => window.__ingest);
    const byCode = Object.fromEntries(calls.map((c) => [c.channelCode, c.measurements[0].raw_channels]));
    expect(Object.keys(byCode).sort()).toEqual(['BT-X', 'BT-Y']);
    expect(byCode['BT-X']).toEqual([{ key: 'A0', raw: 10 }, { key: 'A180', raw: 20 }]);
    expect(byCode['BT-Y']).toEqual([{ key: 'B0', raw: 30 }, { key: 'B180', raw: 40 }]);
  });
```
> 참고: 파일명 `건물경사계_T1.txt` 는 `guessSensorType`(GUESS_RULES `['경사','tilt']`)로 **자동 tilt 추론**되어 위저드가 종류 선택 없이 진행된다(Phase 1 strut=`하중계_…` 와 동일 패턴). 따라서 `(미지정)`→종류 클릭은 불필요. 만약 종류가 안 잡혀 위저드 다음 단계가 막히면 READ `src/components/nodes/RegisterWizard.jsx` 확인 후 종류 셀렉트(tilt 라벨=`경사계`, exact)로 보강. 구현 코드는 무관.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/raw-channels.spec.js -g "건물경사계"`
Expected: FAIL **이전 단계(Task 3) 미적용 상태에서만**. Task 3 적용 후엔 이 테스트가 코드 변경 없이 통과해야 한다(syncNode 무변경 확인). 만약 Task 3 적용 후에도 실패하면 위저드 셀렉터/라벨 문제 → 조정.

- [ ] **Step 3: Run test to verify it passes**

Run: `npx playwright test tests/raw-channels.spec.js -g "건물경사계"`
Expected: PASS (1 passed) — `syncNode` 코드 수정 없이 형제 2콜 전송 확인.

- [ ] **Step 4: Checkpoint**

Run: `npx playwright test tests/raw-channels.spec.js`
Expected: 신규 스펙 전체 PASS.

---

## Task 5: 전체 회귀 + 빌드

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 기존 63 + Phase 2 신규(카탈로그 2 + resolveSensors 4 + syncNode 1 = 7) 모두 PASS, 회귀 0.

- [ ] **Step 2: 빌드**

Run: `npx vite build`
Expected: 0 에러(신규 import 경로 해석 포함).

- [ ] **Step 3: 최종 점검**
- 형제(tilt/survey_3d/wind/thermo_hygro) = 센서 N개 분할 + 각자 raw_channels.
- single multiraw(strut 등)·단일값·깊이형 무변경.
- 미러 통일이 Phase 1 동작 보존.

---

## 완료 기준
- [ ] 미러 통일(point/channels/outputs) + 신규 헬퍼, Phase 1 헬퍼 회귀 0.
- [ ] `survey_3d` SENSOR_TYPES 추가(ch TG).
- [ ] `resolveSensors` siblings 분기 — outputs 대로 N센서(`{ch}-{suffix}`, col→파일열), 열부족 시 경고+폴백.
- [ ] `syncNode` 무변경으로 형제 raw_channels 전송 확인.
- [ ] 전체 70 테스트 그린, 빌드 0에러.
