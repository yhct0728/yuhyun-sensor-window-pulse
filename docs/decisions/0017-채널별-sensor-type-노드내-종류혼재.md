# 0017. 채널별 sensor_type — 한 노드에 계측 종류 혼재 허용

- 상태: 채택됨
- 날짜: 2026-06-05
- 결정자: (센서 백엔드 스펙 / 사용자 / Claude Code)
- 관련: [ADR-0016](0016-운영기준일-monitoring-from-생명주기-inactive.md), [ADR-0015](0015-정상범위-재도입-3축-입력전송만.md), `src/lib/backendApi.js`, `src/lib/store.jsx`, `src/components/nodes/RegisterWizard.jsx`, `src/components/nodes/NodeDetailDrawer.jsx`, CHANGELOG `[Unreleased]`

## 맥락

지금까지 펄스는 "노드 1개 = sensor_type 1개"로 보내, 그 노드의 모든 채널이 한 종류로 묶였다. 백엔드는 노드 평균을 **"같은 종류·같은 단위끼리만"** 낸다. 그런데 한 노드(데이터로거)에 종류가 다른 센서가 섞일 수 있어야 한다(예: 수위 + 균열). 노드 종류 하나로 다 묶으면 실제로 다른 종류가 한 종류로 잘못 분류된다.

## 결정

**채널마다 `sensor_type`(+`unit`)을 보낸다. 노드 레벨 `sensor_type` 은 대표/기본값(채널 미전송 시 폴백)으로 유지한다.**

- **전송 계약**: `POST /api/pulse/v1/nodes` 의 `channels[]` 에 채널별 `sensor_type`/`unit`/`valid_min`/`valid_max`. 미전송 필드는 유지, `sensor_type` 미전송 시 노드 `sensor_type` 폴백. (`nodeRegisterBody`, 범위/종류 갱신은 `nodeRangeBody` 가 같은 채널 필드를 실음)
- **자동 추론**: 채널 코드 접두로 종류 자동 채움 — `guessSensorTypeFromCode`(`classifyChannel` → `SENSOR_TYPES.ch` 역매핑: WL→water_level, CR→crack, GI→inclinometer, TX/TY→tilt…). 추론 안 되면 노드 대표 종류로 폴백. 단위는 종류 기본값(`sensorTypeUnit`, 확실한 것만).
- **입력 2곳**(사용자 결정):
  - **등록 위저드 "채널 매핑"**: 채널마다 종류 Select + 단위 표시(자동 채움, 수동 override). 노드 레벨 종류는 "대표/폴백"으로 라벨 변경.
  - **노드 상세 드로어 "센서"**: 채널 행마다 종류 Select(+단위) + 생명주기 Select. 변경 시 즉시 `setChannelSensorType` → POST /nodes(additive)로 전체 채널 종류 재전송(일관 유지).
- **GET 복원**: `normalizeBackendNode` 가 `channels[].sensor_type`/`unit` 을 읽어 채널 모델(`buildNode` 의 `chans[].sensorType`)에 보관.

## 결과

- 좋은 점: 한 노드에 종류 혼재 가능 → 백엔드가 종류·단위별로 정확히 평균. 코드 접두 자동 추론으로 입력 부담 최소.
- 검증: 렌더러 빌드 0 에러, E2E 38/38(guess/unit/nodeRegisterBody·nodeRangeBody 채널 sensor_type + 드로어 종류 변경).
- 트레이드오프: 노드 레벨 단일 종류 가정이 깨짐 — 기존 화면(테이블 "종류" 등)은 여전히 노드 대표 종류를 표시(채널별 종류는 드로어/위저드에서). 추후 필요 시 목록에 혼재 표식 추가.

## 대안

- **노드 1종류 유지**: 종류 혼재 노드를 표현 못 함 — 불가(백엔드 요구).
- **채널 종류 전부 수동 입력**: 자동 추론 없이 부담↑ — 자동 추론 + override 채택.
