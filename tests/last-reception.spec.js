// ─────────────────────────────────────────────────────────────────────────────
// 마지막 수신 정확도 (2026-08-22)
//
// 문제: 화면의 "마지막 수신"이 .txt **안의 마지막 데이터 시각**이 아니라
//   **파일이 저장된 시각(OS mtime)** 이었다. 타사 로거는 파일을 덮어쓰므로
//   데이터가 끊겨도 mtime 은 갱신될 수 있다 → 끊긴 노드가 "수신중"으로 보인다.
//   값의 출처도 경로마다 달랐다(등록=mtime / 전송성공=데이터시각 / 복원=백엔드 last_seen).
//
// 정한 규칙: **Pulse 는 수집기다. 자기 파일에 뭐가 들어왔는지를 보고한다.**
//   lastRx        = 내 감시폴더 파일의 마지막 데이터 시각 (periodEnd)
//   lastFileWrite = 그 파일이 저장된 시각 (mtime) — 진단용, 함께 표시
//   백엔드 last_seen = 내 파일이 없는 노드(타사 PC 담당)에만 폴백으로 사용
//
// 이 규칙이 중요한 이유: 두 값이 갈라지는 순간이 곧 진단이다.
//   둘 다 옛날 → 로거가 멈춤 / 파일저장만 최신 → 로거는 도는데 센서가 값을 못 줌
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';

const STALE_DATA_ISO = '2026-01-10T09:00:00.000Z'; // 데이터가 끊긴 시점(한참 전)

/**
 * 감시폴더에 파일 1개.
 * @param {object} o
 * @param {string|null} o.periodEnd  파일 안 마지막 데이터 시각
 * @param {string} o.lastModified    파일 저장시각(mtime)
 * @param {string|null} o.lastSeen   백엔드가 아는 마지막 수신 (타사 PC 가 채웠을 수 있음)
 * @param {boolean} [o.withFile]     감시폴더에 파일이 있는지 (false = 타사 담당 노드)
 */
function mockNode(page, { periodEnd, lastModified, lastSeen, withFile = true }) {
  return page.addInitScript((o) => {
    try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch { /* noop */ }
    window.__ingest = [];
    const header = ['DateTime', '1'];
    const sample = ['2026-01-01 09:00:00', '1.1'];
    const files = o.withFile ? [{
      fileName: 'node-1.txt', fullPath: 'C:\\pulse\\incoming\\node-1.txt',
      rowCount: 10, lastModified: o.lastModified, header, sampleRow: sample,
      periodStart: '2026-01-01T09:00:00.000Z',
      periodEnd: o.periodEnd,
    }] : [];
    window.electronAPI = {
      getDefaultFolder: async () => 'C:\\pulse',
      getRootFolder: async () => 'C:\\pulse\\incoming',
      setRootFolder: async (p) => p,
      resetToDefault: async () => 'C:\\pulse',
      validateFolder: async () => ({ exists: true, accessible: true, txtCount: files.length, error: null }),
      pickFolder: async () => null,
      scanFolder: async () => files,
      analyzeFile: async () => ({
        encoding: 'UTF-8', rowCount: 10, columnCount: 2, delimiter: '쉼표 (,)',
        intervalGuess: 60, preview: [header, sample],
      }),
      listNodes: async () => ({ ok: true, status: 200, nodes: [
        { node_code: 'node-1', sensor_type: 'water_level', name: 'node-1',
          report_interval_min: 60, last_seen: o.lastSeen, channels: [{ ch: 1, code: 'WL-1' }] },
      ] }),
      // 신규 행 없음 — 전송이 안 일어나도 lastRx 가 채워져야 한다
      readMeasurements: async () => ({ ok: true, columnCount: 2, head: header, sample, rows: [] }),
      ingest: async (p) => { window.__ingest.push(p); return { ok: true, status: 200 }; },
    };
  }, { periodEnd, lastModified, lastSeen, withFile });
}

