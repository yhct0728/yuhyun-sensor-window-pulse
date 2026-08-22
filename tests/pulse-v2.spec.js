// ─────────────────────────────────────────────────────────────────────────────
// Pulse v2 E2E (현장-블라인드) — 렌더러(dev:web :5173) 기준
//   electronAPI 는 addInitScript 로 모킹. 제로 디폴트(빈 상태)가 기본.
//   노드 상세/뷰 검증은 App.jsx 의 ?test=node 합성 노드 훅을 사용.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { nodeRegisterBody, nodeRangeBody, bareSensorCode, nodeMonitoringBody, guessSensorTypeFromCode, sensorTypeUnit } from '../src/lib/backendApi.js';

// ★채널별 sensor_type (노드 1개에 종류 혼재) — 전송 본문 + 코드 자동추론.
test.describe('채널별 계측 종류 — sensor_type per channel', () => {
  test('guessSensorTypeFromCode — 코드 접두로 종류 추론', () => {
    expect(guessSensorTypeFromCode('WL-1')).toBe('water_level');
    expect(guessSensorTypeFromCode('CR-1')).toBe('crack');
    expect(guessSensorTypeFromCode('GI-A')).toBe('inclinometer');
    expect(guessSensorTypeFromCode('TX')).toBe('tilt');   // TX/TY → BT → tilt
    expect(guessSensorTypeFromCode('XYZ-1')).toBe('');     // 미지 → '' (노드 대표 폴백)
  });

  test('sensorTypeUnit — 종류 기본 단위', () => {
    expect(sensorTypeUnit('water_level')).toBe('m');
    expect(sensorTypeUnit('crack')).toBe('mm');
    expect(sensorTypeUnit('unknown_type')).toBe('');
  });

  test('nodeRegisterBody — 채널마다 sensor_type/unit 동봉(노드 대표는 폴백 유지)', () => {
    const body = nodeRegisterBody({
      nodeId: 'NODE-12', sensorType: 'water_level',
      channels: [
        { ch: 1, code: 'WL-1', sensorType: 'water_level', unit: 'm' },
        { ch: 2, code: 'CR-1', sensorType: 'crack', unit: 'mm' },
        { ch: 3, code: 'X-1' }, // 종류 미지정 → 키 생략(백엔드가 노드 대표로 폴백)
      ],
    });
    expect(body.sensor_type).toBe('water_level'); // 노드 대표/폴백 유지
    expect(body.channels[0]).toMatchObject({ code: 'WL-1', sensor_type: 'water_level', unit: 'm' });
    expect(body.channels[1]).toMatchObject({ code: 'CR-1', sensor_type: 'crack', unit: 'mm' });
    expect('sensor_type' in body.channels[2]).toBe(false); // 미지정 채널은 sensor_type 생략
  });

  test('nodeRangeBody — sensor_type/unit 도 함께(분류 유지)', () => {
    const body = nodeRangeBody({
      nodeId: 'NODE-12', sensorType: 'water_level',
      channels: [{ code: 'CR-1', sensorType: 'crack', unit: 'mm', validMin: 0, validMax: 50 }],
    });
    expect(body.channels[0]).toEqual({ code: 'CR-1', sensor_type: 'crack', unit: 'mm', valid_min: 0, valid_max: 50 });
  });
});

// 정상범위(raw 글리치 컷) — 전송 본문 빌더. 판정은 백엔드, 펄스는 입력+전송만.
test.describe('정상범위 — nodeRangeBody (백엔드 전송 본문)', () => {
  test('valid_min/max(raw) 본문 + bare code + sensor_sync/name/count 없음', () => {
    const body = nodeRangeBody({
      nodeId: '80053', sensorType: 'water_level',
      channels: [
        { code: '80053-WL-1', validMin: 100, validMax: 20000 }, // 풀 센서코드 → bare 로
        { code: 'WL-2', validMin: null, validMax: 20000 },       // null = 해제
      ],
    });
    expect(body).toEqual({
      node_code: '80053', sensor_type: 'water_level',
      channels: [
        { code: 'WL-1', valid_min: 100, valid_max: 20000 },
        { code: 'WL-2', valid_min: null, valid_max: 20000 },
      ],
    });
    const s = JSON.stringify(body);
    expect(s).not.toContain('sensor_sync'); // 범위 갱신엔 절대 금지(additive 기본)
    expect(s).not.toContain('"name"');
    expect(s).not.toContain('sensor_count');
    expect(s).not.toContain('spike'); // spike 는 백엔드가 무시 — 안 보냄
  });

  test('bareSensorCode — 접두 제거/유지', () => {
    expect(bareSensorCode('80053', '80053-WL-1')).toBe('WL-1');
    expect(bareSensorCode('YH-0007', 'GI-A')).toBe('GI-A');
    expect(bareSensorCode('YH-0007', 'YH-0007-GI-A')).toBe('GI-A');
  });
});

// 운영 시작일(monitoring_from) — 등록 body 동봉 + 단독 갱신 body.
test.describe('운영 시작일 — monitoring_from 본문', () => {
  test('nodeRegisterBody — monitoringFrom 있으면 monitoring_from 동봉, undefined 면 키 생략', () => {
    const withMon = nodeRegisterBody({
      nodeId: '80053', sensorType: 'water_level',
      channels: [{ ch: 1, code: 'WL-1' }], monitoringFrom: '2026-05-19T00:00:00+09:00',
    });
    expect(withMon.monitoring_from).toBe('2026-05-19T00:00:00+09:00');
    const noMon = nodeRegisterBody({ nodeId: '80053', sensorType: 'water_level', channels: [{ ch: 1, code: 'WL-1' }] });
    expect('monitoring_from' in noMon).toBe(false); // undefined → 키 생략(기존값 유지)
  });

  test('nodeMonitoringBody — 노드 단위 최소 본문(채널/sync 없음), null=해제', () => {
    const b = nodeMonitoringBody({ nodeId: '80053', sensorType: 'water_level', monitoringFrom: '2026-05-19T00:00:00+09:00' });
    expect(b).toEqual({ node_code: '80053', sensor_type: 'water_level', monitoring_from: '2026-05-19T00:00:00+09:00' });
    const s = JSON.stringify(b);
    expect(s).not.toContain('channels');
    expect(s).not.toContain('sensor_sync');
    expect(nodeMonitoringBody({ nodeId: '80053', sensorType: 'water_level', monitoringFrom: null }).monitoring_from).toBeNull();
  });
});

