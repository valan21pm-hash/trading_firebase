export interface Position {
  id: string;
  asset: string; // es. 'EURUSD', 'XAUUSD', 'AAPL', 'SPY', 'GLD'
  currentValue: number; // Valore attuale della posizione in € o $
  openPrice: number;
  currentPrice: number;
  unrealizedProfit: number; // Profitto/Perdita attuale non realizzato in € o $
  highestPrice?: number; // Massimo prezzo raggiunto registrato (per Trailing Stop)
}

export interface RiskConfig {
  y?: number; // Parametro Y della strategia
  defaultSL?: number; // Stop Loss personalizzato ($)
  defaultTP?: number; // Target di attivazione del Trailing Stop ($)
  trailingStop?: number; // Distanza Trailing Stop in % (es: 0.30 = 0.30%)
  targetTpPct?: number; // Target di attivazione % (es: 0.80 = +0.80%)
  slPct?: number; // Stop Loss % (es: -0.40 = -0.40%)
  isAlpaca?: boolean;
}

/**
 * Valuta se una singola posizione deve essere chiusa in base alle regole di risk management,
 * al target di attivazione e al trailing stop dinamico.
 */
export class RiskManagementService {
  
  /**
   * Determina l'azione da intraprendere sulla singola posizione corrente basandosi sul prezzo d'ingresso,
   * il prezzo massimo raggiunto (peakPrice) e i parametri della strategia applicata alla singola posizione.
   * 
   * - Al raggiungimento del Target di Attivazione (es. +0.80% Prudente):
   *   1. Si attiva il Trailing Stop Dinamico dal massimo prezzo toccato.
   *   2. Lo Stop Loss viene alzato a Break-Even (prezzo di carico) per proteggere la posizione.
   * - Prima dell'attivazione:
   *   Vale lo Stop Loss standard della strategia (es. -0.40% Prudente).
   */
  public static evaluateClosure(
    position: Position, 
    _historicalProfits: number, 
    config: RiskConfig
  ): { action: 'CLOSE'; reason: string } | null {
    const { unrealizedProfit, openPrice, currentPrice, highestPrice, asset } = position;

    // Se non abbiamo un prezzo d'ingresso valido o un prezzo corrente, non possiamo calcolare i livelli
    if (!openPrice || openPrice <= 0 || !currentPrice || currentPrice <= 0) {
      return null;
    }

    // Picco massimo di prezzo raggiunto per questa singola posizione (High Water Mark)
    const peakPrice = (highestPrice && highestPrice > currentPrice) ? highestPrice : currentPrice;

    // Percentuali di profitto calcolate unicamente rispetto al prezzo medio d'ingresso della SINGOLA posizione
    const currentProfitPct = ((currentPrice - openPrice) / openPrice) * 100;
    const highestProfitPct = ((peakPrice - openPrice) / openPrice) * 100;

    // Parametri della strategia per la posizione singola
    const activationTargetPct = config.targetTpPct !== undefined ? config.targetTpPct : 0.80;
    const tsPercent = config.trailingStop !== undefined ? config.trailingStop : 0.30;
    const slPercent = config.slPct !== undefined ? config.slPct : -0.40;

    // Verifichiamo se il picco massimo toccato ha raggiunto o superato il Target di Attivazione
    const isActivated = highestProfitPct >= (activationTargetPct - 0.0001);

    if (isActivated) {
      // --- REGIME POSIZIONE ATTIVATA ---

      // 1. Trailing Stop Dinamico calcolato dal picco massimo di prezzo (peakPrice)
      const trailingStopPrice = peakPrice * (1 - tsPercent / 100);

      if (currentPrice <= trailingStopPrice) {
        return {
          action: 'CLOSE',
          reason: `[Trailing Stop Dinamico ${tsPercent}%] Posizione ${asset} attivata (picco +${highestProfitPct.toFixed(2)}% >= target +${activationTargetPct.toFixed(2)}%). Picco max: $${peakPrice.toFixed(2)}, Soglia Trailing: $${trailingStopPrice.toFixed(2)}, Prezzo attuale: $${currentPrice.toFixed(2)} (P&L: ${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}%).`
        };
      }

      // 2. Protezione Break-Even: una volta raggiunto il target di attivazione, lo Stop Loss è fisso al prezzo d'ingresso
      if (currentPrice <= openPrice) {
        return {
          action: 'CLOSE',
          reason: `[Stop Loss Protezione Break-Even] Posizione ${asset} attivata (picco +${highestProfitPct.toFixed(2)}%), rientrata a prezzo di carico ($${currentPrice.toFixed(2)} <= $${openPrice.toFixed(2)}).`
        };
      }

    } else {
      // --- REGIME POSIZIONE NON ANCORA ATTIVATA ---

      // 1. Stop Loss standard in percentuale rispetto all'ingresso (es. -0.40% Prudente)
      const slMagnitudePct = Math.abs(slPercent);
      const slThresholdPrice = openPrice * (1 - slMagnitudePct / 100);

      if (currentPrice <= slThresholdPrice) {
        return {
          action: 'CLOSE',
          reason: `[Stop Loss ${slPercent}%] Prezzo attuale $${currentPrice.toFixed(2)} <= soglia $${slThresholdPrice.toFixed(2)} (Entry: $${openPrice.toFixed(2)}, P&L: ${currentProfitPct.toFixed(2)}%).`
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
}

