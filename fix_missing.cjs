const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const missingDecls = `
const PORT = process.env.PORT || 3000;
let localCredentialsFallback: Record<string, any> = {};
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
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}
`;

code = code.replace(/let db: any = null;/, "let db: any = null;\n" + missingDecls);

// also fix getBrokerCredentials error on 4872
// It says "Cannot find name 'getBrokerCredentials'" at 4872, but it's defined at 4617?
// Maybe because it's inside startServer?
// Let's hoist getBrokerCredentials to the top level.
const getBrokerRegex = /async function getBrokerCredentials\([\s\S]*?\}\n\}/;
let match = getBrokerRegex.exec(code);
if (match) {
  code = code.replace(match[0], '');
  code = code.replace(/let db: any = null;/, "let db: any = null;\n" + match[0] + "\n");
}

fs.writeFileSync('server.ts', code);
