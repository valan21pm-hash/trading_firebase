import { addLog } from "../../../server";

export interface StatisticalMetrics {
  timestamp: string;
  indexPrices: Record<string, number>;
  indexChanges24h: Record<string, number>;
  correlations: {
    spy_qqq: number; // Correlazione SPY vs QQQ
    spy_vix: number; // Correlazione SPY vs VIX
    qqq_iwm: number; // Correlazione QQQ vs IWM
    market_coherence: number; // Score di coerenza correnza mercato (-1.0 a +1.0)
  };
  marketState: 'BULLISH_COHERENT' | 'BEARISH_COHERENT' | 'DIVERGENT_ROTATION' | 'HIGH_VOLATILITY_PANIC' | 'NEUTRAL_STAGNANT';
  statisticalAdvice: string;
  divergenceWarning: boolean;
  recommendedPositionSizeMultiplier: number; // Multiplier tra 0.5 e 1.2
}

class StatisticalExpertService {
  private static instance: StatisticalExpertService;
  private latestMetrics: StatisticalMetrics = {
    timestamp: new Date().toISOString(),
    indexPrices: { SPY: 520, QQQ: 450, DIA: 390, IWM: 200, VIX: 15 },
    indexChanges24h: { SPY: 0.1, QQQ: 0.2, DIA: -0.1, IWM: 0.0, VIX: -1.2 },
    correlations: {
      spy_qqq: 0.92,
      spy_vix: -0.85,
      qqq_iwm: 0.78,
      market_coherence: 0.82
    },
    marketState: 'BULLISH_COHERENT',
    statisticalAdvice: 'Gli indici principali mostrano una correlazione positiva elevata (+0.92) e stabilità. Condizioni statisticamente favorevoli.',
    divergenceWarning: false,
    recommendedPositionSizeMultiplier: 1.0
  };

  private priceHistory: Record<string, number[]> = {
    SPY: [515, 516, 518, 517, 519, 520],
    QQQ: [442, 444, 447, 446, 448, 450],
    DIA: [388, 389, 390, 389, 390, 390],
    IWM: [198, 199, 200, 199, 200, 200],
    VIX: [16.5, 16.2, 15.8, 16.0, 15.5, 15.0]
  };

  private constructor() {}

  public static getInstance(): StatisticalExpertService {
    if (!StatisticalExpertService.instance) {
      StatisticalExpertService.instance = new StatisticalExpertService();
    }
    return StatisticalExpertService.instance;
  }

  /**
   * Calcola la correlazione di Pearson tra due serie numeriche
   */
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;

    const sliceX = x.slice(-n);
    const sliceY = y.slice(-n);

    const meanX = sliceX.reduce((a, b) => a + b, 0) / n;
    const meanY = sliceY.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = sliceX[i] - meanX;
      const dy = sliceY[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    if (denX === 0 || denY === 0) return 0;
    return Math.max(-1.0, Math.min(1.0, num / (Math.sqrt(denX) * Math.sqrt(denY))));
  }

  /**
   * Aggiorna lo storico e ricalcola le metriche di correlazione probabilistiche
   */
  public updateIndexPrices(prices: Record<string, number>, changes24h: Record<string, number>): StatisticalMetrics {
    for (const [sym, price] of Object.entries(prices)) {
      if (!this.priceHistory[sym]) this.priceHistory[sym] = [];
      this.priceHistory[sym].push(price);
      if (this.priceHistory[sym].length > 30) {
        this.priceHistory[sym].shift();
      }
    }

    const spyQqqCorr = this.calculatePearsonCorrelation(this.priceHistory.SPY || [], this.priceHistory.QQQ || []);
    const spyVixCorr = this.calculatePearsonCorrelation(this.priceHistory.SPY || [], this.priceHistory.VIX || []);
    const qqqIwmCorr = this.calculatePearsonCorrelation(this.priceHistory.QQQ || [], this.priceHistory.IWM || []);

    const spyChg = changes24h.SPY ?? 0;
    const qqqChg = changes24h.QQQ ?? 0;
    const vixChg = changes24h.VIX ?? 0;
    const iwmChg = changes24h.IWM ?? 0;

    // Coerenza di mercato: quanto la direzione degli indici principali concorda
    const sameDirection = Math.sign(spyChg) === Math.sign(qqqChg) && Math.sign(spyChg) === Math.sign(iwmChg);
    const marketCoherence = sameDirection ? Math.abs((spyChg + qqqChg + iwmChg) / 3) : -Math.abs(spyChg - qqqChg);

    let state: StatisticalMetrics['marketState'] = 'NEUTRAL_STAGNANT';
    let advice = '';
    let divergence = false;
    let sizeMultiplier = 1.0;

    if (vixChg > 8.0 || (changes24h.VIX ?? 0) > 22.0) {
      state = 'HIGH_VOLATILITY_PANIC';
      advice = `[Allerta Statistica] Impennata VIX (+${vixChg.toFixed(1)}%). Elevata probabilità di falsa rottura e drawdown repentino. Riduzione posizione consigliata (-50%).`;
      divergence = true;
      sizeMultiplier = 0.5;
    } else if (spyChg > 0.3 && qqqChg > 0.3 && spyQqqCorr > 0.5) {
      state = 'BULLISH_COHERENT';
      advice = `[Sincronia Rialzista] SPY (+${spyChg.toFixed(2)}%) e QQQ (+${qqqChg.toFixed(2)}%) correlati positivamente (Corr: +${spyQqqCorr.toFixed(2)}). Contesto statistico ottimale per posizioni Long.`;
      sizeMultiplier = 1.1;
    } else if (spyChg < -0.4 && qqqChg < -0.4) {
      state = 'BEARISH_COHERENT';
      advice = `[Pressione Ribassista Sincrona] Flessione diffusa di SPY (${spyChg.toFixed(2)}%) e QQQ (${qqqChg.toFixed(2)}%). Rischio elevato sugli acquisti speculativi.`;
      sizeMultiplier = 0.6;
    } else if (Math.sign(spyChg) !== Math.sign(qqqChg) || spyQqqCorr < 0) {
      state = 'DIVERGENT_ROTATION';
      advice = `[Divergenza Indici] Disallineamento tra SPY (${spyChg >= 0 ? '+' : ''}${spyChg.toFixed(2)}%) e QQQ (${qqqChg >= 0 ? '+' : ''}${qqqChg.toFixed(2)}%) (Correlazione: ${spyQqqCorr.toFixed(2)}). Possibile rotazione settoriale. Selezionare solo asset a sentiment eccezionale (>0.35).`;
      divergence = true;
      sizeMultiplier = 0.75;
    } else {
      state = 'NEUTRAL_STAGNANT';
      advice = `[Fase Stazionaria] Indici in consolidamento. Correlazione SPY-QQQ a +${spyQqqCorr.toFixed(2)}. Operatività normale con rigido rispetto dei limiti di stasi.`;
      sizeMultiplier = 1.0;
    }

    this.latestMetrics = {
      timestamp: new Date().toISOString(),
      indexPrices: { ...prices },
      indexChanges24h: { ...changes24h },
      correlations: {
        spy_qqq: parseFloat(spyQqqCorr.toFixed(3)),
        spy_vix: parseFloat(spyVixCorr.toFixed(3)),
        qqq_iwm: parseFloat(qqqIwmCorr.toFixed(3)),
        market_coherence: parseFloat(marketCoherence.toFixed(3))
      },
      marketState: state,
      statisticalAdvice: advice,
      divergenceWarning: divergence,
      recommendedPositionSizeMultiplier: parseFloat(sizeMultiplier.toFixed(2))
    };

    // Registra log del modulo statistico
    try {
      addLog('paper', `[Modulo Statistico] Stato: ${state} | SPY-QQQ Corr: ${spyQqqCorr.toFixed(2)} | VIX 24h: ${vixChg.toFixed(1)}% | ${advice}`);
    } catch {
      // Ignore log if not initialized yet
    }

    return this.latestMetrics;
  }

