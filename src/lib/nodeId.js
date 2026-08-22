// ─────────────────────────────────────────────────────────────────────────────
// nodeId — 로거 파일명 → 노드(장비) ID(node_code)
//
//   inferNodeId('80053.txt')         → '80053'
//   inferNodeId('W-3.txt')           → 'W-3'
//   inferNodeId('수위계_(All).txt')   → '수위계_(All)'
//   inferNodeId('지중경사계_(I-3-AB).txt') → '지중경사계_(I-3-AB)'
//
// 규칙: **확장자만 떼고 파일명을 그대로** node_code 로 쓴다(임의 prefix·숫자추출 X).
//   - 로거가 준 이름을 정체성으로 보존 → 정보 손실·충돌 없음.
//   - node_code 는 백엔드와 공유하는 안정적 식별키. 특수문자/한글은 URL 사용 시
//     encodeURIComponent 로 처리됨(backendApi.nodeDeletePath).
// 노드 ID 는 불변 식별자이며 현장과 무관합니다(현장-블라인드).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} fileName 파일명 또는 경로
 * @returns {string} node_code (확장자 뗀 파일명)
 */
export function inferNodeId(fileName = '') {
  const base = String(fileName)
    .split(/[\\/]/)
    .pop()                       // 경로 → 파일명
    .replace(/\.[^.]+$/, '')     // 확장자 제거
    .trim();
  return base || 'NODE';
}
