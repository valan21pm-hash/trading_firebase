export interface Position {
  id: string;
  asset: string; // es. 'EUR_USD', 'XAU_USD', 'AAPL', 'SPY'
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
   * Determina l'azione da intraprendere sulla posizione corrente.
   * @param position I dati in tempo reale della posizione aperta
   * @param historicalProfits Il totale dei profitti storici accumulati (per calcolo 2Y)
   * @param config Configurazione della strategia (es. y = 1)
   * @returns L'azione e la motivazione, oppure null se 'HOLD'
   */
  public static evaluateClosure(
    position: Position, 
    historicalProfits: number, 
    config: RiskConfig
  ): { action: 'CLOSE'; reason: string } | null {
    const { unrealizedProfit, currentValue, asset, currentPrice, highestPrice } = position;
    const Y = config.y;

    // --- 1. REGOLE DI GESTIONE PERSONALIZZATA (INPUT UTENTE) ---

    // A. STOP LOSS PERSONALIZZATO
    if (config.defaultSL !== undefined && config.defaultSL !== 0) {
      const slLimit = config.defaultSL < 0 ? config.defaultSL : -config.defaultSL;
      if (unrealizedProfit <= slLimit) {
        return { 
          action: 'CLOSE', 
          reason: `Stop Loss Personalizzato Raggiunto ($${unrealizedProfit.toFixed(2)} <= $${slLimit.toFixed(2)})` 
        };
      }
    }

    // B. TAKE PROFIT PERSONALIZZATO
    if (config.defaultTP !== undefined && config.defaultTP !== 0) {
      if (unrealizedProfit >= config.defaultTP) {
        return { 
          action: 'CLOSE', 
          reason: `Take Profit Personalizzato Raggiunto ($${unrealizedProfit.toFixed(2)} >= $${config.defaultTP.toFixed(2)})` 
        };
      }
    }

    // C. TRAILING STOP LOSS PERSONALIZZATO (PERCENTUALE)
    if (config.trailingStop !== undefined && config.trailingStop > 0 && highestPrice && highestPrice > 0) {
      const tsPercent = config.trailingStop; // es: 1 per 1%
      const trailingStopPrice = highestPrice * (1 - tsPercent / 100);
      if (currentPrice <= trailingStopPrice && currentPrice < highestPrice) {
        return {
          action: 'CLOSE',
          reason: `Trailing Stop Loss di ${tsPercent}% Raggiunto (Picco massimo: $${highestPrice.toFixed(2)}, Prezzo Limite: $${trailingStopPrice.toFixed(2)}, Prezzo Attuale: $${currentPrice.toFixed(2)})`
        };
      }
    }

    return null;
  }
}
