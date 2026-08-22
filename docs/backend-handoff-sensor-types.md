# [펄스 → 백엔드 요청] sensor_type 코드 ↔ 의미 ↔ 단위 정합

> 작성 2026-05-31. 노드 등록 시 펄스가 보내는 `sensor_type`(영어 코드)의 **의미·단위가 백엔드 템플릿과 어긋나는** 문제.

## 문제 (실제 발생)

펄스는 `POST /api/pulse/v1/nodes` 에 `sensor_type`(영어 코드)만 보내고 **단위는 안 보냅니다.**
백엔드는 그 코드의 **템플릿으로 의미·단위를 결정**합니다. 그런데 코드 의미가 서로 다릅니다:

| | 펄스 의도 | 백엔드 템플릿(현재) |
|---|---|---|
| `groundwater` | **지하수위계 (수위, 단위 `m`)** | **간극수압 PWP (단위 `kPa`)** |

→ 지하수위 데이터가 **"간극수압 kPa"로 잘못 적재**됩니다 (의미·단위 둘 다 틀림).
또한 펄스엔 **간극수압 전용 코드가 없습니다** → 간극수압을 보낼 방법이 모호.

추가로, **복합 계측기는 단위가 채널마다 다릅니다** (단일 sensor_type 으로 단위 1개를 못 정함):
- `wind` 풍향·풍속계 = 풍향(`°`) + 풍속(`m/s`)
- `thermo_hygro` 기온·습도계 = 기온(`℃`) + 습도(`%`)

## 펄스가 의도하는 sensor_type (현재 13종) — 코드 / 한글 / 의도 단위

| sensor_type | 한글 | 채널코드 약어 | 의도 단위 | 비고 |
|---|---|---|---|---|
| `water_level` | 수위계 | WL | `m` | |
| `groundwater` | **지하수위계** | WL | **`m`** | ⚠️ 백엔드는 kPa(간극수압)로 만듦 |
| `rainfall` | 우량계 | RF | `mm` | |
| `crack` | 균열계 | CR | `mm` | |
| `inclinometer` | 지중경사계 | GI | `mm` | 깊이 프로파일(depthLabel) |
| `settlement` | 침하계 | SP | `mm` | |
| `tilt` | 경사계 | BT | `°` | |
| `strut` | 축력계(버팀대) | LC | `kN` | |
| `strain` | 변형률계 | SG | `με` | |
| `vibration` | 진동계 | VB | `mm/s` | 확인 필요(cm/s·gal?) |
| `wind` | 풍향·풍속계 | WS | `°` + `m/s` | **채널별 단위 다름** |
| `thermo_hygro` | 기온·습도계 | TH | `℃` + `%` | **채널별 단위 다름** |
| `seismic` | 지진계 | EQ | `gal` | 확인 필요(m/s²?) |
| **(없음)** | **간극수압계** | (PP) | `kPa` | ⚠️ 펄스에 코드 없음 — 백엔드가 groundwater 로 쓰는 중 |

> 단위 출처: 펄스 `lib/channelCatalog.js`(토목 계측 표준). WL=지하수위 `m`, PP=간극수압 `kPa` 로 명확히 구분돼 있음.

## 충돌·누락 요약

1. **🔴 `groundwater` 의미 충돌** — 펄스=지하수위(m) vs 백엔드=간극수압(kPa). 가장 시급.
2. **🔴 간극수압 코드 부재** — 펄스에 간극수압 전용 코드가 없음.
3. **복합 단위** — wind/thermo_hygro 는 채널마다 단위가 달라 sensor_type 1개로 단위를 못 정함.
4. 단위 확인 필요: vibration, seismic.

## 제안 (택1 — 1번 권장)

### 1. 펄스가 `unit` 을 **채널별로 명시 전송** (권장)
- `POST /nodes` 의 `channels[]` 에 `unit` 추가 → 백엔드는 **추측하지 말고 펄스가 준 unit 사용.**
- 의미(표시명)는 `sensor_type` 로, **단위는 channel.unit 로** 분리 → groundwater 모호성·복합단위 모두 해결.
```json
{ "node_code": "80053", "sensor_type": "groundwater",
  "channels": [
    { "ch": 1, "code": "WL-1", "unit": "m" },
    { "ch": 2, "code": "WL-2", "unit": "m" },
    { "ch": 3, "code": "WL-3", "unit": "m" }
  ],
  "sensor_count": 3, "sensor_sync": "replace" }
```
- 펄스 작업: 각 채널에 sensor_type 기본 단위(위 표) 부여해 전송. (복합형은 채널별로 다른 단위)

### 2. 백엔드가 **표준 코드↔의미↔단위 표를 확정·공개**
- 펄스가 거기 맞춰 코드 재정의: `groundwater`(지하수위, m)와 `pore_pressure`(간극수압, kPa) **분리**.
- 단, 복합단위(wind/thermo_hygro)는 여전히 채널별 단위가 필요 → 1번을 병행하는 게 좋음.

## 합의 필요 (백엔드 회신 바람)

1. `unit` 필드(채널별)를 **수용**할지? 수용하면 펄스가 1번대로 바로 보냄.
2. `groundwater` 코드를 **어느 의미로 고정**할지 + **간극수압 코드(`pore_pressure` 등) 신설** 여부.
3. vibration/seismic 표준 단위 확인.