// 순수 단위 검증 — 실제 전송 body 빌더가 snake_case + channels 를 내보내는지 (메인 재시작과 무관, 소스 계약 고정)
test.describe('Pulse v2 — nodeRegisterBody 계약 (실제 HTTP body)', () => {
  test('카멜 입력 → snake_case 변환 + channels 포함', () => {
    const body = nodeRegisterBody({
      nodeId: '80053', sensorType: 'groundwater',
      channels: [{ ch: 1, code: 'WL-1' }, { ch: 2, code: 'WL-2' }, { ch: 3, code: 'WL-3' }],
      sensorCount: 3, sensorSync: 'replace',
    });
    // snake_case 필수 키
    expect(body).toMatchObject({ node_code: '80053', sensor_type: 'groundwater', sensor_count: 3, sensor_sync: 'replace' });
    // channels 그대로(동일 키)
    expect(body.channels).toEqual([{ ch: 1, code: 'WL-1' }, { ch: 2, code: 'WL-2' }, { ch: 3, code: 'WL-3' }]);
    // 카멜 키는 body 에 없어야 함(백엔드가 무시하는 키)
    expect(body.nodeId).toBeUndefined();
    expect(body.sensorType).toBeUndefined();
    // 실제 전송 문자열에 channels 가 반드시 들어있어야 함
    const s = JSON.stringify(body);
    expect(s).toContain('"node_code":"80053"');
    expect(s).toContain('"channels"');
    expect(s).toContain('"code":"WL-1"');
  });
});

// 빈 상태(제로 디폴트) electronAPI 모킹
function mockEmpty(page) {
  return page.addInitScript(() => {
    try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {} // 시작 가이드 자동표시 끔
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

test.describe('Pulse v2 — 셸 & 빈 상태', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmpty(page);
    await page.goto('/');
  });

  test('사이드바 브랜드 + 5개 메뉴 + 현장-블라인드 안내', async ({ page }) => {
    await expect(page.getByText('Pulse', { exact: true })).toBeVisible();
    await expect(page.getByText('유현건설 · 수집기')).toBeVisible();
    for (const label of ['노드 모니터', '전송 큐', '계측기 도감', '설정']) {
      await expect(page.getByRole('button', { name: label }).first()).toBeVisible();
    }
    await expect(page.getByText('현장-블라인드')).toBeVisible();
  });

  test('노드 모니터 빈 상태', async ({ page }) => {
    await expect(page.getByText('아직 수신 중인 노드가 없습니다')).toBeVisible();
  });

  test('감지·등록 탭 빈 상태', async ({ page }) => {
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await expect(page.getByText('감지된 파일이 없습니다')).toBeVisible();
    await expect(page.getByText('감시 폴더가 설정되지 않았습니다')).toBeVisible();
  });

  test('전송 큐 빈 상태', async ({ page }) => {
    await page.getByRole('button', { name: '전송 큐' }).click();
    await expect(page.getByText('전송 대기 중인 데이터가 없습니다')).toBeVisible();
    await expect(page.getByText(/현장 stamp 는 백엔드/)).toBeVisible();
  });

  test('계측기 도감 — 3탭(계측기 목록/공식 타입/계수 사전)', async ({ page }) => {
    await page.getByRole('button', { name: '계측기 도감' }).click();
    // 탭① 계측기 목록 — 22종 중 일부가 카드로 보임
    await expect(page.getByText('지중경사계').first()).toBeVisible();
    await expect(page.getByText('In-situ Inclinometer')).toBeVisible();
    // 탭② 공식 타입 — 테이블
    await page.getByRole('button', { name: '공식 타입' }).click();
    await expect(page.getByRole('columnheader', { name: '신호 방식' })).toBeVisible();
    await expect(page.getByText('P = G(R0-R1) + K(T1-T0)').first()).toBeVisible();
    // 탭③ 계수 사전 — 공식 타입 서브탭 + 계수
    await page.getByRole('button', { name: '계수 사전' }).click();
    await expect(page.getByText('Gauge Factor (감도계수)')).toBeVisible();
    await page.getByRole('button', { name: 'Bridge' }).click();
    await expect(page.getByText('Zero Balance', { exact: false })).toBeVisible();
  });

  test('설정 — 데이터 폴더', async ({ page }) => {
    await page.getByRole('button', { name: '설정' }).first().click();
    await expect(page.getByText('데이터 폴더', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /찾아보기/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /기본값으로 복원/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeVisible();
    // 백엔드 연결 카드
    await expect(page.getByText('백엔드 연결')).toBeVisible();
    await expect(page.getByRole('button', { name: /연결 저장/ })).toBeVisible();
  });

  test('다크모드 토글', async ({ page }) => {
    const before = (await page.locator('html').getAttribute('class')) || '';
    await page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-sun, svg.lucide-moon') })
      .first()
      .click();
    const after = (await page.locator('html').getAttribute('class')) || '';
    expect(after).not.toBe(before);
  });

  test('등록은 감지·등록 탭에서만 — 일반 노드 등록 버튼 없음', async ({ page }) => {
    // 상단/빈상태의 일반 '노드 등록' 버튼은 제거됨 (감지·등록 탭의 파일별 버튼으로만 등록)
    await expect(page.getByRole('button', { name: '노드 등록' })).toHaveCount(0);
    // 모니터 빈 상태 CTA 는 감지·등록 탭으로 이동
    await expect(page.getByRole('button', { name: '감지 · 등록 탭으로' })).toBeVisible();
  });

  test('콘솔 에러 없음', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => {
      // 정적 리소스 404(favicon 등)는 앱 오류가 아니므로 제외 — 실제 JS 에러만 검사
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) {
        errors.push(m.text());
      }
    });
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});

test.describe('Pulse v2 — 시작 가이드(온보딩)', () => {
  test('첫 실행 시 자동 표시 + ? 버튼으로 재호출', async ({ page }) => {
    // guideSeen 미설정(첫 실행) — 자동으로 가이드가 떠야 함
    await page.addInitScript(() => {
      window.electronAPI = {
        getDefaultFolder: async () => '', getRootFolder: async () => '',
        setRootFolder: async (p) => p, resetToDefault: async () => '',
        validateFolder: async () => ({ exists: false, accessible: false, txtCount: 0, error: 'empty' }),
        pickFolder: async () => null, scanFolder: async () => [], analyzeFile: async () => null,
      };
    });
    await page.goto('/');
    await expect(page.getByText('시작 가이드')).toBeVisible();
    await expect(page.getByText('파일 형식 신호등')).toBeVisible();
    // 닫기(푸터 버튼) → 사라짐
    await page.getByRole('button', { name: '닫기' }).last().click();
    await expect(page.getByText('시작 가이드')).toHaveCount(0);
    // 헤더 ? 버튼 → 다시 열림
    await page.getByRole('button', { name: '시작 가이드' }).click();
    await expect(page.getByText('파일 형식 신호등')).toBeVisible();
  });
});

test.describe('Pulse v2 — 등록 위저드 깊이 프로파일(시리즈)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      const depths = Array.from({ length: 81 }, (_, i) => (i * 0.5).toFixed(1) + 'M');
      const header = ['DateTime', ...depths];
      const dataRow = ['2026-05-29 12:00', ...depths.map(() => '1.2')];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse',
        getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p,
        resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: 'node-7.txt', fullPath: 'C:\\pulse\\incoming\\node-7.txt', rowCount: 312, lastModified: '2026-05-29T12:00:00Z', header, sampleRow: dataRow },
        ],
        analyzeFile: async () => ({
          encoding: 'UTF-8', rowCount: 312, columnCount: 82, delimiter: '쉼표 (,)',
          intervalGuess: 60, preview: [header, dataRow],
        }),
      };
    });
    await page.goto('/');
  });

  test('지중경사계 81열 → 깊이 프로파일 1개로 묶임', async ({ page }) => {
    // 감지·등록 탭에서 파일별 '등록' 으로 위저드 진입 (파일 감지 단계 없음)
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await page.getByRole('button', { name: '등록', exact: true }).first().click();
    // 3단계 스테퍼 (분석 → 채널 매핑 → 확인)
    for (const s of ['분석', '채널 매핑', '확인']) {
      await expect(page.getByText(s, { exact: true })).toBeVisible();
    }
    // Step1: 분석 → 다음
    await page.getByRole('button', { name: '다음' }).click();
    // Step2: 깊이 프로파일로 묶여 표시
    await expect(page.getByText('0~40m · 0.5m 간격 · 81점')).toBeVisible();
    await expect(page.getByText('깊이 프로파일 · 81점')).toBeVisible();
  });
});

