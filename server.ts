import express from 'express';
import path from 'path';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAi() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "missing-key", // Fallback to avoid immediate crash, will fail on use
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const isAlpacaConfigured = !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY);
const isAlpacaLive = process.env.ALPACA_API_KEY?.startsWith('AK') || process.env.ALPACA_PAPER_TRADING === 'false';
const ALPACA_BASE_URL = isAlpacaLive 
  ? 'https://api.alpaca.markets/v2'
  : 'https://paper-api.alpaca.markets/v2';
const ALPACA_DATA_URL = 'https://data.alpaca.markets/v2';

// In-memory state simulating a database (e.g., Firestore)
let botStatus: {
  active: boolean;
  balance: number;
  lastCheck: string | null;
  mode: 'Alpaca' | 'Simulation';
  accountNumber?: string;
  simulationRunning?: boolean;
  simulationProgress?: number;
  simulatedPositions?: any[];
  simulatedAssets?: any;
  dailyPnL?: { date: string; pnl: number; balance: number; breakdown?: any[]; news?: string }[];
  cash?: number;
  latestDailyReport?: string;
  dailyLogicLogs?: { timestamp: string; symbol: string; action: string; reasoning: string; price?: number }[];
  userFeedbackRules?: string[];
} = {
  active: false,
  balance: 100.0,
  lastCheck: null as string | null,
  mode: (isAlpacaConfigured ? 'Alpaca' : 'Simulation') as 'Alpaca' | 'Simulation',
  simulationRunning: false,
  simulationProgress: 0,
  simulatedPositions: [],
  simulatedAssets: {},
  dailyPnL: [],
  cash: 100.0,
  latestDailyReport: undefined,
  dailyLogicLogs: [],
  userFeedbackRules: []
};
let tradeLogs: string[] = [];

function addLog(message: string) {
  const timestamp = new Date().toISOString();
  tradeLogs.unshift(`[${timestamp}] ${message}`);
  // Keep only the last 100 logs
  if (tradeLogs.length > 100) {
    tradeLogs = tradeLogs.slice(0, 100);
  }
  console.log(message);
}

const marketEvents: Record<string, string> = {
  '2026-05-28': 'Rumors taglio tassi BCE (Positive)',
  '2026-06-01': 'Dati occupazione USA inferiori alle attese',
  '2026-06-03': 'Timori inflazione USA persistente (Rialzo tassi BCE inaspettato)',
  '2026-06-06': 'Dati Occupazione deludenti e tensioni in Medio Oriente (Attacco a Iran)',
  '2026-06-09': 'Tregua in Libano',
  '2026-06-12': 'Pubblicazione dati inflazione CPI USA e dichiarazioni FED su soft landing (Positive)',
  '2026-06-15': 'BCE rialzo tassi inatteso e annuncio politica monetaria FED (Negative)',
  '2026-06-20': 'Trump annuncia tagli fiscali (Colpaccio) (Positive)',
  '2026-06-24': 'Tensioni geopolitiche globali',
  '2026-06-25': 'Nuove tensioni commerciali globali'
};

// In-memory cache for sentiment analysis
const sentimentCache = new Map<string, {score: number, reasoning: string}>();
let isQuotaExceeded = false;

// Core trading logic extracted for flexibility
async function getMarketSentiment(symbol: string, context?: string): Promise<{score: number, reasoning: string}> {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `${symbol}:${context || 'default'}:${context ? '' : today}`;
  if (sentimentCache.has(cacheKey)) {
    return sentimentCache.get(cacheKey)!;
  }
  
  if (isQuotaExceeded) {
      return {score: 0, reasoning: 'Quota exceeded / rate limited'}; // Return neutral if quota was previously exceeded
  }

  try {
    const feedbackRules = botStatus.userFeedbackRules && botStatus.userFeedbackRules.length > 0
      ? `\n\nUSER FEEDBACK RULES TO FOLLOW:\n- ${botStatus.userFeedbackRules.join('\n- ')}`
      : '';

    const prompt = context 
      ? `Analyze market sentiment for ${symbol} considering this event: ${context}.${feedbackRules}\nReturn a JSON object: {"score": <number between -1 (bearish) and 1 (bullish)>, "reasoning": "<short explanation>"}.`
      : `Analyze recent market sentiment for ${symbol}.${feedbackRules}\nReturn a JSON object: {"score": <number between -1 (bearish) and 1 (bullish)>, "reasoning": "<short explanation>"}.`;
      
    const response = await getAi().models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
    });
    
    // We try to parse the JSON output from the model
    let parsed: any = {};
    try {
       // Sometimes model wraps JSON in markdown blocks
       const cleanedText = (response.text || '{}').replace(/```json|```/g, '').trim();
       parsed = JSON.parse(cleanedText);
    } catch(e) {
       console.error("Failed to parse Gemini JSON output:", response.text);
    }

    const sentimentScore = parseFloat(parsed.score || '0');
    const resultScore = isNaN(sentimentScore) ? 0 : Math.max(-1, Math.min(1, sentimentScore));
    const resultReasoning = parsed.reasoning || 'Nessuna spiegazione dettagliata disponibile';
    
    const result = { score: resultScore, reasoning: resultReasoning };
    sentimentCache.set(cacheKey, result);
    return result;
  } catch (error: any) {
    // If rate limited or service unavailable, handle gracefully
    const message = error.message || JSON.stringify(error);
    if (message.includes('429') || message.includes('503') || message.includes('RESOURCE_EXHAUSTED')) {
      console.warn(`API limit hit or service unavailable. Disabling further sentiment analysis.`);
      isQuotaExceeded = true;
      return {score: 0, reasoning: 'Quota exceeded'};
    }
    console.error(`Error fetching sentiment for ${symbol}:`, error);
    return {score: 0, reasoning: 'Error fetching sentiment'};
  }
}

