// ─────────────────────────────────────────────────────────────────────────────
// 처음부터 다시 보내기 (ADR-0023)
//
// 평소 전송은 "마지막 전송 시각 뒤의 행"만 보낸다. 그 시각보다 앞선 행이 서버에 빠져 있으면
//   다시 보낼 길이 없었다(원본 .txt 를 고쳐도 시각이 앞이라 건너뛴다).
// 이 버튼은 파일 전체를 다시 보낸다. 서버 ingest 가 멱등이라 없는 시각만 채워지고
//   이미 있는 값은 바뀌지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';

const WATERMARK = Date.parse('2026-09-15T10:00:00.000Z'); // 서버가 마지막으로 받은 시각
const HOUR = 3600000;

/**
 * 감시폴더 파일 1개(3행: 워터마크 앞 2행 + 뒤 1행) + 같은 ID의 백엔드 노드 1개.
 * @param {object} [o]
 * @param {number} [o.inserted]   ingest 응답의 inserted (서버에 새로 들어간 건수). 생략 시 응답에 없음
 * @param {boolean} [o.failFull]  파일 전체(3행) 전송만 실패시킨다
 */
function mock(page, o = {}) {
  return page.addInitScript(({ watermark, hour, inserted, failFull }) => {
    try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch { /* noop */ }
    window.__ingest = [];
    window.__reads = [];
    const header = ['DateTime', '1'];
    const sample = ['2026-09-15 08:00:00', '1.0'];
    const rows = [
      { at: '2026-09-15 08:00', ts: watermark - 2 * hour, cells: ['2026-09-15 08:00', '1.0'] },
      { at: '2026-09-15 09:00', ts: watermark - hour, cells: ['2026-09-15 09:00', '1.1'] },
      { at: '2026-09-15 11:00', ts: watermark + hour, cells: ['2026-09-15 11:00', '1.3'] },
    ];
    const files = [{
      fileName: 'node-1.txt', fullPath: 'C:\\pulse\\incoming\\node-1.txt',
      rowCount: 3, lastModified: new Date().toISOString(), header, sampleRow: sample,
    }];
    window.electronAPI = {
      getDefaultFolder: async () => 'C:\\pulse',
      getRootFolder: async () => 'C:\\pulse\\incoming',
      setRootFolder: async (p) => p,
      resetToDefault: async () => 'C:\\pulse',
      validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
      pickFolder: async () => null,
      scanFolder: async () => files,
      analyzeFile: async () => ({
        encoding: 'UTF-8', rowCount: 3, columnCount: 2, delimiter: '쉼표 (,)',
        intervalGuess: 60, preview: [header, sample],
      }),
      listNodes: async () => ({ ok: true, status: 200, nodes: [{
        node_code: 'node-1', name: 'node-1', report_interval_min: 60,
        last_seen: new Date(watermark).toISOString(),
        sensor_type: 'water_level', channels: [{ ch: 1, code: 'WL-1', sensor_type: 'water_level' }],
      }] }),
      // 실제 메인 프로세스와 같은 규칙: sinceTs 보다 뒤(>) 행만
      readMeasurements: async (fullPath, sinceTs = 0) => {
        window.__reads.push(sinceTs);
        return { ok: true, columnCount: 2, head: header, sample, rows: rows.filter((r) => r.ts > sinceTs) };
      },
      ingest: async (p) => {
        window.__ingest.push(p);
        if (failFull && p.measurements.length === 3) return { ok: false, status: 500, error: 'http_500' };
        return inserted === undefined ? { ok: true, status: 200 } : { ok: true, status: 200, inserted };
      },
    };
  }, { watermark: WATERMARK, hour: HOUR, inserted: o.inserted, failFull: !!o.failFull });
}

/** 노드 상세 드로어 → 전송 큐 탭 */
async function openTransmitTab(page) {
  await page.goto('/');
  await page.getByText('node-1').first().click();
  await page.locator('aside').last().getByRole('button', { name: '전송 큐' }).click();
}

const resendButton = (page) => page.getByRole('button', { name: '처음부터 다시 보내기' });

