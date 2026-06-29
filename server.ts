import 'dotenv/config';
import express from 'express';
import path from 'path';
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

function getAlpacaConfig() {
  const isConfigured = !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY);
  // Default to paper trading if botStatus is not defined yet, otherwise use current user preference
  const tradingMode = typeof botStatus !== 'undefined' ? botStatus.tradingMode : 'paper';
  const isLive = tradingMode === 'live';
  const baseUrl = isLive 
    ? 'https://api.alpaca.markets/v2'
    : 'https://paper-api.alpaca.markets/v2';
  return { isConfigured, isLive, baseUrl };
}

const ALPACA_DATA_URL = 'https://data.alpaca.markets/v2';

const basePrices: Record<string, number> = {
  // Equities
  'SPY': 545.0, 'VOO': 500.0, 'IVV': 500.0, 'VTI': 265.0, 'QQQ': 480.0,
  // Commodities
  'GLD': 215.0, 'SLV': 27.0, 'USO': 75.0, 'UNG': 15.0, 'DBA': 24.0, 'DBC': 22.0, 'PDBC': 14.0, 'UGA': 68.0, 'WEAT': 6.0, 'CORN': 16.0,
  // Bonds
  'BND': 72.0, 'AGG': 97.0, 'TLT': 94.0, 'IEF': 95.0, 'SHY': 81.0, 'LQD': 108.0, 'HYG': 77.0, 'TIP': 106.0, 'GOVT': 23.0, 'VCIT': 79.0
};

const initialAssets: any = {};
Object.keys(basePrices).forEach(sym => {
  initialAssets[sym] = { cash: 0, shares: 0, avgPrice: 0, lastPrice: basePrices[sym], highestPrice: 0 };
});

