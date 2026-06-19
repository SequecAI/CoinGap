/**
 * 페이퍼 트레이딩 엔진 (메인 프로세스 전용).
 *
 * 매분:
 *   1) Upbit에서 target/base 분봉 800개씩 가져옴 (200×4 슬라이딩 호출)
 *   2) 백엔드 POST /evaluate { ruleset, target_candles, base_candles, position }
 *   3) 응답의 action으로 페이퍼 잔고/포지션 시뮬레이션
 *   4) renderer로 'engine:tick' 이벤트 push
 *
 * 한 번에 한 로직만 실행 가능 (단일 슬롯).
 * 실거래/안전장치는 C6에서 추가. 지금은 cash 100만원 시드머니로 시뮬레이션만.
 */
const keystore = require('./keystore');
const upbit = require('./upbit');

const BACKEND_BASE = 'https://s8qnx3ch2k.execute-api.ap-northeast-2.amazonaws.com';
const UPBIT_BASE = 'https://api.upbit.com';
// 5초 주기 평가 — 진행 중 분봉의 trade_price 변화를 빠르게 반영.
// Upbit rate limit 분당 600회 대비, 일반 tick은 분당 24회(분봉 2종)로 여유 만빵.
const TICK_MS = 5 * 1000;
const REQUIRED_CANDLES = 800;     // 백엔드 evaluate가 features 계산에 730 이상 권장
const CANDLES_PER_CALL = 200;     // Upbit 단일 호출 최대치
const FETCH_GAP_MS = 120;         // Upbit rate-limit 마진
const INITIAL_CASH = 1_000_000;   // 모의투자 시드머니
const FILL_DELAY_MS = 700;        // 시장가 주문 후 체결 확인 전 대기 시간
// 지정가 주문 발주 후 타임아웃까지 우직하게 줄서기. step9와 동일한 60초.
// 이 시간 동안은 매 tick마다 체결 상태만 확인하고 신호 재평가는 하지 않음.
const LIMIT_TIMEOUT_MS = 60 * 1000;
const MAX_CONSEC_ORDER_ERRORS = 3; // 연속 주문 실패 시 엔진 자동 정지

class EngineService {
  constructor() {
    this.timer = null;
    this.state = 'idle'; // idle | running | stopped
    this.context = null;
    this.mainWindow = null;
    this.tickInFlight = false;
    this.nextTickAt = null;  // 다음 tick 예정 시각 (ms epoch). renderer 카운트다운용.
    this.lastTickAt = null;
    // KST 하루 단위 누적 손실. 세션과 분리 — start/stop을 반복해도 KST 자정에만 리셋된다.
    this.dailyLoss = 0;
    this.dailyLossDate = this.todayKst();
  }

  setWindow(win) { this.mainWindow = win; }

  emit(event, payload) {
    if (this.mainWindow?.webContents && !this.mainWindow.isDestroyed()) {
      try { this.mainWindow.webContents.send(`engine:${event}`, payload); } catch {}
    }
  }

  async start(logic, options = {}) {
    if (this.state === 'running') {
      throw new Error('이미 실행 중인 엔진이 있습니다. 먼저 중지하세요.');
    }
    if (!logic?.symbol) {
      throw new Error('로직에 symbol이 없습니다.');
    }
    const mode = options.mode === 'live' ? 'live' : 'paper';
    const limits = options.limits || null;
    if (mode === 'live' && !limits) {
      throw new Error('실거래 모드에는 안전장치 설정(limits)이 필요합니다.');
    }
    if (mode === 'live' && !keystore.loadKeysMasked().exists) {
      throw new Error('실거래 모드를 시작하려면 먼저 업비트 API 키를 저장하세요.');
    }
    this.state = 'running';
    this.context = {
      mode,
      limits,
      logic,
      symbol: logic.symbol,
      baseSymbol: 'KRW-BTC',
      startedAt: new Date().toISOString(),
      initialCash: mode === 'paper' ? INITIAL_CASH : 0,  // live는 syncBalance에서 채움
      cash: mode === 'paper' ? INITIAL_CASH : 0,
      position: null,
      lastEval: null,
      lastError: null,
      trades: [],
      ticks: 0,
      candleCache: { target: [], base: [] },
      // 실거래 안전장치 상태 (dailyLoss는 인스턴스 필드, 여기 둘 필요 없음)
      consecutiveOrderErrors: 0,
      tradingBlocked: false,  // 일일 손실 한도 초과 등으로 신규 진입 차단
      blockReason: null,
      // 진행 중인 지정가 주문. 살아있는 동안 새 신호 평가를 멈추고 체결만 추적.
      // { uuid, action, side, placedAt, rank, timeoutMs }
      pendingOrder: null,
    };
    // 시작 시점에 KST 자정 경계 한 번 체크 (날짜가 바뀌었으면 누적 손실 리셋)
    this.maybeResetDailyLoss();

    if (mode === 'live') {
      // 시작 시점 잔고를 initialCash로 기록 (이후 returnPct 산정 기준)
      try {
        await this.syncBalance({ setInitial: true });
      } catch (e) {
        this.state = 'idle';
        this.context = null;
        throw new Error(`잔고 동기화 실패: ${e.message}`);
      }
    }

    this.emit('started', this.publicContext());
    this.scheduleNext(0); // 즉시 1회
  }

