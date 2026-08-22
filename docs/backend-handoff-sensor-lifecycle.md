# [펄스 → 백엔드] 센서 생명주기 = 정상/비활성 2단으로 통일 (펄스 적용 완료)

> 2026-06-01. PATCH /api/pulse/v1/sensors/{sensor_code} 의 lifecycle 운영 합의.

## 결정 (펄스)

"죽음(dead)"과 "비활성(disabled)"이 실사용상 구분이 없어 **하나로 통일**했습니다.

- 펄스가 PATCH 로 보내는 lifecycle 값은 **`active` 와 `dead` 둘만** 씁니다. **`disabled` 는 더 이상 전송하지 않습니다.**
- 사용자 화면 라벨은 **"정상 / 비활성"** 이지만, **"비활성"의 전송 값 = `dead`** 입니다.
  (sticky·offline 제외 동작이 확정된 값을 그대로 쓰려고 dead 로 통일)

## 백엔드 확인/요청

1. 펄스는 `disabled` 를 안 보냅니다. enum 에 남겨두셔도 무방(펄스 경로상 안 옴). 정리 여부는 재량.
2. **`dead` 동작 유지 부탁**: sticky + offline 시간추론 제외, **`active` PATCH 로만 해제**.
3. (재확인) **센서별 독립 인지** — 한 노드의 센서 일부만 `dead` 로 보고하고 나머지는 계속 ingest 될 때:
   - dead 센서 → dead 유지(offline 판정 제외)
   - 나머지 센서 → 데이터 들어오는 동안 **정상(online)** 으로 인지
   이게 맞는지 한 번만 확정해 주세요. (펄스는 센서마다 `{node_code}-{code}` 로 **따로** ingest/PATCH 합니다)

## 펄스 측 상태 (적용 완료)

- 노드 상세 드로어 "센서 상태"에서 센서별 **정상 ↔ 비활성** 토글
  → `PATCH /api/pulse/v1/sensors/{sensor_code}` body `{ "status": "active" | "dead" }`
- **비활성(dead) 센서는 ingest 전송에서 제외** (측정값 안 보냄).
- GET 응답 `sensors[].lifecycle_state` 가 `disabled`(레거시)로 와도 화면엔 **"비활성"** 으로 흡수 표시.
- 측정상태 `offline` 은 여전히 백엔드 권위(펄스는 안 보냄) — 생명주기와 별개.
