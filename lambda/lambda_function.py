"""
통합 자산 지표 모니터 — 커뮤니티 백엔드 (AWS Lambda + DynamoDB)

API Gateway 라우팅:
  POST /users       → 유저 정보 upsert (최초 로그인 시 생성/업데이트)
  POST /posts       → 자유게시판 글 또는 지표 데이터 저장
  GET  /posts       → ?type=free|indicator 리스트 조회
"""

import json
import uuid
import boto3
import decimal
from datetime import datetime, timezone

dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
users_table = dynamodb.Table("Users")
community_table = dynamodb.Table("MonitorCommunity")

# ── CORS 헤더 ──
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            if obj % 1 == 0:
                return int(obj)
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False, cls=DecimalEncoder),
    }

def remove_empty_strings(obj):
    if isinstance(obj, dict):
        return {k: remove_empty_strings(v) for k, v in obj.items() if v != ""}
    elif isinstance(obj, list):
        return [remove_empty_strings(v) for v in obj if v != ""]
    return obj


# ── POST /users ──
def handle_upsert_user(body):
    """Google 로그인 후 호출. userId 기준으로 유저 생성 또는 업데이트."""
    user_id = body.get("userId")
    if not user_id:
        return _response(400, {"error": "userId is required"})

    now = datetime.now(timezone.utc).isoformat()

    # 기존 유저 확인
    existing = users_table.get_item(Key={"userId": user_id}).get("Item")

    item = {
        "userId": user_id,
        "email": body.get("email", ""),
        "nickname": body.get("nickname", ""),
        "profileImage": body.get("profileImage", ""),
        "updatedAt": now,
    }

    if not existing:
        item["createdAt"] = now

    item = remove_empty_strings(item)
    users_table.put_item(Item={**(existing or {}), **item})

    return _response(200, {"message": "OK", "userId": user_id})


# ── POST /posts (Tunneling) ──
def handle_post_actions(body):
    action = body.get("action", "create")
    
    if action == "update":
        pk = body.get("PK")
        sk = body.get("SK")
        user_id = body.get("userId")
        if not pk or not sk or not user_id:
            return _response(400, {"error": "Missing PK, SK, or userId"})
        
        # 실제 운영에선 DB의 userId와 일치하는지 확인하는 로직이 필요할 수 있습니다.
        update_expr = "SET title = :t, content = :c"
        expr_attr_vals = {
            ":t": body.get("title", ""),
            ":c": body.get("content", "")
        }
        try:
            community_table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expr_attr_vals
            )
            return _response(200, {"message": "Updated"})
        except Exception as e:
            return _response(500, {"error": str(e)})

    if action == "delete":
        pk = body.get("PK")
        sk = body.get("SK")
        post_id = body.get("postId")
        if not pk or not sk:
            return _response(400, {"error": "Missing PK or SK"})
        try:
            # 글 삭제
            community_table.delete_item(Key={"PK": pk, "SK": sk})
            # 해당 글의 댓글들도 모두 삭제
            if post_id:
                comment_pk = f"COMMENT#{post_id}"
                comments_res = community_table.query(
                    KeyConditionExpression=boto3.dynamodb.conditions.Key("PK").eq(comment_pk)
                )
                with community_table.batch_writer() as batch:
                    for item in comments_res.get("Items", []):
                        batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
                        
            return _response(200, {"message": "Deleted"})
        except Exception as e:
            return _response(500, {"error": str(e)})

    # action == "create"
    post_type = body.get("type")  # "free" | "indicator"
    user_id = body.get("userId")
    title = body.get("title", "").strip()

    if post_type not in ("free", "indicator"):
        return _response(400, {"error": "type must be 'free' or 'indicator'"})
    if not user_id:
        return _response(400, {"error": "userId is required"})
    if not title:
        return _response(400, {"error": "title is required"})

    now = datetime.now(timezone.utc).isoformat()
    post_id = str(uuid.uuid4())

    item = {
        "PK": f"POST#{post_type}",
        "SK": f"TIMESTAMP#{now}#{post_id}",
        "postId": post_id,
        "type": post_type,
        "userId": user_id,
        "nickname": body.get("nickname", ""),
        "profileImage": body.get("profileImage", ""),
        "title": title,
        "content": body.get("content", ""),
        "likes": 0,
        "createdAt": now,
    }

    if post_type == "indicator":
        item["formula"] = body.get("formula", "")
        item["thresholds"] = body.get("thresholds", {})
        item["backtest"] = body.get("backtest") or {}
        item["indicatorMode"] = body.get("indicatorMode", "crypto")

    item = remove_empty_strings(item)
    community_table.put_item(Item=item)

    return _response(201, {"message": "Created", "postId": post_id})

