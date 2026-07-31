const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Patch Quick Metrics in AccountPanel
const targetAccountPnL = `{/* Quick Metrics */}
          {account.dailyPnL && account.dailyPnL.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100/80 text-center">
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">PnL Realizzato</div>
                <div className={\`text-sm font-bold font-mono mt-0.5 \${(account.dailyPnL[account.dailyPnL.length - 1]?.realized ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}\`}>
                  {(account.dailyPnL[account.dailyPnL.length - 1]?.realized ?? 0) >= 0 ? '+' : ''}
                  {(account.dailyPnL[account.dailyPnL.length - 1]?.realized ?? 0).toFixed(2)}$
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">PnL Non Realizzato</div>
                <div className={\`text-sm font-bold font-mono mt-0.5 \${(account.dailyPnL[account.dailyPnL.length - 1]?.unrealized ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}\`}>
                  {(account.dailyPnL[account.dailyPnL.length - 1]?.unrealized ?? 0) >= 0 ? '+' : ''}
                  {(account.dailyPnL[account.dailyPnL.length - 1]?.unrealized ?? 0).toFixed(2)}$
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">PnL Totale Netto</div>
                <div className={\`text-sm font-bold font-mono mt-0.5 \${(account.dailyPnL[account.dailyPnL.length - 1]?.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}\`}>
                  {(account.dailyPnL[account.dailyPnL.length - 1]?.pnl ?? 0) >= 0 ? '+' : ''}
                  {(account.dailyPnL[account.dailyPnL.length - 1]?.pnl ?? 0).toFixed(2)}$
                </div>
              </div>
            </div>
          )}`;

const replaceAccountPnL = `{/* Quick Metrics */}
          {account.dailyPnL && account.dailyPnL.length > 0 && (() => {
            const lastDay = account.dailyPnL[account.dailyPnL.length - 1];
            const prevDay = account.dailyPnL.length > 1 ? account.dailyPnL[account.dailyPnL.length - 2] : null;

            const totalRealized = lastDay?.realized ?? 0;
            const totalUnrealized = lastDay?.unrealized ?? 0;
            const totalPnL = lastDay?.pnl ?? 0;

            const dailyRealized = prevDay ? (totalRealized - (prevDay.realized ?? 0)) : totalRealized;
            const dailyUnrealized = totalUnrealized;
            const dailyTotalPnL = dailyRealized + dailyUnrealized;

            return (
              <div className="mt-4 pt-3 border-t border-gray-100/80 space-y-3">
                {/* Riga 1: Totale Cumulativo (Storico) */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">PnL Realizzato</div>
                    <div className={\`text-xs font-bold font-mono mt-0.5 \${totalRealized >= 0 ? 'text-green-600' : 'text-red-600'}\`}>
                      {totalRealized >= 0 ? '+' : ''}{totalRealized.toFixed(2)}$
                    </div>
                  </div>
                  <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">PnL Non Realizzato</div>
                    <div className={\`text-xs font-bold font-mono mt-0.5 \${totalUnrealized >= 0 ? 'text-green-600' : 'text-red-600'}\`}>
                      {totalUnrealized >= 0 ? '+' : ''}{totalUnrealized.toFixed(2)}$
                    </div>
                  </div>
                  <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">PnL Totale Netto</div>
                    <div className={\`text-xs font-bold font-mono mt-0.5 \${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}\`}>
                      {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}$
                    </div>
                  </div>
                </div>

                {/* Riga 2: Giornaliero (Oggi fino a questo momento) */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/80">
                    <div className="text-[10px] text-emerald-900/80 font-semibold uppercase tracking-wider">PnL Giornaliero Realizzato</div>
                    <div className={\`text-xs font-bold font-mono mt-0.5 \${dailyRealized >= 0 ? 'text-green-600' : 'text-red-600'}\`}>
                      {dailyRealized >= 0 ? '+' : ''}{dailyRealized.toFixed(2)}$
                    </div>
                  </div>
                  <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/80">
                    <div className="text-[10px] text-emerald-900/80 font-semibold uppercase tracking-wider">PnL Giornaliero Non Realizzato</div>
                    <div className={\`text-xs font-bold font-mono mt-0.5 \${dailyUnrealized >= 0 ? 'text-green-600' : 'text-red-600'}\`}>
                      {dailyUnrealized >= 0 ? '+' : ''}{dailyUnrealized.toFixed(2)}$
                    </div>
                  </div>
                  <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/80">
                    <div className="text-[10px] text-emerald-900/80 font-semibold uppercase tracking-wider">PnL Totale Netto Giornaliero</div>
                    <div className={\`text-xs font-bold font-mono mt-0.5 \${dailyTotalPnL >= 0 ? 'text-green-600' : 'text-red-600'}\`}>
                      {dailyTotalPnL >= 0 ? '+' : ''}{dailyTotalPnL.toFixed(2)}$
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}`;

if (content.includes(targetAccountPnL)) {
  content = content.replace(targetAccountPnL, replaceAccountPnL);
  console.log('Account Panel PnL replaced successfully!');
} else {
  console.log('Account Panel PnL target NOT found!');
}

