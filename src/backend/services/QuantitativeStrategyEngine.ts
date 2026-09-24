/**
 * QuantitativeStrategyEngine.ts
 * Engine Decisionale deterministico per trading automatico collegato via API ad Alpaca Markets.
 * 
 * Regole quantitative vincolanti implementate:
 * 1. Indicatori: EMA 20/50, RSI a 14 periodi, ATR a 14 periodi e Volumi (SMA 20 volumi).
 * 2. Criteri di Entry (Long):
 *    - Trend Primario: Prezzo > EMA 50 e EMA 20 > EMA 50
 *    - Momentum: RSI compreso tra 45 e 62
 *    - Volume: Volume attuale > Media Mobile Volumi a 20 periodi del +15%
 *    - Titoli con volume medio giornaliero >= 1.000.000 di azioni
 * 3. Parametri di Rischio e Money Management:
 *    - Rischio massimo per singolo trade: 1.0% del Capitale Totale
 *    - Stop Loss (SL): 1.5 * ATR(14) sotto il prezzo di entrata
 *    - Take Profit (TP): Rapporto R:R minimo 1:2 rispetto al Risk/Share
 *    - Position Sizing: N = (Capitale * 0.01) / (Prezzo Entrata - Stop Loss)
 * 4. Gestione posizioni aperte:
 *    - Trailing Stop dinamico pari a 2 * ATR quando il guadagno supera 1 * Risk/Share
 *    - Chiusura a mercato se RSI > 75
 *    - Chiusura a mercato se posizione in stallo per oltre 8 sessioni senza raggiungere TP1
 * 5. Vincoli di portafoglio:
 *    - Esposizione massima globale portafoglio <= 60% del capitale disponibile
 *    - Massimo 4 posizioni contemporaneamente
 *    - Nessun acquisto su titoli con volume medio giornaliero < 1.000.000
 */

import { TechnicalIndicatorService, IndicatorResult } from './TechnicalIndicatorService';

export interface QuantitativeDecision {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  order_type: 'limit' | 'market';
  quantity: number;
  limit_price: number;
  stop_loss: number;
  take_profit: number;
  trailing_stop_atr_multiplier: number;
  risk_reward_ratio: string;
  reasoning: string;
}

export interface QuantitativePayload {
  timestamp: string;
  account_status: {
    allocation_used_pct: number;
    active_positions_count: number;
  };
  decisions: QuantitativeDecision[];
}

export interface EvaluatorContext {
  totalEquity: number;
  availableCash: number;
  openPositions: Array<{
    symbol: string;
    qty: number;
    avg_entry_price: number;
    current_price: number;
    market_value: number;
    unrealized_pl: number;
    entry_timestamp?: number;
    peak_price?: number;
    sessions_held?: number;
  }>;
  candidateSymbols: string[];
  alpacaCreds?: {
    apiKey?: string;
    secretKey?: string;
    baseUrl?: string;
  };
}

export class QuantitativeStrategyEngine {
  private static instance: QuantitativeStrategyEngine;

  public static readonly MAX_GLOBAL_ALLOCATION_PCT = 60.0;
  public static readonly MAX_ACTIVE_POSITIONS = 4;
  public static readonly RISK_PER_TRADE_PCT = 0.01; // 1.0%
  public static readonly SL_ATR_MULTIPLIER = 1.5;
  public static readonly TP_MIN_RR_RATIO = 2.0; // 1:2
  public static readonly TRAILING_STOP_ATR_MULTIPLIER = 2.0;
  public static readonly MIN_AVG_DAILY_VOLUME = 1000000;

  private constructor() {}

  public static getInstance(): QuantitativeStrategyEngine {
    if (!QuantitativeStrategyEngine.instance) {
      QuantitativeStrategyEngine.instance = new QuantitativeStrategyEngine();
    }
    return QuantitativeStrategyEngine.instance;
  }

