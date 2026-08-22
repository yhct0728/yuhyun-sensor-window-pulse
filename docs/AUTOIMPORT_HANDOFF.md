# Pulse 더미데이터 자동 등록 — Cowork 핸드오프 프롬프트

아래 블록을 **Claude Cowork 에게 그대로 붙여넣으면** 됩니다. (이 PC에서 파일 쓰기 + 명령 실행이 되는 에이전트 기준)

---

## 붙여넣을 프롬프트

````
너는 Pulse(유현건설 계측 모니터링 데스크톱 앱)를 더미데이터로 테스트한다.
Pulse 는 감시 폴더의 센서 .txt 를 감지→파싱→노드로 등록하는 수집기다.
나는 개발용 "자동 등록(시드)" 경로를 만들어 뒀다. 너는 아래 절차만 따르면 된다.

[프로젝트 위치]
- 앱: C:\Users\USER\OneDrive\Desktop\유현건설\yuhyun-sensor-window\pulse
- 더미 .txt 위치: C:\Users\USER\OneDrive\Desktop\유현건설\datasensor\테스팅  (센서 종류별 21개)

[1단계 — 감시 폴더를 더미 폴더로 지정]
Pulse 설정 파일을 더미 폴더로 맞춘다. 파일: %APPDATA%\pulse\pulse-config.json
- 현재 rootFolder 는 datasensor 전체(하위 .txt 36개 전부 재귀 등록됨)다.
- 더미만 깔끔하게 테스트하려면 rootFolder 를 "...\datasensor\테스팅" 로 바꿔라.
  (원래 값은 반드시 백업했다가 테스트 후 원복할 것)
- backendUrl/apiKey 가 있으면 등록 시 백엔드(localhost:4000)로도 전송된다.
  백엔드를 오염시키고 싶지 않으면 그 두 키를 잠시 빼라(로컬 메모리에만 등록됨).

[2단계 — 자동 등록 모드로 실행]
PowerShell 에서:
    cd "C:\Users\USER\OneDrive\Desktop\유현건설\yuhyun-sensor-window\pulse"
    $env:PULSE_AUTOIMPORT=1
    npm start
→ 부팅 직후 Pulse 가 감시 폴더의 모든 .txt 를 위저드와 동일 경로
  (분석→센서해석→등록)로 자동 등록한다. 클릭 0회.
  채널/종류/단위는 해석기가 추론하고, 정상범위(임계치)는 샘플 데이터에서
  보수적으로 자동 도출돼 채널마다 채워진다. 형식이 깨진 파일(🔴)은 건너뛴다.

[3단계 — 결과 확인]
- 앱 화면 "노드 모니터" 에 더미 노드들이 떠야 한다(파일명 = 노드 ID).
- 노드 클릭 → 우측 드로어 "채널 스트림" 탭 → "정상 범위" 섹션에
  채널별 하한/상한이 이미 채워져 있어야 한다(자동 도출된 임계치).
- 상세 요약은 렌더러 DevTools(자동으로 열림) Console 의
  `[auto-import] summary → { registered: [...], skipped: [...] }` 로그로 확인.
- 끝나면 PULSE_AUTOIMPORT 없이 다시 실행하면 평소(수동 등록) 모드다.
  pulse-config.json 을 건드렸다면 원래 값으로 원복할 것.

[새 더미 .txt 를 더 만들고 싶다면 — 형식 규칙]
- 파일명(확장자 제외)이 곧 노드 ID 다. 예: 80053.txt → 노드 "80053".
- 1열 = 시각(예 "2026-06-01 00:00"), 2열부터 값. 첫 줄은 헤더(라벨) 권장.
- 헤더의 채널 코드 접두로 종류가 추론된다:
  WL=수위, GW=지하수위, RF=우량, PW=간극수압, SM=침하, CR=균열, TM=경사,
  AN=앵커, ST=버팀대, SN=변형률, GI=지중경사 …  (예 헤더: DateTime, GW-1, GW-2)
- 패턴:
  · 번호형(1,2,3) / 이름형(GW-1,GW-2) → 1열 = 1센서(N개)
  · 깊이형(0.0M,1.0M,…) → 전체가 1센서(깊이 프로파일)
  · 값+온도형(값,온도) → 온도는 부속, 값만 센서
- 표가 깨진(값 열이 없는) 파일은 등록에서 자동 제외된다.

작업 끝나면 무엇이 등록/스킵됐는지 요약해서 나에게 보고해라.
````

---

## 메커니즘 메모 (개발자용)

- 트리거: 환경변수 `PULSE_AUTOIMPORT` → `src/main.js` 가 렌더러 URL 에 `?test=import` 부착.
- 실행: `src/App.jsx` 테스트 훅이 `store.autoImportFromFolder()` 호출.
- 등록 본체: `src/lib/store.jsx` `autoImportFromFolder()` — `scanFolder→analyzeFile→resolveSensors→registerNode`
  (위저드와 동일 경로) + 채널 샘플값에서 보수적 정상범위 도출(`deriveRangeFromRows`).
- 운영 무관: 플래그 없으면 평소 동작. 테스트 전용(E2E `?test=node` 와 동일 계열 훅).
- 한계: 영속성 없음(메모리) — 앱 재시작 시 노드 휘발. 정상범위는 로컬(localStorage)에 도출 보관,
  백엔드로의 정상범위 전송은 드로어 "정상범위 저장" 시점에 일어난다(노드/채널 자체는 등록 시 전송).
