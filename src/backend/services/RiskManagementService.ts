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
}

/**
 * Valuta se una singola posizione deve essere chiusa in base alle regole di risk management,
 * al target di attivazione, al trailing stop dinamico e all'interazione con il Sentiment LLM.
 */
export class RiskManagementService {
  
  /**
   * Determina l'azione da intraprendere sulla singola posizione corrente basandosi sul prezzo d'ingresso,
   * il prezzo massimo raggiunto (peakPrice), i parametri della strategia e lo Score di Sentiment.
   * 
   * Sinergia Stop Loss - Sentiment:
   * 1. Dynamic Stop Loss:
   *    - Sentiment Alto (> +0.40): Amplia la tolleranza allo Stop Loss (es. x1.33) per evitare shakeout da volatilità di breve.
   *    - Sentiment Debole (0.00 <= S <= 0.20): Rstringe lo Stop Loss (es. x0.65) per tagliare rapidamente le perdite in assenza di spinta.
   *    - Sentiment Negativo (< 0.00): Ristretto ulteriormente (es. x0.40).
   * 2. Soft Stop / Early Warning:
   *    - Se in perdita e il Sentiment crolla di >= 0.20 o scende <= +0.05, chiude anticipatamente la posizione.
   * 3. Trailing Stop Accelerato dal Sentiment:
   *    - Se la posizione è attivata ma il Sentiment scende (Divergenza), il Trailing Stop si stringe del 50% per blindare i profitti.
   */
  public static evaluateClosure(
    position: Position, 
    _historicalProfits: number, 
    config: RiskConfig
  ): { action: 'CLOSE'; reason: string } | null {
    const { unrealizedProfit, openPrice, currentPrice, highestPrice, asset, sentimentScore, previousSentimentScore, vix24hChangePct } = position;

    // Se non abbiamo un prezzo d'ingresso valido o un prezzo corrente, non possiamo calcolare i livelli
    if (!openPrice || openPrice <= 0 || !currentPrice || currentPrice <= 0) {
      return null;
    }

    // Percentuali di profitto/perdita calcolate unicamente rispetto al prezzo medio d'ingresso della SINGOLA posizione
    const currentProfitPct = ((currentPrice - openPrice) / openPrice) * 100;

    // --- REGOLE SPECIFICHE DI RISCHIO E GESTIONE LIQUIDITA' / SENTIMENT ---

    // REGOLA 1: Se P&L <= -0.80% e Sentiment < 0.20 -> Chiusura preventiva per liberare slot per asset con Sentiment > 0.40
    if (currentProfitPct <= -0.80 && sentimentScore !== undefined && sentimentScore < 0.20) {
      return {
        action: 'CLOSE',
        reason: `[Chiusura Preventiva P&L -0.80%] Posizione ${asset} con P&L negativo (${currentProfitPct.toFixed(2)}% <= -0.80%) e Sentiment debole (${sentimentScore.toFixed(2)} < 0.20). Chiusura preventiva per liberare slot per asset con Sentiment > 0.40.`
      };
    }

    // REGOLA 2: Se Sentiment < 0.15 -> Vendi immediatamente per liberare liquidità, a meno che VIX in calo > 2% nelle 24h
    if (sentimentScore !== undefined && sentimentScore < 0.15) {
      const isVixDroppingOver2Pct = vix24hChangePct !== undefined && vix24hChangePct < -2.0;
      if (!isVixDroppingOver2Pct) {
        const vixText = vix24hChangePct !== undefined ? `${vix24hChangePct.toFixed(2)}%` : 'N/A';
        return {
          action: 'CLOSE',
          reason: `[Vendita Liquidità Sentiment < 0.15] Sentiment per ${asset} sceso a ${sentimentScore.toFixed(2)} (< 0.15) e VIX non in calo > 2% (VIX 24h: ${vixText}). Vendi immediatamente per liberare liquidità.`
        };
      }
    }

    // Picco massimo di prezzo raggiunto per questa singola posizione (High Water Mark)
    const peakPrice = (highestPrice && highestPrice > currentPrice) ? highestPrice : currentPrice;
    const highestProfitPct = ((peakPrice - openPrice) / openPrice) * 100;

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
        // Sentiment forte: allarghiamo del 33% la soglia di tolleranza (es. -0.75% -> -1.0%)
        effectiveSlPercent = baseSlPercent * 1.3333;
        slMultiplierNote = " [Dynamic SL: Tolleranza allargata per Sentiment alto (>+0.40)]";
      } else if (sentimentScore >= 0.00 && sentimentScore <= 0.20) {
        // Sentiment debole: stringiamo al 65% del valore base (es. -0.75% -> -0.48%)
        effectiveSlPercent = baseSlPercent * 0.65;
        slMultiplierNote = " [Dynamic SL: Soglia ristretta per Sentiment debole (<=+0.20)]";
      } else if (sentimentScore < 0.00) {
        // Sentiment negativo: stringiamo al 40%
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

      // 3. TRAILING STOP ACCELERATO DAL SENTIMENT
      let effectiveTsPercent = baseTsPercent;
      let tsNote = "";

      if (useSentimentOpt && sentimentScore !== undefined && sentimentScore <= 0.20) {
        // Se la posizione è in guadagno ma il sentiment si deteriora, acceleriamo il Trailing Stop riducendone la distanza del 50%
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
   * 4. RIAUTORIZZAZIONE E RIAPPROVVIGIONAMENTO SPAZIO IN PORTAFOGLIO (Opportunity Cost Reallocation)
   * Valuta se una posizione esistente in perdita e con sentiment debole debba essere chiusa
   * per liberare uno slot di portafoglio saturo (es. 10/10) a favore di un nuovo acquisto ad alto sentiment (> +0.40).
   */
  public static evaluateOpportunityCostExit(
    positions: Position[],
    newCandidateSentiment: number,
    maxConcurrentPositions: number = 10
  ): { candidateToClose: Position; reason: string } | null {
    if (positions.length < maxConcurrentPositions || newCandidateSentiment < 0.40) {
      return null;
    }

    // Cerca la posizione in perdita con il sentiment più basso (<= 0.15)
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
}


