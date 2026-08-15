import { RiskRuleConfig } from "../../types";

export interface Position {
  id: string;
  asset: string; // es. 'EURUSD', 'XAUUSD', 'AAPL', 'SPY', 'GLD'
  currentValue: number; // Valore attuale della posizione in € o $
  openPrice: number;
  currentPrice: number;
  unrealizedProfit: number; // Profitto/Perdita attuale non realizzato in € o $
  highestPrice?: number; // Massimo prezzo raggiunto registrato (per Trailing Stop)
  sentimentScore?: number; // Score Sentiment corrente (da -1.0 a +1.0)
  previousSentimentScore?: number; // Score Sentiment precedente
  vix24hChangePct?: number; // Variazione % dell'indice VIX nelle ultime 24 ore (es. -2.5 per -2.5%)
  entryTime?: number; // Timestamp di apertura della posizione in ms
  atr?: number; // Average True Range (14 periodi) in $ (es. 2.50$)
  atr1_5x?: number; // 1.5x ATR in $
  adx?: number; // ADX(14)
}

export interface RiskConfig {
  y?: number; // Parametro Y della strategia
  defaultSL?: number; // Stop Loss personalizzato ($)
  defaultTP?: number; // Target di attivazione del Trailing Stop ($)
  trailingStop?: number; // Distanza Trailing Stop in % (es: 0.30 = 0.30%)
  targetTpPct?: number; // Target di attivazione % (es: 0.80 = +0.80%)
  slPct?: number; // Stop Loss % (es: -0.40 = -0.40%)
  isAlpaca?: boolean;
  enableSentimentOptimization?: boolean; // Attiva la sinergia avanzata Stop Loss - Sentiment
  atrMultiplier?: number; // Multiplicatore ATR per Trailing Stop individuale (default: 1.5x)
  atrPeriod?: number; // Periodo ATR (default: 14)
  useAtrTrailingStop?: boolean; // Se true, impiega trailing stop basato su 1.5x ATR
}

/**
 * Valuta se una singola posizione deve essere chiusa in base alle regole di risk management,
 * al trailing stop individuale calibrato su 1.5x ATR (in sostituzione di chiusure massive indiscriminate),
 * al target di attivazione, alla stagnazione temporale e all'interazione con il Sentiment LLM.
 */
export class RiskManagementService {
  