test.describe('Pulse v2 — 포맷 패턴 판정/등록 게이트', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse',
        getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p,
        resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 2, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          // 정상(번호형) — 등록 가능
          { fileName: 'good.txt', fullPath: 'C:\\pulse\\incoming\\good.txt', rowCount: 100, lastModified: '2026-05-29T12:00:00Z',
            header: ['DateTime', '1', '2', '3'], sampleRow: ['2026-05-01 09:00:00', '8209.94', '0', '7999.85'] },
          // 비정형(열 수 불일치) — 권장 모드에선 경고 후 등록 허용
          { fileName: 'odd.txt', fullPath: 'C:\\pulse\\incoming\\odd.txt', rowCount: 100, lastModified: '2026-05-29T11:30:00Z',
            header: ['DateTime', 'A', 'B'], sampleRow: ['2026-05-01 09:00:00', '1'] },
          // 형식 오류(값 열 없음) — 차단
          { fileName: 'bad.txt', fullPath: 'C:\\pulse\\incoming\\bad.txt', rowCount: 100, lastModified: '2026-05-29T11:00:00Z',
            header: ['DateTime'], sampleRow: ['2026-05-01 09:00:00'] },
        ],
        analyzeFile: async () => null,
      };
    });
    await page.goto('/');
  });

  test('정상·비정형은 등록 가능, 형식 오류만 등록 불가 (권장/느슨)', async ({ page }) => {
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await expect(page.getByText('번호형')).toBeVisible();          // good
    await expect(page.getByText('비정형').last()).toBeVisible();   // odd 행 뱃지(범례와 구분)
    await expect(page.getByText('형식 오류').last()).toBeVisible(); // bad 행 뱃지
    // good + odd = 등록 버튼 2개, bad = 등록 불가 1개
    await expect(page.getByRole('button', { name: '등록', exact: true })).toHaveCount(2);
    await expect(page.getByRole('button', { name: /등록 불가/ })).toHaveCount(1);

    // 형식 안내 패널 — 링크로 열기 + 예시 표시
    await page.getByRole('button', { name: /형식 안내/ }).click();
    await expect(page.getByText('파일 형식 안내')).toBeVisible();
    await expect(page.getByText('"DateTime","0.0M","0.5M", …')).toBeVisible(); // 깊이형 예시
  });
});

test.describe('Pulse v2 — 설정 데이터 폴더', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\Users\\me\\Desktop',
        getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p,
        resetToDefault: async () => 'C:\\Users\\me\\Desktop',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 3, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [],
        analyzeFile: async () => null,
      };
    });
    await page.goto('/');
  });

  test('현재 폴더 검증 결과 + 기본 폴더 안내', async ({ page }) => {
    await page.getByRole('button', { name: '설정' }).first().click();
    // config 의 현재 폴더가 입력란에 로드되고 검증 결과가 보임
    await expect(page.getByText(/접근 가능 · \.txt 3개 감지/)).toBeVisible();
    // 기본 폴더 안내
    await expect(page.getByText('C:\\Users\\me\\Desktop')).toBeVisible();
  });
});

