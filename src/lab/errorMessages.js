/**
 * 백엔드 /validate 의 에러 메시지를 사용자 친화적으로 가공한다.
 *
 * 가장 흔한 케이스:
 *   - 진입 조건에서 포지션 변수(PNL_PCT 등) 사용 → "알 수 없는 변수입니다"
 *     실제로는 컨텍스트가 맞지 않는 것뿐이므로 명확히 안내.
 */

function getVarGroup(variables, ctx, groupId) {
  const groups = variables?.[ctx] || [];
  return groups.find((g) => g.id === groupId);
}

function getPositionVarNames(variables) {
  // 포지션 그룹은 exit 컨텍스트에만 존재한다.
  const group = getVarGroup(variables, 'exit', 'position');
  return (group?.items || []).map((it) => it.value);
}

export function humanizeValidationError(rawError, ctx, variables) {
  if (!rawError) return rawError;

  // "알 수 없는 변수입니다: PNL_PCT" 형태 매칭
  const m = rawError.match(/알 수 없는 변수입니다:\s*(\S+)/);
  if (m) {
    const varName = m[1];
    const positionVars = getPositionVarNames(variables);
    if (positionVars.includes(varName) && ctx === 'entry') {
      return `${varName}는 익절·손절 조건에서만 사용할 수 있습니다 (보유 중인 포지션 정보).`;
    }
  }

  return rawError;
}