// 2. Patch Storico Operazioni Chiuse
const targetClosedSection = `          {!isClosedOperationsCollapsed && (
            <>
          {/* Sommario Metriche Periodo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Operazioni Chiuse</span>
              <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">{closedTrades.length}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Modalità Attuale</span>
              <p className="text-sm font-bold text-indigo-700 font-mono mt-1 uppercase">{selectedTab === 'live' ? 'Reale (Live)' : 'Simulazione (Paper)'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Intervallo Date</span>
              <p className="text-xs font-semibold text-slate-700 font-mono mt-1">
                {closedStartDate ? closedStartDate : 'Inizio'} → {closedEndDate ? closedEndDate : 'Oggi'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Simbolo Filtrato</span>
              <p className="text-sm font-bold text-slate-800 font-mono mt-1">{closedSymbolFilter || 'TUTTI'}</p>
            </div>
          </div>
          {/* Tabella Dati Operazioni Chiuse */}
          {closedLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center gap-2">
              <RotateCcw className="w-5 h-5 animate-spin text-emerald-600" />
              Caricamento operazioni chiuse nel periodo selezionato...
            </div>
          ) : closedTrades.length > 0 ? (
            <div className="overflow-x-auto bg-slate-50/50 rounded-xl border border-slate-200/60 shadow-inner">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="p-3">Data / Ora Chiusura</th>
                    <th className="p-3">Simbolo</th>
                    <th className="p-3">Azione</th>
                    <th className="p-3 text-right">Quantità</th>
                    <th className="p-3 text-right">Prezzo Uscita</th>
                    <th className="p-3 text-right">Controvalore Totale</th>
                    <th className="p-3">Motivazione Chiusura / Origine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {closedTrades.map((trade, idx) => (
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
                      <td className="p-3 text-right font-mono font-medium">
                        {trade.qty > 0 ? trade.qty.toFixed(4) : 'N/D'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-900">
                        {trade.price > 0 ? \`$\${trade.price.toFixed(2)}\` : 'N/D'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {trade.totalValue > 0 ? \`$\${parseFloat(trade.totalValue).toFixed(2)}\` : 'N/D'}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5 max-w-sm">
                          <span className="text-slate-800 font-semibold text-xs leading-tight">
                            {trade.reason || 'Chiusura posizione'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Origine: {trade.source || 'Sistema'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (`;

const replaceClosedSection = `          {!isClosedOperationsCollapsed && (() => {
            const periodSaldoPnL = closedTrades.reduce((acc, t) => {
              const val = typeof t.pnl === 'number' ? t.pnl : (t.pnl ? parseFloat(t.pnl) : 0);
              return acc + val;
            }, 0);

            return (
            <>
          {/* Sommario Metriche Periodo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
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
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Modalità Attuale</span>
              <p className="text-sm font-bold text-indigo-700 font-mono mt-1 uppercase">{selectedTab === 'live' ? 'Reale (Live)' : 'Simulazione (Paper)'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Intervallo Date</span>
              <p className="text-xs font-semibold text-slate-700 font-mono mt-1">
                {closedStartDate ? closedStartDate : 'Inizio'} → {closedEndDate ? closedEndDate : 'Oggi'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Simbolo Filtrato</span>
              <p className="text-sm font-bold text-slate-800 font-mono mt-1">{closedSymbolFilter || 'TUTTI'}</p>
            </div>
          </div>
          {/* Tabella Dati Operazioni Chiuse */}
          {closedLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center gap-2">
              <RotateCcw className="w-5 h-5 animate-spin text-emerald-600" />
              Caricamento operazioni chiuse nel periodo selezionato...
            </div>
          ) : closedTrades.length > 0 ? (
            <div className="overflow-x-auto bg-slate-50/50 rounded-xl border border-slate-200/60 shadow-inner">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="p-3">Data / Ora Chiusura</th>
                    <th className="p-3">Simbolo</th>
                    <th className="p-3">Azione</th>
                    <th className="p-3 text-right">Profitto / Perdita</th>
                    <th className="p-3 text-right">Quantità</th>
                    <th className="p-3 text-right">Prezzo Uscita</th>
                    <th className="p-3 text-right">Controvalore Totale</th>
                    <th className="p-3">Motivazione Chiusura / Origine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {closedTrades.map((trade, idx) => {
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
                        <td className="p-3 text-right font-mono font-medium">
                          {trade.qty > 0 ? trade.qty.toFixed(4) : 'N/D'}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-900">
                          {trade.price > 0 ? \`$\${trade.price.toFixed(2)}\` : 'N/D'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {trade.totalValue > 0 ? \`$\${parseFloat(trade.totalValue).toFixed(2)}\` : 'N/D'}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5 max-w-sm">
                            <span className="text-slate-800 font-semibold text-xs leading-tight">
                              {trade.reason || 'Chiusura posizione'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Origine: {trade.source || 'Sistema'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (`;

if (content.includes(targetClosedSection)) {
  content = content.replace(targetClosedSection, replaceClosedSection);
  console.log('Closed Section replaced successfully!');
} else {
  console.log('Closed Section target NOT found!');
}

fs.writeFileSync('src/App.tsx', content);
