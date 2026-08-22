# 펄스 raw_channels Phase 2 — 형제 분할(siblings) 설계

- 작성일: 2026-06-26
- 상태: 설계 확정(구현 전). 범위 = **siblings 4종 + 열인덱스(col) 매핑**. inclinometer(depth×raw)는 실제 로거 샘플 확보 후 **Phase 3**(범위 밖).
- 선행: Phase 1 `docs/superpowers/specs/2026-06-25-pulse-raw-channels-design.md`(완료, 63/63). 백엔드 카탈로그 `GET /api/profiles/catalog` 17키.

---

## 0. 목적

`point:'siblings'` 계측기(한 장비 → 형제 센서 여러 개)를 카탈로그 `outputs[]`대로 **N개 센서로 분할**해 각 형제가 자기 raw 부분집합을 전송한다((A) 방식). Phase 1의 `point:'single'` 다채널과 동일한 `role:'multiraw'` 전송을 재사용하므로, 핵심 변경은 **미러 구조 통일 + `resolveSensors` 분할 분기**다.

### 대상 siblings (카탈로그 기준)
| key | ko | ch(등록 약어) | channels(key:col) | outputs(suffix → raw) |
|---|---|---|---|---|
| `tilt` | 건물경사계 | BT | A0:0,A180:1,B0:2,B180:3 | X→[A0,A180], Y→[B0,B180] |
| `survey_3d` | 광파타겟(3D) | TG (신규) | N:0,E:1,Z:2 | N→[N], E→[E], Z→[Z] |
| `wind` | 풍향풍속계 | WS | WD:0,WS:1 | WD→[WD], WS→[WS] |
| `thermo_hygro` | 온습도계 | TH | T:0,H:1 | T→[T], H→[H] |

> `point:'siblings' ⟺ outputs 있음`(백엔드 불변식). 단일채널 출력(survey_3d·wind·thermo_hygro)도 형제별 `raw_channels`(1키)로 **균일 전송**(value 경로 안 씀).

---

## 1. 아키텍처

### 1.1 미러 구조 통일 — `src/lib/instrumentCatalog.js`
Phase 1의 평면 `rawKeys`+`rawChannels`를 **카탈로그 충실 형태**로 통일. **약어(접두)는 미러에 두지 않고 `sensorChannelCode`(SENSOR_TYPES) 단일 소스 사용**(중복 제거, Phase 1과 동일):
```js
// 항목 형태: { point, channels:[{key,col}], outputs?:[{suffix, raw:[key]}] }
export const INSTRUMENT_PROFILES = {
  anchor: { point:'single', channels:[{key:'A',col:0},{key:'B',col:1},{key:'C',col:2}] },
  strut:  { point:'single', channels:[{key:'A',col:0},{key:'B',col:1},{key:'C',col:2}] },
  vibration: { point:'single', channels:[{key:'X',col:0},{key:'Y',col:1},{key:'Z',col:2}] },
  seismic:   { point:'single', channels:[{key:'X',col:0},{key:'Y',col:1},{key:'Z',col:2}] },
  pore_pressure: { point:'single', channels:[{key:'R',col:0}] },
  tilt:  { point:'siblings', channels:[{key:'A0',col:0},{key:'A180',col:1},{key:'B0',col:2},{key:'B180',col:3}],
           outputs:[{suffix:'X', raw:['A0','A180']}, {suffix:'Y', raw:['B0','B180']}] },
  survey_3d: { point:'siblings', channels:[{key:'N',col:0},{key:'E',col:1},{key:'Z',col:2}],
               outputs:[{suffix:'N',raw:['N']},{suffix:'E',raw:['E']},{suffix:'Z',raw:['Z']}] },
  wind: { point:'siblings', channels:[{key:'WD',col:0},{key:'WS',col:1}],
          outputs:[{suffix:'WD',raw:['WD']},{suffix:'WS',raw:['WS']}] },
  thermo_hygro: { point:'siblings', channels:[{key:'T',col:0},{key:'H',col:1}],
                  outputs:[{suffix:'T',raw:['T']},{suffix:'H',raw:['H']}] },
};
```
- ⚠️ 미러는 **펄스가 능동 변환하는 프로파일만**(raw single + siblings). 미러에 없는 키(water_level·crack·groundwater·rainfall·strain·settlement·optical)는 기존 **value 경로**. inclinometer(depth)는 Phase 3.
- 약어(접두)는 `sensorChannelCode(sensorType)`(=SENSOR_TYPES.ch)에서. `col`은 0-based **데이터열**(타임스탬프 제외) → 파일 열 인덱스 = `col + 1`.

**헬퍼(Phase 1 호환 유지 + 신규):**
```js
profileOf(key)        // 항목 or null
profilePoint(key)     // 'single' | 'siblings' | null
profileChannels(key)  // [{key,col}] 사본 (없으면 [])
profileOutputs(key)   // [{suffix,raw}] 사본 (없으면 null)
profileRawKeys(key)   // single: channels 의 key 배열 사본 (Phase 1 단일 경로용). 그 외 []
isRawEnabled(key)     // !!profileOf(key)  (미러에 있으면 raw 대상)
```
> Phase 1 테스트 불변: `profileRawKeys('strut')`→`['A','B','C']`, `isRawEnabled('strut')`→true (채널에서 파생). optical_target 부재 유지.

