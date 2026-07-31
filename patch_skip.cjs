const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const skipLog = `          addLogicLog(mode, {
            timestamp: new Date().toISOString(),
            symbol: order.symbol,
            action: 'SKIP',
            reasoning: \`Potere d'acquisto insufficiente ($ \${currentBuyingPower.toFixed(2)} rimasti, richiesti $ \${order.amount.toFixed(2)})\`
          });
          continue;`;

content = content.replace("          continue;", skipLog);

fs.writeFileSync('server.ts', content);