  public static evaluateClosure(
    position: Position, 
    _historicalProfits: number, 
    config: RiskConfig,
    systemRules?: RiskRuleConfig[]
  ): { action: 'CLOSE'; reason: string } | null {
    const { unrealizedProfit, openPrice, currentPrice, highestPrice, asset, sentimentScore, previousSentimentScore, vix24hChangePct, entryTime, atr } = position;

    // Se non abbiamo un prezzo d'ingresso valido o un prezzo corrente, non possiamo calcolare i livelli
    if (!openPrice || openPrice <= 0 || !currentPrice || currentPrice <= 0) {
      return null;
    }

    // Percentuali di profitto/perdita calcolate unicamente rispetto al prezzo medio d'ingresso della SINGOLA posizione
    const currentProfitPct = ((currentPrice - openPrice) / openPrice) * 100;
    const ageMinutes = entryTime ? (Date.now() - entryTime) / (60 * 1000) : null;

    // Picco massimo di prezzo raggiunto per questa singola posizione (High Water Mark)
    const peakPrice = (highestPrice && highestPrice > currentPrice) ? highestPrice : currentPrice;
    const highestProfitPct = ((peakPrice - openPrice) / openPrice) * 100;

    // --- 0. REGOLE DI SISTEMA SOTTOMESSE E TRAILING STOP INDIVIDUALE 1.5x ATR ---
    const atrRule = systemRules?.find(r => r.type === 'ATR_INDIVIDUAL_TRAILING_STOP');
    const isAtrTrailingEnabled = (atrRule ? atrRule.enabled : (config.useAtrTrailingStop ?? true));
    const atrMultiplier = atrRule?.parameters?.atrMultiplier ?? config.atrMultiplier ?? 1.5;

    // Se abbiamo un ATR valido (> 0) e la posizione ha registrato un picco in profitto o raggiunto una dinamica positiva
    if (isAtrTrailingEnabled && atr && atr > 0) {
      const atrDistance = atrMultiplier * atr;
      const atrStopPrice = peakPrice - atrDistance;
      const atrDistancePct = (atrDistance / peakPrice) * 100;

      // Se il prezzo corrente arretra sotto la soglia di Trailing Stop 1.5x ATR
      if (currentPrice <= atrStopPrice) {
        return {
          action: 'CLOSE',
          reason: `[Trailing Stop Individuale ${atrMultiplier.toFixed(1)}x ATR] Posizione ${asset} ha toccato il picco di $${peakPrice.toFixed(2)} (+${highestProfitPct.toFixed(2)}%) ed è rientrata sotto la soglia dinamica di volatilità ATR a $${atrStopPrice.toFixed(2)} (ATR(14): $${atr.toFixed(2)}, Distanza: $${atrDistance.toFixed(2)} / -${atrDistancePct.toFixed(2)}%, Prezzo attuale: $${currentPrice.toFixed(2)}, P&L: ${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}%). Chiusura mirata individuale in sostituzione di liquidazioni massive.`
        };
      }
    }

    if (systemRules && systemRules.length > 0) {
      for (const rule of systemRules) {
        if (!rule.enabled) continue;

        // Regola: PNL_PREVENTIVE_CLOSE
        if (rule.type === 'PNL_PREVENTIVE_CLOSE') {
          const maxLoss = rule.parameters.maxLossPct ?? -0.80;
          const minSent = rule.parameters.minSentimentThreshold ?? 0.20;
          if (currentProfitPct <= maxLoss && sentimentScore !== undefined && sentimentScore < minSent) {
            return {
              action: 'CLOSE',
              reason: `[Regola Sistema: PNL_PREVENTIVE_CLOSE] Posizione ${asset} con P&L negativo (${currentProfitPct.toFixed(2)}% <= ${maxLoss}%) e Sentiment debole (${sentimentScore.toFixed(2)} < ${minSent}). Chiusura preventiva mirata per liberare slot.`
            };
          }
        }

        // Regola: SENTIMENT_LIQUIDITY_SELL
        if (rule.type === 'SENTIMENT_LIQUIDITY_SELL') {
          const minSent = rule.parameters.minSentimentThreshold ?? 0.15;
          const vixThreshold = rule.parameters.vixDropExemptionPct ?? -2.0;

          if (sentimentScore !== undefined && sentimentScore < minSent) {
            const isVixDropping = vix24hChangePct !== undefined && vix24hChangePct < vixThreshold;
            if (!isVixDropping) {
              const vixText = vix24hChangePct !== undefined ? `${vix24hChangePct.toFixed(2)}%` : 'N/A';
              return {
                action: 'CLOSE',
                reason: `[Regola Sistema: SENTIMENT_LIQUIDITY_SELL] Sentiment per ${asset} sceso a ${sentimentScore.toFixed(2)} (< ${minSent}) e VIX non in calo > ${Math.abs(vixThreshold)}% (VIX 24h: ${vixText}). Vendi singola posizione per preservare liquidità.`
              };
            }
          }
        }

        // Regola: TIME_STAGNATION_CLOSE (Chiusura per Stagnazione / Time-Stop)
        if (rule.type === 'TIME_STAGNATION_CLOSE' && ageMinutes !== null) {
          const baseStagMins = rule.parameters.stagnationMinutes ?? 30;
          const highStagMins = rule.parameters.stagnationMinutesHighSentiment ?? 60;
          const stagMaxPnl = rule.parameters.stagnationMaxPnlPct ?? 0.10;

          let effectiveStagMins = baseStagMins;
          let sentimentDetail = '';

          if (sentimentScore !== undefined && sentimentScore > 0.30) {
            effectiveStagMins = highStagMins;
            sentimentDetail = ` (Sentiment ${sentimentScore.toFixed(2)} > 0.30 -> limite 60m)`;
          } else if (sentimentScore !== undefined) {
            sentimentDetail = ` (Sentiment ${sentimentScore.toFixed(2)} -> limite 30m)`;
          }

          if (ageMinutes >= effectiveStagMins && currentProfitPct <= stagMaxPnl) {
            return {
              action: 'CLOSE',
              reason: `[Regola Sistema: TIME_STAGNATION_CLOSE] Posizione ${asset} in stasi da ${ageMinutes.toFixed(1)} min (>= ${effectiveStagMins} min limite)${sentimentDetail} con P&L stazionario/debole (${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}% <= +${stagMaxPnl}%). Chiusura automatica per liberare capitale immobile.`
            };
          }
        }
      }
    } else {
      // --- REGOLE DEFAULT (se systemRules non viene passato) ---
      if (currentProfitPct <= -0.80 && sentimentScore !== undefined && sentimentScore < 0.20) {
        return {
          action: 'CLOSE',
          reason: `[Chiusura Preventiva P&L -0.80%] Posizione ${asset} con P&L negativo (${currentProfitPct.toFixed(2)}% <= -0.80%) e Sentiment debole (${sentimentScore.toFixed(2)} < 0.20). Chiusura preventiva per liberare slot.`
        };
      }

      if (sentimentScore !== undefined && sentimentScore < 0.15) {
        const isVixDroppingOver2Pct = vix24hChangePct !== undefined && vix24hChangePct < -2.0;
        if (!isVixDroppingOver2Pct) {
          const vixText = vix24hChangePct !== undefined ? `${vix24hChangePct.toFixed(2)}%` : 'N/A';
          return {
            action: 'CLOSE',
            reason: `[Vendita Liquidità Sentiment < 0.15] Sentiment per ${asset} sceso a ${sentimentScore.toFixed(2)} (< 0.15) e VIX non in calo > 2% (VIX 24h: ${vixText}). Vendi immediatamente.`
          };
        }
      }

      const defaultStagMins = (sentimentScore !== undefined && sentimentScore > 0.30) ? 60 : 30;
      if (ageMinutes !== null && ageMinutes >= defaultStagMins && currentProfitPct <= 0.10) {
        const sentDetail = sentimentScore !== undefined ? ` (Sentiment: ${sentimentScore.toFixed(2)} -> limite ${defaultStagMins}m)` : '';
        return {
          action: 'CLOSE',
          reason: `[Chiusura Stagnazione Temporale] Posizione ${asset} aperta da ${ageMinutes.toFixed(1)} min senza variazioni positive rilevanti (P&L: ${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}% <= +0.10%${sentDetail}). Chiusura automatica per evitare di rimanere bloccati.`
        };
      }
    }

    // Parametri base della strategia
    const activationTargetPct = config.targetTpPct !== undefined ? config.targetTpPct : 0.80;
    const baseTsPercent = config.trailingStop !== undefined ? config.trailingStop : 0.30;
    const baseSlPercent = config.slPct !== undefined ? config.slPct : -0.40;

    const useSentimentOpt = config.enableSentimentOptimization !== false && sentimentScore !== undefined;

    // --- 1. CALCOLO STOP LOSS DINAMICO (Dynamic Stop Loss) ---
    let effectiveSlPercent = baseSlPercent;
    let slMultiplierNote = "";

    if (useSentimentOpt && sentimentScore !== undefined) {
      if (sentimentScore > 0.40) {
        effectiveSlPercent = baseSlPercent * 1.3333;
        slMultiplierNote = " [Dynamic SL: Tolleranza allargata per Sentiment alto (>+0.40)]";
      } else if (sentimentScore >= 0.00 && sentimentScore <= 0.20) {
        effectiveSlPercent = baseSlPercent * 0.65;
        slMultiplierNote = " [Dynamic SL: Soglia ristretta per Sentiment debole (<=+0.20)]";
      } else if (sentimentScore < 0.00) {
        effectiveSlPercent = baseSlPercent * 0.40;
        slMultiplierNote = " [Dynamic SL: Soglia fortemente ristretta per Sentiment negativo (<0)]";
      }
    }

    // --- 2. EARLY WARNING / SOFT STOP SUL CROLLO DI SENTIMENT ---
    if (useSentimentOpt && currentProfitPct < 0 && sentimentScore !== undefined) {
      const sentimentDrop = previousSentimentScore !== undefined ? (previousSentimentScore - sentimentScore) : 0;
      const isSharpDrop = sentimentDrop >= 0.20;
      const isLowSentimentInLoss = sentimentScore <= 0.05 && currentProfitPct <= -0.20;

      if (isSharpDrop || isLowSentimentInLoss) {
        return {
          action: 'CLOSE',
          reason: `[Soft Stop / Early Warning Sentiment] Posizione ${asset} in perdita (${currentProfitPct.toFixed(2)}%) con Sentiment degradato a ${sentimentScore.toFixed(2)}${previousSentimentScore !== undefined ? ` (da ${previousSentimentScore.toFixed(2)})` : ''}. Chiusura anticipata preventiva prima dello Stop Loss hard.`
        };
      }
    }

    // Verifichiamo se il picco massimo toccato ha raggiunto o superato il Target di Attivazione
    const isActivated = highestProfitPct >= (activationTargetPct - 0.0001);

    if (isActivated) {
      // --- REGIME POSIZIONE ATTIVATA ---

      // 3. TRAILING STOP ACCELERATO DAL SENTIMENT (se non gestito già dall'ATR)
      let effectiveTsPercent = baseTsPercent;
      let tsNote = "";

      if (useSentimentOpt && sentimentScore !== undefined && sentimentScore <= 0.20) {
        effectiveTsPercent = baseTsPercent * 0.50;
        tsNote = " [Trailing Accelerato per Divergenza Sentiment]";
      }

      const trailingStopPrice = peakPrice * (1 - effectiveTsPercent / 100);

      if (currentPrice <= trailingStopPrice) {
        return {
          action: 'CLOSE',
          reason: `[Trailing Stop Dinamico ${effectiveTsPercent.toFixed(2)}%${tsNote}] Posizione ${asset} attivata (picco +${highestProfitPct.toFixed(2)}% >= target +${activationTargetPct.toFixed(2)}%). Picco max: $${peakPrice.toFixed(2)}, Soglia Trailing: $${trailingStopPrice.toFixed(2)}, Prezzo attuale: $${currentPrice.toFixed(2)} (P&L: ${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}%).`
        };
      }

      // Protezione Break-Even: una volta raggiunto il target di attivazione, lo Stop Loss è fisso al prezzo d'ingresso
      if (currentPrice <= openPrice) {
        return {
          action: 'CLOSE',
          reason: `[Stop Loss Protezione Break-Even] Posizione ${asset} attivata (picco +${highestProfitPct.toFixed(2)}%), rientrata a prezzo di carico ($${currentPrice.toFixed(2)} <= $${openPrice.toFixed(2)}).`
        };
      }

    } else {
      // --- REGIME POSIZIONE NON ANCORA ATTIVATA ---

      // 1. Stop Loss Dinamico in percentuale rispetto all'ingresso
      const slMagnitudePct = Math.abs(effectiveSlPercent);
      const slThresholdPrice = openPrice * (1 - slMagnitudePct / 100);

      if (currentPrice <= slThresholdPrice) {
        return {
          action: 'CLOSE',
          reason: `[Stop Loss Dinamico ${effectiveSlPercent.toFixed(2)}%${slMultiplierNote}] Prezzo attuale $${currentPrice.toFixed(2)} <= soglia $${slThresholdPrice.toFixed(2)} (Entry: $${openPrice.toFixed(2)}, P&L: ${currentProfitPct.toFixed(2)}%).`
        };
      }

      // 2. Stop Loss monetario in $ (se configurato)
      if (config.defaultSL !== undefined && config.defaultSL !== 0) {
        const slLimit = config.defaultSL < 0 ? config.defaultSL : -config.defaultSL;
        if (unrealizedProfit <= slLimit) {
          return {
            action: 'CLOSE',
            reason: `[Stop Loss $] Perdita non realizzata $${unrealizedProfit.toFixed(2)} <= limite $${slLimit.toFixed(2)}.`
          };
        }
      }
    }

    return null;
  }

