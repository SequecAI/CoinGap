"""
사용자가 작성한 조건 수식을 서버에서 안전하게 평가하기 위한 모듈.

coingap은 브라우저에서 new Function으로 수식을 평가하지만(사용자 본인 환경),
코인 릭 시커는 1년치 데이터 백테스트를 서버(Python)에서 돌리므로
신뢰할 수 없는 수식을 그대로 eval하면 코드 인젝션 위험이 있다.

따라서 ast로 파싱해 화이트리스트에 있는 노드/이름/함수만 허용하고,
통과한 식만 compile하여 평가한다.
"""
import ast
import math

# 수식에서 사용 가능한 함수 (coingap의 Math.* 와 동일 개념)
ALLOWED_FUNCS = {
    'abs': abs,
    'min': min,
    'max': max,
    'log': math.log,
    'sqrt': math.sqrt,
    'pow': pow,
}

# 허용하는 AST 노드 타입
_ALLOWED_NODES = (
    ast.Expression,
    ast.BoolOp, ast.And, ast.Or,
    ast.BinOp, ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow,
    ast.UnaryOp, ast.USub, ast.UAdd, ast.Not,
    ast.Compare, ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Eq, ast.NotEq,
    ast.Call, ast.Load,
    ast.Name, ast.Constant,
)


class ConditionError(ValueError):
    """수식이 비어있거나, 허용되지 않은 문법/이름/함수를 포함할 때."""


def _validate(node, allowed_names):
    if not isinstance(node, _ALLOWED_NODES):
        raise ConditionError(f"허용되지 않은 표현식 요소입니다: {type(node).__name__}")

    if isinstance(node, ast.Name):
        if node.id not in allowed_names and node.id not in ALLOWED_FUNCS:
            raise ConditionError(f"알 수 없는 변수입니다: {node.id}")

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in ALLOWED_FUNCS:
            raise ConditionError("허용되지 않은 함수 호출입니다")
        if node.keywords:
            raise ConditionError("함수에 키워드 인자는 사용할 수 없습니다")

    if isinstance(node, ast.Constant) and not isinstance(node.value, (int, float)):
        raise ConditionError("숫자 상수만 사용할 수 있습니다")

    for child in ast.iter_child_nodes(node):
        _validate(child, allowed_names)


def compile_condition(expr, allowed_names):
    """
    조건 수식 문자열을 검증·컴파일하여 (env: dict) -> 값 형태의 callable로 반환한다.
    allowed_names: 사용 가능한 변수명 집합 (예: {'PRICE', 'Z_SCORE', ...})
    유효하지 않으면 ConditionError를 던진다.
    """
    if not expr or not expr.strip():
        raise ConditionError("빈 수식입니다")

    try:
        tree = ast.parse(expr, mode='eval')
    except SyntaxError as e:
        raise ConditionError(f"문법 오류: {e.msg}")

    _validate(tree, set(allowed_names))
    code = compile(tree, '<condition>', 'eval')
    safe_globals = {'__builtins__': {}, **ALLOWED_FUNCS}

    def runner(env):
        return eval(code, safe_globals, env)

    return runner


def validate_condition(expr, allowed_names):
    """수식 유효성만 검사. 유효하면 None, 아니면 에러 메시지 문자열 반환."""
    try:
        compile_condition(expr, allowed_names)
        return None
    except ConditionError as e:
        return str(e)