test.describe('Pulse v2 — 노드 등록 백엔드 실전송', () => {
  test('등록 시 nodes:register 호출 + 결과 토스트', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: '지중경사계_I1.txt', fullPath: 'C:\\pulse\\incoming\\지중경사계_I1.txt', rowCount: 100, lastModified: '2026-05-29T12:00:00Z',
            header: ['DateTime', '1', '2'], sampleRow: ['2026-05-01 09:00:00', '1.1', '2.2'] },
        ],
        analyzeFile: async () => ({ encoding: 'UTF-8', rowCount: 100, columnCount: 3, delimiter: '쉼표 (,)', intervalGuess: 60, preview: [['DateTime', '1', '2'], ['2026-05-01 09:00:00', '1.1', '2.2']] }),
        getBackendConfig: async () => ({ url: 'https://geo.example.com', hasKey: true }),
        setBackendConfig: async (c) => ({ url: c.url || '', hasKey: true }),
        registerNode: async () => ({ ok: true, status: 201 }),
      };
    });
    await page.goto('/');
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await page.getByRole('button', { name: '등록', exact: true }).first().click();
    await page.getByRole('button', { name: '다음' }).click(); // 분석 → 매핑
    await page.getByRole('button', { name: '다음' }).click(); // 매핑 → 확인
    await page.getByRole('button', { name: '등록 완료' }).click();
    await expect(page.getByText(/백엔드 등록 완료/)).toBeVisible(); // registerNode ok → 토스트
  });
});

test.describe('Pulse v2 — 계측기 종류 → 채널 코드 약어', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      const header = ['DateTime', 'A', 'B', 'C'];
      const dataRow = ['2026-05-01 09:00', '1.1', '2.2', '3.3'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse',
        getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p,
        resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: 'gw.txt', fullPath: 'C:\\pulse\\incoming\\gw.txt', rowCount: 50, lastModified: '2026-05-29T12:00:00Z', header, sampleRow: dataRow },
        ],
        analyzeFile: async () => ({
          encoding: 'UTF-8', rowCount: 50, columnCount: 4, delimiter: '쉼표 (,)',
          intervalGuess: 60, preview: [header, dataRow],
        }),
      };
    });
    await page.goto('/');
  });

  test('수위계 선택 시 채널이 WL-1, WL-2, WL-3 으로 바뀜', async ({ page }) => {
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await page.getByRole('button', { name: '등록', exact: true }).first().click();
    await page.getByRole('button', { name: '다음' }).click(); // 분석 → 채널 매핑
    // 계측기 종류 = 수위계 선택 (water_level → WL). exact: '수위계'는 '지하수위계'의 부분문자열이라 정확매칭 필요
    await page.getByRole('button', { name: '(미지정)' }).first().click();
    await page.getByRole('button', { name: '수위계', exact: true }).click();
    // 채널 코드가 WL-1, WL-2, WL-3 으로 변경
    for (const c of ['WL-1', 'WL-2', 'WL-3']) {
      await expect(page.getByText(c, { exact: true })).toBeVisible();
    }
  });
});

test.describe('Pulse v2 — 등록 payload 에 channels 가 실린다 (80053 회귀 가드)', () => {
  test('번호형 3열(80053) → 등록 시 channels[3]·sensor_count 3 전송', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__register = [];
      // 실제 80053.txt 형태: "DateTime","1","2","3" (2열은 전부 0)
      const header = ['DateTime', '1', '2', '3'];
      const sample = ['2026-05-01 09:00:00', '8209.94', '0', '7999.85'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: '80053.txt', fullPath: 'C:\\pulse\\incoming\\80053.txt', rowCount: 7, lastModified: '2026-05-29T12:00:00Z', header, sampleRow: sample },
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
    await page.getByRole('button', { name: '(미지정)' }).first().click(); // 계측기 종류
    await page.getByRole('button', { name: '수위계', exact: true }).click(); // water_level → WL (80053=수위계)
    await page.getByRole('button', { name: '다음' }).click(); // 매핑 → 확인
    await page.getByRole('button', { name: '등록 완료' }).click();
    await page.waitForFunction(() => (window.__register || []).length >= 1);
    const body = await page.evaluate(() => window.__register[0]);
    // 펄스는 3열을 센서 3개로 보냄 (1개 템플릿이 아니라 WL-1/2/3)
    expect(body.sensorType).toBe('water_level');
    expect(body.channels.map((c) => c.code)).toEqual(['WL-1', 'WL-2', 'WL-3']);
    expect(body.sensorCount).toBe(3);
  });
});

test.describe('Pulse v2 — 백엔드 노드 목록 조회 (GET nodes)', () => {
  test('시작 시 nodes:list 로 채워지되 자기 파일과 매칭되는 노드만 표시', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 2, error: null }),
        pickFolder: async () => null,
        // 감시폴더 파일: node_code = 확장자 뗀 파일명 (node-1.txt → node-1)
        scanFolder: async () => [
          { fileName: 'node-1.txt', fullPath: 'C:\\pulse\\incoming\\node-1.txt', rowCount: 10, lastModified: '2026-05-29T12:00:00Z', header: ['DateTime', '1'], sampleRow: ['2026-05-01 09:00:00', '1'] },
          { fileName: 'node-2.txt', fullPath: 'C:\\pulse\\incoming\\node-2.txt', rowCount: 10, lastModified: '2026-05-29T12:00:00Z', header: ['DateTime', '1'], sampleRow: ['2026-05-01 09:00:00', '1'] },
        ],
        analyzeFile: async () => null,
        // 백엔드 전체 목록: 내 파일과 매칭되는 2개 + 매칭 안 되는 OTHER-PC
        listNodes: async () => ({ ok: true, status: 200, nodes: [
          { node_code: 'node-1', sensor_type: 'groundwater', name: 'node-1', interval_min: 60, last_seen: '2026-05-29T12:00:00Z', channels: ['WL-1'] },
          { node_code: 'node-2', sensor_type: 'rainfall', name: 'node-2', interval_min: 10, channels: [] },
          { node_code: 'OTHER-PC', sensor_type: 'tilt', name: '남의 PC 노드', channels: [] },
        ] }),
      };
    });
    await page.goto('/');
    // 내 파일과 매칭되는 노드만 표시
    await expect(page.getByText('node-1').first()).toBeVisible();
    await expect(page.getByText('node-2').first()).toBeVisible();
    await expect(page.getByText('아직 수신 중인 노드가 없습니다')).toHaveCount(0);
    // 매칭 파일 없는 백엔드 노드(OTHER-PC)는 숨김 (자기 노드만)
    await expect(page.getByText('OTHER-PC')).toHaveCount(0);
  });
});

