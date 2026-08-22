# [백엔드 회신] 계측기 채널 스키마 개정 — 펄스 측 답변·계약·조건

> **회신 주체**: 펄스(현장 측정 PC 프로그램) 트랙.
> **회신 대상**: 백엔드 핸드오프 「계측기 채널 스키마 개정 — 펄스가 바뀌는 점」 (2026-06-24).
> **백엔드 정본 설계**: `docs/superpowers/specs/2026-06-24-instrument-channel-schema-design.md`.
> **상태**: §5 결정 **펄스 측 확정**. 단, 구현은 **공유 카탈로그 확정 + 와이어 계약 합의 + 동시 배포**가 전제(아래 ⛓).

---

## 0. 한 줄 회신

방향 **수용**합니다. 펄스는 원시 칸을 그대로 운반(`raw_channels`)하고 계산은 백엔드에 맡깁니다.
펄스 구조상 **`sensorCode` 단위 전송**과 **다중 열→1센서 매핑**이 이미 있어, 변경은 국소적입니다. §5는 아래로 확정.

---

## 1. 펄스 현 구조 — 이미 맞물리는 지점 (구현이 가벼운 근거)

- `lib/sensorModel.js` 의 각 센서는 이미 **`columns: number[]`**(읽을 열 목록)을 가집니다. 값 센서가 현재 1칸일 뿐, **여러 칸을 한 센서로 묶는 구조는 이미 존재**.
- `store.jsx` 의 **깊이 프로파일 전송**(`syncNode`)이 이미 *한 행 → 여러 keyed 하위값*으로 펼칩니다(`depthLabel` 키). `raw_channels` 는 동일 패턴(키만 `depthLabel`→`A/B/C`, 별개 measurement 대신 **한 measurement에 묶음**).
- 모든 전송이 **`sensorCode` 단위 루프**(`for (const s of node.sensors)`)입니다 → §5.1 결정의 근거.

→ **새 개념 도입이 아니라 기존 패턴의 변주.** 공식/계산은 펄스에 들어오지 않습니다.

---

## 2. §5 결정 — 펄스 확정 답변

### 5.1 2출력 계측기(경사 X/Y) → **(A) 형제별 분할 전송** ✅
- 펄스는 `sensorCode` 단위로 전송하므로, **X·Y 각 센서가 자기 raw 키를 실어** 보내면 기존 루프 그대로 — **신규 경로 0**.
- (B)(노드로 원시 1회 → 백엔드 분배)는 펄스에 **노드 단위 ingest 경로 신설**이 필요하고 "sensorCode=전송 단위" 모델을 깨므로 채택 안 함.
- **어느 raw 키가 어느 형제로 가는지는 카탈로그가 지정**(형제별 부분집합이든 전체 4채널이든 카탈로그 결정). 펄스는 매핑대로 열→키만 운반.

### 5.2 원시 단위/정상범위(valid_min/max) → **센서(물리량) 레벨 유지** ✅
- 운영자는 raw(Hz²)가 아닌 **물리 단위(kN·°)로 사고**. raw 채널별 임계는 운영자가 의미 있게 입력 불가.
- 펄스 UI는 **센서 대표 1쌍 유지**(현행). **raw별 범위 UI 추가 안 함.**
- raw 글리치(raw 0 등) 컷이 필요하면 **백엔드 책임**(백엔드가 raw→물리량 계산하며 raw를 봄).

### 5.3 로거 칸 식별 → **열 순서(column index) 기준** ✅
- 실제 로거 헤더는 `'1','2','3'` 등 무의미한 경우 多(펄스 numbered 패턴이 그 때문에 존재).
- **카탈로그는 `raw 키 → 열 인덱스`로 매핑.** 펄스 `columns:number[]` 가 인덱스 기반이라 그대로 맞물림.
- 헤더명이 유의미한 파일 대비 **헤더명 override**를 보조 키로 카탈로그에 허용 권장.

---

## 3. 펄스가 보낼 와이어 계약 (백엔드 확정 요청)

### 3-1. 수집 ingest — `POST /api/pulse/v1/ingest`
measurement 항목에 **선택적 `raw_channels`** 추가. `value` 는 선택(원시가 진실).

```jsonc
{
  "sensorCode": "DEMO-N2-EA-1",
  "measurements": [
    {
      "measuredAt": "2026-06-24T09:00:00+09:00",
      "raw_channels": [
        { "key": "A", "raw": 8046 },
        { "key": "B", "raw": 7942 },
        { "key": "C", "raw": 8147 }
      ]
    }
  ],
  "rawFile": "EA하중계_N2.txt"
}
```
- `key` = 카탈로그가 정한 원시 채널 키(A/B/C, A0/A180…). `raw` = 숫자 또는 **`null`(측정 실패=결측, drop/0 둔갑 금지 — 현행 정직 raw 원칙 유지)**.
- `depthLabel` 은 깊이형에서 그대로 병행 가능(지중경사계 = 깊이 × raw, §5 특이 케이스 참조).
- **단일값 계측기는 현행 그대로** `value` 만, `raw_channels` 생략(하위호환).

