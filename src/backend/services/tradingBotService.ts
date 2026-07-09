import { GeminiSignalService } from './geminiSignalService.js';
import { IgOrderExecutionService } from './igOrderExecutionService.js';

export class TradingBotService {
  private static instance: TradingBotService;
  private signalService: GeminiSignalService;
  private executionService: IgOrderExecutionService;

  private constructor() {
    this.signalService = GeminiSignalService.getInstance();
    this.executionService = IgOrderExecutionService.getInstance();
  }

  static getInstance(): TradingBotService {
    if (!TradingBotService.instance) {
      TradingBotService.instance = new TradingBotService();
    }
    return TradingBotService.instance;
  }

  /**
   * Esegue un ciclo completo di analisi e possibile trading.
   */
  async runTradingCycle(epic: string, instrumentName: string, currentPrice: number, marketData: any, newsContext: string) {
    console.log(`[Trading Bot] Inizio ciclo per ${instrumentName} (${epic})...`);
    
    try {
      // 1. Fase di Analisi (Gemini AI)
      const signal = await this.signalService.generateTradingSignal(
        instrumentName,
        currentPrice,
        marketData,
        newsContext
      );

      // 2. Valutazione Confidenza e Azione
      const MIN_CONFIDENCE = 75; // Eseguiamo solo trade con alta confidenza

      if (signal.action !== 'HOLD' && signal.confidence >= MIN_CONFIDENCE) {
        console.log(`[Trading Bot] Segnale valido ricevuto (${signal.action}). Preparazione ordine...`);
        
        // 3. Calcolo Size (esempio semplificato: 1 contratto)
        const size = 1; 

        // 4. Calcolo Distanze (SL e TP) basati sul prezzo o fissi
        const slDistance = signal.suggestedStopLoss ? Math.abs(currentPrice - signal.suggestedStopLoss) : 50;
        const tpDistance = signal.suggestedTakeProfit ? Math.abs(currentPrice - signal.suggestedTakeProfit) : 100;

        // 5. Esecuzione su IG Markets
        const result = await this.executionService.executeMarketOrder(
          epic,
          signal.action as 'BUY' | 'SELL',
          size,
          slDistance, // espresso in punti
          tpDistance  // espresso in punti
        );

        console.log(`[Trading Bot] Operazione conclusa con successo. DealRef: ${result.dealReference}`);
        return { success: true, signal, order: result };
      } else {
        console.log(`[Trading Bot] Nessuna azione intrapresa (Segnale: ${signal.action}, Confidenza: ${signal.confidence}%).`);
        return { success: false, signal, reason: 'HOLD_OR_LOW_CONFIDENCE' };
      }
    } catch (error: any) {
      console.error(`[Trading Bot] Errore critico nel ciclo per ${instrumentName}:`, error.message);
      throw error;
    }
  }
}
