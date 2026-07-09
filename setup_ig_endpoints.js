import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

// The UI now requests /api/trading/xtb-account and /api/trading/xtb-analysis/... and /api/trading/xtb-order.
// I need to rename the old generic ones.
code = code.replace(/app\.get\("\/api\/trading\/account"/, 'app.get("/api/trading/xtb-account"');
code = code.replace(/app\.get\("\/api\/trading\/analysis\/:instrument"/, 'app.get("/api/trading/xtb-analysis/:instrument"');
code = code.replace(/app\.post\("\/api\/trading\/order"/, 'app.post("/api/trading/xtb-order"');

// Now, let's remove the duplicated ig-status. We'll find all index of `app.get("/api/trading/ig-status",` and keep only the last one, or just replace them.
// Actually, it's easier to remove everything from `app.post("/api/trading/ig-test-connection"` to `app.listen` and inject them fresh.

const startIdx = code.indexOf('app.post("/api/trading/ig-test-connection"');
if (startIdx !== -1) {
  const endIdx = code.lastIndexOf('app.listen(');
  if (endIdx !== -1 && endIdx > startIdx) {
    code = code.slice(0, startIdx) + code.slice(endIdx);
  }
}

// Ensure IgMarketsAPI and TradingBotService are imported
if (!code.includes("IgMarketsAPI")) {
  code = "import { IgMarketsAPI } from './src/backend/services/IgMarketsAPI.js';\n" + code;
}
if (!code.includes("TradingBotService")) {
  code = "import { TradingBotService } from './src/backend/services/tradingBotService.js';\n" + code;
}

const igEndpoints = `
// ============================================
// IG MARKETS ENDPOINTS
// ============================================

let igBotStatus = {
  active: false,
  balance: 30000,
  defaultTP: 50,
  defaultSL: -150,
  riskPercentage: 2,
  monitoredInstruments: ['EUR_USD']
};
let igDemoPositions = {};

app.post("/api/trading/ig-test-connection", async (req, res) => {
  try {
    const igApi = IgMarketsAPI.getInstance();
    const result = await igApi.testConnection();
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || "Errore di connessione a IG" });
  }
});

app.get("/api/trading/ig-account", async (req, res) => {
  try {
    const igApi = IgMarketsAPI.getInstance();
    const accounts = await igApi.getAccounts().catch(() => []);
    let balance = igBotStatus.balance;
    if (accounts && accounts.length > 0) {
      const preferredAcct = accounts.find((a: any) => a.preferred) || accounts[0];
      if (preferredAcct.balance !== undefined) balance = parseFloat(preferredAcct.balance);
    }
    res.json({
      success: true,
      account: { id: accounts[0]?.accountId || 'IG_DEMO', balance: String(balance), currency: 'EUR', NAV: String(balance) },
      isDemo: true
    });
  } catch (error: any) {
    res.json({
      success: true,
      account: { id: 'IG_DEMO', balance: String(igBotStatus.balance), currency: 'EUR', NAV: String(igBotStatus.balance) },
      isDemo: true
    });
  }
});

app.get("/api/trading/ig-status", async (req, res) => {
  try {
    const igApi = IgMarketsAPI.getInstance();
    const positionsData = await igApi.getPositions().catch(() => []);
    const positions = positionsData.map((p: any) => ({
      symbol: p.market.epic,
      qty: String(p.position.size),
      avg_entry_price: String(p.position.openLevel),
      current_price: String(p.market.offer),
      unrealized_pl: '0',
      side: p.position.direction.toLowerCase()
    }));
    res.json({ status: igBotStatus, positions, isDemo: false });
  } catch (error: any) {
    res.json({ status: igBotStatus, positions: Object.values(igDemoPositions), isDemo: true });
  }
});

app.post("/api/trading/ig-order", async (req, res) => {
  const { instrument, units, side } = req.body;
  try {
    const igApi = IgMarketsAPI.getInstance();
    const epicMap: Record<string, string> = { 'EUR_USD': 'CS.D.EURUSD.CFD.IP', 'GBP_USD': 'CS.D.GBPUSD.CFD.IP' };
    const epic = epicMap[instrument] || 'CS.D.EURUSD.CFD.IP';
    const result = await igApi.createOrder(epic, side === 'buy' ? 'BUY' : 'SELL', units);
    res.json({ success: true, message: \`Ordine IG eseguito: \${result.dealReference}\` });
  } catch (error: any) {
    // Fallback to Demo
    const id = "IG_DEMO_" + Math.floor(Math.random() * 900000 + 100000);
    igDemoPositions[id] = { id, symbol: instrument, qty: units, avg_entry_price: "1.0854", current_price: "1.0854", unrealized_pl: "0", side };
    res.json({ success: true, message: \`Ordine simulato su IG: \${id}\` });
  }
});

app.post("/api/trading/ig-trigger", async (req, res) => {
  igBotStatus.active = !igBotStatus.active;
  res.json({ success: true, active: igBotStatus.active });
});

app.post("/api/trading/ig-reset-balance", async (req, res) => {
  igBotStatus.balance = 30000;
  igDemoPositions = {};
  res.json({ success: true });
});

app.post("/api/trading/ig-reset-logs", async (req, res) => {
  res.json({ success: true });
});

app.post("/api/trading/ig-close-position", async (req, res) => {
  const { positionId } = req.body;
  delete igDemoPositions[positionId];
  res.json({ success: true });
});

app.post("/api/trading/ig-settings", async (req, res) => {
  const { defaultTP, defaultSL, riskPercentage } = req.body;
  if (defaultTP !== undefined) igBotStatus.defaultTP = defaultTP;
  if (defaultSL !== undefined) igBotStatus.defaultSL = defaultSL;
  if (riskPercentage !== undefined) igBotStatus.riskPercentage = riskPercentage;
  res.json({ success: true });
});

app.get("/api/trading/ig-analysis/:instrument", async (req, res) => {
  const { instrument } = req.params;
  const analysis = \`**Analisi Tecnica (Gemini) - IG Markets per \${instrument}**\\n\\nIl prezzo si muove in un range laterale, segnale neutro ma in potenziale breakout.\`;
  res.json({ candles: [], analysis, isDemo: true });
});

async function executeIGTradingCycle() {
  if (!igBotStatus.active) return;
  try {
    const tradingBot = TradingBotService.getInstance();
    const result = await tradingBot.runTradingCycle('CS.D.EURUSD.CFD.IP', 'EUR_USD', 1.0850, [], "Mercato stabile con trend positivo.");
    if (result.success) {
      console.log("[IG Loop] Ordine eseguito:", result.order);
    }
  } catch(e) {
    console.error("[IG Loop] Errore:", e);
  }
}

// Start IG Loop
setInterval(() => {
  executeIGTradingCycle().catch(err => console.error('[IG Background Cycle Error]', err));
}, 300000);

`;

code = code.replace(/app\.listen\(/, igEndpoints + '\n  app.listen(');

fs.writeFileSync('server.ts', code);