test.describe('Pulse v2 — 측정값 전송 (ingest)', () => {
  test('등록 후 새로고침 → 센서별 ingest 호출(증분)', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__ingest = [];
      const header = ['DateTime', '1', '2', '3'];
      const sample = ['2026-05-01 09:00:00', '1.1', '2.2', '3.3'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: '수위계_80053.txt', fullPath: 'C:\\pulse\\incoming\\수위계_80053.txt', rowCount: 50, lastModified: '2026-05-29T12:00:00Z', header, sampleRow: sample },
        ],
        analyzeFile: async () => ({ encoding: 'UTF-8', rowCount: 50, columnCount: 4, delimiter: '쉼표 (,)', intervalGuess: 60, preview: [header, sample] }),
        listNodes: async () => ({ ok: true, status: 200, nodes: [] }),
        registerNode: async () => ({ ok: true, status: 201 }),
        // 신규행 2개 반환(증분 워터마크는 mock 이라 무시) + head/sample(형식 재검증용)
        readMeasurements: async () => ({ ok: true, columnCount: 4, head: header, sample, rows: [
          { at: '2026-05-31 09:00', ts: 1000, cells: ['2026-05-31 09:00', '1.1', '2.2', '3.3'] },
          { at: '2026-05-31 10:00', ts: 2000, cells: ['2026-05-31 10:00', '1.2', '2.3', '3.4'] },
        ] }),
        ingest: async (p) => { window.__ingest.push(p); return { ok: true, status: 200 }; },
      };
    });
    await page.goto('/');
    // 등록 (수위계 → WL-1/2/3 센서 3개)
    await page.getByRole('button', { name: /감지 · 등록/ }).first().click();
    await page.getByRole('button', { name: '등록', exact: true }).first().click();
    await page.getByRole('button', { name: '다음' }).click(); // 분석 → 매핑
    await page.getByRole('button', { name: '다음' }).click(); // 매핑 → 확인
    await page.getByRole('button', { name: '등록 완료' }).click();
    // 새로고침 → syncAll → 센서별 ingest
    await page.getByRole('button', { name: '새로고침' }).click();
    await page.waitForFunction(() => (window.__ingest || []).length >= 3);
    const calls = await page.evaluate(() => window.__ingest);
    expect(calls.map((c) => c.channelCode).sort()).toEqual(['WL-1', 'WL-2', 'WL-3']);
    // 각 센서 2개 측정값(신규행 2개), sensorCode prefix 는 메인에서 조합되므로 여기선 channelCode 확인
    for (const c of calls) {
      expect(c.nodeId).toBeTruthy();
      expect(c.measurements.length).toBe(2);
    }
  });

  // 정직한 raw 전송(백엔드 핸드오프 2026-06-03): 측정 실패는 버리거나 0으로 바꾸지 말고
  //   value:null 로 보내 백엔드가 missing 판정. 빈 셀(='', Number('')===0 함정)·비숫자 모두 null.
  test('빈 셀/비숫자 측정 실패는 drop·0 변환 없이 value:null 로 전송', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__ingest = [];
      const header = ['DateTime', '1', '2', '3'];
      const sample = ['2026-05-01 09:00:00', '1.1', '2.2', '3.3'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: '수위계_80053.txt', fullPath: 'C:\\pulse\\incoming\\수위계_80053.txt', rowCount: 50, lastModified: '2026-05-29T12:00:00Z', header, sampleRow: sample },
        ],
        analyzeFile: async () => ({ encoding: 'UTF-8', rowCount: 50, columnCount: 4, delimiter: '쉼표 (,)', intervalGuess: 60, preview: [header, sample] }),
        listNodes: async () => ({ ok: true, status: 200, nodes: [] }),
        registerNode: async () => ({ ok: true, status: 201 }),
        // 행1: WL-1 빈셀(''), WL-3 비숫자('Err') / 행2: WL-2 빈셀('')
        readMeasurements: async () => ({ ok: true, columnCount: 4, head: header, sample, rows: [
          { at: '2026-05-31 09:00', ts: 1000, cells: ['2026-05-31 09:00', '', '2.2', 'Err'] },
          { at: '2026-05-31 10:00', ts: 2000, cells: ['2026-05-31 10:00', '1.2', '', '3.4'] },
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
    await page.waitForFunction(() => (window.__ingest || []).length >= 3);
    const calls = await page.evaluate(() => window.__ingest);
    const byCh = Object.fromEntries(calls.map((c) => [c.channelCode, c.measurements.map((m) => m.value)]));
    // 두 행 모두 전송됨(비숫자·빈셀이 drop 되지 않음 → 길이 2 유지)
    expect(byCh['WL-1']).toEqual([null, 1.2]); // 빈셀이 0 아닌 null
    expect(byCh['WL-2']).toEqual([2.2, null]);
    expect(byCh['WL-3']).toEqual([null, 3.4]); // 비숫자가 drop 아닌 null
    // 0 둔갑 방지: 어떤 측정값도 0 이 아니어야 함
    for (const c of calls) for (const m of c.measurements) expect(m.value).not.toBe(0);
  });
});