async function executeTradingCycle() {
  if (!botStatus.active) return;
  
  botStatus.lastCheck = new Date().toISOString();
  
  // Logic for Alpaca
  if (isAlpacaConfigured) {
    try {
      const response = await fetch(`${ALPACA_BASE_URL}/account`, {
        headers: {
          'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || ''
        }
      });
      
      if (!response.ok) {
        throw new Error(`Errore API: ${response.status} ${response.statusText}`);
      }
      
      const account = await response.json();
      botStatus.balance = parseFloat(account.equity || account.portfolio_value || '0');
      botStatus.accountNumber = account.account_number;
      addLog(`[Alpaca] Account Live verificato. Equity: $${botStatus.balance.toFixed(2)} | Buying Power: $${account.buying_power}`);
      
      // Check sentiment before buying
      const { score: sentimentScore, reasoning: sentimentReasoning } = await getMarketSentiment('SPY'); 
      if (sentimentScore > 0.2) {
          addLog(`[Mercato] Sentiment positivo per SPY: ${sentimentScore.toFixed(2)}. Procedo all'acquisto su Alpaca.`);
          botStatus.dailyLogicLogs?.push({
              timestamp: new Date().toISOString(),
              symbol: 'SPY',
              action: 'BUY',
              reasoning: sentimentReasoning
          });
          
          // Esecuzione REALE dell'ordine su Alpaca
          const orderResponse = await fetch(`${ALPACA_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
              'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
              'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || '',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              symbol: 'SPY',
              qty: 1,
              side: 'buy',
              type: 'market',
              time_in_force: 'day'
            })
          });
          
          if (orderResponse.ok) {
            const orderData = await orderResponse.json();
            addLog(`[Alpaca] Ordine BUY eseguito per SPY! ID: ${orderData.id}`);
          } else {
            const errorData = await orderResponse.json();
            addLog(`[Alpaca Errore Ordine] Non è stato possibile eseguire l'ordine: ${errorData.message}`);
          }
          
      } else {
          addLog(`[Mercato] Sentiment neutro/negativo per SPY: ${sentimentScore.toFixed(2)}. Attendo.`);
          botStatus.dailyLogicLogs?.push({
              timestamp: new Date().toISOString(),
              symbol: 'SPY',
              action: 'HOLD',
              reasoning: sentimentReasoning
          });
      }
    } catch (error: any) {
      addLog(`[Alpaca Errore] ${error.message}`);
    }
  } else {
    // Simulazione se non ci sono le API KEY configurate
    const randomChance = Math.random();
    
    if (randomChance > 0.7) {
      const profit = (Math.random() * 4 - 1.5);
      botStatus.balance += profit;
      const formattedProfit = profit >= 0 ? `+€${profit.toFixed(2)}` : `-€${Math.abs(profit).toFixed(2)}`;
      addLog(`[Simulazione] Trade Eseguito: ${formattedProfit} | Nuovo Saldo: €${botStatus.balance.toFixed(2)}`);
    } else {
      addLog(`[Simulazione] Controllo mercato. Saldo: €${botStatus.balance.toFixed(2)}`);
    }
  }
}

// Scheduled Cron Job: For local preview / standalone server
// Runs every minute, 24/7, as long as the Node process is alive
cron.schedule('* * * * *', async () => {
  await executeTradingCycle();
});

