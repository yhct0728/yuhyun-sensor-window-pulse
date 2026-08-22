// ─────────────────────────────────────────────────────────────────────────────
// Part B — 채널 코드 접두가 "채널 자신의 sensor_type"를 따라가게 (90030 GI→GW 근본수정)
//   절대 원칙: 코드 약어 = 그 채널 sensor_type 표준 약어. 접미 번호(위치/심도) 보존.
//   resolveSensors 가 채널별 종류(override·헤더추론·노드폴백)로 코드를 생성하는지 검증.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { resolveSensors } from '../src/lib/sensorModel.js';

// 번호형 분석 결과 빌더 (헤더 DateTime,1,2,… + 데이터 1줄).
function numberedAnalysis(valueCols) {
  const header = ['DateTime', ...Array.from({ length: valueCols }, (_, i) => String(i + 1))];
  const row = ['2026-06-02 15:00:00', ...Array.from({ length: valueCols }, () => '30000')];
  return { columnCount: header.length, preview: [header, row], name: '90030.txt', rowCount: 1 };
}

test.describe('Part B — 채널 코드 접두가 채널 종류를 따라감', () => {
  // 90030 핵심 시나리오: 노드 대표=지중경사계(GI), 채널 1만 지하수위계(GW)로 지정.
  test('채널별 종류 override → 코드 접두가 따라감 (GI-1 → GW-1, 나머지 GI-N)', () => {
    const m = resolveSensors(numberedAnalysis(3), {
      sensorType: 'inclinometer',
      nodeId: '90030',
      channelTypes: { 1: 'groundwater' }, // 1번 채널만 지하수위계
    });
    expect(m.sensors.map((s) => s.code)).toEqual(['GW-1', 'GI-2', 'GI-3']);
  });

  // 코드가 종류를 따라 바뀌어도 접미 번호(도면 위치)는 절대 재번호하지 않음.
  test('접미 번호 보존 — 3번 채널을 GW 로 바꿔도 GW-3 (재번호 금지)', () => {
    const m = resolveSensors(numberedAnalysis(3), {
      sensorType: 'inclinometer',
      nodeId: '90030',
      channelTypes: { 3: 'groundwater' },
    });
    expect(m.sensors.map((s) => s.code)).toEqual(['GI-1', 'GI-2', 'GW-3']);
  });

  // 각 센서에 "해석된 종류"가 실려야 위저드/등록 본문이 sensor_type 을 코드와 일치시켜 보냄.
  test('센서별 sensorType 부착 (코드 약어와 항상 일치)', () => {
    const m = resolveSensors(numberedAnalysis(2), {
      sensorType: 'inclinometer',
      channelTypes: { 1: 'groundwater' },
    });
    expect(m.sensors[0]).toMatchObject({ code: 'GW-1', sensorType: 'groundwater' });
    expect(m.sensors[1]).toMatchObject({ code: 'GI-2', sensorType: 'inclinometer' });
  });

  // override 없으면 기존 동작 그대로(노드 대표 접두) — 회귀 가드.
  test('override 없음 → 노드 대표 접두 유지 (회귀)', () => {
    const m = resolveSensors(numberedAnalysis(3), { sensorType: 'inclinometer', nodeId: '90030' });
    expect(m.sensors.map((s) => s.code)).toEqual(['GI-1', 'GI-2', 'GI-3']);
  });

  // 이름형: 헤더가 종류를 암시하면(예 GW-1/GI-2) 채널별로 자동 추론 — 노드 대표가 섞어 덮지 않음.
  test('이름형 헤더 종류 자동추론 — 노드 대표가 다른 채널을 덮지 않음', () => {
    const header = ['DateTime', 'GW-1', 'GI-2'];
    const row = ['2026-06-02 15:00:00', '1945', '30343'];
    const analysis = { columnCount: 3, preview: [header, row], name: 'mix.txt', rowCount: 1 };
    const m = resolveSensors(analysis, { sensorType: 'inclinometer', nodeId: '90030' });
    expect(m.sensors.map((s) => s.code)).toEqual(['GW-1', 'GI-2']);
    expect(m.sensors.map((s) => s.sensorType)).toEqual(['groundwater', 'inclinometer']);
  });
});

// 90030 실사례 — 위저드 끝까지(UI): 노드=지중경사계, 채널 1만 지하수위계 → 등록 코드 GW-1.
test.describe('Part B — 등록 위저드 채널별 종류 (90030 GI→GW 끝단 검증)', () => {
  test('노드=지중경사계, 채널 1만 지하수위계 → channels[0]=GW-1/groundwater, 나머지 GI-N', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__register = [];
      const header = ['DateTime', '1', '2', '3']; // 번호형 3열(90030 축약)
      const sample = ['2026-06-02 15:00:00', '1945', '30343', '29677'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: '90030.txt', fullPath: 'C:\\pulse\\incoming\\90030.txt', rowCount: 7, lastModified: '2026-06-02T15:00:00Z', header, sampleRow: sample },
        ],
        analyzeFile: async () => ({ encoding: 'UTF-8', rowCount: 7, columnCount: 4, delimiter: '쉼표 (,)', intervalGuess: 60, preview: [header, sample] }),
        listNodes: async () => ({ ok: true, status: 200, nodes: [] }),
        registerNode: async (p) => { window.__register.push(p); return { ok: true, status: 201 }; },
      };
    });
    await page.goto('/');
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await page.getByRole('button', { name: '등록', exact: true }).first().click();
    await page.getByRole('button', { name: '다음' }).click(); // 분석 → 매핑
    // 노드 대표 종류 = 지중경사계
    await page.getByRole('button', { name: '(미지정)' }).first().click();
    await page.getByRole('button', { name: '지중경사계', exact: true }).click();
    // 채널 1(GI-1)만 지하수위계로 변경 → 코드가 GW-1 로 따라가야 함.
    //   '지중경사계' 버튼: nth(0)=노드 대표, nth(1)=채널 1 셀렉트.
    await page.getByRole('button', { name: '지중경사계', exact: true }).nth(1).click();
    await page.getByRole('button', { name: '지하수위계', exact: true }).click();
    await page.getByRole('button', { name: '다음' }).click(); // 매핑 → 확인
    await page.getByRole('button', { name: '등록 완료' }).click();
    await page.waitForFunction(() => (window.__register || []).length >= 1);
    const body = await page.evaluate(() => window.__register[0]);
    expect(body.channels.map((c) => c.code)).toEqual(['GW-1', 'GI-2', 'GI-3']);
    expect(body.channels[0]).toMatchObject({ code: 'GW-1', sensorType: 'groundwater', unit: 'm' });
    expect(body.channels[1]).toMatchObject({ code: 'GI-2', sensorType: 'inclinometer' });
  });
});
