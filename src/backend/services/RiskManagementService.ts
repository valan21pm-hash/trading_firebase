import { RiskRuleConfig } from "../../types";

export interface Position {
  id: string;
  asset: string; // es. 'EURUSD', 'XAUUSD', 'AAPL', 'SPY', 'GLD'
  qty?: number; // Quantità di quote possedute
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
  manualTrailingStopPrice?: number; // Stop manuale personalizzato impostato dall'utente
  manualTrailingDistancePct?: number; // Distanza % manuale impostata dall'utente (es. 0.25%)
  enableTechnicalStop?: boolean; // Override specifico per questa singola posizione
  enableCatastrophicStop?: boolean; // Override specifico per questa singola posizione
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

    // --- 0. LIVELLO 2: STOP LOSS CATASTROFICO / CIRCUIT BREAKER ESTREMO (ATTIVO DI DEFAULT, DISATTIVABILE PER SINGOLA POSIZIONE O GLOBALE) ---
    // Agisce come paracadute estremo contro crolli verticali o flash crash, impostato a -2.50% / -3.00%
    const catastrophicRule = systemRules?.find(r => r.type === 'CATASTROPHIC_CIRCUIT_BREAKER_SL');
    const isGlobalCatastrophicEnabled = catastrophicRule?.enabled ?? true;
    const isCatastrophicEnabled = position.enableCatastrophicStop !== undefined 
      ? position.enableCatastrophicStop 
      : isGlobalCatastrophicEnabled;
    const catastrophicLossThreshold = catastrophicRule?.parameters?.catastrophicMaxLossPct ?? -3.00;
    if (isCatastrophicEnabled && currentProfitPct <= catastrophicLossThreshold) {
      return {
        action: 'CLOSE',
        reason: `[Livello 2 - Circuit Breaker Catastrofico] Posizione ${asset} in perdita critica (${currentProfitPct.toFixed(2)}% <= ${catastrophicLossThreshold.toFixed(2)}%). Chiusura di emergenza per preservare il capitale totale da crolli verticali anomali.`
      };
    }

    // --- LIVELLO 0.5: OVERRIDE MANUALE TRAILING STOP (IMPOSTATO PERSONALMENTE DALL'UTENTE) ---
    if (position.manualTrailingStopPrice && position.manualTrailingStopPrice > 0) {
      const manualStop = position.manualTrailingStopPrice;
      if (currentPrice <= manualStop) {
        return {
          action: 'CLOSE',
          reason: `[Trailing Stop Manuale] Posizione ${asset} ha raggiunto la soglia stop personalizzata a $${manualStop.toFixed(2)} (Prezzo attuale: $${currentPrice.toFixed(2)}, Carico: $${openPrice.toFixed(2)}, P&L: ${currentProfitPct.toFixed(2)}%). Chiusura eseguita.`
        };
      }
    } else if (position.manualTrailingDistancePct && position.manualTrailingDistancePct > 0) {
      const manualStop = peakPrice * (1 - position.manualTrailingDistancePct / 100);
      if (currentPrice <= manualStop) {
        return {
          action: 'CLOSE',
          reason: `[Trailing Stop Manuale %] Posizione ${asset} ha raggiunto la soglia stop a distanza manuale del ${position.manualTrailingDistancePct.toFixed(2)}% dal picco ($${peakPrice.toFixed(2)}) a $${manualStop.toFixed(2)} (Prezzo attuale: $${currentPrice.toFixed(2)}, Carico: $${openPrice.toFixed(2)}, P&L: ${currentProfitPct.toFixed(2)}%). Chiusura eseguita.`
        };
      }
    }

    // --- LIVELLO 1: STOP TECNICO / DINAMICO PRIMARIO (ATR, DINAMICA IBRIDA A SCAGLIONI A DISTANZA DECRESCENTE) ---
    const atrRule = systemRules?.find(r => r.type === 'ATR_INDIVIDUAL_TRAILING_STOP');
    const isGlobalTechnicalEnabled = (atrRule ? atrRule.enabled : (config.useAtrTrailingStop ?? true));
    const isTechnicalDynamicStopEnabled = position.enableTechnicalStop !== undefined 
      ? position.enableTechnicalStop 
      : isGlobalTechnicalEnabled;
    const atrMultiplier = atrRule?.parameters?.atrMultiplier ?? config.atrMultiplier ?? 1.5;
    const qty = (typeof position.qty === 'number' && position.qty > 0) ? position.qty : 1;
    const minProfitBufferDollars = atrRule?.parameters?.minProfitBufferDollars ?? 0.04;
    
    // Parametri Dinamica Ibrida a Scaglioni (Distanza Decrescente dal Picco %)
    const tieredLockEnabled = atrRule?.parameters?.tieredProfitLockEnabled ?? true;
    const tier1ThresholdPct = atrRule?.parameters?.tier1ProfitThresholdPct ?? 0.50; // default +0.50%
    const tier1DistancePct = atrRule?.parameters?.tier1DistancePct ?? 0.30;          // default distanza 0.30%
    const tier2ThresholdPct = atrRule?.parameters?.tier2ProfitThresholdPct ?? 0.80; // default +0.80%
    const tier2DistancePct = atrRule?.parameters?.tier2DistancePct ?? 0.25;          // default distanza 0.25%
    const tier3ThresholdPct = atrRule?.parameters?.tier3ProfitThresholdPct ?? 1.00; // default +1.00%
    const tier3DistancePct = atrRule?.parameters?.tier3DistancePct ?? 0.20;          // default distanza 0.20%

    let activeTier = 0;
    let tierDistancePct = 0;
    let tierDescription = '';
    let tieredTrailingPrice = 0;