test.describe('처음부터 다시 보내기', () => {
  test('평소 전송은 마지막 전송 시각 뒤의 행만 보낸다(앞선 행은 건너뜀)', async ({ page }) => {
    await mock(page);
    await openTransmitTab(page);
    await page.getByRole('button', { name: '지금 재전송' }).click();
    await page.waitForFunction(() => (window.__ingest || []).length >= 1);

    const calls = await page.evaluate(() => window.__ingest);
    expect(calls).toHaveLength(1);
    expect(calls[0].measurements.map((m) => m.value)).toEqual([1.3]);
  });

  test('버튼을 누르면 파일 전체(앞선 행 포함)를 다시 보낸다', async ({ page }) => {
    await mock(page);
    await openTransmitTab(page);
    await resendButton(page).click();
    await page.waitForFunction(() => (window.__ingest || []).length >= 1);

    const calls = await page.evaluate(() => window.__ingest);
    expect(calls).toHaveLength(1);
    expect(calls[0].channelCode).toBe('WL-1');
    expect(calls[0].measurements.map((m) => m.value)).toEqual([1.0, 1.1, 1.3]);
    expect(await page.evaluate(() => window.__reads)).toEqual([0]); // 워터마크 무시 = 처음부터
  });

  test('서버에 새로 채워진 건수를 알려준다', async ({ page }) => {
    await mock(page, { inserted: 2 });
    await openTransmitTab(page);
    await resendButton(page).click();

    await expect(page.getByText(/파일 전체 3행을 다시 보냈습니다/)).toBeVisible();
    await expect(page.getByText(/새로 채워진 값 2건/)).toBeVisible();
  });

  test('서버에 이미 전부 있으면 빠진 값이 없었다고 알려준다', async ({ page }) => {
    await mock(page, { inserted: 0 });
    await openTransmitTab(page);
    await resendButton(page).click();

    await expect(page.getByText(/빠진 값이 없었습니다/)).toBeVisible();
  });

  test('보낸 뒤에도 전송 큐 탭에 그대로 머문다(탭이 처음으로 튀지 않음)', async ({ page }) => {
    await mock(page, { inserted: 2 });
    await openTransmitTab(page);
    await resendButton(page).click();
    await expect(page.getByText(/파일 전체 3행을 다시 보냈습니다/)).toBeVisible();

    await expect(resendButton(page)).toBeVisible();
    await expect(resendButton(page)).toBeEnabled();
  });

  test('다시 보낸 뒤 평소 전송은 다시 새 행만 본다(매번 전체를 보내지 않음)', async ({ page }) => {
    await mock(page, { inserted: 2 });
    await openTransmitTab(page);
    await resendButton(page).click();
    await expect(page.getByText(/파일 전체 3행을 다시 보냈습니다/)).toBeVisible();

    await page.getByRole('button', { name: '지금 재전송' }).click();
    await expect(page.getByText('전송할 새 데이터가 없습니다')).toBeVisible();
    const reads = await page.evaluate(() => window.__reads);
    expect(reads[reads.length - 1]).toBe(WATERMARK + HOUR); // 파일의 마지막 행 시각
    expect(await page.evaluate(() => window.__ingest.length)).toBe(1);
  });

  test('실패하면 실패라고 알리고 전송 상태를 건드리지 않는다', async ({ page }) => {
    await mock(page, { failFull: true });
    await openTransmitTab(page);
    await resendButton(page).click();

    await expect(page.getByText(/다시 보내기 실패/)).toBeVisible();
    // 평소 전송 흐름은 그대로: 버퍼가 파일 전체 행수로 부풀지 않고, 다음 전송은 새 행만 본다
    await expect(page.locator('aside').last().getByText('버퍼 행').locator('..')).toContainText('0');
    await page.getByRole('button', { name: '지금 재전송' }).click();
    await page.waitForFunction(() => (window.__ingest || []).length >= 2);
    const calls = await page.evaluate(() => window.__ingest);
    expect(calls[1].measurements.map((m) => m.value)).toEqual([1.3]);
  });
});