  /**
   * Valuta statisticamente se l'acquisto di un determinato asset è consigliato o sconsigliato
   */
  public evaluateTradePermission(symbol: string, sentimentScore: number): { allowed: boolean; reason: string; sizeMultiplier: number } {
    const { marketState, correlations, indexChanges24h, recommendedPositionSizeMultiplier } = this.latestMetrics;

    const spyChg = indexChanges24h.SPY ?? 0;
    const qqqChg = indexChanges24h.QQQ ?? 0;

    // Se c'è panico sul VIX o forte pressione ribassista diffusa, richiediamo un sentiment molto più elevato
    if (marketState === 'HIGH_VOLATILITY_PANIC' && sentimentScore < 0.35) {
      return {
        allowed: false,
        reason: `[Veto Statistico - High Volatility] Panico e volatilità su VIX (+${indexChanges24h.VIX?.toFixed(1) || '0'}%). Sentiment (${sentimentScore.toFixed(2)}) insufficiente per superare il rischio macro.`,
        sizeMultiplier: 0.5
      };
    }

    if (marketState === 'BEARISH_COHERENT' && sentimentScore < 0.25) {
      return {
        allowed: false,
        reason: `[Veto Statistico - Mercado Ribassista] SPY (${spyChg.toFixed(2)}%) e QQQ (${qqqChg.toFixed(2)}%) in calo sincrono. L'acquisto di ${symbol} richiede sentiment > 0.25 (attuale: ${sentimentScore.toFixed(2)}).`,
        sizeMultiplier: 0.6
      };
    }

    if (marketState === 'DIVERGENT_ROTATION' && sentimentScore < 0.20) {
      return {
        allowed: false,
        reason: `[Veto Statistico - Divergenza Indici] Indici disallineati (Correlazione SPY-QQQ: ${correlations.spy_qqq.toFixed(2)}). Filtro di prudenza attivo per ${symbol}.`,
        sizeMultiplier: 0.75
      };
    }

    return {
      allowed: true,
      reason: `[Approvazione Statistica] Condizioni di mercato stabili (${marketState}). Correlazione SPY-QQQ: +${correlations.spy_qqq.toFixed(2)}. Moltiplicatore taglia: ${recommendedPositionSizeMultiplier}x.`,
      sizeMultiplier: recommendedPositionSizeMultiplier
    };
  }

  public getMetrics(): StatisticalMetrics {
    return this.latestMetrics;
  }

  public getPromptContext(): string {
    const { marketState, correlations, indexChanges24h, statisticalAdvice } = this.latestMetrics;
    return `--- MODULO STATISTICO & CORRELAZIONE INDICI ---
Stato Mercato: ${marketState}
Variazioni 24h: SPY (${(indexChanges24h.SPY ?? 0) >= 0 ? '+' : ''}${(indexChanges24h.SPY ?? 0).toFixed(2)}%), QQQ (${(indexChanges24h.QQQ ?? 0) >= 0 ? '+' : ''}${(indexChanges24h.QQQ ?? 0).toFixed(2)}%), VIX (${(indexChanges24h.VIX ?? 0) >= 0 ? '+' : ''}${(indexChanges24h.VIX ?? 0).toFixed(2)}%)
Correlazione SPY/QQQ: ${correlations.spy_qqq} | Correlazione SPY/VIX: ${correlations.spy_vix}
Coerenza di Mercato: ${correlations.market_coherence}
Valutazione Statistica dell'Esperto: ${statisticalAdvice}`;
  }
}

export default StatisticalExpertService;