test.describe('Pulse v2 — 재시작 후 자동 재연결 → ingest', () => {
  test('GET 노드가 로컬 파일과 재연결되어 새로고침 시 센서별 ingest', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__ingest = [];
      const header = ['DateTime', '1', '2', '3'];
      const sample = ['2026-05-01 09:00:00', '8209.94', '0', '7999.85'];
      window.electronAPI = {
        getDefaultFolder: async () => 'C:\\pulse', getRootFolder: async () => 'C:\\pulse\\incoming',
        setRootFolder: async (p) => p, resetToDefault: async () => 'C:\\pulse',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 1, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [
          { fileName: '80053.txt', fullPath: 'C:\\pulse\\incoming\\80053.txt', rowCount: 7, lastModified: '2026-05-29T12:00:00Z', header, sampleRow: sample },
        ],
        analyzeFile: async () => ({ encoding: 'UTF-8', rowCount: 7, columnCount: 4, delimiter: '쉼표 (,)', intervalGuess: 60, preview: [header, sample] }),
        // 재시작 상황: 로컬 등록 없음. 백엔드엔 이미 80053(센서 3개) 존재.
        listNodes: async () => ({ ok: true, status: 200, nodes: [
          { node_code: '80053', sensor_type: 'water_level', name: '80053', interval_min: 60, last_seen: null, channels: ['80053-WL-1', '80053-WL-2', '80053-WL-3'] },
        ] }),
        readMeasurements: async () => ({ ok: true, columnCount: 4, head: header, sample, rows: [
          { at: '2026-05-31 09:00', ts: 1000, cells: ['2026-05-31 09:00', '8209.94', '0', '7999.85'] },
        ] }),
        ingest: async (p) => { window.__ingest.push(p); return { ok: true, status: 200 }; },
      };
    });
    await page.goto('/');
    await expect(page.getByText('80053').first()).toBeVisible(); // GET 으로 모니터에 뜸(재연결 포함)
    await page.getByRole('button', { name: '새로고침' }).click();
    await page.waitForFunction(() => (window.__ingest || []).length >= 3);
    const codes = (await page.evaluate(() => window.__ingest)).map((c) => c.channelCode).sort();
    // 재연결 시 백엔드의 실제 센서코드를 ingest 에 사용(센서코드 정본=백엔드, 타입/약어 드리프트 무관)
    expect(codes).toEqual(['80053-WL-1', '80053-WL-2', '80053-WL-3']);
  });
});

test.describe('Pulse v2 — 노드 삭제 (DELETE nodes)', () => {
  test('영구 삭제 성공 → 드로어 닫힘 + 목록 제거', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.electronAPI = {
        getDefaultFolder: async () => '', getRootFolder: async () => '',
        setRootFolder: async (p) => p, resetToDefault: async () => '',
        validateFolder: async () => ({ exists: false, accessible: false, txtCount: 0, error: 'empty' }),
        pickFolder: async () => null, scanFolder: async () => [], analyzeFile: async () => null,
        deleteNode: async () => ({ ok: true, status: 200, message: '삭제 완료', node_code: 'YH-0007' }),
      };
    });
    await page.goto('/?test=node');
    await expect(page.getByText('YH-0007').first()).toBeVisible();
    await page.getByRole('button', { name: '노드 삭제' }).click();
    await page.getByRole('button', { name: '영구 삭제' }).click();
    // 드로어가 닫히고 모니터는 빈 상태(노드 목록에서 제거됨)
    await expect(page.getByText('아직 수신 중인 노드가 없습니다')).toBeVisible();
  });

  test('현장 배치/데이터 있는 노드는 400 거부 안내 + 목록 유지', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.electronAPI = {
        getDefaultFolder: async () => '', getRootFolder: async () => '',
        setRootFolder: async (p) => p, resetToDefault: async () => '',
        validateFolder: async () => ({ exists: false, accessible: false, txtCount: 0, error: 'empty' }),
        pickFolder: async () => null, scanFolder: async () => [], analyzeFile: async () => null,
        deleteNode: async () => ({ ok: false, status: 400, error: 'rejected', message: '현장에 배치된 노드입니다. 웹에서 먼저 회수하세요.' }),
      };
    });
    await page.goto('/?test=node');
    await page.getByRole('button', { name: '노드 삭제' }).click();
    await page.getByRole('button', { name: '영구 삭제' }).click();
    await expect(page.getByText(/웹에서 먼저 회수/)).toBeVisible(); // 서버 거부 메시지 안내
    await expect(page.getByText('YH-0007').first()).toBeVisible();  // 보호되어 드로어/노드 유지
  });
});

test.describe('Pulse v2 — 센서 생명주기 (PATCH sensors)', () => {
  test('드로어에서 센서를 "비활성"으로 → PATCH {status:inactive} 호출 + 표시', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__sensorStatus = [];
      window.electronAPI = {
        getDefaultFolder: async () => '', getRootFolder: async () => '',
        setRootFolder: async (p) => p, resetToDefault: async () => '',
        validateFolder: async () => ({ exists: false, accessible: false, txtCount: 0, error: 'empty' }),
        pickFolder: async () => null, scanFolder: async () => [], analyzeFile: async () => null,
        setSensorStatus: async (sensorCode, status) => { window.__sensorStatus.push({ sensorCode, status }); return { ok: true, status: 200, lifecycle_state: status }; },
      };
    });
    await page.goto('/?test=node'); // 합성 노드 YH-0007 (채널 GI-A·GI-B)
    await expect(page.getByText('GI-A').first()).toBeVisible();
    // 첫 센서(GI-A) 생명주기 드롭다운('정상') 열고 '비활성' 선택 (전송 값은 inactive)
    await page.getByRole('button', { name: '정상', exact: true }).first().click();
    await page.getByRole('button', { name: '비활성', exact: true }).click();
    await page.waitForFunction(() => (window.__sensorStatus || []).length >= 1);
    const call = (await page.evaluate(() => window.__sensorStatus))[0];
    expect(call.sensorCode).toBe('YH-0007-GI-A'); // {node_code}-{code}
    expect(call.status).toBe('inactive'); // 라벨은 비활성, 전송 값은 inactive (dead/disabled 폐기)
    await expect(page.getByText('비활성').first()).toBeVisible();
  });

  test('드로어 운영 시작일 입력 → setMonitoringFrom 호출(ISO/KST)', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__mon = [];
      window.electronAPI = {
        getDefaultFolder: async () => '', getRootFolder: async () => '',
        setRootFolder: async (p) => p, resetToDefault: async () => '',
        validateFolder: async () => ({ exists: false, accessible: false, txtCount: 0, error: 'empty' }),
        pickFolder: async () => null, scanFolder: async () => [], analyzeFile: async () => null,
        setMonitoringFrom: async (p) => { window.__mon.push(p); return { ok: true, status: 200 }; },
      };
    });
    await page.goto('/?test=node'); // 합성 노드 YH-0007(inclinometer)
    await page.getByLabel('운영 시작일').first().fill('2026-05-19');
    await page.waitForFunction(() => (window.__mon || []).length >= 1);
    const call = (await page.evaluate(() => window.__mon))[0];
    expect(call.nodeId).toBe('YH-0007');
    expect(call.sensorType).toBe('inclinometer');
    expect(call.monitoringFrom).toBe('2026-05-19T00:00:00+09:00'); // ISO/KST
  });

  test('드로어에서 채널 종류 변경 → setSensorRanges 에 채널 sensor_type 동봉', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__ranges = [];
      window.electronAPI = {
        getDefaultFolder: async () => '', getRootFolder: async () => '',
        setRootFolder: async (p) => p, resetToDefault: async () => '',
        validateFolder: async () => ({ exists: false, accessible: false, txtCount: 0, error: 'empty' }),
        pickFolder: async () => null, scanFolder: async () => [], analyzeFile: async () => null,
        setSensorRanges: async (p) => { window.__ranges.push(p); return { ok: true, status: 200 }; },
      };
    });
    await page.goto('/?test=node'); // 합성 노드 YH-0007(inclinometer, GI-A/GI-B)
    // 첫 채널(GI-A) 종류 Select('(노드 대표)') 열고 '균열계' 선택
    await page.getByRole('button', { name: '(노드 대표)', exact: true }).first().click();
    await page.getByRole('button', { name: '균열계', exact: true }).click();
    await page.waitForFunction(() => (window.__ranges || []).length >= 1);
    const call = (await page.evaluate(() => window.__ranges))[0];
    expect(call.nodeId).toBe('YH-0007');
    const byCode = Object.fromEntries(call.channels.map((c) => [c.code, c]));
    expect(byCode['GI-A']).toMatchObject({ sensorType: 'crack', unit: 'mm' }); // 변경된 채널
  });
});

