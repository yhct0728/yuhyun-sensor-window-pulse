# 펄스 — 다채널 원시 전송(raw_channels) 적용 설계

- 작성일: 2026-06-25
- 상태: 설계 확정(구현 전). Phase 1 = 배관 + 단일-센서 다채널(쉬움). Phase 2 = 형제 분할·지중경사 중첩.
- 관련: 백엔드 핸드오프 「펄스 — API 스키마에 맞춘 대폭 수정」, 백엔드 정본 `docs/superpowers/specs/2026-06-24-instrument-channel-schema-design.md`, 펄스 회신 `docs/backend-reply-instrument-channel-schema.md`.

---

## 0. 목적

계측기의 **원시 채널(여러 칸)을 보존**하기 위해, 펄스가 ingest 시 최종값 1개(`value`) 대신
**원시 채널 배열(`raw_channels`)** 을 전송한다. 물리량 계산은 백엔드가 한다. 펄스는 공식을 모르며 **원시 운반자**다.

### 사전 사실(검증됨)
- 펄스에는 **삭제할 환산/공식/계수 계산 로직이 없다**(ADR-0009에서 이미 제거). 현재 공식·계수 흔적은 전부 **읽기 전용 도감**(`sensorReference.js`, `FormulaTab.jsx`, `CoefficientTab.jsx`)이며 적용 코드가 아니다 → **유지**.
- 펄스는 이미 **`sensorCode` 단위 전송**(`store.syncNode` 루프)과 **다중 열→1센서**(`sensorModel.sensors[].columns:number[]`) 구조를 가진다. 깊이 프로파일은 이미 *한 행 → 여러 keyed 하위값*으로 펼친다(`depthLabel`). → 본 변경은 신개념이 아니라 기존 패턴의 변주.

---

## 1. 결정 사항 (백엔드 합의 회신 포함)

| # | 질문 | 펄스 결정 | 근거 |
|---|---|---|---|
| 1 | 2출력 계측기(건물경사 X/Y) 전송 | **(A) 형제별 분할**(`...-X`, `...-Y` 각각 raw 전송) | 펄스는 `sensorCode` 단위 전송 — (A)는 기존 루프 그대로, 신규 경로 0. (B)는 노드단위 ingest 신설 필요. **구현은 Phase 2.** |
| 2 | 계수(calibration) 펄스 전송 | **백엔드 소유 — 펄스 미전송** | 펄스엔 계수 입력 출처가 없음(운영자가 백엔드 DB 입력). 펄스는 로거 raw만 봄. |
| 3 | 로거 원시 열 식별 | **열 순서(column index) 기준** | 실제 로거 헤더는 `'1','2','3'` 등 무의미한 경우 多. 펄스 `columns:number[]` 가 인덱스 기반이라 정합. 헤더명은 보조 override. |

추가: **정상범위(valid_min/max)** 는 **센서(물리량) 레벨 유지**(현행). raw별 범위 UI 추가 안 함. raw 글리치 컷은 백엔드.

---

## 2. 아키텍처

### 2.1 신규 모듈 — 로컬 미러 카탈로그
**`src/lib/instrumentCatalog.js`** (순수 데이터 + 조회 헬퍼, 단일 소스)
> 구현 시 위치 확정: 레포 관례(모든 헬퍼가 `src/lib/`)에 맞춰 `src/profiles/`가 아닌 `src/lib/`에 둠.
> `optical_target`은 `SENSOR_TYPES` enum 미등록이라 `rawChannels:false`(백엔드 키 확정 시 전환).

- 백엔드 `instrument-catalog.ts`(`GET /profiles`)의 **부분 미러**. 파일 머리에 "정본=백엔드 GET /profiles, 수동 동기화" 명시.
- 프로파일 항목: `{ key, label, sensorType, rawKeys: string[], unit?, rawChannels: boolean, depth?: boolean }`.
  - `rawKeys` — 원시 채널 키 목록(열 순서대로 매핑).
  - `rawChannels` — true 면 raw_channels 방출, false/미정의면 기존 value 경로(= **계측기별 순차 전환 플래그**).
  - `depth` — true 면 깊이형(행=깊이, depthLabel 부착). Phase 1 미구현(false 만).
- 헬퍼:
  ```js
  export function profileRawKeys(profileOrType)  // string[]  (없으면 [])
  export function isRawEnabled(profileOrType)     // boolean   (rawChannels 플래그)
  export function profileOf(profileOrType)        // 항목 or null
  ```
- 누락/불일치 시 → 기존 단일값 동작으로 **안전 폴백**.

### 2.2 `sensorModel.resolveSensors` — 다중 원시 그룹화(핵심 변경, 최소)
열→센서 해석에 한 갈래 추가:
- 프로파일이 **raw-enabled** 이고 파일 **값열 개수 == `rawKeys.length`** →
  **센서 1개**, `role:'multiraw'`, `columns` = 전체 값열, `rawKeys` = 순서대로 부착.
- 그 외(값열 수 불일치 포함) → **기존 동작 그대로**(번호형/이름형/깊이형/값+온도). 불일치 시 integrity 경고
  `{ level:'warn', code:'rawkey-count-mismatch', message:'원시 채널 수 불일치 — 단일값으로 처리' }`.
- 단일값·깊이형 **무변경**(하위호환).

> Phase 1 그룹화 규칙은 "한 파일 = 한 계측기 = N 원시열"만 다룬다. 한 파일에 같은 계측기 여러 대(열수>rawKeys), 형제 분할, 지중경사 깊이×면은 **Phase 2**(폴백+경고로 안전).

