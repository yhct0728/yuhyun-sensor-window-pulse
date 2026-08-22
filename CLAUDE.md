# Pulse 프로젝트 가이드

## 프로젝트 개요

**제품명**: Pulse  
**부제**: 유현건설 계측 모니터링 시스템  
**환경**: Electron 42 + React 18 + Tailwind, Windows 데스크톱 앱  
**빌드 도구**: Electron Forge + Vite  
**목적**: 타사가 PC에 떨궈주는 센서 .txt 파일을 모니터링하고, 검증 후 백엔드로 동기화

## 데이터 흐름 (v2 — 현장-블라인드, ADR-0010)

[타사 로거] → .txt 덮어쓰기(워치 폴더) → [Pulse] 노드 ID 기준 원본 수신·전송 → [백엔드 인제스트] 현장 stamp·안전 판정 → 웹(GeoMonitor)

- **Pulse 는 현장(Site)을 모른다.** 노드(장비 ID) 단위로만 수집·전송. 전송 페이로드 = `{ nodeId, channel, ts, value }` (현장 필드 없음).
- Pulse 가 다루는 상태는 **수신(reception: live/delayed/lost) + 전송(transmit: sent/queued/retry/failed)** 뿐. **안전 판정(정상/의심/오류)은 안 한다** (GeoMonitor 책임).
- 모든 런타임 컬렉션은 **제로 디폴트(빈 배열)** 로 시작 — 더미 시드 금지. 각 화면 빈 상태 필수.

## 데이터 구조 (v2)

- 단위: **노드(Node)** = 장비 1대 = .txt 1개 = 채널(Channel) N개. 노드 ID 는 불변 식별자(예 `YH-0007`), 현장 무관(이동 자산).
- 모델: `lib/types.js` (Node/Channel/DetectedFile/ChannelType/Reception/Transmit). 현장 필드 없음.
- 파일명 → 노드 ID 추론 `lib/nodeId.js`, 채널 코드 분류 `lib/classifyChannel.js`.
- 타사 쓰기 방식: 덮어쓰기 (append 아님). 원본 .txt 는 읽기 전용.

## 채널 정의 (계측기 타입 카탈로그)

**계측기 도감** 페이지(`pages/Reference.jsx`, 사이드바 `reference`) = 읽기 전용 참조(ADR-0011, "채널 정의" 페이지 대체). 탭3: ① 계측기 목록(22종 카드·카테고리 필터) ② 공식 타입(테이블) ③ 계수 사전(공식타입 서브탭+계수 설명). 데이터 단일 소스 `lib/sensorReference.js`(SENSORS 22/FORMULAS 22/FORMULA_DEFS 5, 도메인 사실 — 변경 금지). **공식·계수는 설명용 문서일 뿐 Pulse 는 적용하지 않음**(ADR-0009 유지). 색은 `components/reference/referenceColors.js`(oklch→Tailwind 색군 매핑). 별개로 `lib/channelCatalog.js`+store `channelTypes` 는 등록 위저드의 채널 코드(GI/BT…) 라벨 자동완성용으로만 남아 있음.

## 디자인 톤

- 참고: Linear, Vercel, Notion, Supabase Studio, Cursor
- 원칙: 차분한 무채색 + 상태 색만, 1px 보더, 둥근 모서리 6~8px
- 아이콘: lucide-react만 사용 (이모지 절대 금지)
- 폰트: Pretendard 또는 시스템 sans, 12/13/14/16/20/24 단계
- 다크모드: 완벽 지원 (zinc 팔레트)

## 데이터 처리 원칙

- 원본 .txt는 절대 안 건드림 (읽기 전용)
- 수정은 우리 DB에서만, 원본 보존
- 이상치는 자동 플래그링, 결정은 사용자

## Phase 로드맵

### Phase 1: UI 완성 — v2 현장-블라인드 (ADR-0010)

