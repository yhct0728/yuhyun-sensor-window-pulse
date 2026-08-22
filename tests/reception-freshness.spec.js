// ─────────────────────────────────────────────────────────────────────────────
// 수신 판정 신선도 (2026-08-22)
//
// 두 가지 결함:
//   (A) reception(수신중/지연/끊김)이 **시간이 지나도 재계산되지 않는다.**
//       buildNode / applyFileTimes / updateNodeInterval 에서만 계산되므로,
//       앱을 켜둔 채 두면 실제로 끊겨도 화면은 "수신중"에 멈춰 있다.
//       알림이 이 판정을 기준으로 나가므로 그대로 두면 사고를 놓친다.
//
//   (B) 수신과 전송이 뒤섞여 있다. syncNode 는 **전송에 성공했을 때만**
//       lastRx 를 갱신한다. 백엔드가 죽어 있으면 파일에 새 데이터가 들어와도
//       "끊김"으로 보인다 — 받는 것과 보내는 것은 별개인데.
//       (reception.js 주석부터가 "수신과 전송은 별개"라고 명시하고 있다)
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';

/**
 * 노드 표에서 그 노드의 행만 집는다.
 * ⚠️ page.getByText('끊김') 를 그냥 쓰면 툴바의 **필터 칩**('전체/수신중/지연/끊김')이
 *    잡혀서 항상 통과해버린다. 반드시 행으로 좁혀야 진짜 판정을 본다.
 */
const rowOf = (page, nodeId) => page.getByRole('row').filter({ hasText: nodeId });

/**
 * @param {object} o
 * @param {string} o.dataEnd   파일 안 마지막 데이터 시각
 * @param {boolean} o.ingestOk 백엔드 전송 성공 여부
 */
function mock(page, { dataEnd, ingestOk, freshData = false }) {
  return page.addInitScript((o) => {
    try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch { /* noop */ }
    window.__ingest = [];
    const header = ['DateTime', '1'];
    const sample = ['2026-08-22 09:00:00', '1.1'];
    window.electronAPI = {
      getDefaultFolder: async () => 'C:\\pulse',
      getRootFolder: async () => 'C:\\pulse\\incoming',
      setRootFolder: async (p) => p,
      resetToDefault: async () => 'C:\\pulse',
      validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
      pickFolder: async () => null,
      scanFolder: async () => [{
        fileName: 'node-1.txt', fullPath: 'C:\\pulse\\incoming\\node-1.txt',
        rowCount: 10, lastModified: o.dataEnd, header, sampleRow: sample,
        periodStart: '2026-08-01T00:00:00.000Z', periodEnd: o.dataEnd,
      }],
      analyzeFile: async () => ({
        encoding: 'UTF-8', rowCount: 10, columnCount: 2, delimiter: '쉼표 (,)',
        intervalGuess: 60, preview: [header, sample],
      }),
      listNodes: async () => ({ ok: true, status: 200, nodes: [
        { node_code: 'node-1', sensor_type: 'water_level', name: 'node-1',
          report_interval_min: 60, last_seen: null, channels: [{ ch: 1, code: 'WL-1' }] },
      ] }),
      // freshData=true 면 매 스캔마다 "지금 시각"의 새 행이 들어온 것처럼 응답한다.
      // (page.clock 으로 시간을 돌리면 Date.now() 도 같이 움직인다)
      readMeasurements: async () => {
        if (!o.freshData) return { ok: true, columnCount: 2, head: header, sample, rows: [] };
        const ts = Date.now();
        const at = new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
        return { ok: true, columnCount: 2, head: header, sample, rows: [{ at, ts, cells: [at, '1.1'] }] };
      },
      ingest: async (p) => {
        window.__ingest.push(p);
        return o.ingestOk ? { ok: true, status: 200 } : { ok: false, error: 'network' };
      },
    };
  }, { dataEnd, ingestOk, freshData });
}

test.describe('수신 판정 — 시간이 지나면 스스로 늙는다', () => {
  test('새 데이터가 안 들어오면 새로고침 없이도 "끊김"으로 바뀐다', async ({ page }) => {
    // 기록 간격 60분 → 180분 초과 시 끊김.
    await page.clock.install();
    await mock(page, { dataEnd: new Date().toISOString(), ingestOk: true, freshData: false });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();
    await expect(rowOf(page, 'node-1')).toContainText('수신중');

    await page.clock.runFor(4 * 60 * 60 * 1000); // 4시간 경과

    // 사용자가 아무것도 안 눌러도 화면이 현실을 따라와야 한다.
    await expect(rowOf(page, 'node-1')).toContainText('끊김');
  });
});

test.describe('수신 판정 — 전송 실패와 분리', () => {
  test('백엔드가 죽어도 파일에 새 데이터가 계속 들어오면 "수신중"이다', async ({ page }) => {
    // 수신(파일에 값이 들어옴)과 전송(백엔드로 보냄)은 별개다.
    // 전송 성공에만 lastRx 를 걸면, 백엔드 장애가 "센서 끊김"으로 둔갑한다.
    await page.clock.install();
    await mock(page, { dataEnd: new Date().toISOString(), ingestOk: false, freshData: true });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    await page.clock.runFor(4 * 60 * 60 * 1000); // 4시간 동안 전송은 계속 실패

    const row = rowOf(page, 'node-1');
    await expect(row).toContainText('수신중');   // 데이터는 잘 들어오고 있다
    await expect(row).not.toContainText('끊김');
  });

  test('전송 실패는 전송 상태(재전송)로만 드러난다', async ({ page }) => {
    await mock(page, { dataEnd: new Date().toISOString(), ingestOk: false, freshData: true });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    await page.getByRole('button', { name: '지금 전송' }).click();
    await expect(rowOf(page, 'node-1')).toContainText('재전송');
  });
});
