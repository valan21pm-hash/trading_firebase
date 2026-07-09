const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const declarations = `
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
`;

code = code.replace(/let db: any = null;/, "let db: any = null;\n" + declarations);
fs.writeFileSync('server.ts', code);