- [x] 노드 모니터 (모니터링 탭: 메트릭5·뷰3종·필터/정렬/검색 · 감지·등록 탭: 감시폴더·요약3·감지목록)
- [x] 노드 상세 드로어 (채널 스트림 / 전송 큐 / 진단 로그 3탭)
- [x] 노드 등록 위저드 (감지→분석→채널 매핑→확인 4단계, files:analyze 실파싱)
- [x] 전송 큐 페이지 (인제스트 카드·요약5·큐 테이블)
- [x] 계측기 도감 페이지 (읽기 전용 3탭: 계측기 목록·공식 타입·계수 사전, ADR-0011)
- [x] 전 화면 빈 상태(제로 디폴트)
- [x] 설정 페이지 (데이터 폴더 지정/검증/저장)
- [ ] 알림 영역

> 검증일: 2026-05-30. 페이지 = NodeMonitor/TransmitQueue/Reference(계측기 도감)/Settings. 노드 상세=드로어, 등록=모달 위저드.
> 현장 관리·계측기 종류(v1)는 제거됨. **진단 로그 페이지·검색(⌘K)도 제거**. 사이드바 = 노드 모니터/전송 큐/계측기 도감/설정 4개.

### Phase 2: SQLite 영속화
### Phase 3: 파일 폴링 워커
### Phase 4: 백엔드 API
### Phase 5: 동기화 워커

## 영속성 위치 (현재)

| 데이터 | 위치 | 방식 |
|---|---|---|
| 데이터 폴더 경로 | %APPDATA%/pulse/pulse-config.json | folderService.js의 fs.writeFile |
| 다크모드 | localStorage['pulse:theme'] | useDarkMode.js |
| 노드/측정값 | 메모리만 (재시작 시 휘발) | Phase 2에서 SQLite로 |

## 작업 진행 방식

1. 한 번에 한 화면씩만 작업
2. 작업 시작 전 Phase 로드맵 체크리스트 확인
3. 작업 완료 후 docs/work-log/YYYY-MM-DD-{작업명}.md 보고서 작성
4. 자체 검증 + 자동 테스트 통과 후 사용자에게 보고
5. 다음 작업은 사용자가 결정

## Claude Code 작업 규칙

### 코드 스타일
- 이모지 절대 사용 금지 (lucide-react 아이콘만)
- Tailwind 유틸리티 클래스 (zinc 팔레트)
- 컴포넌트는 함수형 + Hooks
- 외부 상태 관리 라이브러리 없이 useState만
- localStorage는 다크모드 외 사용 금지 (예외: 계측기 종류 마스터의 Phase 1 임시 저장 `pulse:sensorTypes` — Phase 2 SQLite 로 이관)

### 영속성
- Phase 1 동안은 React state만 (메모리)
- Phase 2 도입 전 SQLite 코드 작성 금지
- 새로운 settings 키 추가 시 folderService.js 패턴 따라가기

### IPC 패턴
- 메인 프로세스: *Service.js 파일에 IPC 핸들러 등록
- preload.js에 electronAPI로 노출
- 렌더러: window.electronAPI.xxx() 호출

### 디자인 일관성
- 새 컴포넌트는 기존 ui/ 폴더 컴포넌트 재사용
- 색상은 zinc 팔레트 위주
- transition은 150ms duration
- 둥근 모서리 6~8px

## 문서 체계 (결정 · 변경 · 아키텍처)

타팀 보고와 회고를 위해 세 가지를 역할별로 둔다. (근거: `docs/decisions/0001-adr-c4-changelog-도입.md`)

- **결정 기록(ADR)** — `docs/decisions/`: "왜 그렇게 정했나". 의미 있는 결정마다 `adr-template.md`를 복사해 `NNNN-제목.md`를 추가하고 `docs/decisions/README.md` 인덱스를 갱신. 기록은 고치지 말고 상태만 `폐기됨`/`NNNN로 대체됨`으로 바꾼 뒤 새 ADR로 대체.
- **CHANGELOG.md**(루트) — "무엇이 바뀌었나"(Keep a Changelog). 사용자에게 보이는 변경은 `[Unreleased]`에 한 줄 + 해당 ADR 링크.
- **아키텍처(C4)** — `docs/architecture/`: 전체 구성을 Context→Container→Component로. 모델 원본은 `pulse.c4`(LikeC4). 인터랙티브 뷰 `npm run arch`, 문서 인라인은 `README.md`의 Mermaid. 구조가 바뀌면 둘 다 갱신(수동 동기화).

