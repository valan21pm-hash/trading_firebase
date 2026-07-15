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
        model: 'gemini-3.5-flash',
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

  /**
   * Motore decisionale ultra-conservativo per l'analisi dei dati di mercato e sentiment.
   * Rispetta i requisiti di Failsafe, Stop-Loss inviolabili, Limiti di quota e Orari di New York.
   */
  public evaluateTradingDecision(params: {
    ticker: string;
    currentPrice: number;
    unrealizedPL: number;
    currentValue: number;
    stopLossThreshold?: number; // soglia stop loss (es. -0.50 o in percentuale slPct)
    maxConcurrentPositions?: number;
    currentPositionsCount?: number;
    sentimentScore: number | null; // null in caso di errore
    sentimentReasoning: string;
    isSentimentError?: boolean;
  }): {
    stato: string;
    azione: string;
    ticker: string;
    sentiment_score: number | 'ERROR';
    stop_loss_triggered: boolean;
    motivazione: string;
  } {
    const {
      ticker,
      currentPrice,
      unrealizedPL,
      currentValue,
      stopLossThreshold = -0.50,
      maxConcurrentPositions = 10,
      currentPositionsCount = 0,
      sentimentScore,
      sentimentReasoning,
      isSentimentError = false
    } = params;

    // Calcolo orario New York (EST/EDT)
    const options = { timeZone: 'America/New_York', hour12: false };
    const formatter = new Intl.DateTimeFormat('en-US', {
      ...options,
      hour: '2-digit',
      minute: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const hour = parseInt(partMap.hour || '0');
    const minute = parseInt(partMap.minute || '0');

    // 1. REQUISITI DI STOP-LOSS (Sacro e inviolabile - da controllare PRIMA di tutto il resto)
    const hasPosition = currentValue > 0 || unrealizedPL !== 0;
    let stopLossTriggered = false;

    if (hasPosition) {
      // Se il profitto non realizzato è minore o uguale alla soglia di stop loss impostata
      if (unrealizedPL <= stopLossThreshold) {
        stopLossTriggered = true;
        return {
          stato: "OPERATIVO",
          azione: "SELL",
          ticker,
          sentiment_score: isSentimentError ? "ERROR" : (sentimentScore ?? "ERROR"),
          stop_loss_triggered: true,
          motivazione: `Stop Loss inviolabile scattato per lo strumento ${ticker}. Profitto corrente: $${unrealizedPL.toFixed(2)} <= Soglia Stop Loss: $${stopLossThreshold.toFixed(2)}.`
        };
      }
    }

    // 2. REGOLE DI GESTIONE DEGLI ERRORI (Failsafe)
    // Se c'è un errore nel recupero del sentiment o API offline
    const isError = isSentimentError || sentimentScore === null || isNaN(sentimentScore) ||
                    sentimentReasoning.toLowerCase().includes('errore') ||
                    sentimentReasoning.toLowerCase().includes('quota') ||
                    sentimentReasoning.toLowerCase().includes('nessun sentiment');

    if (isError) {
      return {
        stato: "SOSPESO - Errore recupero dati",
        azione: "HOLD",
        ticker,
        sentiment_score: "ERROR",
        stop_loss_triggered: false,
        motivazione: `STATO: SOSPESO - Errore recupero dati del sentiment o API offline per ${ticker}. Nessun nuovo trade consentito per sicurezza. Posizione mantenuta e monitorata via Stop Loss.`
      };
    }

    // 3. GESTIONE ORARI DI MERCATO (New York Time EST/EDT)
    // [ORARIO DI CHIUSURA - 15 MINUTI]: 15:45 - 16:00 EST/EDT
    const isPreCloseWindow = hour === 15 && minute >= 45 && minute < 60;
    if (isPreCloseWindow) {
      return {
        stato: "OPERATIVO",
        azione: "CHIUDI_POSIZIONI_ATTIVE",
        ticker,
        sentiment_score: sentimentScore!,
        stop_loss_triggered: false,
        motivazione: `Fase pre-chiusura (15 minuti alla chiusura di New York: ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} EST). Chiudere tempestivamente le posizioni attive per azzerare il rischio overnight.`
      };
    }

    // [ORARIO DI APERTURA - 15 MINUTI] (Pre-Market): 09:15 - 09:30 EST/EDT
    const isPreOpenWindow = hour === 9 && minute >= 15 && minute < 30;
    if (isPreOpenWindow) {
      return {
        stato: "OPERATIVO",
        azione: "AVVIO_ANALISI_PREMARKET",
        ticker,
        sentiment_score: sentimentScore!,
        stop_loss_triggered: false,
        motivazione: `Fase Pre-Market (15 minuti all'apertura di New York: ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} EST). Avvio dell'analisi preventiva e sentiment iniziale per la strategia di apertura.`
      };
    }

    // 4. LIMITI DI QUOTA GIORNALIERI / EXPOSURE LIMITS
    // Se stiamo valutando un acquisto ma abbiamo raggiunto il numero massimo di trade o posizioni contemporanee
    let action: 'BUY' | 'SELL' | 'HOLD' | 'CHIUDI_POSIZIONI_ATTIVE' | 'AVVIO_ANALISI_PREMARKET' = 'HOLD';
    let motivazione = `Sentiment per ${ticker} stabile a ${sentimentScore!.toFixed(2)}. Manteniamo la posizione corrente (HOLD).`;

    if (!hasPosition) {
      // Se non abbiamo la posizione, valutiamo l'acquisto se il sentiment è positivo (> 0.2)
      if (sentimentScore! > 0.2) {
        if (currentPositionsCount >= maxConcurrentPositions) {
          return {
            stato: "OPERATIVO",
            azione: "HOLD",
            ticker,
            sentiment_score: sentimentScore!,
            stop_loss_triggered: false,
            motivazione: `Sentiment positivo (${sentimentScore!.toFixed(2)}) ma limite di quota o posizioni contemporanee raggiunto (${currentPositionsCount}/${maxConcurrentPositions}). Nuovo acquisto BLOCCATO.`
          };
        } else {
          action = 'BUY';
          motivazione = `Sentiment positivo (${sentimentScore!.toFixed(2)}) idoneo all'acquisto. Allocazione slot disponibile.`;
        }
      }
    } else {
      // Se abbiamo già la posizione, valutiamo la vendita se il sentiment scende sotto o a 0
      if (sentimentScore! <= 0) {
        action = 'SELL';
        motivazione = `Sentiment neutro/negativo (${sentimentScore!.toFixed(2)}) sceso sotto o pari alla soglia di tolleranza di 0. Segnale di chiusura posizione inviato.`;
      }
    }

    return {
      stato: "OPERATIVO",
      azione: action,
      ticker,
      sentiment_score: sentimentScore!,
      stop_loss_triggered: false,
      motivazione
    };
  }
}
