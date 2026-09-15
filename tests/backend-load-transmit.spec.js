// ─────────────────────────────────────────────────────────────────────────────
// 서버에서 불러온 노드의 전송 (2026-09-15)
//
// 사고: 백엔드 6월 개편으로 계측기 종류가 센서(채널) 단위로만 남고 노드 응답의
//   sensor_type 이 사라졌다. 펄스는 노드 sensor_type 만 읽어 종류가 빈 노드를 만들었고,
//   자동 전송은 종류 없는 노드를 **조용히 건너뛰었다**. 그런데 불러온 노드엔
//   transmit:'sent' 를 무조건 붙여서 화면은 "전송 완료" — 실사용 5개 노드가 멈춘 채 방치됐다.
//
// 정한 규칙:
//   1. 노드 종류가 없으면 채널 종류 다수결로 채운다 (센서 구성 계산 전에).
//   2. "전송 완료"는 실제로 보낼 것이 없을 때만 — 불러왔다는 사실만으로 붙이지 않는다.
//   3. 전송할 수 없으면 "전송 불가"와 이유를 보여준다. 조용히 건너뛰지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';

/**
 * 감시폴더 파일 1개 + 같은 ID의 백엔드 노드 1개.
 * @param {object} o
 * @param {object} o.backendNode  GET /nodes 응답의 노드 1건 (node_code 는 'node-1' 고정)
 * @param {object[]} o.rows       readMeasurements 가 돌려줄 신규 행
 */
function mockLoadedNode(page, { backendNode, rows }) {
  return page.addInitScript((o) => {
    try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch { /* noop */ }
    window.__ingest = [];
    const header = ['DateTime', '1'];
    const sample = ['2026-09-01 09:00:00', '1.1'];
    const files = [{
      fileName: 'node-1.txt', fullPath: 'C:\\pulse\\incoming\\node-1.txt',
      rowCount: 10, lastModified: new Date().toISOString(), header, sampleRow: sample,
      periodStart: '2026-09-01T00:00:00.000Z', periodEnd: new Date().toISOString(),
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
        encoding: 'UTF-8', rowCount: 10, columnCount: 2, delimiter: '쉼표 (,)',
        intervalGuess: 60, preview: [header, sample],
      }),
      listNodes: async () => ({ ok: true, status: 200, nodes: [{ node_code: 'node-1', name: 'node-1', report_interval_min: 60, last_seen: null, ...o.backendNode }] }),
      readMeasurements: async () => ({ ok: true, columnCount: 2, head: header, sample, rows: o.rows }),
      ingest: async (p) => { window.__ingest.push(p); return { ok: true, status: 200 }; },
    };
  }, { backendNode, rows });
}

const NEW_ROWS = [
  { at: '2026-09-15 09:00', ts: 1000, cells: ['2026-09-15 09:00', '1.1'] },
  { at: '2026-09-15 10:00', ts: 2000, cells: ['2026-09-15 10:00', '1.2'] },
];

test.describe('서버에서 불러온 노드 — 전송', () => {
  test('노드 sensor_type 이 없어도 채널 종류로 채워 전송한다', async ({ page }) => {
    await mockLoadedNode(page, {
      // 6월 개편 후 실서버 형태: 종류는 채널에만 있다
      backendNode: { channels: [{ ch: 1, code: 'WL-1', sensor_type: 'water_level' }] },
      rows: NEW_ROWS,
    });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    await page.getByRole('button', { name: '새로고침' }).click();
    await page.waitForFunction(() => (window.__ingest || []).length >= 1, null, { timeout: 10000 });
    const calls = await page.evaluate(() => window.__ingest);
    expect(calls.map((c) => c.channelCode)).toEqual(['WL-1']);
    expect(calls[0].measurements.length).toBe(2);
  });

  test('불러오기만 한 노드에 "전송 완료"를 붙이지 않는다', async ({ page }) => {
    await mockLoadedNode(page, {
      backendNode: { sensor_type: 'water_level', channels: [{ ch: 1, code: 'WL-1', sensor_type: 'water_level' }] },
      rows: NEW_ROWS,
    });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    // 아직 한 건도 안 보냈다 — 서버에 등록돼 있다는 것만으로 "전송 완료"가 아니다
    await expect(page.getByText('전송 완료')).toHaveCount(0);
  });

  test('보낼 새 데이터가 없으면 "전송 완료"로 표시한다', async ({ page }) => {
    await mockLoadedNode(page, {
      backendNode: { sensor_type: 'water_level', channels: [{ ch: 1, code: 'WL-1', sensor_type: 'water_level' }] },
      rows: [],
    });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    await page.getByRole('button', { name: '새로고침' }).click();
    await expect(page.getByText('전송 완료').first()).toBeVisible();
  });

  test('종류를 알 수 없어 못 보내면 "전송 불가"와 이유를 보여준다', async ({ page }) => {
    await mockLoadedNode(page, {
      backendNode: { channels: [{ ch: 1, code: 'WL-1' }] }, // 노드에도 채널에도 종류 없음
      rows: NEW_ROWS,
    });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    await page.getByRole('button', { name: '새로고침' }).click();
    await expect(page.getByText('전송 불가').first()).toBeVisible();
    await expect(page.getByTitle(/계측기 종류 미지정/).first()).toBeVisible();
    await expect(page.getByText('전송 완료')).toHaveCount(0);
    expect(await page.evaluate(() => window.__ingest.length)).toBe(0);
  });
});
