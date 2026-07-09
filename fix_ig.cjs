const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importGemini = `import { GeminiSignalService } from './src/backend/services/geminiSignalService.js';\n`;
if (!code.includes('GeminiSignalService')) {
  code = importGemini + code;
}

const igDeclarationsRegex = /let igBotStatus = \{[\s\S]*?\};/g;
let match = igDeclarationsRegex.exec(code);
if (match) {
  code = code.replace(match[0], '');
}

const igDemoPositionsRegex = /let igDemoPositions: Record<string, \{[\s\S]*?}> = \{\};/g;
match = igDemoPositionsRegex.exec(code);
if (match) {
  code = code.replace(match[0], '');
}

const addIgLogRegex = /function addIgLog\([\s\S]*?\}\n\}/g;
match = addIgLogRegex.exec(code);
if (match) {
  code = code.replace(match[0], '');
}

const addIgLogicLogRegex = /function addIgLogicLog\([\s\S]*?\}\n\}/g;
match = addIgLogicLogRegex.exec(code);
if (match) {
  code = code.replace(match[0], '');
}

const getPipSizeRegex = /function getPipSizeAndFactor\([\s\S]*?\}\n\}/g;
match = getPipSizeRegex.exec(code);
if (match) {
  code = code.replace(match[0], '');
}

const initIgApiRegex = /async function initIgApi\([\s\S]*?\}\n\}/g;
match = initIgApiRegex.exec(code);
let initIgApiContent = '';
if (match) {
  initIgApiContent = match[0];
  code = code.replace(match[0], '');
}

const dbDef = "let db: any = null;\n";
const igDeclarations = `
let igBotStatus = {
  active: false,
  balance: 30000,
  defaultTP: 50,
  defaultSL: -150,
  trailingStop: 0,
  timeframe: 15,
  riskPercentage: 2,
  monitoredInstruments: ['EUR_USD'],
  logs: [] as string[],
  logicLogs: [] as any[]
};
let igDemoPositions: Record<string, {
  id: string;
  symbol: string;
  qty: number;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  side: 'buy' | 'sell';
  stopLevel: number;
  limitLevel: number;
  highestPrice: number;
  lowestPrice: number;
  stopLossDistance: number;
  takeProfitDistance: number;
  trailingStopDistance: number;
}> = {};

function addIgLog(message: string) {
  const timestamp = new Date().toISOString();
  const logMsg = \`[\${timestamp}] \${message}\`;
  if (!igBotStatus.logs) igBotStatus.logs = [];
  igBotStatus.logs.unshift(logMsg);
  if (igBotStatus.logs.length > 1000) igBotStatus.logs = igBotStatus.logs.slice(0, 1000);

  if (db) {
    db.collection('ig_operational_logs').add({
      message: message,
      timestamp: timestamp
    }).catch((err: any) => console.error('[Firebase] Error saving IG operational log:', err));
  }
}

function addIgLogicLog(log: { timestamp: string; instrument: string; action: string; reasoning: string; price?: number }) {
  if (!igBotStatus.logicLogs) igBotStatus.logicLogs = [];
  igBotStatus.logicLogs.push(log);
  if (igBotStatus.logicLogs.length > 500) {
    igBotStatus.logicLogs = igBotStatus.logicLogs.slice(-500);
  }

  if (db) {
    db.collection('ig_logic_logs').add({
      timestamp: log.timestamp,
      instrument: log.instrument,
      action: log.action,
      reasoning: log.reasoning,
      price: log.price || null
    }).catch((err: any) => console.error('[Firebase] Error saving IG logic log:', err));
  }
}

function getPipSizeAndFactor(symbol: string, price: number) {
  const sym = symbol.toUpperCase();
  if (sym.includes('JPY') || sym.includes('XAU') || sym.includes('GLD') || sym.includes('GOLD') || price > 50) {
    return { pipSize: 0.01, pipFactor: 100 };
  }
  return { pipSize: 0.0001, pipFactor: 10000 };
}

`;

code = code.replace(dbDef, dbDef + igDeclarations + initIgApiContent + '\n');

fs.writeFileSync('server.ts', code);
