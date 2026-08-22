# 펄스 다채널 원시 전송(raw_channels) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 펄스가 ingest 시 단일 `value` 대신 계측기 원시 채널 배열(`raw_channels`)을 전송하도록, 카탈로그 기반 다채널 매핑을 Phase 1(단일-센서 다채널) 범위로 추가한다.

**Architecture:** 신규 로컬 미러 카탈로그(`src/profiles/instrumentCatalog.js`)가 프로파일별 원시 키와 활성 플래그를 보유한다. `sensorModel.resolveSensors` 가 raw-enabled 프로파일이고 값열 수가 키 수와 일치하면 센서 1개(`role:'multiraw'`)로 묶고, `store.syncNode` 가 그 센서를 `raw_channels` 로 방출한다. 그 외(단일값·깊이형)는 전부 무변경(하위호환).

**Tech Stack:** Electron 42 / React 18 / Vite / Playwright(테스트). 순수 JS(ESM).

> ⚠️ **이 저장소는 git 미초기화** — 각 태스크의 "커밋" 단계는 **테스트 실행 체크포인트**로 대체한다(아래 각 Step 5 참조).

설계 정본: `docs/superpowers/specs/2026-06-25-pulse-raw-channels-design.md`

---

## File Structure

- **Create** `src/profiles/instrumentCatalog.js` — 프로파일→원시키/플래그 미러 + 조회 헬퍼(단일 소스).
- **Modify** `src/lib/sensorModel.js` — 비-깊이 분기에 multiraw 그룹화 추가(`./backendApi.js` 와 동일 디렉터리, 카탈로그는 `../profiles/`).
- **Modify** `src/lib/store.jsx` — `syncNode` 측정 빌드에 `role:'multiraw'` 분기 추가.
- **Create** `tests/raw-channels.spec.js` — 카탈로그·resolveSensors 단위 + syncNode 방출 UI 테스트.

---

## Task 1: 로컬 미러 카탈로그 모듈

**Files:**
- Create: `src/profiles/instrumentCatalog.js`
- Test: `tests/raw-channels.spec.js`

- [ ] **Step 1: Write the failing test**

`tests/raw-channels.spec.js` (신규 파일, 맨 위):
```js
import { test, expect } from '@playwright/test';
import { profileOf, profileRawKeys, isRawEnabled } from '../src/profiles/instrumentCatalog.js';

test.describe('instrumentCatalog — 프로파일 조회', () => {
  test('raw-enabled 프로파일의 키/플래그', () => {
    expect(profileRawKeys('strut')).toEqual(['A', 'B', 'C']);
    expect(isRawEnabled('strut')).toBe(true);
    expect(profileRawKeys('vibration')).toEqual(['X', 'Y', 'Z']);
    expect(profileRawKeys('pore_pressure')).toEqual(['R']);
    expect(isRawEnabled('pore_pressure')).toBe(true);
  });

  test('단일값/미지 프로파일은 빈 키·비활성', () => {
    expect(profileRawKeys('water_level')).toEqual([]);
    expect(isRawEnabled('water_level')).toBe(false);
    expect(profileRawKeys('___nope___')).toEqual([]);
    expect(isRawEnabled('___nope___')).toBe(false);
    expect(profileOf('___nope___')).toBeNull();
  });

  test('profileRawKeys 는 사본 반환(원본 불변)', () => {
    const a = profileRawKeys('strut');
    a.push('Z');
    expect(profileRawKeys('strut')).toEqual(['A', 'B', 'C']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/raw-channels.spec.js -g "instrumentCatalog"`
Expected: FAIL — `Cannot find module '../src/profiles/instrumentCatalog.js'`

- [ ] **Step 3: Write minimal implementation**