test.describe('마지막 수신 — 내 파일의 데이터 시각을 쓴다', () => {
  test('파일만 방금 저장되고 데이터는 끊김 → "끊김" (mtime 에 속지 않는다)', async ({ page }) => {
    await mockNode(page, {
      periodEnd: STALE_DATA_ISO,               // 데이터는 1월에 멈춤
      lastModified: new Date().toISOString(),  // 그런데 파일은 방금 저장됨(덮어쓰기 로거)
      lastSeen: null,
    });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    // mtime 을 쓰면 "수신중/방금"이 된다. 데이터 시각을 써야 "끊김".
    await expect(page.getByText('끊김').first()).toBeVisible();
    await expect(page.getByText('방금')).toHaveCount(0);
  });

  test('백엔드 last_seen 이 최신이어도 내 파일 기준으로 표시한다', async ({ page }) => {
    await mockNode(page, {
      periodEnd: STALE_DATA_ISO,                 // 내 파일은 1월까지
      lastModified: STALE_DATA_ISO,
      lastSeen: new Date().toISOString(),        // 백엔드는 최신 (타사 PC 가 채운 값)
    });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    // Pulse 는 수집기 — "내가 받은 것"을 보고해야 한다. 백엔드 값을 그대로 쓰면 "수신중"이 된다.
    await expect(page.getByText('끊김').first()).toBeVisible();
    await expect(page.getByText('방금')).toHaveCount(0);
  });

  test('신규 전송이 0건이어도 마지막 수신이 채워진다', async ({ page }) => {
    await mockNode(page, {
      periodEnd: STALE_DATA_ISO, lastModified: new Date().toISOString(), lastSeen: null,
    });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    expect(await page.evaluate(() => window.__ingest.length)).toBe(0); // 보낼 게 없었다
    // 그래도 파일을 읽었으니 "N일 전"이 나와야 한다 (전송 성공에만 의존하면 안 됨)
    await expect(page.getByText(/\d+일 전/).first()).toBeVisible();
  });

  test('노드 상세에 데이터 시각과 파일 저장시각을 나란히 보여준다', async ({ page }) => {
    await mockNode(page, {
      periodEnd: STALE_DATA_ISO, lastModified: new Date().toISOString(), lastSeen: null,
    });
    await page.goto('/');
    await page.getByText('node-1').first().click();

    // 두 값의 차이가 "로거 사망 vs 센서 사망"을 가른다 — 나란히 보여야 한다
    await expect(page.getByText('마지막 데이터').first()).toBeVisible();
    await expect(page.getByText('파일 저장').first()).toBeVisible();
  });
});

test.describe('마지막 수신 — 경계', () => {
  test('데이터가 한 줄도 없는 파일은 mtime 으로 때우지 않는다', async ({ page }) => {
    await mockNode(page, {
      periodEnd: null,                          // 헤더만 있는 파일
      lastModified: new Date().toISOString(),
      lastSeen: null,
    });
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    await expect(page.getByText('끊김').first()).toBeVisible();
    await expect(page.getByText('방금')).toHaveCount(0);
  });

  // 내 파일이 없는 노드(타사 PC 담당)는 감춘다 — 기존 동작 회귀.
  // 단 감시폴더가 통째로 비어 있으면(설정 전) 필터를 걸지 않고 전부 보여준다(store.jsx myCodes=null).
  // 그래서 이 회귀를 보려면 "다른 노드의 파일은 있는" 상태여야 한다.
  test('내 파일이 없는 노드(타사 담당)는 화면에 뜨지 않는다 — 회귀', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch { /* noop */ }
      const header = ['DateTime', '1'];
      const sample = ['2026-01-01 09:00:00', '1.1'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse',
        getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p,
        resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        // 내 담당은 mine-1 뿐 — other-pc 파일은 없다
        scanFolder: async () => [{
          fileName: 'mine-1.txt', fullPath: 'C:\\pulse\\incoming\\mine-1.txt',
          rowCount: 10, lastModified: '2026-08-20T00:00:00.000Z', header, sampleRow: sample,
          periodStart: '2026-01-01T09:00:00.000Z', periodEnd: '2026-08-20T00:00:00.000Z',
        }],
        analyzeFile: async () => ({
          encoding: 'UTF-8', rowCount: 10, columnCount: 2, delimiter: '쉼표 (,)',
          intervalGuess: 60, preview: [header, sample],
        }),
        listNodes: async () => ({ ok: true, status: 200, nodes: [
          { node_code: 'mine-1', sensor_type: 'water_level', name: 'mine-1', report_interval_min: 60, last_seen: null, channels: [{ ch: 1, code: 'WL-1' }] },
          { node_code: 'other-pc', sensor_type: 'tilt', name: 'other-pc', report_interval_min: 60, last_seen: new Date().toISOString(), channels: [] },
        ] }),
        readMeasurements: async () => ({ ok: true, columnCount: 2, head: header, sample, rows: [] }),
        ingest: async () => ({ ok: true, status: 200 }),
      };
    });
    await page.goto('/');
    await expect(page.getByText('mine-1').first()).toBeVisible();
    await expect(page.getByText('other-pc')).toHaveCount(0);
  });
});
