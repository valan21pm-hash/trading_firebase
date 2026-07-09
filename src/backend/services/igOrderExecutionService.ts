import { IgAuthService } from './igAuthService.js';

export class IgOrderExecutionService {
  private static instance: IgOrderExecutionService;
  private authService: IgAuthService;
  
  private constructor() {
    this.authService = IgAuthService.getInstance();
  }

  static getInstance(): IgOrderExecutionService {
    if (!IgOrderExecutionService.instance) {
      IgOrderExecutionService.instance = new IgOrderExecutionService();
    }
    return IgOrderExecutionService.instance;
  }

  /**
   * Esegue un ordine a mercato basato sui segnali di Gemini.
   */
  async executeMarketOrder(epic: string, direction: 'BUY' | 'SELL', size: number, stopLossDist?: number, takeProfitDist?: number) {
    try {
      const headers = await this.authService.getHeaders('2');
      const baseUrl = this.authService.getBaseUrl();

      const orderPayload: any = {
        epic,
        expiry: '-', // Valido per CFD spot
        direction,
        size: String(size),
        orderType: 'MARKET',
        guaranteedStop: false,
        forceOpen: true,
        currencyCode: 'EUR'
      };

      if (stopLossDist) orderPayload.stopDistance = String(stopLossDist);
      if (takeProfitDist) orderPayload.limitDistance = String(takeProfitDist);

      const response = await fetch(`${baseUrl}/positions/otc`, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Execution Failed: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log(`[IG Order] Ordine ${direction} eseguito su ${epic}. DealRef: ${result.dealReference}`);
      return result;

    } catch (error) {
      console.error('[IG Order] Errore in esecuzione ordine:', error);
      throw error;
    }
  }

  /**
   * Chiude una posizione aperta in base al dealId.
   */
  async closePosition(dealId: string) {
    try {
      const headers = await this.authService.getHeaders('1');
      const baseUrl = this.authService.getBaseUrl();

      const response = await fetch(`${baseUrl}/positions/otc/${dealId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Close Position Failed: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      console.log(`[IG Order] Posizione ${dealId} chiusa con successo. DealRef: ${result.dealReference}`);
      return result;

    } catch (error) {
      console.error('[IG Order] Errore in chiusura ordine:', error);
      throw error;
    }
  }
}