  scheduleNext(delay = TICK_MS) {
    if (this.state !== 'running') return;
    if (this.timer) clearTimeout(this.timer);
    this.nextTickAt = Date.now() + delay;
    this.timer = setTimeout(() => this.tick(), delay);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.nextTickAt = null;
    this.state = 'stopped';
    this.emit('stopped', this.publicContext());
  }

  status() {
    return { state: this.state, context: this.publicContext() };
  }

  async fetchInitial(market) {
    // 초기 800개 채우기. 200개씩 to= 슬라이딩으로 4회 순차 호출.
    const all = [];
    let to = null;
    const calls = Math.ceil(REQUIRED_CANDLES / CANDLES_PER_CALL);
    for (let i = 0; i < calls; i++) {
      const url = new URL(`${UPBIT_BASE}/v1/candles/minutes/1`);
      url.searchParams.set('market', market);
      url.searchParams.set('count', String(CANDLES_PER_CALL));
      if (to) url.searchParams.set('to', to);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Upbit ${market} 응답 ${res.status}`);
      const arr = await res.json();
      if (!Array.isArray(arr) || arr.length === 0) break;
      all.push(...arr);
      to = arr[arr.length - 1].candle_date_time_utc;
      if (i < calls - 1) await new Promise((r) => setTimeout(r, FETCH_GAP_MS));
    }
    return all;
  }

  async fetchLatest(market) {
    // 매 tick 갱신용: 가장 최근 봉 1개만. 가격 실시간 반영용 + 새 분봉 감지용.
    const url = `${UPBIT_BASE}/v1/candles/minutes/1?market=${market}&count=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Upbit ${market} 응답 ${res.status}`);
    const arr = await res.json();
    return arr?.[0] || null;
  }

  /**
   * 캐시 갱신: latest의 timestamp가 cache 마지막과 같으면 마지막 봉만 교체 (현재 진행 중 봉),
   * 다르면 push + 가장 오래된 봉 pop (slide). Upbit는 최신→과거 순으로 배열을 주므로
   * cache[0]이 가장 최신이라는 가정으로 처리.
   */
  updateCache(cache, latest) {
    if (!latest || !cache.length) return;
    const top = cache[0];
    if (top.candle_date_time_utc === latest.candle_date_time_utc) {
      cache[0] = latest; // 현재 봉 갱신
    } else {
      cache.unshift(latest);
      if (cache.length > REQUIRED_CANDLES) cache.pop();
    }
  }

  async tick() {
    if (this.state !== 'running' || this.tickInFlight) {
      this.scheduleNext();
      return;
    }
    this.tickInFlight = true;
    const ctx = this.context;
    this.lastTickAt = Date.now();
    try {
      ctx.ticks += 1;

      // 진행 중인 지정가 주문이 있으면 그것만 처리하고 신호 재평가는 건너뜀 (step9 패턴)
      if (ctx.pendingOrder) {
        await this.processPendingOrder();
        return; // finally에서 scheduleNext + emit 처리
      }

      // 첫 tick: 800개 초기화. 이후: latest 1개만 받아 캐시 슬라이딩.
      // 순차 호출(병렬 X) + FETCH_GAP_MS 간격으로 Upbit rate limit 회피.
      if (ctx.candleCache.target.length === 0) {
        ctx.candleCache.target = await this.fetchInitial(ctx.symbol);
        await new Promise((r) => setTimeout(r, FETCH_GAP_MS));
        ctx.candleCache.base = await this.fetchInitial(ctx.baseSymbol);
      } else {
        const tLatest = await this.fetchLatest(ctx.symbol);
        await new Promise((r) => setTimeout(r, FETCH_GAP_MS));
        const bLatest = await this.fetchLatest(ctx.baseSymbol);
        this.updateCache(ctx.candleCache.target, tLatest);
        this.updateCache(ctx.candleCache.base, bLatest);
      }

      const positionPayload = ctx.position
        ? {
            entry_time: ctx.position.entryTime,
            entry_price: ctx.position.entryPrice,
            fee_pct: ctx.logic.fee_pct ?? 0.05,
            slippage_pct: ctx.logic.slippage_pct ?? 0.02,
          }
        : null;

      const res = await fetch(`${BACKEND_BASE}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleset: ctx.logic,
          target_candles: ctx.candleCache.target,
          base_candles: ctx.candleCache.base,
          position: positionPayload,
        }),
      });
      const evalResult = await res.json();
      if (!evalResult.ok) {
        ctx.lastError = evalResult.error || `evaluate failed (HTTP ${res.status})`;
      } else {
        ctx.lastError = null;
        ctx.lastEval = {
          timestamp: evalResult.timestamp,
          market: evalResult.market,
          position: evalResult.position,
          action: evalResult.action,
          signals: evalResult.signals,
        };
        await this.applyAction(evalResult);
      }
    } catch (e) {
      ctx.lastError = e.message || String(e);
    } finally {
      this.tickInFlight = false;
      // emit 전에 scheduleNext 먼저 호출 — publicContext의 nextTickAt이 미래 시각이 되도록.
      this.scheduleNext();
      this.emit('tick', this.publicContext());
    }
  }

  /**
   * 원격 제어 명령 폴링 — 운영자 user가 외부에서 호출한 명령을 처리한다.
   * 'stop' → engine.stop()
   * { action: 'start', logicId, ... } → 보관함에서 logic 찾아 모의투자로 시작
   *
   * processControlCommand는 외부(useRunSync 또는 IPC)에서 호출한다.
   * 현재는 EngineService에 userId를 보관하지 않으므로 renderer가 폴링·전달하는 모델.
   */
  async handleRemoteCommand(command) {
    if (!command) return { ok: true };
    if (command === 'stop' || command?.action === 'stop') {
      if (this.state === 'running') {
        this.stop();
        return { ok: true, applied: 'stop' };
      }
      return { ok: true, applied: 'noop-already-stopped' };
    }
    if (command?.action === 'start') {
      if (this.state === 'running') {
        return { ok: false, error: '이미 다른 로직이 실행 중입니다.' };
      }
      const logic = command.logic;
      if (!logic?.symbol) {
        return { ok: false, error: '로직 정보가 부족합니다.' };
      }
      try {
        await this.start(logic, { mode: 'paper', limits: null });
        return { ok: true, applied: 'start' };
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    }
    return { ok: false, error: '알 수 없는 명령입니다.' };
  }

  async applyAction(evalResult) {
    const ctx = this.context;
    const { action, market } = evalResult;
    if (!market?.PRICE) return;
    if (ctx.mode === 'live') {
      await this.applyLiveAction(evalResult);
    } else {
      this.applyPaperAction(evalResult);
    }
  }

  applyPaperAction(evalResult) {
    const ctx = this.context;
    const { action, market, timestamp } = evalResult;
    const price = market.PRICE;

    const fee = (ctx.logic.fee_pct ?? 0.05) / 100;
    const slip = (ctx.logic.slippage_pct ?? 0.02) / 100;
    const alloc = (ctx.logic.allocation_pct ?? 25) / 100;

    if (action === 'ENTER' && !ctx.position) {
      const investKrw = ctx.cash * alloc;
      if (investKrw <= 0) return;
      const execPrice = price * (1 + slip);
      const qty = investKrw / execPrice;
      const fees = investKrw * fee;
      ctx.cash -= (investKrw + fees);
      ctx.position = {
        entryTime: timestamp, entryPrice: price, execEntryPrice: execPrice,
        qty, investKrw, entryFees: fees,
      };
      const trade = {
        time: timestamp, action: 'ENTER', price, execPrice, qty,
        krw: investKrw, fees,
      };
      ctx.trades.push(trade);
      this.emitTrade(trade);
    } else if ((action === 'EXIT_TP' || action === 'EXIT_SL') && ctx.position) {
      const execPrice = price * (1 - slip);
      const proceeds = ctx.position.qty * execPrice;
      const fees = proceeds * fee;
      ctx.cash += (proceeds - fees);
      const pnlKrw = (proceeds - fees) - ctx.position.investKrw - ctx.position.entryFees;
      const pnlPct = (pnlKrw / ctx.position.investKrw) * 100;
      const trade = {
        time: timestamp, action, price, execPrice,
        qty: ctx.position.qty, krw: proceeds, fees, pnlKrw, pnlPct,
        reason: action === 'EXIT_TP' ? 'TakeProfit' : 'StopLoss',
      };
      ctx.trades.push(trade);
      this.emitTrade(trade);
      ctx.position = null;
    }
  }

  /**
   * 거래 한 건을 renderer로 push — renderer가 백엔드 POST /trades로 영구 저장한다.
   * mode/symbol/logicName/logicId 메타데이터를 함께 실어 보낸다 (기간 통계용).
   */
  emitTrade(trade) {
    const ctx = this.context;
    if (!ctx) return;
    this.emit('trade', {
      ...trade,
      mode: ctx.mode,
      symbol: ctx.symbol,
      logicId: ctx.logic.logicId || null,
      logicName: ctx.logic.name || '',
    });
  }

  /**
   * 실거래 분기. Upbit 시장가 주문을 직접 발행한다.
   * 안전장치:
   *   1) 매일 자정(KST)에 dailyLoss 리셋. 한도 초과 시 신규 진입 차단.
   *   2) 매수 금액 = min(cash * alloc, limits.max_exposure_krw). limits.min_order_krw 미만이면 skip.
   *   3) 주문 실패 N회 연속 시 엔진 자동 정지.
   */
  async applyLiveAction(evalResult) {
    const ctx = this.context;
    const { action, market, timestamp } = evalResult;
    const price = market.PRICE;
    const limits = ctx.limits;
    const alloc = (ctx.logic.allocation_pct ?? 25) / 100;

    this.maybeResetDailyLoss();

    if (action === 'ENTER' && !ctx.position) {
      if (limits.daily_loss_limit_krw > 0 && this.dailyLoss >= limits.daily_loss_limit_krw) {
        ctx.tradingBlocked = true;
        ctx.blockReason = `일일 손실 한도 도달 (${Math.round(this.dailyLoss).toLocaleString('ko-KR')}원). 신규 진입 차단.`;
        ctx.lastError = ctx.blockReason;
        return;
      }
      let investKrw = Math.floor(ctx.cash * alloc);
      if (investKrw > limits.max_exposure_krw) investKrw = limits.max_exposure_krw;
      if (investKrw < limits.min_order_krw) {
        ctx.lastError = `매수 금액(${investKrw.toLocaleString('ko-KR')}원)이 최소 주문(${limits.min_order_krw.toLocaleString('ko-KR')}원) 미만. 진입 보류.`;
        return;
      }

      try {
        const keys = keystore.loadKeysPlain();
        if (!keys) throw new Error('API 키가 저장되어 있지 않습니다.');

        const strategy = ctx.logic.entry_order?.strategy || 'market';

        if (strategy === 'limit_best') {
          // step9 패턴: 매수 N호가에 지정가 발주 → pendingOrder에 보관 후 즉시 return.
          // 이후 tick들에서 processPendingOrder가 체결/타임아웃 처리.
          const rank = Math.min(3, Math.max(1, Number(ctx.logic.entry_order?.orderbook_rank) || 1));
          const ob = await upbit.getOrderbook(ctx.symbol);
          const bidPrice = ob?.orderbook_units?.[rank - 1]?.bid_price;
          if (!bidPrice) throw new Error('호가창을 가져올 수 없습니다.');
          const volume = (investKrw / bidPrice).toFixed(8);
          const order = await upbit.placeOrder(keys.access, keys.secret, {
            market: ctx.symbol,
            side: 'bid',
            ord_type: 'limit',
            price: String(bidPrice),
            volume,
          });
          const timeoutSec = Number(ctx.logic.entry_order?.timeout_sec) || 60;
          ctx.pendingOrder = {
            uuid: order.uuid,
            action: 'ENTER',
            side: 'bid',
            placedAt: new Date().toISOString(),
            rank,
            intendedPrice: bidPrice,
            intendedQty: parseFloat(volume),
            intendedKrw: investKrw,
            timeoutMs: Math.max(1000, timeoutSec * 1000),
            fallbackToMarket: false, // 매수는 폴백 X — 안 잡히면 그냥 안 들어감
          };
          ctx.lastError = null;
          return;
        }

        // 시장가 매수 (기존 즉시 체결 흐름)
        const order = await upbit.placeOrder(keys.access, keys.secret, {
          market: ctx.symbol,
          side: 'bid',
          ord_type: 'price',
          price: String(investKrw),
        });
        await new Promise((r) => setTimeout(r, FILL_DELAY_MS));
        const filled = await upbit.getOrder(keys.access, keys.secret, order.uuid);
        const executedVolume = parseFloat(filled.executed_volume || '0');
        const paidFees = parseFloat(filled.paid_fee || '0');
        if (executedVolume <= 0) {
          ctx.lastError = '시장가 매수 미체결.';
          return;
        }
        const avgPrice = (investKrw - paidFees) / executedVolume;
        ctx.position = {
          entryTime: timestamp,
          entryPrice: avgPrice,
          execEntryPrice: avgPrice,
          qty: executedVolume,
          investKrw,
          entryFees: paidFees,
          orderUuid: order.uuid,
        };
        const trade = {
          time: timestamp, action: 'ENTER', price: avgPrice, execPrice: avgPrice,
          qty: executedVolume, krw: investKrw, fees: paidFees,
          orderUuid: order.uuid, strategy: 'market',
        };
        ctx.trades.push(trade);
        this.emitTrade(trade);
        ctx.consecutiveOrderErrors = 0;
        await this.syncBalance();
      } catch (e) {
        this._handleOrderError('매수', e);
      }
    } else if ((action === 'EXIT_TP' || action === 'EXIT_SL') && ctx.position) {
      try {
        const keys = keystore.loadKeysPlain();
        if (!keys) throw new Error('API 키가 저장되어 있지 않습니다.');

        // 익절·손절 각자 strategy 사용
        const exitOrderCfg = action === 'EXIT_TP'
          ? ctx.logic.takeProfit_order
          : ctx.logic.stopLoss_order;
        const strategy = exitOrderCfg?.strategy || 'market';

        if (strategy === 'limit_best') {
          // 매도 N호가에 지정가 발주 → pendingOrder에 보관 후 즉시 return.
          const rank = Math.min(3, Math.max(1, Number(exitOrderCfg?.orderbook_rank) || 1));
          const ob = await upbit.getOrderbook(ctx.symbol);
          const askPrice = ob?.orderbook_units?.[rank - 1]?.ask_price;
          if (!askPrice) throw new Error('호가창을 가져올 수 없습니다.');
          const order = await upbit.placeOrder(keys.access, keys.secret, {
            market: ctx.symbol,
            side: 'ask',
            ord_type: 'limit',
            price: String(askPrice),
            volume: String(ctx.position.qty),
          });
          const timeoutSec = Number(exitOrderCfg?.timeout_sec)
            || (action === 'EXIT_SL' ? 4 : 60);
          ctx.pendingOrder = {
            uuid: order.uuid,
            action,
            side: 'ask',
            placedAt: new Date().toISOString(),
            rank,
            intendedPrice: askPrice,
            intendedQty: ctx.position.qty,
            timeoutMs: Math.max(1000, timeoutSec * 1000),
            fallbackToMarket: true, // 매도는 타임아웃 시 시장가로 강제 청산
          };
          ctx.lastError = null;
          return;
        }

        // 시장가 매도 (기존 즉시 체결 흐름)
        const order = await upbit.placeOrder(keys.access, keys.secret, {
          market: ctx.symbol,
          side: 'ask',
          ord_type: 'market',
          volume: String(ctx.position.qty),
        });
        await new Promise((r) => setTimeout(r, FILL_DELAY_MS));
        const filled = await upbit.getOrder(keys.access, keys.secret, order.uuid);

        const executedVolume = parseFloat(filled.executed_volume || '0');
        if (executedVolume <= 0) {
          ctx.lastError = '시장가 매도 미체결.';
          return;
        }
        const orderUuid = order.uuid;

        // 체결 trades 배열의 funds 합이 매도 대금
        const trades = filled.trades || [];
        const proceedsKrw = trades.reduce((s, t) => s + parseFloat(t.funds || '0'), 0);
        const fees = parseFloat(filled.paid_fee || '0');
        const netProceeds = proceedsKrw - fees;
        const execPrice = executedVolume > 0 ? proceedsKrw / executedVolume : price;
        // 부분 체결: 보유 수량 중 executedVolume만큼만 청산됨. 손익도 비례로 계산.
        const partialEntryKrw = ctx.position.investKrw * (executedVolume / ctx.position.qty);
        const partialEntryFees = ctx.position.entryFees * (executedVolume / ctx.position.qty);
        const pnlKrw = netProceeds - partialEntryKrw - partialEntryFees;
        const pnlPct = partialEntryKrw > 0 ? (pnlKrw / partialEntryKrw) * 100 : 0;

        if (pnlKrw < 0) this.dailyLoss += Math.abs(pnlKrw);
        if (limits.daily_loss_limit_krw > 0 && this.dailyLoss >= limits.daily_loss_limit_krw) {
          ctx.tradingBlocked = true;
          ctx.blockReason = `일일 손실 한도 도달 (${Math.round(this.dailyLoss).toLocaleString('ko-KR')}원). 신규 진입 차단.`;
        }

        const trade = {
          time: timestamp, action, price: execPrice, execPrice,
          qty: executedVolume, krw: proceedsKrw, fees, pnlKrw, pnlPct,
          reason: action === 'EXIT_TP' ? 'TakeProfit' : 'StopLoss',
          orderUuid, strategy: 'market',
        };
        ctx.trades.push(trade);
        this.emitTrade(trade);

        // 전체 청산이면 position null. 부분 청산이면 잔여 수량/투입금 갱신.
        if (executedVolume >= ctx.position.qty - 1e-8) {
          ctx.position = null;
        } else {
          ctx.position = {
            ...ctx.position,
            qty: ctx.position.qty - executedVolume,
            investKrw: ctx.position.investKrw - partialEntryKrw,
            entryFees: ctx.position.entryFees - partialEntryFees,
          };
        }
        ctx.consecutiveOrderErrors = 0;
        await this.syncBalance();
      } catch (e) {
        this._handleOrderError('매도', e);
      }
    }
  }

  /**
   * 진행 중인 지정가 주문의 체결 상태를 확인하고 처리한다.
   * - 'done' / 'cancel' (부분 체결 포함) → 체결분을 position에 반영하고 pending 해제
   * - 'wait' + 타임아웃 미만 → 그대로 유지
   * - 'wait' + 타임아웃 초과 → 강제 취소 + 부분 체결분 반영
   */
  async processPendingOrder() {
    const ctx = this.context;
    const po = ctx.pendingOrder;
    const keys = keystore.loadKeysPlain();
    if (!keys) {
      ctx.lastError = '주문 추적 실패: API 키 없음';
      ctx.pendingOrder = null;
      return;
    }
    let status;
    try {
      status = await upbit.getOrder(keys.access, keys.secret, po.uuid);
    } catch (e) {
      ctx.lastError = `주문 조회 실패: ${e.message || e}`;
      return; // 다음 tick에서 다시 시도
    }
    const state = status?.state;
    const executedVolume = parseFloat(status?.executed_volume || '0');
    const elapsed = Date.now() - new Date(po.placedAt).getTime();

    if (state === 'done' || state === 'cancel') {
      if (executedVolume > 0) this._applyFill(po, status);
      ctx.pendingOrder = null;
      return;
    }

    // 미체결 ('wait') — 타임아웃 검사
    if (elapsed >= po.timeoutMs) {
      try {
        await upbit.cancelOrder(keys.access, keys.secret, po.uuid);
      } catch { /* 이미 체결됐을 수도 — 무시 */ }
      // 취소 직후 다시 조회 (부분 체결 잡기)
      let remainingQty = po.intendedQty;
      try {
        const after = await upbit.getOrder(keys.access, keys.secret, po.uuid);
        const afterVol = parseFloat(after?.executed_volume || '0');
        if (afterVol > 0) {
          this._applyFill(po, after);
          remainingQty = Math.max(0, po.intendedQty - afterVol);
        }
      } catch {}
      ctx.pendingOrder = null;

      // 매도(익절·손절) 잔여분은 시장가로 강제 청산 — 손실 방치 방지
      if (po.fallbackToMarket && po.side === 'ask' && remainingQty > 1e-8 && ctx.position) {
        await this._fallbackMarketSell(po.action, remainingQty);
      } else {
        ctx.lastError = `${po.action === 'ENTER' ? '진입' : '청산'} 타임아웃 (${Math.round(po.timeoutMs / 1000)}초). 미체결분 취소.`;
      }
    }
    // 그 외: 그대로 두고 다음 tick에서 다시 확인
  }

  /** 매도 지정가 타임아웃 시 잔여 수량을 시장가로 강제 청산. */
  async _fallbackMarketSell(action, volume) {
    const ctx = this.context;
    const keys = keystore.loadKeysPlain();
    if (!keys || !ctx.position) return;
    try {
      const order = await upbit.placeOrder(keys.access, keys.secret, {
        market: ctx.symbol,
        side: 'ask',
        ord_type: 'market',
        volume: String(volume),
      });
      await new Promise((r) => setTimeout(r, FILL_DELAY_MS));
      const filled = await upbit.getOrder(keys.access, keys.secret, order.uuid);
      const executedVolume = parseFloat(filled.executed_volume || '0');
      if (executedVolume <= 0) {
        ctx.lastError = '시장가 폴백 매도 미체결.';
        return;
      }
      const trades = filled.trades || [];
      const proceedsKrw = trades.reduce((s, t) => s + parseFloat(t.funds || '0'), 0);
      const fees = parseFloat(filled.paid_fee || '0');
      const netProceeds = proceedsKrw - fees;
      const execPrice = proceedsKrw / executedVolume;
      const positionQty = ctx.position.qty;
      const partialEntryKrw = ctx.position.investKrw * (executedVolume / positionQty);
      const partialEntryFees = ctx.position.entryFees * (executedVolume / positionQty);
      const pnlKrw = netProceeds - partialEntryKrw - partialEntryFees;
      const pnlPct = partialEntryKrw > 0 ? (pnlKrw / partialEntryKrw) * 100 : 0;
      if (pnlKrw < 0) this.dailyLoss += Math.abs(pnlKrw);
      const limits = ctx.limits;
      if (limits && limits.daily_loss_limit_krw > 0 && this.dailyLoss >= limits.daily_loss_limit_krw) {
        ctx.tradingBlocked = true;
        ctx.blockReason = `일일 손실 한도 도달 (${Math.round(this.dailyLoss).toLocaleString('ko-KR')}원). 신규 진입 차단.`;
      }
      const ts = new Date().toISOString();
      const trade = {
        time: ts, action, price: execPrice, execPrice,
        qty: executedVolume, krw: proceedsKrw, fees, pnlKrw, pnlPct,
        reason: action === 'EXIT_TP' ? 'TakeProfit' : 'StopLoss',
        orderUuid: order.uuid, strategy: 'market_fallback',
      };
      ctx.trades.push(trade);
      this.emitTrade(trade);
      ctx.lastError = `${action === 'EXIT_TP' ? '익절' : '손절'} 지정가 타임아웃 → 시장가 폴백 청산.`;
      if (executedVolume >= ctx.position.qty - 1e-8) {
        ctx.position = null;
      } else {
        ctx.position = {
          ...ctx.position,
          qty: ctx.position.qty - executedVolume,
          investKrw: ctx.position.investKrw - partialEntryKrw,
          entryFees: ctx.position.entryFees - partialEntryFees,
        };
      }
      await this.syncBalance();
    } catch (e) {
      this._handleOrderError('시장가 폴백 매도', e);
    }
  }

  /**
   * 체결 결과(status)로부터 ENTER/EXIT_TP/EXIT_SL을 마무리한다.
   * pending(po)의 action에 따라 분기.
   */
  _applyFill(po, status) {
    const ctx = this.context;
    const executedVolume = parseFloat(status.executed_volume || '0');
    const paidFees = parseFloat(status.paid_fee || '0');
    const orderUuid = po.uuid;
    const ts = new Date().toISOString();

    if (po.action === 'ENTER') {
      // 매수 체결: 실 사용된 KRW = trades.funds 합 또는 (executed × price)
      const trades = status.trades || [];
      const usedKrw = trades.length > 0
        ? trades.reduce((s, t) => s + parseFloat(t.funds || '0'), 0)
        : executedVolume * parseFloat(status.price || '0');
      const avgPrice = executedVolume > 0 ? usedKrw / executedVolume : Number(po.intendedPrice) || 0;

      ctx.position = {
        entryTime: ts,
        entryPrice: avgPrice,
        execEntryPrice: avgPrice,
        qty: executedVolume,
        investKrw: usedKrw,
        entryFees: paidFees,
        orderUuid,
      };
      const trade = {
        time: ts, action: 'ENTER', price: avgPrice, execPrice: avgPrice,
        qty: executedVolume, krw: usedKrw, fees: paidFees,
        orderUuid, strategy: 'limit_best',
      };
      ctx.trades.push(trade);
      this.emitTrade(trade);
      ctx.consecutiveOrderErrors = 0;
      this.syncBalance().catch(() => {});
    } else if (po.action === 'EXIT_TP' || po.action === 'EXIT_SL') {
      // 매도 체결
      const trades = status.trades || [];
      const proceedsKrw = trades.reduce((s, t) => s + parseFloat(t.funds || '0'), 0);
      const netProceeds = proceedsKrw - paidFees;
      const execPrice = executedVolume > 0 ? proceedsKrw / executedVolume : (ctx.position?.entryPrice || 0);
      const positionQty = ctx.position?.qty || executedVolume;
      const partialEntryKrw = (ctx.position?.investKrw || 0) * (executedVolume / positionQty);
      const partialEntryFees = (ctx.position?.entryFees || 0) * (executedVolume / positionQty);
      const pnlKrw = netProceeds - partialEntryKrw - partialEntryFees;
      const pnlPct = partialEntryKrw > 0 ? (pnlKrw / partialEntryKrw) * 100 : 0;
      if (pnlKrw < 0) this.dailyLoss += Math.abs(pnlKrw);
      const limits = ctx.limits;
      if (limits && limits.daily_loss_limit_krw > 0 && this.dailyLoss >= limits.daily_loss_limit_krw) {
        ctx.tradingBlocked = true;
        ctx.blockReason = `일일 손실 한도 도달 (${Math.round(this.dailyLoss).toLocaleString('ko-KR')}원). 신규 진입 차단.`;
      }
      const trade = {
        time: ts, action: po.action, price: execPrice, execPrice,
        qty: executedVolume, krw: proceedsKrw, fees: paidFees, pnlKrw, pnlPct,
        reason: po.action === 'EXIT_TP' ? 'TakeProfit' : 'StopLoss',
        orderUuid, strategy: 'limit_best',
      };
      ctx.trades.push(trade);
      this.emitTrade(trade);
      if (ctx.position && executedVolume >= ctx.position.qty - 1e-8) {
        ctx.position = null;
      } else if (ctx.position) {
        ctx.position = {
          ...ctx.position,
          qty: ctx.position.qty - executedVolume,
          investKrw: ctx.position.investKrw - partialEntryKrw,
          entryFees: ctx.position.entryFees - partialEntryFees,
        };
      }
      ctx.consecutiveOrderErrors = 0;
      this.syncBalance().catch(() => {});
    }
  }

  _handleOrderError(label, err) {
    const ctx = this.context;
    const msg = err?.message || String(err);
    ctx.lastError = `${label} 주문 실패: ${msg}`;
    ctx.consecutiveOrderErrors = (ctx.consecutiveOrderErrors || 0) + 1;
    if (ctx.consecutiveOrderErrors >= MAX_CONSEC_ORDER_ERRORS) {
      ctx.lastError += ` (${MAX_CONSEC_ORDER_ERRORS}회 연속 실패 — 엔진을 자동 정지합니다)`;
      // stop()은 emit('stopped')을 부르고 state를 바꿈. tick의 finally 흐름은 그대로 진행됨.
      this.stop();
    }
  }

  /** 업비트 /v1/accounts에서 현재 KRW 잔고를 받아 ctx.cash에 반영. */
  async syncBalance({ setInitial = false } = {}) {
    const ctx = this.context;
    const keys = keystore.loadKeysPlain();
    if (!keys) throw new Error('API 키 없음');
    const accounts = await upbit.getAccounts(keys.access, keys.secret);
    const krw = accounts.find((a) => a.currency === 'KRW');
    const krwTotal = parseFloat(krw?.balance || '0') + parseFloat(krw?.locked || '0');
    ctx.cash = krwTotal;
    if (setInitial) ctx.initialCash = krwTotal;
  }

  /** KST 자정 경계 도달 시 dailyLoss 리셋 + 차단 해제. start/stop과 무관하게 날짜로만 판단. */
  maybeResetDailyLoss() {
    const today = this.todayKst();
    if (this.dailyLossDate !== today) {
      this.dailyLoss = 0;
      this.dailyLossDate = today;
      if (this.context) {
        this.context.tradingBlocked = false;
        this.context.blockReason = null;
      }
    }
  }

  todayKst() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  }

  publicContext() {
    const ctx = this.context;
    if (!ctx) return null;
    const price = ctx.lastEval?.market?.PRICE;
    const positionValue = ctx.position && price ? ctx.position.qty * price : 0;
    const equity = ctx.cash + positionValue;
    const returnPct = (equity / ctx.initialCash - 1) * 100;

    return {
      state: this.state,
      mode: ctx.mode,
      limits: ctx.limits,
      dailyLoss: this.dailyLoss || 0,
      dailyLossDate: this.dailyLossDate,
      tradingBlocked: !!ctx.tradingBlocked,
      blockReason: ctx.blockReason || null,
      logicId: ctx.logic.logicId,
      logicName: ctx.logic.name,
      symbol: ctx.symbol,
      startedAt: ctx.startedAt,
      tickIntervalMs: TICK_MS,
      nextTickAt: this.nextTickAt,   // ms epoch
      lastTickAt: this.lastTickAt,
      ticks: ctx.ticks,
      initialCash: ctx.initialCash,
      cash: ctx.cash,
      positionValue,
      equity,
      returnPct,
      position: ctx.position
        ? { ...ctx.position, currentPrice: price ?? null }
        : null,
      pendingOrder: ctx.pendingOrder,
      lastEval: ctx.lastEval,
      lastError: ctx.lastError,
      trades: ctx.trades.slice(-20),
      tradeCount: ctx.trades.length,
    };
  }
}

module.exports = { EngineService };
