// ─────────────────────────────────────────────────────────────────────────────
// classifyChannel — 채널 코드 → 채널 타입 코드 (접두 기반)
//
//   classifyChannel('GI-A') → 'GI'
//   classifyChannel('GI-B') → 'GI'
//   classifyChannel('TX')   → 'BT'   (TX/TY 축은 2축 경사계 BT 로 묶음)
//   classifyChannel('TMP1') → 'TMP'
//
// 채널 정의(Channels) 페이지에서 "이 타입을 쓰는 노드/채널"을 집계할 때 사용.
// 카탈로그(ChannelType[])가 비어 있으면 집계 결과는 모두 0 입니다.
// ─────────────────────────────────────────────────────────────────────────────

// 특수 매핑 (접두 규칙으로 안 잡히는 것만). 필요 시 확장.
const ALIASES = {
  TX: 'BT',
  TY: 'BT',
};

/**
 * @param {string} code 채널 코드 (예: 'GI-A')
 * @returns {string} 채널 타입 코드 (예: 'GI')
 */
export function classifyChannel(code = '') {
  const c = String(code).trim().toUpperCase();
  if (!c) return '';
  if (ALIASES[c]) return ALIASES[c];

  // 'GI-A' / 'GI_A' → 'GI'  (구분자 앞부분)
  const sep = c.split(/[-_]/)[0];
  if (sep && sep !== c) return ALIASES[sep] || sep;

  // 'TMP1' → 'TMP'  (뒤 숫자 제거)
  const noNum = c.replace(/\d+$/, '');
  if (noNum && noNum !== c) return ALIASES[noNum] || noNum;

  // 'GIA' → 'GI'  (뒤 축 문자 한 글자 제거) — 길이 3 이상일 때만
  if (c.length >= 3 && /[A-Z]$/.test(c)) {
    const stripped = c.slice(0, -1);
    return ALIASES[stripped] || stripped;
  }

  return c;
}
