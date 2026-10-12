import { test, expect } from '@playwright/test';
import { resolveSensors } from '../src/lib/sensorModel.js';

// 구조물 경사계(tilt): 값 열 2개 = 경사계 1대의 X·Y (ADR-0022).
//   4값열 = 2대, 6값열 = 3대. 각 열은 일반 값(value) 센서 — 서버가 못 읽는 raw_channels 로 보내지 않는다.

// 헤더 + 데이터 1행으로 analysis 흉내 (columnCount = 전체 열 수)
const analysisOf = (header, row) => ({ columnCount: header.length, preview: [header, row] });
const tilt = (header, row, opts = {}) => resolveSensors(analysisOf(header, row), { sensorType: 'tilt', nodeId: 'T1', ...opts });

test.describe('resolveSensors — 경사계 2열 = 1대(X·Y)', () => {
  test('4값열 → 경사계 2대, 센서 4개(BT-1-X, BT-1-Y, BT-2-X, BT-2-Y)', () => {
    const r = tilt(['DateTime', '1', '2', '3', '4'], ['2026-10-12 09:00', '0.12', '-0.03', '0.40', '0.08']);
    expect(r.sensors.map((s) => s.code)).toEqual(['BT-1-X', 'BT-1-Y', 'BT-2-X', 'BT-2-Y']);
    expect(r.sensors.map((s) => s.columns)).toEqual([[1], [2], [3], [4]]);
    expect(r.sensors.every((s) => s.role === 'value')).toBe(true);
    expect(r.sensors.every((s) => s.sensorType === 'tilt')).toBe(true);
    expect(r.sensorCount).toBe(4);
  });

  test('6값열 → 경사계 3대, 5·6열도 버리지 않는다', () => {
    const r = tilt(['DateTime', '1', '2', '3', '4', '5', '6'], ['2026-10-12 09:00', '1', '2', '3', '4', '5', '6']);
    expect(r.sensors.map((s) => s.code)).toEqual(['BT-1-X', 'BT-1-Y', 'BT-2-X', 'BT-2-Y', 'BT-3-X', 'BT-3-Y']);
    expect(r.sensors.map((s) => s.columns)).toEqual([[1], [2], [3], [4], [5], [6]]);
  });

  test('2값열 → 경사계 1대(BT-1-X, BT-1-Y)', () => {
    const r = tilt(['DateTime', '1', '2'], ['2026-10-12 09:00', '0.1', '0.2']);
    expect(r.sensors.map((s) => s.code)).toEqual(['BT-1-X', 'BT-1-Y']);
  });

  test('묶었다는 안내를 남긴다(등록 화면 표시용)', () => {
    const r = tilt(['DateTime', '1', '2', '3', '4'], ['2026-10-12 09:00', '1', '2', '3', '4']);
    const note = r.integrity.find((i) => i.code === 'tilt-pairs');
    expect(note?.level).toBe('info');
    expect(note?.message).toContain('2대');
  });

  test('홀수 값열(3개) → 경고 + 묶지 않고 열마다 센서(값은 버리지 않음)', () => {
    const r = tilt(['DateTime', '1', '2', '3'], ['2026-10-12 09:00', '1', '2', '3']);
    expect(r.sensors.map((s) => s.code)).toEqual(['BT-1', 'BT-2', 'BT-3']);
    expect(r.integrity.some((i) => i.code === 'tilt-odd-columns' && i.level === 'warn')).toBe(true);
  });

  test('온도열은 쌍에서 제외한다(값 4열 + 온도 1열 → 2대)', () => {
    const r = tilt(['DateTime', 'X1', 'Y1', 'X2', 'Y2', 'Temp'], ['2026-10-12 09:00', '1', '2', '3', '4', '21.5']);
    expect(r.sensors.map((s) => s.code)).toEqual(['BT-1-X', 'BT-1-Y', 'BT-2-X', 'BT-2-Y']);
  });

  test('한 채널을 다른 종류로 바꾸면 묶지 않는다(종류 혼재 = 열마다 센서)', () => {
    const r = tilt(['DateTime', '1', '2', '3', '4'], ['2026-10-12 09:00', '1', '2', '3', '4'], { channelTypes: { 2: 'crack' } });
    expect(r.sensors.map((s) => s.code)).toEqual(['BT-1', 'CR-2', 'BT-3', 'BT-4']);
    expect(r.integrity.some((i) => i.code === 'tilt-pairs')).toBe(false);
  });
});

test.describe('경사계 등록·전송 — 쌍 센서를 일반 값으로', () => {
  test('6값 파일 → 등록 채널 6개 + 센서마다 value 전송(raw_channels 없음)', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__ingest = [];
      window.__register = [];
      const header = ['DateTime', '1', '2', '3', '4', '5', '6'];
      const sample = ['2026-10-12 09:00:00', '10', '20', '30', '40', '50', '60'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: '구조물경사계_T1.txt', fullPath: 'C:\\pulse\\incoming\\구조물경사계_T1.txt', rowCount: 10, lastModified: '2026-10-12T09:00:00Z', header, sampleRow: sample },
        ],
        analyzeFile: async () => ({ encoding: 'UTF-8', rowCount: 10, columnCount: 7, delimiter: '쉼표 (,)', intervalGuess: 60, preview: [header, sample] }),
        listNodes: async () => ({ ok: true, status: 200, nodes: [] }),
        registerNode: async (p) => { window.__register.push(p); return { ok: true, status: 201 }; },
        readMeasurements: async () => ({ ok: true, columnCount: 7, head: header, sample, rows: [
          { at: '2026-10-12 09:00', ts: 1000, cells: ['2026-10-12 09:00', '10', '20', '30', '40', '50', '60'] },
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
    await page.waitForFunction(() => (window.__ingest || []).length >= 6);

    const codes = ['BT-1-X', 'BT-1-Y', 'BT-2-X', 'BT-2-Y', 'BT-3-X', 'BT-3-Y'];
    const reg = (await page.evaluate(() => window.__register))[0];
    expect(reg.channels.map((c) => c.code)).toEqual(codes);

    const calls = await page.evaluate(() => window.__ingest);
    const byCode = Object.fromEntries(calls.map((c) => [c.channelCode, c.measurements[0]]));
    expect(Object.keys(byCode).sort()).toEqual(codes);
    expect(codes.map((c) => byCode[c].value)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(calls.every((c) => c.measurements.every((m) => m.raw_channels === undefined))).toBe(true);
  });
});
