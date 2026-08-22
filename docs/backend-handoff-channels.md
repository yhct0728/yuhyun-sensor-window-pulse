# [펄스 → 백엔드 요청] 노드 등록 시 "파일 열(채널)마다 센서 생성"

> ✅ **해결됨 (2026-05-31)** — 백엔드 구현 완료. channels 오면 채널당 센서 1개(`{node_code}-{code}`), 없으면 템플릿, 멱등 additive upsert(추가만·감소 시 유지). 실측: 80053 channels[WL-1/2/3] → 센서 3개 `80053-WL-1/2/3`.
> 확정 답: ① sensor_code = `{node_code}-{code}` ② 채널 센서 메타 = sensor_type 동일·unit 카탈로그 기본·임계값은 노드 단위 ③ 채널 감소 시 기존 센서 유지.
> **펄스 후속**: ingest 의 sensorCode 는 `{node_code}-{code}` 로 prefix(register 는 bare). `lib/backendApi.js` `ingestSensorCode()` 적용 완료(ingest 전송 자체는 Phase 4).
>
> 아래는 합의 당시 원문(참고용).


## 배경 / 문제
현재 `POST /api/pulse/v1/nodes` 는 **sensor_type 템플릿**으로 센서를 자동 생성합니다
(groundwater→1·PWP, water_level→1·WL, inclinometer→2·A/B …). 즉 **센서 개수가 종류로 고정**되고,
실제 로거 파일의 **열(채널) 수와 무관**합니다.

그런데 로거 .txt 는 패턴에 따라 센서 수가 다릅니다 (펄스가 파싱해 판정):
- **번호/이름형** `"DateTime","1","2","3"` → 서로 다른 열 = **센서 N개**(80053 → 3개)
- **깊이형(시리즈)** `"DateTime","0.0M","0.5M", … ,"40.0M"` → **센서 1개**(지중경사계 1대), 81열은 그 센서의 **깊이별 데이터**(ingest 의 `depthLabel` 로 전송)

→ **센서 수 = 패턴으로 결정**(열 개수 ≠ 무조건 센서 수). 펄스가 시리즈/비시리즈를 구분해 보냅니다.

## 요청 (백엔드 변경)
`POST /api/pulse/v1/nodes` 가 **`channels` 배열을 받으면 채널마다 센서를 생성**해 주세요.

### 펄스가 보내는 본문 (이미 전송 중 — 현재 백엔드는 `channels`·`sensor_count` 무시)
```json
{
  "node_code": "80053",
  "sensor_type": "water_level",
  "name": "80053",
  "sensor_count": 3,
  "channels": [
    { "ch": 1, "code": "WL-1" },
    { "ch": 2, "code": "WL-2" },
    { "ch": 3, "code": "WL-3" }
  ]
}
```
- **`sensor_count`** = 만들어야 할 센서 개수(시리즈=1, 비시리즈=열 개수). 빠르게 개수만 쓰려면 이 값만 봐도 됨.
- `channels[].code` = 펄스가 정한 **채널 식별 코드**(센서 코드의 소스). `ch` = 파일 열 순서(1부터). 채널 단위로 만들려면 이걸 사용.
- 펄스는 등록·전송에서 **동일한 code** 를 씁니다(ingest 의 `sensorCode` 도 이 code).
- ⚠️ **검증됨(2026-05-30)**: `sensor_count`/`channels`/`sensors` 어느 필드를 보내도 현재는 201 + 센서 1개(템플릿). 백엔드 구현 전까진 개수 안 바뀜.

### 기대 동작
- **`channels` 가 오면(비시리즈)** → **각 channel 당 센서 1개 생성**. 센서의 sensor_type = 노드의 `sensor_type`.
  - sensor_code 명명 규칙은 백엔드 재량(예: `{node_code}-{code}`). 단, **ingest 의 `sensorCode` 와 매칭될 코드**여야 함(펄스가 보낸 `code` 를 그대로 쓰면 가장 단순).
- **`channels` 가 없으면(시리즈/깊이형 또는 미전송)** → **기존 sensor_type 템플릿대로** 생성(센서 1개 = 1 계측기). 깊이별 값은 펄스가 ingest 에서 `depthLabel` 로 보냄.
- **멱등**: 같은 `node_code` 재전송 시 채널 기준 upsert(중복 금지, 빠진 채널만 추가).

