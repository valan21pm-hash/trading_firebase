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
  defaultSL?: number; // Stop Loss personalizzato (assoluto o percentuale)
  defaultTP?: number; // Take Profit personalizzato
  trailingStop?: number; // Trailing Stop personalizzato (percentuale, es: 1 = 1%)
}

/**
 * Valuta se una posizione deve essere chiusa in base alle rigide regole matematiche e configurazioni personalizzate.
 */
export class RiskManagementService {
  
  /**
   * Determina l'azione da intraprendere sulla posizione corrente basandosi sulle regole di risk management ultra-conservative.
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
    const { unrealizedProfit, currentValue, asset, currentPrice, highestPrice } = position;
    const Y = config.y || 1;

    // Arrotondamento a 2 decimali prima di eseguire confronti
    const roundedProfit = Math.round(unrealizedProfit * 100) / 100;
    const roundedValue = Math.round(currentValue * 100) / 100;

    // --- 1. CONFIGURAZIONI AGGIUNTIVE DI GESTIONE PERSONALIZZATA DELLA POSIZIONE ---

    // Stop Loss (dalla strategia della singola posizione)
    if (config.defaultSL !== undefined && config.defaultSL !== 0) {
      const slLimit = config.defaultSL < 0 ? config.defaultSL : -config.defaultSL;
      if (unrealizedProfit <= slLimit) {
        return { 
          action: 'CLOSE', 
          reason: `Stop Loss Raggiunto ($${unrealizedProfit.toFixed(2)} <= $${slLimit.toFixed(2)})` 
        };
      }
    }

    // Take Profit (dalla strategia della singola posizione)
    if (config.defaultTP !== undefined && config.defaultTP !== 0) {
      if (unrealizedProfit >= config.defaultTP) {
        return { 
          action: 'CLOSE', 
          reason: `Take Profit Raggiunto ($${unrealizedProfit.toFixed(2)} >= $${config.defaultTP.toFixed(2)})` 
        };
      }
    }

    // Trailing Stop Loss (dalla strategia della singola posizione)
    if (config.trailingStop !== undefined && config.trailingStop > 0 && highestPrice && highestPrice > 0) {
      const tsPercent = config.trailingStop;
      const trailingStopPrice = highestPrice * (1 - tsPercent / 100);
      if (currentPrice <= trailingStopPrice && currentPrice < highestPrice) {
        return {
          action: 'CLOSE',
          reason: `Trailing Stop Loss di ${tsPercent}% Raggiunto (Picco massimo: $${highestPrice.toFixed(2)}, Prezzo Limite: $${trailingStopPrice.toFixed(2)}, Prezzo Attuale: $${currentPrice.toFixed(2)})`
        };
      }
    }

    // Se la posizione ha TP/SL specifici (che ora hanno tutte grazie alla strategia), 
    // ignoriamo le rigide regole globali che andrebbero a chiudere la posizione prematuramente,
    // garantendo che i limiti della singola posizione vengano rispettati.
    if (config.defaultTP !== undefined || config.defaultSL !== undefined) {
      return null;
    }

    // --- 2. RIGIDE REGOLE DI GESTIONE DEL RISCHIO (Fallback) ---

    // A. Regola y = 1: Chiusura a profitti storici pari a 2Y fino a un massimo di 3€
    if (Y === 1) {
      const targetProfit = 2 * Y; // 2€
      const maxProfitLimit = 3.00;
      if (roundedProfit >= targetProfit && roundedProfit <= maxProfitLimit) {
        return {
          action: 'CLOSE',
          reason: `Regola y=1: Profitto corrente ${roundedProfit}€ ha raggiunto il target di 2Y (Max 3€)`
        };
      }
    }

    // B. Chiusura a esattamente 2€ (Esclusiva)
    // "La chiusura a 2€ è ammessa ESCLUSIVAMENTE se i profitti sono esattamente pari a 2€, altrimenti rimane aperta"
    if (roundedProfit === 2.00) {
      return {
        action: 'CLOSE',
        reason: "Target di profitto esatto di 2.00€ raggiunto."
      };
    }

    // C. Perdita minima a pareggio (Break-Even) per posizioni >= 2€
    // "La perdita minima da considerare è di 0.50€ a pareggio (break-even) su posizioni con valore >= 2€"
    if (roundedValue >= 2.00) {
      if (roundedProfit <= -0.50) {
        return {
          action: 'CLOSE',
          reason: `Break-even violato: Perdita di ${roundedProfit}€ su posizione di valore >= 2€`
        };
      }
    }

    return null;
  }
}
