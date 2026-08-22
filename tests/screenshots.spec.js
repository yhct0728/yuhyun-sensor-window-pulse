// ─────────────────────────────────────────────────────────────────────────────
// PPT용 화면 캡처 — 각 화면을 데이터가 채워진 상태로 PNG 저장
//   실행:  npx playwright test tests/screenshots.spec.js
//   저장:  docs/proposal/screenshots/*.png  (1440×900)
//   ※ 실제 백엔드/파일시스템 없이 electronAPI 를 모킹해 화면만 렌더 → 캡처
// ─────────────────────────────────────────────────────────────────────────────
import { test } from '@playwright/test';

const OUT = 'docs/proposal/screenshots';

test.describe.configure({ timeout: 90000, retries: 1 });

// 모니터에 노드가 채워지도록: scanFolder(로컬 파일) ↔ listNodes(백엔드) node_code 매칭.
// last_seen 은 브라우저에서 실제 현재시각 기준 오프셋(분)으로 만들어 상태가 건강하게 섞이게 한다.
const FILES = [
  { fileName: '90030.txt', node: '90030', type: 'water_level', chans: ['90030-WL-1', '90030-WL-2', '90030-WL-3'], interval: 60, agoMin: 2 },
  { fileName: 'YH-0007.txt', node: 'YH-0007', type: 'inclinometer', chans: ['YH-0007-GI-A', 'YH-0007-GI-B'], interval: 60, agoMin: 25 },
  { fileName: '80053.txt', node: '80053', type: 'groundwater', chans: ['80053-GW-1', '80053-GW-2'], interval: 60, agoMin: 5 },
  { fileName: 'BT-동측.txt', node: 'BT-동측', type: 'tilt', chans: ['BT-동측-BT-1'], interval: 30, agoMin: 140 },
  { fileName: 'RF-우량.txt', node: 'RF-우량', type: 'rainfall', chans: ['RF-우량-RF-1'], interval: 10, agoMin: 4 },
];
const header = ['DateTime', '1', '2', '3'];
const sample = ['2026-06-13 09:00:00', '8209.94', '12.3', '7999.85'];

// nodesMode: 'full' = 백엔드에 등록된 노드 목록 반환(모니터 채움) / 'empty' = 미등록(감지·등록 버튼 노출)
function richMock(page, { guideSeen = true, nodesMode = 'full' } = {}) {
  return page.addInitScript(({ FILES, header, sample, guideSeen, nodesMode }) => {
    try { if (guideSeen) window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
    const now = Date.now();
    const nodes = FILES.map((f) => ({
      node_code: f.node, sensor_type: f.type, name: f.node, interval_min: f.interval,
      last_seen: new Date(now - f.agoMin * 60000).toISOString(), channels: f.chans,
    }));
    window.electronAPI = {
      getDefaultFolder: async () => 'C:\\pulse',
      getRootFolder: async () => 'C:\\pulse\\incoming',
      setRootFolder: async (p) => p,
      resetToDefault: async () => 'C:\\pulse',
      validateFolder: async () => ({ exists: true, accessible: true, txtCount: FILES.length, error: null }),
      pickFolder: async () => null,
      scanFolder: async () => FILES.map((f) => ({
        fileName: f.fileName, fullPath: 'C:\\pulse\\incoming\\' + f.fileName,
        rowCount: 312, lastModified: new Date(now - f.agoMin * 60000).toISOString(), header, sampleRow: sample,
      })),
      analyzeFile: async () => ({ encoding: 'UTF-8', rowCount: 312, columnCount: 4, delimiter: '쉼표 (,)', intervalGuess: 60, preview: [header, sample] }),
      listNodes: async () => ({ ok: true, status: 200, nodes: nodesMode === 'empty' ? [] : nodes }),
      getBackendConfig: async () => ({ url: 'https://geo.yuhyun.example.com', hasKey: true }),
      setBackendConfig: async (c) => ({ url: c.url || '', hasKey: true }),
      registerNode: async () => ({ ok: true, status: 201 }),
      readMeasurements: async () => ({ ok: true, columnCount: 4, head: header, sample, rows: [] }),
      ingest: async () => ({ ok: true, status: 200 }),
    };
  }, { FILES, header, sample, guideSeen, nodesMode });
}

async function shot(page, name) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700); // 렌더/애니메이션 안정화
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test.describe('PPT 화면 캡처', () => {
  test('01 노드 모니터 (라이트)', async ({ page }) => {
    await richMock(page);
    await page.goto('/');
    await page.getByRole('cell', { name: '90030', exact: true }).waitFor();
    await shot(page, '01-노드모니터-라이트');
  });

  test('02 노드 모니터 (다크)', async ({ page }) => {
    await richMock(page);
    await page.goto('/');
    await page.getByRole('cell', { name: '90030', exact: true }).waitFor();
    await page.locator('button').filter({ has: page.locator('svg.lucide-sun, svg.lucide-moon') }).first().click();
    await shot(page, '02-노드모니터-다크');
  });

  test('03 노드 상세 드로어', async ({ page }) => {
    await richMock(page);
    await page.goto('/?test=node');
    await page.getByText('YH-0007').first().waitFor();
    await shot(page, '03-노드상세-드로어');
  });

  test('04 감지·등록 탭', async ({ page }) => {
    await richMock(page, { nodesMode: 'empty' });
    await page.goto('/');
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await page.getByRole('button', { name: '등록', exact: true }).first().waitFor();
    await shot(page, '04-감지등록');
  });

  test('05 노드 등록 마법사', async ({ page }) => {
    await richMock(page, { nodesMode: 'empty' });
    await page.goto('/');
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await page.getByRole('button', { name: '등록', exact: true }).first().click();
    await page.getByRole('button', { name: '다음' }).click(); // 분석 → 채널 매핑
    await page.getByText('채널 매핑', { exact: true }).waitFor();
    await shot(page, '05-등록마법사-채널매핑');
  });

  test('06 전송 큐', async ({ page }) => {
    await richMock(page);
    await page.goto('/');
    await page.getByRole('button', { name: '전송 큐' }).click();
    await shot(page, '06-전송큐');
  });

  test('07 계측기 도감', async ({ page }) => {
    await richMock(page);
    await page.goto('/');
    await page.getByRole('button', { name: '계측기 도감' }).click();
    await page.getByText('지중경사계').first().waitFor();
    await shot(page, '07-계측기도감');
  });

  test('08 설정', async ({ page }) => {
    await richMock(page);
    await page.goto('/');
    await page.getByRole('button', { name: '설정' }).first().click();
    await page.getByText('데이터 폴더', { exact: true }).first().waitFor();
    await shot(page, '08-설정');
  });

  test('09 시작 가이드(온보딩)', async ({ page }) => {
    await richMock(page, { guideSeen: false });
    await page.goto('/');
    await page.getByText('시작 가이드').first().waitFor();
    await shot(page, '09-온보딩');
  });
});
