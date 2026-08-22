# 작업 보고서 - 계측기 종류 / 공식·보정·상수 설정 UI

**날짜**: 2026-05-26
**Phase**: Phase 1 (UI 완성)
**작업자**: Claude Code
**소요 시간**: 약 1세션

## 작업 목표

계측기 종류 마스터 관리 + 종류별 공식 + 센서별 보정을 추가하되, 향후 백엔드 SSOT 전환 시 한 곳에서 read-only 로 바꿀 수 있는 구조로 설계.

## 변경 사항

### 추가된 파일
- `src/lib/sensorTypes.js` - 계측기 종류 모델 + 22종 시드 + 카테고리 + 로컬 스토어
- `src/lib/formulaEngine.js` - 안전한 공식 계산(mathjs evaluate, validateFormula)
- `src/lib/permissions.js` - `FORMULA_EDITING_ENABLED` 전역 토글 + `WEB_ADMIN_URL`
- `src/pages/SensorTypes.jsx` - 계측기 종류 페이지(카테고리 탭 + 카드 그리드 + 카드 컴포넌트)
- `src/components/sensor-types/SensorTypeDetail.jsx` - 우측 슬라이드 상세 패널(기본정보/공식/사용센서)
- `src/components/sensor-types/FormulaTab.jsx` - 공식 편집(표현식+상수+미리보기, 저장 시 version++)
- `src/components/ui/ReadOnlyBanner.jsx` - read-only 안내 배너(웹으로 이동)
- `tests/sensor-types.spec.js` - E2E 7개
- `docs/decisions/0008-계측기-종류-마스터-종류공식-센서보정.md` - 본 작업 결정(0006/0007 대체)

### 수정된 파일
- `src/lib/calibration.js` - **재작성**: 채널 템플릿 → 센서 offset/scale + 종류 공식 합성, 보정 스토어
- `src/components/node-detail/CalibrationModal.jsx` - **재작성**: offset/scale(종류 공식 읽기전용 상속), readOnly 지원
- `src/pages/NodeDetail.jsx` - 새 파이프라인(종류 공식 + 채널 보정), readOnly 전달
- `src/App.jsx` - `sensors` 페이지 라우팅 추가
- `src/styles/globals.css` - `pulse-slide-left` 키프레임(패널 진입)
- `docs/decisions/README.md`, `0006`, `0007` - 0008 대체 상태 반영
- `CHANGELOG.md` - Unreleased 항목

### 설치된 패키지
- `mathjs@^15.2.0` (dependencies)

## 구현된 기능

- 계측기 종류 페이지: 22종 카드, 카테고리(5) 필터, 시스템/사용자 구분, 공식 적용 여부
- 상세 슬라이드 패널: 기본 정보(시스템 코드/이름 보호) · 공식 설정 · 사용 센서(placeholder)
- 종류 공식: 표현식 + 상수(동적 추가/삭제) + 라이브 미리보기 + 식 검증 + 버전 관리
- 센서 보정: 채널별 offset/scale, 모든 채널 일괄, 현재값으로 영점, 라이브 최종값
- 데이터 흐름: raw → 종류 공식(formulaEngine) → 센서 보정 → 차트/테이블/이상치 반영(원본 .txt 불변)
- read-only 전환: `permissions.FORMULA_EDITING_ENABLED` 한 곳 → 전체 편집 UI disabled + 배너 + 저장/추가 숨김, 미리보기는 동작

## 자체 검증 결과

### 체크리스트
- [x] 사이드바 "계측기 종류" 클릭 시 페이지 진입
- [x] 22종 시드 카드 표시 / 카테고리 필터 동작
- [x] 카드 클릭 → 상세 패널 / 공식 탭
- [x] 공식 입력 후 미리보기 실제 계산 (raw=8500 → 0.5 m)
- [x] 잘못된 표현식 시 오류 표시
- [x] 상수 동적 추가/삭제
- [x] `FORMULA_EDITING_ENABLED=false` → 전체 read-only(배너·disabled·버튼 숨김, 미리보기 동작) 캡처 확인
- [x] 노드 상세 센서 보정(offset/scale) 동작, 종류 공식 상속 표시
- [x] 다크모드 신규 UI 자연스러움(컴포넌트 dark: 클래스)
- [ ] localStorage 새로고침 유지 — 기제(save/load) 구현·단위확인. Playwright 는 매 실행 새 컨텍스트라 별도

### Playwright 테스트
- 신규: `tests/sensor-types.spec.js` (7)
- 통과: **21/21** (대시보드 6 + 노드상세 8 + 계측기종류 7) — 기존 스펙 회귀 없음
- 셀렉터 수정 1건(앱 버그 아님): 카테고리 탭이 카드 칩 텍스트와 중복 → `exact:true`
- 공식 엔진/합성 단위: 15/15

### 콘솔 에러
- 없음 (E2E "콘솔 에러 없음" 통과 + 스크린샷 구동 시 pageerror 0)

### 빌드 결과
- `npm start`(electron-forge) 정상, HMR 정상, mathjs 번들 OK

## 디자인 일관성
- [x] 기존 톤 유지 / lucide 아이콘만 / 다크모드 / zinc 팔레트 / 6~8px

## 알려진 이슈
- **사용 센서 탭 placeholder** — 등록 노드(sites)가 대시보드 로컬 상태라 미연동. 공유 상태로 올린 뒤 type.code 필터링 예정.
- **localStorage 사용**(`pulse:sensorTypes`, `pulse:sensorCalibrations`) — 프로젝트 규칙(다크모드 외 금지)을 이 건에 한해 명시 허용(스펙 지시). Phase 2 SQLite 마이그레이션.
- 보정값 영속은 노드 id 기준 best-effort(노드 등록이 메모리라 세션 한정).
- 종류 레벨 공식은 같은 종류 내 공식 "모양" 차이는 못 담음(사용자 확정상 숫자만 다르므로 무방).

## 다음 작업으로 넘기는 사항
- 사용 센서 탭 연동(sites 공유 상태화)
- 보정/공식 영속 SQLite(Phase 2), 백엔드 동기화 시 readOnly=true 전환(Phase 4)
- 테이블 뷰 수신 상태 반영(이전 작업 후속)

## 스크린샷 / 비고
- 검증 캡처: 종류 카드 그리드 / 공식 편집(미리보기 0.5 m) / 저장 후 "공식 적용됨" / read-only 모드 / 노드 센서 보정.
