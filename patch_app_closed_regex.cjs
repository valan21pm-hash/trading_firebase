const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{!\s*isClosedOperationsCollapsed\s*&&\s*\(\s*<>\s*\{\/\* Sommario Metriche Periodo \*\/\}/;

const replace = `{!isClosedOperationsCollapsed && (() => {
            const periodSaldoPnL = closedTrades.reduce((acc, t) => {
              const val = typeof t.pnl === 'number' ? t.pnl : (t.pnl ? parseFloat(t.pnl) : 0);
              return acc + val;
            }, 0);

            return (
            <>
          {/* Sommario Metriche Periodo */}`;

if (regex.test(content)) {
  content = content.replace(regex, replace);
  console.log('Match 1 replaced!');
} else {
  console.log('Match 1 NOT found!');
}

// Cards replace
const cardRegex = /<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">\s*<div className="bg-slate-50 p-3 rounded-xl border border-slate-100">\s*<span className="text-\[11px\] font-medium text-slate-500 uppercase tracking-wider">Operazioni Chiuse<\/span>\s*<p className="text-lg font-bold text-slate-900 font-mono mt-0\.5">\{closedTrades\.length\}<\/p>\s*<\/div>\s*<div className="bg-slate-50 p-3 rounded-xl border border-slate-100">\s*<span className="text-\[11px\] font-medium text-slate-500 uppercase tracking-wider">Modalità Attuale<\/span>/;

const cardReplace = `<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Operazioni Chiuse</span>
              <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">{closedTrades.length}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Saldo PnL Periodo</span>
              <p className={\`text-lg font-bold font-mono mt-0.5 \${periodSaldoPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}\`}>
                {periodSaldoPnL >= 0 ? '+' : ''}\${periodSaldoPnL.toFixed(2)}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Modalità Attuale</span>`;

if (cardRegex.test(content)) {
  content = content.replace(cardRegex, cardReplace);
  console.log('Match 2 replaced!');
} else {
  console.log('Match 2 NOT found!');
}

// Table headers
const headRegex = /<th className="p-3">Data \/ Ora Chiusura<\/th>\s*<th className="p-3">Simbolo<\/th>\s*<th className="p-3">Azione<\/th>\s*<th className="p-3 text-right">Quantità<\/th>/;

const headReplace = `<th className="p-3">Data / Ora Chiusura</th>
                    <th className="p-3">Simbolo</th>
                    <th className="p-3">Azione</th>
                    <th className="p-3 text-right">Profitto / Perdita</th>
                    <th className="p-3 text-right">Quantità</th>`;

if (headRegex.test(content)) {
  content = content.replace(headRegex, headReplace);
  console.log('Match 3 replaced!');
} else {
  console.log('Match 3 NOT found!');
}

// Table body
const bodyRegex = /\{closedTrades\.map\(\(trade, idx\) => \(\s*<tr key=\{trade\.id \|\| idx\} className="hover:bg-slate-100\/40 transition-colors">\s*<td className="p-3 text-slate-500 font-mono whitespace-nowrap">\s*\{new Date\(trade\.timestamp\)\.toLocaleString\('it-IT'\)\}\s*<\/td>\s*<td className="p-3 font-bold text-slate-900 font-mono text-sm">\{trade\.symbol\}<\/td>\s*<td className="p-3">\s*<span className="px-2\.5 py-0\.5 rounded-full text-\[10px\] font-bold bg-red-100 text-red-700 border border-red-200\/60">\s*\{trade\.action \|\| 'VENDITA'\}\s*<\/span>\s*<\/td>\s*<td className="p-3 text-right font-mono font-medium">/;

const bodyReplace = `{closedTrades.map((trade, idx) => {
                    const pnlVal = typeof trade.pnl === 'number' ? trade.pnl : (trade.pnl ? parseFloat(trade.pnl) : 0);
                    const isPos = pnlVal >= 0;
                    return (
                    <tr key={trade.id || idx} className="hover:bg-slate-100/40 transition-colors">
                      <td className="p-3 text-slate-500 font-mono whitespace-nowrap">
                        {new Date(trade.timestamp).toLocaleString('it-IT')}
                      </td>
                      <td className="p-3 font-bold text-slate-900 font-mono text-sm">{trade.symbol}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200/60">
                          {trade.action || 'VENDITA'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={\`px-2 py-0.5 rounded-md text-xs font-bold inline-flex items-center gap-0.5 \${
                          isPos 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                        }\`}>
                          {isPos ? '+' : ''}\${pnlVal.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-medium">`;

if (bodyRegex.test(content)) {
  content = content.replace(bodyRegex, bodyReplace);
  console.log('Match 4 replaced!');
} else {
  console.log('Match 4 NOT found!');
}

// Close function wrapper before end of section
const closeWrapRegex = /Nessuna operazione chiusa registrata nel periodo selezionato \(\{closedStartDate \|\| 'Inizio'\} - \{closedEndDate \|\| 'Oggi'\}\)\.\s*<\/div>\s*\)\}\s*<\/>\s*\)/;

const closeWrapReplace = `Nessuna operazione chiusa registrata nel periodo selezionato ({closedStartDate || 'Inizio'} - {closedEndDate || 'Oggi'}).
            </div>
          )}
            </>
            );
          })()`;

if (closeWrapRegex.test(content)) {
  content = content.replace(closeWrapRegex, closeWrapReplace);
  console.log('Match 5 replaced!');
} else {
  console.log('Match 5 NOT found!');
}

fs.writeFileSync('src/App.tsx', content);