### 예시
| node_code | 패턴 | channels 전송 | 생성될 센서 |
|---|---|---|---|
| 80053 | 번호형(3열) | WL-1·WL-2·WL-3 | **3개** |
| W-3 | 이름형(1열) | WL-1 | 1개 |
| 지중경사계_(I-3-AB) | 깊이형(81열) | **(안 보냄)** | **1개**(템플릿) · 깊이는 ingest depthLabel |

## 확인된 현재 동작 (변경 전)
- `channels` 필드 포함해 POST 해도 **201**(필드 무시) → 안전. 단 센서는 여전히 템플릿대로 1개만.
- 검증: `POST {…, channels:[1,2,3]}` → 201, 센서 `CHTEST-WL` 1개.

## 펄스 측 상태
- 펄스는 **이미 `channels` 를 전송**합니다(`lib/backendApi.js` `nodeRegisterBody`). 백엔드가 위대로 구현하면 추가 변경 없이 채널별 센서가 생성됩니다.
- ingest(데이터 전송)는 채널별 `sensorCode` 로 보낼 예정이라, **register 의 channel code = ingest 의 sensorCode** 가 일치해야 합니다.

## 질문(백엔드 결정 필요)
1. sensor_code 명명: 펄스의 `code` 를 그대로 쓸지, `{node_code}-{code}` 로 접두할지? → **해결: `{node_code}-{code}`**
2. 채널별 센서의 단위/임계값 등 메타는 sensor_type 기본값을 그대로 쓰면 되는지? → **해결: sensor_type 기본값**
3. 채널 삭제(파일 열이 줄어듦) 시 센서 처리 정책(비활성/유지)? → **아래 [추가 요청] 참고**

---

## [추가 요청] 잉여 센서 정리 + 비활성 옵션 (2026-05-31, 펄스→백엔드)

### 배경
펄스가 깊이형(지중경사계 등)을 **센서 1개**로 보내도록 고쳤습니다(이전엔 `channels` 미전송 → 백엔드 inclinometer 템플릿이 **A·B 2센서**를 만듦). 그런데 **이미 그렇게 2센서로 만들어진 기존 노드**는 펄스가 재전송해도 정리되지 않습니다 — upsert 가 **additive**(추가만, 제거 안 함)라서요.

### 구체 사례 (실측)
- 노드 `지중경사계_(I-4-AB)` 에 **A축·B축 2센서**가 남아 있음(옛 템플릿 산물).
- 펄스가 `channels:[{code:"A"}]`(센서 1개)로 재등록해도 → 응답 201, 여전히 **2개**(`-A`, `-B`). A 는 매칭, **B 는 그대로 유지**.
- `DELETE /api/pulse/v1/nodes/지중경사계_(I-4-AB)` → **400(거부)**. (측정데이터/배치 사유로 추정 — 펄스는 이 노드에 ingest 한 적 없음.)

### 요청 (둘 다)
1. **잉여 센서 1건 정리**: `지중경사계_(I-4-AB)` 의 **B축 센서를 제거(또는 비활성)** 해 1센서로 맞춰 주세요. (또는 이 노드를 force 삭제해 주시면 펄스가 1센서로 재등록하겠습니다 — 현재 DELETE 가 400 이라 펄스 쪽에서 정리 불가.)
2. **정책 옵션 추가**: register 시 보낸 `channels` 에 **없는 기존 센서**를 어떻게 할지 옵션화. 기본은 지금처럼 **유지(additive)** 로 두되, 펄스가 "이 노드의 센서 집합은 이 channels 가 전부"라고 선언할 수 있는 모드(예: 요청에 `sensor_sync: "replace"` 또는 빠진 센서 **비활성 처리**)를 주세요. → 앞으로 파일 구조가 바뀌어 센서가 줄어드는 경우(열 삭제, 깊이형 오등록 정정)에 펄스가 스스로 정합을 맞출 수 있습니다.

### 펄스 측 현황
- 펄스는 `lib/sensorModel.js` 해석기로 센서 수를 정확히 도출해 `channels` 로 보냅니다(깊이형=1, 번호/이름형=N, 온도열 제외). **펄스에서 더 할 건 없고**, 위 2건은 백엔드 정책/정리 사안입니다.
- `sensor_sync` 같은 플래그가 생기면 펄스가 register 본문에 실어 보내도록 즉시 맞추겠습니다(`nodeRegisterBody` 한 줄).
