// ─────────────────────────────────────────────────────────────────────────────
// 계측기 도감 — 공통 정적 데이터 (단일 소스)
// 사용처: 계측기 도감 페이지 (pages/Reference.jsx, components/reference/*).
// 22종 계측기 / 공식 타입 / 계수 사전. 외부 의존 없음. 순수 읽기 전용 참조 데이터.
//
// ⚠️ 내용(측정값·공식·계수 설명)은 도메인 사실 — 한 글자도 바꾸지 말 것.
// (원본 yuhyun-sensor-front/lib/sensor-reference.ts 를 JS 로 1:1 이식)
//
// 타입(JSDoc):
//   SensorCat   = 'water'|'construction'|'slope'|'weather'|'facility'
//   FormulaType = 'VW Linear'|'VW Poly'|'4~20mA'|'Voltage'|'Bridge'
//   CoeffSource = '캘리브레이션 시트'|'설치 시 현장 입력'|'로거 실시간 수신'|'계산 결과'
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { key: 'water',        label: '하천·댐·저수지' },
  { key: 'construction', label: '건설현장' },
  { key: 'slope',        label: '사면·비탈면' },
  { key: 'weather',      label: '기상·환경' },
  { key: 'facility',     label: '시설물 안전' },
];

export const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export const SENSORS = [
  // 하천·댐·저수지
  { no: 1,  ko: '수위계',       en: 'Water Level Gauge',          measure: '하천·저수지 수위',            unit: 'm, cm',                cat: 'water' },
  { no: 2,  ko: '우량계',       en: 'Rain Gauge',                 measure: '강수량',                       unit: 'mm',                   cat: 'water' },
  { no: 3,  ko: '유량계',       en: 'Flow Meter',                 measure: '유속·유량',                    unit: 'm/s, m³/s',            cat: 'water' },
  { no: 4,  ko: '수질측정기',   en: 'Water Quality Meter',        measure: 'pH·DO·탁도·전기전도도',        unit: '—·mg/L·NTU·μS/cm',     cat: 'water' },
  { no: 5,  ko: '수온계',       en: 'Water Thermometer',          measure: '수온',                         unit: '°C',                   cat: 'water' },
  // 건설현장 (가시설·굴착)
  { no: 6,  ko: '지중경사계',   en: 'In-situ Inclinometer',       measure: '흙막이 벽체·지중 수평변위',    unit: 'mm',                   cat: 'construction' },
  { no: 7,  ko: '축력계 (하중계)', en: 'Strut Load Cell',         measure: '버팀보 축력',                  unit: 'kN',                   cat: 'construction' },
  { no: 8,  ko: '앵커 하중계',  en: 'Anchor Load Cell',           measure: '앵커 인장력',                  unit: 'kN',                   cat: 'construction' },
  { no: 9,  ko: '지표침하계',   en: 'Surface Settlement Pin',     measure: '지표면 침하량',                unit: 'mm',                   cat: 'construction' },
  { no: 10, ko: '건물경사계',   en: 'Building Tiltmeter',         measure: '인접 건물 기울기',             unit: '°, mm/m',              cat: 'construction' },
  { no: 11, ko: '지하수위계',   en: 'Standpipe Piezometer',       measure: '굴착 중 지하수위 변화',        unit: 'm',                    cat: 'construction' },
  { no: 12, ko: '응력계',       en: 'Stress Meter',               measure: '흙막이 벽체 응력',             unit: 'MPa',                  cat: 'construction' },
  // 사면·비탈면
  { no: 13, ko: '구조물 경사계', en: 'Structural Inclinometer',   measure: '구조물·지반 기울기',           unit: '°, mm/m',              cat: 'slope' },
  { no: 14, ko: '침하계',       en: 'Settlement Gauge',           measure: '수직 침하량',                  unit: 'mm',                   cat: 'slope' },
  { no: 15, ko: '변위계',       en: 'Displacement Meter',         measure: '수평·수직 변위',               unit: 'mm',                   cat: 'slope' },
  { no: 16, ko: '간극수압계',   en: 'Pore Water Pressure Gauge',  measure: '지하수압',                     unit: 'kPa',                  cat: 'slope' },
  { no: 17, ko: '토압계',       en: 'Earth Pressure Gauge',       measure: '지반 압력',                    unit: 'kPa',                  cat: 'slope' },
  // 기상·환경
  { no: 18, ko: '기온·습도계',  en: 'Thermo-Hygrometer',          measure: '기온·상대습도',                unit: '°C, %',                cat: 'weather' },
  { no: 19, ko: '풍향·풍속계',  en: 'Anemometer',                 measure: '풍향·풍속',                    unit: '°, m/s',               cat: 'weather' },
  // 시설물 안전
  { no: 20, ko: '균열계',       en: 'Crack Meter',                measure: '균열 폭 변화',                 unit: 'mm',                   cat: 'facility' },
  { no: 21, ko: '진동계',       en: 'Vibration Meter',            measure: '진동 가속도',                  unit: 'Gal, cm/s²',           cat: 'facility' },
  { no: 22, ko: '압력계',       en: 'Pressure Gauge',             measure: '관망 내 수압',                 unit: 'kPa, bar',             cat: 'facility' },
];

