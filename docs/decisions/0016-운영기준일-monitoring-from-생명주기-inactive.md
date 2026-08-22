# 0016. 운영 시작 기준일(monitoring_from) 추가 + 센서 생명주기 inactive 통합

- 상태: 채택됨
- 날짜: 2026-06-05
- 결정자: (센서 백엔드 스펙 / 사용자 / Claude Code)
- 관련: [ADR-0015](0015-정상범위-재도입-3축-입력전송만.md)(정상범위 축), [ADR-0010](0010-현장-블라인드-노드-수신-중심-v2.md), `src/lib/backendApi.js`, `src/lib/store.jsx`, `src/components/nodes/NodeDetailDrawer.jsx`, `src/components/nodes/RegisterWizard.jsx`, CHANGELOG `[Unreleased]`

## 맥락

센서 백엔드가 운영/품질 체계를 3가지로 정리해 전달: ① 정상범위(valid_min/max, [ADR-0015](0015-정상범위-재도입-3축-입력전송만.md)에서 처리) ② **운영 시작 기준일(monitoring_from) — 신규** ③ **센서 고장 상태값 변경(dead → inactive)**. 본 ADR 은 ②·③을 다룬다.

- **②** 설치/테스트/장애로 0 떡칠된 초기 구간이 분석·고장의심·기본차트를 더럽힌다. "이 날짜부터 진짜 운영 데이터"라는 노드 단위 플래그가 필요. 이전 데이터는 raw 보존하되 분석에서만 제외.
- **③** 기존 펄스는 off 상태를 `dead`(+레거시 `disabled`)로 보냈는데, 백엔드가 상태값을 **`inactive` 하나로 통합**(active/inactive 둘만, dead/disabled 폐기).

## 결정

### ② 운영 시작 기준일 (monitoring_from)
- 노드 단위 ISO 문자열(KST 권장, 예 `2026-05-19T00:00:00+09:00`). 미전송=기존값 유지, **null=해제**. 새 날짜로 다시 보내면 "여기서부터 다시 깨끗하게" 리셋.
- 전송 = 별도 API 아님, 노드 등록(`POST /api/pulse/v1/nodes`) body 의 최상위 필드. 등록 호출에 동봉하거나, 노드 단위 최소 본문(`nodeMonitoringBody`: `{node_code, sensor_type, monitoring_from}` — 채널/sync 없음)으로 단독 갱신.
- **UI 입력 2곳**(사용자 결정): 등록 위저드 "확인" 단계 날짜 입력(`date`) + 노드 상세 드로어 헤더 날짜 입력(즉시 저장). 드로어는 `updateMonitoringFrom`→IPC `nodes:set-monitoring-from`, 위저드는 등록 payload 에 `monitoringFrom` 동봉(`nodeRegisterBody`).
- `date` 입력값(YYYY-MM-DD) → `${date}T00:00:00+09:00` 로 변환 전송. GET 응답 `monitoring_from` 은 `normalizeBackendNode`→`buildNode` 로 복원, 드로어 입력은 앞 10자(YYYY-MM-DD)로 표시.

### ③ 센서 생명주기 — inactive 통합
- 펄스가 보내는 off 값을 **`inactive`** 로 변경(`active` ↔ `inactive` 2단). 레거시 `dead`/`disabled` 는 더 이상 전송하지 않으나, GET 으로 오면 `lifecycleLabel` 이 '비활성'으로 흡수.
- 동작은 동일: inactive 센서는 백엔드 노드 평균·offline 감지에서 제외(sticky, 복구 시 active). 펄스 ingest 도 inactive 센서 전송 skip(기존 유지).
- 참고(펄스 무관): 백엔드가 무신호(0/null/NaN 2연속)를 자동 "고장 의심" 판정 + 운영자 알림. 펄스는 자체 판정 안 함 — 알림 받고 현장 확인 후 inactive 로 확정만.

## 결과

- 좋은 점: 시운전 구간 자동 제외(monitoring_from)로 분석 품질↑. 생명주기 상태값이 active/inactive 로 단순·일관.
- 검증: 렌더러 빌드 0 에러, E2E 33/33(monitoring_from 본문 2 + 드로어 저장 1 + inactive 전송값 갱신).
- 트레이드오프: 운영 시작일을 운영자가 직접 입력해야 함(자동 추정 안 함) — 의도(명시적·리셋 가능).

## 대안

- **운영 시작일을 펄스가 자동 추정**(첫 비영(非零) 데이터 등): 오판 위험·현장 사정 반영 불가 — 기각(수동 입력).
- **dead/disabled 유지**: 백엔드가 inactive 로 통합·dead/disabled 미수신 — 불가.