### 1.2 `resolveSensors` — siblings 분기 추가 (`src/lib/sensorModel.js`)
비-깊이 분기에서 **point 기준 3갈래**:
```
const point = profilePoint(sensorType);
if (point === 'siblings') {
  // outputs[] 마다 센서 1개
  const prefix = sensorChannelCode(sensorType);  // SENSOR_TYPES.ch (tilt→BT, survey_3d→TG…)
  const chMap = Object.fromEntries(profileChannels(sensorType).map(c => [c.key, c.col]));
  sensors = profileOutputs(sensorType).map((o, idx) => {
    const cols = o.raw.map(k => chMap[k] + 1);     // 데이터열(col) → 파일 열(+1, 0=시각)
    return { code: `${prefix}-${o.suffix}`, role:'multiraw', ch: cols[0], seq: idx+1,
             sensorType, columns: cols, rawKeys: [...o.raw], tempColumn: null };
  });
  pattern = 'siblings';
  // 파일 열 부족 검증: 필요한 최대 열이 cols 범위를 넘으면 경고 + 폴백
} else if (point === 'single' && isRawEnabled && baseCols.length === rawKeys.length) {
  // Phase 1 multiraw (그대로) — 단, single 조건 명시
} else {
  // 기존 per-column 동작 (+ raw 프로파일 불일치 경고)
}
```
- **열 매핑**: 형제 raw 키 → `channels[].col` → 파일 열(`col+1`). 카탈로그 col이 표준. 파일 열 수가 부족하면 integrity `siblings-col-out-of-range` 경고 + 기존 per-column 폴백.
- tilt 예: 파일 `[DateTime,A0,A180,B0,B180]` → **BT-X**(columns[1,2], rawKeys[A0,A180]) · **BT-Y**(columns[3,4], rawKeys[B0,B180]).

### 1.3 `syncNode` — 변경 없음
형제도 `role:'multiraw'` 센서 → Phase 1 방출 분기 그대로(`raw_channels:[{key,raw}]`, value 없음, null 보존). **수정 0.**

### 1.4 등록 enum + 코드 규칙 (`src/lib/backendApi.js`)
- `SENSOR_TYPES`에 **`survey_3d` 추가**: `{ code:'survey_3d', label:'광파타겟(3D)', ch:'TG' }`. tilt(BT)·wind(WS)·thermo_hygro(TH)는 기존.
- 형제 센서 코드 = **`{ch}-{suffix}`**: tilt→`BT-X`/`BT-Y`, survey_3d→`TG-N`/`TG-E`/`TG-Z`, wind→`WS-WD`/`WS-WS`, thermo_hygro→`TH-T`/`TH-H`. (sensor_code=`{node}-{code}`, register·ingest 동일 코드).
- 등록 시 `channels[]`에 형제 코드 N개 전송 → 백엔드가 형제 센서 N개 생성(instrument_profile=프로파일 key, 형제 derived 계산).

---

## 2. 데이터 흐름 (tilt 예)
```
로거 [DateTime,A0,A180,B0,B180]
 → resolveSensors(point=siblings) → 센서 2개: BT-X(cols 1,2 / raw A0,A180), BT-Y(cols 3,4 / raw B0,B180)
 → 등록: channels[{code:BT-X},{code:BT-Y}] → 백엔드 형제 센서 2개
 → syncNode(각 형제 multiraw) → ingest 2콜:
     {node}-BT-X: raw_channels[{A0},{A180}]
     {node}-BT-Y: raw_channels[{B0},{B180}]
 → 백엔드: 형제 derived(X_deg/X_mm, Y_deg/Y_mm) 계산
```

---

## 3. 테스트 (TDD — `tests/raw-channels.spec.js` 확장)
1. **카탈로그**: `profilePoint('tilt')`='siblings', `profileOutputs('tilt')` 2개, `profileChannels('tilt')` col 매핑. Phase 1 헬퍼 회귀(`profileRawKeys('strut')`=['A','B','C']).
2. **resolveSensors**:
   - tilt 4열 → 센서 2개: `BT-X`(columns[1,2],rawKeys[A0,A180]) · `BT-Y`(columns[3,4],rawKeys[B0,B180]).
   - survey_3d 3열 → 센서 3개(TG-N/E/Z, 각 1 raw).
   - wind 2열 → WS-WD/WS-WS.
   - 단일값·Phase1 single(strut)·온도열 회귀 무변경.
   - tilt 인데 열 부족(3열) → `siblings-col-out-of-range` 경고 + 폴백.
3. **syncNode**(UI ingest): tilt 노드 → ingest 2콜, channelCode BT-X/BT-Y, 각 raw_channels 정확(null 보존).

검증: `npm test` 그린 + Phase 1/기존 63 회귀 0 + 빌드 0에러.

---

## 4. 범위 밖(명시)
- **inclinometer(depth×face×raw)** → Phase 3. 실제 로거 샘플 파일로 열 레이아웃(깊이-열 vs 행) 확정 후.
- 헤더명(`header`) override → col로 충분, 필요 시 추후.
- 한 파일 다중 계측기(같은 형제 장비 여러 대) → 범위 밖.
- 미러에 없는 단일채널 단순계측기 → value 경로 유지(무변경).