export const FORMULAS = [
  { sensor: '수위계',        signal: 'VW / 4~20mA',     type: 'VW Linear', formula: 'P = G(R0-R1) + K(T1-T0)',              coeffs: 'G, K, R0, T0',        cat: 'water' },
  { sensor: '우량계',        signal: 'Reed Switch',     type: 'Voltage',   formula: 'P = Count × tip_volume',               coeffs: 'tip_volume',          cat: 'water' },
  { sensor: '유량계',        signal: '4~20mA',          type: '4~20mA',    formula: 'P = (I-4)/16 × Range + Offset',        coeffs: 'Range, Offset',       cat: 'water' },
  { sensor: '수질측정기',    signal: '4~20mA / RS485',  type: '4~20mA',    formula: 'P = (I-4)/16 × Range + Offset',        coeffs: 'Range, Offset',       cat: 'water' },
  { sensor: '수온계',        signal: '4~20mA',          type: '4~20mA',    formula: 'P = (I-4)/16 × Range + Offset',        coeffs: 'Range, Offset',       cat: 'water' },
  { sensor: '지중경사계',    signal: 'Voltage',         type: 'Voltage',   formula: 'P = (V-V0) × Scale + Offset',          coeffs: 'V0, Scale, Offset',   cat: 'construction' },
  { sensor: '축력계 (하중계)', signal: 'VW',            type: 'VW Poly',   formula: 'P = A(R1²-R0²) + B(R1-R0) + K(T1-T0)', coeffs: 'A, B, K, R0, T0',     cat: 'construction' },
  { sensor: '앵커 하중계',   signal: 'VW',              type: 'VW Poly',   formula: 'P = A(R1²-R0²) + B(R1-R0) + K(T1-T0)', coeffs: 'A, B, K, R0, T0',     cat: 'construction' },
  { sensor: '지표침하계',    signal: 'VW',              type: 'VW Linear', formula: 'P = G(R0-R1) + K(T1-T0)',              coeffs: 'G, K, R0, T0',        cat: 'construction' },
  { sensor: '건물경사계',    signal: 'Voltage / MEMS',  type: 'Voltage',   formula: 'P = (V-V0) × Scale + Offset',          coeffs: 'V0, Scale, Offset',   cat: 'construction' },
  { sensor: '지하수위계',    signal: 'VW / 4~20mA',     type: 'VW Linear', formula: 'P = G(R0-R1) + K(T1-T0)',              coeffs: 'G, K, R0, T0',        cat: 'construction' },
  { sensor: '응력계',        signal: 'VW',              type: 'VW Poly',   formula: 'P = A(R1²-R0²) + B(R1-R0) + K(T1-T0)', coeffs: 'A, B, K, R0, T0',     cat: 'construction' },
  { sensor: '구조물 경사계', signal: 'Voltage / MEMS',  type: 'Voltage',   formula: 'P = (V-V0) × Scale + Offset',          coeffs: 'V0, Scale, Offset',   cat: 'slope' },
  { sensor: '침하계',        signal: 'VW',              type: 'VW Linear', formula: 'P = G(R0-R1) + K(T1-T0)',              coeffs: 'G, K, R0, T0',        cat: 'slope' },
  { sensor: '변위계',        signal: 'VW / 4~20mA',     type: 'VW Linear', formula: 'P = G(R0-R1) + K(T1-T0)',              coeffs: 'G, K, R0, T0',        cat: 'slope' },
  { sensor: '간극수압계',    signal: 'VW',              type: 'VW Poly',   formula: 'P = A(R1²-R0²) + B(R1-R0) + K(T1-T0)', coeffs: 'A, B, K, R0, T0',     cat: 'slope' },
  { sensor: '토압계',        signal: 'VW',              type: 'VW Poly',   formula: 'P = A(R1²-R0²) + B(R1-R0) + K(T1-T0)', coeffs: 'A, B, K, R0, T0',     cat: 'slope' },
  { sensor: '기온·습도계',   signal: '4~20mA / RS485',  type: '4~20mA',    formula: 'P = (I-4)/16 × Range + Offset',        coeffs: 'Range, Offset',       cat: 'weather' },
  { sensor: '풍향·풍속계',   signal: 'Voltage / 4~20mA', type: 'Voltage',  formula: 'P = (V-V0) × Scale + Offset',          coeffs: 'V0, Scale, Offset',   cat: 'weather' },
  { sensor: '균열계',        signal: 'VW',              type: 'VW Linear', formula: 'P = G(R0-R1) + K(T1-T0)',              coeffs: 'G, K, R0, T0',        cat: 'facility' },
  { sensor: '진동계',        signal: 'Voltage / IEPE',  type: 'Voltage',   formula: 'P = Raw × Sensitivity',                coeffs: 'Sensitivity',         cat: 'facility' },
  { sensor: '압력계',        signal: '4~20mA',          type: '4~20mA',    formula: 'P = (I-4)/16 × Range + Offset',        coeffs: 'Range, Offset',       cat: 'facility' },
];

