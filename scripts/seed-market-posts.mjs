/**
 * 기존 시황 데이터를 DB에 삽입하는 1회용 시드 스크립트
 * 사용법: Lambda 배포 후 → node scripts/seed-market-posts.mjs
 */

const API_BASE = 'https://oo78pteio2.execute-api.ap-northeast-2.amazonaws.com';

// 관리자 userId — DynamoDB Users 테이블에서 adminsequenceai@gmail.com의 userId를 넣어주세요
const ADMIN_USER_ID = 'ADMIN_USER_ID_HERE';

const posts = [
  {
    type: 'market_crypto',
    title: 'BTC-ALT 상대 강도 점검 — Statistics 지표 교차 확인 시점',
    content: `디지털 자산 시장은 비트코인과 주요 알트의 상대 강도가 종목별로 갈리는 흐름입니다. Dashboard 탭의 Gap Z-Score가 ±1.5를 넘는 종목과 그렇지 않은 종목 사이에 단기 변동성 차이가 뚜렷해지는 구간이고, 갭이 벌어진 종목일수록 평균 회귀 가능성이 통계적으로 커지는 경향이 관찰됩니다. Statistics 탭의 Signal Score를 기준으로 60+ 또는 40- 영역에 들어선 종목을 우선 모니터링하면 효율적입니다.

기술 지표 측면에서는 일봉 RSI 14일과 볼린저 %B의 일치 여부가 신뢰도의 핵심입니다. 두 지표가 동시에 한쪽 극단(과매수 또는 과매도)을 가리킬 때 의미 있는 가격 왜곡 시그널로 보고, 5분봉 체결 강도와의 추가 교차 검증으로 단기 진입·관망 판단을 보완하는 흐름이 안전합니다. Editor 탭에서 Z_SCORE와 RSI_14를 결합한 사용자 정의 수식을 30일 백테스트로 먼저 검증해 두는 것을 권장합니다.`,
  },
  {
    type: 'market_stock',
    title: '반도체주 강세 — KOSPI 7,000선 위 추가 상승',
    content: `오늘 KOSPI는 반도체 대형주(삼성전자·SK하이닉스) 강세를 발판으로 7,000선 위에서 추가 상승했습니다. 글로벌 AI·메모리 수요 회복 기대감이 외국인 순매수 흐름을 자극했고, Statistics 탭의 매매동향에서 외국인 누적 순매수가 강하게 유지되고 있는지 확인하는 것이 추세 지속 여부를 가늠하는 1차 지표가 됩니다. 반도체 외에도 2차전지 일부 종목이 동반 상승하며 지수에 기여한 모습입니다.

KOSDAQ은 KOSPI 대비 상승폭 차이를 보일 수 있어, KOSPI_RATE - STOCK_RATE 형태의 시장 대비 강도 지표로 종목별 상대 위치를 점검하는 것이 의미 있습니다. 단기 급등 종목은 Statistics 탭의 일봉 RSI 14일이 70+ 영역에 진입하고 볼린저 %B가 0.8 이상에서 머무르는 조합을 함께 보이는지 교차 확인하시고, Editor 탭의 사용자 정의 수식을 60거래일 백테스트로 검증해 둔 임계값과 비교하면 단기 과열 여부를 보다 객관적으로 판단할 수 있습니다.`,
  },
];

async function seed() {
  for (const post of posts) {
    console.log(`[SEED] ${post.type}: ${post.title}`);
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'create',
          type: post.type,
          userId: ADMIN_USER_ID,
          nickname: '관리자',
          email: 'adminsequenceai@gmail.com',
          title: post.title,
          content: post.content,
        }),
      });
      const data = await res.json();
      console.log(`  → ${res.status}`, data);
    } catch (err) {
      console.error(`  → 실패:`, err.message);
    }
  }
  console.log('\n[SEED] 완료!');
}

seed();