> work-log 와 병행: **work-log=작업 단위 상세 보고서**, **ADR=결정 단위**, **CHANGELOG=보고 다이제스트**.

## 자동 검증

각 작업 완료 시 자동 실행:
1. npm test - Playwright E2E 테스트 통과
2. npm start - 앱 실행 후 콘솔 에러 없음
3. docs/work-log/YYYY-MM-DD-{작업명}.md 보고서 작성

자세한 절차는 docs/work-log/PROMPT_FOOTER.md 참조.

> 상태(2026-05-25): 자동 검증 인프라 **구축 완료**. Playwright(@playwright/test)+chromium 설치,
> `playwright.config.js`, `docs/work-log/{TEMPLATE,PROMPT_FOOTER}.md`, `tests/` 존재.
> `npm test`(= `playwright test`) 는 Vite dev 서버(`npm run dev:web`, :5173) 기반으로 **렌더러만** 검증합니다
> (Electron 메인 프로세스 아님 → `window.electronAPI` 는 `page.addInitScript` 로 모킹).
> 현재 스펙: `tests/dashboard.spec.js`(6), `tests/node-detail.spec.js`(8) = **14 tests 통과**.
> HTML 리포트: `tests/report/`(`npm run test:report`), UI 모드: `npm run test:ui`.
> 참고: "2. npm start - 콘솔 에러 없음" 은 여전히 수동(Electron 하니스) 검증 — Playwright 는 dev:web 렌더러만 봄.

## 알려진 이슈 (v2)

- 노드/채널/전송 상태가 **메모리(`lib/store.jsx`)에만** 저장됨 — 재시작 시 휘발 (Phase 2 SQLite)
- 폴링 워커 없음 — `usePolling` 은 UI 카운트다운만, 실제 파일 감지/rx-tick 없음 (Phase 3)
- 인제스트 미연결(제로 디폴트). 전송 큐/재전송은 메모리 시뮬레이션 (실제 `ingest:*` IPC 추후)
- 진단 로그 페이지·검색(⌘K)은 제거됨(미사용 스텁이라 삭제). 노드 상세 드로어의 "진단 로그" 탭은 유지
- 시각 기준 프로토타입 본문 JSX(`pulse2-*.jsx`) 미전달 → 레이아웃은 사양+HTML head 토큰 기반
- `recharts`·`mathjs` 는 미사용 의존성으로 남음 (정리 가능)
- 아래 "### 추가 확인된 이슈"는 v1 기록으로 대부분 무효 — v2 기준은 위 목록을 따른다

### 추가 확인된 이슈 (2026-05-25, 실제 코드 대조)

- **노드 상세 시계열은 모든 노드 공통 더미**(`src/lib/mockNodeData.js`). 실제 .txt 파싱 없음 (Phase 3).
- 노드 등록이 메모리라 **앱 재시작 시 노드가 사라짐** → 노드 상세에 들어가려면 매번 재등록 필요.
- 노드 상세의 **새로고침 / 더보기(MoreHorizontal) / CSV 내보내기 / 행 수정(Pencil)** 은 stub (console.log + 토스트).
- 사이드바 **검색(⌘K) · 사용자 메뉴**, 대시보드 **필터 버튼** 은 console.log 만 (토스트 없음 → 사용자에게 무반응처럼 보임).
- ~~자동 검증 인프라 미구축~~ → **해결(2026-05-25)**: Playwright + `npm test`(14 tests 통과) + `docs/work-log/` 구축됨.
- **테스트 전용 훅**: `App.jsx` 에 `?test=node-detail` 쿼리 파라미터 시 합성 노드(GI-07)로 노드 상세 직행 (E2E 진입용). 운영 영향 없음(파라미터 없으면 무시). 등록 영속화(Phase 2) 후 제거/대체 검토.
- `npm test` 는 **렌더러(dev:web)만** 검증 — Electron 메인/preload IPC(folderService) 는 모킹되며 실제 동작은 별도 확인 필요.
- 노드 상세 **기간 기본값을 30일로 둠**(원래 사양 7일). 더미 데이터의 최근 7일이 오프라인 구간이라 7일 진입 시 차트가 비어 보여 변경. (7일 탭은 유지)
- **빈 데이터 노드 상태 UI** 는 구현되어 있으나 대시보드에서 도달 경로 없음(실제 파싱 도입 후 자연 도달 예정).
- `package.json` 메타데이터 미정리: name/productName 이 "pulse"(소문자), description 이 템플릿 기본값, author 가 템플릿 값.
- (무해) 빌드 시 `postcss.config.js` MODULE_TYPELESS 경고 1줄, recharts 로 인한 렌더러 번들 >500KB 경고 — 둘 다 동작에 영향 없음.

