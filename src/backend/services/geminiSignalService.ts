import { GoogleGenAI, Type } from '@google/genai';
import 'dotenv/config';

export class GeminiSignalService {
  private static instance: GeminiSignalService;
  private ai: GoogleGenAI;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("Attenzione: GEMINI_API_KEY non definita. Il motore IA non funzionerà.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  static getInstance(): GeminiSignalService {
    if (!GeminiSignalService.instance) {
      GeminiSignalService.instance = new GeminiSignalService();
    }
    return GeminiSignalService.instance;
  }

  /**
   * Analizza i dati di mercato e le news per restituire un segnale operativo strutturato.
   */
  async generateTradingSignal(instrument: string, currentPrice: number, marketData: any, newsContext: string) {
    try {
      const prompt = `Sei un Quantitative Trading Engineer e un Analista Finanziario esperto.
Devi analizzare i seguenti dati di mercato per lo strumento ${instrument} e determinare la mossa operativa ideale.

--- DATI DI MERCATO ---
Prezzo Attuale: ${currentPrice}
Storico/Volatilità: ${JSON.stringify(marketData)}
Contesto Macro/Notizie: ${newsContext}
-----------------------

In base alle tue analisi su trend, momentum e sentiment delle notizie, definisci l'azione da intraprendere.
Rispondi rigorosamente seguendo la struttura JSON richiesta.`;

      // Definizione dello Schema Atteso
      const schema = {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            description: "Azione da intraprendere: 'BUY', 'SELL', o 'HOLD'",
            enum: ['BUY', 'SELL', 'HOLD']
          },
          confidence: {
            type: Type.NUMBER,
            description: "Livello di confidenza da 0 a 100"
          },
          reasoning: {
            type: Type.STRING,
            description: "Breve ragionamento algoritmico/fondamentale per giustificare l'azione"
          },
          sentiment: {
            type: Type.STRING,
            description: "Sentiment generale (es. Bullish, Bearish, Neutral)"
          },
          suggestedTakeProfit: {
            type: Type.NUMBER,
            description: "Prezzo suggerito per il Take Profit (opzionale se HOLD)"
          },
          suggestedStopLoss: {
            type: Type.NUMBER,
            description: "Prezzo suggerito per lo Stop Loss (opzionale se HOLD)"
          }
        },
        required: ["action", "confidence", "reasoning", "sentiment"]
      };

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          temperature: 0.2, // Bassa temperatura per maggiore determinismo
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });

      if (!response.text) {
        throw new Error("Nessuna risposta strutturata ricevuta da Gemini.");
      }

      const signal = JSON.parse(response.text);
      console.log(`[Gemini Signal] ${instrument} -> Azione: ${signal.action}, Confidenza: ${signal.confidence}%`);
      return signal;

    } catch (error) {
      console.error("[Gemini Signal] Errore durante l'analisi:", error);
      throw error;
    }
  }
}
