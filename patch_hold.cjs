const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const holdLog = `
        addLogicLog(mode, {
          timestamp: new Date().toISOString(),
          symbol,
          action: 'HOLD',
          reasoning: \`Sentiment score: \${sentimentScore.toFixed(2)} - \${sentimentReasoning}\`
        });
        sendToGoogleSheets({
`;

content = content.replace("        sendToGoogleSheets({\n          eventType: 'trade_action',\n          mode,\n          symbol,\n          action: 'HOLD',", holdLog + "          eventType: 'trade_action',\n          mode,\n          symbol,\n          action: 'HOLD',");

fs.writeFileSync('server.ts', content);
