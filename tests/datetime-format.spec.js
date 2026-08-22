// ─────────────────────────────────────────────────────────────────────────────
// 절대 시각 표기 (2026-08-22)
//
// "13일 전" 같은 상대시간만으로는 실제 날짜를 알 수 없다. 계측 보고에서는
// **언제인지**가 중요하다(다른 기록과 대조, 보고서에 옮겨 적기).
//
// 정한 규칙: 절대 시각을 주(主), 상대시간을 보조로 함께 보여준다.
//   2026-08-09 14:00
//   13일 전            ← 얼마나 오래됐는지는 한눈에 읽히는 게 여전히 유용
//
// 예외: "N분 전 확인함"(헤더의 자동 확인 표시)은 지금 이 순간과의 거리 자체가
//   정보라 상대시간을 유지한다.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { fmtDateTime } from '../src/lib/format.js';

const rowOf = (page, nodeId) => page.getByRole('row').filter({ hasText: nodeId });

// 로컬 시각 기준 고정 시점 (문자열에 타임존이 없으므로 벽시계 그대로 해석된다)
const FIXED = '2026-08-09 14:05:00';

function mock(page, { lastData }) {
  return page.addInitScript((o) => {
    try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch { /* noop */ }
    const header = ['DateTime', '1'];
    const sample = ['2026-08-01 09:00:00', '1.1'];
    window.electronAPI = {
      getDefaultFolder: async () => 'C:\\pulse',
      getRootFolder: async () => 'C:\\pulse\\incoming',
      setRootFolder: async (p) => p,
      resetToDefault: async () => 'C:\\pulse',
      validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
      pickFolder: async () => null,
      scanFolder: async () => [{
        fileName: 'node-1.txt', fullPath: 'C:\\pulse\\incoming\\node-1.txt',
        rowCount: 10, lastModified: o.lastData, header, sampleRow: sample,
        periodStart: '2026-08-01T00:00:00.000Z', periodEnd: o.lastData,
      }],
      analyzeFile: async () => ({
        encoding: 'UTF-8', rowCount: 10, columnCount: 2, delimiter: '쉼표 (,)',
        intervalGuess: 60, preview: [header, sample],
      }),
      listNodes: async () => ({ ok: true, status: 200, nodes: [
        { node_code: 'node-1', sensor_type: 'water_level', name: 'node-1',
          report_interval_min: 60, last_seen: null, channels: [{ ch: 1, code: 'WL-1' }] },
      ] }),
      readMeasurements: async () => ({ ok: true, columnCount: 2, head: header, sample, rows: [] }),
      ingest: async () => ({ ok: true, status: 200 }),
    };
  }, { lastData });
}

test.describe('fmtDateTime — 순수 함수', () => {
  test('epoch ms / ISO 둘 다 YYYY-MM-DD HH:mm 으로', () => {
    const ms = new Date(2026, 7, 9, 14, 5).getTime(); // 2026-08-09 14:05 (로컬)
    expect(fmtDateTime(ms)).toBe('2026-08-09 14:05');
    expect(fmtDateTime(new Date(ms).toISOString())).toBe('2026-08-09 14:05');
  });

  test('한 자리 월/일/시/분에 0 을 채운다', () => {
    expect(fmtDateTime(new Date(2026, 0, 3, 9, 7).getTime())).toBe('2026-01-03 09:07');
  });

  test('날짜만 필요할 때', () => {
    expect(fmtDateTime(new Date(2026, 7, 9, 14, 5).getTime(), { withTime: false })).toBe('2026-08-09');
  });

  test('값이 없거나 못 읽으면 —', () => {
    expect(fmtDateTime(null)).toBe('—');
    expect(fmtDateTime('그런날짜없음')).toBe('—');
  });
});

test.describe('화면 — 마지막 수신을 날짜로 표시', () => {
  test('노드 표에 YYYY-MM-DD 가 보인다', async ({ page }) => {
    await mock(page, { lastData: new Date(2026, 7, 9, 14, 5).toISOString() });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    await expect(rowOf(page, 'node-1')).toContainText('2026-08-09');
  });

  test('상대시간도 함께 남아 있다 (얼마나 오래됐는지 한눈에)', async ({ page }) => {
    await mock(page, { lastData: new Date(2026, 7, 9, 14, 5).toISOString() });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    // 행 전체 텍스트에 상대시간 조각이 들어있으면 된다 (행 끝일 필요는 없다)
    await expect(rowOf(page, 'node-1')).toContainText(/\d+(일|시간|분) 전|방금/);
  });

  test('노드 상세에도 날짜로 나온다', async ({ page }) => {
    await mock(page, { lastData: new Date(2026, 7, 9, 14, 5).toISOString() });
    await page.goto('/');
    await page.getByText('node-1').first().click();

    await expect(page.getByText('마지막 데이터').first()).toBeVisible();
    await expect(page.getByText('2026-08-09').first()).toBeVisible();
  });
});