### 3-2. 노드 등록 — `POST /api/pulse/v1/nodes`
`channels[]` 각 항목에 **`instrument_profile`**(카탈로그 프로파일 키)를 실어, 백엔드가 어느 원시 공식을 쓸지 식별.
```jsonc
{
  "node_code": "DEMO-N2",
  "sensor_type": "strut",
  "channels": [
    { "ch": 1, "code": "EA-1", "sensor_type": "strut", "instrument_profile": "load_cell_ea", "unit": "kN" }
  ]
}
```
- **확인 요청**: 키 이름 `instrument_profile` 와 값 도메인(프로파일 id 집합)을 카탈로그와 일치시켜 확정.
- 노드 레벨 `sensor_type` 는 대표/폴백으로 유지(현행).

---

## 4. ⛓ 펄스가 구현을 시작하려면 필요한 것 (블로커 — 백엔드/프론트)

1. **공유 카탈로그(`instrument-catalog.ts`) 확정 + 펄스가 읽을 형식.** §4·§8 “프론트가 12종 샘플표로 확정”의 산출물이 모든 매핑의 전제. 펄스가 소비할 항목:
   - 프로파일별 **원시 채널 키 목록**(A/B/C…)
   - 각 키의 **열 인덱스 매핑**(+ 선택적 헤더명 override)
   - (형제 계측기) **센서 분할 규칙 + suffix**(X/Y 등)
2. **`raw_channels` 와이어 모양**(`{key, raw}`) 및 **`instrument_profile` 키/값 도메인** 최종 합의(§3).
3. **동시 배포 합의**(§5).

> 위 1·2가 고정되기 전엔 펄스는 **와이어를 바꾸지 않습니다.**

---

## 5. 동시 배포 계획 (계약 변경 — 데이터 유실 방지)

1. 백엔드가 **`value` 와 `raw_channels` 둘 다 수용**하도록 먼저 배포(전환기 호환).
2. 펄스가 카탈로그 기반 `raw_channels` 방출을 **플래그 뒤에서** 준비(기본 off).
3. **계측기(프로파일)별로 순차 전환** — 프로파일 단위로 on, 백엔드 계산 검증 후 다음 프로파일.
4. 전 프로파일 전환 완료 후 전환기 호환 코드 정리.

---

## 6. ⚠️ 특이 케이스 — 지중경사계(깊이 × 면 × raw)
`지중경사계 = A면·B면 × 심도`는 **깊이 프로파일 × 축(면) × 원시**의 3중 중첩입니다.
- 펄스 깊이 프로파일은 이미 까다로운 영역(축 누락 경고 `axis-maybe-missing` 존재).
- **카탈로그에 명시 스펙 필수**: 면별 센서 분할(A/B) × 깊이별 raw 키 구조를 못박아야 함. 뭉뚱그리면 매핑이 깨짐.
- 합의에서 **이 케이스만 별도 항목**으로 다루기를 요청.

---

## 7. 펄스가 계약 전 안전하게 선행할 작업 (와이어 불변)
- `sensorModel`: 센서의 각 열에 **raw 키 부착**(카탈로그 소비 지점 준비). 와이어 영향 없음.
- ingest 빌더(`backendApi.ingestBody`)/`folderService`: **`raw_channels` 선택 방출 경로**(value 단일 ↔ raw_channels 병행, 플래그 뒤). 백엔드 준비 전 비활성.

> 견적 관점: 본 변경은 펄스 잔여작업에 **신규 항목 1건(개략 M, 3~5일)** + 지중경사계 케이스 보정 버퍼. 카탈로그·계약 확정 지연 시 일정 연동.

---

## 8. 백엔드에 확인 요청(요약 체크리스트)
- [ ] `raw_channels` 모양 `{key, raw}` + `raw:null` 결측 의미 합의
- [ ] `value` 선택(미전송 시 백엔드 계산) 확정
- [ ] 등록 `instrument_profile` 키 이름·값 도메인 = 카탈로그와 일치
- [ ] 공유 카탈로그가 **열 인덱스 매핑**을 제공(헤더명 override 보조)
- [ ] 형제(X/Y) 분할 규칙·suffix를 카탈로그가 명시 → 펄스 (A) 방식과 정합
- [ ] 지중경사계(깊이×면×raw) 별도 스펙
- [ ] `value`/`raw_channels` 동시 수용 → 동시 배포 일정

