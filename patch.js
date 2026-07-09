import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const target = `async function executeTradingCycle(force: boolean = false) {
  const anyActive = botStatus.active || xtbBotStatus.active;
  if (!anyActive && !force) {
    addLog('system', \`[System] Ciclo di trading ignorato: nessun bot attivo.\`);
    return;
  }
  
  if (botStatus.active || force) {
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
      addLog('system', \`[Alpaca] Nessun conto attivo per il trading.\`);
    }
  }

  if (xtbBotStatus.active || force) {
    await executeXtbTradingCycle(force);
  }
  
}`;

const replacement = `let lastAlpacaRunTime = 0;
let lastXtbRunTime = 0;

async function executeTradingCycle(force: boolean = false) {
  const anyActive = botStatus.active || xtbBotStatus.active;
  if (!anyActive && !force) {
    addLog('system', \`[System] Ciclo di trading ignorato: nessun bot attivo.\`);
    return;
  }
  
  const now = Date.now();

  if (botStatus.active || force) {
    const alpacaTimeframeMs = (botStatus.timeframe || 15) * 60 * 1000;
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
        addLog('system', \`[Alpaca] Nessun conto attivo per il trading.\`);
      }
    } else {
      addLog('system', \`[Alpaca] Attesa timeframe (\${botStatus.timeframe || 15} min)...\`);
    }
  }

  if (xtbBotStatus.active || force) {
    const xtbTimeframeMs = (xtbBotStatus.timeframe || 15) * 60 * 1000;
    if (force || lastXtbRunTime === 0 || (now - lastXtbRunTime >= xtbTimeframeMs)) {
      lastXtbRunTime = now;
      await executeXtbTradingCycle(force);
    } else {
      addXtbLog(\`[XTB] Attesa timeframe (\${xtbBotStatus.timeframe || 15} min)...\`);
    }
  }
}`;

if (code.includes(target)) {
  fs.writeFileSync('server.ts', code.replace(target, replacement));
  console.log('Replaced successfully');
} else {
  console.log('Target not found, checking with regex');
  
  const regex = /async function executeTradingCycle\(force: boolean = false\) \{([\s\S]*?)await executeXtbTradingCycle\(force\);\n  \}\n\s*\}/m;
  if (regex.test(code)) {
    fs.writeFileSync('server.ts', code.replace(regex, replacement));
    console.log('Replaced with regex');
  } else {
    console.log('Still not found');
  }
}