async function generateAndSendDailyReport() {
  try {
    addLog('[Report Giornaliero] Inizio generazione report...');
    
    // Raccoglie dati sull'andamento giornaliero (se presenti)
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysPnL = botStatus.dailyPnL?.find(d => d.date === todayStr);
    
    // Limit logs per non sforare context window
    const recentLogs = tradeLogs.slice(0, 100).join('\n');
    
    const prompt = `Sei l'analista esperto del bot di trading. La giornata di mercato si è conclusa (o sta per concludersi).
Genera un report motivazionale in cui descrivi in dettaglio le motivazioni delle scelte fatte dal bot durante le ultime sessioni di trading.
I tuoi obiettivi:
1. Analizzare i log e l'andamento recente del portafoglio (se ci sono state perdite, perché lo stop loss è scattato, etc.).
2. Valutare criticamente le performance e gli errori di valutazione (se hai preso profitto troppo presto o hai comprato su un falso segnale).
3. Includere alla fine del report una sezione "PROMPT DI CORREZIONE" che l'utente può semplicemente copiare e incollare per migliorare il bot.
Il formato deve essere professionale e leggibile. 

Dati recenti (PNL di oggi):
${JSON.stringify(todaysPnL || 'Nessun dato di PNL consolidato per oggi')}

Ultimi log di esecuzione (azioni, eventi):
${recentLogs}

Log della logica decisionale del bot (ragionamento interno):
${JSON.stringify(botStatus.dailyLogicLogs?.slice(-50) || 'Nessun log logico')}
`;

    const response = await getAi().models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
    });
    
    const reportText = response.text || 'Nessun report generato.';
    botStatus.latestDailyReport = reportText;
    
    // Invia email
    let transporter;
    
    if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      addLog('[Report Giornaliero] Credenziali SMTP assenti. Uso Ethereal per test (non arriverà alla tua mail reale).');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail({
      from: '"AI Trading Bot" <bot@trading-ai.com>',
      to: 'palmasmnl@gmail.com',
      subject: `Report Trading Giornaliero - ${todayStr}`,
      text: reportText,
    });

    addLog(`[Report Giornaliero] Email inviata: ${nodemailer.getTestMessageUrl(info) || 'Successo'}`);
  } catch (error: any) {
    addLog(`[Report Giornaliero Errore] ${error.message}`);
    console.error(error);
  }
}

// Cron job per l'invio del report di fine giornata, lun-ven alle 22:00 (chiusura mercati indicativa)
cron.schedule('0 22 * * 1-5', async () => {
  await generateAndSendDailyReport();
});

// Endpoint per trigger manuale (es. per testare)
app.post('/api/trigger-daily-report', async (req, res) => {
  // Non lo mettiamo in "await" qui così non blocchiamo la UI se ci mette troppo
  generateAndSendDailyReport();
  res.json({ success: true, message: 'Generazione report avviata in background.' });
});

// API Routes
app.post('/api/feedback', (req, res) => {
  const { rule } = req.body;
  if (rule && typeof rule === 'string') {
    if (!botStatus.userFeedbackRules) {
      botStatus.userFeedbackRules = [];
    }
    botStatus.userFeedbackRules.push(rule);
    addLog(`[Feedback Utente] Aggiunta nuova regola: ${rule}`);
    res.json({ success: true, message: 'Regola aggiunta con successo.' });
  } else {
    res.status(400).json({ success: false, message: 'Regola non valida.' });
  }
});

app.post('/api/trigger', async (req, res) => {
  // This endpoint is ideal for Cloud Run + Cloud Scheduler integration
  // Cloud Scheduler can ping this URL every minute to ensure execution even if CPU is throttled
  await executeTradingCycle();
  res.json({ success: true, message: 'Trading cycle triggered manually/externally' });
});

app.post('/api/analyze-market', async (req, res) => {
  const { symbol } = req.body;
  const { score: sentimentScore, reasoning } = await getMarketSentiment(symbol);
  res.json({ symbol, sentiment: sentimentScore, reasoning });
});

app.get('/api/status', async (req, res) => {
  let positions = [];
  
  if (botStatus.mode === 'Simulation' && botStatus.simulatedPositions) {
    positions = botStatus.simulatedPositions;
  } else if (isAlpacaConfigured) {
    try {
      const posResponse = await fetch(`${ALPACA_BASE_URL}/positions`, {
        headers: {
          'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || ''
        }
      });
      if (posResponse.ok) {
        positions = await posResponse.json();
      }
      
      const accResponse = await fetch(`${ALPACA_BASE_URL}/account`, {
        headers: {
          'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || ''
        }
      });
      if (accResponse.ok) {
        const account = await accResponse.json();
        botStatus.balance = parseFloat(account.equity || account.portfolio_value || '0');
        botStatus.accountNumber = account.account_number;
      }
    } catch (e) {
      console.error('Error fetching Alpaca data', e);
    }
  }

  res.json({
    status: { ...botStatus, positions },
    logs: tradeLogs,
  });
});

