import fs from 'fs';

let code = fs.readFileSync('src/components/TradingModule.tsx', 'utf8');

// Replace xtb-specific URLs with dynamic ones
code = code.replace(/const url = '\/api\/trading\/xtb-status';/g, "const url = `/api/trading/${broker}-status`;");
code = code.replace(/const url = '\/api\/trading\/xtb-trigger';/g, "const url = `/api/trading/${broker}-trigger`;");
code = code.replace(/const url = '\/api\/trading\/xtb-reset-logs';/g, "const url = `/api/trading/${broker}-reset-logs`;");
code = code.replace(/const url = '\/api\/trading\/xtb-reset-balance';/g, "const url = `/api/trading/${broker}-reset-balance`;");
code = code.replace(/const url = '\/api\/trading\/xtb-close-position';/g, "const url = `/api/trading/${broker}-close-position`;");
code = code.replace(/const url = '\/api\/trading\/xtb-settings';/g, "const url = `/api/trading/${broker}-settings`;");

// Replace generic URLs with dynamic ones
code = code.replace(/const url = '\/api\/trading\/account';/g, "const url = `/api/trading/${broker}-account`;");
code = code.replace(/const url = `\/api\/trading\/analysis\/\${instrument}`;/g, "const url = `/api/trading/${broker}-analysis/${instrument}`;");
code = code.replace(/const url = '\/api\/trading\/order';/g, "const url = `/api/trading/${broker}-order`;");

fs.writeFileSync('src/components/TradingModule.tsx', code);
