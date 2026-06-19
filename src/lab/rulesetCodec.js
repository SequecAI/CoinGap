/**
 * 보관함 → 빌더 상태 복원용 헬퍼.
 *
 * 저장된 로직은 다음과 같은 형태로 DynamoDB에 들어간다:
 *   {
 *     userId, logicId, name, savedAt, updatedAt,
 *     symbol, days?, allocation_pct, fee_pct, slippage_pct,
 *     entry:      { groups: [["Z_SCORE <= -2", "DROP_3M <= -1"], ...] },
 *     takeProfit: { groups: [["RSI_14 >= 70"], ...] },
 *     stopLoss:   { groups: [["PNL_PCT <= -2"]] },
 *   }
 *
 * 빌더의 sections 상태는 [[{lhs, op, rhs}, ...], ...] 형태이므로
 * 문자열 → {lhs, op, rhs} 파싱이 필요. 2글자 연산자(<=, >=, ==, !=)부터
 * 매칭하지 않으면 한 글자 연산자(< / >)에 잘려나가므로 길이 내림차순 정렬.
 */

import { OPS, DEFAULT_PARAMS, DEFAULT_NAME, DEFAULT_SYMBOL, DEFAULT_DAYS } from './constants.js';

const OPS_SORTED = [...OPS].sort((a, b) => b.length - a.length);

export function parseExpr(s) {
  const str = (s || '').trim();
  if (!str) return { lhs: '', op: '<=', rhs: '' };

  // 공백 포함 매칭을 우선 (한국어/식별자 안에 < 가 들어가는 일은 없지만 안전)
  for (const op of OPS_SORTED) {
    const idx = str.lastIndexOf(` ${op} `);
    if (idx >= 0) {
      return {
        lhs: str.slice(0, idx).trim(),
        op,
        rhs: str.slice(idx + op.length + 2).trim(),
      };
    }
  }
  // 폴백: 공백 없는 경우
  for (const op of OPS_SORTED) {
    const idx = str.lastIndexOf(op);
    if (idx > 0) {
      return {
        lhs: str.slice(0, idx).trim(),
        op,
        rhs: str.slice(idx + op.length).trim(),
      };
    }
  }
  return { lhs: str, op: '<=', rhs: '' };
}

function groupsFromLogic(section) {
  const groups = section?.groups;
  if (!Array.isArray(groups) || groups.length === 0) {
    return [[{ lhs: '', op: '<=', rhs: '' }]];
  }
  return groups.map((g) =>
    Array.isArray(g) && g.length > 0
      ? g.map((expr) => parseExpr(expr))
      : [{ lhs: '', op: '<=', rhs: '' }]
  );
}

/**
 * 저장된 로직 → 빌더 상태 복원용 객체.
 *   { name, symbol, days, params, sections }
 */
export function logicToBuilderState(logic) {
  return {
    name: logic?.name || DEFAULT_NAME,
    symbol: logic?.symbol || DEFAULT_SYMBOL,
    days: Number(logic?.days) || DEFAULT_DAYS,
    params: {
      allocation_pct: Number(logic?.allocation_pct ?? DEFAULT_PARAMS.allocation_pct),
      fee_pct: Number(logic?.fee_pct ?? DEFAULT_PARAMS.fee_pct),
      slippage_pct: Number(logic?.slippage_pct ?? DEFAULT_PARAMS.slippage_pct),
    },
    sections: {
      entry: groupsFromLogic(logic?.entry),
      takeProfit: groupsFromLogic(logic?.takeProfit),
      stopLoss: groupsFromLogic(logic?.stopLoss),
    },
  };
}
