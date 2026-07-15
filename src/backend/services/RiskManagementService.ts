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
  isAlpaca?: boolean; // Se vero, esclude le regole micro-forex (regola 1, 2, 3) pensate per XTB
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

    // --- 2. REGOLE STORICHE MANDATORIE DELL'UTENTE ---

    // Se stiamo operando su Alpaca, non applichiamo le regole micro-forex pensate in euro per XTB (regole 1, 2, 3)
    if (config.isAlpaca) {
      return null;
    }

    // VINCOLO: L'Oro (GLD) è esplicitamente abilitato. Non viene mai scartato o bloccato a priori.

    // REGOLA 1: Chiusura a 2€ ESCLUSIVAMENTE se il profitto è esattamente 2.00€ (epsilon 0.01 per tolleranza)
    const isExactlyTwo = Math.abs(unrealizedProfit - 2.00) < 0.01;
    if (isExactlyTwo) {
      return { action: 'CLOSE', reason: 'Target Esatto di 2.00€ Raggiunto' };
    }

    // REGOLA 2: Regola y=1, chiusura a profitti storici pari a 2Y fino a max 3€
    if (Y === 1) {
      const targetProfit = 2 * Y; // 2€
      const maxAllowedProfit = 3.00; // 3€
      
      if (historicalProfits >= targetProfit && unrealizedProfit > 2.00 && unrealizedProfit <= maxAllowedProfit) {
          return { action: 'CLOSE', reason: `Strategia Y=1: Profitto Storico soddisfatto e PnL corrente (${unrealizedProfit.toFixed(2)}€) entro il limite di 3€` };
      }
    }

    // REGOLA 3: Break-even (minima perdita 0.50€) su posizioni con valore >= 2€
    if (currentValue >= 2.00) {
      if (unrealizedProfit <= -0.50) {
        return { action: 'CLOSE', reason: 'Stop Loss Break-Even a -0.50€ Scattato (Valore Posizione >= 2€)' };
      }
    }

    return null;
  }
}