## 실제 구현된 IPC (현재)

`preload.js` → `window.electronAPI` 로 노출, `folderService.js` 에 핸들러 등록 (전부 데이터 폴더 관련):

- `getDefaultFolder()` → app.getPath('desktop')
- `getRootFolder()` / `setRootFolder(path)` / `resetToDefault()` → pulse-config.json 영속
- `validateFolder(path)` → 실제 fs, 하위 폴더까지 재귀적으로 .txt 개수
- `pickFolder()` → 네이티브 폴더 선택 다이얼로그
- `scanFolder(rootPath)` → 폴더의 .txt 를 DetectedFile[] 로 분석 (행수/인코딩/크기/수정시각)
- `analyzeFile(fullPath)` → 한 .txt 구조 분석: 인코딩/행수/구분자/열수/주기 추정/원본 미리보기 (등록 위저드 Step 2~3)

> nodes:register / ingest:status,retry,flush / channels:list,add / nodes:rx-tick / poll:next 는 아직 렌더러 메모리(`lib/store.jsx`) 동작 + 코드 주석 TODO (핸들러 없음). 현장 관련 IPC(getSites 등)는 현장-블라인드(ADR-0010)로 폐기.

### 백엔드 API 계약 (2026-05-30, 호출 미연결)

`lib/backendApi.js` 가 단일 소스. base = 백엔드 URL + `/api`, 인증 `X-API-Key`. 레거시 `/api/legacy/*` 폐지(404).
- `POST /api/pulse/v1/heartbeat` `{ pulseId, status, info? }`
- `POST /api/pulse/v1/nodes` `{ node_code, sensor_type, name?, channels?:[{ch,code}], sensor_count?, sensor_sync? }` — sensor_type 은 enum 13종, node_code 멱등. **`channels` 오면 채널당 센서 1개 생성**(센서코드 `{node_code}-{code}`, 예 `80053-WL-1`), 없으면 sensor_type 템플릿. `sensor_count` 참고용(실제=channels). **`sensor_sync`**: 생략/`additive`=빠진 센서 유지, `replace`=channels 에 없는 기존 센서 정리(데이터 없으면 삭제·있으면 비활성, channels 있을 때만 동작). 펄스는 패턴으로 센서 집합을 단언하므로 `replace` 전송. 현장-블라인드라 site_id 안 보냄.
- `POST /api/pulse/v1/ingest` `{ sensorCode, measurements:[{measuredAt, value, depthLabel?}], rawFile? }` — **sensorCode = `{node_code}-{code}`**(register 는 bare code, ingest 만 prefix). `lib/backendApi.js` `ingestSensorCode()` 가 조합(중복 prefix 방지).
- `GET /api/pulse/v1/status` — 웹/운영용, 펄스 무관.

> 현재 펄스는 이 API 를 **호출하지 않습니다**(fetch 0). 모듈은 계약 못박기 + 추후 연동용. 노드 등록의 `sensorType` 은 이 enum 코드로 저장됨(표시는 `sensorTypeLabel`).