`src/profiles/instrumentCatalog.js` (신규):
```js
// ─────────────────────────────────────────────────────────────────────────────
// instrumentCatalog — 백엔드 instrument-catalog.ts (GET /profiles) 의 부분 미러.
//   ⚠️ 정본은 백엔드. 여기는 펄스가 읽는 수동 동기화 사본(불일치 시 백엔드 GET /profiles 가 우선).
//   Phase 1: "한 파일 = 한 계측기 = N 원시열" 인 쉬운 프로파일만 rawChannels:true.
//   rawKeys 는 로거 값열 순서대로 매핑(열 순서 기준 — 설계 결정 Q3).
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Record<string, {label:string, rawKeys:string[], unit?:string, rawChannels:boolean}>} */
export const INSTRUMENT_PROFILES = {
  strut:          { label: '하중계(축력계)', rawKeys: ['A', 'B', 'C'], unit: '10³Hz²', rawChannels: true },
  vibration:      { label: '진동계',        rawKeys: ['X', 'Y', 'Z'], rawChannels: true },
  seismic:        { label: '지진계',        rawKeys: ['X', 'Y', 'Z'], rawChannels: true },
  optical_target: { label: '광파타겟',      rawKeys: ['N', 'E', 'Z'], unit: '좌표', rawChannels: true },
  pore_pressure:  { label: '간극수압계',     rawKeys: ['R'], unit: 'digit', rawChannels: true },
};

/** 프로파일 키 → 항목(없으면 null). */
export function profileOf(key) {
  return INSTRUMENT_PROFILES[key] || null;
}

/** 프로파일 키 → 원시 채널 키 목록의 사본(없으면 []). */
export function profileRawKeys(key) {
  const p = profileOf(key);
  return p && Array.isArray(p.rawKeys) ? [...p.rawKeys] : [];
}

/** 프로파일이 raw_channels 방출 대상인지(= 계측기별 순차 전환 플래그). */
export function isRawEnabled(key) {
  return !!(profileOf(key) && profileOf(key).rawChannels);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/raw-channels.spec.js -g "instrumentCatalog"`
Expected: PASS (3 passed)

- [ ] **Step 5: Checkpoint (커밋 대체)**

Run: `npx playwright test tests/raw-channels.spec.js`
Expected: PASS. 카탈로그 모듈이 독립적으로 통과하는지 확인 후 다음 태스크로.

---

## Task 2: resolveSensors — multiraw 그룹화

**Files:**
- Modify: `src/lib/sensorModel.js` (import 추가 + 비-깊이 `else` 분기 교체, 현재 80~118행)
- Test: `tests/raw-channels.spec.js`

- [ ] **Step 1: Write the failing test**

`tests/raw-channels.spec.js` 에 추가:
```js
import { resolveSensors } from '../src/lib/sensorModel.js';

// 헤더 + 데이터 1행으로 analysis 흉내 (columnCount = 전체 열 수)
const analysisOf = (header, row) => ({ columnCount: header.length, preview: [header, row] });

test.describe('resolveSensors — multiraw 그룹화', () => {
  test('strut 3값열 → 센서 1개(role multiraw, rawKeys A/B/C)', () => {
    const r = resolveSensors(analysisOf(['DateTime', '1', '2', '3'], ['2026-06-26 09:00', '8046', '7942', '8147']), { sensorType: 'strut', nodeId: 'N2' });
    expect(r.sensorCount).toBe(1);
    const s = r.sensors[0];
    expect(s.role).toBe('multiraw');
    expect(s.rawKeys).toEqual(['A', 'B', 'C']);
    expect(s.columns).toEqual([1, 2, 3]);
    expect(s.code).toBe('LC-1'); // strut 약어 LC
  });

  test('strut 인데 값열 2개(불일치) → 폴백 + 경고', () => {
    const r = resolveSensors(analysisOf(['DateTime', '1', '2'], ['2026-06-26 09:00', '1', '2']), { sensorType: 'strut', nodeId: 'N2' });
    expect(r.sensors.every((s) => s.role !== 'multiraw')).toBe(true);
    expect(r.integrity.some((i) => i.code === 'rawkey-count-mismatch')).toBe(true);
  });

  test('단일값(water_level)은 무변경 — 열마다 센서', () => {
    const r = resolveSensors(analysisOf(['DateTime', '1', '2', '3'], ['2026-06-26 09:00', '1', '2', '3']), { sensorType: 'water_level', nodeId: 'N1' });
    expect(r.sensorCount).toBe(3);
    expect(r.sensors.every((s) => s.role === 'value')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/raw-channels.spec.js -g "multiraw 그룹화"`
Expected: FAIL — strut 케이스가 `sensorCount` 1 아님(현재는 3센서), `role` 'multiraw' 아님.

- [ ] **Step 3: Write minimal implementation**

(3-a) `src/lib/sensorModel.js` 상단 import 에 카탈로그 추가 (현재 20행 아래):
```js
import { sensorChannelCode, guessSensorTypeFromCode } from './backendApi.js';
import { profileRawKeys, isRawEnabled } from '../profiles/instrumentCatalog.js';
```

