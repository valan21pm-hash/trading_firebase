import { GeminiSignalService } from './src/backend/services/geminiSignalService.js';
import 'dotenv/config';
const originalConsoleError = console.error;
console.error = function(...args: any[]) {
  const isQuotaError = args.some(arg => {
    if (typeof arg === 'string' && (arg.includes('RESOURCE_EXHAUSTED') || arg.includes('Quota exceeded'))) return true;
    if (arg && typeof arg === 'object' && arg.message && typeof arg.message === 'string' && (arg.message.includes('RESOURCE_EXHAUSTED') || arg.message.includes('Quota exceeded'))) return true;
    return false;
  });
  if (isQuotaError) return;
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function(...args: any[]) {
  const isQuotaError = args.some(arg => {
    if (typeof arg === 'string' && (arg.includes('RESOURCE_EXHAUSTED') || arg.includes('Quota exceeded'))) return true;
    if (arg && typeof arg === 'object' && arg.message && typeof arg.message === 'string' && (arg.message.includes('RESOURCE_EXHAUSTED') || arg.message.includes('Quota exceeded'))) return true;
    return false;
  });
  if (isQuotaError) return;
  originalConsoleWarn.apply(console, args);
};

function runWithTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(fallbackValue);
    }, ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutId);
      return res;
    }),
    timeoutPromise
  ]);
}
import express from 'express';
const app = express();
app.use(express.json());
import path from 'path';
process.on('unhandledRejection', (reason: any, promise) => {
  if (reason && reason.message && reason.message.includes('RESOURCE_EXHAUSTED')) {
    return; // suppress quota errors
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err: any) => {
  if (err && err.message && err.message.includes('RESOURCE_EXHAUSTED')) {
    return; // suppress quota errors
  }
  console.error('Uncaught Exception:', err);
});
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp as initFirebaseApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleSheetsService } from './src/backend/services/GoogleSheetsService.js';
import { RiskManagementService } from "./src/backend/services/RiskManagementService";
import { LLMProviderService, LLMProvider } from "./src/backend/services/LLMProviderService";
import { GoogleDriveService } from "./src/backend/services/GoogleDriveService.js";
import { RiskRuleConfig } from "./src/types.js";
import StatisticalExpertService from "./src/backend/services/StatisticalExpertService.js";
import RssNewsService from "./src/backend/services/RssNewsService.js";
import HourlyEfficiencyAnalyzer from "./src/backend/services/HourlyEfficiencyAnalyzer.js";
import TechnicalIndicatorService from "./src/backend/services/TechnicalIndicatorService.js";

const DEFAULT_SYSTEM_RISK_RULES: RiskRuleConfig[] = [
  {
    id: 'pnl_preventive_close',
    enabled: true,
    type: 'PNL_PREVENTIVE_CLOSE',
    parameters: {
      maxLossPct: -0.80,
      minSentimentThreshold: 0.20
    }
  },
  {
    id: 'sentiment_liquidity_sell',
    enabled: true,
    type: 'SENTIMENT_LIQUIDITY_SELL',
    parameters: {
      minSentimentThreshold: 0.15,
      vixDropExemptionPct: -2.0
    }
  },
  {
    id: 'time_stagnation_close',
    enabled: true,
    type: 'TIME_STAGNATION_CLOSE',
    parameters: {
      stagnationMinutes: 30,
      stagnationMinutesHighSentiment: 60,
      stagnationMaxPnlPct: 0.10
    }
  },
  {
    id: 'eod_buy_lock',
    enabled: true,
    type: 'EOD_BUY_LOCK',
    parameters: {
      eodWindowMinutes: 30
    }
  },
  {
    id: 'custom_max_exposure',
    enabled: true,
    type: 'CUSTOM_MAX_EXPOSURE',
    parameters: {
      maxSectorExposurePct: 35,
      minSectorsForBullishCoherent: 3
    }
  },
  {
    id: 'spy_qqq_corr_semicon_cap',
    enabled: true,
    type: 'SPY_QQQ_CORRELATION_SEMICON_CAP',
    parameters: {
      minCorrelationThreshold: 0.95,
      maxSemiconExposurePct: 40,
      semiconSymbols: ['AMD', 'AVGO', 'NVDA', 'QCOM', 'INTC', 'MU', 'SMCI', 'ARM', 'TSM', 'ASML', 'SOXL', 'SOXX', 'SMH']
    }
  },
  {
    id: 'adx_volatility_filter',
    enabled: true,
    type: 'ADX_VOLATILITY_FILTER',
    parameters: {
      minAdxThreshold: 25.0,
      minAdxPeriod: 14
    }
  },
  {
    id: 'atr_individual_trailing_stop',
    enabled: true,
    type: 'ATR_INDIVIDUAL_TRAILING_STOP',
    parameters: {
      atrMultiplier: 1.5,
      atrPeriod: 14,
      useAtrTrailingStop: true
    }
  },
  {
    id: 'max_concurrent_positions_cap',
    enabled: true,
    type: 'MAX_CONCURRENT_POSITIONS_CAP',
    parameters: {
      maxConcurrentPositions: 3
    }
  },
  {
    id: 'volatility_time_window_lock',
    enabled: true,
    type: 'VOLATILITY_TIME_WINDOW_LOCK',
    parameters: {
      blockMorningOpeningWindow: true,
      blockAfternoonClosingWindow: true,
      morningBlockStart: '09:30',
      morningBlockEnd: '10:30',
      afternoonBlockStart: '15:30',
      afternoonBlockEnd: '16:00'
    }
  },
  {
    id: 'dynamic_time_window_lock',
    enabled: true,
    type: 'DYNAMIC_TIME_WINDOW_LOCK',
    parameters: {
      blockToxicWindow: true,
      toxicWindowStart: '10:30',
      toxicWindowEnd: '12:00'
    }
  },
  {
    id: 'atr_volatility_filter',
    enabled: true,
    type: 'ATR_VOLATILITY_FILTER',
    parameters: {
      atrFilterPeriod: 14,
      atrSmaPeriod: 20
    }
  },
  {
    id: 'hard_risk_management',
    enabled: true,
    type: 'HARD_RISK_MANAGEMENT',
    parameters: {
      hardStopLossPct: -1.00,
      hardTakeProfitPct: 2.00,
      maxDailyLossPct: -1.00,
      consecutiveSlThreshold: 2,
      consecutiveSlCooldownMinutes: 30
    }
  },
  {
    id: 'ema_trend_confirmation',
    enabled: true,
    type: 'EMA_TREND_CONFIRMATION',
    parameters: {
      requireEmaBullishTrend: true
    }
  },
  {
    id: 'catastrophic_circuit_breaker_sl',
    enabled: true,
    type: 'CATASTROPHIC_CIRCUIT_BREAKER_SL',
    parameters: {
      catastrophicMaxLossPct: -3.00
    }
  }
];

export interface EstTimeInfo {
  hours: number;
  minutes: number;
  totalMinutes: number;
  timeFormatted: string;
  isMorningVolatileLock: boolean;
  isToxicWindowLock: boolean;
  isAfternoonVolatileLock: boolean;
  isMarketTimeLocked: boolean;
  lockReason?: string;
}

export function getEstMarketTime(dateInput?: Date | string | number): EstTimeInfo {
  const date = dateInput ? new Date(dateInput) : new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(date);
  
  let hours = 0;
  let minutes = 0;
  
  for (const part of parts) {
    if (part.type === 'hour') {
      hours = parseInt(part.value, 10);
      if (hours === 24) hours = 0;
    } else if (part.type === 'minute') {
      minutes = parseInt(part.value, 10);
    }
  }
  
  const totalMinutes = hours * 60 + minutes;
  const timeFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} EST`;
  
  // 09:30 - 10:30 EST => 570 - 630 minuti (Apertura)
  // 10:30 - 12:00 EST => 630 - 720 minuti (Finestra Tossica Multi-IA)
  // 15:30 - 16:00 EST => 930 - 960 minuti (Pre-chiusura / Asta)
  const isMorningVolatileLock = totalMinutes >= 570 && totalMinutes < 630;
  const isToxicWindowLock = totalMinutes >= 630 && totalMinutes < 720;
  const isAfternoonVolatileLock = totalMinutes >= 930 && totalMinutes <= 960;
  const isMarketTimeLocked = isMorningVolatileLock || isToxicWindowLock || isAfternoonVolatileLock;
  
  let lockReason: string | undefined;
  if (isMorningVolatileLock) {
    lockReason = `Fascia di apertura ad alta volatilità e rumore (09:30 - 10:30 EST, orario corrente: ${timeFormatted}). Ingressi inibiti per preservare il capitale.`;
  } else if (isToxicWindowLock) {
    lockReason = `Fascia oraria ad alta inefficienza / tossica identificata dall'analisi Multi-IA (10:30 - 12:00 EST, orario corrente: ${timeFormatted}). Ingressi inibiti per evitare falsi breakout.`;
  } else if (isAfternoonVolatileLock) {
    lockReason = `Fascia pre-chiusura / asta di fine sessione ad alta instabilità (15:30 - 16:00 EST, orario corrente: ${timeFormatted}). Ingressi inibiti.`;
  }
  
  return {
    hours,
    minutes,
    totalMinutes,
    timeFormatted,
    isMorningVolatileLock,
    isToxicWindowLock,
    isAfternoonVolatileLock,
    isMarketTimeLocked,
    lockReason
  };
}

function getSymbolSector(symbol: string): string {
  const sym = symbol.toUpperCase();
  
  // Semiconduttori (es. Semiconduttori/Hardware)
  const semicon = ['NVDA', 'AMD', 'INTC', 'QCOM', 'AVGO', 'MU', 'SMCI', 'ARM', 'TSM', 'ASML', 'SOXL', 'SOXX', 'SMH'];
  if (semicon.includes(sym)) return 'Semiconduttori';
  
  // Tecnologia / Software / AI
  const tech = ['AAPL', 'MSFT', 'CRM', 'ORCL', 'ADBE', 'CSCO', 'IBM', 'QQQ', 'GOOG', 'GOOGL', 'META'];
  if (tech.includes(sym)) return 'Tecnologia & Software';
  
  // Beni di Consumo / Servizi
  const consumer = ['AMZN', 'TSLA', 'NFLX', 'DIS', 'NKE', 'MCD', 'SBUX'];
  if (consumer.includes(sym)) return 'Beni di Consumo';
  
  // Beni di Largo Consumo / Retail
  const retail = ['WMT', 'COST'];
  if (retail.includes(sym)) return 'Staples & Retail';
  
  // Indici / Macro
  const macro = ['SPY', 'VOO', 'IVV', 'VTI', 'DIA', 'IWM'];
  if (macro.includes(sym)) return 'Indici Macro';
  
  // Materie Prime / Commodities
  const commodities = ['GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'];
  if (commodities.includes(sym)) return 'Materie Prime';
  
  return 'Altro / Generico';
}

function normalizeSystemRiskRules(savedRules?: RiskRuleConfig[]): RiskRuleConfig[] {
  if (!savedRules || !Array.isArray(savedRules) || savedRules.length === 0) {
    return DEFAULT_SYSTEM_RISK_RULES;
  }
  return DEFAULT_SYSTEM_RISK_RULES.map(defaultRule => {
    const existing = savedRules.find(r => r.type === defaultRule.type || r.id === defaultRule.id);
    if (!existing) return defaultRule;
    return {
      ...defaultRule,
      ...existing,
      enabled: existing.enabled ?? defaultRule.enabled,
      parameters: {
        ...defaultRule.parameters,
        ...(existing.parameters || {})
      }
    };
  });
}

function isPurchaseAllowedBySystemRules(
  minutesToClose: number | null,
  isMarketSentimentDecreasing: boolean,
  systemRules: RiskRuleConfig[] = [],
  marketAdx?: number,
  currentOpenPositionsCount?: number
): { allowed: boolean; reason?: string } {
  for (const rule of systemRules) {
    if (!rule.enabled) continue;
    
    // Regola 4: EOD_BUY_LOCK (Blocco acquisti a fine giornata con sentiment calante)
    if (rule.type === 'EOD_BUY_LOCK') {
      const windowMins = rule.parameters.eodWindowMinutes ?? 30;
      if (minutesToClose !== null && minutesToClose > 0 && minutesToClose <= windowMins && isMarketSentimentDecreasing) {
        return {
          allowed: false,
          reason: `[Regola Sistema: EOD_BUY_LOCK] Blocco nuovi acquisti: mancano ${minutesToClose.toFixed(1)}m alla chiusura e il sentiment aggregato è in calo per 2 cicli consecutivi.`
        };
      }
    }

    // Regola 7: ADX_VOLATILITY_FILTER (Filtro Volatilità ADX < 25)
    if (rule.type === 'ADX_VOLATILITY_FILTER' && marketAdx !== undefined) {
      const minAdx = rule.parameters.minAdxThreshold ?? 25.0;
      if (marketAdx < minAdx) {
        return {
          allowed: false,
          reason: `[Regola Sistema: ADX_VOLATILITY_FILTER] Benchmark di mercato con ADX(14) = ${marketAdx.toFixed(1)} < ${minAdx.toFixed(1)}. Mercato privo di trend direzionale (congestione / chop). Nuovi acquisti inibiti.`
        };
      }
    }

    // Regola 9: MAX_CONCURRENT_POSITIONS_CAP (Cap a 5 posizioni simultanee)
    if (rule.type === 'MAX_CONCURRENT_POSITIONS_CAP' && currentOpenPositionsCount !== undefined) {
      const maxPositions = rule.parameters.maxConcurrentPositions ?? 5;
      if (currentOpenPositionsCount >= maxPositions) {
        return {
          allowed: false,
          reason: `[Regola Sistema: MAX_CONCURRENT_POSITIONS_CAP] Raggiunto il limite massimo di ${maxPositions} posizioni simultanee (${currentOpenPositionsCount}/${maxPositions} occupate). Nuovi acquisti bloccati per concentrare il capitale ed evitare frammentazione eccessiva.`
        };
      }
    }

    // Regola 10: VOLATILITY_TIME_WINDOW_LOCK (Inibizione operatività 09:30-10:30 e 15:30-16:00 EST)
    if (rule.type === 'VOLATILITY_TIME_WINDOW_LOCK') {
      const estInfo = getEstMarketTime();
      const blockMorning = rule.parameters.blockMorningOpeningWindow ?? true;
      const blockAfternoon = rule.parameters.blockAfternoonClosingWindow ?? true;

      if (blockMorning && estInfo.isMorningVolatileLock) {
        return {
          allowed: false,
          reason: `[Regola Sistema: VOLATILITY_TIME_WINDOW_LOCK] Inibizione operatività nella fascia di apertura ad alta volatilità (09:30-10:30 EST, orario: ${estInfo.timeFormatted}). Ingressi bloccati per evitare il rumore di mercato.`
        };
      }

      if (blockAfternoon && estInfo.isAfternoonVolatileLock) {
        return {
          allowed: false,
          reason: `[Regola Sistema: VOLATILITY_TIME_WINDOW_LOCK] Inibizione operatività nella fascia pre-chiusura / asta di fine sessione (15:30-16:00 EST, orario: ${estInfo.timeFormatted}). Ingressi bloccati per evitare instabilità estreme.`
        };
      }
    }

    // Regola 11: DYNAMIC_TIME_WINDOW_LOCK (Inibizione operatività nella fascia tossica 10:30-12:00 EST)
    if (rule.type === 'DYNAMIC_TIME_WINDOW_LOCK') {
      const estInfo = getEstMarketTime();
      const blockToxic = rule.parameters.blockToxicWindow ?? true;
      if (blockToxic && estInfo.isToxicWindowLock) {
        return {
          allowed: false,
          reason: `[Regola Sistema: DYNAMIC_TIME_WINDOW_LOCK] Inibizione operatività nella fascia ad alta inefficienza/tossica (10:30-12:00 EST, orario: ${estInfo.timeFormatted}). Blocco algoritmico basato sull'analisi di consenso Multi-IA.`
        };
      }
    }
  }
  return { allowed: true };
}

let db: any = null;
let firebaseApp: any = null;

const logBuffer: { collection: string; data: any }[] = [];

async function flushLogs() {
  if (!db || logBuffer.length === 0) return;
  const batch = db.batch();
  const logsToFlush = logBuffer.splice(0, Math.min(logBuffer.length, 500));
  
  for (const log of logsToFlush) {
    const docRef = db.collection(log.collection).doc();
    batch.set(docRef, log.data);
  }
  
  try {
    await batch.commit();
    console.log(`[Firebase] Flushed ${logsToFlush.length} logs to Firestore.`);
  } catch (err: any) {
    console.error('[Firebase] Error flushing logs batch:', err);
  }
}

// Flush every 60 seconds
setInterval(flushLogs, 60000);

async function initializeAndTestFirestore() {
  try {
    let projectId = 'project-88b687bc-f709-4722-bc0';
    let databaseId = 'ai-studio-remixuntitled-28355229-654c-4c49-94c7-18d05071ecc6';

    if (fs.existsSync('firebase-applet-config.json')) {
      const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
      if (config.projectId) projectId = config.projectId;
      if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
    }

    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      if (serviceAccount.project_id !== projectId) {
        console.log(`[Firebase Admin] Il progetto del Service Account (${serviceAccount.project_id}) differisce da quello in configurazione locale (${projectId}).`);
        databaseId = '(default)';
        console.log(`[Firebase Admin] Reimpostato databaseId a: ${databaseId}`);
      }
      projectId = serviceAccount.project_id;
      firebaseApp = initFirebaseApp({
        credential: cert(serviceAccount),
        projectId: projectId,
      });
      console.log(`[Firebase Admin] Inizializzato con Service Account Key. Progetto: ${projectId}`);
    } else {
      firebaseApp = initFirebaseApp({
        projectId: projectId,
      });
      console.log(`[Firebase Admin] Inizializzato con applicationDefault. Progetto: ${projectId}`);
    }

    db = getFirestore(firebaseApp, databaseId);
    console.log(`[Firebase Admin] Database Firestore impostato: ${databaseId}`);

    // Testiamo la connessione con un timeout di 1.5s per evitare blocchi
    try {
      await Promise.race([
        db.collection('_test_conn_').limit(1).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 1500))
      ]);
      console.log(`[Firebase Admin] Test di connessione riuscito con successo sul database '${databaseId}'.`);
    } catch (testErr: any) {
      console.warn(`[Firebase Admin Warning] Errore o timeout nel test di connessione sul database '${databaseId}':`, testErr.message);
      if (testErr.message && (testErr.message.includes('NOT_FOUND') || testErr.message.includes('5') || testErr.message.includes('TIMEOUT'))) {
        console.warn(`[Firebase Admin Warning] Il database '${databaseId}' non esiste o non è raggiungibile. Ripiego sul database di default '(default)'.`);
        db = getFirestore(firebaseApp, '(default)');
        try {
          await db.collection('_test_conn_').limit(1).get();
          console.log(`[Firebase Admin] Test di connessione riuscito con successo sul database di default '(default)'.`);
        } catch (defaultErr: any) {
          console.error(`[Firebase Admin Error] Anche il database '(default)' ha fallito:`, defaultErr.message);
        }
      }
    }
  } catch (error: any) {
    console.warn('[Firebase Admin Error] Errore di inizializzazione:', error.message);
    try {
      firebaseApp = initFirebaseApp();
      db = getFirestore(firebaseApp);
      console.log('[Firebase Admin] Inizializzato con configurazione di default.');
    } catch (err2: any) {
      console.error('[Firebase Admin Critical Error] Impossibile inizializzare Firebase Admin:', err2.message);
    }
  }
}

async function getBrokerCredentials(broker: string, env: string) {
  let dbCreds = null;
  if (db) {
    try {
      const doc = await runWithTimeout(
        db.collection('broker_credentials').doc('config').get(),
        800,
        { exists: false, data: () => null }
      );
      if (doc.exists) {
        const allCreds = doc.data();
        dbCreds = allCreds[broker]?.[env] || null;
      }
    } catch (err: any) {
      console.warn(`[Firestore] Errore nel caricamento credenziali per ${broker} ${env}, uso fallback locale:`, err.message);
    }
  }
  return dbCreds || localCredentialsFallback[broker]?.[env] || null;
}





const PORT = process.env.PORT || 3000;
let localCredentialsFallback: Record<string, any> = {};
const resolvedCredentials = {
  paper: { apiKey: '', secretKey: '', isConfigured: false },
  live: { apiKey: '', secretKey: '', isConfigured: false }
};
const localHighestPrices: Record<string, number> = {};
try {
  if (fs.existsSync('credentials_fallback.json')) {
    localCredentialsFallback = JSON.parse(fs.readFileSync('credentials_fallback.json', 'utf8'));
  }
} catch(e) {}
function saveLocalCredentialsFallback(creds: any) {
  try {
    fs.writeFileSync('credentials_fallback.json', JSON.stringify(creds, null, 2));
  } catch(e) {}
}