  /**
   * Valuta il filtro di volatilità/forza trend ADX (< 25 inibisce nuove aperture di posizioni)
   */
  public static evaluateAdxVolatilityFilter(
    symbol: string,
    adxValue: number,
    systemRules?: RiskRuleConfig[]
  ): { allowed: boolean; reason?: string } {
    const adxRule = systemRules?.find(r => r.type === 'ADX_VOLATILITY_FILTER');
    const isEnabled = adxRule?.enabled ?? true;
    if (!isEnabled) {
      return { allowed: true };
    }

    const minAdx = adxRule?.parameters?.minAdxThreshold ?? 25.0;

    if (adxValue < minAdx) {
      return {
        allowed: false,
        reason: `[Regola Sistema: ADX_VOLATILITY_FILTER] ${symbol.toUpperCase()} presenta ADX(14) = ${adxValue.toFixed(1)} (< ${minAdx.toFixed(1)} soglia minima). Mercato privo di trend direzionale (fase laterale / chop zone). Nuovi acquisti inibiti per proteggere il capitale da falsi segnali.`
      };
    }

    return { allowed: true };
  }

  /**
   * 4. RIAUTORIZZAZIONE E RIAPPROVVIGIONAMENTO SPAZIO IN PORTAFOGLIO (Opportunity Cost Reallocation)
   */
  public static evaluateOpportunityCostExit(
    positions: Position[],
    newCandidateSentiment: number,
    maxConcurrentPositions: number = 10
  ): { candidateToClose: Position; reason: string } | null {
    if (positions.length < maxConcurrentPositions || newCandidateSentiment < 0.40) {
      return null;
    }

    let weakestPosition: Position | null = null;
    let lowestSentiment = 0.16;

    for (const pos of positions) {
      const currentProfitPct = ((pos.currentPrice - pos.openPrice) / pos.openPrice) * 100;
      const sScore = pos.sentimentScore ?? 0;
      if (currentProfitPct < 0 && sScore <= lowestSentiment) {
        lowestSentiment = sScore;
        weakestPosition = pos;
      }
    }

    if (weakestPosition) {
      const currentProfitPct = ((weakestPosition.currentPrice - weakestPosition.openPrice) / weakestPosition.openPrice) * 100;
      return {
        candidateToClose: weakestPosition,
        reason: `[Uscita Opportunità / Rilocazione Portafoglio] Portafoglio saturo (${positions.length}/${maxConcurrentPositions}). Chiusura posizione ${weakestPosition.asset} (PnL: ${currentProfitPct.toFixed(2)}%, Sentiment: ${weakestPosition.sentimentScore?.toFixed(2) ?? 'debole'}) per liberare slot a favore di un nuovo asset con Sentiment superiore (+${newCandidateSentiment.toFixed(2)}).`
      };
    }

    return null;
  }

