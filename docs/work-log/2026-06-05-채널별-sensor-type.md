# 작업 보고서 - 채널별 sensor_type (한 노드에 계측 종류 혼재)

**날짜**: 2026-06-05
**Phase**: Phase 4 (백엔드 API) — 센서 운영/품질 체계
**작업자**: Claude Code
**소요 시간**: 약 70분

## 작업 목표

백엔드 계약 변경 반영: "노드 1개 = sensor_type 1개" → **채널마다 sensor_type 전송**(노드 레벨은 대표/폴백). 한 노드에 종류가 다른 센서(예: 수위 + 균열)가 섞일 수 있게.

## 변경 사항

### backendApi.js
- `guessSensorTypeFromCode(code)` 신규 — `classifyChannel` → `SENSOR_TYPES.ch` 역매핑(WL→water_level, CR→crack, GI→inclinometer, TX/TY→tilt). 미매칭 ''.
- `SENSOR_TYPE_UNIT`/`sensorTypeUnit(code)` 신규 — 종류 기본 단위(확실한 것만).
- `nodeRegisterBody` — `channels[]`에 `sensor_type`/`unit`/`valid_min`/`valid_max` 동봉(있을 때만). 노드 레벨 `sensor_type` 유지(폴백).
- `nodeRangeBody` — 채널에 `sensor_type`/`unit`도 실음(범위/종류 갱신 시 분류 유지).
- `normalizeBackendNode` — `channels[].sensor_type`/`unit` 읽어 채널 모델에 보관.

### store.jsx
- `buildNode` 채널 모델에 `sensorType` 추가.
- `saveChannelRanges` — 채널 `sensorType`/`unit` 동봉.
- `setChannelSensorType(nodeId, code, type)` 신규 — 로컬 즉시 + POST /nodes(additive)로 전체 채널 종류/단위(+설정 범위) 재전송. 단위는 종류 기본값 자동. context 노출.

### RegisterWizard.jsx
- `chTypes` state + `chTypeFor`(수동>자동추론>노드 대표) + `setChType`.
- "채널 매핑" 단계: 읽기전용 칩 → **채널별 종류 Select + 단위 표시** 행으로 교체. 노드 종류 라벨 "노드 대표 계측기 종류 — 채널 미지정 시 폴백".
- 등록 시 channels에 `sensorType`/`unit` 동봉(로컬 노드 + 백엔드 payload).

### NodeDetailDrawer.jsx
- "센서 상태" → "센서" 섹션: 채널 행에 **종류 Select(+단위) + 생명주기 Select**. `ChannelTypeSelect`(CH_TYPE_OPTS) 추가, 변경 시 `onSetChannelType`→`setChannelSensorType`.

### 테스트 (`tests/pulse-v2.spec.js`)
- 추가: `guessSensorTypeFromCode`, `sensorTypeUnit`, `nodeRegisterBody`/`nodeRangeBody` 채널 sensor_type, 드로어 채널 종류 변경→`setSensorRanges` sensor_type 동봉.
- 수정: 생명주기 테스트의 섹션 헤더 anchor("센서 상태"→"GI-A").

### 문서
- ADR-0017 신규, README 인덱스·CHANGELOG·메모리 갱신.

## 자체 검증 결과

### 체크리스트
- [x] 채널마다 sensor_type/unit 전송, 노드 레벨은 대표/폴백 유지
- [x] 코드 접두 자동추론(WL/CR/GI…), 미지 채널은 노드 대표 폴백
- [x] 드로어/위저드 양쪽 입력, 드로어 변경 시 즉시 저장(additive)
- [x] GET 응답 채널별 sensor_type 복원
- [x] 기존 등록 회귀 가드(80053) 통과 — 채널 코드 매핑 불변

### 빌드 / 테스트
- 렌더러 빌드 0 에러 (1799 modules)
- Playwright **38/38 통과**, `npm start` 정상

## 알려진 이슈
- 노드 목록 테이블 "종류" 컬럼은 여전히 노드 대표 종류 표시(채널 혼재 표식은 미도입 — 추후).
- (무해) postcss MODULE_TYPELESS 경고 1줄.

## 다음 작업으로 넘기는 사항
- 배포 설치본(`Setup.exe`)은 이 변경 반영 위해 **재빌드 필요**(rcedit 교체 상태에서 `npm run make`).
- 종류 혼재 노드의 목록/평균 표시(혼재 배지, excluded_sensors) 추후 검토.