(3-b) 비-깊이 `else { ... }` 블록(현재 80~118행)을 **아래로 전체 교체**:
```js
  } else {
    // 비깊이형 — 온도 열은 부속(센서 아님). 나머지 값 열마다 센서 1개.
    const isTemp = (i) => !!header && TEMP_RE.test(labels[i - 1] || '');
    const valueOnly = valueCols.filter((i) => !isTemp(i));
    const baseCols = valueOnly.length ? valueOnly : valueCols;

    // ★다채널 원시(Phase 1): 프로파일이 raw-enabled 이고 값열 개수 == rawKeys 길이면 센서 1개로 묶는다.
    //   (한 파일=한 계측기=N 원시열. 열 순서대로 key 매핑.) 그 외는 기존 per-column 동작 + 불일치 경고.
    const rawKeys = profileRawKeys(sensorType);
    if (isRawEnabled(sensorType) && rawKeys.length && baseCols.length === rawKeys.length) {
      const prefix = sensorChannelCode(sensorType);
      const headerCode = header ? String(header[baseCols[0]] || '').trim() : '';
      const code = prefix ? `${prefix}-1` : headerCode || `CH${baseCols[0]}`;
      sensors = [{ code, role: 'multiraw', ch: baseCols[0], seq: 1, sensorType, columns: [...baseCols], rawKeys: [...rawKeys], tempColumn: null }];
      pattern = pattern || 'multiraw';
    } else {
      if (isRawEnabled(sensorType) && rawKeys.length && baseCols.length !== rawKeys.length) {
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
        // ★채널 종류: 명시 override > 헤더 코드 추론 > 노드 대표(폴백). 코드 접두는 이 종류를 따라간다.
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
      // 죽은 열(샘플에서 전부 0) — 센서로는 유지하되 경고.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/raw-channels.spec.js -g "multiraw 그룹화"`
Expected: PASS (3 passed)

- [ ] **Step 5: Checkpoint (커밋 대체) — 기존 회귀 확인**

Run: `npx playwright test tests/pulse-v2.spec.js tests/sensor-code.spec.js`
Expected: PASS — 기존 번호형/이름형/깊이형 센서 해석이 깨지지 않았는지 확인(특히 80053 채널·깊이 프로파일 테스트).

---

## Task 3: syncNode — raw_channels 방출

**Files:**
- Modify: `src/lib/store.jsx` (`syncNode` 측정 빌드 분기, 현재 364~380행)
- Test: `tests/raw-channels.spec.js`

- [ ] **Step 1: Write the failing test**

`tests/raw-channels.spec.js` 에 추가 (기존 `tests/pulse-v2.spec.js` 의 ingest 테스트 패턴 차용 — strut 파일 등록 후 새로고침 시 raw_channels 전송):
```js
test.describe('syncNode — multiraw raw_channels 방출', () => {
  test('하중계 3열 → ingest measurement 에 raw_channels(A/B/C), value 없음, 빈셀 null 보존', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__ingest = [];
      const header = ['DateTime', '1', '2', '3'];
      const sample = ['2026-06-26 09:00:00', '8046', '7942', '8147'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: '하중계_N2.txt', fullPath: 'C:\\pulse\\incoming\\하중계_N2.txt', rowCount: 50, lastModified: '2026-06-26T09:00:00Z', header, sampleRow: sample },
        ],
        analyzeFile: async () => ({ encoding: 'UTF-8', rowCount: 50, columnCount: 4, delimiter: '쉼표 (,)', intervalGuess: 60, preview: [header, sample] }),
        listNodes: async () => ({ ok: true, status: 200, nodes: [] }),
        registerNode: async () => ({ ok: true, status: 201 }),
        // 행1: B 빈셀('') → null 보존. 행2: 정상.
        readMeasurements: async () => ({ ok: true, columnCount: 4, head: header, sample, rows: [
          { at: '2026-06-26 09:00', ts: 1000, cells: ['2026-06-26 09:00', '8046', '', '8147'] },
          { at: '2026-06-26 10:00', ts: 2000, cells: ['2026-06-26 10:00', '8050', '7945', '8150'] },
        ] }),
        ingest: async (p) => { window.__ingest.push(p); return { ok: true, status: 200 }; },
      };
    });
    await page.goto('/');
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await page.getByRole('button', { name: '등록', exact: true }).first().click();
    await page.getByRole('button', { name: '다음' }).click(); // 분석 → 채널 매핑
    // 계측기 종류 = 축력계(하중계 strut)
    await page.getByRole('button', { name: '(미지정)' }).first().click();
    await page.getByRole('button', { name: '축력계(버팀대)', exact: true }).click();
    await page.getByRole('button', { name: '다음' }).click(); // 매핑 → 확인
    await page.getByRole('button', { name: '등록 완료' }).click();
    await page.getByRole('button', { name: '새로고침' }).click();
    await page.waitForFunction(() => (window.__ingest || []).length >= 1);
    const call = (await page.evaluate(() => window.__ingest))[0];
    expect(call.channelCode).toBe('LC-1');
    // 측정마다 raw_channels(A/B/C), value 키 없음
    const m0 = call.measurements[0];
    expect(m0.value).toBeUndefined();
    expect(m0.raw_channels).toEqual([{ key: 'A', raw: 8046 }, { key: 'B', raw: null }, { key: 'C', raw: 8147 }]);
    const m1 = call.measurements[1];
    expect(m1.raw_channels).toEqual([{ key: 'A', raw: 8050 }, { key: 'B', raw: 7945 }, { key: 'C', raw: 8150 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/raw-channels.spec.js -g "raw_channels 방출"`