test.describe('Pulse v2 — 노드 상세 드로어 (?test=node)', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmpty(page);
    await page.goto('/?test=node');
  });

  test('합성 노드로 드로어가 열림 + 3탭', async ({ page }) => {
    await expect(page.getByText('YH-0007').first()).toBeVisible();
    for (const t of ['채널 스트림', '전송 큐', '진단 로그']) {
      await expect(page.getByRole('button', { name: new RegExp(t) }).first()).toBeVisible();
    }
  });

  test('전송 큐 탭 — 재전송/버퍼 비우기 액션', async ({ page }) => {
    // 드로어(마지막 aside)의 전송 큐 탭 — 사이드바의 동명 메뉴와 구분
    await page.locator('aside').last().getByRole('button', { name: '전송 큐' }).click();
    await expect(page.getByRole('button', { name: '지금 재전송' })).toBeVisible();
    await expect(page.getByRole('button', { name: '버퍼 비우기' })).toBeVisible();
    await expect(page.getByText(/현장 stamp 는 백엔드/)).toBeVisible();
  });

  test('정상 범위 — 입력 시 행 표시 설정됨 / 미입력 검사 안 함 (이상치 판정 없음)', async ({ page }) => {
    await expect(page.getByText('정상 범위').first()).toBeVisible();
    // GI-A 상한 입력 → 같은 행 "설정됨"
    const max = page.getByLabel('GI-A 상한');
    await max.fill('30');
    await max.press('Enter');
    await expect(page.getByText('설정됨').first()).toBeVisible();
    // GI-B(미입력)는 "검사 안 함" — 로컬 이상치/정상 판정 표식은 없어야 함
    await expect(page.getByText('검사 안 함').first()).toBeVisible();
    await expect(page.getByText('이상치', { exact: true })).toHaveCount(0);
  });
});

test.describe('Pulse v2 — 정상범위 백엔드 저장 (POST nodes)', () => {
  test('범위 입력 후 "정상범위 저장" → setSensorRanges 호출(화면값 그대로)', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__ranges = [];
      window.electronAPI = {
        getDefaultFolder: async () => '', getRootFolder: async () => '',
        setRootFolder: async (p) => p, resetToDefault: async () => '',
        validateFolder: async () => ({ exists: false, accessible: false, txtCount: 0, error: 'empty' }),
        pickFolder: async () => null, scanFolder: async () => [], analyzeFile: async () => null,
        setSensorRanges: async (p) => { window.__ranges.push(p); return { ok: true, status: 200 }; },
      };
    });
    await page.goto('/?test=node'); // 합성 노드 YH-0007(inclinometer, GI-A/GI-B)
    await page.getByLabel('GI-A 하한').fill('-30');
    await page.getByLabel('GI-A 하한').press('Enter');
    await page.getByLabel('GI-A 상한').fill('30');
    await page.getByLabel('GI-A 상한').press('Enter');
    await page.getByRole('button', { name: /정상범위 저장/ }).click();
    await page.waitForFunction(() => (window.__ranges || []).length >= 1);
    const call = (await page.evaluate(() => window.__ranges))[0];
    expect(call.nodeId).toBe('YH-0007');
    expect(call.sensorType).toBe('inclinometer');
    const byCode = Object.fromEntries(call.channels.map((c) => [c.code, c]));
    expect(byCode['GI-A']).toMatchObject({ validMin: -30, validMax: 30 });
    expect(byCode['GI-B']).toMatchObject({ validMin: null, validMax: null }); // 미입력=null(해제)
    await expect(page.getByText('정상범위를 백엔드에 저장했습니다')).toBeVisible();
  });

  test('전체 적용(fill-down) → 한 행 값이 노드 전체 채널에 복사되고 그대로 저장', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      window.__ranges = [];
      window.electronAPI = {
        getDefaultFolder: async () => '', getRootFolder: async () => '',
        setRootFolder: async (p) => p, resetToDefault: async () => '',
        validateFolder: async () => ({ exists: false, accessible: false, txtCount: 0, error: 'empty' }),
        pickFolder: async () => null, scanFolder: async () => [], analyzeFile: async () => null,
        setSensorRanges: async (p) => { window.__ranges.push(p); return { ok: true, status: 200 }; },
      };
    });
    await page.goto('/?test=node'); // 합성 노드 YH-0007(inclinometer, GI-A/GI-B)
    await page.getByLabel('GI-A 하한').fill('-30');
    await page.getByLabel('GI-A 상한').fill('30');
    await page.getByLabel('GI-A 상한').press('Enter');
    // GI-A 행의 "전체 적용" → 노드 전체(2채널) 복사
    await page.getByLabel('GI-A 범위를 전체 채널에 적용').click();
    await expect(page.getByText('2개 채널에 정상범위를 적용했습니다')).toBeVisible();
    // GI-B 입력칸에도 같은 값이 채워짐
    await expect(page.getByLabel('GI-B 하한')).toHaveValue('-30');
    await expect(page.getByLabel('GI-B 상한')).toHaveValue('30');
    // 저장 → 두 채널 모두 동일 범위 전송
    await page.getByRole('button', { name: /정상범위 저장/ }).click();
    await page.waitForFunction(() => (window.__ranges || []).length >= 1);
    const call = (await page.evaluate(() => window.__ranges))[0];
    const byCode = Object.fromEntries(call.channels.map((c) => [c.code, c]));
    expect(byCode['GI-A']).toMatchObject({ validMin: -30, validMax: 30 });
    expect(byCode['GI-B']).toMatchObject({ validMin: -30, validMax: 30 });
  });
});