  /**
   * 5. CAP ESPOSIZIONE SETTORIALE SEMICONDUTTORI SU CORRELAZIONE SPY-QQQ ELEVATA (> 0.95)
   */
  public static evaluateSemiconductorExposureCap(
    symbol: string,
    amountToBuy: number,
    openPositions: { symbol: string; market_value?: string; currentValue?: number }[],
    queuedOrders: { symbol: string; amount: number }[],
    totalAccountEquity: number,
    spyQqqCorrelation: number,
    systemRules?: RiskRuleConfig[]
  ): { allowed: boolean; reason?: string } {
    const semiconRule = systemRules?.find(r => r.type === 'SPY_QQQ_CORRELATION_SEMICON_CAP');
    const isEnabled = semiconRule?.enabled ?? true;
    if (!isEnabled) {
      return { allowed: true };
    }

    const minCorr = semiconRule?.parameters?.minCorrelationThreshold ?? 0.95;
    const maxSemiconPct = semiconRule?.parameters?.maxSemiconExposurePct ?? 40;
    const defaultSemiconList = ['AMD', 'AVGO', 'NVDA', 'QCOM', 'INTC', 'MU', 'SMCI', 'ARM', 'TSM', 'ASML', 'SOXL', 'SOXX', 'SMH'];
    const semiconList = (semiconRule?.parameters?.semiconSymbols && semiconRule.parameters.semiconSymbols.length > 0)
      ? semiconRule.parameters.semiconSymbols.map(s => s.toUpperCase())
      : defaultSemiconList;

    const symUpper = symbol.toUpperCase();
    if (!semiconList.includes(symUpper)) {
      return { allowed: true };
    }

    if (spyQqqCorrelation < minCorr) {
      return { allowed: true };
    }

    let currentSemiconExposure = 0;
    for (const pos of openPositions) {
      if (semiconList.includes(pos.symbol.toUpperCase())) {
        const val = pos.currentValue !== undefined 
          ? pos.currentValue 
          : Math.abs(parseFloat(pos.market_value || '0'));
        currentSemiconExposure += val;
      }
    }

    for (const order of queuedOrders) {
      if (semiconList.includes(order.symbol.toUpperCase())) {
        currentSemiconExposure += order.amount;
      }
    }

    const prospectiveTotalSemicon = currentSemiconExposure + amountToBuy;
    const prospectivePct = totalAccountEquity > 0 ? (prospectiveTotalSemicon / totalAccountEquity) * 100 : 0;

    if (prospectivePct > maxSemiconPct) {
      return {
        allowed: false,
        reason: `[Regola Sistema: SPY_QQQ_CORRELATION_SEMICON_CAP] Correlazione SPY-QQQ a +${spyQqqCorrelation.toFixed(2)} (>= ${minCorr}). L'esposizione complessiva ai semiconduttori ($${prospectiveTotalSemicon.toFixed(2)}) raggiungerebbe il ${prospectivePct.toFixed(1)}% del NAV, eccedendo il limite massimo consentito del ${maxSemiconPct}%. Acquisto ${symUpper} bloccato per prevenire rischio di concentrazione settoriale.`
      };
    }

    return { allowed: true };
  }
}