app.post('/api/toggle', (req, res) => {
  botStatus.active = !botStatus.active;
  
  if (botStatus.active) {
    addLog('Bot avviato. In attesa del prossimo ciclo di trading...');
    botStatus.lastCheck = new Date().toISOString();
  } else {
    addLog('Bot arrestato manualmente.');
  }
  
  res.json({ status: botStatus, logs: tradeLogs });
});

app.post('/api/reset', (req, res) => {
  botStatus = {
    active: false,
    balance: 100.0,
    lastCheck: null,
    mode: (isAlpacaConfigured ? 'Alpaca' : 'Simulation') as 'Alpaca' | 'Simulation',
    simulationRunning: false,
    simulationProgress: 0,
    simulatedPositions: [],
    simulatedAssets: {},
    dailyPnL: [],
    cash: 100.0,
    latestDailyReport: undefined
  };
  tradeLogs = [];
  addLog('Sistema ripristinato a €100.00');
  res.json({ status: botStatus, logs: tradeLogs });
});

app.post('/api/simulate-day', async (req, res) => {
  if (botStatus.simulationRunning) {
    return res.status(400).json({ error: 'Simulation already running' });
  }
  
  botStatus.simulationRunning = true;
  botStatus.mode = 'Simulation';
  botStatus.balance = 100.0;
  botStatus.simulatedPositions = [];
  botStatus.simulationProgress = 0;
  
  tradeLogs = [];
  addLog('Inizio backtest simulato sull\'ultimo mese...');
  
  res.json({ success: true, message: 'Simulation started' });
  
  // Avvia il processo in background
  try {
    const start = '2026-05-26T13:30:00Z'; // 1 Mese
    const end = '2026-06-26T20:00:00Z';
    
    addLog('Scaricamento dati storici da server fittizio (15Min bars, 1 mese)...');
    const equities = ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ'];
    const commodities = ['GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'];
    const symbols = [...equities, ...commodities];
    let data: any = { bars: {} };
    try {
      const response = await fetch(`https://data.alpaca.markets/v2/stocks/bars?symbols=${symbols.join(',')}&timeframe=15Min&start=${start}&end=${end}&feed=iex&limit=10000`, {
        headers: {
          'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || ''
        }
      });
      if (response.ok) {
        data = await response.json();
        addLog(`DEBUG BARS KEYS: ${Object.keys(data.bars || {}).join(', ')}`);
      }
    } catch (e) {
      addLog(`Impossibile scaricare i dati storici, uso generatore casuale.`);
    }
    
    // Default base prices for all 15 instruments
    const basePrices: Record<string, number> = {
      // Equities
      'SPY': 545.0, 'VOO': 500.0, 'IVV': 500.0, 'VTI': 265.0, 'QQQ': 480.0,
      // Commodities
      'GLD': 215.0, 'SLV': 27.0, 'USO': 75.0, 'UNG': 15.0, 'DBA': 24.0, 'DBC': 22.0, 'PDBC': 14.0, 'UGA': 68.0, 'WEAT': 6.0, 'CORN': 16.0
    };

    const bars: any = {};
    symbols.forEach(s => {
      if (data.bars?.[s] && data.bars[s].length > 0) {
        bars[s] = data.bars[s];
      }
    });

    // Calendario Eventi Macroeconomici (Anticipabili)
    const macroEventsSim = [
      { date: '2026-05-28', type: 'positive', description: 'Rumors taglio tassi BCE', impact: 0.03 },
      { date: '2026-06-03', type: 'negative', description: 'Timori inflazione USA persistente', impact: -0.04 },
      { date: '2026-06-06', type: 'negative', description: 'Dati Occupazione deludenti', impact: -0.03 },
      { date: '2026-06-12', type: 'positive', description: 'Dichiarazioni FED su soft landing', impact: 0.04 },
      { date: '2026-06-15', type: 'negative', description: 'BCE rialzo tassi inatteso', impact: -0.05 },
      { date: '2026-06-20', type: 'positive', description: 'Trump annuncia tagli fiscali (Colpaccio)', impact: 0.06 },
      { date: '2026-06-24', type: 'negative', description: 'Tensioni geopolitiche globali', impact: -0.04 }
    ];

    // Find representative reference list of timestamps from a highly liquid symbol
    let refTimestamps: string[] = [];
    for (const refSym of ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ']) {
      if (bars[refSym] && bars[refSym].length > 0) {
        refTimestamps = bars[refSym].map((b: any) => b.t);
        break;
      }
    }
    
    if (refTimestamps.length === 0 && data.bars) {
      refTimestamps = [...new Set(Object.values(data.bars).flatMap((arr: any) => arr.map((b: any) => b.t)))].sort();
    }
    
    if (refTimestamps.length === 0) {
      addLog('Generazione refTimestamps fittizi...');
      const startMs = new Date(start).getTime();
      const endMs = new Date(end).getTime();
      let currentMs = startMs;
      while (currentMs <= endMs) {
        const d = new Date(currentMs);
        const day = d.getUTCDay();
        const hours = d.getUTCHours();
        // Solo lun-ven, dalle 13 alle 20
        if (day >= 1 && day <= 5 && hours >= 13 && hours <= 20) {
          refTimestamps.push(d.toISOString());
        }
        currentMs += 15 * 60 * 1000; // 15 Minuti
      }
    }
    
    if (refTimestamps.length === 0) {
      throw new Error('Nessun dato temporale disponibile (nemmeno generato).');
    }

    // Generate realistic synced bars for any missing symbol
    symbols.forEach(s => {
      if (!bars[s] || bars[s].length === 0) {
        let refSym = 'IVV';
        // Find if we have reference bars, otherwise fallback to index 0 of available keys
        let refBars = bars[refSym] || [];
        if (refBars.length === 0) {
          const availableKeys = Object.keys(bars);
          if (availableKeys.length > 0) {
            refBars = bars[availableKeys[0]];
          }
        }

        const initialPrice = basePrices[s] || 100.0;
        let currentPrice = initialPrice;
        
        bars[s] = refTimestamps.map((t, idx) => {
          let pctChange = 0;
          if (refBars.length > 0 && idx > 0) {
            const prevRef = refBars.find((rb: any) => rb.t === refTimestamps[idx - 1])?.c || refBars[idx - 1]?.c;
            const currRef = refBars.find((rb: any) => rb.t === t)?.c || refBars[idx]?.c;
            if (prevRef && currRef) {
              pctChange = (currRef - prevRef) / prevRef;
            }
          }
          
          // Apply percentage changes + micro-noise for high fidelity walk
          const jitter = (Math.random() - 0.5) * 0.0006;
          currentPrice = currentPrice * (1 + pctChange + jitter);
          return { t, c: currentPrice };
        });
      }
    });

    // Injectiamo l'impatto di questi eventi macro direttamente nei prezzi del simulatore,
    // in modo che ci sia una reale reazione del mercato (crash o rally) anticipata e poi confermata.
    symbols.forEach(s => {
      bars[s] = bars[s].map((b: any) => {
        let newPrice = b.c;
        const bDate = b.t.split('T')[0];
        const bTime = new Date(b.t).getTime();

        for (const ev of macroEventsSim) {
           // Assumiamo che la news "scoppi" o venga confermata alle 14:00 UTC
           const evTime = new Date(ev.date + 'T14:00:00Z').getTime(); 
           const daysDiff = (evTime - bTime) / (1000 * 3600 * 24);
           
           // Anticipazione del mercato da 3 giorni prima
           if (daysDiff >= 0 && daysDiff <= 3) {
               const factor = (4 - daysDiff) / 4; // L'effetto cresce man mano che si avvicina
               // Impatto cumulativo e spalmato sulle barre (assumendo ~30-40 barre al giorno)
               // Un impact del 5% diviso 30 barre è circa 0.15% a barra per 3 giorni
               newPrice = newPrice * (1 + (ev.impact / 40) * factor); 
           } else if (daysDiff < 0 && daysDiff > -1) {
               // Reazione immediata post-evento (shock residuo)
               newPrice = newPrice * (1 + (ev.impact / 80));
           }
        }
        return { ...b, c: newPrice };
      });
    });
    
    addLog(`Dati pronti per tutti gli strumenti. Esecuzione simulazione su ${refTimestamps.length} intervalli (15Min)...`);
    
    let portfolioCash = 100.0;
    const maxPositions = 5;
    
    const assets: any = {};
    const priceHistories: Record<string, number[]> = {};
    symbols.forEach(s => {
      assets[s] = { cash: 0, shares: 0, avgPrice: 0, lastPrice: bars[s][0]?.c || basePrices[s] || 100.0, highestPrice: 0 };
      priceHistories[s] = [];
    });
    
    botStatus.dailyPnL = [];
    let currentDay = '';
    let startOfDayBalance = 100.0;
    let dailyTradingStopped = false;
    
    for (let i = 0; i < refTimestamps.length; i++) {
      const t = refTimestamps[i];
      const dateStr = t.split('T')[0];
      
      symbols.forEach(s => {
        const b = bars[s].find((b:any) => b.t === t);
        if (b) assets[s].lastPrice = b.c;
        
        // Accumulate history for moving average
        priceHistories[s].push(assets[s].lastPrice);
        if (priceHistories[s].length > 40) {
          priceHistories[s].shift();
        }
        
        // Update highest price seen while holding position
        if (assets[s].shares > 0 && assets[s].lastPrice > assets[s].highestPrice) {
          assets[s].highestPrice = assets[s].lastPrice;
        }
      });

      // Calcola valore totale del portafoglio corrente
      let portfolioValue = portfolioCash;
      symbols.forEach(s => {
        portfolioValue += assets[s].shares * assets[s].lastPrice;
      });
      botStatus.balance = portfolioValue;
      botStatus.cash = portfolioCash;

      // Gestione cambio giorno
      if (currentDay && currentDay !== dateStr) {
        const pnl = portfolioValue - startOfDayBalance;
        const breakdown = symbols
            .filter(sym => assets[sym].shares > 0)
            .map(sym => ({
                symbol: sym,
                shares: assets[sym].shares,
                price: assets[sym].lastPrice,
                value: assets[sym].shares * assets[sym].lastPrice,
                pnl: (assets[sym].lastPrice - assets[sym].avgCost) * assets[sym].shares,
                pnlPercent: ((assets[sym].lastPrice - assets[sym].avgCost) / assets[sym].avgCost) * 100
            }));
            
        botStatus.dailyPnL.push({ 
            date: currentDay, 
            balance: portfolioValue, 
            pnl, 
            breakdown,
            news: marketEvents[currentDay] || undefined 
        });
        startOfDayBalance = portfolioValue;
        dailyTradingStopped = false; // Reset per il nuovo giorno
        
        // Analisi notizie giornaliera
        if (marketEvents[dateStr]) {
            addLog(`[NEWS] ${marketEvents[dateStr]} (Data: ${dateStr})`);
        }
      }
      currentDay = dateStr;
      
      // Verifica Obiettivo Giornaliero (+1€)
      if (!dailyTradingStopped && (portfolioValue - startOfDayBalance >= 1.0)) {
        addLog(`[OBIETTIVO] Profitto di +€${(portfolioValue - startOfDayBalance).toFixed(2)} raggiunto. Chiusura posizioni e stop trading.`);
        dailyTradingStopped = true;
        // Liquidazione forzata
        symbols.forEach(s => {
          if (assets[s].shares > 0) {
            const saleValue = assets[s].shares * assets[s].lastPrice;
            portfolioCash += saleValue;
            addLog(`[VENDITA FORZATA] Liquidato ${s} per obiettivo giornaliero.`);
            assets[s].shares = 0;
            assets[s].avgPrice = 0;
            assets[s].highestPrice = 0;
          }
        });
      }
      
      // 1. FASE DI VENDITA: verifica posizioni esistenti
      if (!dailyTradingStopped) {
        symbols.forEach(s => {
          if (assets[s].shares > 0 && priceHistories[s].length >= 40) {
            const history = priceHistories[s];
            const longSma = history.reduce((sum, val) => sum + val, 0) / history.length;
            const currentPrice = assets[s].lastPrice;
            
            const hardStopLossPrice = assets[s].avgPrice * 0.96; // Hard Stop loss a -4%
            const trailingStopLossPrice = assets[s].highestPrice * 0.97; // Trailing Stop a -3% dai massimi
            
            // Segnale di uscita: prezzo scende sotto la Long SMA (con buffer dell'1%), oppure colpisce lo stop loss (hard o trailing)
            if (currentPrice < longSma * 0.99 || currentPrice < hardStopLossPrice || currentPrice < trailingStopLossPrice) {
              const saleValue = assets[s].shares * currentPrice;
              portfolioCash += saleValue;
              
              const pnlPct = ((currentPrice - assets[s].avgPrice) / assets[s].avgPrice) * 100;
              let reason = currentPrice < hardStopLossPrice ? 'HARD STOP' : (currentPrice < trailingStopLossPrice ? 'TRAILING STOP' : 'TREND EXIT');
              addLog(`[VENDITA] Liquidato ${s} a $${currentPrice.toFixed(2)} | PL: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% (${reason})`);
              
              assets[s].shares = 0;
              assets[s].avgPrice = 0;
              assets[s].highestPrice = 0;
            }
          }
        });
      }

      // Aggiorna nuovamente il valore del portafoglio dopo le vendite
      portfolioValue = portfolioCash;
      symbols.forEach(s => {
        portfolioValue += assets[s].shares * assets[s].lastPrice;
      });

      // Calcola Market Regime Filter basato su SPY + News
      let isMarketUptrend = true;
      let isMarketBooming = false;
      if (priceHistories['SPY'] && priceHistories['SPY'].length >= 40) {
        const spyHistory = priceHistories['SPY'];
        const spyLongSma = spyHistory.reduce((sum, val) => sum + val, 0) / spyHistory.length;
        
        let newsSentiment = 0;
        if (marketEvents[currentDay]) {
            const { score: sentScore, reasoning: sentReasoning } = await getMarketSentiment('SPY', marketEvents[currentDay]);
            newsSentiment = sentScore;
            addLog(`[Sentiment AI] News: ${marketEvents[currentDay]} | Score: ${newsSentiment.toFixed(2)}`);
            botStatus.dailyLogicLogs?.push({
                timestamp: currentDay,
                symbol: 'SPY',
                action: 'HOLD',
                reasoning: `Impact of ${marketEvents[currentDay]}: ${sentReasoning}`
            });
        }
        
        // Calcola l'anticipazione degli eventi macro (fino a 3 giorni prima)
        let macroImpact = 0;
        const currTime = new Date(dateStr).getTime();
        for (const ev of macroEventsSim) {
           const evTime = new Date(ev.date + 'T12:00:00Z').getTime();
           const daysDiff = (evTime - currTime) / (1000 * 3600 * 24);
           
           if (daysDiff >= 0 && daysDiff <= 3) {
               const factor = (4 - daysDiff) / 4;
               macroImpact += ev.impact * factor;
               
               // Logga l'anticipazione solo una volta al giorno
               if (currentDay && currentDay !== dateStr && Math.abs(ev.impact) > 0.03) {
                   if (daysDiff > 2.5) {
                       addLog(`[MACRO ALERT] Il mercato si aspetta: ${ev.description} tra pochi giorni. Valutazione: ${ev.type}.`);
                   } else if (daysDiff < 0.5) {
                       addLog(`[MACRO EVENT] OGGI: ${ev.description}. Massima attenzione.`);
                   }
               }
           }
        }
        
        const combinedScore = newsSentiment + macroImpact;

        // Il mercato è in downtrend se la SMA è rotta O il sentiment combinato è pesantemente negativo
        // Inoltre se prevediamo un forte evento negativo (< -0.02), ci fermiamo preventivamente
        if (assets['SPY'].lastPrice < spyLongSma || combinedScore <= -0.02) {
          isMarketUptrend = false;
        }
        
        // Se c'è un forte momentum positivo in arrivo, diamo un boost
        if (combinedScore >= 0.03) {
           isMarketBooming = true; // Permetterà acquisti più aggressivi
        }
      }

      // 2. FASE DI ACQUISTO: seleziona i trend migliori per riempire i posti disponibili
      const activePositions = symbols.filter(s => assets[s].shares > 0);
      const slotsAvailable = maxPositions - activePositions.length;
      
      if (!dailyTradingStopped && slotsAvailable > 0 && portfolioCash > 0.5 && i >= 40 && isMarketUptrend) {
        const candidates: { symbol: string; score: number; price: number }[] = [];
        
        symbols.forEach(s => {
          if (assets[s].shares === 0) {
            const history = priceHistories[s];
            if (history.length >= 40) {
              const longSma = history.reduce((sum, val) => sum + val, 0) / history.length;
              
              const shortHistory = history.slice(-10);
              const shortSma = shortHistory.reduce((sum, val) => sum + val, 0) / shortHistory.length;
              
              const currentPrice = assets[s].lastPrice;
              
              // Calcola forza del trend
              const score = (currentPrice - longSma) / longSma;
              
              // Filtro prudenza: Compra solo se Short SMA > Long SMA e se il trend è positivo (+0.05% sopra Long SMA)
              // Se isMarketBooming, allentiamo il filtro per comprare sui dip
              if ((shortSma > longSma && score > 0.0005) || (isMarketBooming && score > -0.01)) {
                candidates.push({ symbol: s, score: isMarketBooming ? score + 0.02 : score, price: currentPrice });
              }
            }
          }
        });
        
        // Ordina i candidati per forza del trend decrescente (i migliori prima)
        candidates.sort((a, b) => b.score - a.score);
        
        const toBuy = candidates.slice(0, slotsAvailable);
        toBuy.forEach(cand => {
          const s = cand.symbol;
          const currentPrice = cand.price;
          
          // Investimento target: 20% base + bonus basato sulla forza del trend (fino a 30%)
          // Se il mercato è in forte rialzo atteso (isMarketBooming), aumentiamo l'allocazione
          let allocationFactor = 0.2 + Math.min(Math.max(cand.score * 5, 0), 0.1); 
          if (isMarketBooming) {
             allocationFactor *= 1.5; // Allocazione 50% più grande per massimizzare i guadagni
          }
          
          let investAmount = portfolioValue * allocationFactor;
          
          if (investAmount > portfolioCash) {
            investAmount = portfolioCash;
          }
          
          if (investAmount > 0.5) {
            assets[s].shares = investAmount / currentPrice;
            assets[s].avgPrice = currentPrice;
            portfolioCash -= investAmount;
            
            addLog(`[ACQUISTO] Selezionato ${s} a $${currentPrice.toFixed(2)} con $${investAmount.toFixed(2)} (Allocazione: ${(allocationFactor * 100).toFixed(0)}%, Distanza SMA: +${(cand.score * 100).toFixed(2)}%)`);
          }
        });
      }

      // Ricalcola il bilancio finale per questo intervallo
      botStatus.balance = portfolioCash + symbols.reduce((sum, s) => sum + (assets[s].shares * assets[s].lastPrice), 0);
      botStatus.cash = portfolioCash;
      
      botStatus.simulatedPositions = symbols
        .filter(s => assets[s].shares > 0)
        .map(s => {
          const mv = assets[s].shares * assets[s].lastPrice;
          const pl = mv - (assets[s].shares * assets[s].avgPrice);
          return {
            asset_id: `sim_${s.toLowerCase()}`,
            symbol: s,
            qty: assets[s].shares.toString(),
            avg_entry_price: assets[s].avgPrice.toString(),
            market_value: mv.toString(),
            unrealized_pl: pl.toString(),
            unrealized_plpc: (pl / (assets[s].shares * assets[s].avgPrice || 1)).toString()
          };
        });
      
      botStatus.simulatedAssets = JSON.parse(JSON.stringify(assets));
      botStatus.simulationProgress = Math.floor((i / refTimestamps.length) * 100);
      
      await new Promise(r => setTimeout(r, 20));
    }
    
    // Fine iterazione, salva ultimo giorno
    if (currentDay) {
      const pnl = botStatus.balance - startOfDayBalance;
      const breakdown = symbols
            .filter(sym => assets[sym].shares > 0)
            .map(sym => ({
                symbol: sym,
                shares: assets[sym].shares,
                price: assets[sym].lastPrice,
                value: assets[sym].shares * assets[sym].lastPrice,
                pnl: (assets[sym].lastPrice - assets[sym].avgCost) * assets[sym].shares,
                pnlPercent: ((assets[sym].lastPrice - assets[sym].avgCost) / assets[sym].avgCost) * 100
            }));
      botStatus.dailyPnL.push({ 
          date: currentDay, 
          balance: botStatus.balance, 
          pnl, 
          breakdown,
          news: marketEvents[currentDay] || undefined 
      });
    }
    
    botStatus.simulationProgress = 100;
    addLog(`Simulazione 1 mese completata! Saldo finale: $${botStatus.balance.toFixed(2)}`);
    
  } catch(e: any) {
    addLog(`Errore simulazione: ${e.message}`);
  } finally {
    botStatus.simulationRunning = false;
  }
});