// 개발/테스트 자동 등록(?test=import) — 감시 폴더 더미 .txt 를 헤드리스 일괄 등록 + 임계치 자동 도출
test.describe('Pulse v2 — 자동 등록 시드 (?test=import)', () => {
  test('더미 .txt 2개 → 노드 2대 등록 + 채널 정상범위 자동 도출', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pulse:guideSeen', '1'); } catch {}
      try { window.localStorage.removeItem('pulse:channelRanges'); } catch {}
      const f1 = {
        fileName: '80053.txt', fullPath: 'C:/data/80053.txt', lastModified: '2026-06-20T00:00:00.000Z', rowCount: 4,
        header: ['DateTime', 'GW-1', 'GW-2'], sampleRow: ['2026-06-01 00:00', '8.10', '8.30'],
      };
      const f2 = {
        fileName: '90021.txt', fullPath: 'C:/data/90021.txt', lastModified: '2026-06-20T00:00:00.000Z', rowCount: 4,
        header: ['DateTime', 'CR-1'], sampleRow: ['2026-06-01 00:00', '1.20'],
      };
      // 번호형 헤더("1") — 종류를 헤더로 못 잡음. 파일명(03_groundwater)에서 추론돼야 함.
      const f3 = {
        fileName: '03_groundwater.txt', fullPath: 'C:/data/03_groundwater.txt', lastModified: '2026-06-20T00:00:00.000Z', rowCount: 4,
        header: ['DateTime', '1'], sampleRow: ['2026-06-01 00:00', '-5.0'],
      };
      window.electronAPI = {
        getDefaultFolder: async () => 'C:/data', getRootFolder: async () => 'C:/data',
        setRootFolder: async (p) => p, resetToDefault: async () => '',
        validateFolder: async () => ({ exists: true, accessible: true, txtCount: 3, error: null }),
        pickFolder: async () => null,
        scanFolder: async () => [f1, f2, f3],
        analyzeFile: async (p) => {
          if (String(p).includes('80053')) return { encoding: 'UTF-8', rowCount: 4, columnCount: 3, delimiter: ',', intervalGuess: 60,
            preview: [['DateTime', 'GW-1', 'GW-2'], ['2026-06-01 00:00', '8.10', '8.30'], ['2026-06-01 01:00', '8.12', '8.28'], ['2026-06-01 02:00', '8.09', '8.31'], ['2026-06-01 03:00', '8.11', '8.29']] };
          if (String(p).includes('groundwater')) return { encoding: 'UTF-8', rowCount: 4, columnCount: 2, delimiter: ',', intervalGuess: 60,
            preview: [['DateTime', '1'], ['2026-06-01 00:00', '-5.0'], ['2026-06-01 01:00', '-5.1'], ['2026-06-01 02:00', '-4.9'], ['2026-06-01 03:00', '-5.0']] };
          return { encoding: 'UTF-8', rowCount: 4, columnCount: 2, delimiter: ',', intervalGuess: 60,
            preview: [['DateTime', 'CR-1'], ['2026-06-01 00:00', '1.20'], ['2026-06-01 01:00', '1.22'], ['2026-06-01 02:00', '1.19'], ['2026-06-01 03:00', '1.21']] };
        },
        registerNode: async () => ({ ok: true, status: 200 }),
        setSensorRanges: async () => ({ ok: true, status: 200 }),
      };
    });
    await page.goto('/?test=import');

    // 자동 등록 토스트 + 세 노드가 모니터에 표시
    await expect(page.getByText(/자동 등록 3개 노드/).first()).toBeVisible();
    await expect(page.getByText('80053').first()).toBeVisible();
    await expect(page.getByText('90021').first()).toBeVisible();
    await expect(page.getByText('03_groundwater').first()).toBeVisible();

    // 임계치(정상범위)가 채널별로 자동 도출되어 저장됨 (localStorage 입력 보관)
    const ranges = await page.evaluate(() => JSON.parse(window.localStorage.getItem('pulse:channelRanges') || '{}'));
    expect(Object.keys(ranges).length).toBeGreaterThanOrEqual(4); // GW-1, GW-2, CR-1, 03_groundwater::GW-1
    for (const key of ['80053::GW-1', '80053::GW-2', '90021::CR-1']) {
      expect(ranges[key]).toBeTruthy();
      expect(typeof ranges[key].min).toBe('number');
      expect(typeof ranges[key].max).toBe('number');
      expect(ranges[key].min).toBeLessThan(ranges[key].max);
    }
    // 번호형 더미: 파일명에서 groundwater 추론 → 채널 코드가 GW-1 로 생성됐는지(범위 키로 확인)
    expect(ranges['03_groundwater::GW-1']).toBeTruthy();
  });
});