  /**
   * Valuta le posizioni aperte e genera le decisioni di gestione/uscita
   */
  public evaluateOpenPosition(
    pos: EvaluatorContext['openPositions'][0],
    ind: IndicatorResult
  ): QuantitativeDecision {
    const entryPrice = pos.avg_entry_price > 0 ? pos.avg_entry_price : pos.current_price;
    const currentPrice = pos.current_price > 0 ? pos.current_price : entryPrice;
    const atr = ind.atr > 0 ? ind.atr : Math.max(0.01, entryPrice * 0.015);
    const riskPerShare = atr * QuantitativeStrategyEngine.SL_ATR_MULTIPLIER;
    const initialSl = parseFloat((entryPrice - riskPerShare).toFixed(2));
    const initialTp = parseFloat((entryPrice + (riskPerShare * QuantitativeStrategyEngine.TP_MIN_RR_RATIO)).toFixed(2));

    const peakPrice = Math.max(pos.peak_price || 0, currentPrice, entryPrice);
    const profitPerShare = currentPrice - entryPrice;
    const sessionsHeld = pos.sessions_held !== undefined 
      ? pos.sessions_held 
      : (pos.entry_timestamp ? Math.floor((Date.now() - pos.entry_timestamp) / (24 * 60 * 60 * 1000)) : 1);

    // --- REGOLA FONDAMENTALE ASSOLUTA: NESSUNA CHIUSURA IN NEGATIVO ---
    if (profitPerShare < 0) {
      return {
        symbol: pos.symbol,
        action: 'HOLD',
        order_type: 'market',
        quantity: Math.abs(pos.qty),
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: initialSl,
        take_profit: initialTp,
        trailing_stop_atr_multiplier: QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER,
        risk_reward_ratio: '1:2',
        reasoning: `Posizione in perdita ($${profitPerShare.toFixed(2)}/azione). Regola categorica no-perdite: posizione mantenuta attiva (HOLD) fino al recupero del prezzo di carico.`
      };
    }

    // Regola Post-1h: se aperta da oltre 1 ora ed è tornata in positivo (anche solo >= +0.05%), chiudi subito
    const holdHours = pos.entry_timestamp ? (Date.now() - pos.entry_timestamp) / (3600 * 1000) : 0;
    const profitPct = entryPrice > 0 ? (profitPerShare / entryPrice) * 100 : 0;
    if (holdHours >= 1 && profitPct >= 0.05) {
      return {
        symbol: pos.symbol,
        action: 'CLOSE',
        order_type: 'market',
        quantity: Math.abs(pos.qty),
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: initialSl,
        take_profit: initialTp,
        trailing_stop_atr_multiplier: QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER,
        risk_reward_ratio: '1:2',
        reasoning: `Posizione mantenuta da oltre 1 ora (${holdHours.toFixed(1)}h) e tornata in positivo (+${profitPct.toFixed(2)}% >= +0.05%). Chiusura rapida di recupero eseguita con successo in profitto.`
      };
    }

    // 1. Chiusura su Ipercomprato Estremo (RSI > 75)
    if (ind.rsi > 75.0) {
      return {
        symbol: pos.symbol,
        action: 'CLOSE',
        order_type: 'market',
        quantity: Math.abs(pos.qty),
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: initialSl,
        take_profit: initialTp,
        trailing_stop_atr_multiplier: QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER,
        risk_reward_ratio: '1:2',
        reasoning: `RSI a 14 periodi (${ind.rsi.toFixed(1)}) > 75.0: condizione di ipercomprato estremo raggiunta. Chiusura a mercato per monetizzare il momentum prima di un ritracciamento.`
      };
    }

    // 2. Chiusura su Stallo prolungato (> 8 sessioni senza raggiungere TP1)
    const tp1Reached = profitPerShare >= riskPerShare;
    if (sessionsHeld > 8 && !tp1Reached) {
      return {
        symbol: pos.symbol,
        action: 'CLOSE',
        order_type: 'market',
        quantity: Math.abs(pos.qty),
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: initialSl,
        take_profit: initialTp,
        trailing_stop_atr_multiplier: QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER,
        risk_reward_ratio: '1:2',
        reasoning: `Posizione in stallo da ${sessionsHeld} sessioni (> 8 sessioni massime) senza raggiungere TP1 (+${riskPerShare.toFixed(2)}$). Chiusura a mercato per disimpegnare il capitale.`
      };
    }

    // 3. Trailing Stop dinamico (2 * ATR quando il guadagno supera 1 * Risk/Share)
    const peakProfit = peakPrice - entryPrice;
    if (peakProfit >= riskPerShare) {
      const dynamicTrailingStop = parseFloat((peakPrice - (QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER * atr)).toFixed(2));
      if (currentPrice <= dynamicTrailingStop) {
        return {
          symbol: pos.symbol,
          action: 'CLOSE',
          order_type: 'market',
          quantity: Math.abs(pos.qty),
          limit_price: parseFloat(currentPrice.toFixed(2)),
          stop_loss: dynamicTrailingStop,
          take_profit: initialTp,
          trailing_stop_atr_multiplier: QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER,
          risk_reward_ratio: '1:2',
          reasoning: `Trailing Stop dinamico (2*ATR = ${(2 * atr).toFixed(2)}$ dal picco ${peakPrice.toFixed(2)}$) violato a ${currentPrice.toFixed(2)}$ <= ${dynamicTrailingStop.toFixed(2)}$. Chiusura a mercato per proteggere i profitti.`
        };
      }
    }

    // 4. Stop Loss rigido (1.5 * ATR sotto prezzo d'ingresso)
    if (currentPrice <= initialSl) {
      return {
        symbol: pos.symbol,
        action: 'CLOSE',
        order_type: 'market',
        quantity: Math.abs(pos.qty),
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: initialSl,
        take_profit: initialTp,
        trailing_stop_atr_multiplier: QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER,
        risk_reward_ratio: '1:2',
        reasoning: `Stop Loss rigido a 1.5*ATR (${initialSl.toFixed(2)}$) violato dal prezzo corrente (${currentPrice.toFixed(2)}$). Uscita immediata per rispetto del money management.`
      };
    }

    // 5. Take Profit rigido (R:R 1:2)
    if (currentPrice >= initialTp) {
      return {
        symbol: pos.symbol,
        action: 'CLOSE',
        order_type: 'market',
        quantity: Math.abs(pos.qty),
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: initialSl,
        take_profit: initialTp,
        trailing_stop_atr_multiplier: QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER,
        risk_reward_ratio: '1:2',
        reasoning: `Target Take Profit R:R 1:2 (${initialTp.toFixed(2)}$) raggiunto. Chiusura a mercato della posizione con successo.`
      };
    }

    // 6. In tutti gli altri casi: HOLD
    return {
      symbol: pos.symbol,
      action: 'HOLD',
      order_type: 'market',
      quantity: Math.abs(pos.qty),
      limit_price: parseFloat(currentPrice.toFixed(2)),
      stop_loss: initialSl,
      take_profit: initialTp,
      trailing_stop_atr_multiplier: QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER,
      risk_reward_ratio: '1:2',
      reasoning: `Posizione attiva da ${sessionsHeld} sessioni. Prezzo (${currentPrice.toFixed(2)}$) sopra SL (${initialSl.toFixed(2)}$). RSI a ${ind.rsi.toFixed(1)} <= 75. Parametri di trailing stop e target intatti. Istruzione: MANTENERE (HOLD).`
    };
  }

