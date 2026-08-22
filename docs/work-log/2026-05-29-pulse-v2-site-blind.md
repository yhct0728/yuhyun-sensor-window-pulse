# 작업 보고서 - Pulse v2 현장-블라인드 전면 교체

**날짜**: 2026-05-29
**Phase**: Phase 1 (v2 재설계)
**작업자**: Claude Code
**소요 시간**: 약 1세션

## 작업 목표

Pulse 를 현장(Site) 기반 모니터에서 **현장-블라인드 노드·수신 중심 수집기**로 전면 교체한다(ADR-0010).

## 변경 사항

### 추가된 파일
- `src/lib/{types,nodeId,classifyChannel,format,store}.js(x)` - 데이터 모델·헬퍼·전역 스토어(Context)
- `src/pages/{NodeMonitor,TransmitQueue,Channels,Placeholder}.jsx` - v2 4개 화면
- `src/components/nodes/{MonitorTab,DetectRegisterTab,NodeTable,NodeCardGrid,NodeCompactList,NodeRow…,DetectedFileRow,NodeDetailDrawer,RegisterWizard}.jsx`
- `src/components/channels/AddTypeModal.jsx`
- `src/components/layout/{Sidebar(재작성),PageHeader}.jsx`
- `src/components/ui/{StatusPill,MetricCard,ViewToggle,EmptyState}.jsx`
- `tests/pulse-v2.spec.js`
- `docs/decisions/0010-현장-블라인드-노드-수신-중심-v2.md`

### 수정된 파일
- `src/App.jsx` - PulseProvider + page 라우팅 + 드로어/위저드 제어, `?test=node` 훅
- `src/lib/reception.js` - 수신/전송 상태 판정·표현으로 재작성(현장 로직 제거)
- `src/lib/folderApi.js` - mockData 의존 제거(제로 디폴트), `analyzeFile` 래퍼, v2 DetectedFile 매핑
- `src/folderService.js` + `src/preload.js` - `files:analyze` IPC 추가
- `src/lib/theme.js` - 안전판정 STATUS_LABEL/RANK 제거
- `index.html` - 타이틀 "유현건설 수집기"

### 삭제된 파일
- 페이지: Dashboard/Settings/NodeDetail/SensorTypes
- 컴포넌트: dashboard/·node-detail/·sensor-types/·sensor-reference/·settings/·layout/Header·ui/{ReadOnlyBanner,Badge}
- lib: mockData·mockNodeData·anomalyDetection·coefficientData·formulaData·sensorData·sensorTypes·permissions

### 설치된 패키지
- 없음 (recharts·mathjs 는 미사용 의존성으로 남음 — 추후 정리 가능)

## 구현된 기능

- 노드 모니터(모니터링/감지·등록 탭), 노드 상세 드로어(채널 스트림/전송 큐/진단 로그), 4단계 등록 위저드
- 전송 큐(인제스트 카드·요약5·큐 테이블), 채널 정의(그룹 카드·사용 집계·타입 추가)
- 진단 로그/설정 플레이스홀더, 전 화면 빈 상태(제로 디폴트)
- 파일명→노드 ID 추론, 채널 코드 분류, 수신/전송 상태 핀, `files:analyze` 실파싱

## 자체 검증 결과

### 체크리스트
- [x] 현장 UI·필드 0 (현장-블라인드 grep: 원칙 주석에만 잔존)
- [x] 안전 판정 코드 0
- [x] 전송 페이로드에 현장 필드 없음(위저드 Step4 미리보기)
- [x] 모든 컬렉션 제로 디폴트 + 빈 상태 구현

### 단위 검증
- 헬퍼 12/12 통과 (inferNodeId·classifyChannel·receptionOf 경계)

### Playwright 테스트
- 신규: `tests/pulse-v2.spec.js`
- 통과: **11/11** (v1 스펙 3개는 제거)

### 콘솔 에러
- 없음 (정적 리소스 404 favicon 은 dev:web 한정, 검사에서 제외)

### 빌드 결과
- `npx vite build` 성공(아이콘/임포트 해소), `npm start` 기동·메인 콘솔 에러 0, 창 타이틀 정상

## 디자인 일관성
- [x] 기존 톤 유지(zinc + 에메랄드 액센트, 1px 보더)
- [x] lucide-react 아이콘만 (이모지 없음)
- [x] 다크모드 동작
- [x] HTML head 디자인 토큰(Pretendard/JetBrains Mono/애니메이션) 반영

## 알려진 이슈
- 노드/채널/전송 상태는 메모리(Phase 1, 재시작 시 휘발)
- 인제스트 미연결(제로 디폴트), 검색(⌘K)·진단 로그/설정 페이지는 플레이스홀더
- 시각 기준 프로토타입 본문 JSX(`pulse2-*.jsx`) 미전달 → 레이아웃은 사양+토큰 기반(추후 JSX 받으면 미세 조정)
- `recharts`·`mathjs` 미사용 의존성

## 다음 작업으로 넘기는 사항
- nodes:register/ingest:*/channels:* 실제 IPC + Phase 2 SQLite 영속
- 폴링 워커(파일 변경 감지·rx-tick), 검색 팔레트, 진단 로그/설정 페이지 구현
- 프로토타입 JSX 수령 시 레이아웃 대조

## 스크린샷 / 비고
- 본문 JSX 누락으로 시각 기준은 HTML head 토큰 + 텍스트 사양(§0~§11)으로 진행(사용자 승인).

---

## 후속 — 계측기 도감 (ADR-0011, 같은 날)

사용자 요청으로 "채널 정의" 페이지를 GeoMonitor **계측기 도감**(읽기 전용 참조)으로 교체.
- 원본 `yuhyun-sensor-front`의 7파일을 Pulse(React+Tailwind+JSX)로 이식: `lib/sensorReference.js`(데이터 1:1, 22센서/22공식/5계수), `components/reference/{SensorListTab,FormulaTab,CoefficientTab,sensorIcons,referenceColors}`, `pages/Reference.jsx`.
- CSS Modules + oklch 상대색 → Tailwind 색군 매핑(referenceColors.js). 데이터·카피·색 의미 1:1 유지.
- 삭제: `pages/Channels.jsx`, `components/channels/*`. 사이드바 `channels`→`reference`(계측기 도감, BookOpen).
- 공식/계수는 설명 문서일 뿐 Pulse 미적용(ADR-0009 유지). `channelCatalog`+store `channelTypes`는 위저드 자동완성용으로만 잔존.
- 검증: E2E 11/11(채널 테스트→도감 3탭으로 교체), `npm start` 5173 클린 기동(중복 인스턴스 정리 후 캐시 에러 0).
