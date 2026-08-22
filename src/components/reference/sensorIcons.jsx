// ─────────────────────────────────────────────────────────────────────────────
// 계측기 성격별 stroke 인라인 SVG (이모지 금지 규칙 준수). ko 명으로 매핑.
// 원본 yuhyun-sensor-front/components/reference/sensorIcons.tsx 의 path 1:1.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

const KO_TO_ICON = {
  '수위계': 'droplet', '우량계': 'rain', '유량계': 'flow', '수질측정기': 'beaker', '수온계': 'thermo',
  '지중경사계': 'angle', '축력계 (하중계)': 'load', '앵커 하중계': 'load', '지표침하계': 'settle',
  '건물경사계': 'tilt', '지하수위계': 'droplet', '응력계': 'gauge',
  '구조물 경사계': 'angle', '침하계': 'settle', '변위계': 'displace', '간극수압계': 'gauge', '토압계': 'gauge',
  '기온·습도계': 'thermo', '풍향·풍속계': 'wind',
  '균열계': 'crack', '진동계': 'wave', '압력계': 'gauge',
};

const PATHS = {
  droplet:  <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  rain:     <><path d="M7 15a4 4 0 0 1-.5-7.97A5 5 0 0 1 17 7a3.5 3.5 0 0 1 0 7" /><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" /></>,
  flow:     <><path d="M3 9c3-2.4 6 2.4 9 0s6-2.4 9 0" /><path d="M3 15c3-2.4 6 2.4 9 0s6-2.4 9 0" /></>,
  beaker:   <><path d="M9 3h6M10 3v5l-4.2 9.2A1 1 0 0 0 6.7 19h10.6a1 1 0 0 0 .9-1.8L14 8V3" /><path d="M7.5 13h9" /></>,
  thermo:   <><path d="M14 14.5V5a2 2 0 1 0-4 0v9.5a3.5 3.5 0 1 0 4 0z" /><path d="M12 9v6" /></>,
  angle:    <><path d="M5 5v14h14" /><path d="M5 19L17 7" /></>,
  tilt:     <><path d="M7 21l1.2-15 8 .9L15 21z" /><path d="M8 11l7.5.6M7.6 16l7.6.6" /></>,
  load:     <><path d="M9.5 7a2.5 2.5 0 0 1 5 0" /><path d="M7 7h10l1.5 13H5.5z" /><path d="M12 11v5" /></>,
  settle:   <><path d="M5 20h14" /><path d="M12 4v10" /><path d="M8 11l4 4 4-4" /></>,
  displace: <><path d="M3 12h18" /><path d="M7 8l-4 4 4 4" /><path d="M17 8l4 4-4 4" /></>,
  gauge:    <><path d="M4 17a8 8 0 0 1 16 0" /><path d="M4 17h16" /><path d="M12 17l4.5-3.5" /></>,
  wind:     <><path d="M3 8h10a2.5 2.5 0 1 0-2.5-2.5" /><path d="M3 12h14a2.5 2.5 0 1 1-2.5 2.5" /><path d="M3 16h8" /></>,
  crack:    <path d="M13 3l-3.5 6 4 2.5-5 4 3 5.5" />,
  wave:     <path d="M2 12h3l2-6 3.5 12L14 6l2 6h6" />,
};

export function SensorIcon({ ko, size = 20 }) {
  const name = KO_TO_ICON[ko] ?? 'gauge';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}

// 백엔드 sensor_type 코드(backendApi.SENSOR_TYPES) → 아이콘. 코드가 안정 식별자라 라벨 대신 코드로 매핑.
const CODE_TO_ICON = {
  water_level: 'droplet',
  rainfall: 'rain',
  crack: 'crack',
  inclinometer: 'angle',
  settlement: 'settle',
  tilt: 'tilt',
  strut: 'load',
  vibration: 'wave',
  strain: 'displace',
  wind: 'wind',
  thermo_hygro: 'thermo',
  seismic: 'wave',
  groundwater: 'droplet',
};

/** 계측기 종류 코드로 아이콘 렌더 (등록 위저드 드롭다운용). 미지정/미지의 코드는 gauge. */
export function SensorTypeIcon({ code, size = 16 }) {
  const name = CODE_TO_ICON[code] ?? 'gauge';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}
