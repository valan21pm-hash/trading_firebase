export interface Position {
  id: string;
  asset: string; // es. 'EURUSD', 'XAUUSD', 'AAPL', 'SPY'
  currentValue: number; // Valore attuale della posizione in € o $
  openPrice: number;
  currentPrice: number;
  unrealizedProfit: number; // Profitto/Perdita attuale non realizzato in € o $
  highestPrice?: number; // Massimo prezzo raggiunto registrato (per Trailing Stop)
}

export interface RiskConfig {
  y: number; // Parametro Y della strategia
  defaultSL?: number; // Stop Loss personalizzato ($)
  defaultTP?: number; // Target di attivazione del Trailing Stop ($)
  trailingStop?: number; // Distanza Trailing Stop in % (es: 1 = 1%)
  targetTpPct?: number; // Target di attivazione % (es: 2.50 = +2.50%)
  isAlpaca?: boolean;
}

/**
 * Valuta se una posizione deve essere chiusa in base alle rigide regole matematiche e configurazioni personalizzate.
 */
export class RiskManagementService {
  
  /**
   * Determina l'azione da intraprendere sulla posizione corrente basandosi sulle regole di risk management.
   * Il Take Profit agisce ora come 'Activation Price' per il Trailing Stop: raggiunto il target di profitto,
   * il Trailing Stop si attiva e insegue il picco massimo (highestPrice) senza chiudere prematuramente la posizione.
   * @param position I dati in tempo reale della posizione aperta
   * @param historicalProfits Il totale dei profitti storici accumulati
   * @param config Configurazione della strategia (es. y = 1)
   * @returns L'azione e la motivazione, oppure null se 'HOLD'
   */
  public static evaluateClosure(
    position: Position, 
    historicalProfits: number, 
    config: RiskConfig
  ): { action: 'CLOSE'; reason: string } | null {
    const { unrealizedProfit, currentValue, openPrice, currentPrice, highestPrice } = position;
    const Y = config.y || 1;

    // --- 1. STOP LOSS (Limite di perdita) ---
    if (config.defaultSL !== undefined && config.defaultSL !== 0) {
      const slLimit = config.defaultSL < 0 ? config.defaultSL : -config.defaultSL;
      if (unrealizedProfit <= slLimit) {
        return { 
          action: 'CLOSE', 
          reason: `Stop Loss Raggiunto ($${unrealizedProfit.toFixed(2)} <= $${slLimit.toFixed(2)})` 
        };
      }
    }

    // --- 2. TRAILING STOP CON ATTIVAZIONE DINAMICA AL TARGET PROFIT ---
    // Il Take Profit diviene la soglia di attivazione del Trailing Stop (Activation Price)
    const peakPrice = (highestPrice && highestPrice > currentPrice) ? highestPrice : currentPrice;

    if (openPrice && openPrice > 0 && config.trailingStop && config.trailingStop > 0) {
      const highestProfitPct = ((peakPrice - openPrice) / openPrice) * 100;
      
      // Target % di attivazione (es: +0.80% Prudente, +1.50% Conservativa, +2.50% Aggressiva)
      const activationTargetPct = config.targetTpPct !== undefined 
        ? config.targetTpPct 
        : (config.defaultTP && currentValue > 0 
            ? (config.defaultTP / Math.max(1, currentValue - unrealizedProfit)) * 100 
            : 0);

      // Verifichiamo se il picco massimo ha raggiunto o superato la soglia di attivazione
      const isActivated = highestProfitPct >= (activationTargetPct - 0.001);

      if (isActivated) {
        const tsPercent = config.trailingStop;
        const trailingStopPrice = peakPrice * (1 - tsPercent / 100);

        if (currentPrice <= trailingStopPrice) {
          return {
            action: 'CLOSE',
            reason: `Trailing Stop (${tsPercent}%) attivato dopo superamento Target (+${activationTargetPct.toFixed(2)}%). Picco max: $${peakPrice.toFixed(2)}, Limite trailing: $${trailingStopPrice.toFixed(2)}, Attuale: $${currentPrice.toFixed(2)}`
          };
        }
      }
    }

    // Se la posizione ha configurazioni di TP/SL (es. strategie Alpaca), lasciamo che il Trailing Stop e lo Stop Loss guidino la posizione
    if (config.defaultTP !== undefined || config.defaultSL !== undefined || config.targetTpPct !== undefined) {
      return null;
    }

    // --- 3. REGOLE DI RISCHIO GENERICAL FALLBACK ---
    const roundedProfit = Math.round(unrealizedProfit * 100) / 100;
    const roundedValue = Math.round(currentValue * 100) / 100;

    if (Y === 1) {
      const targetProfit = 2 * Y;
      const maxProfitLimit = 3.00;
      if (roundedProfit >= targetProfit && roundedProfit <= maxProfitLimit) {
        return {
          action: 'CLOSE',
          reason: `Regola y=1: Profitto corrente ${roundedProfit}€ ha raggiunto il target di 2Y (Max 3€)`
        };
      }
    }

    if (roundedProfit === 2.00) {
      return {
        action: 'CLOSE',
        reason: "Target di profitto esatto di 2.00€ raggiunto."
      };
    }

    if (roundedValue >= 2.00 && roundedProfit <= -0.50) {
      return {
        action: 'CLOSE',
        reason: `Break-even violato: Perdita di ${roundedProfit}€ su posizione di valore >= 2€`
      };
    }

    return null;
  }
}
