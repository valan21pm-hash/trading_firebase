import fs from 'fs';

let code = fs.readFileSync('src/components/TradingModule.tsx', 'utf8');
code = code.replace(/\$\{broker\}/g, "${activeBroker}");

// Except in functions where broker is an argument
code = code.replace(/fetchAccount = async \(broker = activeBroker\) => \{\n\s+setLoadingAccount\(true\);\n\s+try \{\n\s+const url = `\/api\/trading\/\$\{activeBroker\}-account`;/g, 
"fetchAccount = async (broker = activeBroker) => {\n    setLoadingAccount(true);\n    try {\n      const url = `/api/trading/${broker}-account`;");

code = code.replace(/fetchAnalysisAndCandles = async \(instrument: string, broker = activeBroker\) => \{\n\s+setLoadingAnalysis\(true\);\n\s+setErrorMessage\(null\);\n\s+try \{\n\s+const url = `\/api\/trading\/\$\{activeBroker\}-analysis\/\$\{instrument\}`;/g, 
"fetchAnalysisAndCandles = async (instrument: string, broker = activeBroker) => {\n    setLoadingAnalysis(true);\n    setErrorMessage(null);\n    try {\n      const url = `/api/trading/${broker}-analysis/${instrument}`;");

fs.writeFileSync('src/components/TradingModule.tsx', code);
