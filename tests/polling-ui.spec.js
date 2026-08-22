// ─────────────────────────────────────────────────────────────────────────────
// 폴링/주기 UI 정리 (2026-08-21)
//
// 배경: 헤더의 "다음 폴링 mm:ss" 카운트다운은 아무 동작도 트리거하지 않는
//   장식이었고(usePolling 은 값만 되감김), 실제 수집은 App.jsx 의 60초 고정
//   setInterval 이 담당한다. 게다가 카운트다운 값은 nodes[0].intervalMin 하나만
//   보고 만들어져 노드가 여러 대면 무의미했고, mmss() 가 시(hour) 단위로 올리지
//   않아 1일(1440분) 주기에서 "1440:58" 로 표시됐다.
//
// 이 스펙이 고정하는 것:
//   1. 가짜 카운트다운("다음 폴링")이 화면에서 사라진다
//   2. 실제 동작(60초마다 자동 확인)이 문구로 드러난다
//   3. 1분을 기다리지 않고 즉시 전송할 수 있는 "지금 전송" 버튼이 있다
//   4. "주기" → "기록 간격" — 전송 빈도가 아니라 장비의 기록 간격임을 드러낸다
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';

/** 노드 2대가 잡힌 상태의 electronAPI 모킹. ingest 호출은 window.__ingest 에 기록. */
function mockWithNodes(page) {
  return page.addInitScript(() => {
    try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch { /* noop */ }
    window.__ingest = [];
    const header = ['DateTime', '1'];
    const sample = ['2026-05-01 09:00:00', '1.1'];
    window.electronAPI = {
      getDefaultFolder: async () => 'C:\\pulse',
      getRootFolder: async () => 'C:\\pulse\\incoming',
      setRootFolder: async (p) => p,
      resetToDefault: async () => 'C:\\pulse',
      validateFolder: async () => ({ exists: true, accessible: true, txtCount: 2, error: null }),
      pickFolder: async () => null,
      scanFolder: async () => [
        { fileName: 'node-1.txt', fullPath: 'C:\\pulse\\incoming\\node-1.txt', rowCount: 10, lastModified: '2026-05-29T12:00:00Z', header, sampleRow: sample },
        { fileName: 'node-2.txt', fullPath: 'C:\\pulse\\incoming\\node-2.txt', rowCount: 10, lastModified: '2026-05-29T12:00:00Z', header, sampleRow: sample },
      ],
      analyzeFile: async () => ({
        encoding: 'UTF-8', rowCount: 10, columnCount: 2, delimiter: '쉼표 (,)',
        intervalGuess: 60, preview: [header, sample],
      }),
      // 노드 주기를 1일(1440분)로 — 옛 코드에서 "1440:58" 이 나오던 조건
      listNodes: async () => ({ ok: true, status: 200, nodes: [
        { node_code: 'node-1', sensor_type: 'water_level', name: 'node-1', report_interval_min: 1440, last_seen: '2026-05-29T12:00:00Z', channels: [{ ch: 1, code: 'WL-1' }] },
        { node_code: 'node-2', sensor_type: 'water_level', name: 'node-2', report_interval_min: 1440, last_seen: '2026-05-29T12:00:00Z', channels: [{ ch: 1, code: 'WL-1' }] },
      ] }),
      readMeasurements: async () => ({
        ok: true, columnCount: 2, head: header, sample,
        rows: [{ at: '2026-06-02 09:00:00', ts: Date.parse('2026-06-02T09:00:00'), cells: ['2026-06-02 09:00:00', '1.1'] }],
      }),
      ingest: async (p) => { window.__ingest.push(p); return { ok: true, status: 200 }; },
    };
  });
}

/** 빈 상태(노드 0대) — 폴링 표시가 nodes[0] 에 기대지 않는지 확인용. */
function mockEmpty(page) {
  return page.addInitScript(() => {
    try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch { /* noop */ }
    window.electronAPI = {
      getDefaultFolder: async () => '',
      getRootFolder: async () => '',
      setRootFolder: async (p) => p,
      resetToDefault: async () => '',
      validateFolder: async () => ({ exists: false, accessible: false, txtCount: 0, error: 'empty' }),
      pickFolder: async () => null,
      scanFolder: async () => [],
      analyzeFile: async () => null,
    };
  });
}

test.describe('폴링 UI — 가짜 카운트다운 제거', () => {
  test('"다음 폴링" 카운트다운이 화면에 없다', async ({ page }) => {
    await mockWithNodes(page);
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    await expect(page.getByText(/다음 폴링/)).toHaveCount(0);
    // 1440 분 주기에서 터지던 표시 버그 — 분:초로만 찍혀 "1440:58" 이 됐다
    await expect(page.getByText(/1440:\d\d/)).toHaveCount(0);
  });

  test('실제 동작(1분마다 자동 확인)이 문구로 보인다', async ({ page }) => {
    await mockWithNodes(page);
    await page.goto('/');
    await expect(page.getByText(/1분마다 자동 확인/)).toBeVisible();
  });

  test('노드가 0대여도 폴링 표시가 깨지지 않는다 (nodes[0] 의존 제거)', async ({ page }) => {
    await mockEmpty(page);
    await page.goto('/');
    await expect(page.getByText('아직 수신 중인 노드가 없습니다')).toBeVisible();
    await expect(page.getByText(/1분마다 자동 확인/)).toBeVisible();
    await expect(page.getByText(/다음 폴링/)).toHaveCount(0);
  });
});

test.describe('폴링 UI — 지금 전송', () => {
  test('"지금 전송" 버튼이 있다', async ({ page }) => {
    await mockWithNodes(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: '지금 전송' })).toBeVisible();
  });

  test('"지금 전송" 클릭 → 1분 안 기다리고 즉시 ingest 발생', async ({ page }) => {
    await mockWithNodes(page);
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();

    // 클릭 전에는 (자동 60초 주기가 아직 안 돌았으므로) 전송 없음
    expect(await page.evaluate(() => window.__ingest.length)).toBe(0);

    await page.getByRole('button', { name: '지금 전송' }).click();

    await expect.poll(() => page.evaluate(() => window.__ingest.length)).toBeGreaterThan(0);
    await expect(page.getByText(/전송/).first()).toBeVisible();
  });
});

test.describe('용어 — "주기" → "기록 간격"', () => {
  test('노드 표 컬럼이 "기록 간격"이다', async ({ page }) => {
    await mockWithNodes(page);
    await page.goto('/');
    await expect(page.getByText('node-1').first()).toBeVisible();
    // 테이블이 기본 뷰라 전환 불필요

    await expect(page.getByRole('columnheader', { name: '기록 간격' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '주기', exact: true })).toHaveCount(0);
  });
});