export const FORMULA_DEFS = [
  {
    type: 'VW Linear',
    formula: 'P = G(R0-R1) + K(T1-T0)',
    coeffs: [
      { sym: 'P',  name: '측정값 (Output)',         desc: '계산된 최종 물리량. 수위(m), 침하량(mm) 등 계측기마다 단위 다름.',         source: '계산 결과' },
      { sym: 'G',  name: 'Gauge Factor (감도계수)', desc: 'Raw값 변화 1단위당 물리량 변화량. 제조사 교정 시험으로 결정.',             source: '캘리브레이션 시트' },
      { sym: 'R0', name: '초기 Raw값 (기준치)',      desc: '설치 완료 후 최초 측정한 Raw값(Hz² 또는 digit). 이후 모든 계산의 영점.',    source: '설치 시 현장 입력' },
      { sym: 'R1', name: '현재 Raw값',              desc: '로거가 실시간 수신하는 Raw값.',                                            source: '로거 실시간 수신' },
      { sym: 'K',  name: '온도 보정계수',            desc: '온도 변화 1°C당 출력 보정량. 센서 재질 열팽창 특성 반영.',                  source: '캘리브레이션 시트' },
      { sym: 'T0', name: '초기 온도 (기준온도)',     desc: 'R0 측정 시점의 온도. 온도 보정의 기준점.',                                  source: '설치 시 현장 입력' },
      { sym: 'T1', name: '현재 온도',               desc: '로거 실시간 수신 온도. 내장 서미스터 또는 별도 온도계에서 수신.',            source: '로거 실시간 수신' },
    ],
  },
  {
    type: 'VW Poly',
    formula: 'P = A(R1²-R0²) + B(R1-R0) + K(T1-T0)',
    coeffs: [
      { sym: 'P',  name: '측정값 (Output)',    desc: '계산된 최종 물리량. 압력(kPa), 하중(kN), 응력(MPa) 등.',          source: '계산 결과' },
      { sym: 'A',  name: '2차 다항계수',        desc: 'R²항의 계수. 비선형 응답 성분 보정. 값이 작을수록 Linear에 가까움.', source: '캘리브레이션 시트' },
      { sym: 'B',  name: '1차 계수 (Linear항)', desc: 'R항의 계수. 주 감도 결정. Linear의 G와 동일 역할.',                source: '캘리브레이션 시트' },
      { sym: 'R0', name: '초기 Raw값 (기준치)',  desc: '설치 완료 후 최초 측정한 Raw값. 영점 기준.',                       source: '설치 시 현장 입력' },
      { sym: 'R1', name: '현재 Raw값',          desc: '로거 실시간 수신 Raw값(Hz² 또는 digit).',                          source: '로거 실시간 수신' },
      { sym: 'K',  name: '온도 보정계수',        desc: '온도 변화에 따른 출력 보정량. VW Linear의 K와 동일 개념.',         source: '캘리브레이션 시트' },
      { sym: 'T0', name: '초기 온도',           desc: 'R0 측정 시점의 온도. 온도 보정 기준점.',                           source: '설치 시 현장 입력' },
      { sym: 'T1', name: '현재 온도',           desc: '로거 실시간 수신 온도값.',                                         source: '로거 실시간 수신' },
    ],
  },
  {
    type: '4~20mA',
    formula: 'P = (I-4)/16 × Range + Offset',
    coeffs: [
      { sym: 'P',      name: '측정값 (Output)',       desc: '계산된 최종 물리량.',                          source: '계산 결과' },
      { sym: 'I',      name: '현재 전류값 (mA)',       desc: '로거 수신 전류. 4mA=최솟값, 20mA=최댓값.',      source: '로거 실시간 수신' },
      { sym: 'Range',  name: '측정 범위 (Full Scale)', desc: '센서 전체 측정 범위. 예: 0~10m → Range=10.',   source: '캘리브레이션 시트' },
      { sym: 'Offset', name: '오프셋 (영점 보정)',      desc: '설치 조건에 따른 영점 보정값. 예: 1m 위 설치 → Offset=-1.', source: '설치 시 현장 입력' },
    ],
  },
  {
    type: 'Voltage',
    formula: 'P = (V-V0) × Scale + Offset',
    coeffs: [
      { sym: 'P',      name: '측정값 (Output)',    desc: '계산된 최종 물리량. 경사각(°), 가속도(Gal) 등.',     source: '계산 결과' },
      { sym: 'V',      name: '현재 전압값 (V)',     desc: '로거 수신 전압. 0~5V 또는 0~10V 등 센서마다 다름.',  source: '로거 실시간 수신' },
      { sym: 'V0',     name: '초기 전압 (기준전압)', desc: '설치 완료 후 최초 측정한 전압값. 영점 기준.',        source: '설치 시 현장 입력' },
      { sym: 'Scale',  name: '스케일 계수',        desc: '전압 1V당 물리량 변화. 예: ±30° / ±2.5V → Scale=12°/V.', source: '캘리브레이션 시트' },
      { sym: 'Offset', name: '오프셋',            desc: '설치 조건·기울기 보정값.',                          source: '설치 시 현장 입력' },
    ],
  },
  {
    type: 'Bridge',
    formula: 'P = (mV/V - Zero) × GF',
    coeffs: [
      { sym: 'P',    name: '측정값 (Output)',        desc: '계산된 최종 물리량. 하중(kN), 응력(MPa) 등.',           source: '계산 결과' },
      { sym: 'mV/V', name: '브리지 출력비',           desc: '공급전압 대비 출력전압 비율. 무부하 시 Zero값과 같아야 정상.', source: '로거 실시간 수신' },
      { sym: 'Zero', name: '영점 출력비 (Zero Balance)', desc: '무부하 상태의 브리지 출력비. 제조사 교정 후 측정.',    source: '캘리브레이션 시트' },
      { sym: 'GF',   name: 'Gauge Factor',          desc: '출력비 변화 1mV/V당 물리량 변화. 예: 1000 kN/(mV/V).',  source: '캘리브레이션 시트' },
    ],
  },
];
