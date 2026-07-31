const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const target = `    // 1. Dati da Alpaca Activities (FILL side === sell)
    if (conf.isConfigured) {
      try {
        const actResponse = await fetch(\`\${conf.baseUrl}/account/activities?activity_types=FILL\`, {
          headers: {
            'APCA-API-KEY-ID': conf.apiKey,
            'APCA-API-SECRET-KEY': conf.secretKey
          }
        });
        if (actResponse.ok) {
          const fills = await actResponse.json();
          if (Array.isArray(fills)) {
            const sellFills = fills.filter((f: any) => (f.side || '').toLowerCase() === 'sell');
            for (const f of sellFills) {
              const qty = parseFloat(f.qty || '0');
              const price = parseFloat(f.price || '0');
              const timestamp = f.transaction_time || f.timestamp || new Date().toISOString();
              closedTrades.push({
                id: f.id || \`fill_\${timestamp}_\${f.symbol}\`,
                symbol: f.symbol,
                action: 'VENDITA',
                qty,
                price,
                totalValue: (qty * price).toFixed(2),
                timestamp,
                reason: f.type || 'Esecuzione Ordine di Vendita (Alpaca)',
                source: 'Alpaca Fill'
              });
            }
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
          closedTrades.push({
            id: \`fs_\${doc.id}_\${timestamp}\`,
            symbol: data.symbol || doc.id,
            action: 'CHIUSURA POSIZIONE',
            qty: data.qty || 1,
            price: data.highestPrice || 0,
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
        closedTrades.push({
          id: \`log_\${timestamp}_\${log.symbol}\`,
          symbol: log.symbol,
          action: 'SEGNALE CHIUSURA IA',
          qty: 0,
          price: parseFloat(log.price || '0'),
          totalValue: 0,
          timestamp,
          reason: log.reasoning || log.reason || 'Chiusura da analisi sentiment IA',
          source: 'IA Decision Log'
        });
      }
    }`;

const replace = `    // 1. Dati da Alpaca Activities (FILL side === sell)
    if (conf.isConfigured) {
      try {
        const actResponse = await fetch(\`\${conf.baseUrl}/account/activities?activity_types=FILL\`, {
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
                    id: f.id || \`fill_\${timestamp}_\${sym}\`,
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
            id: \`fs_\${doc.id}_\${timestamp}\`,
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
          id: \`log_\${timestamp}_\${log.symbol}\`,
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
    }`;

if (content.includes(target)) {
  content = content.replace(target, replace);
  fs.writeFileSync('server.ts', content);
  console.log('patched server.ts successfully!');
} else {
  console.error('Target in server.ts not found');
}
