const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const appPostRegex = /app\.post\("\/api\/trading\/ig-test-connection"[\s\S]*?\}\n\}\n/;
let match = appPostRegex.exec(code);
let appPostContent = '';
if (match) {
  appPostContent = match[0];
  code = code.replace(match[0], '');
}

const appExpressRegex = /const app = express\(\);/;
code = code.replace(appExpressRegex, "const app = express();\n\n" + appPostContent);

const initIgApiRegex = /async function initIgApi\([\s\S]*?\}\n\}/;
match = initIgApiRegex.exec(code);
let initIgApiContent = '';
if (match) {
  initIgApiContent = match[0];
  code = code.replace(match[0], '');
}

// put it before app.post("/api/trading/ig-test-connection"
code = code.replace(appPostContent, initIgApiContent + '\n\n' + appPostContent);

const geminiSignalImport = "import { GeminiSignalService } from './src/backend/services/geminiSignalService.js';";
const geminiSignalImportTS = "import { GeminiSignalService } from './src/backend/services/geminiSignalService';";
if (!code.includes("import { GeminiSignalService }")) {
  code = geminiSignalImport + '\n' + code;
}

fs.writeFileSync('server.ts', code);