// In-memory state simulating a database (e.g., Firestore)
let botStatus: {
  active: boolean;
  balance: number;
  lastCheck: string | null;
  mode: string;
  tradingMode: 'paper' | 'live';
  accountNumber?: string;
  dailyPnL?: { date: string; pnl: number; balance: number; breakdown?: any[]; news?: string }[];
  cash?: number;
  latestDailyReport?: string;
  dailyLogicLogs?: { timestamp: string; symbol: string; action: string; reasoning: string; price?: number }[];
  userFeedbackRules?: string[];
} = {
  active: false,
  balance: 100.0,
  lastCheck: null as string | null,
  mode: (getAlpacaConfig().isConfigured ? 'Alpaca (Simulazione)' : 'Alpaca (Configurazione mancante)'),
  tradingMode: 'paper',
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

async function executeTradingCycle(force: boolean = false) {
  if (!botStatus.active && !force) {
    addLog(`[System] Ciclo di trading ignorato: bot non attivo.`);
    return;
  }
  
  botStatus.lastCheck = new Date().toISOString();
  
  // Logic for Alpaca
  const { isConfigured, isLive, baseUrl } = getAlpacaConfig();
  if (isConfigured) {
    try {
      const response = await fetch(`${baseUrl}/account`, {
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
      
      const labelTipoConto = isLive ? 'Reale (Live)' : 'Simulazione (Paper)';
      addLog(`[Alpaca] Conto di ${labelTipoConto} verificato con successo. Saldo Equity: $${botStatus.balance.toFixed(2)} | Potere d'Acquisto: $${account.buying_power}`);
      
      // Check sentiment before buying
      const { score: sentimentScore, reasoning: sentimentReasoning } = await getMarketSentiment('SPY'); 
      if (sentimentScore > 0.2) {
          addLog(`[Mercato] Sentiment positivo per SPY: ${sentimentScore.toFixed(2)}. Procedo all'acquisto su Alpaca (${labelTipoConto}).`);
          botStatus.dailyLogicLogs?.push({
              timestamp: new Date().toISOString(),
              symbol: 'SPY',
              action: 'BUY',
              reasoning: sentimentReasoning
          });
          
          // Esecuzione dell'ordine su Alpaca
          const orderResponse = await fetch(`${baseUrl}/orders`, {
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
            addLog(`[Alpaca] Ordine di ACQUISTO eseguito con successo per SPY! ID: ${orderData.id}`);
          } else {
            const errorData = await orderResponse.json();
            addLog(`[Alpaca Errore Ordine] Non è stato possibile eseguire l'ordine: ${errorData.message}`);
          }
          
      } else {
          addLog(`[Mercato] Sentiment neutro/negativo per SPY: ${sentimentScore.toFixed(2)}. Nessuna operazione.`);
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
    // Nessuna azione se Alpaca non è configurato, per evitare "fake trades" non richiesti
    if (botStatus.active || force) {
      addLog(`[Alpaca] In attesa di configurazione API Key per operare sul mercato.`);
    }
  }
}

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

// Endpoint per trigger report (supporta sia Cloud Scheduler che manuale)
app.all(['/run-daily-report', '/api/trigger-daily-report'], async (req, res) => {
  addLog('[Trigger Report] Ricevuta richiesta di generazione report da Cloud Scheduler o manuale...');
  try {
    await generateAndSendDailyReport();
    addLog('[Trigger Report] Generazione report completata. Rispondo OK.');
    res.status(200).send('OK');
  } catch (error: any) {
    addLog(`[Trigger Report Errore] Errore critico nel report: ${error.message}`);
    res.status(200).send(`ERROR_BUT_HANDLED: ${error.message}`);
  }
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

app.all(['/run-strategy', '/api/trigger'], async (req, res) => {
  addLog('[Trigger Strategy] Ricevuta richiesta di attivazione strategia da Cloud Scheduler o manuale...');
  try {
    // Forziamo l'esecuzione per evitare che lo stato in-memory 'active=false' (dovuto a cold start) blocchi il bot
    await executeTradingCycle(true);
    addLog('[Trigger Strategy] Ciclo di trading completato con successo. Rispondo OK.');
    res.status(200).send('OK');
  } catch (error: any) {
    addLog(`[Trigger Strategy Errore] Errore critico nel ciclo di trading: ${error.message}`);
    res.status(200).send(`ERROR_BUT_HANDLED: ${error.message}`);
  }
});

app.post('/api/analyze-market', async (req, res) => {
  const { symbol } = req.body;
  const { score: sentimentScore, reasoning } = await getMarketSentiment(symbol);
  res.json({ symbol, sentiment: sentimentScore, reasoning });
});

app.get('/api/status', async (req, res) => {
  let positions = [];
  const { isConfigured, baseUrl } = getAlpacaConfig();
  
  // Dynamic update of mode based on actual environment configuration and chosen trading mode
  botStatus.mode = isConfigured 
    ? `Alpaca (${botStatus.tradingMode === 'live' ? 'Reale' : 'Simulazione'})` 
    : 'Alpaca (Configurazione mancante)';
  
  if (isConfigured) {
    try {
      const posResponse = await fetch(`${baseUrl}/positions`, {
        headers: {
          'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || ''
        }
      });
      if (posResponse.ok) {
        positions = await posResponse.json();
      }
      
      const accResponse = await fetch(`${baseUrl}/account`, {
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

app.post('/api/set-trading-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'paper' || mode === 'live') {
    botStatus.tradingMode = mode;
    const { isConfigured } = getAlpacaConfig();
    botStatus.mode = isConfigured 
      ? `Alpaca (${mode === 'paper' ? 'Simulazione' : 'Reale'})` 
      : 'Alpaca (Configurazione mancante)';
    addLog(`[Sistema] Modalità di trading impostata su: ${mode === 'paper' ? 'Conto Simulazione (Paper)' : 'Conto Reale (Live)'}`);
    res.json({ status: botStatus, logs: tradeLogs });
  } else {
    res.status(400).json({ success: false, message: 'Modalità di trading non valida.' });
  }
});

app.post('/api/reset', (req, res) => {
  const { isConfigured } = getAlpacaConfig();
  botStatus = {
    active: false,
    balance: 100.0,
    lastCheck: null,
    mode: (isConfigured ? 'Alpaca (Simulazione)' : 'Alpaca (Configurazione mancante)'),
    tradingMode: 'paper',
    dailyPnL: [],
    cash: 100.0,
    latestDailyReport: undefined,
    dailyLogicLogs: [],
    userFeedbackRules: []
  };
  tradeLogs = [];
  addLog('Sistema ripristinato a €100.00');
  res.json({ status: botStatus, logs: tradeLogs });
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
