# 0009. Pulse 는 원본(raw) 전달만 — 공식/보정 개념 제거 (0008 일부 대체)

- 상태: 채택됨 (ADR-0008 의 공식/보정 부분을 대체. 계측기 종류 마스터는 유지)
- 날짜: 2026-05-27
- 결정자: 사용자 / Claude Code
- 관련: `NodeDetail.jsx`, `Dashboard.jsx`, `SensorTypes.jsx`, `SensorTypeDetail.jsx`, `sensorTypes.js`, `permissions.js`; 삭제: `FormulaTab.jsx`·`formulaEngine.js`·`calibration.js`·`CalibrationModal.jsx`

## 맥락

Pulse 의 역할을 재확정: **메모장(.txt) 원본 데이터를 가공 없이 그대로(쌩) 백엔드로 전달**하는 파이프다. 값 변환(공식)·보정은 Pulse 책임이 아니라 웹/백엔드(SSOT)가 적용한다. 따라서 노드 상세의 적용값/원본값 토글·보정 버튼이 불필요하고, 더 나아가 **공식/보정 개념 자체를 Pulse 에서 제거**(사용자 선택 = B).

## 결정

- **노드 상세**: 원본값(raw)만 표시. 원본/적용 토글·"보정" 버튼 제거, `flaggedAll = computeFlags(series)`(원본).
- **공식/보정 개념 제거 — 파일 삭제**: `FormulaTab.jsx`, `lib/formulaEngine.js`, `lib/calibration.js`, `components/node-detail/CalibrationModal.jsx`. (`mathjs` 는 미사용으로 남음 — 추후 `npm uninstall` 가능)
- **계측기 종류 = 마스터만**: `SensorType` 에서 `formula` 필드·`Formula`·`SensorCalibration` 타입 제거. 종류 상세는 **[기본 정보][사용 센서]** 탭만(공식 설정 탭 제거). 카드의 "공식 적용/미적용" 표시 제거.
- **permissions**: `FORMULA_EDITING_ENABLED` → `SENSOR_TYPE_EDITING_ENABLED` (계측기 종류 마스터 편집의 read-only 게이트로 유지). `ReadOnlyBanner` 유지.
- **대시보드**: "모니터링 중" 기본 뷰를 **컴팩트**로 변경(`useState('cards')` → `'compact'`).

## 결과

- Pulse 가 "가공기"가 아니라 **원본 파이프**임이 코드로 명확. 데이터 흐름: 타사 → .txt → Pulse(원본 전달) → 백엔드(공식·보정 적용) → 웹.
- ADR-0008 의 **종류 레벨 공식 + 센서 offset/scale 부분은 폐기**. 다만 **계측기 종류 마스터 페이지·readOnly 패턴은 유지**(이름/단위/카테고리/위험방향 메타는 백엔드로 넘길 설정으로 여전히 유효).
- 잔여: `mathjs` 미사용 의존성(정리 권장). "사용 센서" 탭은 여전히 placeholder(sites 미연동).
- 검증: 전체 E2E **19/19**(sensor-types 는 공식 테스트 제거 후 5개, "공식 탭 없음" 단언 포함), 콘솔 에러 0, 캡처(노드상세 원본만 / 종류상세 공식탭 없음 / 대시보드 컴팩트 기본).

## 대안

- **A. 공식을 "백엔드로 넘길 설정"으로 Pulse 에 보관** — 계측기 종류 공식 유지. 사용자가 **B(완전 제거)** 선택.
