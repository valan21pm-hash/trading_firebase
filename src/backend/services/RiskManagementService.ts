export interface Position {
  id: string;
  asset: string; // es. 'EUR_USD', 'XAU_USD', 'AAPL'
  currentValue: number; // Valore attuale della posizione in €
  openPrice: number;
  currentPrice: number;
  unrealizedProfit: number; // Profitto/Perdita attuale non realizzato in €
}

export interface RiskConfig {
  y: number; // Parametro Y della strategia
}

/**
 * Valuta se una posizione deve essere chiusa in base alle rigide regole matematiche.
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
    const { unrealizedProfit, currentValue, asset } = position;
    const Y = config.y;

    // VINCOLO: L'Oro è esplicitamente abilitato. Non viene mai scartato a priori.
    // Nessun filtro bloccherà 'XAU_USD' o 'GLD' o similari.

    // REGOLA 1: Chiusura a 2€ ESCLUSIVAMENTE se il profitto è esattamente 2.00€
    // Utilizziamo un epsilon per evitare problemi di floating point in JavaScript
    const isExactlyTwo = Math.abs(unrealizedProfit - 2.00) < 0.005;
    if (isExactlyTwo) {
      return { action: 'CLOSE', reason: 'Target Esatto di 2.00€ Raggiunto' };
    }

    // REGOLA 2: Regola y=1, chiusura a profitti storici pari a 2Y fino a max 3€
    if (Y === 1) {
      const targetProfit = 2 * Y; // 2€
      const maxAllowedProfit = 3.00; // 3€
      
      // Se i profitti storici + il profitto attuale raggiungono il target, valutiamo la chiusura
      // assicurandoci di non superare il limite dei 3€
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

    // Se nessuna regola di chiusura è triggerata
    return null;
  }
}