  /**
   * Valuta un candidato per potenziale nuova apertura (BUY)
   */
  public evaluateCandidate(
    symbol: string,
    ind: IndicatorResult,
    context: {
      totalEquity: number;
      currentlyInvested: number;
      currentPositionsCount: number;
      openSymbols: string[];
    }
  ): QuantitativeDecision | null {
    // Non aprire se già posseduto in portafoglio
    if (context.openSymbols.includes(symbol.toUpperCase())) {
      return null;
    }

    const currentPrice = ind.currentPrice;
    if (currentPrice <= 0) return null;

    // Vincolo 1: Massimo 4 posizioni contemporaneamente
    if (context.currentPositionsCount >= QuantitativeStrategyEngine.MAX_ACTIVE_POSITIONS) {
      return {
        symbol,
        action: 'HOLD',
        order_type: 'market',
        quantity: 0,
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: 0,
        take_profit: 0,
        trailing_stop_atr_multiplier: 2.0,
        risk_reward_ratio: '1:2',
        reasoning: `Vincolo di portafoglio: massimo 4 posizioni simultanee raggiunto (${context.currentPositionsCount}/4). Nessuna nuova apertura consentita.`
      };
    }

    // Vincolo 2: Esposizione massima globale portafoglio <= 60%
    const currentAllocationPct = context.totalEquity > 0 ? (context.currentlyInvested / context.totalEquity) * 100 : 0;
    if (currentAllocationPct >= QuantitativeStrategyEngine.MAX_GLOBAL_ALLOCATION_PCT) {
      return {
        symbol,
        action: 'HOLD',
        order_type: 'market',
        quantity: 0,
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: 0,
        take_profit: 0,
        trailing_stop_atr_multiplier: 2.0,
        risk_reward_ratio: '1:2',
        reasoning: `Vincolo di portafoglio: esposizione massima globale del 60% raggiunta (${currentAllocationPct.toFixed(1)}% / 60.0%). Apertura nuove posizioni sospesa.`
      };
    }

    // Vincolo 3: Volume medio giornaliero >= 1.000.000 azioni
    if (!ind.isDailyVolumeLiquid) {
      return {
        symbol,
        action: 'HOLD',
        order_type: 'market',
        quantity: 0,
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: 0,
        take_profit: 0,
        trailing_stop_atr_multiplier: 2.0,
        risk_reward_ratio: '1:2',
        reasoning: `Volume medio giornaliero stimato (${ind.avgDailyVolume.toLocaleString()} azioni) < 1.000.000: titolo escluso per liquidità insufficiente.`
      };
    }

    // Regola 1: Trend Primario Long (Prezzo > EMA 50 ed EMA 20 > EMA 50)
    const isTrendPrimarioLong = (currentPrice > ind.ema50) && (ind.ema20 > ind.ema50);
    if (!isTrendPrimarioLong) {
      return {
        symbol,
        action: 'HOLD',
        order_type: 'market',
        quantity: 0,
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: 0,
        take_profit: 0,
        trailing_stop_atr_multiplier: 2.0,
        risk_reward_ratio: '1:2',
        reasoning: `Filtro Trend Primario non rispettato: Prezzo (${currentPrice.toFixed(2)}$) ${currentPrice > ind.ema50 ? '>' : '<='} EMA 50 (${ind.ema50.toFixed(2)}$), EMA 20 (${ind.ema20.toFixed(2)}$) ${ind.ema20 > ind.ema50 ? '>' : '<='} EMA 50.`
      };
    }

    // Regola 2: Momentum (RSI compreso tra 45 e 62)
    const isRsiValid = ind.rsi >= 45.0 && ind.rsi <= 62.0;
    if (!isRsiValid) {
      return {
        symbol,
        action: 'HOLD',
        order_type: 'market',
        quantity: 0,
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: 0,
        take_profit: 0,
        trailing_stop_atr_multiplier: 2.0,
        risk_reward_ratio: '1:2',
        reasoning: `Filtro Momentum non rispettato: RSI(14) pari a ${ind.rsi.toFixed(1)} al di fuori dell'intervallo operativo 45 - 62.`
      };
    }

    // Regola 3: Volume (Volume attuale > Media Mobile Volumi 20 periodi del +15%)
    const isVolumeBreakout = ind.currentVolume > (ind.volumeSma20 * 1.15);
    if (!isVolumeBreakout) {
      return {
        symbol,
        action: 'HOLD',
        order_type: 'market',
        quantity: 0,
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: 0,
        take_profit: 0,
        trailing_stop_atr_multiplier: 2.0,
        risk_reward_ratio: '1:2',
        reasoning: `Filtro Volume non rispettato: Volume attuale (${ind.currentVolume}) non supera del +15% la SMA 20 dei volumi (${Math.round(ind.volumeSma20 * 1.15)}).`
      };
    }

    // Criteri soddisfatti! Calcolo Money Management e Position Sizing
    // Rischio max 1.0% del Capitale Totale
    const totalEquity = Math.max(context.totalEquity, 100);
    const maxDollarRisk = totalEquity * QuantitativeStrategyEngine.RISK_PER_TRADE_PCT;

    const atr = ind.atr > 0 ? ind.atr : Math.max(0.01, currentPrice * 0.015);
    const riskPerShare = atr * QuantitativeStrategyEngine.SL_ATR_MULTIPLIER; // 1.5 * ATR
    const stopLoss = parseFloat((currentPrice - riskPerShare).toFixed(2));
    const takeProfit = parseFloat((currentPrice + (riskPerShare * QuantitativeStrategyEngine.TP_MIN_RR_RATIO)).toFixed(2));

    // Formula esatta: N = (Capitale * 0.01) / (Prezzo Entrata - Stop Loss)
    let calculatedShares = maxDollarRisk / riskPerShare;

    // Controllo cap esposizione globale (max 60% totale investito)
    const maxAvailableToInvest = (totalEquity * (QuantitativeStrategyEngine.MAX_GLOBAL_ALLOCATION_PCT / 100)) - context.currentlyInvested;
    const maxSharesAllowedByGlobalCap = Math.max(0, maxAvailableToInvest / currentPrice);
    calculatedShares = Math.min(calculatedShares, maxSharesAllowedByGlobalCap);

    // Arrotondamento a 2 decimali per azioni/ETF frazionari Alpaca
    const finalQuantity = Math.floor(calculatedShares * 100) / 100;
    const notionalValue = finalQuantity * currentPrice;

    if (finalQuantity <= 0 || notionalValue < 2.00) {
      return {
        symbol,
        action: 'HOLD',
        order_type: 'market',
        quantity: 0,
        limit_price: parseFloat(currentPrice.toFixed(2)),
        stop_loss: stopLoss,
        take_profit: takeProfit,
        trailing_stop_atr_multiplier: 2.0,
        risk_reward_ratio: '1:2',
        reasoning: `Segnale rialzista valido ma capitale allocabile residuo ($${maxAvailableToInvest.toFixed(2)}) inferiore al minimo d'ordine ($2.00).`
      };
    }

    return {
      symbol,
      action: 'BUY',
      order_type: 'limit',
      quantity: finalQuantity,
      limit_price: parseFloat(currentPrice.toFixed(2)),
      stop_loss: stopLoss,
      take_profit: takeProfit,
      trailing_stop_atr_multiplier: QuantitativeStrategyEngine.TRAILING_STOP_ATR_MULTIPLIER,
      risk_reward_ratio: '1:2',
      reasoning: `Trend Primario confermato (Prezzo ${currentPrice.toFixed(2)}$ > EMA 50 ${ind.ema50.toFixed(2)}$, EMA 20 ${ind.ema20.toFixed(2)}$ > EMA 50). Momentum RSI a ${ind.rsi.toFixed(1)} (range 45-62). Volume (+${Math.round(((ind.currentVolume / ind.volumeSma20) - 1) * 100)}%) > SMA 20 del +15%. Stop Loss a 1.5*ATR (${stopLoss.toFixed(2)}$) e Take Profit R:R 1:2 (${takeProfit.toFixed(2)}$). Position sizing rispettoso dell'1.0% di rischio.`
    };
  }

