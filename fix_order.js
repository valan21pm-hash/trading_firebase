import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const viteBlockRegex = /if \(process\.env\.NODE_ENV !== 'production'\) \{[\s\S]*?res\.sendFile\(path\.join\(distPath, 'index\.html'\)\);\n    \}\);\n  \}/;
const match = code.match(viteBlockRegex);

if (match) {
    const viteBlock = match[0];
    // Remove viteBlock from current position
    code = code.replace(viteBlock, '');
    
    // Insert it right before app.listen(PORT
    code = code.replace(/app\.listen\(PORT/, viteBlock + "\n\n  app.listen(PORT");
    fs.writeFileSync('server.ts', code);
    console.log("Fixed!");
} else {
    console.log("Vite block not found with regex.");
}