*펄스 측 정합 근거: `src/lib/sensorModel.js`(columns 매핑), `src/lib/store.jsx`(syncNode 깊이 프로파일 전송), `src/lib/backendApi.js`(ingest/register 본문). 계약 미결·불일치는 백엔드 `07_연동계약`에 ⛓로 반영 요청.*

---

## 9. 펄스 재확정 (2026-06-26, 백엔드 회신 「§5·§8 답변·계약 확정」에 대한 응답)

백엔드가 §5 전부 수용 + §8 체크리스트 답변 + `instrument_profile` 수용 구현 완료. 펄스 §8 항목 ✅ 처리, §3 협의 3건에 답한다.

### 9.1 펄스 Phase 1 구현 현황 (이미 완료·배포가능, 와이어 안전)
- `value`/`raw_channels` **한 빌드 동시 방출**(단일값=value, raw 프로파일=raw_channels). 카탈로그 프로파일별 `rawChannels` 플래그로 순차 on.
- 활성: strut·vibration·seismic·pore_pressure. 깊이형·단일값 무변경. 전체 61 테스트 그린.
- 백엔드 §4 기구현(ingest 둘 다 수용·instrument_profile 수용·파생 엔진·GET /api/profiles/catalog)에 의존 가능 확인.

### 9.2 ⚠️ §2 프로파일 키 도메인 정정 수용 — 펄스 카탈로그 정합 필요(추적)
백엔드 `instrument_profile` 값 = **공유 카탈로그 `key` 17종**(`GET /api/profiles/catalog`). 펄스 로컬 미러(`src/lib/instrumentCatalog.js`)는 현재 펄스 `sensor_type` 코드를 키로 사용 → **불일치 항목 정합 필요**:
- **EA하중계 = `anchor`** (펄스 SENSOR_TYPES/카탈로그에 없음) ↔ **ST하중계 = `strut`**(있음). 펄스 `strut` 라벨 '하중계(축력계)' 는 ST 한정으로 명확화 + `anchor` 추가 필요.
- 건물경사 = `tilt`, 지중경사 = `inclinometer` (펄스 보유).
- **조치**: 펄스가 `GET /api/profiles/catalog` 17키를 받아 로컬 미러를 키·라벨·rawKeys 정합(별도 작업). **현장 EA하중계를 `strut`으로 오등록 시 파생 오류 위험** → anchor 추가 전까지 EA하중계 raw 전환 보류(raw 보존되므로 백엔드 재계산 가능). 펄스는 미전송 시 `sensor_type` 폴백 경로 사용 중(sensor_type=카탈로그 key 인 한 동작).

### 9.3 §3 협의 — 펄스 확정 답
- **3-1 형제(X/Y) 분할 ✅ 동의**: 백엔드 제안 `tilt.outputs[{axis_key,suffix,raw[],derived[]}]` 수용. 펄스는 `sensor_code = {node}-…-X`/`-Y`, **각 형제가 자기 raw 부분집합만 전송**((A) 방식 그대로). suffix `-X`/`-Y` 확정. → **Phase 2 구현**(별도 spec, 펄스 resolveSensors 에 형제 분할 분기 추가).
- **3-2 지중경사 → (가) 한 센서 + 깊이행 ✅ 동의**: 펄스 기존 깊이 프로파일(`syncNode` 가 깊이별 행 전송, `depthLabel`)과 **정확히 정합**. 펄스는 깊이행 measurement 의 `value` 를 `raw_channels:[{A_face},{B_face}]` 로 교체만 하면 됨(심도 누적=서버). (나) 면별 형제 분할은 불채택(더 복잡). `axis-maybe-missing` 경고는 유지(A·B 2축인데 1세트 감지 시).
- **3-3 열인덱스 ✅ 동의**: 카탈로그 `channels[]` 에 선택적 `col`(표준 열 인덱스)+`header`(헤더명 override). 펄스가 원하는 형식 = **프로파일별 `{ rawKey → col(0-based 데이터열, 0=시각 제외 시 1부터), header? }` 표**. 현장 예외는 펄스측 매핑 우선(카탈로그=표준 권고값).

### 9.4 동시 배포 — 동의
백엔드 1단계 배포가능 상태 확인. 펄스는 §3 확정 후 Phase 2 와이어 작성 → 프로파일별 순차 on. **§3 확정 전 추가 와이어 변경 없음.**

> 펄스 다음 액션: ① `GET /api/profiles/catalog` 17키 수신 → 로컬 미러 정합(anchor 등) ② §3 확정되면 Phase 2 spec(형제 분할·지중경사 raw·열인덱스 매핑) 작성·구현.