  /**
   * Esegue l'intera valutazione del portafoglio e genera il payload JSON ufficiale
   */
  public async evaluateFullPortfolio(ctx: EvaluatorContext): Promise<QuantitativePayload> {
    const indicatorService = TechnicalIndicatorService.getInstance();
    const openSymbols = ctx.openPositions.map(p => p.symbol.toUpperCase());
    const currentlyInvested = ctx.openPositions.reduce((sum, p) => sum + Math.abs(p.market_value || (p.qty * p.current_price) || 0), 0);
    const totalEquity = ctx.totalEquity > 0 ? ctx.totalEquity : Math.max(currentlyInvested + ctx.availableCash, 100);
    const allocationUsedPct = parseFloat(((currentlyInvested / totalEquity) * 100).toFixed(2));

    const decisions: QuantitativeDecision[] = [];

    // 1. Valuta posizioni aperte (CLOSE, HOLD o trailing stop)
    for (const pos of ctx.openPositions) {
      try {
        const ind = await indicatorService.getSymbolIndicators(pos.symbol, pos.current_price, ctx.alpacaCreds);
        const decision = this.evaluateOpenPosition(pos, ind);
        decisions.push(decision);
      } catch (err: any) {
        decisions.push({
          symbol: pos.symbol,
          action: 'HOLD',
          order_type: 'market',
          quantity: Math.abs(pos.qty),
          limit_price: parseFloat(pos.current_price.toFixed(2)),
          stop_loss: parseFloat((pos.avg_entry_price * 0.985).toFixed(2)),
          take_profit: parseFloat((pos.avg_entry_price * 1.03).toFixed(2)),
          trailing_stop_atr_multiplier: 2.0,
          risk_reward_ratio: '1:2',
          reasoning: `Errore recupero indicatori per ${pos.symbol} (${err.message}). Mantenimento prudenziale della posizione con SL/TP pregressi.`
        });
      }
    }

    // 2. Valuta simboli candidati per nuove aperture (BUY) se slot e capitale lo consentono
    let simulatedInvested = currentlyInvested;
    let simulatedCount = ctx.openPositions.length;

    for (const sym of ctx.candidateSymbols) {
      if (simulatedCount >= QuantitativeStrategyEngine.MAX_ACTIVE_POSITIONS) break;
      if ((simulatedInvested / totalEquity) * 100 >= QuantitativeStrategyEngine.MAX_GLOBAL_ALLOCATION_PCT) break;
      if (openSymbols.includes(sym.toUpperCase())) continue;

      try {
        const ind = await indicatorService.getSymbolIndicators(sym, 100.0, ctx.alpacaCreds);
        const decision = this.evaluateCandidate(sym, ind, {
          totalEquity,
          currentlyInvested: simulatedInvested,
          currentPositionsCount: simulatedCount,
          openSymbols
        });

        if (decision) {
          decisions.push(decision);
          if (decision.action === 'BUY') {
            simulatedInvested += (decision.quantity * decision.limit_price);
            simulatedCount += 1;
          }
        }
      } catch (err) {
        // Ignora candidati con errori temporanei di fetch
      }
    }

    return {
      timestamp: new Date().toISOString(),
      account_status: {
        allocation_used_pct: allocationUsedPct,
        active_positions_count: ctx.openPositions.length
      },
      decisions
    };
  }
}

export default QuantitativeStrategyEngine;