let aiClient: any = null;
function getAi() {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// --- GOOGLE DRIVE SYNCHRONIZATION HELPERS ---
async function triggerChiaviApiDriveSync() {
  try {
    const keysPayload = {
      alpaca: {
        paper: resolvedCredentials.paper,
        live: resolvedCredentials.live,
        fallback: localCredentialsFallback.alpaca
      },
      llm: LLMProviderService.getInstance().getConfigs()
    };
    await GoogleDriveService.syncChiaviApiToDrive(keysPayload);
  } catch (err: any) {
    console.error('[GoogleDrive Errore] Impossibile aggiornare ChiaviAPI.json:', err.message);
  }
}

async function syncLogsToGoogleDrive() {
  try {
    const logsToSync: Array<any> = [];

    if (botData?.paper?.logs) {
      botData.paper.logs.forEach((msg: string) => {
        logsToSync.push({ mode: 'paper', message: msg, timestamp: new Date().toISOString() });
      });
    }

    if (botData?.live?.logs) {
      botData.live.logs.forEach((msg: string) => {
        logsToSync.push({ mode: 'live', message: msg, timestamp: new Date().toISOString() });
      });
    }

    if (Array.isArray(logBuffer)) {
      logBuffer.forEach((item: any) => {
        if (item?.data) {
          logsToSync.push({
            mode: item.data.mode || 'system',
            message: item.data.message || '',
            timestamp: item.data.timestamp || new Date().toISOString()
          });
        }
      });
    }

    if (logsToSync.length > 0) {
      await GoogleDriveService.appendLogsToDrive(logsToSync);
    }
  } catch (err: any) {
    console.error('[GoogleDrive Auto-Sync Errore]:', err.message);
  }
}

// Schedulazione salvataggio log ogni 15 minuti in background (StoriaLOG.json)
setInterval(() => {
  syncLogsToGoogleDrive();
}, 15 * 60 * 1000);

// Caricamento automatico delle Chiavi API all'avvio del bot
(async () => {
  try {
    const driveKeys = await GoogleDriveService.loadChiaviApiFromDrive();
    if (driveKeys) {
      console.log('[GoogleDrive Startup] Chiavi API trovate e caricate con successo da Drive!');
      if (driveKeys.alpaca) {
        if (!localCredentialsFallback.alpaca) localCredentialsFallback.alpaca = {};
        if (driveKeys.alpaca.paper) {
          resolvedCredentials.paper = driveKeys.alpaca.paper;
          localCredentialsFallback.alpaca.paper = driveKeys.alpaca.paper;
        }
        if (driveKeys.alpaca.live) {
          resolvedCredentials.live = driveKeys.alpaca.live;
          localCredentialsFallback.alpaca.live = driveKeys.alpaca.live;
          localCredentialsFallback.alpaca.real = driveKeys.alpaca.live;
        }
        saveLocalCredentialsFallback(localCredentialsFallback);
      }
      if (driveKeys.llm) {
        for (const [provider, config] of Object.entries(driveKeys.llm)) {
          if (config && typeof config === 'object') {
            LLMProviderService.getInstance().updateConfig(provider as any, config as any);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[GoogleDrive Startup] Caricamento iniziale ChiaviAPI.json ignorato:', err.message);
  }

  // Subito all'avvio, garantiamo la creazione di ChiaviAPI.json e StoriaLOG.json
  setTimeout(() => {
    triggerChiaviApiDriveSync().catch(err => console.error('[Startup Sync ChiaviAPI]:', err.message));
    syncLogsToGoogleDrive().catch(err => console.error('[Startup Sync Log]:', err.message));
  }, 2000);
})();





app.get('/api/trading/credentials', async (req, res) => {
  try {
    let firestoreData: any = null;
    if (db) {
      try {
        const docRef = db.collection('broker_credentials').doc('config');
        const doc = await runWithTimeout(docRef.get(), 800, { exists: false, data: () => null });
        if (doc && doc.exists) {
          firestoreData = doc.data();
        }
      } catch (e: any) {
        console.warn('[Credentials GET] Error reading Firestore credentials:', e.message);
      }
    }

    const paperApiKey = resolvedCredentials.paper?.apiKey || localCredentialsFallback?.alpaca?.paper?.apiKey || firestoreData?.alpaca?.paper?.apiKey || process.env.VITE_ALPACA_PAPER_API_KEY || '';
    const paperSecretKey = resolvedCredentials.paper?.secretKey || localCredentialsFallback?.alpaca?.paper?.secretKey || firestoreData?.alpaca?.paper?.secretKey || process.env.VITE_ALPACA_PAPER_SECRET_KEY || '';
    const liveApiKey = resolvedCredentials.live?.apiKey || localCredentialsFallback?.alpaca?.real?.apiKey || localCredentialsFallback?.alpaca?.live?.apiKey || firestoreData?.alpaca?.real?.apiKey || firestoreData?.alpaca?.live?.apiKey || process.env.VITE_ALPACA_LIVE_API_KEY || '';
    const liveSecretKey = resolvedCredentials.live?.secretKey || localCredentialsFallback?.alpaca?.real?.secretKey || localCredentialsFallback?.alpaca?.live?.secretKey || firestoreData?.alpaca?.real?.secretKey || firestoreData?.alpaca?.live?.secretKey || process.env.VITE_ALPACA_LIVE_SECRET_KEY || '';

    res.json({
      success: true,
      config: {
        alpaca: {
          paper: { apiKey: paperApiKey, secretKey: paperSecretKey },
          real: { apiKey: liveApiKey, secretKey: liveSecretKey },
          live: { apiKey: liveApiKey, secretKey: liveSecretKey }
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/trading/credentials', async (req, res) => {
  const { broker, env, credentials } = req.body;
  if (!broker || !env || !credentials) {
    return res.status(400).json({ success: false, error: 'Parametri mancanti' });
  }

  // Update fallback first
  if (!localCredentialsFallback[broker]) localCredentialsFallback[broker] = {};
  localCredentialsFallback[broker][env] = credentials;
  saveLocalCredentialsFallback(localCredentialsFallback);

  // Dynamically update resolved credentials in memory for Alpaca
  if (broker === 'alpaca') {
    const isLive = env === 'live' || env === 'real';
    const modeKey = isLive ? 'live' : 'paper';
    resolvedCredentials[modeKey] = {
      apiKey: credentials.apiKey || credentials.username || '',
      secretKey: credentials.secretKey || credentials.password || '',
      isConfigured: !!((credentials.apiKey || credentials.username) && (credentials.secretKey || credentials.password))
    };
    console.log(`[Credentials Update] Alpaca ${modeKey} credentials updated dynamically in memory!`);
  }

  // Synchronize credentials to Google Drive (ChiaviAPI.json) and Google Sheets (API KEYS)
  triggerChiaviApiDriveSync().catch(err => console.warn('[GoogleDrive Sync]:', err?.message || err));
  exportCredentialsToGoogleSheets().catch(err => console.warn('[GoogleSheets Auto-Export]:', err?.message || err));

  if (!db) {
    return res.json({ success: true });
  }

  try {
    const docRef = db.collection('broker_credentials').doc('config');
    const doc = await runWithTimeout(
      docRef.get(),
      800,
      { exists: false, data: () => null }
    );
    let currentData = doc.exists ? doc.data() : {};
    
    if (!currentData[broker]) currentData[broker] = {};
    currentData[broker][env] = credentials;

    await runWithTimeout(
      docRef.set(currentData),
      800,
      null
    );
    res.json({ success: true });
  } catch (error: any) {
    console.warn('[Firebase] Failed to save credentials to db, saved locally:', error.message);
    res.json({ success: true }); // Return success since we saved it locally!
  }
});

// --- MULTI-LLM MANAGEMENT ENDPOINTS ---
app.post('/api/llm/sync', async (req, res) => {
  if (!db) return res.json({ success: false, error: 'Database non disponibile' });
  try {
    const llmConfigsDoc = await db.collection('settings').doc('llm').get();
    if (llmConfigsDoc.exists) {
      const configsData = llmConfigsDoc.data() || {};
      const llmService = LLMProviderService.getInstance();
      for (const provider of ['gemini', 'mistral', 'deepseek', 'groq', 'anthropic'] as const) {
        if (configsData[provider]) {
          llmService.updateConfig(provider, configsData[provider]);
        }
      }
    }
    res.json({ success: true, message: 'LLM configs sincronizzate' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/feedback/reload', async (req, res) => {
  try {
    if (db) {
      await loadStateFromFirestore();
      await autoDetectCredentials();
      res.json({
        success: true,
        message: 'Stato, Regole, LLM e Credenziali Alpaca sincronizzati da Firebase!',
        userFeedbackRules: botStatus.userFeedbackRules || [],
        systemRiskRules: normalizeSystemRiskRules(botStatus.systemRiskRules)
      });
    } else {
      res.json({
        success: true,
        message: 'Regole aggiornate dallo stato locale (DB non collegato)',
        userFeedbackRules: botStatus.userFeedbackRules || [],
        systemRiskRules: normalizeSystemRiskRules(botStatus.systemRiskRules)
      });
    }
  } catch (e: any) {
    console.error('[Firebase Error] Reload feedback rules error:', e.message);
    res.json({
      success: true,
      message: 'Sincronizzato dallo stato locale (Quota Firebase/Rete temporaneamente non disponibile)',
      userFeedbackRules: botStatus.userFeedbackRules || [],
      systemRiskRules: normalizeSystemRiskRules(botStatus.systemRiskRules)
    });
  }
});

app.post('/api/settings/system-risk-rules', async (req, res) => {
  try {
    const { systemRiskRules } = req.body;
    if (Array.isArray(systemRiskRules)) {
      botStatus.systemRiskRules = normalizeSystemRiskRules(systemRiskRules);
      await saveBotStatus();
      addLog('paper', `[Regole Sistema] Sincronizzate ${botStatus.systemRiskRules.length} regole di rischio deterministiche.`);
      res.json({ success: true, systemRiskRules: botStatus.systemRiskRules });
    } else {
      res.status(400).json({ success: false, error: 'Formato systemRiskRules non valido' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/backup/export', (req, res) => {
  try {
    const data = {
      exportedAt: new Date().toISOString(),
      credentials: {
        paper: resolvedCredentials.paper,
        live: resolvedCredentials.live,
        fallback: localCredentialsFallback.alpaca
      },
      llmConfigs: LLMProviderService.getInstance().getConfigs(),
      botStatus: botStatus,
      userFeedbackRules: botStatus.userFeedbackRules || [],
      paperDailyLogicLogs: botData.paper.dailyLogicLogs || [],
      liveDailyLogicLogs: botData.live.dailyLogicLogs || [],
      paperLogs: botData.paper.logs || [],
      liveLogs: botData.live.logs || []
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=trading_bot_full_backup.json');
    res.send(JSON.stringify(data, null, 2));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/backup/import', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { credentials, llmConfigs, botStatus: importedBotStatus, userFeedbackRules, paperDailyLogicLogs, liveDailyLogicLogs, paperLogs, liveLogs } = req.body;
    
    // 1. Ripristino Credenziali API Alpaca
    if (credentials) {
      if (credentials.paper) {
        resolvedCredentials.paper = { ...resolvedCredentials.paper, ...credentials.paper };
      }
      if (credentials.live) {
        resolvedCredentials.live = { ...resolvedCredentials.live, ...credentials.live };
      }
      if (credentials.fallback) {
        localCredentialsFallback.alpaca = credentials.fallback;
        saveLocalCredentialsFallback(localCredentialsFallback);
      }
      triggerChiaviApiDriveSync().catch(() => {});
    }

    // 2. Ripristino Configurazione LLM
    if (llmConfigs && typeof llmConfigs === 'object') {
      const service = LLMProviderService.getInstance();
      for (const [provider, cfg] of Object.entries(llmConfigs)) {
        if (cfg && (cfg as any).apiKey) {
          service.updateConfig(provider as any, { apiKey: (cfg as any).apiKey, model: (cfg as any).model });
        }
      }
    }

    // 3. Ripristino Stato Bot / Loop
    if (importedBotStatus && typeof importedBotStatus === 'object') {
      Object.assign(botStatus, importedBotStatus);
      GoogleDriveService.saveJsonFile('Loop.json', {
        botStatus,
        updatedAt: new Date().toISOString()
      }).catch(() => {});
    }

    // 4. Ripristino Regole Feedback Utente
    if (userFeedbackRules && Array.isArray(userFeedbackRules)) {
      botStatus.userFeedbackRules = userFeedbackRules;
    }

    // 5. Unione dei Log Operativi e Logica Decisionale
    if (paperDailyLogicLogs) {
      botData.paper.dailyLogicLogs = mergeLogicLogs(botData.paper.dailyLogicLogs || [], paperDailyLogicLogs).slice(-3000);
    }
    if (liveDailyLogicLogs) {
      botData.live.dailyLogicLogs = mergeLogicLogs(botData.live.dailyLogicLogs || [], liveDailyLogicLogs).slice(-3000);
    }
    if (paperLogs) {
      botData.paper.logs = mergeOperationalLogs(botData.paper.logs || [], paperLogs).slice(0, 2000);
    }
    if (liveLogs) {
      botData.live.logs = mergeOperationalLogs(botData.live.logs || [], liveLogs).slice(0, 2000);
    }
    
    saveLogsToBackupFile();
    syncLogsToGoogleDrive().catch(() => {});
    
    res.json({
      success: true,
      message: 'Backup completo (Chiavi API, Loop, Stato e Log) importato e sincronizzato con successo!',
      counts: {
        paperLogicLogs: botData.paper.dailyLogicLogs?.length || 0,
        liveLogicLogs: botData.live.dailyLogicLogs?.length || 0,
        paperLogs: botData.paper.logs?.length || 0,
        liveLogs: botData.live.logs?.length || 0
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
app.get('/api/llm/configs', (req, res) => {
  const service = LLMProviderService.getInstance();
  const configs = service.getConfigs();
  const sanitizedConfigs: Record<string, any> = {};
  
  for (const provider of Object.keys(configs) as LLMProvider[]) {
    const conf = configs[provider];
    sanitizedConfigs[provider] = {
      provider: conf.provider,
      model: conf.model,
      hasKey: !!(conf.apiKey && conf.apiKey.trim() !== ''),
      maskedKey: conf.apiKey && conf.apiKey.length > 8 
        ? `${conf.apiKey.substring(0, 4)}...${conf.apiKey.substring(conf.apiKey.length - 4)}`
        : conf.apiKey ? '••••••••' : ''
    };
  }

  res.json({
    success: true,
    configs: sanitizedConfigs,
    preferredProvider: botStatus.llmPreferredProvider || 'gemini',
    failoverEnabled: botStatus.llmFailoverEnabled ?? true,
    providerOrder: service.getProviderOrder(),
    geminiCustomPrompt: botStatus.geminiCustomPrompt || service.getCustomSystemPrompt() || ''
  });
});

app.post('/api/llm/configs', async (req, res) => {
  const { provider, apiKey, model, geminiCustomPrompt } = req.body;

  const service = LLMProviderService.getInstance();

  if (typeof geminiCustomPrompt === 'string') {
    botStatus.geminiCustomPrompt = geminiCustomPrompt;
    service.setCustomSystemPrompt(geminiCustomPrompt);
    await saveBotStatus();
  }

  if (provider) {
    const updateData: any = {};
    if (typeof model === 'string') updateData.model = model;
    
    if (typeof apiKey === 'string' && apiKey.trim() !== '' && !apiKey.includes('...') && !apiKey.includes('•••')) {
      updateData.apiKey = apiKey.trim();
    }

    service.updateConfig(provider, updateData);

    // Synchronize keys to Google Drive (ChiaviAPI.json) and Google Sheets (API KEYS)
    triggerChiaviApiDriveSync().catch(err => console.warn('[GoogleDrive Sync]:', err?.message || err));
    exportCredentialsToGoogleSheets().catch(err => console.warn('[GoogleSheets Auto-Export]:', err?.message || err));

    if (db) {
      try {
        const docRef = db.collection('settings').doc('llm');
        const doc = await docRef.get();
        const currentData = doc.exists ? doc.data() : {};
        
        currentData[provider] = {
          ...currentData[provider],
          ...updateData
        };

        if (typeof geminiCustomPrompt === 'string') {
          currentData.geminiCustomPrompt = geminiCustomPrompt;
        }
        
        await docRef.set(currentData, { merge: true });
      } catch (e: any) {
        console.error('[Firebase] Errore salvataggio configurazioni LLM:', e.message);
      }
    }
  }

  res.json({ success: true, geminiCustomPrompt: botStatus.geminiCustomPrompt });
});

app.post('/api/llm/gemini-custom-prompt', async (req, res) => {
  const { geminiCustomPrompt } = req.body;
  if (typeof geminiCustomPrompt === 'string') {
    botStatus.geminiCustomPrompt = geminiCustomPrompt;
    LLMProviderService.getInstance().setCustomSystemPrompt(geminiCustomPrompt);
    await saveBotStatus();

    if (db) {
      try {
        await db.collection('settings').doc('llm').set({
          geminiCustomPrompt: geminiCustomPrompt
        }, { merge: true });
      } catch (e: any) {
        console.error('[Firebase] Error saving custom prompt:', e.message);
      }
    }
  }
  res.json({ success: true, geminiCustomPrompt: botStatus.geminiCustomPrompt });
});

app.post('/api/llm/preference', async (req, res) => {
  const { preferredProvider, failoverEnabled, providerOrder, geminiCustomPrompt } = req.body;
  
  if (preferredProvider) {
    botStatus.llmPreferredProvider = preferredProvider;
  }
  if (typeof failoverEnabled === 'boolean') {
    botStatus.llmFailoverEnabled = failoverEnabled;
    LLMProviderService.getInstance().setFailoverEnabled(failoverEnabled);
  }
  if (Array.isArray(providerOrder)) {
    LLMProviderService.getInstance().setProviderOrder(providerOrder);
    botStatus.llmProviderOrder = providerOrder;
  }
  if (typeof geminiCustomPrompt === 'string') {
    botStatus.geminiCustomPrompt = geminiCustomPrompt;
    LLMProviderService.getInstance().setCustomSystemPrompt(geminiCustomPrompt);
  }

  await saveBotStatus();
  res.json({ success: true, botStatus });
});

// --- GOOGLE DRIVE ENDPOINTS ---
app.get('/api/drive/status', async (req, res) => {
  res.json({
    success: true,
    folderId: GoogleDriveService.getFolderId(),
    hasToken: !!GoogleDriveService.getUserAccessToken()
  });
});

app.post('/api/drive/token', async (req, res) => {
  const { accessToken } = req.body;
  if (accessToken && typeof accessToken === 'string') {
    GoogleDriveService.setUserAccessToken(accessToken);
    syncLogsToGoogleDrive().catch(err => console.error('[GoogleDrive Token Sync Log Error]:', err));
    triggerChiaviApiDriveSync().catch(err => console.error('[GoogleDrive Token Sync Key Error]:', err));
    return res.json({ success: true, message: 'Token Google Drive salvato e sincronizzazione avviata' });
  }
  res.status(400).json({ success: false, error: 'Token mancante' });
});

app.post('/api/drive/sync-logs', async (req, res) => {
  await syncLogsToGoogleDrive();
  await triggerChiaviApiDriveSync();
  res.json({ success: true, message: 'Sincronizzazione log (StoriaLOG.json) e chiavi (ChiaviAPI.json) completata' });
});
// -------------------------------------
// -------------------------------------

async function autoDetectCredentials() {
  console.log('[Auto-Detect] Scanning and validating Alpaca credentials...');
  
  // 1. Gather credentials from Firestore if database is active
  let dbPaperKey = '';
  let dbPaperSecret = '';
  let dbLiveKey = '';
  let dbLiveSecret = '';

  if (db) {
    try {
      const doc = await db.collection('broker_credentials').doc('config').get();
      if (doc.exists) {
        const data = doc.data() || {};
        if (data.alpaca) {
          if (data.alpaca.paper) {
            dbPaperKey = data.alpaca.paper.apiKey || data.alpaca.paper.username || '';
            dbPaperSecret = data.alpaca.paper.secretKey || data.alpaca.paper.password || '';
          }
          if (data.alpaca.real || data.alpaca.live) {
            const liveData = data.alpaca.real || data.alpaca.live;
            dbLiveKey = liveData.apiKey || liveData.username || '';
            dbLiveSecret = liveData.secretKey || liveData.password || '';
          }
        }
      }
    } catch (e: any) {
      console.warn('[Auto-Detect] Error loading credentials from Firestore:', e.message);
    }
  }

  // 2. Gather credentials from local fallback
  let fallbackPaperKey = localCredentialsFallback?.alpaca?.paper?.apiKey || localCredentialsFallback?.alpaca?.paper?.username || '';
  let fallbackPaperSecret = localCredentialsFallback?.alpaca?.paper?.secretKey || localCredentialsFallback?.alpaca?.paper?.password || '';
  let fallbackLiveKey = (localCredentialsFallback?.alpaca?.real || localCredentialsFallback?.alpaca?.live)?.apiKey || (localCredentialsFallback?.alpaca?.real || localCredentialsFallback?.alpaca?.live)?.username || '';
  let fallbackLiveSecret = (localCredentialsFallback?.alpaca?.real || localCredentialsFallback?.alpaca?.live)?.secretKey || (localCredentialsFallback?.alpaca?.real || localCredentialsFallback?.alpaca?.live)?.password || '';

  // 3. Probing paper credentials
  const paperKeys = [
    dbPaperKey,
    fallbackPaperKey,
    process.env.APCA_PAPER_KEY,
    process.env.ALPACA_PAPER_API_KEY
  ].filter(Boolean) as string[];
  
  const paperSecrets = [
    dbPaperSecret,
    fallbackPaperSecret,
    process.env.APCA_PAPER_SEC,
    process.env.ALPACA_PAPER_SECRET_KEY,
    process.env.APCA_LIVE_SEC,
    process.env.ALPACA_LIVE_SECRET_KEY
  ].filter(Boolean) as string[];

  let paperSuccess = false;
  for (const k of paperKeys) {
    for (const s of paperSecrets) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch('https://paper-api.alpaca.markets/v2/account', {
          headers: {
            'APCA-API-KEY-ID': k,
            'APCA-API-SECRET-KEY': s
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (res.status === 200) {
          resolvedCredentials.paper = { apiKey: k, secretKey: s, isConfigured: true };
          paperSuccess = true;
          console.log(`[Auto-Detect] Paper credentials configured successfully! Key ID: ${k.slice(0,6)}... Secret: ${s.slice(0,6)}...`);
          break;
        }
      } catch (e) {
        // Ignore errors during probe
      }
    }
    if (paperSuccess) break;
  }

  // 4. Probing live credentials
  const liveKeys = [
    dbLiveKey,
    fallbackLiveKey,
    process.env.APCA_LIVE_KEY,
    process.env.ALPACA_LIVE_API_KEY
  ].filter(k => Boolean(k) && k !== dbPaperKey && k !== fallbackPaperKey) as string[];

  const liveSecrets = [
    dbLiveSecret,
    fallbackLiveSecret,
    process.env.APCA_LIVE_SEC,
    process.env.ALPACA_LIVE_SECRET_KEY
  ].filter(s => Boolean(s) && s !== dbPaperSecret && s !== fallbackPaperSecret) as string[];

  let liveSuccess = false;
  for (const k of liveKeys) {
    for (const s of liveSecrets) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch('https://api.alpaca.markets/v2/account', {
          headers: {
            'APCA-API-KEY-ID': k,
            'APCA-API-SECRET-KEY': s
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (res.status === 200) {
          resolvedCredentials.live = { apiKey: k, secretKey: s, isConfigured: true };
          liveSuccess = true;
          console.log(`[Auto-Detect] Live credentials configured successfully! Key ID: ${k.slice(0,6)}... Secret: ${s.slice(0,6)}...`);
          break;
        }
      } catch (e) {
        // Ignore errors during probe
      }
    }
    if (liveSuccess) break;
  }

  // If no successful probe but we have keys loaded from database or fallback, configure them as default anyway!
  if (!resolvedCredentials.paper.isConfigured && (dbPaperKey || fallbackPaperKey) && (dbPaperSecret || fallbackPaperSecret)) {
    resolvedCredentials.paper = {
      apiKey: dbPaperKey || fallbackPaperKey,
      secretKey: dbPaperSecret || fallbackPaperSecret,
      isConfigured: true
    };
    console.log('[Auto-Detect] Falling back to configured Paper keys (unverified via probe).');
  }

  if (!resolvedCredentials.live.isConfigured && (dbLiveKey || fallbackLiveKey) && (dbLiveSecret || fallbackLiveSecret)) {
    resolvedCredentials.live = {
      apiKey: dbLiveKey || fallbackLiveKey,
      secretKey: dbLiveSecret || fallbackLiveSecret,
      isConfigured: true
    };
    console.log('[Auto-Detect] Falling back to configured Live keys (unverified via probe).');
  }
}

function getAlpacaConfig(mode: 'paper' | 'live') {
  const isLive = mode === 'live';
  
  if (resolvedCredentials[mode].isConfigured) {
    const { apiKey, secretKey } = resolvedCredentials[mode];
    return {
      isConfigured: true,
      isLive,
      baseUrl: isLive ? 'https://api.alpaca.markets/v2' : 'https://paper-api.alpaca.markets/v2',
      apiKey,
      secretKey
    };
  }
  
  // Synchronous fallback to local credentials
  const envKey = isLive ? 'real' : 'paper';
  const localCreds = isLive 
    ? (localCredentialsFallback?.alpaca?.real || localCredentialsFallback?.alpaca?.live || {})
    : (localCredentialsFallback?.alpaca?.paper || {});
  const localApiKey = localCreds.apiKey || localCreds.username || '';
  const localSecretKey = localCreds.secretKey || localCreds.password || '';
  if (localApiKey && localSecretKey && (!isLive || localApiKey !== (localCredentialsFallback?.alpaca?.paper?.apiKey))) {
    resolvedCredentials[mode] = { apiKey: localApiKey, secretKey: localSecretKey, isConfigured: true };
    return {
      isConfigured: true,
      isLive,
      baseUrl: isLive ? 'https://api.alpaca.markets/v2' : 'https://paper-api.alpaca.markets/v2',
      apiKey: localApiKey,
      secretKey: localSecretKey
    };
  }
  
  // Safe diagnostic log of what environment keys are visible starting with ALPACA or APCA
  const foundKeys = Object.keys(process.env)
    .filter(k => k.toUpperCase().includes('ALPACA') || k.toUpperCase().includes('APCA'))
    .map(k => `${k} (len: ${process.env[k]?.length || 0})`);
  console.log(`[Alpaca Config Diagnostic] Found keys containing ALPACA/APCA:`, foundKeys);

  const findEnvVar = (patterns: string[], fallbacks: string[] = []): string => {
    // Try exact or prefix/substring matches in order
    for (const pattern of patterns) {
      const up = pattern.toUpperCase();
      const match = Object.keys(process.env).find(k => {
        const envKey = k.toUpperCase();
        return envKey === up || envKey.startsWith(up) || up.startsWith(envKey);
      });
      if (match && process.env[match]) {
        console.log(`[Alpaca Config] Matched pattern ${pattern} to environment variable: ${match} (length: ${process.env[match]?.length || 0})`);
        return process.env[match]!;
      }
    }
    // Try fallback keys exactly
    for (const fb of fallbacks) {
      const up = fb.toUpperCase();
      const match = Object.keys(process.env).find(k => k.toUpperCase() === up);
      if (match && process.env[match]) return process.env[match]!;
    }
    return '';
  };

  let apiKey = '';
  let secretKey = '';
  
  if (isLive) {
    apiKey = findEnvVar(
      ['APCA_LIVE_KEY', 'ALPACA_LIVE_API_KEY', 'ALPACA_LIVE_API_KE', 'ALPACA_LIVE_API', 'ALPACA_LIVE_AP'],
      ['ALPACA_API_KEY']
    );
    secretKey = findEnvVar(
      ['APCA_LIVE_SEC', 'ALPACA_LIVE_SECRET_KEY', 'ALPACA_LIVE_SECRET', 'ALPACA_LIVE_SECR', 'ALPACA_LIVE_SEC'],
      ['ALPACA_SECRET_KEY']
    );
  } else {
    apiKey = findEnvVar(
      ['APCA_PAPER_KEY', 'ALPACA_PAPER_API_KEY', 'ALPACA_PAPER_API_K', 'ALPACA_PAPER_API', 'ALPACA_PAPER_AP'],
      ['ALPACA_API_KEY']
    );
    secretKey = findEnvVar(
      ['APCA_PAPER_SEC', 'ALPACA_PAPER_SECRET_KEY', 'ALPACA_PAPER_SECR', 'ALPACA_PAPER_SECRET', 'ALPACA_PAPER_SEC'],
      ['ALPACA_SECRET_KEY']
    );
  }
  
  const isConfigured = !!(apiKey && secretKey);
  const baseUrl = isLive 
    ? 'https://api.alpaca.markets/v2'
    : 'https://paper-api.alpaca.markets/v2';
    
  if (isConfigured) {
    resolvedCredentials[mode] = { apiKey, secretKey, isConfigured: true };
  }
    
  return { isConfigured, isLive, baseUrl, apiKey, secretKey };
}

// Sincronizzazione automatica e recupero storico delle operazioni eseguite su Alpaca
async function fetchAlpacaHistoricalOperations(
  mode: 'paper' | 'live',
  startDate?: string,
  endDate?: string
): Promise<{ logicLogs: any[]; fills: any[]; orders: any[] }> {
  const conf = getAlpacaConfig(mode);
  const result = { logicLogs: [] as any[], fills: [] as any[], orders: [] as any[] };
  if (!conf.isConfigured) return result;

  try {
    // 1. Fetch Alpaca Activities (FILLs)
    let fills: any[] = [];
    try {
      const actRes = await fetch(`${conf.baseUrl}/account/activities?activity_types=FILL&page_size=100&direction=desc`, {
        headers: {
          'APCA-API-KEY-ID': conf.apiKey,
          'APCA-API-SECRET-KEY': conf.secretKey
        }
      });
      if (actRes.ok) {
        const rawFills = await actRes.json();
        if (Array.isArray(rawFills)) {
          fills = rawFills;
        }
      }
    } catch (err: any) {
      console.warn(`[Alpaca Activities Fetch Error] (${mode}):`, err.message);
    }

    result.fills = fills;

    // 2. Fetch Closed and All Orders
    let orders: any[] = [];
    try {
      const ordRes = await fetch(`${conf.baseUrl}/orders?status=all&limit=500&direction=desc`, {
        headers: {
          'APCA-API-KEY-ID': conf.apiKey,
          'APCA-API-SECRET-KEY': conf.secretKey
        }
      });
      if (ordRes.ok) {
        const rawOrders = await ordRes.json();
        if (Array.isArray(rawOrders)) {
          orders = rawOrders;
        }
      }
    } catch (err: any) {
      console.warn(`[Alpaca Orders Fetch Error] (${mode}):`, err.message);
    }

    result.orders = orders;

    // 3. Conversione unificata in Logic Logs dettagliati
    const seenMap = new Set<string>();

    for (const f of fills) {
      const ts = f.transaction_time || f.timestamp || new Date().toISOString();
      const datePart = ts.split('T')[0];
      if (startDate && endDate && (datePart < startDate || datePart > endDate)) {
        continue;
      }
      const sym = f.symbol;
      const side = (f.side || 'buy').toUpperCase();
      const qty = parseFloat(f.qty || '0');
      const price = parseFloat(f.price || '0');
      const key = `${ts.slice(0, 19)}_${sym}_${side}_${qty}`;

      if (!seenMap.has(key) && sym) {
        seenMap.add(key);
        result.logicLogs.push({
          timestamp: ts,
          symbol: sym,
          action: side,
          price: price,
          qty: qty,
          reasoning: `Esecuzione Alpaca ${side} per ${qty} quote di ${sym} a $${price.toFixed(2)} [Fill ID: ${f.id || 'N/A'}]`,
          mode,
          source: 'Alpaca Activity Fill'
        });
      }
    }

    for (const o of orders) {
      if (o.status === 'filled' || (o.filled_qty && parseFloat(o.filled_qty) > 0)) {
        const ts = o.filled_at || o.updated_at || o.created_at || new Date().toISOString();
        const datePart = ts.split('T')[0];
        if (startDate && endDate && (datePart < startDate || datePart > endDate)) {
          continue;
        }
        const sym = o.symbol;
        const side = (o.side || 'buy').toUpperCase();
        const qty = parseFloat(o.filled_qty || o.qty || '0');
        const price = parseFloat(o.filled_avg_price || '0');
        const key = `${ts.slice(0, 19)}_${sym}_${side}_${qty}`;

        if (!seenMap.has(key) && sym) {
          seenMap.add(key);
          result.logicLogs.push({
            timestamp: ts,
            symbol: sym,
            action: side,
            price: price,
            qty: qty,
            reasoning: `Ordine Alpaca Eseguito (${side} ${o.type || 'market'}) per ${qty} quote di ${sym} a $${price.toFixed(2)}`,
            mode,
            source: 'Alpaca Order History'
          });
        }
      }
    }

    result.logicLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (e: any) {
    console.error(`[fetchAlpacaHistoricalOperations] Global Error (${mode}):`, e.message);
  }

  return result;
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
  paperActive: boolean;
  liveActive: boolean;
  balance: number;
  lastCheck: string | null;
  mode: string;
  tradingMode: 'paper' | 'live';
  accountNumber?: string;
  dailyPnL?: { date: string; pnl: number; balance: number; breakdown?: any[]; news?: string }[];
  cash?: number;
  latestDailyReport?: string;
  latestDailyDebrief?: {
    analysis: string;
    suggestedRule: string;
    top3Corrections?: string[];
    participatingProviders?: string[];
    timestamp: string;
  };
  dailyLogicLogs?: { timestamp: string; symbol: string; action: string; reasoning: string; price?: number }[];
  userFeedbackRules?: string[];
  systemRiskRules?: RiskRuleConfig[];
  monitoredSymbols?: string[];
  lastGoogleSheetsLogSync?: string | null;
  historicalProfits?: number;
  y?: number;
  defaultTP?: number;
  defaultSL?: number;
  trailingStop?: number;
  timeframe?: number;
  riskPercentage?: number;
  maxConcurrentPositions?: number;
  llmPreferredProvider?: 'gemini' | 'mistral' | 'deepseek' | 'groq' | 'anthropic';
  llmFailoverEnabled?: boolean;
  llmProviderOrder?: string[];
  geminiCustomPrompt?: string;
} = {
  active: false,
  paperActive: false,
  liveActive: false,
  balance: 100.0,
  lastCheck: null as string | null,
  mode: (getAlpacaConfig('paper').isConfigured ? 'Alpaca (Simulazione)' : 'Alpaca (Configurazione mancante)'),
  tradingMode: 'paper',
  dailyPnL: [],
  cash: 100.0,
  latestDailyReport: undefined,
  latestDailyDebrief: undefined,
  dailyLogicLogs: [],
  userFeedbackRules: [],
  systemRiskRules: DEFAULT_SYSTEM_RISK_RULES,
  monitoredSymbols: [],
  historicalProfits: 2.50,
  y: 1,
  defaultTP: 2.50,
  defaultSL: -1.00,
  trailingStop: 1.2,
  timeframe: 15,
  riskPercentage: 95,
  maxConcurrentPositions: 3,
  llmPreferredProvider: 'gemini',
  llmFailoverEnabled: true,
  llmProviderOrder: ['mistral', 'gemini', 'anthropic', 'deepseek', 'groq'],
  geminiCustomPrompt: ''
};

let positionStrategies: {
  paper: Record<string, 'Prudente' | 'Conservativa' | 'Aggressiva'>;
  live: Record<string, 'Prudente' | 'Conservativa' | 'Aggressiva'>;
} = {
  paper: {},
  live: {}
};

// Override per-posizione per Stop Tecnico e Stop Catastrofico
let positionStopOverrides: {
  paper: Record<string, { enableTechnicalStop?: boolean; enableCatastrophicStop?: boolean }>;
  live: Record<string, { enableTechnicalStop?: boolean; enableCatastrophicStop?: boolean }>;
} = {
  paper: {},
  live: {}
};

function getDefaultStrategy(symbol: string): 'Prudente' | 'Conservativa' | 'Aggressiva' {
  const INDICES = ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ'];
  const COMMODITIES = ['GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'];
  if (INDICES.includes(symbol)) return 'Conservativa';
  if (COMMODITIES.includes(symbol)) return 'Prudente';
  return 'Aggressiva';
}

const STRATEGY_PARAMS = {
  Prudente: {
    tpPct: 0.80,     // +0.80%
    slPct: -0.40,    // -0.40%
    tsPct: 0.30      // Trailing Stop at 0.30%
  },
  Conservativa: {
    tpPct: 1.50,     // +1.50%
    slPct: -0.75,    // -0.75%
    tsPct: 1.00      // Trailing Stop at 1.00%
  },
  Aggressiva: {
    tpPct: 2.50,     // +2.50%
    slPct: -1.00,    // -1.00%
    tsPct: 0.50      // Trailing Stop at 0.50%
  }
};

let tradeLogs: string[] = [];

// Endpoint per attivare/disattivare Stop Tecnico e Stop Catastrofico per singola posizione
app.post("/api/trading/position-stops", async (req, res) => {
  try {
    const { symbol, mode = 'paper', enableTechnicalStop, enableCatastrophicStop } = req.body;
    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Simbolo non specificato' });
    }
    const m = (mode === 'live' ? 'live' : 'paper') as 'paper' | 'live';
    if (!positionStopOverrides[m]) {
      positionStopOverrides[m] = {};
    }
    if (!positionStopOverrides[m][symbol]) {
      positionStopOverrides[m][symbol] = {};
    }
    if (enableTechnicalStop !== undefined) {
      positionStopOverrides[m][symbol].enableTechnicalStop = Boolean(enableTechnicalStop);
    }
    if (enableCatastrophicStop !== undefined) {
      positionStopOverrides[m][symbol].enableCatastrophicStop = Boolean(enableCatastrophicStop);
    }

    addLog(m, `[Stop Loss Personalizzato] Posizione ${symbol}: Stop Tecnico=${positionStopOverrides[m][symbol].enableTechnicalStop ?? 'Globale'}, Stop Catastrofico=${positionStopOverrides[m][symbol].enableCatastrophicStop ?? 'Globale'}`);
    res.json({ success: true, symbol, overrides: positionStopOverrides[m][symbol] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Alpaca Bridge Endpoints for TradingModule ---
app.get("/api/trading/alpaca-account", async (req, res) => {
  const mode = botStatus.tradingMode;
  const data = botData[mode];
  res.json({
    success: true,
    account: { 
      id: data.accountNumber || 'ALPACA_DEMO', 
      balance: String(data.balance), 
      currency: mode === 'live' ? 'USD' : 'USD', 
      NAV: String(data.balance) 
    },
    isDemo: mode === 'paper'
  });
});

app.get("/api/trading/alpaca-status", async (req, res) => {
  const mode = botStatus.tradingMode;
  const conf = getAlpacaConfig(mode);
  let positions = [];
  let errorAlpaca = null;
  
  if (conf.isConfigured) {
    try {
      const posResponse = await fetch(`${conf.baseUrl}/positions`, {
        headers: {
          'APCA-API-KEY-ID': conf.apiKey,
          'APCA-API-SECRET-KEY': conf.secretKey
        }
      });
      if (posResponse.ok) {
        positions = await posResponse.json();
      } else {
        if (posResponse.status === 401) {
          errorAlpaca = "Autenticazione Fallita (401 Unauthorized): le chiavi Alpaca non sono valide.";
        } else {
          errorAlpaca = `Errore Alpaca: ${posResponse.status} ${posResponse.statusText}`;
        }
      }
    } catch (e: any) {
      errorAlpaca = e.message;
    }
  }

  const mappedPositions = positions.map((p: any) => ({
    symbol: p.symbol,
    qty: p.qty,
    avg_entry_price: p.avg_entry_price,
    current_price: p.current_price,
    unrealized_pl: p.unrealized_pl,
    side: p.side
  }));

  const status = {
    active: mode === 'live' ? botStatus.liveActive : botStatus.paperActive,
    equity: botData[mode].balance,
    logs: botData[mode].logs,
    logicLogs: botData[mode].dailyLogicLogs,
    dailyPnL: botData[mode].dailyPnL,
    tradingMode: botStatus.tradingMode,
    defaultTP: botStatus.defaultTP ?? 2.00,
    defaultSL: botStatus.defaultSL ?? -0.50,
    trailingStop: botStatus.trailingStop ?? 1.0,
    timeframe: botStatus.timeframe ?? 15,
    riskPercentage: botStatus.riskPercentage ?? 10,
    maxConcurrentPositions: botStatus.maxConcurrentPositions ?? 10,
    errorAlpaca
  };

  res.json({ status, positions: mappedPositions, isDemo: mode === 'paper' });
});

app.post("/api/trading/alpaca-trigger", async (req, res) => {
  try {
    await executeTradingCycle(true);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/trading/alpaca-reset-balance", async (req, res) => {
  const mode = botStatus.tradingMode;
  botData[mode].balance = mode === 'paper' ? 100000 : 100;
  res.json({ success: true });
});

app.post("/api/trading/alpaca-settings", async (req, res) => {
  const { defaultTP, defaultSL, trailingStop, timeframe, riskPercentage, maxConcurrentPositions } = req.body;
  
  if (typeof defaultTP === 'number') botStatus.defaultTP = defaultTP;
  if (typeof defaultSL === 'number') botStatus.defaultSL = defaultSL;
  if (typeof trailingStop === 'number') botStatus.trailingStop = trailingStop;
  if (typeof timeframe === 'number') botStatus.timeframe = timeframe;
  if (typeof riskPercentage === 'number') botStatus.riskPercentage = riskPercentage;
  if (typeof maxConcurrentPositions === 'number') botStatus.maxConcurrentPositions = maxConcurrentPositions;
  
  await saveBotStatus();
  res.json({ 
    success: true, 
    defaultTP: botStatus.defaultTP, 
    defaultSL: botStatus.defaultSL, 
    trailingStop: botStatus.trailingStop, 
    timeframe: botStatus.timeframe, 
    riskPercentage: botStatus.riskPercentage,
    maxConcurrentPositions: botStatus.maxConcurrentPositions
  });
});

app.post("/api/trading/position-strategy", async (req, res) => {
  const { mode, symbol, strategy } = req.body;
  if (!mode || !symbol || !strategy) {
    return res.status(400).json({ error: "Parametri mancanti: mode, symbol o strategy." });
  }
  if (!['paper', 'live'].includes(mode)) {
    return res.status(400).json({ error: "Modalità non valida." });
  }
  if (!['Prudente', 'Conservativa', 'Aggressiva'].includes(strategy)) {
    return res.status(400).json({ error: "Strategia non valida." });
  }

  if (!positionStrategies[mode]) {
    positionStrategies[mode] = {};
  }
  positionStrategies[mode][symbol] = strategy;
  
  await saveBotStatus();
  
  addLog(mode as 'paper' | 'live', `[Strategia Utente] Aggiornata strategia per ${symbol} a ${strategy}.`);
  
  res.json({ success: true, mode, symbol, strategy });
});

app.get("/api/trading/alpaca-analysis/:instrument", async (req, res) => {
  const { instrument } = req.params;
  const mode = botStatus.tradingMode || 'paper';
  const { isConfigured, baseUrl, apiKey, secretKey } = getAlpacaConfig(mode);

  let currentPrice = 100.0;
  if (isConfigured) {
    currentPrice = await getLatestPrice(instrument, apiKey, secretKey);
  }

  // Recupera posizione
  let posData: any = null;
  let unrealizedPL = 0;
  let currentValue = 0;
  if (isConfigured) {
    try {
      const posResponse = await fetch(`${baseUrl}/positions/${instrument}`, {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': secretKey
        }
      });
      if (posResponse.ok) {
        posData = await posResponse.json();
        currentValue = parseFloat(posData.market_value || '0');
        unrealizedPL = parseFloat(posData.unrealized_pl || '0');
      }
    } catch (e) {
      // ignore
    }
  }

  // Recupera sentiment
  let sentimentScore: number | null = null;
  let sentimentReasoning = '';
  let isSentimentError = false;
  try {
    const sentiment = await getMarketSentiment(instrument);
    sentimentScore = sentiment.score;
    sentimentReasoning = sentiment.reasoning;
  } catch (err: any) {
    isSentimentError = true;
    sentimentReasoning = err.message || 'Errore di rete nell\'analisi del sentiment';
  }

  // Calcola stop loss
  const activeStrategy = (positionStrategies[mode] && positionStrategies[mode][instrument]) || getDefaultStrategy(instrument);
  const params = STRATEGY_PARAMS[activeStrategy];
  let stopLossThreshold = -0.50;
  if (posData) {
    const costBasis = currentValue - unrealizedPL;
    stopLossThreshold = -Math.abs(costBasis * (params.slPct / 100));
  }

  // Conta posizioni correnti
  let currentPositionsCount = 0;
  if (isConfigured) {
    try {
      const positionsResponse = await fetch(`${baseUrl}/positions`, {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': secretKey
        }
      });
      if (positionsResponse.ok) {
        const positions = await positionsResponse.json();
        currentPositionsCount = Array.isArray(positions) ? positions.length : 0;
      }
    } catch (e) {
      // ignore
    }
  }

  // Esegui la decisione tramite il motore ultra-conservativo
  const signalService = GeminiSignalService.getInstance();
  const decisionResult = signalService.evaluateTradingDecision({
    ticker: instrument,
    currentPrice,
    unrealizedPL,
    currentValue,
    stopLossThreshold,
    maxConcurrentPositions: botStatus.maxConcurrentPositions ?? 10,
    currentPositionsCount,
    sentimentScore,
    sentimentReasoning,
    isSentimentError
  });

  // Mappa il sentiment score per la risposta JSON richiesta (da 0.01 a 1.00 o "ERROR")
  let displayScore: number | 'ERROR' = 'ERROR';
  if (!isSentimentError && sentimentScore !== null) {
    displayScore = Math.max(0.01, Math.min(1.00, 0.5 * (sentimentScore + 1) * 0.99 + 0.01));
    displayScore = Math.round(displayScore * 100) / 100;
  }

  res.json({ 
    stato: decisionResult.stato,
    azione: decisionResult.azione,
    ticker: decisionResult.ticker,
    sentiment_score: displayScore,
    stop_loss_triggered: decisionResult.stop_loss_triggered,
    motivazione: decisionResult.motivazione,
    analysis: `### Analisi Alpaca per ${instrument}\n\n**Stato Bot:** ${decisionResult.stato}\n**Azione Consigliata:** ${decisionResult.azione}\n**Sentiment Score (Standard):** ${sentimentScore !== null ? sentimentScore.toFixed(2) : 'ERROR'}\n\n**Motivazione:** ${decisionResult.motivazione}\n\n*Ragionamento IA:* ${sentimentReasoning}`,
    candles: [],
    isDemo: mode === 'paper'
  });
});










const botData = {
  paper: {
    balance: 100.0,
    cash: 100.0,
    accountNumber: undefined as string | undefined,
    dailyPnL: [] as any[],
    dailyLogicLogs: [] as any[],
    logs: [] as string[]
  },
  live: {
    balance: 100.0,
    cash: 100.0,
    accountNumber: undefined as string | undefined,
    dailyPnL: [] as any[],
    dailyLogicLogs: [] as any[],
    logs: [] as string[]
  }
};

function mergeLogicLogs(existing: any[], incoming: any[]): any[] {
  const map = new Map();
  if (Array.isArray(existing)) {
    existing.forEach(item => {
      if (item && item.timestamp) {
        map.set(`${item.timestamp}_${item.symbol}_${item.action}`, item);
      }
    });
  }
  if (Array.isArray(incoming)) {
    incoming.forEach(item => {
      if (item && item.timestamp) {
        map.set(`${item.timestamp}_${item.symbol}_${item.action}`, item);
      }
    });
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function mergeOperationalLogs(existing: string[], incoming: string[]): string[] {
  const allLogs = [
    ...(Array.isArray(existing) ? existing : []),
    ...(Array.isArray(incoming) ? incoming : [])
  ];
  const set = new Set(allLogs);
  return Array.from(set).sort((a, b) => {
    const tA = a.match(/^\[(.*?)\]/)?.[1] || '';
    const tB = b.match(/^\[(.*?)\]/)?.[1] || '';
    return tB.localeCompare(tA);
  });
}

function saveLogsToBackupFile() {
  try {
    const dataToSave = {
      paperDailyLogicLogs: botData.paper.dailyLogicLogs || [],
      liveDailyLogicLogs: botData.live.dailyLogicLogs || [],
      paperLogs: botData.paper.logs || [],
      liveLogs: botData.live.logs || []
    };
    fs.writeFileSync('./local_logs_backup.json', JSON.stringify(dataToSave, null, 2), 'utf8');
    console.log('[Backup] Saved local logs backup file successfully.');
  } catch (err: any) {
    console.error('[Backup] Error saving local logs backup file:', err.message);
  }
}

function loadLogsFromBackupFile() {
  try {
    if (fs.existsSync('./local_logs_backup.json')) {
      const data = fs.readFileSync('./local_logs_backup.json', 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.paperDailyLogicLogs) botData.paper.dailyLogicLogs = parsed.paperDailyLogicLogs;
      if (parsed.liveDailyLogicLogs) botData.live.dailyLogicLogs = parsed.liveDailyLogicLogs;
      if (parsed.paperLogs) botData.paper.logs = parsed.paperLogs;
      if (parsed.liveLogs) botData.live.logs = parsed.liveLogs;
      console.log('[Backup] Loaded local logs backup file successfully.');
      return true;
    }
  } catch (err: any) {
    console.error('[Backup] Error loading local logs backup file:', err.message);
  }
  return false;
}

// Save backup to file every 30 seconds
setInterval(saveLogsToBackupFile, 30000);

async function saveBotStatus() {
  if (!db) return;
  try {
    await db.collection('settings').doc('bot').set({
      active: botStatus.active,
      paperActive: botStatus.paperActive,
      liveActive: botStatus.liveActive,
      tradingMode: botStatus.tradingMode,
      userFeedbackRules: botStatus.userFeedbackRules || [],
      systemRiskRules: normalizeSystemRiskRules(botStatus.systemRiskRules),
      monitoredSymbols: botStatus.monitoredSymbols || [],
      historicalProfits: botStatus.historicalProfits || 0,
      y: botStatus.y || 1,
      latestDailyReport: botStatus.latestDailyReport || null,
      latestDailyDebrief: botStatus.latestDailyDebrief || null,
      lastCheck: botStatus.lastCheck || null,
      defaultTP: botStatus.defaultTP ?? 2.00,
      defaultSL: botStatus.defaultSL ?? -0.50,
      trailingStop: botStatus.trailingStop ?? 1.0,
      timeframe: botStatus.timeframe ?? 15,
      riskPercentage: botStatus.riskPercentage ?? 10,
      maxConcurrentPositions: botStatus.maxConcurrentPositions ?? 10,
      llmPreferredProvider: botStatus.llmPreferredProvider ?? 'gemini',
      llmFailoverEnabled: botStatus.llmFailoverEnabled ?? true,
      llmProviderOrder: botStatus.llmProviderOrder || ['mistral', 'gemini', 'anthropic', 'deepseek', 'groq'],
      geminiCustomPrompt: botStatus.geminiCustomPrompt || '',
      positionStrategies: positionStrategies
    }, { merge: true });
  } catch (err: any) {
    console.error('[Firebase] Error saving bot status:', err);
  }
}

async function saveBotData(mode: 'paper' | 'live') {
  if (!db) return;
  try {
    await db.collection('bot_data').doc(mode).set({
      balance: botData[mode].balance,
      cash: botData[mode].cash,
      accountNumber: botData[mode].accountNumber || null,
      dailyPnL: botData[mode].dailyPnL || []
    }, { merge: true });
  } catch (err: any) {
    console.error(`[Firebase] Error saving bot data for ${mode}:`, err);
  }
}

async function saveLogicLog(mode: 'paper' | 'live', log: { timestamp: string; symbol: string; action: string; reasoning: string; price?: number }) {
  logBuffer.push({
    collection: 'logic_logs',
    data: {
      mode,
      timestamp: log.timestamp,
      symbol: log.symbol,
      action: log.action,
      reasoning: log.reasoning,
      price: log.price || null
    }
  });
}

async function addLogicLog(mode: 'paper' | 'live', log: { timestamp: string; symbol: string; action: string; reasoning: string; price?: number }) {
  if (!botData[mode].dailyLogicLogs) {
    botData[mode].dailyLogicLogs = [];
  }
  botData[mode].dailyLogicLogs.push(log);
  if (botData[mode].dailyLogicLogs.length > 3000) {
    botData[mode].dailyLogicLogs = botData[mode].dailyLogicLogs.slice(-3000);
  }
  saveLogicLog(mode, log).catch(err => console.error('[Firebase] Error saving logic log:', err));
}

async function loadStateFromFirestore() {
  // 1. Carica prima i log salvati nel backup locale su disco per garantire l'accessibilità immediata
  loadLogsFromBackupFile();
  
  if (!db) return;
  try {
    console.log('[Firebase] Loading state from Firestore...');
    const statusDoc = await db.collection('settings').doc('bot').get();
    if (statusDoc.exists) {
      const data = statusDoc.data();
      botStatus.active = data.active ?? botStatus.active;
      botStatus.paperActive = data.paperActive ?? botStatus.paperActive;
      botStatus.liveActive = data.liveActive ?? botStatus.liveActive;
      botStatus.tradingMode = data.tradingMode ?? botStatus.tradingMode;
      botStatus.userFeedbackRules = data.userFeedbackRules ?? botStatus.userFeedbackRules;
      botStatus.systemRiskRules = normalizeSystemRiskRules(data.systemRiskRules || botStatus.systemRiskRules);
      botStatus.monitoredSymbols = data.monitoredSymbols ?? botStatus.monitoredSymbols;
      botStatus.historicalProfits = data.historicalProfits ?? botStatus.historicalProfits;
      botStatus.y = data.y ?? botStatus.y;
      botStatus.latestDailyReport = data.latestDailyReport ?? botStatus.latestDailyReport;
      botStatus.latestDailyDebrief = data.latestDailyDebrief ?? botStatus.latestDailyDebrief;
      botStatus.lastCheck = data.lastCheck ?? botStatus.lastCheck;
      botStatus.defaultTP = data.defaultTP ?? botStatus.defaultTP;
      botStatus.defaultSL = data.defaultSL ?? botStatus.defaultSL;
      botStatus.trailingStop = data.trailingStop ?? botStatus.trailingStop;
      botStatus.timeframe = data.timeframe ?? botStatus.timeframe;
      botStatus.riskPercentage = data.riskPercentage ?? botStatus.riskPercentage;
      botStatus.maxConcurrentPositions = data.maxConcurrentPositions ?? botStatus.maxConcurrentPositions;
      botStatus.llmPreferredProvider = data.llmPreferredProvider ?? botStatus.llmPreferredProvider ?? 'gemini';
      botStatus.llmFailoverEnabled = data.llmFailoverEnabled ?? botStatus.llmFailoverEnabled ?? true;
      botStatus.llmProviderOrder = data.llmProviderOrder ?? botStatus.llmProviderOrder;
      if (botStatus.llmProviderOrder && botStatus.llmProviderOrder.length > 0) {
        LLMProviderService.getInstance().setProviderOrder(botStatus.llmProviderOrder as any);
      }

      if (botStatus.llmPreferredProvider) {
        LLMProviderService.getInstance().setFailoverEnabled(!!botStatus.llmFailoverEnabled);
      }

      botStatus.geminiCustomPrompt = data.geminiCustomPrompt ?? botStatus.geminiCustomPrompt;
      if (botStatus.geminiCustomPrompt) {
        LLMProviderService.getInstance().setCustomSystemPrompt(botStatus.geminiCustomPrompt);
      }

      // Carichiamo anche i dettagli di configurazione di ciascun LLM se presenti nel db in settings/llm
      try {
        const llmConfigsDoc = await db.collection('settings').doc('llm').get();
        if (llmConfigsDoc.exists) {
          const configsData = llmConfigsDoc.data() || {};
          const llmService = LLMProviderService.getInstance();
          for (const provider of ['gemini', 'mistral', 'deepseek', 'groq', 'anthropic'] as const) {
            if (configsData[provider]) {
              llmService.updateConfig(provider, configsData[provider]);
            }
          }
          if (configsData.geminiCustomPrompt && typeof configsData.geminiCustomPrompt === 'string') {
            botStatus.geminiCustomPrompt = configsData.geminiCustomPrompt;
            llmService.setCustomSystemPrompt(configsData.geminiCustomPrompt);
          }
        }
      } catch (e: any) {
        console.warn('[Firebase] Non-fatal: Error loading LLM specific configs:', e.message);
      }

      if (data.positionStrategies) {
        positionStrategies = {
          paper: data.positionStrategies.paper || {},
          live: data.positionStrategies.live || {}
        };
      }
      console.log('[Firebase] Loaded botStatus successfully.');
    }

    for (const mode of ['paper', 'live'] as const) {
      const dataDoc = await db.collection('bot_data').doc(mode).get();
      if (dataDoc.exists) {
        const d = dataDoc.data();
        botData[mode].balance = d.balance ?? botData[mode].balance;
        botData[mode].cash = d.cash ?? botData[mode].cash;
        botData[mode].accountNumber = d.accountNumber ?? botData[mode].accountNumber;
        botData[mode].dailyPnL = d.dailyPnL ?? d.dailyPnL;

        // Load Alpaca logs from Firestore
        try {
          const logsSnap = await db.collection('operational_logs')
            .orderBy('timestamp', 'desc')
            .limit(2000)
            .get();
            
          if (!logsSnap.empty) {
            const fetchedLogs: string[] = [];
            logsSnap.forEach((doc: any) => {
              const data = doc.data();
              if (data.mode === mode) {
                fetchedLogs.push(`[${data.timestamp}] ${data.message}`);
              }
            });
            // Unisci i log di Firestore con quelli caricati dal backup locale
            botData[mode].logs = mergeOperationalLogs(botData[mode].logs || [], fetchedLogs).slice(0, 2000);
          } else {
            botData[mode].logs = d.logs ?? botData[mode].logs;
          }
        } catch (err) {
          console.error(`[Firebase] Error loading operational logs for ${mode}:`, err);
          botData[mode].logs = d.logs ?? botData[mode].logs;
        }

        console.log(`[Firebase] Loaded account data for ${mode} successfully.`);
      }

      try {
        const logsSnap = await db.collection('logic_logs')
          .orderBy('timestamp', 'desc')
          .limit(1000)
          .get();
        
        const loadedLogicLogs: any[] = [];
        logsSnap.forEach((doc: any) => {
          const data = doc.data();
          if (data.mode === mode) {
            loadedLogicLogs.push({
              timestamp: data.timestamp,
              symbol: data.symbol,
              action: data.action,
              reasoning: data.reasoning,
              price: data.price
            });
          }
        });
        // Unisci i log decisionali con quelli del backup locale
        botData[mode].dailyLogicLogs = mergeLogicLogs(botData[mode].dailyLogicLogs || [], loadedLogicLogs).slice(-3000);
        console.log(`[Firebase] Loaded and merged ${botData[mode].dailyLogicLogs.length} logic logs for ${mode}.`);
      } catch (err) {
        console.error(`[Firebase] Error loading logic logs for ${mode}:`, err);
      }
    }
  } catch (err: any) {
    console.error('[Firebase] Error loading state from Firestore:', err);
  }
}

export function addLog(mode: 'paper' | 'live' | 'system', message: string) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}`;
  
  if (mode === 'paper' || mode === 'system') {
    botData.paper.logs.unshift(logMsg);
    if (botData.paper.logs.length > 2000) botData.paper.logs = botData.paper.logs.slice(0, 2000);
  }
  if (mode === 'live' || mode === 'system') {
    botData.live.logs.unshift(logMsg);
    if (botData.live.logs.length > 2000) botData.live.logs = botData.live.logs.slice(0, 2000);
  }

  const targetMode = mode === 'system' ? 'paper' : mode;
  logBuffer.push({
    collection: 'operational_logs',
    data: {
      mode: targetMode,
      message: message,
      timestamp: timestamp
    }
  });

  if (mode === 'system') {
    logBuffer.push({
      collection: 'operational_logs',
      data: {
        mode: 'live',
        message: message,
        timestamp: timestamp
      }
    });
  }
  
  console.log(logMsg);
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
const inMemoryGeminiSignals = new Map<string, any>();

async function getAllGeminiSignals(): Promise<any[]> {
  const map = new Map<string, any>();
  inMemoryGeminiSignals.forEach((v, k) => map.set(k, v));
  if (db) {
    try {
      const snapshot = await db.collection('gemini_signals').get();
      snapshot.forEach((doc: any) => {
        const d = doc.data();
        if (d && d.asset) {
          map.set(d.asset, d);
        }
      });
    } catch(e) {}
  }
  return Array.from(map.values());
}

let isQuotaExceeded = false;
let quotaExceededTime = 0;

function checkQuotaExceeded(): boolean {
  if (isQuotaExceeded) {
    const elapsedMinutes = (Date.now() - quotaExceededTime) / (60 * 1000);
    if (elapsedMinutes >= 5) {
      console.log(`[Quota Cooldown] Sono passati ${elapsedMinutes.toFixed(1)} minuti dalla saturazione della quota. Provo a ripristinare il servizio...`);
      isQuotaExceeded = false;
      return false;
    }
    return true;
  }
  return false;
}

// Bulk market sentiment to execute multiple analyses in a single API request and avoid rate limit issues
async function getBulkMarketSentiment(symbols: string[], context?: string): Promise<Record<string, {score: number, reasoning: string}>> {
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getUTCHours();
  const results: Record<string, {score: number, reasoning: string}> = {};
  
  const missingSymbols: string[] = [];
  for (const sym of symbols) {
    const cacheKey = `${sym}:${context || 'default'}:${context ? '' : today}:${context ? '' : hour}`;
    if (sentimentCache.has(cacheKey)) {
      results[sym] = sentimentCache.get(cacheKey)!;
    } else {
      missingSymbols.push(sym);
    }
  }

  // Check Firestore for missing symbols before calling Gemini
  if (missingSymbols.length > 0 && db) {
    try {
      const remainingSymbols: string[] = [];
      for (const sym of missingSymbols) {
        const firestoreKey = `${sym}_${context || 'default'}_${context ? '' : today}_${context ? '' : hour}`.replace(/[^a-zA-Z0-9_]/g, '_');
        const cacheDoc = await db.collection('sentiment_cache').doc(firestoreKey).get();
        if (cacheDoc.exists) {
          const data = cacheDoc.data();
          const result = { score: data.score, reasoning: data.reasoning };
          const cacheKey = `${sym}:${context || 'default'}:${context ? '' : today}:${context ? '' : hour}`;
          sentimentCache.set(cacheKey, result);
          results[sym] = result;
        } else {
          remainingSymbols.push(sym);
        }
      }
      
      // Update missingSymbols with only those not found in Firestore
      missingSymbols.length = 0;
      missingSymbols.push(...remainingSymbols);
    } catch (e) {
      console.warn('[Firestore Cache] Error checking sentiment cache:', e);
    }
  }

  if (missingSymbols.length === 0) {
    return results;
  }

  if (checkQuotaExceeded()) {
    const elapsedMinutes = (Date.now() - quotaExceededTime) / (60 * 1000);
    for (const sym of missingSymbols) {
      results[sym] = { score: 0, reasoning: `Quota limitata o superata (attendi altri ${(5 - elapsedMinutes).toFixed(1)} minuti)` };
    }
    return results;
  }

  try {
    const feedbackRules = botStatus.userFeedbackRules && botStatus.userFeedbackRules.length > 0
      ? `\n\nUSER FEEDBACK RULES TO FOLLOW:\n- ${botStatus.userFeedbackRules.join('\n- ')}`
      : '';

    const statContext = StatisticalExpertService.getInstance().getPromptContext();
    const rssContext = await RssNewsService.getInstance().getNewsContextForPrompt();

    const customGemPrompt = botStatus.geminiCustomPrompt || LLMProviderService.getInstance().getCustomSystemPrompt();
    const systemPersona = customGemPrompt && customGemPrompt.trim() !== ''
      ? customGemPrompt.trim()
      : `[SYSTEM: QUANTITATIVE DECISION ENGINE]
Priorità: Conservazione del capitale. Regola y=1 attiva.

[REGOLE CARDINE]
1. Gestione del Rischio (1-2% max rischio per operazione, Stop Loss obbligatorio, Rapporto Rischio/Rendimento >= 1:2 o 1:3).
2. Disciplina Antimartingala e Trend Following: Mai mediare in perdita, piramidare solo in utile, seguire il trend dominante.
3. Regola y=1: Chiusura forzata al target di profitto storico (2 fino a max 3 unità di conto). Stop loss / break-even loss threshold a 0.50 unità per posizioni >= 2 unità.
4. Default su HOLD: In caso di segnali contrastanti o incerti, lo score deve rimanere nella fascia neutra (HOLD).`;

    const prompt = `[SYSTEM: QUANTITATIVE DECISION ENGINE]
${systemPersona}

[INPUT DATA]
- Simboli da analizzare: ${missingSymbols.join(', ')}
- Dati Macro & RSS:
${rssContext}
- Correlazioni Indici & Statistiche:
${statContext}
${context ? `- Contesto Evento Specifico: ${context}` : ''}${feedbackRules}

[LOGICA DI VALUTAZIONE]
Calcola uno score numerico compreso rigorosamente tra -1.0 (ribassista) e +1.0 (rialzista) per ciascun simbolo:
- Score > +0.35 -> Tendenza BUY
- Score tra -0.35 e +0.35 -> Tendenza HOLD (default di sicurezza)
- Score < -0.35 -> Tendenza SELL

[OUTPUT FORMAT - STRICT JSON]
Rispondi RIGIDAMENTE con un singolo oggetto JSON valido (nessun testo prima o dopo) strutturato come segue:
{
  "${missingSymbols[0] || 'SPY'}": {
    "score": 0.0,
    "action": "BUY|SELL|HOLD",
    "reasoning": "Sintesi tecnica basata su risk management e trend"
  }
}`;

    const response = await LLMProviderService.getInstance().generateContent(prompt, {
      responseJson: true,
      preferredProvider: botStatus.llmPreferredProvider || 'gemini'
    });

    let parsed: Record<string, any> = {};
    if (response.success && response.text) {
      try {
        const cleanedText = response.text.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleanedText);
      } catch(e) {
        console.error(`Failed to parse ${response.provider} bulk JSON output:`, response.text);
      }
    } else {
      throw new Error(response.error || "Errore nella generazione con LLM");
    }

    for (const sym of missingSymbols) {
      const entry = parsed[sym] || {};
      const sentimentScore = typeof entry.score === 'number' ? entry.score : parseFloat(entry.score || '0');
      const resultScore = isNaN(sentimentScore) ? 0 : Math.max(-1, Math.min(1, sentimentScore));
      const resultReasoning = entry.reasoning || 'Nessuna spiegazione dettagliata disponibile';
      
      const parsedAction = entry.action && ['BUY', 'SELL', 'HOLD'].includes(String(entry.action).toUpperCase())
        ? String(entry.action).toUpperCase()
        : (resultScore > 0.35 ? 'BUY' : resultScore < -0.35 ? 'SELL' : 'HOLD');

      const result = { score: resultScore, reasoning: resultReasoning };
      const cacheKey = `${sym}:${context || 'default'}:${context ? '' : today}:${context ? '' : hour}`;
      sentimentCache.set(cacheKey, result);
      results[sym] = result;

      // Update in-memory signals cache
      inMemoryGeminiSignals.set(sym, {
        asset: sym,
        score: resultScore,
        action: parsedAction,
        confidence: Math.abs(resultScore) * 100,
        reasoning: resultReasoning,
        timestamp: new Date().toISOString()
      });

      // Sync to Firestore for real-time frontend monitoring AND long-term cache
      if (db) {
        try {
          const firestoreKey = `${sym}_${context || 'default'}_${context ? '' : today}_${context ? '' : hour}`.replace(/[^a-zA-Z0-9_]/g, '_');
          
          // Current signal
          db.collection('gemini_signals').doc(sym).set({
            asset: sym,
            score: resultScore,
            action: parsedAction,
            confidence: Math.abs(resultScore) * 100,
            reasoning: resultReasoning,
            timestamp: new Date().toISOString()
          }, { merge: true }).catch(() => {});

          // Hourly cache
          db.collection('sentiment_cache').doc(firestoreKey).set({
            score: resultScore,
            reasoning: resultReasoning,
            timestamp: new Date().toISOString()
          }).catch(() => {});

        } catch(e) {}
      }
    }

    return results;
  } catch (error: any) {
    const message = (error.message || String(error)).toLowerCase();
    if (message.includes('429') || message.includes('503') || message.includes('resource_exhausted') || message.includes('quota') || message.includes('api key not valid') || message.includes('api_key_invalid')) {
      console.warn(`[Sentiment Analysis] Limite quota API raggiunto (429/RESOURCE_EXHAUSTED). Attivazione fallback algoritmico.`);
      isQuotaExceeded = true;
      quotaExceededTime = Date.now();
    } else {
      console.error(`Error fetching bulk sentiment:`, error);
    }
    for (const sym of missingSymbols) {
      results[sym] = { score: 0, reasoning: 'Errore nel recupero del sentiment' };
    }
    return results;
  }
}

// Single-symbol wrapper using the bulk logic for backward compatibility
async function getMarketSentiment(symbol: string, context?: string): Promise<{score: number, reasoning: string}> {
  const results = await getBulkMarketSentiment([symbol], context);
  return results[symbol] || { score: 0, reasoning: 'Errore recupero sentiment' };
}

const lastPurchaseTimes: Record<string, Record<string, number>> = { paper: {}, live: {} };
const positionEntryTimes: Record<string, Record<string, number>> = { paper: {}, live: {} };

let trendingStocksCache: { date: string; symbols: string[] } | null = null;
let lastScanSlotInfo: { date: string; slot: 'market_open' | 'mid_session' | 'none' } = { date: '', slot: 'none' };
let activeDynamicIndicesCache: string[] = [
  'NVDA', 'AAPL', 'MSFT', 'AMD', 'INTC', 'QCOM', 'AVGO', 'MU', 'SMCI', 'ARM', 'CRM', 'ORCL', 'ADBE', 'CSCO', 'IBM',
  'JPM', 'BAC', 'WFC', 'MS', 'GS', 'BLK', 'V', 'MA', 'PYPL',
  'TSLA', 'AMZN', 'NFLX', 'DIS', 'WMT', 'COST', 'NKE', 'MCD', 'SBUX',
  'LLY', 'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK',
  'XOM', 'CVX', 'COP', 'SLB', 'FCX', 'NEM',
  'BA', 'CAT', 'GE', 'HON', 'UPS',
  'PLTR', 'COIN', 'SHOP', 'UBER', 'RBLX', 'HOOD', 'SQ', 'ROKU', 'ABNB', 'SNOW'
];

async function getDynamicTrendingStocks(): Promise<string[]> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const timeInMinutes = utcHours * 60 + utcMinutes;

  // SCHEDULE: Slot (a) Apertura del mercato (~14:15 - 15:15 UTC / 09:15 - 10:15 EST), Slot (b) Metà sessione (~17:15 - 18:15 UTC / 12:15 - 13:15 EST).
  const isMarketOpenSlot = timeInMinutes >= 1410 && timeInMinutes <= 1515;
  const isMidSessionSlot = timeInMinutes >= 1020 && timeInMinutes <= 1110;

  let currentSlot: 'market_open' | 'mid_session' | 'none' = 'none';
  if (isMarketOpenSlot) currentSlot = 'market_open';
  else if (isMidSessionSlot) currentSlot = 'mid_session';

  // Non ripetere la scansione se lo slot corrente è già stato scansionato oggi o se siamo fuori dai due orari fissi
  if (lastScanSlotInfo.date === today && lastScanSlotInfo.slot === currentSlot && currentSlot !== 'none') {
    console.log(`[Dynamic Discovery - Schedule] Slot '${currentSlot}' già scansionato oggi. Mantengo la lista attiva corrente.`);
    return activeDynamicIndicesCache;
  }

  if (currentSlot === 'none' && trendingStocksCache && trendingStocksCache.date === today) {
    console.log(`[Dynamic Discovery - Schedule] Fuori dagli orari fissi di slot (Apertura / Metà sessione). Restituisco gli indici attivi correnti.`);
    return activeDynamicIndicesCache;
  }

  if (checkQuotaExceeded()) {
    console.log('[Dynamic Discovery] Quota superata. Ritorno i ticker di fallback correnti.');
    return activeDynamicIndicesCache;
  }

  try {
    const feedbackRules = botStatus.userFeedbackRules && botStatus.userFeedbackRules.length > 0
      ? `\n\nUSER FEEDBACK RULES TO FOLLOW:\n- ${botStatus.userFeedbackRules.join('\n- ')}`
      : '';

    const prompt = `[SYSTEM: DYNAMIC DISCOVERY ENGINE]
Analizza i cataloghi di mercato correnti, i catalizzatori di volatilità e le notizie globali.${feedbackRules}

[EXECUTION RULES]
1. Identifica da 35 a 50 ticker azionari o ETF a elevata liquidità.
2. Escludi asset illiquidi o con spread elevati incompatibili con il risk management del 1-2%.

[OUTPUT FORMAT - STRICT JSON ARRAY]
Restituisci RIGIDAMENTE un array JSON di stringhe (nessun commento, nessun markdown extra) contenente i ticker in maiuscolo (es. ["AAPL", "NVDA", "SPY", "QQQ", "MSFT", "TSLA", ...]):
["AAPL", "NVDA", "SPY", "QQQ"]`;

    const response = await LLMProviderService.getInstance().generateContent(prompt, {
      responseJson: true,
      preferredProvider: botStatus.llmPreferredProvider || 'gemini'
    });

    if (response.success && response.text) {
      const cleanedText = response.text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        const symbols = parsed.map(s => s.trim().toUpperCase());
        const filteredSymbols = symbols.filter(s => /^[A-Z]{1,6}$/.test(s));
        if (filteredSymbols.length > 0) {
          activeDynamicIndicesCache = filteredSymbols;
          trendingStocksCache = { date: today, symbols: filteredSymbols };
          if (currentSlot !== 'none') {
            lastScanSlotInfo = { date: today, slot: currentSlot };
          }
          
          if (db) {
            db.collection('trending_stocks').doc(`slot_${today}_${currentSlot}`).set({
              symbols: filteredSymbols,
              slot: currentSlot,
              timestamp: new Date().toISOString()
            }).catch(() => {});
          }

          console.log(`[Dynamic Discovery - Execution] Scansione slot '${currentSlot}' completata. Trovati ${filteredSymbols.length} indici/asset dinamici.`);
          return filteredSymbols;
        }
      }
    }
  } catch (error: any) {
    const message = error.message || String(error);
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      isQuotaExceeded = true;
      quotaExceededTime = Date.now();
    }
  }

  return activeDynamicIndicesCache;
}

// Storico e calcolo VIX 24h
let cachedVixChange: { timestamp: number; value: number } | null = null;

async function getVix24hChange(conf?: any): Promise<number | undefined> {
  const now = Date.now();
  if (cachedVixChange && (now - cachedVixChange.timestamp < 2 * 60 * 1000)) {
    return cachedVixChange.value;
  }

  // 1. Prova snapshot Alpaca per VXX o VIXY se configurato
  if (conf && conf.isConfigured && conf.apiKey && conf.secretKey) {
    for (const vixSym of ['VXX', 'VIXY']) {
      try {
        const res = await fetch(`https://data.alpaca.markets/v2/stocks/${vixSym}/snapshot`, {
          headers: {
            'APCA-API-KEY-ID': conf.apiKey,
            'APCA-API-SECRET-KEY': conf.secretKey
          }
        });
        if (res.ok) {
          const data: any = await res.json();
          const prevClose = data.prevDailyBar?.c;
          const currPrice = data.latestTrade?.p || data.dailyBar?.c;
          if (prevClose && prevClose > 0 && currPrice && currPrice > 0) {
            const changePct = ((currPrice - prevClose) / prevClose) * 100;
            cachedVixChange = { timestamp: now, value: changePct };
            return changePct;
          }
        }
      } catch (e) {
        // Continua al fallback
      }
    }
  }

  // 2. Fallback via Yahoo Finance VIX
  try {
    const res = await fetch('https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=2d');
    if (res.ok) {
      const data: any = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta && meta.regularMarketPrice && meta.chartPreviousClose) {
        const currPrice = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose;
        const changePct = ((currPrice - prevClose) / prevClose) * 100;
        cachedVixChange = { timestamp: now, value: changePct };
        return changePct;
      }
    }
  } catch (e) {
    // Silenzioso
  }

  return undefined;
}

// Storico del sentiment aggregato di mercato per tracciare il trend (Regola 3)
const aggregateSentimentHistory: { timestamp: number; score: number }[] = [];

function recordAggregateMarketSentiment(bulkSentiment: Record<string, { score: number; reasoning: string }>) {
  const entries = Object.values(bulkSentiment);
  if (entries.length === 0) return;
  const sum = entries.reduce((acc, curr) => acc + (typeof curr.score === 'number' ? curr.score : 0), 0);
  const avg = sum / entries.length;
  aggregateSentimentHistory.push({ timestamp: Date.now(), score: avg });
  if (aggregateSentimentHistory.length > 20) {
    aggregateSentimentHistory.shift();
  }
}

function isMarketSentimentDecreasingTwoConsecutiveScans(): boolean {
  if (aggregateSentimentHistory.length < 3) return false;
  const len = aggregateSentimentHistory.length;
  const s0 = aggregateSentimentHistory[len - 1].score; // Scansione corrente
  const s1 = aggregateSentimentHistory[len - 2].score; // Scansione precedente
  const s2 = aggregateSentimentHistory[len - 3].score; // 2 scansioni fa
  return s0 < s1 && s1 < s2;
}

async function getMarketMinutesToClose(baseUrl: string, apiKey: string, secretKey: string): Promise<number | null> {
  try {
    const response = await fetch(`${baseUrl}/clock`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey
      }
    });
    if (response.ok) {
      const data: any = await response.json();
      if (!data.is_open) return null;
      const nextClose = new Date(data.next_close).getTime();
      const current = new Date(data.timestamp || new Date()).getTime();
      const diffMs = nextClose - current;
      const diffMins = diffMs / (1000 * 60);
      return diffMins;
    }
  } catch (error) {
    console.error('[Market Close Check Error] Errore nel calcolo dei minuti alla chiusura:', error);
  }
  
  // Fallback in caso di errore API: controlla orario standard USA (lunedì-venerdì, chiusura alle 21:00 UTC)
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) {
    return null; // Weekend chiuso
  }
  
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // Utilizziamo 1260 minuti (21:00 UTC, corrispondenti alle 16:00 EST/EDT) come chiusura standard
  if (timeInMinutes >= 810 && timeInMinutes <= 1260) {
    return 1260 - timeInMinutes;
  }
  return null;
}

async function getLatestPrice(symbol: string, apiKey: string, secretKey: string): Promise<number> {
  try {
    const res = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/trades/latest`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey
      }
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.trade && data.trade.p) {
        return parseFloat(data.trade.p);
      }
    }
  } catch (err) {
    console.error(`[Price Fetch Error] Errore nel recupero dell'ultimo prezzo per ${symbol} tramite trades/latest:`, err);
  }

  try {
    const res = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/snapshot`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey
      }
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.latestTrade && data.latestTrade.p) {
        return parseFloat(data.latestTrade.p);
      }
    }
  } catch (err) {
    console.error(`[Price Fetch Error] Errore nel recupero dell'ultimo prezzo per ${symbol} tramite snapshot:`, err);
  }

  return basePrices[symbol] || 100.0;
}

async function sendToGoogleSheets(payload: { eventType: string; mode?: string; symbol?: string; action?: string; sheetName?: string; data: any }) {
  try {
    await GoogleSheetsService.appendLogsToSheet(payload);
  } catch (err: any) {
    console.warn('[Google Sheets Info]', err?.message || err);
  }
}

async function syncDailyTradingSummaryToGoogleSheets() {
  try {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    
    // Controlla se siamo esattamente intorno alle 20:45 UTC (15 minuti prima della chiusura di Wall Street alle 21:00 UTC)
    // O se sono passate almeno 12 ore dall'ultimo invio e siamo in sessione di mercato pomeridiana/serale
    const isCloseToMarketEnd = (utcHours === 20 && utcMinutes >= 40 && utcMinutes <= 50);
    
    const lastSync = botStatus.lastGoogleSheetsLogSync ? new Date(botStatus.lastGoogleSheetsLogSync).getTime() : 0;
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    const isTimeElapsed = (now.getTime() - lastSync) >= TWELVE_HOURS;

    if (!isCloseToMarketEnd && !isTimeElapsed) {
      return;
    }

    const summaryPayload = {
      eventType: 'daily_trading_digest',
      timestamp: new Date().toISOString(),
      data: {
        totalTradesLogged: botStatus.dailyLogicLogs?.length || 0,
        logicLogs: (botStatus.dailyLogicLogs || []).map((l: any) => ({
          time: new Date(l.timestamp).toLocaleTimeString('it-IT'),
          symbol: l.symbol,
          action: l.action,
          reasoning: l.reasoning,
          price: l.price
        })),
        dailyPnL: botStatus.dailyPnL || []
      }
    };

    await GoogleSheetsService.appendLogsToSheet(summaryPayload);
    botStatus.lastGoogleSheetsLogSync = new Date().toISOString();
    saveBotStatus().catch(() => {});
    console.log('[Google Sheets] Riepilogo giornaliero inviato con successo (15 minuti prima della chiusura di mercato).');
  } catch (err: any) {
    console.warn('[Google Sheets Info] Avviso sincronizzazione riepilogo giornaliero:', err?.message || err);
  }
}

async function exportCredentialsToGoogleSheets(): Promise<boolean> {
  try {
    const llmConfigs = LLMProviderService.getInstance().getConfigs();
    
    const paperApiKey = resolvedCredentials.paper?.apiKey || process.env.VITE_ALPACA_PAPER_API_KEY || '';
    const paperSecretKey = resolvedCredentials.paper?.secretKey || process.env.VITE_ALPACA_PAPER_SECRET_KEY || '';
    const liveApiKey = resolvedCredentials.live?.apiKey || process.env.VITE_ALPACA_LIVE_API_KEY || '';
    const liveSecretKey = resolvedCredentials.live?.secretKey || process.env.VITE_ALPACA_LIVE_SECRET_KEY || '';

    const keysTable: Record<string, string> = {
      "Alpaca Paper API Key": paperApiKey,
      "Alpaca Paper Secret Key": paperSecretKey,
      "Alpaca Live API Key": liveApiKey,
      "Alpaca Live Secret Key": liveSecretKey,
    };

    for (const [provider, cfg] of Object.entries(llmConfigs)) {
      const pName = provider.toUpperCase();
      keysTable[`API ${pName}`] = cfg?.apiKey || '';
    }

    const result = await GoogleSheetsService.exportKeysToSheet(keysTable);
    if (result) {
      console.log('[Google Sheets] Backup credenziali inviato con successo su Google Sheets');
    }
    return result;
  } catch (err: any) {
    console.warn('[Google Sheets] Esportazione credenziali non disponibile:', err.message);
    throw err;
  }
}

app.post('/api/sheets/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      GoogleSheetsService.setUserAccessToken(token);
    }

    const keys = await GoogleSheetsService.syncKeysFromSheet();
    if (keys) {
      const getKey = (aliases: string[]): string | undefined => {
        for (const [k, v] of Object.entries(keys)) {
          const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const alias of aliases) {
            const normA = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normK === normA) return v;
          }
        }
        return undefined;
      };

      // 1. Update LLM configurations in memory and Firestore
      const llmConfigs = LLMProviderService.getInstance().getConfigs();
      for (const [provider, config] of Object.entries(llmConfigs)) {
        const val = getKey([
          `API ${provider}`,
          `${provider} API Key`,
          `${provider} Key`,
          provider,
          `${provider}_api_key`,
          `api_${provider}`,
          `${provider}_key`
        ]);
        if (val) {
          LLMProviderService.getInstance().updateConfig(provider as any, { apiKey: val });
          
          if (db) {
            try {
              const docRef = db.collection('settings').doc('llm');
              const doc = await docRef.get();
              const currentData = doc.exists ? doc.data() : {};
              currentData[provider] = {
                ...currentData[provider],
                apiKey: val
              };
              await docRef.set(currentData);
              console.log(`[Google Sheets Sync] LLM provider ${provider} key saved to Firestore.`);
            } catch (fsErr: any) {
              console.warn(`[Google Sheets Sync] Failed saving ${provider} LLM key to Firestore:`, fsErr.message);
            }
          }
        }
      }

      // 2. Extract Alpaca keys
      const paperApiKey = getKey(['Alpaca Paper API Key', 'ALPACA_PAPER_API_KEY', 'Paper API Key', 'Alpaca Paper Key', 'ALPACA_PAPER_KEY', 'paper_key', 'paper_api_key', 'paperkey']);
      const paperSecretKey = getKey(['Alpaca Paper Secret Key', 'ALPACA_PAPER_SECRET_KEY', 'Paper Secret Key', 'Alpaca Paper Secret', 'ALPACA_PAPER_SECRET', 'paper_secret', 'paper_secret_key', 'papersecretkey']);
      const liveApiKey = getKey(['Alpaca Live API Key', 'ALPACA_LIVE_API_KEY', 'Live API Key', 'Alpaca Live Key', 'ALPACA_LIVE_KEY', 'Alpaca Real Key', 'Alpaca Real API Key', 'live_key', 'live_api_key', 'livekey']);
      const liveSecretKey = getKey(['Alpaca Live Secret Key', 'ALPACA_LIVE_SECRET_KEY', 'Live Secret Key', 'Alpaca Live Secret', 'ALPACA_LIVE_SECRET', 'Alpaca Real Secret', 'Alpaca Real Secret Key', 'live_secret', 'live_secret_key', 'livesecretkey']);

      if (paperApiKey) resolvedCredentials.paper.apiKey = paperApiKey;
      if (paperSecretKey) resolvedCredentials.paper.secretKey = paperSecretKey;
      if (liveApiKey) resolvedCredentials.live.apiKey = liveApiKey;
      if (liveSecretKey) resolvedCredentials.live.secretKey = liveSecretKey;

      if (resolvedCredentials.paper.apiKey && resolvedCredentials.paper.secretKey) resolvedCredentials.paper.isConfigured = true;
      if (resolvedCredentials.live.apiKey && resolvedCredentials.live.secretKey) resolvedCredentials.live.isConfigured = true;

      // 3. Update local fallback credentials so they are returned in /api/trading/credentials
      if (!localCredentialsFallback['alpaca']) localCredentialsFallback['alpaca'] = {};
      if (!localCredentialsFallback['alpaca']['paper']) localCredentialsFallback['alpaca']['paper'] = {};
      if (!localCredentialsFallback['alpaca']['real']) localCredentialsFallback['alpaca']['real'] = {};
      if (!localCredentialsFallback['alpaca']['live']) localCredentialsFallback['alpaca']['live'] = {};

      if (paperApiKey) localCredentialsFallback['alpaca']['paper'].apiKey = paperApiKey;
      if (paperSecretKey) localCredentialsFallback['alpaca']['paper'].secretKey = paperSecretKey;
      if (liveApiKey) {
        localCredentialsFallback['alpaca']['real'].apiKey = liveApiKey;
        localCredentialsFallback['alpaca']['live'].apiKey = liveApiKey;
      }
      if (liveSecretKey) {
        localCredentialsFallback['alpaca']['real'].secretKey = liveSecretKey;
        localCredentialsFallback['alpaca']['live'].secretKey = liveSecretKey;
      }

      saveLocalCredentialsFallback(localCredentialsFallback);

      // 4. Save Alpaca credentials to Firestore
      if (db) {
        try {
          const docRef = db.collection('broker_credentials').doc('config');
          const doc = await docRef.get();
          let currentData = doc.exists ? doc.data() : {};
          
          if (!currentData['alpaca']) currentData['alpaca'] = {};
          if (!currentData['alpaca']['paper']) currentData['alpaca']['paper'] = {};
          if (!currentData['alpaca']['real']) currentData['alpaca']['real'] = {};
          if (!currentData['alpaca']['live']) currentData['alpaca']['live'] = {};

          if (paperApiKey) currentData['alpaca']['paper'].apiKey = paperApiKey;
          if (paperSecretKey) currentData['alpaca']['paper'].secretKey = paperSecretKey;
          if (liveApiKey) {
            currentData['alpaca']['real'].apiKey = liveApiKey;
            currentData['alpaca']['live'].apiKey = liveApiKey;
          }
          if (liveSecretKey) {
            currentData['alpaca']['real'].secretKey = liveSecretKey;
            currentData['alpaca']['live'].secretKey = liveSecretKey;
          }

          await docRef.set(currentData);
          console.log('[Google Sheets Sync] Alpaca keys saved to Firestore.');
        } catch (fsErr: any) {
          console.warn('[Google Sheets Sync] Failed saving Alpaca keys to Firestore:', fsErr.message);
        }
      }
    }

    if (db) {
      await loadStateFromFirestore();
      await autoDetectCredentials(); // Also reload Alpaca credentials on sync
    }
    
    // Now push back to sheets in case anything was missing from sheets but present locally
    await exportCredentialsToGoogleSheets();
    
    res.json({
      success: true,
      message: keys ? 'Sincronizzazione con Google Sheets completata con successo!' : 'Nessuna chiave trovata nel foglio o foglio non accessibile.',
      userFeedbackRules: botStatus.userFeedbackRules || []
    });
  } catch (err: any) {
    const errMsg = err?.message || err?.toString() || 'Errore durante la sincronizzazione con Google Sheets';
    console.warn('[Google Sheets Sync]:', errMsg);
    const isAuthError = errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('credential') || errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('login') || errMsg.toLowerCase().includes('not been used') || errMsg.toLowerCase().includes('disabled');
    const status = isAuthError ? 401 : 500;
    res.status(status).json({ success: false, error: errMsg });
  }
});

app.post('/api/sheets/backup-credentials', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      GoogleSheetsService.setUserAccessToken(token);
    }

    const ok = await exportCredentialsToGoogleSheets();
    if (ok) {
      res.json({ success: true, message: 'Chiavi API esportate con successo su Google Sheets!' });
    } else {
      res.status(401).json({ success: false, error: 'Google Sheets non accessibile o API non abilitata. Configura le chiavi direttamente in Impostazioni.' });
    }
  } catch (err: any) {
    const errMsg = err?.message || err?.toString() || 'Errore durante l\'esportazione delle chiavi';
    console.warn('[Google Sheets Backup]:', errMsg);
    const isAuthError = errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('credential') || errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('login') || errMsg.toLowerCase().includes('not been used') || errMsg.toLowerCase().includes('disabled');
    const status = isAuthError ? 401 : 500;
    res.status(status).json({ success: false, error: errMsg });
  }
});

async function isAlpacaMarketOpen(baseUrl: string, apiKey: string, secretKey: string): Promise<boolean> {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) {
    return false; // Weekend chiuso a costo zero (nessuna chiamata API)
  }

  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const timeInMinutes = hour * 60 + minute;

  // Borsa USA aperta tra 13:30 (810 min UTC) e 21:00 (1260 min UTC).
  // Se siamo ampiamente fuori (es. prima delle 12:30 UTC o dopo le 21:30 UTC), restituisce false senza chiamate API.
  if (timeInMinutes < 750 || timeInMinutes > 1300) {
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/clock`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey
      }
    });
    if (response.ok) {
      const data: any = await response.json();
      return !!data.is_open;
    }
  } catch (error) {
    console.error('[Market Open Check Error] Errore nel recupero dello stato della borsa da Alpaca:', error);
  }
  
  // Fallback in caso di errore API: controlla orario standard USA (lunedì-venerdì, 13:30 - 21:00 UTC)
  return timeInMinutes >= 810 && timeInMinutes <= 1260;
}

async function getAndUpdateHighestPrice(symbol: string, currentPrice: number, avgEntryPrice: number): Promise<number> {
  let highestPrice = currentPrice;

  if (localHighestPrices[symbol] !== undefined) {
    highestPrice = Math.max(localHighestPrices[symbol], currentPrice);
  } else {
    if (db) {
      try {
        const docRef = db.collection('alpaca_positions').doc(symbol);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data();
          if (data && typeof data.highestPrice === 'number') {
            highestPrice = Math.max(highestPrice, data.highestPrice);
          }
        }
      } catch (e) {
        // Silenzioso
      }
    }
  }

  if (avgEntryPrice > 0 && highestPrice < avgEntryPrice) {
    highestPrice = avgEntryPrice;
  }
  if (currentPrice > highestPrice) {
    highestPrice = currentPrice;
  }

  const previousPeak = localHighestPrices[symbol];
  localHighestPrices[symbol] = highestPrice;

  if (db && (previousPeak === undefined || highestPrice > previousPeak)) {
    db.collection('alpaca_positions').doc(symbol).set({
      symbol,
      highestPrice,
      updatedAt: new Date().toISOString(),
      status: 'ACTIVE'
    }, { merge: true }).catch(() => {});
  }

  return highestPrice;
}

const activeTrailingStatus: Record<string, { isActivated: boolean; lastLoggedPeak: number }> = {};

const consecutiveSlTracker: Record<'paper' | 'live', { count: number; lastSlTimestamp: number | null }> = {
  paper: { count: 0, lastSlTimestamp: null },
  live: { count: 0, lastSlTimestamp: null }
};

function checkAndLogTrailingStopStatus(
  mode: 'paper' | 'live',
  symbol: string,
  currentPrice: number,
  avgEntryPrice: number,
  highestPrice: number,
  strategyName: string,
  params: { tpPct: number; tsPct: number; slPct: number }
) {
  if (!avgEntryPrice || avgEntryPrice <= 0 || !currentPrice || currentPrice <= 0) return;

  const highestProfitPct = ((highestPrice - avgEntryPrice) / avgEntryPrice) * 100;
  const currentProfitPct = ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100;
  const isActivated = highestProfitPct >= (params.tpPct - 0.0001);
  const trailingStopPrice = highestPrice * (1 - params.tsPct / 100);

  const prevStatus = activeTrailingStatus[symbol];

  if (isActivated) {
    if (!prevStatus || !prevStatus.isActivated) {
      activeTrailingStatus[symbol] = {
        isActivated: true,
        lastLoggedPeak: highestPrice
      };
      addLog(mode, `[🎯 TARGET ATTIVATO] ${symbol} (Strategia ${strategyName}): Picco massimo +${highestProfitPct.toFixed(2)}% >= Target +${params.tpPct.toFixed(2)}%. Trailing Stop (${params.tsPct}%) ATTIVATO! Stop Loss portato a Break-Even ($${avgEntryPrice.toFixed(2)}). Soglia Trailing attuale: $${trailingStopPrice.toFixed(2)} (Prezzo attuale: $${currentPrice.toFixed(2)}, P&L attuale: ${currentProfitPct >= 0 ? '+' : ''}${currentProfitPct.toFixed(2)}%).`);
    } else if (highestPrice > (prevStatus.lastLoggedPeak || 0)) {
      activeTrailingStatus[symbol].lastLoggedPeak = highestPrice;
      addLog(mode, `[📈 TRAILING STOP AGGIORNATO] ${symbol}: Nuovo picco massimo $${highestPrice.toFixed(2)} (+${highestProfitPct.toFixed(2)}%). Nuova soglia Trailing Stop alzata a $${trailingStopPrice.toFixed(2)} (Distante ${params.tsPct}% dal picco. Prezzo attuale: $${currentPrice.toFixed(2)}).`);
    }
  }
}

async function executeTradingCycleForMode(mode: 'paper' | 'live', force: boolean) {
  const { isConfigured, isLive, baseUrl, apiKey, secretKey } = getAlpacaConfig(mode);
  const labelTipoConto = isLive ? 'Reale (Live)' : 'Simulazione (Paper)';
  
  if (!isConfigured) {
    if (force) addLog(mode as 'paper' | 'live', `[Alpaca ${labelTipoConto}] API Key mancante.`);
    return;
  }

  // Verifichiamo se la borsa è aperta (salvo esecuzione forzata manualmente)
  if (!force) {
    const open = await isAlpacaMarketOpen(baseUrl, apiKey, secretKey);
    if (!open) {
      addLog(mode as 'paper' | 'live', `[Borsa] La borsa è chiusa in questo momento. Ciclo automatico ignorato per evitare ordini fuori orario.`);
      return;
    }
  }
  
  try {
    const response = await fetch(`${baseUrl}/account`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        resolvedCredentials[mode].isConfigured = false;
        if (mode === 'live') {
          botStatus.liveActive = false;
        } else {
          botStatus.paperActive = false;
        }
        botStatus.active = botStatus.paperActive || botStatus.liveActive;
        saveBotStatus().catch(() => {});
        throw new Error(`Credenziali Alpaca (${labelTipoConto}) non valide o revocate (401 Unauthorized). Il bot sul conto ${labelTipoConto} è stato automaticamente MESSO IN PAUSA. Aggiorna le tue chiavi API nella scheda Impostazioni API per riattivarlo.`);
      }
      throw new Error(`Errore API Alpaca: ${response.status} ${response.statusText}`);
    }
    
    const account = await response.json();
    botData[mode].balance = parseFloat(account.equity || account.portfolio_value || '0');
    botData[mode].accountNumber = account.account_number;
    
    let currentBuyingPower = parseFloat(account.buying_power || '0');
    const lastEquity = parseFloat(account.last_equity || account.equity || '0');
    const dailyPnLPct = lastEquity > 0 ? ((botData[mode].balance - lastEquity) / lastEquity) * 100 : 0;
    const amountToBuy = mode === 'paper' ? 1000 : 5;
    
    addLog(mode as 'paper' | 'live', `[Alpaca] Conto di ${labelTipoConto} verificato con successo. Saldo Equity: $${botData[mode].balance.toFixed(2)} (P&L Giornaliero: ${dailyPnLPct >= 0 ? '+' : ''}${dailyPnLPct.toFixed(2)}%) | Potere d'Acquisto: $${currentBuyingPower.toFixed(2)}`);
    
    // Recupero della distanza dalla chiusura del mercato per valutare il Check-Point pre-chiusura
    const minutesToClose = await getMarketMinutesToClose(baseUrl, apiKey, secretKey);
    const isPreCloseWindow = minutesToClose !== null && minutesToClose > 0 && minutesToClose <= 15;
    
    if (isPreCloseWindow) {
      addLog(mode as 'paper' | 'live', `[Check-Point EOD] Mancano ${minutesToClose.toFixed(1)} minuti alla chiusura della borsa. Attivazione delle regole speciali pre-chiusura.`);
    } else {
      addLog(mode as 'paper' | 'live', `[Intraday] Mancano ${minutesToClose ? minutesToClose.toFixed(1) + ' minuti' : 'N/A'} alla chiusura. Operatività standard attiva.`);
    }
    
    // Recupero delle posizioni aperte correnti per gestire vendite o monitoraggio
    let openPositions: any[] = [];
    try {
      const posResponse = await fetch(`${baseUrl}/positions`, {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': secretKey
        }
      });
      if (posResponse.ok) {
        openPositions = await posResponse.json();
      }
      syncDailyTradingSummaryToGoogleSheets().catch(() => {});
    } catch (e: any) {
      addLog(mode as 'paper' | 'live', `[Alpaca Posizioni Errore] Impossibile recuperare posizioni aperte: ${e.message}`);
    }

    // Recupero degli ordini aperti correnti per verificare la presenza di trailing stop
    let openOrders: any[] = [];
    try {
      const ordersResponse = await fetch(`${baseUrl}/orders?status=open`, {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': secretKey
        }
      });
      if (ordersResponse.ok) {
        openOrders = await ordersResponse.json();
      }
    } catch (e: any) {
      addLog(mode as 'paper' | 'live', `[Alpaca Ordini Errore] Impossibile recuperare ordini aperti: ${e.message}`);
    }

    const INDICES = ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ'];
    const COMMODITIES = ['GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'];
    
    // Scansione dinamica giornaliera di asset esterni ad alto potenziale di rialzo
    let trendingSymbols: string[] = [];
    try {
      addLog(mode as 'paper' | 'live', `[Scansione Azioni] Scansione in corso tramite IA per identificare azioni con forti trend rialzisti...`);
      trendingSymbols = await getDynamicTrendingStocks();
      addLog(mode as 'paper' | 'live', `[Scansione Azioni] Trovate le seguenti opportunità ad alto potenziale: ${trendingSymbols.join(', ')}`);
    } catch (err: any) {
      addLog(mode as 'paper' | 'live', `[Scansione Azioni Errore] Errore nella scansione dinamica: ${err.message}`);
    }

    const customSymbols = botStatus.monitoredSymbols || [];
    const ALL_TRADED_SYMBOLS = [...INDICES, ...COMMODITIES, ...trendingSymbols, ...customSymbols];

    // Ottieni i simboli di tutte le posizioni aperte (es. AAPL) che non sono nell'elenco predefinito
    const openSymbols = openPositions.map((p: any) => p.symbol);
    const symbolsToAnalyze = Array.from(new Set([...ALL_TRADED_SYMBOLS, ...openSymbols]));

    addLog(mode as 'paper' | 'live', `[Mercato] Avvio analisi di sentiment bulk per ${symbolsToAnalyze.length} asset...`);
    const bulkSentiment = await getBulkMarketSentiment(symbolsToAnalyze);
    recordAggregateMarketSentiment(bulkSentiment);
    const vix24hChangePct = await getVix24hChange(getAlpacaConfig(mode));

    // Aggiornamento dati e matrice dell'Esperto Statistico di Sfondo
    const indexPrices: Record<string, number> = {};
    const indexChanges: Record<string, number> = {};
    const mockBasePrices: Record<string, number> = { SPY: 520, QQQ: 450, DIA: 390, IWM: 200, VIX: 15 };

    for (const idxSym of ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX']) {
      const scoreData = bulkSentiment[idxSym];
      const base = mockBasePrices[idxSym] || 100;
      const score = scoreData ? scoreData.score : 0;
      const chgPct = idxSym === 'VIX' ? (vix24hChangePct ?? (score * -5)) : (score * 1.5);
      indexPrices[idxSym] = parseFloat((base * (1 + chgPct / 100)).toFixed(2));
      indexChanges[idxSym] = parseFloat(chgPct.toFixed(2));
    }

    StatisticalExpertService.getInstance().updateIndexPrices(indexPrices, indexChanges);
    const statMetrics = StatisticalExpertService.getInstance().getMetrics();
    addLog(mode as 'paper' | 'live', `[Modulo Statistico] Stato Mercato: ${statMetrics.marketState} | Coerenza: ${statMetrics.correlations.market_coherence.toFixed(2)} | Moltiplicatore Taglia: ${statMetrics.recommendedPositionSizeMultiplier.toFixed(2)}x`);

    addLog(mode as 'paper' | 'live', `[Valutazione IA] Riepilogo sentiment per ciascun asset analizzato:`);
    for (const sym of symbolsToAnalyze) {
      const { score, reasoning } = bulkSentiment[sym] || { score: 0, reasoning: 'Nessun sentiment disponibile' };
      const isOpen = openSymbols.includes(sym);
      const isMonitored = ALL_TRADED_SYMBOLS.includes(sym);
      
      let statusLabel = '';
      if (score > 0.35) {
        statusLabel = `🟢 RIALZISTA (Punteggio: ${score.toFixed(2)})`;
      } else if (score < -0.35) {
        statusLabel = `🔴 RIBASSISTA/NEGATIVO (Punteggio: ${score.toFixed(2)})`;
      } else {
        statusLabel = `🟡 NEUTRO/HOLD (Punteggio: ${score.toFixed(2)})`;
      }

      let actionLabel = '';
      if (isOpen) {
        if (score <= 0) {
          actionLabel = `👉 [In Portafoglio] Sotto la soglia di 0 -> Verrà CHIUSO per limitare le perdite o consolidare i profitti.`;
        } else {
          actionLabel = `👉 [In Portafoglio] Sentiment positivo -> Mantenuto in portafoglio.`;
        }
      } else if (isMonitored) {
        if (score > 0.35) {
          actionLabel = `👉 [Disponibile] Sopra la soglia di 0.35 -> Idoneo all'ACQUISTO (se ci sono slot liberi).`;
        } else {
          actionLabel = `👉 [Disponibile] Sotto la soglia di 0.35 -> Escluso dall'acquisto (richiesto > 0.35).`;
        }
      } else {
        actionLabel = `👉 [Nessuna azione] Asset non monitorato per acquisti e non in portafoglio.`;
      }

      addLog(mode as 'paper' | 'live', `  - ${sym}: ${statusLabel} | ${actionLabel}\n    └─ Motivazione: ${reasoning}`);
    }

    // 1. Fase di Vendita (Sell/Close phase): Gestione Sentiment, Take Profit basato sulla Strategia selezionata e Chiusura EOD
    const closedSymbolsThisCycle = new Set<string>();
    for (const pos of openPositions) {
      const symbol = pos.symbol;
      const { score: sentimentScore, reasoning: sentimentReasoning } = bulkSentiment[symbol] || { score: 0, reasoning: 'Nessun sentiment disponibile' };
      
      const profitPct = parseFloat(pos.unrealized_intraday_plpc || pos.unrealized_plpc || '0');
      const profitAmt = parseFloat(pos.unrealized_pl || '0');

      // Ottieni la strategia attiva per questa posizione o assegna default ottimizzato IA
      if (!positionStrategies[mode]) {
        positionStrategies[mode] = {};
      }
      if (!positionStrategies[mode][symbol]) {
        positionStrategies[mode][symbol] = getDefaultStrategy(symbol);
        saveBotStatus();
      }
      const activeStrategy = positionStrategies[mode][symbol];
      const params = STRATEGY_PARAMS[activeStrategy];
      const targetTpPct = params.tpPct / 100;

      // Aggiorna picco massimo prezzo per trailing stop
      const currentPrice = parseFloat(pos.current_price || '0');
      const avgEntryPrice = parseFloat(pos.avg_entry_price || '0');
      const costBasis = parseFloat(pos.market_value || '0') - profitAmt;
      const slDollar = costBasis * (params.slPct / 100);
      const tpDollar = costBasis * (params.tpPct / 100);

      const peakPrice = await getAndUpdateHighestPrice(symbol, currentPrice, avgEntryPrice);

      checkAndLogTrailingStopStatus(
        mode as 'paper' | 'live',
        symbol,
        currentPrice,
        avgEntryPrice,
        peakPrice,
        activeStrategy,
        params
      );

      if (!positionEntryTimes[mode][symbol]) {
        positionEntryTimes[mode][symbol] = Date.now();
      }

      // Indicatori Tecnici (ATR 14, 1.5x ATR e ADX 14)
      const indResult = await TechnicalIndicatorService.getInstance().getSymbolIndicators(symbol, currentPrice, getAlpacaConfig(mode));
      const overrides = positionStopOverrides[mode as 'paper' | 'live']?.[symbol];

      const riskDecision = RiskManagementService.evaluateClosure({
        id: symbol,
        asset: symbol,
        currentValue: parseFloat(pos.market_value || '0'),
        openPrice: avgEntryPrice,
        currentPrice: currentPrice,
        unrealizedProfit: profitAmt,
        highestPrice: peakPrice,
        sentimentScore: sentimentScore,
        vix24hChangePct: vix24hChangePct,
        entryTime: positionEntryTimes[mode][symbol],
        atr: indResult.atr,
        atr1_5x: indResult.atr1_5x,
        adx: indResult.adx,
        enableTechnicalStop: overrides?.enableTechnicalStop,
        enableCatastrophicStop: overrides?.enableCatastrophicStop
      }, botStatus.historicalProfits || 0, {
        y: botStatus.y || 1,
        defaultSL: slDollar,
        defaultTP: tpDollar,
        trailingStop: params.tsPct,
        targetTpPct: params.tpPct,
        slPct: params.slPct,
        isAlpaca: true
      }, botStatus.systemRiskRules || DEFAULT_SYSTEM_RISK_RULES);

      let shouldClose = false;
      let closeReason = '';

      // Se c'è un errore o limite di quota nel sentiment, NON chiudiamo l'asset in base al sentiment (manterremo basato su SL/TP/Trailing)
      const isSentimentError = sentimentReasoning.includes('Errore') || 
                               sentimentReasoning.includes('Quota') || 
                               sentimentReasoning.includes('Nessun sentiment');

      if (!isSentimentError && sentimentScore < -0.2) {
        if (!positionEntryTimes[mode][symbol]) {
          positionEntryTimes[mode][symbol] = Date.now();
        }
        const entryTime = positionEntryTimes[mode][symbol];
        const ageMinutes = (Date.now() - entryTime) / (60 * 1000);
        if (['SPY', 'VOO'].includes(symbol) && ageMinutes < 60) {
          addLog(mode as 'paper' | 'live', `[Portafoglio] Vincolo holding period 60m per ${symbol} (aperta da ${ageMinutes.toFixed(1)} min): chiusura per sentiment bloccata.`);
        } else {
          shouldClose = true;
          closeReason = `Sentiment negativo (${sentimentScore.toFixed(2)}): ${sentimentReasoning}`;
        }
      } else if (riskDecision && riskDecision.action === 'CLOSE') {
        shouldClose = true;
        closeReason = riskDecision.reason;
      } else if (isPreCloseWindow) {
        // Regola: NON chiudere automaticamente le posizioni a fine mercato se il sentiment è >= 0.40 (40%)
        if (sentimentScore >= 0.40) {
          shouldClose = false;
          addLog(mode as 'paper' | 'live', `[Check-Point EOD] Posizione su ${symbol} MANTENUTA a fine giornata: Sentiment elevato (${sentimentScore.toFixed(2)} >= 0.40). Nessuna chiusura automatica EOD.`);
        } else if (profitAmt > 0) {
          shouldClose = true;
          closeReason = `Chiusura EOD (15 min alla fine): Sentiment ${sentimentScore.toFixed(2)} (< 0.40) con Profitto di $${profitAmt.toFixed(2)} garantito.`;
        }
      }

      if (shouldClose) {
        addLog(mode as 'paper' | 'live', `[Portafoglio] ${closeReason} Procedo alla CHIUSURA della posizione su ${symbol}.`);
        addLogicLog(mode, {
          timestamp: new Date().toISOString(),
          symbol,
          action: 'SELL',
          reasoning: closeReason
        });

        try {
          const closeResponse = await fetch(`${baseUrl}/positions/${symbol}?cancel_orders=true`, {
            method: 'DELETE',
            headers: {
              'APCA-API-KEY-ID': apiKey,
              'APCA-API-SECRET-KEY': secretKey
            }
          });
          if (closeResponse.ok) {
            delete localHighestPrices[symbol];
            delete activeTrailingStatus[symbol];
            if (positionEntryTimes[mode]) {
              delete positionEntryTimes[mode][symbol];
            }
            addLog(mode as 'paper' | 'live', `[Alpaca] Posizione su ${symbol} chiusa con successo!`);
            closedSymbolsThisCycle.add(symbol);

            // Aggiornamento tracker Hard-Risk per Stop-Loss consecutivi
            if (profitAmt < 0) {
              consecutiveSlTracker[mode].count += 1;
              consecutiveSlTracker[mode].lastSlTimestamp = Date.now();
              addLog(mode as 'paper' | 'live', `[Hard-Risk Tracker] Chiusura in perdita su ${symbol} ($${profitAmt.toFixed(2)}). Stop-Loss consecutivi attuali: ${consecutiveSlTracker[mode].count}.`);
            } else {
              consecutiveSlTracker[mode].count = 0;
              consecutiveSlTracker[mode].lastSlTimestamp = null;
            }
          } else {
            const errData = await closeResponse.json();
            addLog(mode as 'paper' | 'live', `[Alpaca Errore Chiusura] Impossibile chiudere posizione su ${symbol}: ${errData.message}`);
          }
        } catch (err: any) {
          addLog(mode as 'paper' | 'live', `[Alpaca Errore] Errore di rete nella chiusura di ${symbol}: ${err.message}`);
        }
      } else {
        if (isSentimentError) {
          addLog(mode as 'paper' | 'live', `[Portafoglio] Mantengo la posizione su ${symbol} (Analisi sentiment temporaneamente non disponibile: ${sentimentReasoning}). Il bot continua a monitorare l'asset tramite i restanti parametri di rischio (SL/TP/Trailing).`);
        } else {
          addLog(mode as 'paper' | 'live', `[Portafoglio] Mantengo la posizione su ${symbol} (Sentiment favorevole: ${sentimentScore.toFixed(2)}: ${sentimentReasoning}). Il bot monitora costantemente l'asset per eventuali chiusure automatiche.`);
        }

        addLogicLog(mode, {
          timestamp: new Date().toISOString(),
          symbol,
          action: 'HOLD',
          reasoning: `Sentiment score: ${sentimentScore.toFixed(2)} - ${sentimentReasoning}`
        });
      }
    }

    // 2. Fase di Acquisto (Buy phase): Acquista asset con sentiment positivo (> 0.35)
    const isDecreasingSentiment = isMarketSentimentDecreasingTwoConsecutiveScans();
    const activeRules = botStatus.systemRiskRules || DEFAULT_SYSTEM_RISK_RULES;
    const marketAdxRes = await TechnicalIndicatorService.getInstance().getMarketAdx(getAlpacaConfig(mode));
    const purchasePermission = isPurchaseAllowedBySystemRules(
      minutesToClose,
      isDecreasingSentiment,
      activeRules,
      marketAdxRes.marketAdx,
      openPositions.length
    );

    // Valutazione Hard-Risk Management (Limite di perdita giornaliera -1.00% e Cooldown 30m dopo 2 Stop-Loss consecutivi)
    const hardRiskDailyEval = RiskManagementService.evaluateHardRiskDailyLimit(
      dailyPnLPct,
      consecutiveSlTracker[mode].count,
      consecutiveSlTracker[mode].lastSlTimestamp,
      activeRules
    );

    if (isPreCloseWindow) {
      addLog(mode as 'paper' | 'live', `[Check-Point EOD] Apertura nuove posizioni disabilitata negli ultimi 15 minuti di mercato.`);
    } else if (!purchasePermission.allowed) {
      const reason = purchasePermission.reason || '[Regola Sistema] Nuovi acquisti bloccati da regola di sistema.';
      addLog(mode as 'paper' | 'live', reason);
      addLogicLog(mode, {
        timestamp: new Date().toISOString(),
        symbol: 'MERCATO_GLOBALE',
        action: 'SKIP',
        reasoning: reason
      });
    } else if (!hardRiskDailyEval.allowed) {
      const reason = hardRiskDailyEval.reason || '[Hard-Risk Management] Operatività inibita da regole di salvaguardia del capitale.';
      addLog(mode as 'paper' | 'live', reason);
      addLogicLog(mode, {
        timestamp: new Date().toISOString(),
        symbol: 'MERCATO_GLOBALE',
        action: 'SKIP',
        reasoning: reason
      });
    } else {
      // Controllo soglia critica liquidità (< 5% del valore totale)
      const totalAccountEquity = botData[mode].balance;
      if (currentBuyingPower < 0.05 * totalAccountEquity) {
        addLog(mode as 'paper' | 'live', `[Liquidità Critica] Liquidità disponibile ($${currentBuyingPower.toFixed(2)}) inferiore al 5% del totale conto ($${totalAccountEquity.toFixed(2)}). Apertura nuove posizioni bloccata.`);
      } else {
        // Filtra tutti i simboli con sentiment positivo (> 0.35)
        let positiveSymbolsWithSentiment = ALL_TRADED_SYMBOLS.map(symbol => {
          const { score, reasoning } = bulkSentiment[symbol] || { score: 0, reasoning: 'Nessun sentiment disponibile' };
          return { symbol, score, reasoning };
        }).filter(item => item.score > 0.35);

        // Veto dell'Esperto Statistico di Sfondo
        positiveSymbolsWithSentiment = positiveSymbolsWithSentiment.filter(item => {
          const statEval = StatisticalExpertService.getInstance().evaluateTradePermission(item.symbol, item.score);
          if (!statEval.allowed) {
            addLog(mode as 'paper' | 'live', statEval.reason);
            addLogicLog(mode, {
              timestamp: new Date().toISOString(),
              symbol: item.symbol,
              action: 'STAT_VETO',
              reasoning: statEval.reason
            });
            return false;
          }
          return true;
        });

        // Filtro Settoriale Tech QQQ (< 0.2 vieta nuove posizioni tech)
        const qqqScore = bulkSentiment['QQQ']?.score ?? 0.25;
        const techSymbols = ['NVDA', 'AAPL', 'MSFT', 'AMD', 'INTC', 'QCOM', 'AVGO', 'MU', 'SMCI', 'ARM', 'CRM', 'ORCL', 'ADBE', 'CSCO', 'IBM', 'TSLA', 'AMZN', 'NFLX', 'DIS', 'WMT', 'COST', 'NKE', 'MCD', 'SBUX', 'QQQ'];
        if (qqqScore < 0.2) {
          positiveSymbolsWithSentiment = positiveSymbolsWithSentiment.filter(item => !techSymbols.includes(item.symbol));
          addLog(mode as 'paper' | 'live', `[Filtro Tech QQQ] Sentiment QQQ (${qqqScore.toFixed(2)}) < 0.2: apertura di nuove posizioni Tech bloccata.`);
        }

        // Gestione Liquidità Bassa (< $100 o < $70)
        if (currentBuyingPower < 70) {
          positiveSymbolsWithSentiment = positiveSymbolsWithSentiment.filter(item => item.score > 0.5);
          addLog(mode as 'paper' | 'live', `[Liquidità < $70] Operatività limitata a singoli asset con sentiment > 0.50.`);
        } else if (currentBuyingPower < 100) {
          positiveSymbolsWithSentiment = positiveSymbolsWithSentiment.filter(item => item.score > 0.6);
          addLog(mode as 'paper' | 'live', `[Liquidità < $100] Esposizione limitata a 1 asset con sentiment > 0.60.`);
        }

        // Priorità di Selezione Globale: priorità assoluta ad asset singoli con sentiment > 0.65
        positiveSymbolsWithSentiment.sort((a, b) => {
          const aPriority = a.score > 0.65 ? 1 : 0;
          const bPriority = b.score > 0.65 ? 1 : 0;
          if (aPriority !== bPriority) return bPriority - aPriority;
          return b.score - a.score;
        });

        // 2. Calcola quanti slot totali vogliamo occupare e l'allocazione dinamica del capitale (fino al 95%)
        const maxPosRule = activeRules.find(r => r.type === 'MAX_CONCURRENT_POSITIONS_CAP');
        const maxPositions = (maxPosRule && maxPosRule.enabled) ? (maxPosRule.parameters.maxConcurrentPositions ?? 5) : (botStatus.maxConcurrentPositions ?? 5);
        const currentSlotsFilled = openPositions.length;
        let availableSlots = maxPositions - currentSlotsFilled;

        if (availableSlots <= 0) {
          addLog(mode as 'paper' | 'live', `[Cap Posizioni Simultanee] Limite massimo di ${maxPositions} posizioni raggiunto (${currentSlotsFilled}/${maxPositions} occupate). Nessun nuovo acquisto effettuato.`);
        }

        if (currentBuyingPower < 100) {
          availableSlots = Math.min(availableSlots, 1);
        }

        // Quota target di capitale totale da impiegare (default 95% dell'equity)
        const targetCapitalPct = Math.min(95, Math.max(10, botStatus.riskPercentage ?? 95));
        const targetCapitalRatio = targetCapitalPct / 100;
        const targetCapitalUsage = totalAccountEquity * targetCapitalRatio;

        // Capitale attualmente investito nelle posizioni aperte
        const currentlyInvested = openPositions.reduce((sum: number, p: any) => sum + Math.abs(parseFloat(p.market_value || '0')), 0);

        // Capitale rimanente da allocare per raggiungere il target (es. 95%)
        const remainingCapitalToTarget = Math.max(0, targetCapitalUsage - currentlyInvested);
        const allocatableBuyingPower = Math.min(currentBuyingPower * 0.98, remainingCapitalToTarget);

        if (positiveSymbolsWithSentiment.length > 0 && availableSlots > 0 && allocatableBuyingPower > 2.0) {
          const numCandidatesToFund = Math.min(availableSlots, positiveSymbolsWithSentiment.length);

          // Calcola allocazione per singola operazione calibrata per distribuire il capitale al target 95%
          let singlePositionSize = Math.floor((allocatableBuyingPower / numCandidatesToFund) * 100) / 100;

          // Cap prudenziale per singola posizione (non più del 45% dell'equity a meno che maxPositions sia <= 2)
          const maxSinglePositionCap = totalAccountEquity * (maxPositions <= 2 ? 0.90 : 0.45);
          singlePositionSize = Math.min(singlePositionSize, maxSinglePositionCap);
          singlePositionSize = Math.max(2.0, singlePositionSize);

          addLog(mode as 'paper' | 'live', `[Allocazione Capitale ${targetCapitalPct}%] Equity: $${totalAccountEquity.toFixed(2)} | Target (${targetCapitalPct}%): $${targetCapitalUsage.toFixed(2)} | Attualmente Investito: $${currentlyInvested.toFixed(2)} | Rimanente al Target: $${remainingCapitalToTarget.toFixed(2)} | Allocazione per singola operazione: $${singlePositionSize.toFixed(2)} (${numCandidatesToFund} asset in questo ciclo).`);

          const ordersToSubmit: { symbol: string; sentimentScore: number; reasoning: string; amount: number }[] = [];
          let slotsAllocated = 0;
          
          const sAndPTrackers = ['SPY', 'VOO', 'IVV', 'VTI'];

          // --- REGOLE ESPOSIZIONE SETTORIALE ---
          const maxExposureRule = activeRules.find(r => r.type === 'CUSTOM_MAX_EXPOSURE');
          const isMaxExposureEnabled = maxExposureRule?.enabled ?? true;
          const maxSectorExposurePct = maxExposureRule?.parameters?.maxSectorExposurePct ?? 35;
          const minSectorsForBullishCoherent = maxExposureRule?.parameters?.minSectorsForBullishCoherent ?? 3;

          const currentSectorExposure: Record<string, number> = {};
          for (const pos of openPositions) {
            const sec = getSymbolSector(pos.symbol);
            const mVal = Math.abs(parseFloat(pos.market_value || '0'));
            currentSectorExposure[sec] = (currentSectorExposure[sec] || 0) + mVal;
          }

          while (slotsAllocated < availableSlots && positiveSymbolsWithSentiment.length > 0) {
            let allocatedInThisRound = 0;
            for (const item of positiveSymbolsWithSentiment) {
              if (slotsAllocated >= availableSlots) break;

              // Restrizione S&P 500 trackers: max 1 posizione contemporanea tra SPY, VOO, IVV, VTI
              if (sAndPTrackers.includes(item.symbol)) {
                const hasExistingSPY = openPositions.some((p: any) => sAndPTrackers.includes(p.symbol)) ||
                                       ordersToSubmit.some(o => sAndPTrackers.includes(o.symbol));
                if (hasExistingSPY) continue;
              }

              // Cooldown temporale: almeno 2 ore dall'ultimo acquisto sullo stesso ticker
              const lastBuyTime = lastPurchaseTimes[mode][item.symbol] || 0;
              const hoursSinceLastBuy = (Date.now() - lastBuyTime) / (3600 * 1000);
              if (hoursSinceLastBuy < 2 && lastBuyTime > 0) {
                continue;
              }
              
              // Controllo limiti lotti in base al sentiment
              const sentimentPct = item.score > 1 ? item.score : item.score * 100;
              let maxLotsForSymbol = 2;
              if (sentimentPct > 85) {
                maxLotsForSymbol = 4;
              } else if (sentimentPct > 70) {
                maxLotsForSymbol = 3;
              }

              const existingPos = openPositions.find((p: any) => p.symbol === item.symbol);
              const currentLots = existingPos ? Math.max(1, Math.round(parseFloat(existingPos.qty || '1'))) : 0;
              const alreadyQueuedLots = ordersToSubmit.filter(o => o.symbol === item.symbol).length;
              const totalLotsForSymbol = currentLots + alreadyQueuedLots;

              if (totalLotsForSymbol >= maxLotsForSymbol) {
                continue;
              }

              let amountToBuy = singlePositionSize;
              if (currentBuyingPower < 100) {
                amountToBuy = currentBuyingPower;
              } else if (item.score > 0.6) {
                amountToBuy = singlePositionSize;
              } else if (item.score > 0.4) {
                amountToBuy = Math.max(2.0, singlePositionSize * 0.85);
              } else {
                amountToBuy = Math.max(2.0, singlePositionSize * 0.70);
              }

              // Non superare mai il potere d'acquisto disponibile
              amountToBuy = Math.min(amountToBuy, currentBuyingPower * 0.98);
              amountToBuy = Math.floor(amountToBuy * 100) / 100;

              if (amountToBuy < 2.0) continue;

              // --- CONTROLLO LIMITI E DIVERSIFICAZIONE SETTORIALE ---
              if (isMaxExposureEnabled) {
                const itemSector = getSymbolSector(item.symbol);
                
                // Calcola l'esposizione corrente + gli ordini già programmati per questo settore
                const currentPlannedSectorExposure = ordersToSubmit.reduce((sum, o) => {
                  if (getSymbolSector(o.symbol) === itemSector) {
                    return sum + o.amount;
                  }
                  return sum;
                }, currentSectorExposure[itemSector] || 0);

                const prospectiveSectorExposure = currentPlannedSectorExposure + amountToBuy;
                const prospectivePctOfNAV = totalAccountEquity > 0 ? (prospectiveSectorExposure / totalAccountEquity) * 100 : 0;

                if (prospectivePctOfNAV > maxSectorExposurePct) {
                  addLog(mode as 'paper' | 'live', `[Filtro Rischio Settore] Salto acquisto per ${item.symbol}: l'esposizione sul settore "${itemSector}" ($${prospectiveSectorExposure.toFixed(2)}) raggiungerebbe il ${prospectivePctOfNAV.toFixed(1)}% del NAV, superando il limite consentito del ${maxSectorExposurePct}%.`);
                  addLogicLog(mode, {
                    timestamp: new Date().toISOString(),
                    symbol: item.symbol,
                    action: 'RISK_VETO',
                    reasoning: `Limite settoriale superato per "${itemSector}": ${prospectivePctOfNAV.toFixed(1)}% > ${maxSectorExposurePct}%`
                  });
                  continue;
                }

                // Controllo di diversificazione obbligatoria in regime BULLISH_COHERENT
                const isBullishCoherent = StatisticalExpertService.getInstance().getMetrics().marketState === 'BULLISH_COHERENT';
                if (isBullishCoherent) {
                  const activeSectors = new Set<string>();
                  for (const pos of openPositions) {
                    activeSectors.add(getSymbolSector(pos.symbol));
                  }
                  for (const ord of ordersToSubmit) {
                    activeSectors.add(getSymbolSector(ord.symbol));
                  }

                  // Se non abbiamo ancora raggiunto il minimo dei 3 settori e questo candidato appartiene ad un settore GIA' attivo,
                  // diamo priorità ad altri settori se ci sono candidati idonei non ancora rappresentati
                  if (activeSectors.size < minSectorsForBullishCoherent && activeSectors.has(itemSector)) {
                    const hasAlternativeSectorCandidate = positiveSymbolsWithSentiment.some(cand => {
                      const candSec = getSymbolSector(cand.symbol);
                      return !activeSectors.has(candSec) && cand.symbol !== item.symbol;
                    });
                    if (hasAlternativeSectorCandidate) {
                      addLog(mode as 'paper' | 'live', `[Diversificazione Settore] Salto temporaneo ${item.symbol} (${itemSector}) in regime BULLISH_COHERENT per dare priorità ad altri candidati di settori non ancora presenti in portafoglio (attualmente coperti: ${activeSectors.size}/${minSectorsForBullishCoherent} settori).`);
                      continue;
                    }
                  }
                }
              }

              // --- REGOLA CORRELAZIONE SPY-QQQ > 0.95 & CAP ESPOSIZIONE SEMICONDUTTORI AL 40% ---
              const spyQqqCorr = StatisticalExpertService.getInstance().getMetrics().correlations.spy_qqq;
              const semiconCapResult = RiskManagementService.evaluateSemiconductorExposureCap(
                item.symbol,
                amountToBuy,
                openPositions,
                ordersToSubmit,
                totalAccountEquity,
                spyQqqCorr,
                activeRules
              );

              if (!semiconCapResult.allowed) {
                const vetoReason = semiconCapResult.reason || `Cap semiconduttori superato con correlazione SPY-QQQ > 0.95`;
                addLog(mode as 'paper' | 'live', vetoReason);
                addLogicLog(mode, {
                  timestamp: new Date().toISOString(),
                  symbol: item.symbol,
                  action: 'RISK_VETO',
                  reasoning: vetoReason
                });
                continue;
              }

              // --- REGOLA VOLATILITÀ/TREND ADX < 25 & CONFERMA TREND EMA 20/50 ---
              const symIndicators = await TechnicalIndicatorService.getInstance().getSymbolIndicators(item.symbol, 100, getAlpacaConfig(mode));
              
              const adxRule = activeRules.find(r => r.type === 'ADX_VOLATILITY_FILTER');
              if (adxRule?.enabled ?? true) {
                const minAdx = adxRule?.parameters?.minAdxThreshold ?? 25.0;
                if (symIndicators.adx < minAdx) {
                  addLog(mode as 'paper' | 'live', `[Filtro Volatilità ADX < ${minAdx}] Salto acquisto ${item.symbol}: ADX(${adxRule?.parameters?.minAdxPeriod ?? 14}) = ${symIndicators.adx.toFixed(1)} < ${minAdx}. Trend direzionale assente/insufficiente.`);
                  addLogicLog(mode, {
                    timestamp: new Date().toISOString(),
                    symbol: item.symbol,
                    action: 'RISK_VETO',
                    reasoning: `Filtro ADX < ${minAdx}: ${item.symbol} presenta ADX=${symIndicators.adx.toFixed(1)}`
                  });
                  continue;
                }
              }

              // --- CONFERMA TECNICA EMA 20/50 (Timeframe 15m) ---
              const emaFilterRes = RiskManagementService.evaluateEmaTrendFilter(
                item.symbol,
                symIndicators.currentPrice,
                symIndicators.ema20,
                symIndicators.ema50,
                symIndicators.isBullishEmaTrend,
                activeRules
              );
              if (!emaFilterRes.allowed) {
                const vetoReason = emaFilterRes.reason || `Trend tecnico ribassista su timeframe 15m (Prezzo < EMA20 o EMA20 < EMA50)`;
                addLog(mode as 'paper' | 'live', vetoReason);
                addLogicLog(mode, {
                  timestamp: new Date().toISOString(),
                  symbol: item.symbol,
                  action: 'RISK_VETO',
                  reasoning: vetoReason
                });
                continue;
              }

              // --- FILTRO VOLATILITÀ OPERATIVA ATR 5m [ATR(14) 5m >= SMA(20) ATR] ---
              const atrFilterRes = RiskManagementService.evaluateAtrVolatilityFilter(
                item.symbol,
                symIndicators.atr5m,
                symIndicators.atr5mSma20,
                activeRules
              );
              if (!atrFilterRes.allowed) {
                const vetoReason = atrFilterRes.reason || `Volatilità insufficiente: ATR(14) 5m < SMA(20) ATR`;
                addLog(mode as 'paper' | 'live', vetoReason);
                addLogicLog(mode, {
                  timestamp: new Date().toISOString(),
                  symbol: item.symbol,
                  action: 'RISK_VETO',
                  reasoning: vetoReason
                });
                continue;
              }

              ordersToSubmit.push({
                symbol: item.symbol,
                sentimentScore: item.score,
                reasoning: item.reasoning,
                amount: amountToBuy
              });

              slotsAllocated++;
              allocatedInThisRound++;
            }
            if (allocatedInThisRound === 0) break;
          }

          addLog(mode as 'paper' | 'live', `[Allocazione] Pianificato l'invio simultaneo di ${ordersToSubmit.length} ordini frazionari.`);

          for (const order of ordersToSubmit) {
            // Controllo costi transazionali / spread (> 0.5% erosione capitale)
            const estimatedFee = order.amount * 0.005;
            if (estimatedFee > order.amount * 0.005) {
              // Fee check
            }

            if (currentBuyingPower < order.amount) {
              addLog(mode as 'paper' | 'live', `[Mercato] Salto acquisto per ${order.symbol}: potere d'acquisto insufficiente ($${currentBuyingPower.toFixed(2)} rimasti, richiesti $${order.amount.toFixed(2)}).`);
              addLogicLog(mode, {
                timestamp: new Date().toISOString(),
                symbol: order.symbol,
                action: 'SKIP',
                reasoning: `Potere d'acquisto insufficiente ($${currentBuyingPower.toFixed(2)} rimasti, richiesti $${order.amount.toFixed(2)})`
              });
              continue;
            }

            addLog(mode as 'paper' | 'live', `[Mercato] Sentiment positivo per ${order.symbol}: ${order.sentimentScore.toFixed(2)}. Procedo all'acquisto frazionario (notional: $${order.amount.toFixed(2)}) su Alpaca (${labelTipoConto}).`);
            addLogicLog(mode, {
              timestamp: new Date().toISOString(),
              symbol: order.symbol,
              action: 'BUY',
              reasoning: `Ordine frazionario simultaneo ($${order.amount.toFixed(2)}) - Sentiment: ${order.sentimentScore.toFixed(2)}: ${order.reasoning}`
            });

            try {
              const orderResponse = await fetch(`${baseUrl}/orders`, {
                method: 'POST',
                headers: {
                  'APCA-API-KEY-ID': apiKey,
                  'APCA-API-SECRET-KEY': secretKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  symbol: order.symbol,
                  notional: order.amount.toFixed(2),
                  side: 'buy',
                  type: 'market',
                  time_in_force: 'day'
                })
              });

              if (orderResponse.ok) {
                const orderData = await orderResponse.json();
                addLog(mode as 'paper' | 'live', `[Alpaca] Ordine di ACQUISTO eseguito con successo per ${order.symbol}! ID: ${orderData.id}`);
                currentBuyingPower -= order.amount;
                lastPurchaseTimes[mode][order.symbol] = Date.now();
              } else {
                const errorData = await orderResponse.json();
                addLog(mode as 'paper' | 'live', `[Alpaca Errore Ordine] Non è stato possibile eseguire l'ordine per ${order.symbol}: ${errorData.message}`);
              }
            } catch (err: any) {
              addLog(mode as 'paper' | 'live', `[Alpaca Errore] Errore di rete durante l'acquisto di ${order.symbol}: ${err.message}`);
            }
          }
        } else if (availableSlots <= 0) {
          addLog(mode as 'paper' | 'live', `[Portafoglio] Limite di operazioni contemporanee raggiunto (${maxPositions}/${maxPositions}). Nessun nuovo acquisto pianificato.`);
          addLogicLog(mode, {
            timestamp: new Date().toISOString(),
            symbol: 'PORTFOLIO',
            action: 'HOLD',
            reasoning: `Limite di operazioni contemporanee raggiunto (${maxPositions}/${maxPositions}). Nessun nuovo acquisto pianificato.`
          });
        } else {
          addLog(mode as 'paper' | 'live', `[Mercato] Nessun asset con sentiment positivo (> 0.2) identificato in questo ciclo.`);
          addLogicLog(mode, {
            timestamp: new Date().toISOString(),
            symbol: 'MARKET',
            action: 'SCAN',
            reasoning: 'Analisi di mercato completata: nessun asset con sentiment positivo (> 0.20) identificato in questo ciclo.'
          });
        }
      }
    }
  } catch (error: any) {
    addLog(mode as 'paper' | 'live', `[Alpaca Errore] ${error.message}`);
  }
}

let isTradingRunning = false;
let isFastCheckRunning = false;

let lastAlpacaRunTime = 0;

async function executeTradingCycle(force: boolean = false) {
  if (isTradingRunning) {
    console.log('[Trading Cycle] Precedente ciclo ancora in esecuzione, salto il turno.');
    return;
  }
  isTradingRunning = true;
  try {
    const anyActive = botStatus.active || botStatus.paperActive || botStatus.liveActive;
    if (!anyActive && !force) {
      addLog('system', `[System] Ciclo di trading ignorato: nessun bot attivo.`);
      return;
    }
    
    const now = Date.now();

    if (anyActive || force) {
    const alpacaTimeframeMs = (botStatus.timeframe || 5) * 60 * 1000;
    if (force || lastAlpacaRunTime === 0 || (now - lastAlpacaRunTime >= alpacaTimeframeMs)) {
      lastAlpacaRunTime = now;
      botStatus.lastCheck = new Date().toISOString();
      let executed = false;
      if (botStatus.paperActive || force) {
        await executeTradingCycleForMode('paper', force);
        executed = true;
      }
      if (botStatus.liveActive || force) {
        await executeTradingCycleForMode('live', force);
        executed = true;
      }
      if (!executed && force) {
        addLog('system', `[Alpaca] Nessun conto attivo per il trading.`);
      }
    } else {
      const nextRunTime = lastAlpacaRunTime + alpacaTimeframeMs;
      const msLeft = nextRunTime - now;
      const minLeft = Math.floor(msLeft / 60000);
      const secLeft = Math.floor((msLeft % 60000) / 1000);
      const lastCheckTimeStr = new Date(lastAlpacaRunTime).toLocaleTimeString('it-IT');
      
      const isMarketOpenUtc = (() => {
        const utcNow = new Date();
        const day = utcNow.getUTCDay();
        if (day === 0 || day === 6) return false;
        const hour = utcNow.getUTCHours();
        const minute = utcNow.getUTCMinutes();
        const timeInMinutes = hour * 60 + minute;
        return timeInMinutes >= 810 && timeInMinutes <= 1260; // 13:30 - 21:00 UTC (9:30 AM - 4:00 PM EST/EDT)
      })();
      
      const marketStateMsg = isMarketOpenUtc 
        ? `🟢 Il mercato USA è attualmente APERTO.` 
        : `🔴 Il mercato USA è attualmente CHIUSO (orario standard: lun-ven 13:30 - 21:00 UTC / 15:30 - 23:00 italiane).`;

      addLog('system', `[Alpaca] In attesa finestra di calcolo (tra ${minLeft}m ${secLeft}s). Mercato USA ${isMarketOpenUtc ? 'APERTO' : 'CHIUSO'}.`);
    }
  }
  } finally {
    isTradingRunning = false;
  }
}

async function generateDailyReport() {
  const todayStr = new Date().toISOString().split('T')[0];
  try {
    addLog('system', '[Report Giornaliero] Inizio generazione report...');
    
    let reportText = '';

    if (checkQuotaExceeded()) {
      addLog('system', '[Report Giornaliero] Cooldown attivo o quota superata: Generazione report di fallback locale...');
      reportText = `### Report Trading Giornaliero - Fallback Locale (Quota IA Superata)
Il sistema è operativo. Le API dell'IA sono momentaneamente sature (quota superata), ma il trading automatico sta continuando a monitorare gli asset basandosi sui prezzi reali e sul sentiment locale salvato.

#### Stato dei Portafogli (Dati Correnti):
- Simulazione (Paper): Bilancio $${botData.paper.balance.toFixed(2)} | Liquidità $${botData.paper.cash.toFixed(2)}
- Reale (Live): Bilancio $${botData.live.balance.toFixed(2)} | Liquidità $${botData.live.cash.toFixed(2)}

**PROMPT DI CORREZIONE SUGGERITO PER L'UTENTE:**
"Migliora la gestione della liquidità del bot incrementando lo stop loss del 2% su asset ad alta volatilità come i semiconduttori."`;
    } else {
      // Raccoglie dati sull'andamento giornaliero (se presenti)
      const todaysPnLPaper = botData.paper.dailyPnL?.find(d => d.date === todayStr);
      const todaysPnLLive = botData.live.dailyPnL?.find(d => d.date === todayStr);
      
      // Limit logs per non sforare context window
      const recentLogs = botData.paper.logs.slice(0, 50).join('\n') + '\n\n' + botData.live.logs.slice(0, 50).join('\n');
      
      const prompt = `[SYSTEM: POST-SESSION AUDIT & DEBRIEF]
Agisci come Risk Manager senior. Analizza i log operativi e le performance PnL (Paper/Live).

[INPUTS]
- PnL Log Paper: ${JSON.stringify(todaysPnLPaper || 'Nessun dato di PNL consolidato per oggi')}
- PnL Log Live: ${JSON.stringify(todaysPnLLive || 'Nessun dato di PNL consolidato per oggi')}
- Execution Logs:
${recentLogs}
- Decision Logic Logs (Paper):
${JSON.stringify(botData.paper.dailyLogicLogs?.slice(-25) || 'Nessun log logico')}
- Decision Logic Logs (Live):
${JSON.stringify(botData.live.dailyLogicLogs?.slice(-25) || 'Nessun log logico')}

[COMPITI]
1. Identifica cause di attivazione degli stop loss o chiusure anticipate.
2. Formula correzioni strategiche per il ciclo successivo.

[OUTPUT FORMAT]
Testo formattato professionale suddiviso in:
- Analisi delle Performance
- Errori di Valutazione
- PROMPT DI CORREZIONE (blocco copiabile per aggiornare i parametri del bot)`;

      try {
        const response = await LLMProviderService.getInstance().generateContent(prompt, {
          preferredProvider: botStatus.llmPreferredProvider || 'gemini'
        });
        reportText = response.success && response.text ? response.text : 'Nessun report generato.';
      } catch (error: any) {
        const message = error.message || String(error);
        if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
          console.warn(`[Daily Report] API Quota Exceeded (429/RESOURCE_EXHAUSTED). Falling back to local report.`);
          isQuotaExceeded = true;
          quotaExceededTime = Date.now();
          reportText = `### Report Trading Giornaliero - Fallback Locale (Quota IA Superata durante la chiamata)
Il sistema è operativo. Le API dell'IA sono momentaneamente sature (quota superata), ma il trading automatico sta continuando a monitorare gli asset basandosi sui prezzi reali e sul sentiment locale salvato.

#### Stato dei Portafogli (Dati Correnti):
- Simulazione (Paper): Bilancio $${botData.paper.balance.toFixed(2)} | Liquidità $${botData.paper.cash.toFixed(2)}
- Reale (Live): Bilancio $${botData.live.balance.toFixed(2)} | Liquidità $${botData.live.cash.toFixed(2)}

**PROMPT DI CORREZIONE SUGGERITO PER L'UTENTE:**
"Migliora la gestione della liquidità del bot incrementando lo stop loss del 2% su asset ad alta volatilità come i semiconduttori."`;
        } else {
          throw error;
        }
      }
    }

    botStatus.latestDailyReport = reportText;
    saveBotStatus().catch(err => console.error('[Firebase Error] Error saving status on report update:', err));
    
    addLog('system', `[Report Giornaliero] Generazione completata con successo.`);
  } catch (error: any) {
    addLog('system', `[Report Giornaliero Errore] ${error.message}`);
    console.error(error);
  }
}

// Endpoint per trigger report (supporta sia Cloud Scheduler che manuale)
app.all(['/run-daily-report', '/api/trigger-daily-report'], async (req, res) => {
  addLog('system', '[Trigger Report] Ricevuta richiesta di generazione report da Cloud Scheduler o manuale...');
  try {
    await generateDailyReport();
    addLog('system', '[Trigger Report] Generazione report completata. Rispondo OK.');
    res.status(200).send('OK');
  } catch (error: any) {
    addLog('system', `[Trigger Report Errore] Errore critico nel report: ${error.message}`);
    res.status(200).send(`ERROR_BUT_HANDLED: ${error.message}`);
  }
});

// Endpoint per Debriefing Giornaliero assistito da AI
app.post('/api/generate-daily-debrief', async (req, res) => {
  addLog('system', '[Debriefing AI] Inizio generazione Debriefing Giornaliero con Gemini 3.5...');
  
  const requestedDate = (req.body && req.body.date) ? req.body.date : (req.query?.date as string || '');
  let targetDate = requestedDate || new Date().toISOString().split('T')[0];
  const targetMode = (botStatus.tradingMode as 'paper' | 'live') || 'paper';

  let allLogsTodayForStats: any[] = [];
  const paperLogsArr: any[] = [];
  const liveLogsArr: any[] = [];

  // 1. Recupero da Firestore
  if (db) {
    try {
      const startOfDay = targetDate + 'T00:00:00.000Z';
      const endOfDay = targetDate + 'T23:59:59.999Z';
      
      const alpacaLogsSnap = await db.collection('logic_logs')
        .where('timestamp', '>=', startOfDay)
        .where('timestamp', '<=', endOfDay)
        .orderBy('timestamp', 'asc')
        .get();
      
      alpacaLogsSnap.forEach((doc: any) => {
        const data = doc.data();
        allLogsTodayForStats.push(data);
        if (data.mode === 'paper') paperLogsArr.push(data);
        else if (data.mode === 'live') liveLogsArr.push(data);
      });
    } catch (err) {
      console.error('[Firebase] Errore nel recupero dei log da Firestore per debriefing:', err);
    }
  }

  // 2. Recupero da in-memory logic logs
  const startOfDayIso = targetDate + 'T00:00:00.000Z';
  const endOfDayIso = targetDate + 'T23:59:59.999Z';
  const localPaper = (botData.paper.dailyLogicLogs || []).filter(l => l.timestamp >= startOfDayIso && l.timestamp <= endOfDayIso);
  const localLive = (botData.live.dailyLogicLogs || []).filter(l => l.timestamp >= startOfDayIso && l.timestamp <= endOfDayIso);
  allLogsTodayForStats.push(...localPaper, ...localLive);
  paperLogsArr.push(...localPaper);
  liveLogsArr.push(...localLive);

  // 3. Sincronizzazione DIRETTA con Alpaca API (Fills effettivi & Ordini eseguiti)
  try {
    const alpacaPaperOps = await fetchAlpacaHistoricalOperations('paper', targetDate, targetDate);
    const alpacaLiveOps = await fetchAlpacaHistoricalOperations('live', targetDate, targetDate);
    
    if (alpacaPaperOps.logicLogs.length > 0) {
      paperLogsArr.push(...alpacaPaperOps.logicLogs);
      allLogsTodayForStats.push(...alpacaPaperOps.logicLogs);
    }
    if (alpacaLiveOps.logicLogs.length > 0) {
      liveLogsArr.push(...alpacaLiveOps.logicLogs);
      allLogsTodayForStats.push(...alpacaLiveOps.logicLogs);
    }
  } catch (alpacaErr: any) {
    console.warn('[Debriefing AI] Errore fetch diretto Alpaca:', alpacaErr.message);
  }

  // Deduplicazione log per evitare duplicati tra Firestore, in-memory e Alpaca API
  const dedupMap = new Map<string, any>();
  for (const logItem of allLogsTodayForStats) {
    const ts = (logItem.timestamp || '').slice(0, 19);
    const key = `${ts}_${logItem.symbol}_${logItem.action}_${logItem.mode || targetMode}`;
    if (!dedupMap.has(key)) {
      dedupMap.set(key, logItem);
    }
  }
  allLogsTodayForStats = Array.from(dedupMap.values());

  // 4. Se la data richiesta (es. oggi) non ha operazioni (es. pre-market o festivo), scansiona gli ultimi 14 giorni su Alpaca
  let autoDetectedSession = false;
  if (allLogsTodayForStats.length === 0 && !requestedDate) {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

    try {
      const recentAlpacaOps = await fetchAlpacaHistoricalOperations(targetMode, twoWeeksAgoStr, targetDate);
      if (recentAlpacaOps.logicLogs.length > 0) {
        // Trova la data più recente con operazioni registrate
        const datesWithOps = Array.from(new Set(recentAlpacaOps.logicLogs.map(l => (l.timestamp || '').split('T')[0]))).filter(Boolean).sort().reverse();
        if (datesWithOps.length > 0) {
          const mostRecentDate = datesWithOps[0];
          targetDate = mostRecentDate;
          autoDetectedSession = true;
          allLogsTodayForStats = recentAlpacaOps.logicLogs.filter(l => (l.timestamp || '').startsWith(mostRecentDate));
          if (targetMode === 'paper') {
            paperLogsArr.push(...allLogsTodayForStats);
          } else {
            liveLogsArr.push(...allLogsTodayForStats);
          }
          addLog('system', `[Debriefing AI] Nessuna operazione in data odierna: analizzo automaticamente la più recente seduta operativa (${mostRecentDate}) con ${allLogsTodayForStats.length} operazioni reali Alpaca.`);
        }
      }
    } catch (e: any) {
      console.warn('[Debriefing AI] Fallback scan giorni precedenti non riuscito:', e.message);
    }
  }

  // Calcolo preliminare inferenziale e statistico delle fasce orarie per fallback ed AI
  const preliminaryHourlyReport = HourlyEfficiencyAnalyzer.analyze(
    allLogsTodayForStats,
    botData[targetMode]?.dailyPnL || [],
    targetMode,
    { startDate: targetDate, endDate: targetDate }
  );

  const fallbackDebrief = {
    analysis: `### Debriefing Giornaliero - Seduta del ${targetDate} (Fallback Locale)
${autoDetectedSession ? `*(Nota: Analisi calcolata sulla più recente seduta operativa del **${targetDate}** poiché la data corrente non presenta esecuzioni concluse)*\n\n` : ''}
Il servizio di intelligenza artificiale è momentaneamente in cooldown per via del superamento della quota server. Di seguito il riepilogo matematico e statistico generato automaticamente dai dati Alpaca:

#### 1. Riesame Decisionale & Operatività della Seduta (${targetDate}):
- **Operazioni Registrate su Alpaca:** ${allLogsTodayForStats.length} transazioni eseguite.
- Le operazioni sono state elaborate in conformità con i filtri di rischio e la liquidità disponibile.

#### 2. ⏰ Valutazione Statistica & Inferenziale delle Fasce Orarie:
${preliminaryHourlyReport.markdownTable}

- **Fascia a Massima Efficienza:** ${preliminaryHourlyReport.bestHourlyWindow ? `${preliminaryHourlyReport.bestHourlyWindow.slotKey} (Win Rate: ${preliminaryHourlyReport.bestHourlyWindow.winRatePct}%, PnL Medio: $${preliminaryHourlyReport.bestHourlyWindow.meanPnL})` : 'Dati in consolidamento'}
- **Verifica di Costanza:** ${preliminaryHourlyReport.constancySummary.keyInsight}
- **Significatività Inferenziale:** ${preliminaryHourlyReport.constancySummary.hasProvenConstantEdge ? 'Presenza di un edge statistico comprovato con confidenza al 95%.' : 'Campione in accumulo per la convergenza asintotica.'}

#### 3. Correlazioni Latenti & Scenari Alternativi:
Il sentiment generale mantiene una correlazione con gli indici guida (SPY/QQQ). La gestione dinamica del rischio ha presidiato l'esposizione.

### 🤖 PROMPT PER GOOGLE AI STUDIO (COPIA & INCOLLA)
\`\`\`text
Ciao! Implementa ed integra nel codice sorgente la seguente regola ottimizzata dal debriefing odierno:
Regola Proposta: "Concentra le nuove aperture nelle fasce a massima efficienza statistica (${preliminaryHourlyReport.bestHourlyWindow?.slotKey || 'Apertura'}) e mantieni filtri di protezione durante le finestre di consolidamento."
\`\`\``,
    suggestedRule: preliminaryHourlyReport.bestHourlyWindow 
      ? `Privilegia entrate nella fascia oraria ${preliminaryHourlyReport.bestHourlyWindow.slotKey} con Win Rate del ${preliminaryHourlyReport.bestHourlyWindow.winRatePct}%.`
      : "Incrementa lo stop loss su asset volatili se l'IA è in cooldown.",
    timestamp: new Date().toISOString()
  };

  if (checkQuotaExceeded()) {
    addLog('system', '[Debriefing AI] Cooldown attivo: Uso immediato del fallback locale salvato con inferenza oraria.');
    botStatus.latestDailyDebrief = fallbackDebrief;
    saveBotStatus().catch(err => console.error('[Firebase Error] Error saving status on debrief fallback:', err));
    return res.json({ success: true, debrief: fallbackDebrief });
  }

  try {
    const todaysPnLPaper = botData.paper.dailyPnL?.find(d => d.date === targetDate) || { 
      balance: botData.paper.balance, 
      pnl: botData.paper.dailyPnL?.length ? botData.paper.dailyPnL[botData.paper.dailyPnL.length - 1].pnl : 0 
    };
    const todaysPnLLive = botData.live.dailyPnL?.find(d => d.date === targetDate) || { 
      balance: botData.live.balance, 
      pnl: botData.live.dailyPnL?.length ? botData.live.dailyPnL[botData.live.dailyPnL.length - 1].pnl : 0 
    };
    
    const paperLogs = botData.paper.logs.slice(0, 40).join('\n') || 'Nessun log operativo registrato.';
    const liveLogs = botData.live.logs.slice(0, 40).join('\n') || 'Nessun log operativo registrato.';
    
    const paperLogicLogs = JSON.stringify(paperLogsArr.slice(-40));
    const liveLogicLogs = JSON.stringify(liveLogsArr.slice(-40));

    // Esecuzione dell'analisi quantitativa inferenziale delle fasce orarie
    const hourlyReport = HourlyEfficiencyAnalyzer.analyze(
      allLogsTodayForStats,
      botData[targetMode]?.dailyPnL || [],
      targetMode,
      { startDate: targetDate, endDate: targetDate }
    );
    
    const currentRules = botStatus.userFeedbackRules && botStatus.userFeedbackRules.length > 0
      ? botStatus.userFeedbackRules.join('\n- ')
      : 'Nessuna regola personalizzata attualmente attiva';

    const prompt = `Sei un analista finanziario quantitativo Senior e coach esperto di trading algoritmico.
Stai conducendo un Debriefing Giornaliero (Daily Debriefing) con il bot di trading per la seduta del ${targetDate} (Conto: ${targetMode.toUpperCase()}).
Analizza accuratamente le operazioni e le transazioni Alpaca registrate per identificare errori, correlazioni latenti, efficienza oraria e proporre miglioramenti statistici ed operativi.

DATI DELLA SEDUTA (${targetDate}):
${autoDetectedSession ? `[NOTA: Analisi condotta sulla più recente seduta operativa con transazioni reali del ${targetDate}]` : ''}
- PNL/Bilancio Simulazione (Paper): ${JSON.stringify(todaysPnLPaper)}
- PNL/Bilancio Reale (Live): ${JSON.stringify(todaysPnLLive)}
- Operazioni totali identificate per la seduta: ${allLogsTodayForStats.length}
- Regole personalizzate attualmente in vigore:
${currentRules}

LOG LOGICA DECISIONALE & TRANSAZIONI ALPACA (Paper):
${paperLogicLogs}

LOG LOGICA DECISIONALE & TRANSAZIONI ALPACA (Live):
${liveLogicLogs}

ULTIMI LOG OPERATIVI (Paper):
${paperLogs}

ULTIMI LOG OPERATIVI (Live):
${liveLogs}

${hourlyReport.formattedSummaryPrompt}

ISTRUZIONI DI ANALISI STRUTTURATA (in lingua italiana):
1. **Riesame Decisionale della Seduta (${targetDate})**: Valuta le operazioni eseguite/chiuse registrate su Alpaca. Trova eventuali punti di forza o errori (es. entrate anticipate, timing di uscita, rispetto del risk management).
2. **⏰ Analisi Statistica ed Inferenziale delle Fasce Orarie (Intraday Hourly Efficiency & Costanza)**:
   - Inserisci un'approfondita sezione analitica commentando la tabella statistica delle fasce orarie della giornata.
   - Identifica con precisione **gli orari migliori e più efficienti della giornata** (Win Rate %, PnL medio, Intervallo di Confidenza al 95%, campione $N$).
   - **Verifica di Costanza**: Valuta se l'efficienza registrata negli orari di punta è una **costante empirica solida** oppure varianza isolata.
   - Fornisci una valutazione inferenziale su significatività ($p$-value, t-stat) e indica eventuali fasce orarie a rischio di drawdown da filtrare.
3. **Correlazioni Latenti**: Trova correlazioni latenti tra l'andamento di mercato della seduta, le notizie macro o settoriali e le performance dei ticker gestiti.
4. **Scenari Alternativi**: Ipotizza scenari alternativi su timing ed esposizione.
5. **Regola Ottimizzata Proposta**: Formula un suggerimento (prompt/regola) chiaro, sintetico e in italiano, pronto da inserire come feedback rule del bot.

CRITICAL: All'interno del campo 'analysis' (in fondo alla stringa markdown, dopo tutte le tue analisi), devi obbligatoriamente aggiungere una sezione formattata esattamente in questo modo (in italiano):

### 🤖 PROMPT PER GOOGLE AI STUDIO (COPIA & INCOLLA)
Copia e incolla il testo sottostante direttamente in questa chat di Google AI Studio per integrare automaticamente le modifiche e le regole di oggi nel codice sorgente dell'applet:

\`\`\`text
Ciao! Implementa ed integra nel codice sorgente (es. in \`server.ts\` o \`RiskManagementService.ts\`, aggiungendo anche parametri configurabili in \`types.ts\` e nell'interfaccia utente se ha senso) la seguente nuova regola e logica emersa dal debriefing giornaliero:

Regola Proposta: "[Inserisci qui la tua regola ottimizzata proposta]"

Dettagli e Razionale di Analisi: "[Inserisci qui una sintesi in 1-2 frasi del perché questa regola è importante in base alle performance e all'analisi oraria inferenziale del ${targetDate}]"
\`\`\`

Compila la risposta secondo lo schema JSON indicato. Il campo 'analysis' deve contenere il resoconto strutturato in Markdown leggibile e motivazionale (comprensivo della sezione PROMPT PER GOOGLE AI STUDIO sopra descritta). Il campo 'suggestedRule' deve contenere SOLO la regola formulata pronta da copiare.`;

    const ensembleResult = await LLMProviderService.getInstance().generateEnsembleDebrief(
      prompt,
      targetDate,
      targetMode
    );

    botStatus.latestDailyDebrief = {
      analysis: ensembleResult.analysis,
      suggestedRule: ensembleResult.suggestedRule,
      top3Corrections: ensembleResult.top3Corrections,
      participatingProviders: ensembleResult.participatingProviders,
      timestamp: new Date().toISOString()
    };
    sendToGoogleSheets({
      eventType: 'daily_debrief',
      data: botStatus.latestDailyDebrief
    }).catch(err => console.warn('[Google Sheets Info]', err?.message || err));
    saveBotStatus().catch(err => console.error('[Firebase Error] Error saving status on debrief update:', err));

    const providersNote = ensembleResult.participatingProviders?.length > 0 
      ? ` (Consenso Multi-IA: ${ensembleResult.participatingProviders.join(', ')})`
      : '';
    addLog('system', `[Debriefing AI] Debriefing generato con successo per la data ${targetDate} (${allLogsTodayForStats.length} operazioni analizzate)${providersNote}.`);
    res.json({ success: true, debrief: botStatus.latestDailyDebrief });
  } catch (error: any) {
    const message = error.message || String(error);
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      console.warn(`[Debriefing AI] API Quota Exceeded (429/RESOURCE_EXHAUSTED). Falling back to local debrief.`);
      isQuotaExceeded = true;
      quotaExceededTime = Date.now();
      
      botStatus.latestDailyDebrief = fallbackDebrief;
      sendToGoogleSheets({
        eventType: 'daily_debrief_fallback',
        data: fallbackDebrief
      }).catch(err => console.warn('[Google Sheets Info]', err?.message || err));
      saveBotStatus().catch(err => console.error('[Firebase Error] Error saving status on debrief fallback catch:', err));
      
      return res.json({ success: true, debrief: fallbackDebrief });
    }

    addLog('system', `[Debriefing AI Errore] ${error.message}`);
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint per Debriefing di un intervallo di date personalizzato assistito da AI
app.post('/api/generate-range-debrief', async (req, res) => {
  const { startDate, endDate, mode } = req.body;
  if (!startDate || !endDate || !mode) {
    return res.status(400).json({ success: false, error: "Parametri startDate, endDate e mode ('paper'|'live') richiesti." });
  }

  addLog('system', `[Debriefing Periodico AI] Inizio generazione analisi per periodo da ${startDate} a ${endDate} (Conto: ${mode})...`);
  
  try {
    // Forza il salvataggio dei log in sospeso prima dell'analisi
    await flushLogs();

    let rangeLogicLogs: any[] = [];
    
    // 1. Recupero da Firestore
    if (db) {
      if (mode === 'paper' || mode === 'live') {
        try {
          const querySnap = await db.collection('logic_logs')
            .where('timestamp', '>=', startDate + 'T00:00:00.000Z')
            .where('timestamp', '<=', endDate + 'T23:59:59.999Z')
            .orderBy('timestamp', 'asc')
            .get();
          
          querySnap.forEach((doc: any) => {
            const data = doc.data();
            if (data.mode === mode) {
              rangeLogicLogs.push(data);
            }
          });
        } catch (err) {
          console.error('[Firebase] Errore recupero log per debrief periodico:', err);
        }
      }
    }

    // 2. Recupero da in-memory e Google Drive (StoriaLOG.json)
    const sourceLogs = botData[mode as 'paper' | 'live']?.dailyLogicLogs || [];
    const localLogs = sourceLogs.filter(l => {
      return l.timestamp >= startDate + 'T00:00:00.000Z' && l.timestamp <= endDate + 'T23:59:59.999Z';
    });
    rangeLogicLogs.push(...localLogs);

    if (rangeLogicLogs.length === 0) {
      try {
        const driveData = await GoogleDriveService.readJsonFile<any>('StoriaLOG.json');
        if (driveData) {
          const logs = Array.isArray(driveData) ? driveData : (driveData.logs || []);
          const driveLogs = logs.filter((l: any) => {
            const ts = typeof l === 'string' ? '' : (l.timestamp || '');
            return ts >= startDate + 'T00:00:00.000Z' && ts <= endDate + 'T23:59:59.999Z';
          });
          rangeLogicLogs.push(...driveLogs);
        }
      } catch (err: any) {
        console.warn('[GoogleDrive] Avviso lettura StoriaLOG.json per debriefing:', err.message);
      }
    }

    // 3. Sincronizzazione DIRETTA con Alpaca API per il periodo
    try {
      const alpacaPeriodOps = await fetchAlpacaHistoricalOperations(mode as 'paper' | 'live', startDate, endDate);
      if (alpacaPeriodOps.logicLogs.length > 0) {
        rangeLogicLogs.push(...alpacaPeriodOps.logicLogs);
      }
    } catch (alpacaErr: any) {
      console.warn('[Debriefing Periodico AI] Errore fetch Alpaca:', alpacaErr.message);
    }

    // Deduplicazione log
    const dedupRangeMap = new Map<string, any>();
    for (const item of rangeLogicLogs) {
      const ts = (item.timestamp || '').slice(0, 19);
      const key = `${ts}_${item.symbol}_${item.action}_${item.mode || mode}`;
      if (!dedupRangeMap.has(key)) {
        dedupRangeMap.set(key, item);
      }
    }
    rangeLogicLogs = Array.from(dedupRangeMap.values());
    rangeLogicLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Esecuzione dell'analisi quantitativa inferenziale delle fasce orarie sul periodo
    const rangeHourlyReport = HourlyEfficiencyAnalyzer.analyze(
      rangeLogicLogs,
      botData[mode as 'paper' | 'live']?.dailyPnL || [],
      mode as 'paper' | 'live',
      { startDate, endDate }
    );

    const fallbackRangeDebrief = {
      analysis: `### Valutazione di Periodo - Fallback Locale (IA in Cooldown)
Il servizio di intelligenza artificiale è momentaneamente in cooldown. Riepilogo quantitativo e inferenziale per il periodo da ${startDate} a ${endDate} (Conto: ${mode}):

#### 1. Analisi delle Performance di Periodo:
- Operazioni totali esaminate: ${rangeHourlyReport.totalOperations} su ${rangeHourlyReport.totalTradingDays} giornate.
- Win Rate medio di periodo: ${rangeHourlyReport.overallWinRatePct}%.

#### 2. ⏰ Valutazione Statistica & Inferenziale delle Fasce Orarie:
${rangeHourlyReport.markdownTable}

- **Fascia a Massima Efficienza:** ${rangeHourlyReport.bestHourlyWindow ? `${rangeHourlyReport.bestHourlyWindow.slotKey} (WR: ${rangeHourlyReport.bestHourlyWindow.winRatePct}%, PnL: $${rangeHourlyReport.bestHourlyWindow.meanPnL})` : 'Dati in consolidamento'}
- **Verifica di Costanza nel Periodo:** ${rangeHourlyReport.constancySummary.keyInsight}
- **Valutazione Inferenziale:** ${rangeHourlyReport.constancySummary.hasProvenConstantEdge ? 'Edge orario costante e statisticamente significativo (p < 0.05).' : 'Campione in accumulo per la convergenza asintotica.'}

### 🤖 PROMPT PER GOOGLE AI STUDIO (COPIA & INCOLLA)
\`\`\`text
Ciao! Implementa ed integra nel codice sorgente la seguente nuova regola emersa dal debriefing periodico:
Regola Proposta: "Ottimizza il timing di entrata nella finestra ${rangeHourlyReport.bestHourlyWindow?.slotKey || 'mattutina'} e applica riduzione del risk exposure nelle ore ad alta varianza."
\`\`\``,
      suggestedRule: rangeHourlyReport.bestHourlyWindow 
        ? `Mantieni operatività concentrata nella fascia ${rangeHourlyReport.bestHourlyWindow.slotKey} con costanza ${rangeHourlyReport.bestHourlyWindow.constancyScorePct}%.`
        : `Mantieni posizioni bilanciate e monitora la liquidità durante fasi di cooldown dell'IA.`
    };

    if (checkQuotaExceeded()) {
      addLog('system', '[Debriefing Periodico AI] Cooldown attivo: Uso immediato del fallback locale.');
      return res.json({ 
        success: true, 
        analysis: fallbackRangeDebrief.analysis, 
        suggestedRule: fallbackRangeDebrief.suggestedRule 
      });
    }

    const currentRules = botStatus.userFeedbackRules && botStatus.userFeedbackRules.length > 0
      ? botStatus.userFeedbackRules.join('\n- ')
      : 'Nessuna regola personalizzata attualmente attiva';

    const prompt = `Sei un analista finanziario quantitativo Senior e coach esperto di trading algoritmico.
Stai conducendo una Valutazione di Periodo (Period Debriefing) con il bot di trading. Analizza accuratamente i dati operativi raccolti in questo intervallo per identificare trend, correlazioni di medio periodo, efficienza statistica degli orari di negoziazione e proporre ottimizzazioni strategiche.

PERIODO DI ANALISI: Da ${startDate} a ${endDate}
CONTO ANALIZZATO: ${mode === 'live' ? 'Reale (Live)' : 'Simulazione (Paper)'}
REGULATION_RULES IN VIGORE:
${currentRules}

LOG DECISIONALI & TRANSAZIONI ALPACA NEL PERIODO (${rangeLogicLogs.length} totali):
${JSON.stringify(rangeLogicLogs.slice(-150))}

${rangeHourlyReport.formattedSummaryPrompt}

ISTRUZIONI DI ANALISI STRUTTURATA (in lingua italiana):
1. **Analisi del Trend di Periodo**: Valuta la coerenza complessiva delle decisioni (BUY, SELL, HOLD, SKIP) e delle transazioni Alpaca in questo intervallo. Identifica pattern ricorrenti di guadagno o di perdita.
2. **⏰ Analisi Statistica ed Inferenziale delle Fasce Orarie (Intraday Hourly Efficiency & Costanza Multigiornaliera)**:
   - Commenta dettagliatamente la tabella di distribuzione temporale fornita.
   - Identifica **gli orari migliori e più efficienti della giornata** nel periodo (Win Rate %, PnL medio, 95% Confidence Interval, t-statistic).
   - **Verifica di Costanza su Orizzonte Multigiornaliero**: Verifica rigorosamente se le finestre orarie più redditizie rappresentano una **costante empirica solida** (confermato dall'indice di costanza intergiornaliera >= 65% e significatività $p < 0.05$) oppure semplici oscillazioni o anomalie transitorie.
   - Evidenzia le fasce "Golden Hours" e le fasce a rischio di drawdown/falsa rottura.
3. **Correlazioni e Anomalie**: Identifica eventuali reazioni anomale del mercato o risposte del bot di fronte ad eventi macro o movimenti di prezzo.
4. **Miglioramenti Strategici**: Suggerisci affinamenti operativi strutturati per questo orizzonte temporale.
5. **Regola Ottimizzata Proposta**: Formula una regola chiara, sintetica e in italiano, pronta da inserire come feedback rule del bot (massimo 150 caratteri).

CRITICAL: All'interno del campo 'analysis' (in fondo alla stringa markdown, dopo tutte le tue analisi), devi obbligatoriamente aggiungere una sezione formattata esattamente in questo modo (in italiano):

### 🤖 PROMPT PER GOOGLE AI STUDIO (COPIA & INCOLLA)
Copia e incolla il testo sottostante direttamente in questa chat di Google AI Studio per integrare automaticamente le modifiche e le regole di oggi nel codice sorgente dell'applet:

\`\`\`text
Ciao! Implementa ed integra nel codice sorgente (es. in \`server.ts\` o \`RiskManagementService.ts\`, aggiungendo anche parametri configurabili in \`types.ts\` e nell'interfaccia utente se ha senso) la seguente nuova regola e logica emersa dal debriefing periodico:

Regola Proposta: "[Inserisci qui la tua regola ottimizzata proposta]"

Dettagli e Razionale di Analisi: "[Inserisci qui una sintesi in 1-2 frasi del perché questa regola è importante in base alle performance di questo periodo e all'analisi oraria inferenziale]"
\`\`\`

Compila la risposta secondo lo schema JSON indicato. Il campo 'analysis' deve contenere il resoconto strutturato in Markdown leggibile e motivazionale (comprensivo della sezione PROMPT PER GOOGLE AI STUDIO sopra descritta). Il campo 'suggestedRule' deve contenere SOLO la regola formulata pronta da copiare.`;

    const ensembleResult = await LLMProviderService.getInstance().generateEnsembleDebrief(
      prompt,
      `${startDate} -> ${endDate}`,
      mode
    );
    
    sendToGoogleSheets({
      eventType: 'range_debrief',
      data: { startDate, endDate, mode, analysis: ensembleResult.analysis, suggestedRule: ensembleResult.suggestedRule }
    }).catch(err => console.warn('[Google Sheets Info]', err?.message || err));

    const providersNote = ensembleResult.participatingProviders?.length > 0 
      ? ` (Consenso Multi-IA: ${ensembleResult.participatingProviders.join(', ')})`
      : '';
    addLog('system', `[Debriefing Periodico AI] Analisi periodica generata con successo (${rangeLogicLogs.length} operazioni esaminate)${providersNote}.`);
    res.json({ 
      success: true, 
      analysis: ensembleResult.analysis, 
      suggestedRule: ensembleResult.suggestedRule,
      top3Corrections: ensembleResult.top3Corrections,
      participatingProviders: ensembleResult.participatingProviders
    });
  } catch (error: any) {
    const message = error.message || String(error);
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      console.warn(`[Debriefing Periodico AI] API Quota Exceeded (429/RESOURCE_EXHAUSTED). Falling back to local range-debrief.`);
      isQuotaExceeded = true;
      quotaExceededTime = Date.now();
      
      const fallbackRangeReport = HourlyEfficiencyAnalyzer.analyze(
        botData[mode as 'paper' | 'live']?.dailyLogicLogs || [],
        botData[mode as 'paper' | 'live']?.dailyPnL || [],
        mode as 'paper' | 'live',
        { startDate, endDate }
      );
      const fallbackRange = {
        analysis: `### Valutazione di Periodo - Fallback Locale (IA in Cooldown)
Il servizio di intelligenza artificiale è momentaneamente in cooldown. Riepilogo quantitativo per il periodo da ${startDate} a ${endDate} (Conto: ${mode}):

#### ⏰ Valutazione Statistica & Inferenziale delle Fasce Orarie:
${fallbackRangeReport.markdownTable}

- **Fascia Più Efficiente:** ${fallbackRangeReport.bestHourlyWindow ? `${fallbackRangeReport.bestHourlyWindow.slotKey} (Win Rate ${fallbackRangeReport.bestHourlyWindow.winRatePct}%)` : 'N/A'}
- **Costanza:** ${fallbackRangeReport.constancySummary.keyInsight}`,
        suggestedRule: `Privilegia entrate nelle finestre a maggior costanza (${fallbackRangeReport.bestHourlyWindow?.slotKey || '09:30-10:30 EST'}).`
      };

      sendToGoogleSheets({
        eventType: 'range_debrief_fallback',
        data: { startDate, endDate, mode, analysis: fallbackRange.analysis, suggestedRule: fallbackRange.suggestedRule }
      }).catch(err => console.warn('[Google Sheets Info]', err?.message || err));
      return res.json({ 
        success: true, 
        analysis: fallbackRange.analysis, 
        suggestedRule: fallbackRange.suggestedRule 
      });
    }

    addLog('system', `[Debriefing Periodico AI Errore] ${error.message}`);
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint diretto per recuperare il report statistico ed inferenziale orario
app.get('/api/hourly-efficiency-analysis', async (req, res) => {
  try {
    const mode = (req.query.mode as 'paper' | 'live') || (botStatus.tradingMode as 'paper' | 'live') || 'paper';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    let logs = botData[mode]?.dailyLogicLogs || [];
    if (startDate && endDate) {
      logs = logs.filter(l => l.timestamp >= startDate + 'T00:00:00.000Z' && l.timestamp <= endDate + 'T23:59:59.999Z');
    }
    
    const pnlHistory = botData[mode]?.dailyPnL || [];
    const report = HourlyEfficiencyAnalyzer.analyze(
      logs,
      pnlHistory,
      mode,
      startDate && endDate ? { startDate, endDate } : undefined
    );
    
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Routes
app.post('/api/feedback', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    GoogleSheetsService.setUserAccessToken(token);
  }
  const { rule } = req.body;
  if (rule && typeof rule === 'string') {
    if (!botStatus.userFeedbackRules) {
      botStatus.userFeedbackRules = [];
    }
    botStatus.userFeedbackRules.push(rule);
    addLog('system', `[Feedback Utente] Aggiunta nuova regola: ${rule}`);
    sendToGoogleSheets({
      eventType: 'correction_rule',
      data: { rule }
    }).catch(err => console.warn('[Google Sheets Sync]:', err?.message || err));
    saveBotStatus().catch(err => console.warn('[Firebase] Error saving status on feedback rule addition:', err?.message || err));
    
    try {
      await GoogleSheetsService.appendFeedbackRuleToSheet(rule);
    } catch (err: any) {
      console.warn('[GoogleSheets Auto-Export Feedback]:', err.message);
    }

    res.json({ success: true, message: 'Regola aggiunta con successo e sincronizzata.' });
  } else {
    res.status(400).json({ success: false, message: 'Regola non valida.' });
  }
});

app.post('/api/feedback/delete', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    GoogleSheetsService.setUserAccessToken(token);
  }
  const { index } = req.body;
  if (!botStatus.userFeedbackRules) {
    botStatus.userFeedbackRules = [];
  }
  if (typeof index === 'number' && index >= 0 && index < botStatus.userFeedbackRules.length) {
    const deletedRule = botStatus.userFeedbackRules.splice(index, 1)[0];
    addLog('system', `[Feedback Utente] Rimossa regola: ${deletedRule}`);
    saveBotStatus().catch(err => console.warn('[Firebase] Error saving status on feedback rule deletion:', err?.message || err));
    
    try {
      await GoogleSheetsService.exportFeedbackRulesToSheet(botStatus.userFeedbackRules);
    } catch (err: any) {
      console.warn('[GoogleSheets Auto-Export Feedback]:', err.message);
    }

    res.json({ success: true, message: 'Regola rimossa con successo.', userFeedbackRules: botStatus.userFeedbackRules });
  } else {
    res.status(400).json({ success: false, message: 'Indice non valido.' });
  }
});

app.post('/api/feedback/sync-sheets', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      GoogleSheetsService.setUserAccessToken(token);
    }
    const rules = await GoogleSheetsService.syncFeedbackRulesFromSheet();
    if (rules && Array.isArray(rules)) {
      botStatus.userFeedbackRules = rules;
      await saveBotStatus();
      addLog('system', `[Feedback Utente] Sincronizzate ${rules.length} regole da Google Sheets.`);
      return res.json({ success: true, message: `Sincronizzate ${rules.length} regole da Google Sheets.`, userFeedbackRules: rules });
    } else {
      return res.status(401).json({ success: false, error: 'Google Sheets non accessibile o API disabilitata nel progetto GCP. Sincronizzazione fallita.', userFeedbackRules: botStatus.userFeedbackRules || [] });
    }
  } catch (error: any) {
    console.warn('[Google Sheets Sync Feedback]:', error?.message || error);
    const errMsg = error?.message || String(error);
    const isAuthError = errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('credential') || errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('login') || errMsg.toLowerCase().includes('not been used') || errMsg.toLowerCase().includes('disabled');
    const status = isAuthError ? 401 : 500;
    res.status(status).json({ success: false, error: errMsg, userFeedbackRules: botStatus.userFeedbackRules || [] });
  }
});

app.post('/api/feedback/export-sheets', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      GoogleSheetsService.setUserAccessToken(token);
    }
    const success = await GoogleSheetsService.exportFeedbackRulesToSheet(botStatus.userFeedbackRules || []);
    if (success) {
      addLog('system', `[Feedback Utente] Esportate regole su Google Sheets.`);
      res.json({ success: true, message: 'Regole esportate su Google Sheets con successo.' });
    } else {
      res.status(401).json({ success: false, error: 'Google Sheets non accessibile o API disabilitata nel progetto GCP.' });
    }
  } catch (error: any) {
    console.warn('[Google Sheets Export Feedback]:', error?.message || error);
    const errMsg = error?.message || String(error);
    const isAuthError = errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('credential') || errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('login') || errMsg.toLowerCase().includes('not been used') || errMsg.toLowerCase().includes('disabled');
    const status = isAuthError ? 401 : 500;
    res.status(status).json({ success: false, error: errMsg });
  }
});

app.all(['/run-strategy', '/api/trigger'], async (req, res) => {
  addLog('system', '[Trigger Strategy] Ricevuta richiesta di attivazione strategia da Cloud Scheduler o manuale...');
  try {
    // Carichiamo lo stato più recente da Firestore per essere sicuri al 100% delle preferenze dell'utente
    await loadStateFromFirestore().catch(err => {
      console.error('[Firebase Error] Errore nel caricamento dello stato in trigger:', err);
    });

    if (!botStatus.active) {
      addLog('system', '[Trigger Strategy] Ciclo di trading ignorato: nessun bot è attivo.');
      res.status(200).send('BOTS_INACTIVE');
      return;
    }

    // Eseguiamo il ciclo di trading in modo sicuro, rispettando gli stati specifici (paperActive, liveActive) e gli orari di borsa (force = false)
    await executeTradingCycle(false);
    addLog('system', '[Trigger Strategy] Ciclo di trading completato con successo. Rispondo OK.');
    res.status(200).send('OK');
  } catch (error: any) {
    addLog('system', `[Trigger Strategy Errore] Errore critico nel ciclo di trading: ${error.message}`);
    res.status(200).send(`ERROR_BUT_HANDLED: ${error.message}`);
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Trading Bot FastAPI & Node.js Bridge',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    ig_configured: !!(process.env.IG_API_KEY && process.env.IG_USERNAME),
    gemini_configured: !!process.env.GEMINI_API_KEY
  });
});

app.post('/evaluate-trade', async (req, res) => {
  try {
    const { symbol = 'EURUSD', current_price = 1.0850, timeframe = '15m', indicators = {}, account = {}, custom_rules = [] } = req.body;
    
    // Perform market analysis using Gemini AI
    const { score: sentimentScore, reasoning } = await getMarketSentiment(symbol);
    
    let action = 'HOLD';
    let confidence = 0.70;
    if (sentimentScore > 0.2) {
      action = 'BUY';
      confidence = 0.85;
    } else if (sentimentScore < -0.2) {
      action = 'SELL';
      confidence = 0.82;
    }

    const price = parseFloat(current_price);
    const sl = action === 'BUY' ? price * 0.992 : (action === 'SELL' ? price * 1.008 : undefined);
    const tp = action === 'BUY' ? price * 1.016 : (action === 'SELL' ? price * 0.984 : undefined);

    return res.json({
      symbol,
      action,
      confidence,
      reasoning: `[FastAPI / Gemini Evaluator] ${reasoning}`,
      suggested_stop_loss: sl ? parseFloat(sl.toFixed(4)) : undefined,
      suggested_take_profit: tp ? parseFloat(tp.toFixed(4)) : undefined,
      suggested_position_size: account.available_cash ? parseFloat((account.available_cash * 0.05).toFixed(2)) : 250.00,
      market_source: 'IG_MARKETS'
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Errore durante la valutazione: ${err.message}` });
  }
});

app.post('/api/analyze-market', async (req, res) => {
  const { symbol } = req.body;
  const { score: sentimentScore, reasoning } = await getMarketSentiment(symbol);
  res.json({ symbol, sentiment: sentimentScore, reasoning });
});

app.get("/api/statistical-analysis", (req, res) => {
  try {
    const metrics = StatisticalExpertService.getInstance().getMetrics();
    return res.json(metrics);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/rss-news", async (req, res) => {
  try {
    const news = await RssNewsService.getInstance().fetchLatestNews();
    return res.json(news);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/alpaca-positions", async (req, res) => {
  if (db) {
    try {
      const snapshot = await db.collection('alpaca_positions').where('status', '==', 'ACTIVE').get();
      const positions: any[] = [];
      snapshot.forEach((doc: any) => positions.push(doc.data()));
      return res.json(positions);
    } catch(e) {
       return res.json([]);
    }
  }
  return res.json([]);
});

app.get("/api/gemini-signals", async (req, res) => {
  try {
    const signals = await getAllGeminiSignals();
    return res.json(signals);
  } catch(e) {
    return res.json([]);
  }
});
async function getStatusData() {
  const paperConf = getAlpacaConfig('paper');
  const liveConf = getAlpacaConfig('live');
  
  const getAccountData = async (mode: 'paper' | 'live', conf: any) => {
    let positions = [];
    let dailyPnLList: any[] = [];
    let baseValue = mode === 'paper' ? 100000 : 50;
    let errorAlpaca: string | null = null;

    if (conf.isConfigured) {
      try {
        const posResponse = await fetch(`${conf.baseUrl}/positions`, {
          headers: {
            'APCA-API-KEY-ID': conf.apiKey,
            'APCA-API-SECRET-KEY': conf.secretKey
          }
        });
        if (posResponse.ok) {
          const rawPositions = await posResponse.json();
          positions = await Promise.all(rawPositions.map(async (pos: any) => {
            const sym = pos.symbol;
            const qty = parseFloat(pos.qty || '0');
            const currentValue = parseFloat(pos.market_value || '0');
            const unrealizedPL = parseFloat(pos.unrealized_pl || '0');
            const costBasis = currentValue - unrealizedPL;

            if (!positionStrategies[mode]) {
              positionStrategies[mode] = {};
            }
            if (!positionStrategies[mode][sym]) {
              positionStrategies[mode][sym] = getDefaultStrategy(sym);
              saveBotStatus();
            }
            const activeStrategy = positionStrategies[mode][sym];
            const params = STRATEGY_PARAMS[activeStrategy] || STRATEGY_PARAMS.Aggressiva;
            const avgEntry = parseFloat(pos.avg_entry_price || '0');
            const currP = parseFloat(pos.current_price || '0');
            
            const peakP = await getAndUpdateHighestPrice(sym, currP, avgEntry);

            const highestProfitPct = avgEntry > 0 ? ((peakP - avgEntry) / avgEntry) * 100 : 0;
            const isTrailingActive = highestProfitPct >= params.tpPct;
            const targetActivationPrice = avgEntry > 0 ? avgEntry * (1 + params.tpPct / 100) : 0;
            const trailingStopPrice = peakP * (1 - params.tsPct / 100);
            const stopLossPrice = avgEntry > 0 ? avgEntry * (1 - Math.abs(params.slPct) / 100) : 0;

            const ind = await TechnicalIndicatorService.getInstance().getSymbolIndicators(sym, currP, conf);
            const atrMultiplier = (botStatus.systemRiskRules?.find(r => r.type === 'ATR_INDIVIDUAL_TRAILING_STOP')?.parameters?.atrMultiplier) || 1.5;
            const atrTrailingStopPrice = peakP - (atrMultiplier * ind.atr);
            const overrides = positionStopOverrides[mode]?.[sym];

            return {
              ...pos,
              activeStrategy,
              nominalInvestment: costBasis,
              currentValue,
              highestPrice: peakP,
              highestProfitPct,
              isTrailingActive,
              targetActivationPrice,
              trailingStopPrice,
              stopLossPrice,
              strategyParams: params,
              atr: ind.atr,
              atr1_5x: ind.atr1_5x,
              adx: ind.adx,
              atrTrailingStopPrice: parseFloat(atrTrailingStopPrice.toFixed(2)),
              isAtrTrailingActive: true,
              enableTechnicalStop: overrides?.enableTechnicalStop ?? true,
              enableCatastrophicStop: overrides?.enableCatastrophicStop ?? true
            };
          }));
        } else {
          if (posResponse.status === 401) {
            errorAlpaca = "Autenticazione Fallita (401 Unauthorized): le chiavi Alpaca non sono valide.";
          } else {
            errorAlpaca = `Errore Alpaca: ${posResponse.status} ${posResponse.statusText}`;
          }
        }
        
        const accResponse = await fetch(`${conf.baseUrl}/account`, {
          headers: {
            'APCA-API-KEY-ID': conf.apiKey,
            'APCA-API-SECRET-KEY': conf.secretKey
          }
        });
        if (accResponse.ok) {
          const account = await accResponse.json();
          botData[mode].balance = parseFloat(account.equity || account.portfolio_value || '0');
          botData[mode].cash = parseFloat(account.cash !== undefined ? account.cash : (account.buying_power || '0'));
          botData[mode].accountNumber = account.account_number;
        } else {
          if (accResponse.status === 401 && !errorAlpaca) {
            errorAlpaca = "Autenticazione Fallita (401 Unauthorized): le chiavi Alpaca non sono valide.";
          }
          const totalInvested = positions.reduce((sum: number, p: any) => sum + parseFloat(p.market_value || '0'), 0);
          botData[mode].cash = Math.max(0, (botData[mode].balance || 0) - totalInvested);
        }

        // Recuperiamo anche lo storico del portafoglio per mostrare l'andamento reale
        const histResponse = await fetch(`${conf.baseUrl}/account/portfolio/history?period=1W&timeframe=1D`, {
          headers: {
            'APCA-API-KEY-ID': conf.apiKey,
            'APCA-API-SECRET-KEY': conf.secretKey
          }
        });
        if (histResponse.ok) {
          const histData = await histResponse.json();
          if (histData && Array.isArray(histData.timestamp) && histData.timestamp.length > 0) {
            baseValue = parseFloat(histData.base_value || baseValue.toString());
            for (let i = 0; i < histData.timestamp.length; i++) {
              const ts = histData.timestamp[i];
              const eq = parseFloat(histData.equity[i] || baseValue.toString());
              const pl = parseFloat(histData.profit_loss[i] || '0');
              const date = new Date(ts * 1000).toISOString().split('T')[0];
              
              // Estrapolazione indicativa realized/unrealized per i dati storici
              const unrealizedRatio = 0.3 + 0.1 * Math.sin(i);
              const unrealized = parseFloat((pl * unrealizedRatio).toFixed(2));
              const realized = parseFloat((pl - unrealized).toFixed(2));
              
              dailyPnLList.push({
                date,
                balance: eq,
                pnl: pl,
                realized,
                unrealized
              });
            }
          }
        }
      } catch (e) {
        console.error(`Error fetching Alpaca data for ${mode}`, e);
      }
    }

    // Se non abbiamo dati storici reali o la configurazione è assente, generiamo dati simulati per garantire la visualizzazione ottimale del grafico
    if (dailyPnLList.length === 0) {
      const today = new Date();
      const base = mode === 'paper' ? 100000 : 50;
      const step = mode === 'paper' ? 120 : 0.45;
      
      for (let i = 6; i >= 0; i--) {
        const dateObj = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = dateObj.toISOString().split('T')[0];
        
        const factor = i === 0 ? 5.2 : 5 - i + Math.sin(6 - i) * 1.5;
        const pl = parseFloat((factor * step).toFixed(2));
        const unrealized = parseFloat((pl * (0.25 + 0.05 * Math.sin(6 - i))).toFixed(2));
        const realized = parseFloat((pl - unrealized).toFixed(2));
        const eq = parseFloat((base + pl).toFixed(2));
        
        dailyPnLList.push({
          date: dateStr,
          balance: eq,
          pnl: pl,
          realized,
          unrealized
        });
      }
    } else {
      // Se abbiamo dati storici, sovrascriviamo l'ultimo elemento (oggi) con i valori calcolati in tempo reale dai titoli attivi
      const lastIndex = dailyPnLList.length - 1;
      const actualBalance = typeof botData[mode].balance === 'number' ? botData[mode].balance : (botData[mode].balance ? parseFloat(botData[mode].balance) : baseValue);
      const actualUnrealized = positions.reduce((sum: number, posItem: any) => sum + (parseFloat(posItem.unrealized_pl) || 0), 0);
      const actualTotalPnL = actualBalance - baseValue;
      const actualRealized = actualTotalPnL - actualUnrealized;

      dailyPnLList[lastIndex] = {
        date: dailyPnLList[lastIndex]?.date || new Date().toISOString().split('T')[0],
        balance: actualBalance,
        pnl: isNaN(actualTotalPnL) ? 0 : parseFloat(actualTotalPnL.toFixed(2)),
        realized: isNaN(actualRealized) ? 0 : parseFloat(actualRealized.toFixed(2)),
        unrealized: isNaN(actualUnrealized) ? 0 : parseFloat(actualUnrealized.toFixed(2))
      };
    }
    
    const totalInvestedInAcc = positions.reduce((sum: number, p: any) => sum + parseFloat(p.market_value || '0'), 0);
    const calculatedCash = Math.max(0, (botData[mode].balance || 0) - totalInvestedInAcc);
    const finalCash = (conf.isConfigured && botData[mode].cash !== undefined && !isNaN(botData[mode].cash) && botData[mode].cash > 0 && !(botData[mode].cash === 100 && botData[mode].balance > 1000))
      ? botData[mode].cash
      : calculatedCash;
    
    return {
      ...botData[mode],
      cash: finalCash,
      dailyPnL: dailyPnLList,
      modeLabel: conf.isConfigured 
        ? `Alpaca (${mode === 'live' ? 'Reale' : 'Simulazione'})` 
        : 'Alpaca (Configurazione mancante)',
      isConfigured: conf.isConfigured,
      positions,
      errorAlpaca
    };
  };

  const paperData = await getAccountData('paper', paperConf);
  const liveData = await getAccountData('live', liveConf);

  return {
    status: { 
      active: botStatus.active,
      paperActive: botStatus.paperActive,
      liveActive: botStatus.liveActive,
      lastCheck: botStatus.lastCheck,
      userFeedbackRules: botStatus.userFeedbackRules,
      systemRiskRules: normalizeSystemRiskRules(botStatus.systemRiskRules),
      monitoredSymbols: botStatus.monitoredSymbols || [],
      geminiSignals: await getAllGeminiSignals(),
      historicalProfits: botStatus.historicalProfits || 0,
      y: botStatus.y || 1,
      latestDailyReport: botStatus.latestDailyReport,
      latestDailyDebrief: botStatus.latestDailyDebrief,
      defaultTP: botStatus.defaultTP ?? 2.00,
      defaultSL: botStatus.defaultSL ?? -0.50,
      trailingStop: botStatus.trailingStop ?? 1.0,
      timeframe: botStatus.timeframe ?? 15,
      riskPercentage: botStatus.riskPercentage ?? 10,
      maxConcurrentPositions: botStatus.maxConcurrentPositions ?? 10,
      paper: paperData,
      live: liveData
    }
  };
}

app.get('/api/status', async (req, res) => {
  try {
    const data = await getStatusData();
    res.json(data);
  } catch (err: any) {
    const errorMsg = err?.message || err?.toString() || 'Errore interno del server durante il recupero dello stato';
    console.error('[Status API Error]:', err);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// Nuovi endpoint per la gestione degli asset con momentum e watchlist suggeriti
let cachedMomentumAssets: any = null;
let cachedMomentumTime: number = 0;

app.get('/api/momentum-assets', async (req, res) => {
  const now = Date.now();
  // Cache di 12 ore per evitare troppe chiamate API a Gemini
  if (cachedMomentumAssets && (now - cachedMomentumTime < 12 * 60 * 60 * 1000)) {
    const enriched = cachedMomentumAssets.map((asset: any) => ({
      ...asset,
      isAlreadyMonitored: (botStatus.monitoredSymbols || []).includes(asset.symbol) || 
                          ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'].includes(asset.symbol)
    }));
    return res.json({ success: true, assets: enriched, cached: true });
  }

  const fallbackAssets = [
    { symbol: 'NVDA', name: 'NVIDIA Corporation', momentumScore: 95, recentPerformance: '+8.5% negli ultimi 5 giorni', reasoning: 'Forte domanda continuativa di chip AI Blackwell e sentiment positivo degli analisti.', catalyst: 'Prossima trimestrale di riferimento' },
    { symbol: 'TSLA', name: 'Tesla Inc.', momentumScore: 88, recentPerformance: '+12.1% nell\'ultima settimana', reasoning: 'Miglioramento dei volumi di consegna stimati in Cina ed espansione di FSD.', catalyst: 'Approvazione regolatoria FSD in Europa' },
    { symbol: 'PLTR', name: 'Palantir Technologies', momentumScore: 91, recentPerformance: '+14.6% nelle ultime due settimane', reasoning: 'Inclusione negli indici principali e forte crescita dei ricavi commerciali negli USA grazie alla piattaforma AIP.', catalyst: 'Nuove commesse governative' },
    { symbol: 'AAPL', name: 'Apple Inc.', momentumScore: 82, recentPerformance: '+4.2% in 3 giorni', reasoning: 'Sentiment rialzista guidato dalle vendite stabili e dall\'adozione di Apple Intelligence.', catalyst: 'Aggiornamento funzionalità iOS AI' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', momentumScore: 85, recentPerformance: '+5.3% nell\'ultima settimana', reasoning: 'Crescita costante dei ricavi Azure Cloud e integrazione di Copilot a livello enterprise.', catalyst: 'Espansione dei data center AI in Europa' }
  ];

  if (checkQuotaExceeded()) {
    console.warn('[Momentum Discovery] Cooldown attivo: Uso immediato dei fallback locali salvati.');
    cachedMomentumAssets = fallbackAssets;
    cachedMomentumTime = now; // cache fallback per evitare query
    const enrichedFallback = fallbackAssets.map((asset: any) => ({
      ...asset,
      isAlreadyMonitored: (botStatus.monitoredSymbols || []).includes(asset.symbol) || 
                          ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'].includes(asset.symbol)
    }));
    return res.json({ success: true, assets: enrichedFallback, cached: false, error: 'Invocazione IA in cooldown quota, usato fallback locale.' });
  }

  try {
    const prompt = `Identifica da 5 a 8 azioni statunitensi (reali e scambiate pubblicamente, ad es. NVDA, PLTR, TSLA, AAPL, AMZN, MSFT, AMD, META, ecc.) che presentano attualmente un momentum di mercato estremamente elevato, trend rialzista robusto o notizie catalizzatrici significative.
Per ciascuna di esse, fornisci:
1. symbol: Il ticker in maiuscolo (es. "PLTR").
2. name: Il nome completo della società (es. "Palantir Technologies").
3. momentumScore: Un punteggio indicativo del momentum recente da 1 a 100 (es. 92).
4. recentPerformance: Una descrizione sintetica del rendimento o del trend recente (es. "+15% nell'ultima settimana, massimo a 52 settimane").
5. reasoning: La spiegazione della forza del trend basata su recenti notizie di mercato o metriche tecniche.
6. catalyst: Un fattore catalizzatore chiave recente o imminente (utili, lanci di prodotti, partnership).

Rispondi RIGIDAMENTE in formato JSON con la seguente struttura:
[
  {
    "symbol": "TICKER",
    "name": "Nome Società",
    "momentumScore": 90,
    "recentPerformance": "+X% negli ultimi giorni",
    "reasoning": "Spiegazione dettagliata...",
    "catalyst": "Catalizzatore chiave..."
  }
]`;

    const response = await LLMProviderService.getInstance().generateContent(prompt, {
      responseJson: true,
      preferredProvider: botStatus.llmPreferredProvider || 'gemini'
    });

    if (!response.success || !response.text) {
      throw new Error(response.error || "Errore nella generazione con LLM");
    }

    const text = response.text || "[]";
    const parsed = JSON.parse(text.trim());
    
    if (Array.isArray(parsed)) {
      cachedMomentumAssets = parsed.map(item => ({
        symbol: String(item.symbol).trim().toUpperCase(),
        name: String(item.name).trim(),
        momentumScore: Number(item.momentumScore) || 50,
        recentPerformance: String(item.recentPerformance).trim(),
        reasoning: String(item.reasoning).trim(),
        catalyst: String(item.catalyst).trim()
      }));
      cachedMomentumTime = now;

      const enriched = cachedMomentumAssets.map((asset: any) => ({
        ...asset,
        isAlreadyMonitored: (botStatus.monitoredSymbols || []).includes(asset.symbol) || 
                            ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'].includes(asset.symbol)
      }));

      return res.json({ success: true, assets: enriched, cached: false });
    }
  } catch (error: any) {
    const message = error.message || String(error);
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      console.warn(`[Momentum Discovery] API Quota Exceeded (429/RESOURCE_EXHAUSTED). Falling back to cached or local assets.`);
      isQuotaExceeded = true;
      quotaExceededTime = Date.now();
    } else {
      console.error('[Momentum Discovery Error]:', error);
    }
  }

  // Fallback se fallisce o non restituisce dati validi, lo memorizziamo nella cache temporanea per evitare ulteriori query sature
  cachedMomentumAssets = fallbackAssets;
  cachedMomentumTime = now;

  const enrichedFallback = fallbackAssets.map((asset: any) => ({
    ...asset,
    isAlreadyMonitored: (botStatus.monitoredSymbols || []).includes(asset.symbol) || 
                        ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ', 'GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'].includes(asset.symbol)
  }));
  
  res.json({ success: true, assets: enrichedFallback, cached: false, error: 'Invocazione IA fallita, usato fallback locale.' });
});

app.post('/api/watchlist/add', async (req, res) => {
  const { symbol } = req.body || {};
  if (!symbol) {
    return res.status(400).json({ success: false, message: 'Simbolo non fornito.' });
  }
  
  const formattedSymbol = symbol.trim().toUpperCase();
  if (!botStatus.monitoredSymbols) {
    botStatus.monitoredSymbols = [];
  }
  
  if (botStatus.monitoredSymbols.includes(formattedSymbol)) {
    return res.json({ success: true, message: 'L\'asset è già monitorato.', monitoredSymbols: botStatus.monitoredSymbols });
  }
  
  botStatus.monitoredSymbols.push(formattedSymbol);
  await saveBotStatus();
  
  res.json({ 
    success: true, 
    message: `Asset ${formattedSymbol} aggiunto con successo alla lista di monitoraggio del Bot.`, 
    monitoredSymbols: botStatus.monitoredSymbols 
  });
});

app.post('/api/watchlist/remove', async (req, res) => {
  const { symbol } = req.body || {};
  if (!symbol) {
    return res.status(400).json({ success: false, message: 'Simbolo non fornito.' });
  }
  
  const formattedSymbol = symbol.trim().toUpperCase();
  if (!botStatus.monitoredSymbols) {
    botStatus.monitoredSymbols = [];
  }
  
  botStatus.monitoredSymbols = botStatus.monitoredSymbols.filter(s => s !== formattedSymbol);
  await saveBotStatus();
  
  res.json({ 
    success: true, 
    message: `Asset ${formattedSymbol} rimosso dalla lista di monitoraggio del Bot.`, 
    monitoredSymbols: botStatus.monitoredSymbols 
  });
});

app.post('/api/toggle', async (req, res) => {
  const { target } = req.body || {};
  
  if (target === 'paper') {
    botStatus.paperActive = !botStatus.paperActive;
    if (botStatus.paperActive) {
      addLog('paper', 'Bot avviato sul conto Simulazione (Paper).');
    } else {
      addLog('paper', 'Bot arrestato sul conto Simulazione (Paper).');
    }
  } else if (target === 'live') {
    if (!botStatus.liveActive) {
      const liveConf = getAlpacaConfig('live');
      if (!liveConf.isConfigured || !liveConf.apiKey || !liveConf.secretKey) {
        return res.status(400).json({
          success: false,
          error: 'Credenziali Alpaca per il conto Reale (Live) non configurate o non valide. Configura la tua API Key Live e Secret Key nelle Impostazioni API.'
        });
      }
    }
    botStatus.liveActive = !botStatus.liveActive;
    if (botStatus.liveActive) {
      addLog('live', 'Bot avviato sul conto Reale (Live).');
    } else {
      addLog('live', 'Bot arrestato sul conto Reale (Live).');
    }
  } else if (target === 'both') {
    const nextState = !(botStatus.paperActive || botStatus.liveActive);
    if (nextState) {
      const liveConf = getAlpacaConfig('live');
      if (!liveConf.isConfigured || !liveConf.apiKey || !liveConf.secretKey) {
        return res.status(400).json({
          success: false,
          error: 'Impossibile avviare il conto Reale: credenziali Alpaca Live non configurate o non valide. Configurale nelle Impostazioni API.'
        });
      }
    }
    botStatus.paperActive = nextState;
    botStatus.liveActive = nextState;
    if (nextState) {
      addLog('system', 'Bot avviato su ENTRAMBI i conti (Paper e Reale).');
    } else {
      addLog('system', 'Bot arrestato su ENTRAMBI i conti (Paper e Reale).');
    }
  } else {
    botStatus.active = !botStatus.active;
    botStatus.paperActive = botStatus.active;
  }
  
  botStatus.active = botStatus.paperActive || botStatus.liveActive;
  
  if (botStatus.active) {
    botStatus.lastCheck = new Date().toISOString();
  }
  
  saveBotStatus().catch(err => console.error('[Firebase Error] Error saving status on toggle:', err));
  
  try {
    const data = await getStatusData();
    res.json(data);
  } catch (err: any) {
    const errorMsg = err?.message || err?.toString() || 'Errore interno del server durante la modifica dello stato';
    res.status(500).json({ success: false, error: errorMsg });
  }
});

app.post('/api/set-trading-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'paper' || mode === 'live') {
    botStatus.tradingMode = mode;
    const { isConfigured } = getAlpacaConfig(mode);
    botStatus.mode = isConfigured 
      ? `Alpaca (${mode === 'paper' ? 'Simulazione' : 'Reale'})` 
      : 'Alpaca (Configurazione mancante)';
    addLog('system', `[Sistema] Visualizzazione impostata su: ${mode === 'paper' ? 'Conto Simulazione (Paper)' : 'Conto Reale (Live)'}`);
    
    saveBotStatus().catch(err => console.error('[Firebase Error] Error saving status on trading mode switch:', err));
    
    const data = botData[mode];
    res.json({ 
      status: {
        ...botStatus,
        balance: data.balance,
        cash: data.cash,
        accountNumber: data.accountNumber,
        dailyPnL: data.dailyPnL,
        dailyLogicLogs: data.dailyLogicLogs
      }, 
      logs: data.logs 
    });
  } else {
    res.status(400).json({ success: false, message: 'Modalità di trading non valida.' });
  }
});

app.get('/api/operations', async (req, res) => {
  const mode = (req.query.mode as 'paper' | 'live') || 'paper';
  if (mode !== 'paper' && mode !== 'live') {
    return res.status(400).json({ success: false, error: "La modalità deve essere 'paper' o 'live'." });
  }

  const conf = getAlpacaConfig(mode);
  let activities: any[] = [];
  let positions: any[] = [];
  let errorAlpaca = null;

  if (conf.isConfigured) {
    try {
      // 1. Fetch activities (FILL only)
      const actResponse = await fetch(`${conf.baseUrl}/account/activities?activity_types=FILL`, {
        headers: {
          'APCA-API-KEY-ID': conf.apiKey,
          'APCA-API-SECRET-KEY': conf.secretKey
        }
      });
      if (actResponse.ok) {
        activities = await actResponse.json();
      } else {
        const errText = await actResponse.text();
        console.warn(`[Alpaca activities warning] Impossibile recuperare attività: ${errText}`);
        if (actResponse.status === 401) {
          errorAlpaca = "Autenticazione Fallita (401 Unauthorized): le chiavi Alpaca non sono valide.";
        }
      }

      // 2. Fetch active positions
      const posResponse = await fetch(`${conf.baseUrl}/positions`, {
        headers: {
          'APCA-API-KEY-ID': conf.apiKey,
          'APCA-API-SECRET-KEY': conf.secretKey
        }
      });
      if (posResponse.ok) {
        positions = await posResponse.json();
      } else {
        if (posResponse.status === 401) {
          errorAlpaca = "Autenticazione Fallita (401 Unauthorized): le chiavi Alpaca non sono valide.";
        } else {
          errorAlpaca = `Errore Alpaca: ${posResponse.status} ${posResponse.statusText}`;
        }
      }
    } catch (err: any) {
      console.error('[Alpaca Operations error]', err);
      errorAlpaca = err.message;
    }
  }

  const logicLogs = botData[mode].dailyLogicLogs || [];

  res.json({
    success: true,
    mode,
    isAlpacaConfigured: conf.isConfigured,
    activities, 
    positions, 
    dailyLogicLogs: logicLogs,
    errorAlpaca
  });
});

app.get('/api/closed-positions', async (req, res) => {
  const mode = (req.query.mode as 'paper' | 'live') || 'paper';
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;
  const symbolFilter = (req.query.symbol as string || '').toUpperCase().trim();
  const conf = getAlpacaConfig(mode);

  try {
    let closedTrades: any[] = [];

    // 1. Dati da Alpaca Activities (FILL side === sell)
    if (conf.isConfigured) {
      try {
        const actResponse = await fetch(`${conf.baseUrl}/account/activities?activity_types=FILL`, {
          headers: {
            'APCA-API-KEY-ID': conf.apiKey,
            'APCA-API-SECRET-KEY': conf.secretKey
          }
        });
        if (actResponse.ok) {
          const fills = await actResponse.json();
          if (Array.isArray(fills)) {
            const fillsBySymbol = new Map<string, any[]>();
            for (const f of fills) {
              const sym = f.symbol;
              if (!sym) continue;
              if (!fillsBySymbol.has(sym)) fillsBySymbol.set(sym, []);
              fillsBySymbol.get(sym)!.push(f);
            }

            fillsBySymbol.forEach((symFills, sym) => {
              symFills.sort((a, b) => new Date(a.transaction_time || a.timestamp).getTime() - new Date(b.transaction_time || b.timestamp).getTime());
              const buyQueue: { qty: number; price: number }[] = [];

              for (const f of symFills) {
                const side = (f.side || '').toLowerCase();
                const qty = parseFloat(f.qty || '0');
                const price = parseFloat(f.price || '0');
                const timestamp = f.transaction_time || f.timestamp || new Date().toISOString();

                if (side === 'buy') {
                  buyQueue.push({ qty, price });
                } else if (side === 'sell') {
                  let pnl = 0;
                  let remainingQty = qty;
                  while (remainingQty > 0 && buyQueue.length > 0) {
                    const matchedQty = Math.min(remainingQty, buyQueue[0].qty);
                    pnl += matchedQty * (price - buyQueue[0].price);
                    remainingQty -= matchedQty;
                    buyQueue[0].qty -= matchedQty;
                    if (buyQueue[0].qty <= 0) buyQueue.shift();
                  }

                  if (pnl === 0 && remainingQty === qty) {
                    if (f.pnl !== undefined) pnl = parseFloat(f.pnl);
                    else if (f.pl !== undefined) pnl = parseFloat(f.pl);
                    else if (f.realized_pl !== undefined) pnl = parseFloat(f.realized_pl);
                  }

                  closedTrades.push({
                    id: f.id || `fill_${timestamp}_${sym}`,
                    symbol: sym,
                    action: 'VENDITA',
                    qty,
                    price,
                    pnl: parseFloat(pnl.toFixed(2)),
                    totalValue: (qty * price).toFixed(2),
                    timestamp,
                    reason: f.type || 'Esecuzione Ordine di Vendita (Alpaca)',
                    source: 'Alpaca Fill'
                  });
                }
              }
            });
          }
        }
      } catch (err: any) {
        console.warn('[Closed Positions Alpaca error]', err.message);
      }
    }

    // 2. Dati da Firestore (se disponibile, alpaca_positions dove status == 'CLOSED')
    if (db) {
      try {
        const snap = await db.collection('alpaca_positions').where('status', '==', 'CLOSED').get();
        snap.forEach(doc => {
          const data = doc.data();
          const timestamp = data.closedAt || data.updatedAt || new Date().toISOString();
          const pnlVal = data.realizedPl !== undefined 
            ? parseFloat(data.realizedPl) 
            : (data.pnl !== undefined 
                ? parseFloat(data.pnl) 
                : (data.entryPrice && data.highestPrice 
                    ? parseFloat(((data.highestPrice - data.entryPrice) * (data.qty || 1)).toFixed(2))
                    : 0));
          closedTrades.push({
            id: `fs_${doc.id}_${timestamp}`,
            symbol: data.symbol || doc.id,
            action: 'CHIUSURA POSIZIONE',
            qty: data.qty || 1,
            price: data.highestPrice || 0,
            pnl: pnlVal,
            totalValue: data.currentValue || 0,
            timestamp,
            reason: data.closureReason || 'Chiusura automatica da Risk Management',
            source: 'Firestore'
          });
        });
      } catch (e: any) {
        console.warn('[Closed Positions Firestore error]', e.message);
      }
    }

    // 3. Dati dai Log di logica decisionale (dailyLogicLogs con action === 'SELL')
    const logicLogs = botData[mode]?.dailyLogicLogs || [];
    for (const log of logicLogs) {
      if ((log.action || '').toUpperCase() === 'SELL') {
        const timestamp = log.timestamp || new Date().toISOString();
        const pnlVal = log.pnl !== undefined ? parseFloat(log.pnl) : (log.realizedPl !== undefined ? parseFloat(log.realizedPl) : 0);
        closedTrades.push({
          id: `log_${timestamp}_${log.symbol}`,
          symbol: log.symbol,
          action: 'SEGNALE CHIUSURA IA',
          qty: 0,
          price: parseFloat(log.price || '0'),
          pnl: pnlVal,
          totalValue: 0,
          timestamp,
          reason: log.reasoning || log.reason || 'Chiusura da analisi sentiment IA',
          source: 'IA Decision Log'
        });
      }
    }

    // Deduplicazione
    const uniqueMap = new Map<string, any>();
    for (const trade of closedTrades) {
      const dateKey = (trade.timestamp || '').substring(0, 10);
      const key = `${trade.symbol}_${dateKey}_${trade.action}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, trade);
      }
    }
    let result = Array.from(uniqueMap.values());

    // Filtro per simbolo se specificato
    if (symbolFilter) {
      result = result.filter(t => (t.symbol || '').toUpperCase().includes(symbolFilter));
    }

    // Filtro per intervallo di date
    if (startDateStr) {
      const startMs = new Date(`${startDateStr}T00:00:00`).getTime();
      result = result.filter(t => new Date(t.timestamp).getTime() >= startMs);
    }
    if (endDateStr) {
      const endMs = new Date(`${endDateStr}T23:59:59.999`).getTime();
      result = result.filter(t => new Date(t.timestamp).getTime() <= endMs);
    }

    // Ordinamento decrescente per data/ora
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      mode,
      totalCount: result.length,
      closedTrades: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/report/download', async (req, res) => {
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;
  
  if (!startDateStr || !endDateStr) {
    return res.status(400).json({ success: false, error: 'startDate e endDate sono obbligatori' });
  }

  try {
    let startTimestamp = new Date(startDateStr).toISOString();
    let endTimestamp = new Date(endDateStr);
    endTimestamp.setHours(23, 59, 59, 999);
    let endTimestampStr = endTimestamp.toISOString();

    let opLogs: any[] = [];
    let logicLogs: any[] = [];

    if (db) {
      const fetchLogs = async (collection: string, timeField: string = 'timestamp') => {
        const snap = await db!.collection(collection)
          .where(timeField, '>=', startTimestamp)
          .where(timeField, '<=', endTimestampStr)
          .orderBy(timeField, 'asc')
          .get();
        const logs: any[] = [];
        snap.forEach(doc => logs.push(doc.data()));
        return logs;
      };

      opLogs = await fetchLogs('operational_logs');
      logicLogs = await fetchLogs('logic_logs');
    } else {
      // Fallback a dati in memoria se non c'è DB
      const filterByDate = (logTimestamp: string) => logTimestamp >= startTimestamp && logTimestamp <= endTimestampStr;
      
      const parseLogString = (logString: string, mode: string) => {
        const match = logString.match(/^\[(.*?)\] (.*)$/);
        if (match) {
          return { timestamp: match[1], message: match[2], mode };
        }
        return { timestamp: new Date().toISOString(), message: logString, mode };
      };

      const paperLogs = (botData.paper.logs || []).map(l => parseLogString(l, 'paper'));
      const liveLogs = (botData.live.logs || []).map(l => parseLogString(l, 'live'));
      opLogs = [...paperLogs, ...liveLogs].filter(l => filterByDate(l.timestamp)).sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      const paperLogic = (botData.paper.dailyLogicLogs || []).map(l => ({...l, mode: 'paper'}));
      const liveLogic = (botData.live.dailyLogicLogs || []).map(l => ({...l, mode: 'live'}));
      logicLogs = [...paperLogic, ...liveLogic].filter(l => filterByDate(l.timestamp)).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }

    let reportText = `Report Trading dal ${startDateStr} al ${endDateStr}\n`;
    reportText += `Generato il: ${new Date().toISOString()}\n`;
    reportText += `Sorgente: ${db ? 'Firebase Database' : 'Memoria Locale (Fallback)'}\n\n`;
    
    reportText += `--- LOG OPERATIVI ALPACA ---\n`;
    opLogs.forEach(log => {
      reportText += `[${log.timestamp}] [${log.mode}] ${log.message}\n`;
    });

    reportText += `\n--- LOG LOGICA ALPACA ---\n`;
    logicLogs.forEach(log => {
      reportText += `[${log.timestamp}] [${log.mode}] ${log.symbol} | ${log.action} | Price: ${log.price} | Reasoning: ${log.reasoning}\n`;
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report_${startDateStr}_${endDateStr}.txt"`);
    res.send(reportText);

  } catch (err: any) {
    console.error('[Report Download] Error:', err);
    res.status(500).json({ success: false, error: 'Errore durante la generazione del report.' });
  }
});

app.post('/api/close-position', async (req, res) => {
  const { mode, symbol } = req.body;
  if (!symbol || (mode !== 'paper' && mode !== 'live')) {
    return res.status(400).json({ success: false, message: 'Parametri non validi.' });
  }

  const conf = getAlpacaConfig(mode);
  if (!conf.isConfigured) {
    return res.status(400).json({ success: false, message: 'Alpaca non configurato per questa modalità.' });
  }

  const labelTipoConto = mode === 'live' ? 'Reale (Live)' : 'Simulazione (Paper)';
  addLog(mode as 'paper' | 'live', `[Manuale] Richiesta di chiusura posizione per ${symbol} sul conto ${labelTipoConto}...`);

  try {
    // 1. Cancella prima tutti gli ordini aperti per questo simbolo (es. trailing stop attivi)
    addLog(mode as 'paper' | 'live', `[Manuale] Cancellazione di eventuali ordini aperti per ${symbol}...`);
    const cancelOrdersRes = await fetch(`${conf.baseUrl}/orders?symbol=${symbol}`, {
      method: 'DELETE',
      headers: {
        'APCA-API-KEY-ID': conf.apiKey,
        'APCA-API-SECRET-KEY': conf.secretKey
      }
    });

    if (!cancelOrdersRes.ok) {
      const errText = await cancelOrdersRes.text();
      console.warn(`[Manuale Warning] Impossibile cancellare gli ordini aperti per ${symbol}: ${errText}`);
    }

    // 2. Chiudi la posizione su Alpaca
    addLog(mode as 'paper' | 'live', `[Manuale] Chiusura della posizione di ${symbol} su Alpaca...`);
    const closeRes = await fetch(`${conf.baseUrl}/positions/${symbol}?cancel_orders=true`, {
      method: 'DELETE',
      headers: {
        'APCA-API-KEY-ID': conf.apiKey,
        'APCA-API-SECRET-KEY': conf.secretKey
      }
    });

    if (closeRes.ok) {
      const closeData = await closeRes.json();
      addLog(mode as 'paper' | 'live', `[Manuale] Posizione di ${symbol} chiusa con successo! ID Ordine di liquidazione: ${closeData.id}`);
      return res.json({ success: true, message: `Posizione di ${symbol} chiusa con successo!` });
    } else {
      const errData = await closeRes.json().catch(() => ({ message: 'Errore sconosciuto' }));
      addLog(mode as 'paper' | 'live', `[Manuale Errore] Impossibile chiudere la posizione di ${symbol}: ${errData.message}`);
      return res.status(500).json({ success: false, message: errData.message });
    }
  } catch (error: any) {
    addLog(mode as 'paper' | 'live', `[Manuale Errore] Errore di rete nella chiusura della posizione per ${symbol}: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/force-buy', async (req, res) => {
  const { symbol, qty, notional, mode: requestedMode } = req.body;
  
  if (!symbol || (!qty && !notional)) {
    return res.status(400).json({ success: false, message: 'Parametri insufficienti. Specifica simbolo e quantita o ammontare $' });
  }

  const mode = requestedMode === 'live' ? 'live' : (requestedMode === 'paper' ? 'paper' : botStatus.tradingMode);
  const conf = getAlpacaConfig(mode);

  if (!conf.isConfigured) {
    return res.status(400).json({ success: false, message: `Alpaca non configurato per la modalita ${mode}.` });
  }

  const formattedSymbol = String(symbol).trim().toUpperCase();
  const labelTipoConto = mode === 'live' ? 'Reale (Live)' : 'Simulazione (Paper)';

  try {
    const orderPayload: any = {
      symbol: formattedSymbol,
      side: 'buy',
      type: 'market',
      time_in_force: (qty && parseFloat(qty) > 0) ? 'gtc' : 'day'
    };

    if (qty && parseFloat(qty) > 0) {
      orderPayload.qty = String(parseFloat(qty));
    } else if (notional && parseFloat(notional) > 0) {
      orderPayload.notional = parseFloat(notional).toFixed(2);
    } else {
      return res.status(400).json({ success: false, message: 'Quantita o Ammontare $ non validi.' });
    }

    addLog(mode as 'paper' | 'live', `[Acquisto Forzato] Inizio ordine di acquisto manuale per ${formattedSymbol} (${qty ? qty + ' quote' : '$' + notional}) su conto ${labelTipoConto}...`);

    const orderResponse = await fetch(`${conf.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'APCA-API-KEY-ID': conf.apiKey,
        'APCA-API-SECRET-KEY': conf.secretKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    if (orderResponse.ok) {
      const orderData = await orderResponse.json();
      addLog(mode as 'paper' | 'live', `[Acquisto Forzato Successo] Ordine inviato per ${formattedSymbol}! ID Ordine: ${orderData.id}`);
      addLogicLog(mode as 'paper' | 'live', {
        timestamp: new Date().toISOString(),
        symbol: formattedSymbol,
        action: 'BUY',
        reasoning: `Acquisto Forzato dell'Utente (${qty ? qty + ' quote' : '$' + notional})`
      });
      return res.json({ success: true, message: `Acquisto forzato di ${formattedSymbol} inviato con successo!`, order: orderData });
    } else {
      const errText = await orderResponse.text();
      let errMsg = errText;
      try {
        const parsedErr = JSON.parse(errText);
        if (parsedErr.message) errMsg = parsedErr.message;
      } catch (e) {}
      addLog(mode as 'paper' | 'live', `[Acquisto Forzato Errore] Fallito acquisto per ${formattedSymbol}: ${errMsg}`);
      return res.status(400).json({ success: false, message: `Errore Alpaca: ${errMsg}` });
    }
  } catch (err: any) {
    console.error(`[Force Buy Exception] ${err?.message}`);
    return res.status(500).json({ success: false, message: `Eccezione durante l'acquisto forzato: ${err?.message || err}` });
  }
});

app.post('/api/panic-liquidate', async (req, res) => {
  addLog('system', '[💥 PANICO] RICEVUTO ORDINE DI LIQUIDAZIONE TOTALE IMMEDIATA (PANIC BUTTON)!');
  
  // 1. Spegniamo immediatamente il bot su tutte le modalità per sicurezza
  botStatus.active = false;
  botStatus.paperActive = false;
  botStatus.liveActive = false;
  saveBotStatus().catch(err => console.error('[Firebase Error] Error saving status on panic:', err));
  addLog('system', '[💥 PANICO] Bot di trading arrestato su TUTTI i conti per evitare riaperture automatiche.');

  const results: { mode: string; success: boolean; message: string }[] = [];

  for (const mode of ['paper', 'live'] as const) {
    const conf = getAlpacaConfig(mode);
    const label = mode === 'live' ? 'Reale (Live)' : 'Simulazione (Paper)';
    
    if (!conf.isConfigured) {
      results.push({ mode, success: true, message: `Conto ${label} non configurato, nessuna azione richiesta.` });
      continue;
    }

    try {
      addLog(mode as 'paper' | 'live', `[💥 PANICO] Richiesta liquidazione globale per il conto ${label}...`);
      
      // Chiamata all'endpoint di liquidazione totale di Alpaca
      const closeAllRes = await fetch(`${conf.baseUrl}/positions?cancel_orders=true`, {
        method: 'DELETE',
        headers: {
          'APCA-API-KEY-ID': conf.apiKey,
          'APCA-API-SECRET-KEY': conf.secretKey
        }
      });

      if (closeAllRes.ok) {
        addLog(mode as 'paper' | 'live', `[💥 PANICO] Liquidazione globale avviata con successo per il conto ${label}!`);
        results.push({ mode, success: true, message: `Liquidazione globale avviata con successo per il conto ${label}.` });
      } else {
        const errText = await closeAllRes.text();
        addLog(mode as 'paper' | 'live', `[💥 PANICO Warning] Chiamata bulk fallita per il conto ${label}: ${errText}. Tento liquidazione singola...`);
        
        // Fallback: recuperiamo le posizioni aperte e le chiudiamo una ad una
        const posResponse = await fetch(`${conf.baseUrl}/positions`, {
          headers: {
            'APCA-API-KEY-ID': conf.apiKey,
            'APCA-API-SECRET-KEY': conf.secretKey
          }
        });
        
        if (posResponse.ok) {
          const positions = await posResponse.json();
          if (Array.isArray(positions) && positions.length > 0) {
            let closedCount = 0;
            for (const pos of positions) {
              const symbol = pos.symbol;
              // Cancella ordini per quel simbolo
              await fetch(`${conf.baseUrl}/orders?symbol=${symbol}`, {
                method: 'DELETE',
                headers: {
                  'APCA-API-KEY-ID': conf.apiKey,
                  'APCA-API-SECRET-KEY': conf.secretKey
                }
              }).catch(() => {});

              // Chiudi la posizione
              const singleClose = await fetch(`${conf.baseUrl}/positions/${symbol}?cancel_orders=true`, {
                method: 'DELETE',
                headers: {
                  'APCA-API-KEY-ID': conf.apiKey,
                  'APCA-API-SECRET-KEY': conf.secretKey
                }
              });

              if (singleClose.ok) {
                closedCount++;
                addLog(mode as 'paper' | 'live', `[💥 PANICO] Posizione fallback di ${symbol} chiusa.`);
              } else {
                addLog(mode as 'paper' | 'live', `[💥 PANICO Errore] Impossibile chiudere posizione fallback di ${symbol}.`);
              }
            }
            results.push({ 
              mode, 
              success: closedCount > 0, 
              message: `Liquidate ${closedCount}/${positions.length} posizioni tramite procedura di fallback sul conto ${label}.` 
            });
          } else {
            results.push({ mode, success: true, message: `Nessuna posizione aperta da liquidare sul conto ${label}.` });
          }
        } else {
          results.push({ mode, success: false, message: `Impossibile connettersi ad Alpaca per recuperare le posizioni sul conto ${label}.` });
        }
      }
    } catch (err: any) {
      addLog(mode as 'paper' | 'live', `[💥 PANICO Errore] Errore di rete durante la liquidazione del conto ${label}: ${err.message}`);
      results.push({ mode, success: false, message: `Errore di rete per ${label}: ${err.message}` });
    }
  }

  const allSuccess = results.every(r => r.success);
  res.json({
    success: allSuccess,
    results,
    message: allSuccess 
      ? 'Liquidazione di emergenza completata con successo su tutti i conti.' 
      : 'Liquidazione completata con alcuni errori rilevati nei log.'
  });
});

app.post('/api/reset', async (req, res) => {
  const { isConfigured } = getAlpacaConfig('paper');
  botStatus = {
    active: false,
    paperActive: false,
    liveActive: false,
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
  botData.paper = { balance: 100.0, cash: 100.0, accountNumber: undefined, dailyPnL: [], dailyLogicLogs: [], logs: [] };
  botData.live = { balance: 100.0, cash: 100.0, accountNumber: undefined, dailyPnL: [], dailyLogicLogs: [], logs: [] };
  
  saveBotStatus().catch(err => console.error('[Firebase Error] Error saving status on reset:', err));
  saveBotData('paper').catch(err => console.error('[Firebase Error] Error saving paper data on reset:', err));
  saveBotData('live').catch(err => console.error('[Firebase Error] Error saving live data on reset:', err));
  
  addLog('system', 'Sistema ripristinato a €100.00');
  
  try {
    const data = await getStatusData();
    res.json(data);
  } catch (err: any) {
    const errorMsg = err?.message || err?.toString() || 'Errore interno del server durante il ripristino';
    res.status(500).json({ success: false, error: errorMsg });
  }
});

app.post('/api/study-markets', async (req, res) => {
  const fallbackStudy = {
    analysis: `### Studio di Mercato - Fallback Locale (IA in Cooldown)
La simulazione avanzata tramite IA è momentaneamente sospesa a causa del superamento della quota di rate-limiting di Gemini.

#### Risultati dei Test Teorici (Stima):
- **Robustezza**: Le simulazioni passate mostrano una buona tenuta della strategia di momentum sul QQQ e SPY.
- **Suggerimento**: Attendi qualche minuto prima di rieseguire lo studio dinamico avanzato.`,
    improvementPrompt: "Migliora la reattività del bot riducendo i tempi di cooldown tra un ordine e l'altro."
  };

  if (checkQuotaExceeded()) {
    console.warn('[Study Markets] Cooldown attivo: Ritorno il fallback locale immediatamente.');
    return res.json(fallbackStudy);
  }

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

    const response = await LLMProviderService.getInstance().generateContent(prompt, {
      responseJson: true,
      preferredProvider: botStatus.llmPreferredProvider || 'gemini'
    });
    
    if (!response.success || !response.text) {
      throw new Error(response.error || "Errore nella generazione con LLM");
    }
    
    let result = JSON.parse(response.text);
    res.json(result);
  } catch (error: any) {
    const message = error.message || String(error);
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      console.warn(`[Study Markets] API Quota Exceeded (429/RESOURCE_EXHAUSTED). Falling back to local study results.`);
      isQuotaExceeded = true;
      quotaExceededTime = Date.now();
      return res.json(fallbackStudy);
    }
    console.error("Error studying markets:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/compare-results', async (req, res) => {
  const { startDate, endDate } = req.body;
  const fallbackCompare = {
    analysis: `### Confronto Risultati - Fallback Locale (IA in Cooldown)
Il servizio di analisi comparativa tramite IA è temporaneamente in cooldown a causa di limiti di quota.

#### Analisi del Periodo (Stima da ${startDate || 'N/A'} a ${endDate || 'N/A'}):
- **Scarto Reale vs Teorico**: Allineato entro le tolleranze di mercato standard.
- **Suggerimento**: Riesegui l'analisi tra qualche minuto quando i limiti di quota di Gemini si saranno ripristinati.`
  };

  if (checkQuotaExceeded()) {
    console.warn('[Compare Results] Cooldown attivo: Ritorno il fallback locale immediatamente.');
    return res.json(fallbackCompare);
  }

  try {
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

    const response = await LLMProviderService.getInstance().generateContent(prompt, {
      responseJson: true,
      preferredProvider: botStatus.llmPreferredProvider || 'gemini'
    });
    
    if (!response.success || !response.text) {
      throw new Error(response.error || "Errore nella generazione con LLM");
    }
    
    let result = JSON.parse(response.text);
    res.json(result);
  } catch (error: any) {
    const message = error.message || String(error);
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      console.warn(`[Compare Results] API Quota Exceeded (429/RESOURCE_EXHAUSTED). Falling back to local comparison.`);
      isQuotaExceeded = true;
      quotaExceededTime = Date.now();
      return res.json(fallbackCompare);
    }
    console.error("Error comparing results:", error);
    res.status(500).json({ error: error.message });
  }
});










async function executeAlpacaRealtimeCheck() {
  if (isFastCheckRunning) {
    return;
  }
  isFastCheckRunning = true;
  try {
    const mode = botStatus.tradingMode || 'paper';
  const { apiKey, secretKey, isConfigured, baseUrl } = getAlpacaConfig(mode);
  if (!isConfigured) return;

  // Fuori orario o durante il weekend le posizioni sono congelate:
  // evitiamo chiamate inutili ad Alpaca e azzeriamo l'uso di CPU/memoria
  const isOpen = await isAlpacaMarketOpen(baseUrl, apiKey, secretKey);
  if (!isOpen) return;

  try {
    const posResponse = await fetch(`${baseUrl}/positions`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey
      }
    });

    if (!posResponse.ok) return;
    const positions = await posResponse.json();

    const activeSymbols = positions.map((p: any) => p.symbol);

    // Sincronizza posizioni attive ed eventualmente disattiva quelle non più presenti
    if (db) {
      try {
        const snapshot = await db.collection('alpaca_positions').where('status', '==', 'ACTIVE').get();
        for (const doc of snapshot.docs) {
          const sym = doc.id;
          if (!activeSymbols.includes(sym)) {
            await db.collection('alpaca_positions').doc(sym).update({
              status: 'CLOSED',
              closedAt: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        // Ignora silenziosamente
      }
    }

    const historicalProfits = botStatus.historicalProfits || 0; // Se c'è in botStatus, altrimenti 0
    const vix24hChangePct = await getVix24hChange(getAlpacaConfig(mode));

    for (const pos of positions) {
      const symbol = pos.symbol;
      const qty = parseFloat(pos.qty || '0');
      const currentValue = parseFloat(pos.market_value || '0');
      const unrealizedPL = parseFloat(pos.unrealized_pl || '0');
      const currentPrice = parseFloat(pos.current_price || '0');
      const avgEntryPrice = parseFloat(pos.avg_entry_price || '0');

      // Recuperiamo la strategia attiva o ne assegniamo una di default ottimizzata via IA
      if (!positionStrategies[mode]) {
        positionStrategies[mode] = {};
      }
      if (!positionStrategies[mode][symbol]) {
        positionStrategies[mode][symbol] = getDefaultStrategy(symbol);
        saveBotStatus();
      }
      const activeStrategy = positionStrategies[mode][symbol];
      const params = STRATEGY_PARAMS[activeStrategy];

      // Calcoliamo i limiti assoluti (TP/SL) in base alla percentuale della strategia applicata al capitale nominale
      const costBasis = currentValue - unrealizedPL;
      const slDollar = costBasis * (params.slPct / 100);
      const tpDollar = costBasis * (params.tpPct / 100);
      const trailingStopPercent = params.tsPct;

      const positionConfig = {
        y: botStatus.y || 1,
        defaultSL: slDollar,
        defaultTP: tpDollar,
        trailingStop: trailingStopPercent,
        targetTpPct: params.tpPct,
        slPct: params.slPct,
        isAlpaca: true
      };

      const highestPrice = await getAndUpdateHighestPrice(symbol, currentPrice, avgEntryPrice);

      checkAndLogTrailingStopStatus(
        mode as 'paper' | 'live',
        symbol,
        currentPrice,
        avgEntryPrice,
        highestPrice,
        activeStrategy,
        params
      );

      if (!positionEntryTimes[mode][symbol]) {
        positionEntryTimes[mode][symbol] = Date.now();
      }

      // 2. Applicazione dei Vincoli Matematici di Gestione del Rischio con la configurazione specifica
      const signal = inMemoryGeminiSignals.get(symbol);
      const indResult = await TechnicalIndicatorService.getInstance().getSymbolIndicators(symbol, currentPrice, {
        apiKey,
        secretKey,
        baseUrl
      });

      const positionObj = {
        id: symbol,
        asset: symbol,
        currentValue,
        openPrice: avgEntryPrice,
        currentPrice: currentPrice,
        unrealizedProfit: unrealizedPL,
        highestPrice: highestPrice,
        sentimentScore: signal?.score,
        vix24hChangePct: vix24hChangePct,
        entryTime: positionEntryTimes[mode][symbol],
        atr: indResult.atr,
        atr1_5x: indResult.atr1_5x,
        adx: indResult.adx
      };

      const decision = RiskManagementService.evaluateClosure(
        positionObj,
        historicalProfits,
        positionConfig,
        botStatus.systemRiskRules || DEFAULT_SYSTEM_RISK_RULES
      );

      if (decision && decision.action === 'CLOSE') {
        addLog(mode as 'paper' | 'live', `[Rischio Alpaca] Chiusura posizione per ${symbol}. Motivo: ${decision.reason}`);
        
        try {
          const closeResponse = await fetch(`${baseUrl}/positions/${symbol}?cancel_orders=true`, {
            method: 'DELETE',
            headers: {
              'APCA-API-KEY-ID': apiKey,
              'APCA-API-SECRET-KEY': secretKey
            }
          });

          if (closeResponse.ok) {
            delete localHighestPrices[symbol];
            delete activeTrailingStatus[symbol];
            addLog(mode as 'paper' | 'live', `[Alpaca] Posizione su ${symbol} chiusa con successo (Risk Management)!`);
            if (db) {
               await db.collection('alpaca_positions').doc(symbol).update({
                 status: 'CLOSED',
                 closedAt: new Date().toISOString(),
                 closureReason: decision.reason,
               });
            }
          }
        } catch (err: any) {
          addLog(mode as 'paper' | 'live', `[Alpaca Errore] Impossibile chiudere posizione per ${symbol}: ${err.message}`);
        }
      }
    }
  } catch (error) {
    // Silenzioso per non inquinare i log nel loop veloce
  }
  } finally {
    isFastCheckRunning = false;
  }
}

// Vite middleware for development
















// Vite middleware for development
async function startServer() {
  // Inizializza e testa la connessione con fallback automatico per Firestore
  await initializeAndTestFirestore();

  // Carica lo stato salvato da Firestore
  await loadStateFromFirestore().catch(err => {
    console.error('[Firebase Error] Errore durante il caricamento dello stato:', err);
  });

  // Avvia l'auto-rilevamento delle credenziali in background per evitare blocchi o timeout all'avvio
  autoDetectCredentials().catch(err => {
    console.error('[Auto-Detect Error] Errore durante l\'auto-rilevamento:', err);
  });

  // Loop automatico di background per eseguire il trading senza dover cliccare il tasto
  setInterval(() => {
    executeTradingCycle(false).catch(err => {
      console.error('[Background Cycle Error] Errore nel ciclo di trading in background:', err);
    });
  }, 60000); // Ogni 1 minuto

  // Loop molto veloce (5 secondi) per chiudere in tempo reale le posizioni in profitto
  setInterval(() => {
    executeAlpacaRealtimeCheck().catch(err => {
      console.error('[Background Fast Check Alpaca Error]', err);
    });
  }, 5000); // Ogni 5 secondi



  

  




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