# ── GET /posts?type=free|indicator ──
def handle_list_posts(params):
    """타입별 게시글 목록 조회 (최신순)."""
    post_type = (params or {}).get("type", "free")
    if post_type not in ("free", "indicator"):
        return _response(400, {"error": "type must be 'free' or 'indicator'"})

    result = community_table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("PK").eq(f"POST#{post_type}"),
        ScanIndexForward=False,  # 최신순
        Limit=50,
    )

    items = result.get("Items", [])
    
    return _response(200, {"posts": items})


# ── POST /comments (Tunneling via /posts) ──
def handle_comment_actions(body):
    action = body.get("action", "create_comment")
    
    if action == "update_comment":
        pk = body.get("PK")
        sk = body.get("SK")
        if not pk or not sk:
            return _response(400, {"error": "Missing PK or SK"})
        try:
            community_table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression="SET content = :c",
                ExpressionAttributeValues={":c": body.get("content", "")}
            )
            return _response(200, {"message": "Updated"})
        except Exception as e:
            return _response(500, {"error": str(e)})

    if action == "delete_comment":
        pk = body.get("PK")
        sk = body.get("SK")
        if not pk or not sk:
            return _response(400, {"error": "Missing PK or SK"})
        try:
            community_table.delete_item(Key={"PK": pk, "SK": sk})
            return _response(200, {"message": "Deleted"})
        except Exception as e:
            return _response(500, {"error": str(e)})

    # action == "create_comment"
    post_id = body.get("postId")
    user_id = body.get("userId")
    content = body.get("content", "").strip()

    if not post_id or not user_id or not content:
        return _response(400, {"error": "Missing required fields"})

    now = datetime.now(timezone.utc).isoformat()
    comment_id = str(uuid.uuid4())

    item = {
        "PK": f"COMMENT#{post_id}",
        "SK": f"TIMESTAMP#{now}#{comment_id}",
        "commentId": comment_id,
        "postId": post_id,
        "userId": user_id,
        "nickname": body.get("nickname", ""),
        "profileImage": body.get("profileImage", ""),
        "content": content,
        "createdAt": now,
    }

    item = remove_empty_strings(item)
    community_table.put_item(Item=item)

    return _response(201, {"message": "Created", "commentId": comment_id})


# ── GET /comments?postId=... ──
def handle_list_comments(params):
    post_id = (params or {}).get("postId")
    if not post_id:
        return _response(400, {"error": "postId is required"})

    result = community_table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("PK").eq(f"COMMENT#{post_id}"),
        ScanIndexForward=True,  # 과거순 정렬 (일반적인 댓글 순서)
        Limit=100,
    )

    items = result.get("Items", [])
    return _response(200, {"comments": items})


# ── 엔트리포인트 ──
def lambda_handler(event, context):
    """API Gateway 프록시 통합 핸들러 (HTTP API 호환 업데이트)."""
    
    # 1. HTTP 메서드 (GET, POST 등) 가져오기
    request_context = event.get("requestContext", {}).get("http", {})
    method = request_context.get("method") or event.get("httpMethod", "")
    
    # 2. 경로 (/posts, /users 등) 가져오기
    path = event.get("rawPath") or event.get("path", "")
    resource = path  # HTTP API는 resource를 따로 주지 않으므로 path를 그대로 씁니다.
    # 디버깅용 로깅
    print(f"[DEBUG] method={method}, resource={resource}, path={path}")

    # CORS preflight
    if method == "OPTIONS":
        return _response(200, {"message": "OK"})

    # resource 또는 path 기반으로 라우팅
    route = resource or path

    try:
        if method == "POST" and route.endswith("/users"):
            body = json.loads(event.get("body") or "{}", parse_float=decimal.Decimal)
            return handle_upsert_user(body)

        if method == "POST" and route.endswith("/posts"):
            body = json.loads(event.get("body") or "{}", parse_float=decimal.Decimal)
            action = body.get("action", "")
            if action in ("create_comment", "update_comment", "delete_comment"):
                return handle_comment_actions(body)
            return handle_post_actions(body)

        if method == "GET" and route.endswith("/posts"):
            params = event.get("queryStringParameters") or {}
            if params.get("type") == "comments":
                return handle_list_comments(params)
            return handle_list_posts(params)

        return _response(404, {"error": "Not Found", "debug_route": route, "debug_method": method})

    except Exception as e:
        print(f"[ERROR] {e}")
        return _response(500, {"error": str(e)})
