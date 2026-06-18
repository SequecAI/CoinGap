"""
사용자 정의 룰셋(진입/익절/손절)을 1년치 피처에 대해 순차 시뮬레이션하는 백테스트 엔진.

룰셋 스키마 (진입/익절/손절 공통):
  section = { "groups": [ [cond, cond, ...], [cond, ...] ] }
  - group 안의 조건들은 AND, group 끼리는 OR 로 결합된다.
  - 기본 1개 조건 = groups:[[cond]]. "+ 조건" = 그룹에 AND 추가, "+ 또는" = OR 그룹 추가.

  ruleset = {
    "name": str, "symbol": "KRW-SOL",
    "allocation_pct": 25, "fee_pct": 0.05, "slippage_pct": 0.02,
    "entry": section, "takeProfit": section, "stopLoss": section
  }

진입/익절/손절 모두 종가 체결을 가정한다(표준 전략 백테스트 방식).
한 번에 한 포지션만 보유한다(step9와 동일).
"""
from safe_eval import compile_condition
from features import ENTRY_VARS, EXIT_VARS


def _compile_section(section, allowed_names):
    """section의 모든 조건을 컴파일. groups -> [[runner,...], ...]"""
    groups = section.get('groups', []) if section else []
    compiled = []
    for group in groups:
        compiled.append([compile_condition(c, allowed_names) for c in group if c and c.strip()])
    # 빈 그룹 제거
    return [g for g in compiled if g]


def _section_true(compiled_groups, env):
    """OR(그룹) of AND(조건)."""
    if not compiled_groups:
        return False
    for group in compiled_groups:
        if all(bool(cond(env)) for cond in group):
            return True
    return False


def run_backtest(ruleset, features_df, initial_capital=1_000_000):
    fee = ruleset.get('fee_pct', 0.05) / 100.0
    slippage = ruleset.get('slippage_pct', 0.02) / 100.0
    alloc_pct = ruleset.get('allocation_pct', 25) / 100.0

    entry_c = _compile_section(ruleset.get('entry'), ENTRY_VARS)
    tp_c = _compile_section(ruleset.get('takeProfit'), EXIT_VARS)
    sl_c = _compile_section(ruleset.get('stopLoss'), EXIT_VARS)

    if not entry_c:
        raise ValueError("진입 조건이 비어 있습니다")

    # 컬럼을 배열로 추출 (행 단위 루프 가속)
    idx = features_df.index
    price = features_df['PRICE'].to_numpy()
    z = features_df['Z_SCORE'].to_numpy()
    ratio = features_df['RATIO'].to_numpy()
    drop3 = features_df['DROP_3M'].to_numpy()
    drop5 = features_df['DROP_5M'].to_numpy()
    rsi = features_df['RSI_14'].to_numpy()
    vol = features_df['VOLUME'].to_numpy()
    n = len(price)

    capital = initial_capital
    in_pos = False
    entry_price = 0.0
    entry_i = 0
    amount = 0.0
    capital_used = 0.0

    trades = []
    equity_curve = []
    env = {}

    for i in range(n):
        env['PRICE'] = price[i]
        env['Z_SCORE'] = z[i]
        env['RATIO'] = ratio[i]
        env['DROP_3M'] = drop3[i]
        env['DROP_5M'] = drop5[i]
        env['RSI_14'] = rsi[i]
        env['VOLUME'] = vol[i]

        if in_pos:
            env['ENTRY_PRICE'] = entry_price
            env['PNL_PCT'] = (price[i] / entry_price - 1.0) * 100.0
            env['HOLD_MIN'] = (idx[i] - idx[entry_i]).total_seconds() / 60.0

            if _section_true(tp_c, env) or _section_true(sl_c, env):
                reason = 'TakeProfit' if _section_true(tp_c, env) else 'StopLoss'
                exit_price = price[i] * (1 - slippage)
                net_return = amount * exit_price * (1 - fee)
                profit = net_return - capital_used
                capital += net_return
                trades.append({
                    'entry_time': idx[entry_i], 'exit_time': idx[i],
                    'entry_price': entry_price, 'exit_price': exit_price,
                    'duration_mins': env['HOLD_MIN'], 'reason': reason,
                    'profit': profit, 'profit_pct': profit / capital_used * 100.0,
                })
                in_pos = False
        else:
            if _section_true(entry_c, env):
                alloc = capital * alloc_pct
                if alloc > 5000:
                    entry_price = price[i] * (1 + slippage)
                    capital_used = alloc
                    amount = (alloc * (1 - fee)) / entry_price
                    capital -= alloc
                    entry_i = i
                    in_pos = True

        # 평가금 = 현금 + 미실현 포지션 가치
        equity = capital
        if in_pos:
            equity += amount * price[i] * (1 - slippage) * (1 - fee)
        equity_curve.append(equity)

    # 데이터 끝에서 강제 청산
    if in_pos:
        exit_price = price[-1] * (1 - slippage)
        net_return = amount * exit_price * (1 - fee)
        profit = net_return - capital_used
        capital += net_return
        trades.append({
            'entry_time': idx[entry_i], 'exit_time': idx[-1],
            'entry_price': entry_price, 'exit_price': exit_price,
            'duration_mins': (idx[-1] - idx[entry_i]).total_seconds() / 60.0,
            'reason': 'EndOfData',
            'profit': profit, 'profit_pct': profit / capital_used * 100.0,
        })

    return _metrics(ruleset, trades, equity_curve, idx, initial_capital, capital)


def _metrics(ruleset, trades, equity_curve, idx, initial_capital, final_capital):
    total = len(trades)
    wins = sum(1 for t in trades if t['profit'] > 0)
    gross_profit = sum(t['profit'] for t in trades if t['profit'] > 0)
    gross_loss = abs(sum(t['profit'] for t in trades if t['profit'] < 0))

    # MDD
    peak = -float('inf')
    mdd = 0.0
    for eq in equity_curve:
        if eq > peak:
            peak = eq
        if peak > 0:
            dd = eq / peak - 1.0
            if dd < mdd:
                mdd = dd

    return {
        'name': ruleset.get('name'),
        'symbol': ruleset.get('symbol'),
        'period_start': str(idx[0]),
        'period_end': str(idx[-1]),
        'initial_capital': initial_capital,
        'final_capital': round(final_capital, 0),
        'total_return_pct': round((final_capital / initial_capital - 1.0) * 100.0, 2),
        'mdd_pct': round(mdd * 100.0, 2),
        'total_trades': total,
        'win_rate_pct': round(wins / total * 100.0, 2) if total else 0.0,
        'profit_factor': round(gross_profit / gross_loss, 2) if gross_loss > 0 else None,
        'avg_duration_mins': round(sum(t['duration_mins'] for t in trades) / total, 1) if total else 0.0,
        'trades': trades,
    }
