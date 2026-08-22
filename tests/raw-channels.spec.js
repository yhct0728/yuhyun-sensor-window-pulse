import { test, expect } from '@playwright/test';
import { profileOf, profileRawKeys, isRawEnabled, profilePoint, profileChannels, profileOutputs } from '../src/lib/instrumentCatalog.js';
import { resolveSensors } from '../src/lib/sensorModel.js';

// 헤더 + 데이터 1행으로 analysis 흉내 (columnCount = 전체 열 수)
const analysisOf = (header, row) => ({ columnCount: header.length, preview: [header, row] });

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

  test('카탈로그 정합(2026-06-26) — anchor(EA하중계) 추가, optical_target 제거', () => {
    // anchor = EA하중계: strut(ST하중계)과 동일 raw 구조지만 별도 키(카탈로그 17키)
    expect(profileRawKeys('anchor')).toEqual(['A', 'B', 'C']);
    expect(isRawEnabled('anchor')).toBe(true);
    // optical_target 은 잘못된 키 — 카탈로그 정본은 survey_3d(siblings, Phase 2) → 미러에서 제거
    expect(profileOf('optical_target')).toBeNull();
  });

  test('Phase 2 — point/channels/outputs 헬퍼', () => {
    expect(profilePoint('strut')).toBe('single');
    expect(profilePoint('tilt')).toBe('siblings');
    expect(profilePoint('___nope___')).toBeNull();
    expect(profileOutputs('tilt')).toEqual([
      { suffix: 'X', raw: ['A0', 'A180'] },
      { suffix: 'Y', raw: ['B0', 'B180'] },
    ]);
    expect(profileChannels('tilt')).toEqual([
      { key: 'A0', col: 0 }, { key: 'A180', col: 1 }, { key: 'B0', col: 2 }, { key: 'B180', col: 3 },
    ]);
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
});

test.describe('resolveSensors — multiraw 그룹화', () => {
  test('strut 3값열 → 센서 1개(role multiraw, rawKeys A/B/C)', () => {
    const r = resolveSensors(analysisOf(['DateTime', '1', '2', '3'], ['2026-06-26 09:00', '8046', '7942', '8147']), { sensorType: 'strut', nodeId: 'N2' });
    expect(r.sensorCount).toBe(1);
    const s = r.sensors[0];
    expect(s.role).toBe('multiraw');
    expect(s.rawKeys).toEqual(['A', 'B', 'C']);
    expect(s.columns).toEqual([1, 2, 3]);
    expect(s.code).toBe('LC-1'); // strut 약어 'LC' — backendApi.sensorChannelCode('strut')
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

  test('strut 3값열 + 온도열 → 온도 무시하고 multiraw 1개(A/B/C)', () => {
    const r = resolveSensors(analysisOf(['DateTime', 'A', 'B', 'C', 'Temp'], ['2026-06-26 09:00', '8046', '7942', '8147', '21.5']), { sensorType: 'strut', nodeId: 'N2' });
    expect(r.sensorCount).toBe(1);
    expect(r.sensors[0].role).toBe('multiraw');
    expect(r.sensors[0].rawKeys).toEqual(['A', 'B', 'C']);
    expect(r.sensors[0].columns).toEqual([1, 2, 3]); // 4번열(Temp)은 isTemp 로 제외되어 baseCols=[1,2,3]
  });

  test('anchor(EA하중계) 3값열 → multiraw 1개(code EA-1)', () => {
    const r = resolveSensors(analysisOf(['DateTime', 'A', 'B', 'C'], ['2026-06-26 09:00', '8046', '7942', '8147']), { sensorType: 'anchor', nodeId: 'EA1' });
    expect(r.sensorCount).toBe(1);
    expect(r.sensors[0].role).toBe('multiraw');
    expect(r.sensors[0].code).toBe('EA-1'); // anchor 약어 'EA'
    expect(r.sensors[0].rawKeys).toEqual(['A', 'B', 'C']);
  });

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
    expect(r.sensors.map((s) => s.role)).toEqual(['multiraw', 'multiraw']);
    expect(r.sensors.map((s) => s.columns)).toEqual([[1], [2]]);
    expect(r.sensors.map((s) => s.rawKeys)).toEqual([['WD'], ['WS']]);
  });

  test('thermo_hygro 2열 → 형제 2센서(TH-T, TH-H)', () => {
    const r = resolveSensors(analysisOf(['DateTime', 'T', 'H'], ['t', '21.5', '60']), { sensorType: 'thermo_hygro', nodeId: 'TH1' });
    expect(r.sensors.map((s) => s.code)).toEqual(['TH-T', 'TH-H']);
    expect(r.sensors.map((s) => s.rawKeys)).toEqual([['T'], ['H']]);
  });

  test('tilt 인데 열 부족(3열) → 경고 + 형제 분할 안 함', () => {
    const r = resolveSensors(analysisOf(['DateTime', 'A0', 'A180'], ['t', '1', '2']), { sensorType: 'tilt', nodeId: 'T1' });
    expect(r.sensors.every((s) => !/^BT-[XY]$/.test(s.code))).toBe(true);
    expect(r.integrity.some((i) => i.code === 'siblings-col-out-of-range')).toBe(true);
  });
});

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
    // 분석 → 채널 매핑 (하중계 파일명 → guessSensorType 이 이미 'strut' 로 추론)
    await page.getByRole('button', { name: '다음' }).click();
    // 채널 매핑 → 확인 (sensorType 이미 설정됨 — 추가 선택 불필요)
    await page.getByRole('button', { name: '다음' }).click();
    await page.getByRole('button', { name: '등록 완료' }).click();
    await page.getByRole('button', { name: '새로고침' }).click();
    await page.waitForFunction(() => (window.__ingest || []).length >= 1);
    const call = (await page.evaluate(() => window.__ingest))[0];
    expect(call.channelCode).toBe('LC-1');
    expect(call.measurements.length).toBe(2); // 두 행 모두 전송(축력계=strut 경로 확인)
    const m0 = call.measurements[0];
    expect(m0.value).toBeUndefined();
    expect(m0.raw_channels).toEqual([{ key: 'A', raw: 8046 }, { key: 'B', raw: null }, { key: 'C', raw: 8147 }]);
    const m1 = call.measurements[1];
    expect(m1.raw_channels).toEqual([{ key: 'A', raw: 8050 }, { key: 'B', raw: 7945 }, { key: 'C', raw: 8150 }]);
    expect(m1.value).toBeUndefined();
  });

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
});