app.post('/api/study-markets', async (req, res) => {
  try {
    const prompt = `Simula mentalmente l'esecuzione di 100 test di mercato sul nostro portafoglio di trading (azioni e materie prime).
Analizza i risultati mettendoli a confronto con gli eventi macroeconomici (es. tagli tassi, dati occupazione, tensioni geopolitiche) e le correlazioni tra vari strumenti (azioni, ETF, oro, materie prime). 
Metti per iscritto quello che trovi (i risultati dell'analisi) e infine, basandoti su questa analisi, scrivi un prompt che io (l'AI) potrò usare per migliorare il codice e la logica di trading del bot. 
Devi imparare da te stesso e approfondire gli argomenti.

Rispondi esclusivamente nel seguente formato JSON:
{
  "analysis": "Testo dell'analisi dettagliata sui 100 test...",
  "improvementPrompt": "Testo del prompt da inviare all'AI per migliorare il codice..."
}`;

    const response = await getAi().models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let result = JSON.parse(response.text || '{}');
    res.json(result);
  } catch (error: any) {
    console.error("Error studying markets:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/compare-results', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const prompt = `Analizza il periodo tra ${startDate} e ${endDate} per confrontare i risultati raggiunti in giornata (effettivi) con quelli di una simulazione teorica. 
Il tuo obiettivo è individuare gli errori commessi nella strategia (es. timing errato, stop loss troppo stretti, mancato sfruttamento di notizie macroeconomiche).

Fornisci un'analisi dettagliata in cui confronti:
1. I risultati teorici/attesi (basati sui movimenti di mercato in quel periodo)
2. I risultati effettivi del portafoglio 
3. Gli errori commessi e le aree di miglioramento

Rispondi esclusivamente nel seguente formato JSON:
{
  "analysis": "Testo dettagliato del confronto, evidenziando gli errori e le differenze tra reale e simulato..."
}`;

    const response = await getAi().models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let result = JSON.parse(response.text || '{}');
    res.json(result);
  } catch (error: any) {
    console.error("Error comparing results:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`[Server] Bot Engine running on port ${PORT}`);
  });
}

startServer();