Expected: FAIL — measurement 에 `raw_channels` 없음(현재는 `value` 만 보냄).

- [ ] **Step 3: Write minimal implementation**

`src/lib/store.jsx` 의 `syncNode` 측정 빌드(현재 365~380행, `if (s.role === 'profile' ...) { ... } else { ... }`)를 **아래로 교체**(중간에 multiraw 분기 삽입):
```js
      let measurements;
      if (s.role === 'profile' && s.depthProfile?.points) {
        // 깊이 프로파일: 행 × 깊이열 → 깊이별 측정값(depthLabel = 깊이 코드)
        measurements = [];
        rows.forEach((row) => {
          (s.columns || []).forEach((col, k) => {
            const value = num(row.cells[col]);
            if (value === undefined) return; // 열 누락만 스킵; null(결측)은 보존 전송
            measurements.push({ measuredAt: toIso(row.at), value, depthLabel: s.depthProfile.points[k]?.code });
          });
        });
      } else if (s.role === 'multiraw' && Array.isArray(s.rawKeys)) {
        // 다채널 원시: 행마다 raw_channels[{key,raw}]. value 는 안 보냄(백엔드가 계산).
        //   열 누락(undefined)만 제외; 빈셀·비숫자(null=결측)는 보존. 전부 누락이면 그 행 스킵.
        measurements = rows
          .map((row) => ({
            measuredAt: toIso(row.at),
            raw_channels: (s.columns || [])
              .map((col, i) => ({ key: s.rawKeys[i], raw: num(row.cells[col]) }))
              .filter((rc) => rc.raw !== undefined),
          }))
          .filter((m) => m.raw_channels.length);
      } else {
        const col = (s.columns && s.columns[0]) ?? s.ch;
        measurements = rows
          .map((row) => ({ measuredAt: toIso(row.at), value: num(row.cells[col]) }))
          .filter((m) => m.value !== undefined); // 열 누락만 제외; null(결측)은 보존 전송
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/raw-channels.spec.js -g "raw_channels 방출"`
Expected: PASS (1 passed)

- [ ] **Step 5: Checkpoint (커밋 대체)**

Run: `npx playwright test tests/raw-channels.spec.js`
Expected: PASS — 신규 스펙 전체(카탈로그 3 + resolveSensors 3 + 방출 1) 그린.

---

## Task 4: 전체 회귀 + 빌드 검증

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: PASS — 기존 44 + 신규 7 모두 그린, 회귀 0.

- [ ] **Step 2: 빌드 확인(렌더러 번들)**

Run: `npm run dev:web` 로 dev 서버 기동 후 콘솔 에러 없음 확인(또는 `npx vite build` 가 0에러).
Expected: 번들 에러 없음. (신규 import `../profiles/instrumentCatalog.js` 경로 해석 확인.)

- [ ] **Step 3: 최종 점검**

- `value`/`raw_channels` 병행: 단일값 노드는 여전히 `value`, 하중계는 `raw_channels` — 둘 다 한 빌드에서 공존(동시 배포 전환기 요건 충족).
- 설계 §7 범위 밖(형제 분할·지중경사 중첩·다중 계측기) 미구현 확인 — 해당 케이스는 폴백+경고로 안전.

---

## 완료 기준
- [ ] `src/profiles/instrumentCatalog.js` 생성, 5개 Phase 1 프로파일 + 헬퍼.
- [ ] `resolveSensors` multiraw 분기 — 일치 시 센서 1개, 불일치 시 폴백+경고, 단일값/깊이형 무변경.
- [ ] `syncNode` multiraw → `raw_channels` 방출(null 보존, value 없음), 단일값 무변경.
- [ ] 신규 7 테스트 + 기존 44 회귀 0, 빌드 0에러.