    if (tieredLockEnabled && highestProfitPct >= tier3ThresholdPct) {
      // Scaglione 3: Picco >= +1.00% -> Distanza decrescente 0.10% dal picco
      activeTier = 3;
      tierDistancePct = tier3DistancePct;
      tieredTrailingPrice = peakPrice * (1 - tierDistancePct / 100);
      tierDescription = `Scaglione 3 (≥+${tier3ThresholdPct.toFixed(2)}%: Distanza ${tierDistancePct.toFixed(2)}% dal picco)`;
    } else if (tieredLockEnabled && highestProfitPct >= tier2ThresholdPct) {
      // Scaglione 2: Picco +0.80% - +1.00% -> Distanza decrescente 0.20% dal picco
      activeTier = 2;
      tierDistancePct = tier2DistancePct;
      tieredTrailingPrice = peakPrice * (1 - tierDistancePct / 100);
      tierDescription = `Scaglione 2 (+${tier2ThresholdPct.toFixed(2)}%-+${tier3ThresholdPct.toFixed(2)}%: Distanza ${tierDistancePct.toFixed(2)}% dal picco)`;
    } else if (tieredLockEnabled && highestProfitPct >= tier1ThresholdPct) {
      // Scaglione 1: Picco +0.50% - +0.80% -> Distanza 0.30% dal picco
      activeTier = 1;
      tierDistancePct = tier1DistancePct;
      tieredTrailingPrice = peakPrice * (1 - tierDistancePct / 100);
      tierDescription = `Scaglione 1 (+${tier1ThresholdPct.toFixed(2)}%-+${tier2ThresholdPct.toFixed(2)}%: Distanza ${tierDistancePct.toFixed(2)}% dal picco)`;
    } else {
      // Scaglione 0: Picco < +0.50% -> Attivazione standard con Buffer Volatilità ATR 1.5x
      activeTier = 0;
      tierDescription = `Attivazione Base (<+${tier1ThresholdPct.toFixed(2)}%: Buffer ATR ${atrMultiplier.toFixed(1)}x)`;
    }

    // Se lo Stop Tecnico Dinamico è abilitato dall'utente, governa l'uscita a Trailing / Scaglioni
    if (isTechnicalDynamicStopEnabled && atr && atr > 0) {
      const atrDistance = atrMultiplier * atr;
      const rawAtrStopPrice = peakPrice - atrDistance;
      
      // La soglia effettiva di stop è calcolata dallo scaglione se attivo (>= +0.50%), altrimenti dall'ATR
      const effectiveTrailingStopPrice = (activeTier >= 1 && tieredTrailingPrice > 0)
        ? Math.max(rawAtrStopPrice, tieredTrailingPrice)
        : rawAtrStopPrice;

      const minRequiredTrailingStop = openPrice + (minProfitBufferDollars / qty);
      const isTrailingProfitActive = effectiveTrailingStopPrice >= minRequiredTrailingStop;
      const totalProtectedProfitDollars = (effectiveTrailingStopPrice - openPrice) * qty;
      const protectedProfitPct = ((effectiveTrailingStopPrice - openPrice) / openPrice) * 100;

      // Se il trailing / scaglione è attivo a protezione del profitto e il prezzo arretra sotto la soglia
      if (isTrailingProfitActive && currentPrice <= effectiveTrailingStopPrice) {
        return {
          action: 'CLOSE',
          reason: `[Dinamica Ibrida a Scaglioni - ${tierDescription}] Posizione ${asset} (Picco: $${peakPrice.toFixed(2)} / +${highestProfitPct.toFixed(2)}%) è rientrata sotto la soglia protetta a $${effectiveTrailingStopPrice.toFixed(2)} (Carico: $${openPrice.toFixed(2)}, Qty: ${qty}, Utile protetto: +${protectedProfitPct.toFixed(2)}% / +$${totalProtectedProfitDollars.toFixed(2)}, Prezzo attuale: $${currentPrice.toFixed(2)}, P&L: +${currentProfitPct.toFixed(2)}%). Chiusura a protezione del profitto.`
        };
      }
    }