### 2.3 `store.syncNode` — 전송 방출
- `role:'multiraw'` 센서: 행마다
  `raw_channels = sensor.columns.map((col,i) => ({ key: sensor.rawKeys[i], raw: num(row.cells[col]) }))`,
  measurement = `{ measuredAt: toIso(row.at), raw_channels }` (value 없음).
  - `num()` 현행 유지: 빈셀·비숫자 → `null`(결측 보존), 열 누락(undefined) → 스킵.
- 그 외 역할(value/profile=depth) **무변경**.

### 2.4 `backendApi.ingestBody` — 변경 불필요
measurements 배열을 그대로 통과시키므로 measurement 객체가 `raw_channels` 를 들고 있으면 그대로 전송됨.

### 2.5 노드 등록
`POST /nodes` `channels[]` 의 `sensor_type` = 카탈로그 프로파일 키(현행 전송 경로 유지). `sensor_code = {node_code}-{channel.code}` 규약 준수.

---

## 3. 데이터 흐름

```
로거 .txt 신규행 (folderService.readMeasurements)
  → store.syncNode: node.sensors 루프
      ├ role:'multiraw' → measurements:[{measuredAt, raw_channels:[{key,raw}]}]
      ├ role:'profile'(depth) → 기존 depthLabel 전송 (무변경)
      └ role:'value'         → 기존 value 전송 (무변경)
  → folderApi.ingestBackend → IPC nodes:ingest → folderService.ingestToBackend
  → backendApi.ingestBody → POST /api/pulse/v1/ingest
```

---

## 4. Phase 1 매핑표 (활성 프로파일 — 열 순서 기준)

> 갱신(2026-06-26): 백엔드 카탈로그 17키 수신 후 정합. `anchor`(EA하중계)·`strut`(ST하중계) 분리, 잘못된 `optical_target` 제거(정본=`survey_3d` siblings → Phase 2).

| 프로파일(카탈로그 key=sensor_type) | 라벨 | 로거 값열(순서) → raw key | 단위(원시) | role | 등록 약어(ch) |
|---|---|---|---|---|---|
| `anchor` | EA하중계(앵커) | 1→`A`, 2→`B`, 3→`C` | 10³Hz² | multiraw | EA |
| `strut` | ST하중계(버팀보) | 1→`A`, 2→`B`, 3→`C` | 10³Hz² | multiraw | LC |
| `vibration` | 진동계 | 1→`X`, 2→`Y`, 3→`Z` | mm/s | multiraw | VB |
| `seismic` | 지진계 | 1→`X`, 2→`Y`, 3→`Z` | gal | multiraw | EQ |
| `pore_pressure` | 간극수압계 | 1→`R` | digit | multiraw(1키) | PWP |

카탈로그 `channels[].col`(0-based 데이터열)이 위 rawKeys 순서와 전부 일치 → Phase 1은 열 순서(positional) 매핑으로 충분. (명시적 col→key 소비는 Phase 2 §3-3에서.)

**단일값 유지(무변경, value 경로)**: 수위계(`WL`)·지하수위(`GL`)·균열(`D`)·침하(`level`)·변형률(`micro`)·우량(`RF`)·자동광파(`dist`) 등 — point:single 단일채널.

**Phase 2(미구현, 폴백+경고)**: siblings(`tilt` A0/A180/B0/B180→X/Y, `survey_3d` N/E/Z, `wind` WD/WS, `thermo_hygro` T/H — 카탈로그 `outputs[]`로 형제 분할), depth(`inclinometer` 깊이×`A_face`/`B_face`), 한 파일 다중 계측기. ※ `settlement`·`optical`은 카탈로그 `point:siblings`인데 outputs:null·단일채널이라 모호 → 백엔드 확인 필요.

---

## 5. 테스트 (TDD — 신규 `tests/raw-channels.spec.js`)

1. **카탈로그**: `profileRawKeys`/`isRawEnabled` — strut→[A,B,C]·enabled, water_level→[]·disabled, 미지 프로파일→[]·false.
2. **resolveSensors**:
   - strut 3값열 → 센서 1개 `role:'multiraw'`, `rawKeys:['A','B','C']`, `columns` 3개.
   - strut 인데 값열 2개(불일치) → 기존 폴백 + `rawkey-count-mismatch` 경고.
   - water_level(단일값) → 기존 동작 무변경(회귀 가드).
   - 깊이형(지중경사 81열) → 기존 profile 무변경(회귀 가드).
3. **syncNode 방출**(electronAPI 모킹):
   - multiraw 노드 → ingest 호출 measurement 에 `raw_channels:[{key:'A',raw},…]`, **value 키 없음**, 빈셀 raw=null 보존.
   - 단일값 노드 → 기존처럼 `value` 만(회귀 가드).
4. **ingestBody**: raw_channels 가 들어있는 measurement 를 그대로 전송(통과 검증).

검증: `npm test`(Playwright) 그린 + 기존 44 테스트 회귀 없음 + 빌드 0에러.

---

## 6. 동시 배포

펄스↔백엔드 계약 변경. 백엔드가 `value`+`raw_channels` 병행 수용 상태에서, 펄스는 **카탈로그 `rawChannels` 플래그를 프로파일별로 on** 하며 순차 전환. Phase 1 활성 집합만 우선 on, 나머지 off(기존 value 동작 유지).

---

## 7. 범위 밖(명시)

- 형제(X/Y) 분할 전송, 지중경사 깊이×면 중첩, 한 파일 다중 계측기 → **Phase 2**(별도 spec).
- 계수(calibration) 펄스 전송 → 안 함(백엔드 소유).
- 도감(공식·계수 설명 페이지) → 유지(읽기 전용, 적용 아님).
- raw별 정상범위 UI → 추가 안 함.