    if (systemRules && systemRules.length > 0) {
      for (const rule of systemRules) {
        if (!rule.enabled) continue;

        // Regola 2 di Consenso: TIME_BASED_HOLDING (Obbligo di mantenimento posizione per almeno 60 minuti)
        const timeHoldingRule = systemRules?.find(r => r.type === 'TIME_BASED_HOLDING');
        const isTimeHoldingEnabled = timeHoldingRule?.enabled ?? true;
        const minHoldingMinutes = timeHoldingRule?.parameters?.minHoldingMinutes ?? 60;
        const isHoldingPeriodActive = isTimeHoldingEnabled && ageMinutes !== null && ageMinutes < minHoldingMinutes;

        // Regola: PNL_PREVENTIVE_CLOSE
        if (rule.type === 'PNL_PREVENTIVE_CLOSE') {
          if (isHoldingPeriodActive) {
            // Sotto i 60 minuti di holding, solo perdite severe oltre la soglia ordinaria o circuit breaker possono chiudere
            // Le chiusure preventive da rumore transitorio sono congelate per evitare churn
          } else {
            const maxLoss = rule.parameters.maxLossPct ?? -0.80;
            const minSent = rule.parameters.minSentimentThreshold ?? 0.20;
            if (currentProfitPct <= maxLoss && sentimentScore !== undefined && sentimentScore < minSent) {
              return {
                action: 'CLOSE',
                reason: `[Regola Sistema: PNL_PREVENTIVE_CLOSE] Posizione ${asset} con P&L negativo (${currentProfitPct.toFixed(2)}% <= ${maxLoss}%) e Sentiment debole (${sentimentScore.toFixed(2)} < ${minSent}). Chiusura preventiva mirata per liberare slot.`
              };
            }
          }
        }

        // Regola: SENTIMENT_LIQUIDITY_SELL
        if (rule.type === 'SENTIMENT_LIQUIDITY_SELL') {
          if (isHoldingPeriodActive) {
            // Chiusure per liquidità/sentiment congelate nei primi 60 minuti per evitare churn operativo
          } else {
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
        }

        // Regola: TIME_STAGNATION_CLOSE (Chiusura per Stagnazione / Time-Stop)
        if (rule.type === 'TIME_STAGNATION_CLOSE' && ageMinutes !== null) {
          const baseStagMins = Math.max(rule.parameters.stagnationMinutes ?? 30, isTimeHoldingEnabled ? minHoldingMinutes : 30);
          const highStagMins = Math.max(rule.parameters.stagnationMinutesHighSentiment ?? 60, isTimeHoldingEnabled ? minHoldingMinutes : 60);
          const stagMaxPnl = rule.parameters.stagnationMaxPnlPct ?? 0.10;

          let effectiveStagMins = baseStagMins;
          let sentimentDetail = '';

          if (sentimentScore !== undefined && sentimentScore > 0.30) {
            effectiveStagMins = highStagMins;
            sentimentDetail = ` (Sentiment ${sentimentScore.toFixed(2)} > 0.30 -> limite ${effectiveStagMins}m)`;
          } else if (sentimentScore !== undefined) {
            sentimentDetail = ` (Sentiment ${sentimentScore.toFixed(2)} -> limite ${effectiveStagMins}m)`;
          }

          if (ageMinutes >= effectiveStagMins && currentProfitPct <= stagMaxPnl) {
            return {
              action: 'CLOSE',
              reason: `[Regola Sistema: TIME_STAGNATION_CLOSE] Posizione ${asset} in stasi da ${ageMinutes.toFixed(1)} min (>= ${effectiveStagMins} min limite, Holding 60m rispettato)${sentimentDetail} con P&L stazionario/debole (${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}% <= +${stagMaxPnl}%). Chiusura automatica per liberare capitale immobile.`
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

      // 1. Stop Loss Dinamico in percentuale rispetto all'ingresso (se lo Stop Tecnico Dinamico è abilitato)
      if (isTechnicalDynamicStopEnabled) {
        const slMagnitudePct = Math.abs(effectiveSlPercent);
        const slThresholdPrice = openPrice * (1 - slMagnitudePct / 100);

        if (currentPrice <= slThresholdPrice) {
          return {
            action: 'CLOSE',
            reason: `[Stop Loss Dinamico ${effectiveSlPercent.toFixed(2)}%${slMultiplierNote}] Prezzo attuale $${currentPrice.toFixed(2)} <= soglia $${slThresholdPrice.toFixed(2)} (Entry: $${openPrice.toFixed(2)}, P&L: ${currentProfitPct.toFixed(2)}%).`
          };
        }
      }

      // 2. Stop Loss monetario in $ (se configurato e attivo)
      if (isTechnicalDynamicStopEnabled && config.defaultSL !== undefined && config.defaultSL !== 0) {
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
   * Valuta il filtro di volatilità/forza trend ADX con soglia dinamica:
   * Se la correlazione SPY-QQQ è >= 0.95, il filtro ADX per l'ingresso si riduce automaticamente da 19 a 14.
   */
  public static evaluateAdxVolatilityFilter(
    symbol: string,
    adxValue: number,
    systemRules?: RiskRuleConfig[],
    spyQqqCorrelation?: number
  ): { allowed: boolean; reason?: string; effectiveThreshold?: number; isDynamic?: boolean } {
    const adxRule = systemRules?.find(r => r.type === 'ADX_VOLATILITY_FILTER');
    const isEnabled = adxRule?.enabled ?? true;
    if (!isEnabled) {
      return { allowed: true };
    }

    const baseMinAdx = adxRule?.parameters?.minAdxThreshold ?? 19.0;
    const dynamicEnabled = adxRule?.parameters?.dynamicThresholdEnabled ?? true;
    const highCorrThreshold = adxRule?.parameters?.highCorrThreshold ?? 0.95;
    const reducedAdxThreshold = adxRule?.parameters?.reducedAdxThreshold ?? 14.0;

    const isHighCorr = spyQqqCorrelation !== undefined && spyQqqCorrelation >= highCorrThreshold;
    const effectiveMinAdx = (dynamicEnabled && isHighCorr) ? reducedAdxThreshold : baseMinAdx;

    if (adxValue < effectiveMinAdx) {
      const dynamicReasonPart = (dynamicEnabled && isHighCorr)
        ? ` (Correlazione SPY-QQQ ${spyQqqCorrelation!.toFixed(2)} >= ${highCorrThreshold} -> Soglia dinamica ridotta a ${reducedAdxThreshold.toFixed(1)})`
        : ` (Soglia standard: ${baseMinAdx.toFixed(1)}${spyQqqCorrelation !== undefined ? `, Corr SPY-QQQ: ${spyQqqCorrelation.toFixed(2)}` : ''})`;

      return {
        allowed: false,
        effectiveThreshold: effectiveMinAdx,
        isDynamic: dynamicEnabled && isHighCorr,
        reason: `[Regola Sistema: ADX_VOLATILITY_FILTER] ${symbol.toUpperCase()} presenta ADX(14) = ${adxValue.toFixed(1)} < ${effectiveMinAdx.toFixed(1)}${dynamicReasonPart}. Trend direzionale assente o insufficiente. Nuovi acquisti inibiti.`
      };
    }

    return { 
      allowed: true, 
      effectiveThreshold: effectiveMinAdx, 
      isDynamic: dynamicEnabled && isHighCorr 
    };
  }

  /**
   * Valuta il filtro di conferma tecnica del trend su timeframe 15m (Prezzo >= EMA 20 e EMA 20 >= EMA 50)
   * CORREZIONE STRATEGICA #2 [Adaptive EMA Filter]:
   * Sospensione automatica del filtro EMA 20/50 quando la correlazione SPY-QQQ supera 0.95 (trend corale broad market, cattura impulso senza lag).
   */
  public static evaluateEmaTrendFilter(
    symbol: string,
    currentPrice: number,
    ema20: number,
    ema50: number,
    isBullishEmaTrend: boolean,
    systemRules?: RiskRuleConfig[],
    spyQqqCorrelation?: number
  ): { allowed: boolean; isSuspendedDueToCorrelation?: boolean; reason?: string } {
    const emaRule = systemRules?.find(r => r.type === 'EMA_TREND_CONFIRMATION' || r.type === 'ADAPTIVE_EMA_FILTER');
    const isEnabled = emaRule?.enabled ?? true;
    if (!isEnabled) {
      return { allowed: true };
    }

    // Regola Adattiva: Sospensione del filtro EMA 20/50 se SPY-QQQ Correlation >= 0.95
    const suspendOnHighCorr = emaRule?.parameters?.suspendOnHighCorrelation ?? true;
    const highCorrThreshold = emaRule?.parameters?.highCorrelationThreshold ?? 0.95;

    if (suspendOnHighCorr && spyQqqCorrelation !== undefined && spyQqqCorrelation >= highCorrThreshold) {
      return {
        allowed: true,
        isSuspendedDueToCorrelation: true,
        reason: `[Adaptive EMA Filter] Correlazione SPY-QQQ a +${spyQqqCorrelation.toFixed(2)} >= ${highCorrThreshold.toFixed(2)}. Mercato in forte trend corale (broad market rally): filtro EMA 20/50 temporaneamente sospeso per consentire ingresso reattivo su ${symbol.toUpperCase()} senza subire il lag delle medie mobili.`
      };
    }

    if (!isBullishEmaTrend) {
      return {
        allowed: false,
        reason: `[Filtro Tecnico EMA 20/50 - 15m] ${symbol.toUpperCase()} ($${currentPrice.toFixed(2)}) non soddisfa la conferma tecnica di trend rialzista (EMA20: $${ema20.toFixed(2)}, EMA50: $${ema50.toFixed(2)}). Acquisto bloccato per evitare ingressi in controtendenza o caduta libera.`
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
        reason: `[Regola Sistema: SPY_QQQ_CORRELATION_SEMICON_CAP] Correlazione SPY-QQQ a +${spyQqqCorrelation.toFixed(2)} (>= ${minCorr}). L'esposizione complessiva ai semiconduttori (${prospectiveTotalSemicon.toFixed(2)}) raggiungerebbe il ${prospectivePct.toFixed(1)}% del NAV, eccedendo il limite massimo consentito del ${maxSemiconPct}%. Acquisto ${symUpper} bloccato per prevenire rischio di concentrazione settoriale.`
      };
    }

    return { allowed: true };
  }

  /**
   * 1. Filtro di Volatilità Operativa (ATR):
   * Inibisce l'apertura di nuovi trade se:
   * - L'ATR(14) normalizzato in % è < 1.5% (Soglia dinamica ridotta all'1.0% se la correlazione SPY-QQQ >= 0.95 - Dynamic Volatility Scaling)
   * - L'ATR(14) a 5 minuti è inferiore alla media mobile semplice a 20 periodi (SMA 20) dell'ATR stesso.
   */
  public static evaluateAtrVolatilityFilter(
    symbol: string,
    atr5m: number,
    atr5mSma20: number,
    systemRules?: RiskRuleConfig[],
    atrPercent?: number,
    spyQqqCorrelation?: number
  ): { allowed: boolean; reason?: string; effectiveThreshold?: number; isDynamicScalingActive?: boolean } {
    const atrRule = systemRules?.find(r => r.type === 'ATR_VOLATILITY_FILTER' || r.type === 'ATR_VOLATILITY_LOCK');
    const isEnabled = atrRule?.enabled ?? true;
    if (!isEnabled) {
      return { allowed: true };
    }

    // Dynamic Volatility Scaling: Se la correlazione statistica a 1h tra SPY e QQQ è >= 0.95,
    // la soglia di inibizione ATR(14) viene ridotta dinamicamente dal 1.5% all'1.0%.
    const dynamicScalingEnabled = atrRule?.parameters?.dynamicAtrScalingEnabled ?? true;
    const corrThreshold = atrRule?.parameters?.dynamicAtrCorrThreshold ?? 0.95;
    const reducedThreshold = atrRule?.parameters?.dynamicAtrReducedThreshold ?? 1.0;
    const defaultThreshold = atrRule?.parameters?.minAtrPercentThreshold ?? 1.5;

    const isHighCorr = spyQqqCorrelation !== undefined && spyQqqCorrelation >= corrThreshold;
    const isDynamicScalingActive = dynamicScalingEnabled && isHighCorr;
    const minAtrPct = isDynamicScalingActive ? reducedThreshold : defaultThreshold;

    // CORREZIONE STRATEGICA #3 [ATR Volatility Lock]: Blocco se ATR(14) normalizzato < minAtrPct
    const blockLowAtrPct = atrRule?.parameters?.blockLowAtrPercent ?? true;
    if (blockLowAtrPct && atrPercent !== undefined && atrPercent < minAtrPct) {
      const dynamicNote = isDynamicScalingActive 
        ? ` (soglia scalata dinamicamente all'${minAtrPct.toFixed(1)}% per forte correlazione SPY-QQQ ${spyQqqCorrelation?.toFixed(2)} >= ${corrThreshold})`
        : ` (soglia standard ${minAtrPct.toFixed(1)}%)`;
      return {
        allowed: false,
        reason: `[Filtro Volatilità ATR - Volatility Lock] ${symbol.toUpperCase()} presenta ATR(14) normalizzato = ${atrPercent.toFixed(2)}% < ${minAtrPct.toFixed(1)}%${dynamicNote}. Volatilità compressa / fase di consolidamento orizzontale priva di direzionalità. Ingressi bloccati per evitare chop.`,
        effectiveThreshold: minAtrPct,
        isDynamicScalingActive
      };
    }

    // Se l'ATR(14) a 5m è inferiore alla SMA(20) dell'ATR stesso (tolleranza 2% per stabilità)
    if (atr5m < atr5mSma20 * 0.98) {
      return {
        allowed: false,
        reason: `[Filtro Volatilità Operativa ATR] ${symbol.toUpperCase()} presenta ATR(14) 5m (${atr5m.toFixed(2)}) < SMA(20) dell'ATR (${atr5mSma20.toFixed(2)}). Volatilità/impulso di mercato insufficiente. Apertura inibita per evitare trade in compressione/rumore.`,
        effectiveThreshold: minAtrPct,
        isDynamicScalingActive
      };
    }

    return { allowed: true, effectiveThreshold: minAtrPct, isDynamicScalingActive };
  }

  /**
   * CORREZIONE STRATEGICA #3: Metodo dedicato [ATR Volatility Lock]
   * Inibisce l'apertura se l'oscillazione ATR(14)% è inferiore alla soglia di sicurezza (1.5% o 1.0% dinamico se Corr SPY-QQQ >= 0.95)
   */
  public static evaluateAtrVolatilityLock(
    symbol: string,
    atrPercent: number | undefined,
    systemRules?: RiskRuleConfig[],
    spyQqqCorrelation?: number
  ): { allowed: boolean; reason?: string; effectiveThreshold?: number; isDynamicScalingActive?: boolean } {
    if (atrPercent === undefined || isNaN(atrPercent)) {
      return { allowed: true };
    }

    const atrLockRule = systemRules?.find(r => r.type === 'ATR_VOLATILITY_LOCK' || r.type === 'ATR_VOLATILITY_FILTER');
    const isEnabled = atrLockRule?.enabled ?? true;
    if (!isEnabled) {
      return { allowed: true };
    }

    // Dynamic Volatility Scaling: Riduzione soglia da 1.5% a 1.0% se Corr SPY-QQQ >= 0.95
    const dynamicScalingEnabled = atrLockRule?.parameters?.dynamicAtrScalingEnabled ?? true;
    const corrThreshold = atrLockRule?.parameters?.dynamicAtrCorrThreshold ?? 0.95;
    const reducedThreshold = atrLockRule?.parameters?.dynamicAtrReducedThreshold ?? 1.0;
    const defaultThreshold = atrLockRule?.parameters?.minAtrPercentThreshold ?? 1.5;

    const isHighCorr = spyQqqCorrelation !== undefined && spyQqqCorrelation >= corrThreshold;
    const isDynamicScalingActive = dynamicScalingEnabled && isHighCorr;
    const minAtrPct = isDynamicScalingActive ? reducedThreshold : defaultThreshold;

    if (atrPercent < minAtrPct) {
      const dynamicNote = isDynamicScalingActive
        ? ` (soglia ridotta dinamicamente a ${minAtrPct.toFixed(1)}% per correlazione SPY-QQQ ${spyQqqCorrelation?.toFixed(2)} >= ${corrThreshold})`
        : ` (soglia standard ${minAtrPct.toFixed(1)}%)`;
      return {
        allowed: false,
        reason: `[ATR Volatility Lock] ${symbol.toUpperCase()} presenta ATR(14) normalizzato = ${atrPercent.toFixed(2)}% < ${minAtrPct.toFixed(1)}%${dynamicNote}. Volatilità compressa / mercato in consolidamento privo di direzionalità. Apertura bloccata per evitare falsi segnali in laterale.`,
        effectiveThreshold: minAtrPct,
        isDynamicScalingActive
      };
    }

    return { allowed: true, effectiveThreshold: minAtrPct, isDynamicScalingActive };
  }

  /**
   * 2. Hard-Risk Management & Cooldown Stop-Loss Consecutivi:
   * Valuta se applicare un cooldown di 30 minuti dopo 2 stop-loss consecutivi,
   * o se inibire l'operatività giornaliera al raggiungimento di una perdita del -1.00% del capitale.
   */
  public static evaluateHardRiskDailyLimit(
    dailyNetPnLPct: number,
    consecutiveSlCount: number,
    lastSlTimestamp: number | null,
    systemRules?: RiskRuleConfig[]
  ): { allowed: boolean; reason?: string } {
    const hardRiskRule = systemRules?.find(r => r.type === 'HARD_RISK_MANAGEMENT');
    const isEnabled = hardRiskRule?.enabled ?? true;
    if (!isEnabled) {
      return { allowed: true };
    }

    const maxDailyLossPct = hardRiskRule?.parameters?.maxDailyLossPct ?? -1.00;
    const cooldownMins = hardRiskRule?.parameters?.consecutiveSlCooldownMinutes ?? 30;
    const slThreshold = hardRiskRule?.parameters?.consecutiveSlThreshold ?? 2;

    // Controllo Blocco Giornaliero se PnL giornaliero <= maxDailyLossPct (es. -1.00%)
    if (dailyNetPnLPct <= maxDailyLossPct) {
      return {
        allowed: false,
        reason: `[Hard-Risk Management: Stop Giornaliero] Il P&L giornaliero netto (${dailyNetPnLPct.toFixed(2)}%) ha raggiunto o superato il limite di perdita massimo (${maxDailyLossPct.toFixed(2)}%). Operatività bloccata per il resto della sessione per proteggere il capitale.`
      };
    }

    // Cooldown di 30 minuti dopo 2 stop-loss consecutivi
    if (consecutiveSlCount >= slThreshold && lastSlTimestamp && lastSlTimestamp > 0) {
      const elapsedMins = (Date.now() - lastSlTimestamp) / (60 * 1000);
      if (elapsedMins < cooldownMins) {
        const remainingMins = Math.ceil(cooldownMins - elapsedMins);
        return {
          allowed: false,
          reason: `[Hard-Risk Management: Cooldown ${cooldownMins}m] Rilevati ${consecutiveSlCount} Stop-Loss consecutivi. Cooldown di protezione attivo: nuovi acquisti bloccati per ancora ${remainingMins} minuti.`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 3. [Consenso #1]: Trading Window Lockdown
   * - Inibizione apertura nuovi ordini BUY nelle fasce 09:30-10:30 EST (apertura ad alta inefficienza) e 15:30-16:00 EST (pre-chiusura)
   * - Privilegia l'esecuzione algoritmica nel blocco 12:00-14:30 EST (Win Rate 66.7%), subordinata ad ADX(14) > 14.0.
   */
  public static evaluateTradingWindowLockdown(
    estInfo: { totalMinutes: number; timeFormatted: string; hours: number; minutes: number },
    adxValue?: number,
    systemRules?: RiskRuleConfig[]
  ): { allowed: boolean; reason?: string; inPrimeWindow?: boolean } {
    const lockdownRule = systemRules?.find(r => r.type === 'TRADING_WINDOW_LOCKDOWN' || r.type === 'VOLATILITY_TIME_WINDOW_LOCK');
    const isEnabled = lockdownRule?.enabled ?? true;
    if (!isEnabled) {
      return { allowed: true };
    }

    const { totalMinutes, timeFormatted } = estInfo;
    const blockMorning = lockdownRule?.parameters?.blockMorningOpeningWindow ?? true;
    const blockAfternoon = lockdownRule?.parameters?.blockAfternoonClosingWindow ?? true;
    const minMiddayAdx = lockdownRule?.parameters?.minMiddayAdxThreshold ?? 14.0;
    const strictMiddayOnly = lockdownRule?.parameters?.strictMiddayOnly ?? false;

    // Fascia apertura inibita: 09:30 - 10:30 EST (570 - 630 minuti)
    const isMorningLock = totalMinutes >= 570 && totalMinutes < 630;
    if (blockMorning && isMorningLock) {
      return {
        allowed: false,
        reason: `[Trading Window Lockdown] Inibizione apertura nuovi ordini BUY nella fascia di apertura (09:30 - 10:30 EST, orario: ${timeFormatted}). Analisi inferenziale: inefficienze concentrate nell'ora di apertura. Ingressi bloccati a tutela del capitale.`
      };
    }

    // Fascia chiusura inibita: 15:30 - 16:00 EST (930 - 960 minuti) e post-mercato (>= 960)
    const isAfternoonLock = totalMinutes >= 930;
    if (blockAfternoon && isAfternoonLock) {
      return {
        allowed: false,
        reason: `[Trading Window Lockdown] Inibizione apertura nuovi ordini BUY nella fascia pre-chiusura / serale (>= 15:30 EST, orario: ${timeFormatted}). Spread elevati e volatilità non strutturata. Ingressi inibiti.`
      };
    }

    // Fascia di esecuzione privilegiata Midday: 12:00 - 14:30 EST (720 - 870 minuti)
    const isMiddayPrime = totalMinutes >= 720 && totalMinutes < 870;

    if (isMiddayPrime) {
      if (adxValue !== undefined && adxValue <= minMiddayAdx) {
        return {
          allowed: false,
          inPrimeWindow: true,
          reason: `[Trading Window Lockdown: Blocco Midday 12:00-14:30 EST] Esecuzione algoritmica privilegiata subordinata ad ADX(14) > ${minMiddayAdx.toFixed(1)}. Benchmark attuale ADX(14) = ${adxValue.toFixed(1)} <= ${minMiddayAdx.toFixed(1)} (assenza di trend direzionale). Nuovi ordini BUY temporaneamente inibiti.`
        };
      }
      return { allowed: true, inPrimeWindow: true };
    }

    // Fuori dal blocco Midday
    if (strictMiddayOnly) {
      return {
        allowed: false,
        inPrimeWindow: false,
        reason: `[Trading Window Lockdown: Strict Midday] Nuovi ingressi BUY limitati rigorosamente alla fascia ad alta efficienza (12:00 - 14:30 EST, Win Rate 66.7%). Orario attuale: ${timeFormatted}. Nuovi acquisti inibiti.`
      };
    }

    return { allowed: true, inPrimeWindow: false };
  }

  /**
   * 4. [Consenso #2]: Time-Based Holding
   * - Obbligo di mantenere la posizione per almeno 60 minuti dall'apertura per evitare il churn operativo
   * - Eccezione: Circuit Breaker Catastrofico (-3.00%) o stop estremi
   */
  public static evaluateTimeBasedHolding(
    symbol: string,
    entryTimestamp: number | null | undefined,
    currentProfitPct: number,
    systemRules?: RiskRuleConfig[]
  ): { canClose: boolean; reason?: string; ageMinutes?: number } {
    if (!entryTimestamp || entryTimestamp <= 0) {
      return { canClose: true };
    }

    const holdingRule = systemRules?.find(r => r.type === 'TIME_BASED_HOLDING');
    const isEnabled = holdingRule?.enabled ?? true;
    if (!isEnabled) {
      return { canClose: true };
    }

    const minHoldingMins = holdingRule?.parameters?.minHoldingMinutes ?? 60;
    const catastrophicThreshold = holdingRule?.parameters?.catastrophicMaxLossPct ?? -3.00;
    const ageMinutes = (Date.now() - entryTimestamp) / (60 * 1000);

    // Se siamo oltre i 60 minuti, il vincolo di holding è superato
    if (ageMinutes >= minHoldingMins) {
      return { canClose: true, ageMinutes };
    }

    // Se siamo sotto i 60 minuti ma la perdita è catastrofica (<= -3.00%), la sicurezza del conto prevale sempre
    if (currentProfitPct <= catastrophicThreshold) {
      return { 
        canClose: true, 
        ageMinutes,
        reason: `[Livello 2 - Circuit Breaker Catastrofico] Chiusura di emergenza autorizzata durante il periodo di holding: P&L ${currentProfitPct.toFixed(2)}% <= ${catastrophicThreshold.toFixed(2)}%.`
      };
    }

    return {
      canClose: false,
      ageMinutes,
      reason: `[Time-Based Holding: 60m] Posizione ${symbol} aperta da ${ageMinutes.toFixed(1)} min (< ${minHoldingMins} min minimi). Chiusura transitoria inibita per proteggere dalla volatilità e scongiurare il churn operativo.`
    };
  }

  /**
   * 5. [Consenso #3]: Macro-Sentiment Filter (VIX / IV < 30%)
   * - Inserimento obbligatorio di un filtro VIX/IV < 30% per procedere con nuovi ingressi BUY
   */
  public static evaluateMacroSentimentVixFilter(
    vixValue: number | undefined,
    systemRules?: RiskRuleConfig[]
  ): { allowed: boolean; reason?: string } {
    const vixRule = systemRules?.find(r => r.type === 'MACRO_VOLATILITY_VIX_FILTER');
    const isEnabled = vixRule?.enabled ?? true;
    if (!isEnabled || vixValue === undefined || isNaN(vixValue)) {
      return { allowed: true };
    }

    const maxVix = vixRule?.parameters?.maxVixThreshold ?? 30.0;

    if (vixValue >= maxVix) {
      return {
        allowed: false,
        reason: `[Regola Sistema: MACRO_VOLATILITY_VIX_FILTER] Indice di Volatilità VIX / IV di mercato = ${vixValue.toFixed(2)}% (>= ${maxVix.toFixed(1)}%). Regime di rischio sistemico e volatilità estrema. Nuovi ordini BUY inibiti a salvaguardia del capitale.`
      };
    }

    return { allowed: true };
  }

  /**
   * CORREZIONE STRATEGICA #1 [Time-Based Volatility Threshold]:
   * Inibisce l'operatività Long nella fascia di apertura di mercato (09:30-10:30 EST)
   * se la variazione percentuale del VIX a 1 ora (ΔVIX 1h) è > +0.50%.
   * Razionale: WR 0% nelle prime fasi di mercato con volatilità crescente. Riduce il drawdown iniziale evitando il rumore di apertura.
   */
  public static evaluateTimeBasedVolatilityThreshold(
    estInfo: { totalMinutes: number; timeFormatted: string; hours?: number; minutes?: number },
    vix1hChangePct: number | undefined,
    systemRules?: RiskRuleConfig[]
  ): { allowed: boolean; reason?: string } {
    const vixTimeRule = systemRules?.find(r => r.type === 'TIME_BASED_VOLATILITY_THRESHOLD');
    const isEnabled = vixTimeRule?.enabled ?? true;
    if (!isEnabled || vix1hChangePct === undefined || isNaN(vix1hChangePct)) {
      return { allowed: true };
    }

    const { totalMinutes, timeFormatted } = estInfo;
    const thresholdPct = vixTimeRule?.parameters?.vix1hChangeThresholdPct ?? 0.5;

    // Default: Fascia apertura 09:30 - 10:30 EST (570 - 630 minuti)
    const isOpeningWindow = totalMinutes >= 570 && totalMinutes < 630;

    if (isOpeningWindow && vix1hChangePct > thresholdPct) {
      return {
        allowed: false,
        reason: `[Time-Based Volatility Threshold] Variazione VIX 1h a +${vix1hChangePct.toFixed(2)}% (> +${thresholdPct.toFixed(2)}%) tra le 09:30 e le 10:30 EST (${timeFormatted}). Operatività Long inibita per evitare rumore operativo e drawdown iniziale (Win Rate storico 0% in apertura volatile).`
      };
    }

    return { allowed: true };
  }

  /**
   * REGOLA DI CONSENSO #1 [Filtro di Correlazione e Momentum]:
   * Operare solo se SPY-QQQ Corr >= 0.95, RSI(14) > 70 o < 30, e VIX < 18.
   * In caso contrario, imposta posizione/segnale in HOLD.
   * 
   * Dettagli e Razionale di Analisi:
   * "La seduta del 2026-08-27 ha mostrato un Win Rate dello 0% a causa dell'assenza di filtri statistici.
   * Questa regola impone disciplina, riducendo l'overtrading in mercati laterali e filtrando i setup a bassa probabilità."
   */
  public static evaluateCorrelationMomentumFilter(
    symbol: string,
    spyQqqCorrelation: number | undefined,
    rsi14: number | undefined,
    vixValue: number | undefined,
    systemRules?: RiskRuleConfig[]
  ): { allowed: boolean; action: 'BUY' | 'HOLD'; reason?: string; metrics: { corr: number; rsi: number; vix: number } } {
    const rule = systemRules?.find(r => r.type === 'CORRELATION_MOMENTUM_FILTER');
    const isEnabled = rule?.enabled ?? true;

    const corr = spyQqqCorrelation !== undefined && !isNaN(spyQqqCorrelation) ? spyQqqCorrelation : 0.92;
    const rsi = rsi14 !== undefined && !isNaN(rsi14) ? rsi14 : 50.0;
    const vix = vixValue !== undefined && !isNaN(vixValue) ? vixValue : 15.0;

    const metrics = { corr, rsi, vix };

    if (!isEnabled) {
      return { allowed: true, action: 'BUY', metrics };
    }

    const minCorr = rule?.parameters?.minSpyQqqCorrelation ?? 0.95;
    const rsiLower = rule?.parameters?.rsiLowerThreshold ?? 30.0;
    const rsiUpper = rule?.parameters?.rsiUpperThreshold ?? 70.0;
    const maxVix = rule?.parameters?.maxVixMomentumThreshold ?? 18.0;

    const isCorrValid = corr >= minCorr;
    const isRsiExtreme = rsi > rsiUpper || rsi < rsiLower;
    const isVixSafe = vix < maxVix;

    if (!isCorrValid || !isRsiExtreme || !isVixSafe) {
      const failures: string[] = [];
      if (!isCorrValid) failures.push(`Corr SPY-QQQ ${corr.toFixed(2)} < ${minCorr.toFixed(2)}`);
      if (!isRsiExtreme) failures.push(`RSI(14) ${rsi.toFixed(1)} compreso tra ${rsiLower.toFixed(0)} e ${rsiUpper.toFixed(0)} (assenza di momentum breakout o rimbalzo ipervenduto)`);
      if (!isVixSafe) failures.push(`VIX ${vix.toFixed(1)} >= ${maxVix.toFixed(1)} (volatilità macro elevata)`);

      return {
        allowed: false,
        action: 'HOLD',
        reason: `[Regola 1: Filtro Correlazione e Momentum] Setup non conforme per ${symbol.toUpperCase()}: ${failures.join(' | ')}. Posizione impostata in HOLD per disciplina statistica (evita overtrading in mercati laterali e setup a bassa probabilità).`,
        metrics
      };
    }

    return {
      allowed: true,
      action: 'BUY',
      reason: `[Regola 1: Filtro Correlazione e Momentum Soddisfatto] ${symbol.toUpperCase()}: Corr SPY-QQQ ${corr.toFixed(2)} >= ${minCorr.toFixed(2)}, RSI(14) ${rsi.toFixed(1)} (Breakout/Reversal confermato), VIX ${vix.toFixed(1)} < ${maxVix.toFixed(1)}. Ingresso autorizzato.`,
      metrics
    };
  }

  /**
   * REGOLA DI CONSENSO #3 [Filtro Orario Sessione Pomeridiana]:
   * Sospensione operativa nella fascia 14:00-15:30 EST salvo condizioni di trend estremo (ADX > 30, SPY-QQQ Corr >= 0.98 o RSI estremo < 20 / > 80).
   */
  public static evaluateAfternoonSessionSuspension(
    estInfo: { totalMinutes: number; timeFormatted: string; hours?: number; minutes?: number },
    adxValue?: number,
    spyQqqCorrelation?: number,
    rsi14?: number,
    systemRules?: RiskRuleConfig[]
  ): { allowed: boolean; isExtremeTrendExemption?: boolean; reason?: string } {
    const rule = systemRules?.find(r => r.type === 'AFTERNOON_SESSION_SUSPENSION');
    const isEnabled = rule?.enabled ?? true;
    if (!isEnabled) {
      return { allowed: true };
    }

    const { totalMinutes, timeFormatted } = estInfo;
    // Fascia 14:00 - 15:30 EST (840 a 930 minuti)
    const isAfternoonSuspension = totalMinutes >= 840 && totalMinutes < 930;
    if (!isAfternoonSuspension) {
      return { allowed: true };
    }

    const extremeAdxThreshold = rule?.parameters?.extremeTrendAdxOverride ?? 30.0;
    const extremeCorrThreshold = rule?.parameters?.extremeTrendCorrOverride ?? 0.98;

    const hasExtremeTrend = (adxValue !== undefined && adxValue >= extremeAdxThreshold) ||
                           (spyQqqCorrelation !== undefined && spyQqqCorrelation >= extremeCorrThreshold) ||
                           (rsi14 !== undefined && (rsi14 >= 80 || rsi14 <= 20));

    if (hasExtremeTrend) {
      return {
        allowed: true,
        isExtremeTrendExemption: true,
        reason: `[Filtro Orario Pomeridiano: Esenzione Trend Estremo] Finestra 14:00-15:30 EST (${timeFormatted}) superata per condizione di trend estremo (ADX: ${adxValue?.toFixed(1) || 'N/D'}, Corr: ${spyQqqCorrelation?.toFixed(2) || 'N/D'}, RSI: ${rsi14?.toFixed(1) || 'N/D'}). Ingresso autorizzato.`
      };
    }

    return {
      allowed: false,
      isExtremeTrendExemption: false,
      reason: `[Filtro Orario Pomeridiano: Sospensione 14:00-15:30 EST] Orario attuale ${timeFormatted} nella fascia di consolidamento pomeridiano. Nuovi ingressi BUY sospesi (HOLD) salvo condizioni di trend estremo (ADX >= ${extremeAdxThreshold}, Corr >= ${extremeCorrThreshold}).`
    };
  }
}


