import { useEffect, useState } from 'react';
import { Play, Square, Activity, Wallet, Clock, RotateCcw, BookOpen, MessageSquare, TrendingUp, BarChart2, X, Trash2, Copy, Check, Sparkles, Brain } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import ReactMarkdown from 'react-markdown';
import type { BotStateResponse, BotStatus, AccountData } from './types';

const formatDate = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${parts[2]} ${months[monthIdx]}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/95 backdrop-blur-xs text-white p-3 rounded-lg border border-gray-800 shadow-xl text-xs">
        <p className="font-semibold text-gray-400 mb-1.5">{formatDate(label)}</p>
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between gap-6 py-0.5">
            <span className="flex items-center gap-1.5 font-medium text-gray-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.stroke || item.color }} />
              {item.name}:
            </span>
            <span className={`font-mono font-semibold ${item.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {item.value >= 0 ? '+' : ''}{item.value.toFixed(2)}$
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function AccountPanel({ 
  account, 
  title, 
  isActive, 
  type, 
  onToggle,
  onClosePosition,
  closingSymbols,
  confirmCloseSymbol,
  setConfirmCloseSymbol
}: { 
  account: AccountData; 
  title: string; 
  isActive: boolean; 
  type: 'paper' | 'live'; 
  onToggle: (type: 'paper' | 'live') => void;
  onClosePosition: (symbol: string, type: 'paper' | 'live') => Promise<void>;
  closingSymbols: string[];
  confirmCloseSymbol: { symbol: string; type: 'paper' | 'live' } | null;
  setConfirmCloseSymbol: (state: { symbol: string; type: 'paper' | 'live' } | null) => void;
}) {
  if (!account) return null;

  return (
    <div className={`flex-1 border rounded-xl overflow-hidden ${type === 'live' ? 'border-emerald-200' : 'border-indigo-200'} bg-white shadow-sm`}>
      <div className={`p-4 border-b ${type === 'live' ? 'bg-emerald-50 border-emerald-100' : 'bg-indigo-50 border-indigo-100'} flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center`}>
        <div className="flex items-center gap-3">
            <h2 className={`font-semibold ${type === 'live' ? 'text-emerald-800' : 'text-indigo-800'} flex items-center gap-2`}>
              {type === 'live' ? <TrendingUp className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
              {title}
            </h2>
            <span className={`px-2 py-1 text-xs font-bold rounded-md ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {isActive ? 'ATTIVO' : 'FERMO'}
            </span>
        </div>
        <button
            onClick={() => onToggle(type)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            isActive
                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                : type === 'live' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
        >
            {isActive ? (
            <><Square className="w-4 h-4 fill-current" /> Ferma Bot {type === 'live' ? 'Live' : 'Paper'}</>
            ) : (
            <><Play className="w-4 h-4 fill-current" /> Avvia Bot {type === 'live' ? 'Live' : 'Paper'}</>
            )}
        </button>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">Saldo Equity</div>
          <div className="text-2xl font-bold text-gray-900">${(account.balance ?? 0).toFixed(2)}</div>
        </div>

        <div className="flex justify-between items-center text-sm">
          <div className="text-gray-500">Broker</div>
          <div className={`font-medium ${account.isConfigured ? 'text-green-600' : 'text-amber-600'}`}>
            {account.modeLabel}
          </div>
        </div>

        {/* Grafico P&L Realizzato e Non Realizzato */}
        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-gray-500" />
                Andamento Storico P&L
              </h3>
              <p className="text-[11px] text-gray-500">Confronto tra profitti/perdite realizzati e posizioni aperte</p>
            </div>
            {/* Legenda personalizzata */}
            <div className="flex gap-4 text-[10px] font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
                <span className="text-gray-600">Realizzato</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-sky-400 inline-block"></span>
                <span className="text-gray-600">Non Realizzato</span>
              </div>
            </div>
          </div>

          <div className="h-60 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={account.dailyPnL || []}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorUnrealized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(val) => `${val >= 0 ? '+' : ''}${val}$`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="realized" 
                  name="P&L Realizzato"
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRealized)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="unrealized" 
                  name="P&L Non Realizzato"
                  stroke="#0ea5e9" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorUnrealized)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metrics */}
          {account.dailyPnL && account.dailyPnL.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100/80 text-center">
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">PnL Realizzato</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${(account.dailyPnL[account.dailyPnL.length - 1].realized ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(account.dailyPnL[account.dailyPnL.length - 1].realized ?? 0) >= 0 ? '+' : ''}
                  {(account.dailyPnL[account.dailyPnL.length - 1].realized ?? 0).toFixed(2)}$
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">PnL Non Realizzato</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${(account.dailyPnL[account.dailyPnL.length - 1].unrealized ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(account.dailyPnL[account.dailyPnL.length - 1].unrealized ?? 0) >= 0 ? '+' : ''}
                  {(account.dailyPnL[account.dailyPnL.length - 1].unrealized ?? 0).toFixed(2)}$
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">PnL Totale Netto</div>
                <div className={`text-sm font-bold font-mono mt-0.5 ${(account.dailyPnL[account.dailyPnL.length - 1].pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(account.dailyPnL[account.dailyPnL.length - 1].pnl ?? 0) >= 0 ? '+' : ''}
                  {(account.dailyPnL[account.dailyPnL.length - 1].pnl ?? 0).toFixed(2)}$
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Asset in Gestione */}
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1 flex items-center justify-between">
              <span>Indici Gestiti</span>
              <span className="text-xs text-gray-500 font-normal">CASH - Stato</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {['SPY', 'VOO', 'IVV', 'VTI', 'QQQ'].map(symbol => {
                const hasPosition = account.positions?.some(pos => pos.symbol === symbol);
                const latestLog = account.dailyLogicLogs ? [...account.dailyLogicLogs].reverse().find(l => l.symbol === symbol) : null;
                return (
                  <div key={symbol} className="p-2 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-between gap-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">{symbol}</span>
                      <span className="px-1 text-[9px] font-semibold bg-gray-200 text-gray-600 rounded">CASH</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${hasPosition ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {hasPosition ? 'Attivo' : 'In attesa'}
                      </span>
                    </div>
                    {latestLog && (
                      <div className="text-[9px] text-gray-500 mt-1 border-t border-gray-200/60 pt-1">
                        <span className={`font-semibold ${latestLog.action === 'BUY' ? 'text-green-600' : latestLog.action === 'SKIP' ? 'text-amber-600' : 'text-gray-500'}`}>
                          {latestLog.action}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1 flex items-center justify-between">
              <span>Materie Prime Gestite</span>
              <span className="text-xs text-gray-500 font-normal">CASH - Stato</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {['GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'].map(symbol => {
                const hasPosition = account.positions?.some(pos => pos.symbol === symbol);
                const latestLog = account.dailyLogicLogs ? [...account.dailyLogicLogs].reverse().find(l => l.symbol === symbol) : null;
                return (
                  <div key={symbol} className="p-2 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-between gap-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">{symbol}</span>
                      <span className="px-1 text-[9px] font-semibold bg-gray-200 text-gray-600 rounded">CASH</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${hasPosition ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {hasPosition ? 'Attivo' : 'In attesa'}
                      </span>
                    </div>
                    {latestLog && (
                      <div className="text-[9px] text-gray-500 mt-1 border-t border-gray-200/60 pt-1">
                        <span className={`font-semibold ${latestLog.action === 'BUY' ? 'text-green-600' : latestLog.action === 'SKIP' ? 'text-amber-600' : 'text-gray-500'}`}>
                          {latestLog.action}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Positions */}
        {account.positions && account.positions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1">Posizioni Aperte</h3>
            <div className="space-y-2">
              {account.positions.map((pos, i) => {
                const qtyNum = parseFloat(pos.qty);
                const formattedQty = qtyNum % 1 === 0 ? qtyNum.toString() : qtyNum.toFixed(4);
                const avgPrice = parseFloat(pos.avg_entry_price || '0');
                const currPrice = parseFloat(pos.current_price || '0');
                return (
                  <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 gap-2 sm:gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div>
                        <span className="font-bold text-gray-900 text-base">{pos.symbol}</span>
                        <span className="text-gray-500 text-xs block sm:inline sm:ml-2">({formattedQty} quote)</span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600 mt-1 sm:mt-0">
                        <div>
                          <span className="text-gray-400 block sm:inline">Prezzo acq: </span>
                          <span className="font-mono font-medium text-gray-800">${avgPrice.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block sm:inline">Quot. attuale: </span>
                          <span className="font-mono font-medium text-gray-800">${currPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className={`font-semibold flex items-center gap-1.5 ${parseFloat(pos.unrealized_pl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span>{parseFloat(pos.unrealized_pl) >= 0 ? '+' : ''}{parseFloat(pos.unrealized_pl).toFixed(2)}$</span>
                        {pos.unrealized_plpc !== undefined && (
                          <span className="text-xs font-semibold opacity-95 px-1.5 py-0.5 rounded bg-current/10">
                            ({parseFloat(pos.unrealized_plpc) >= 0 ? '+' : ''}{(parseFloat(pos.unrealized_plpc) * 100).toFixed(2)}%)
                          </span>
                        )}
                      </div>

                      {confirmCloseSymbol?.symbol === pos.symbol && confirmCloseSymbol?.type === type ? (
                        <div className="flex items-center gap-1.5 ml-2 bg-red-50 p-1 rounded-md border border-red-200">
                          <button
                            onClick={() => onClosePosition(pos.symbol, type)}
                            disabled={closingSymbols.includes(pos.symbol)}
                            className="px-2 py-0.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {closingSymbols.includes(pos.symbol) ? '...' : 'Chiudi'}
                          </button>
                          <button
                            onClick={() => setConfirmCloseSymbol(null)}
                            disabled={closingSymbols.includes(pos.symbol)}
                            className="p-0.5 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors cursor-pointer disabled:opacity-50"
                            title="Annulla"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmCloseSymbol({ symbol: pos.symbol, type })}
                          disabled={closingSymbols.includes(pos.symbol)}
                          className="ml-2 p-1 text-xs font-semibold rounded text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          title="Chiudi Posizione"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Chiudi</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Logic Logs */}
        {account.dailyLogicLogs && account.dailyLogicLogs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1">Ultimi Ragionamenti</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {[...account.dailyLogicLogs].reverse().slice(0, 10).map((log, i) => (
                <div key={i} className="text-xs border-l-2 border-blue-400 pl-2 py-1">
                  <div className="flex justify-between text-gray-500 mb-1">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="font-bold">{log.symbol} ({log.action})</span>
                  </div>
                  <div className="text-gray-700">{log.reasoning}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Logs */}
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1">Log Operativi</h3>
          <div className="bg-gray-900 text-gray-300 p-3 rounded-lg text-xs font-mono h-40 overflow-y-auto flex flex-col gap-1">
            {account.logs?.length > 0 ? (
              account.logs.map((log, i) => (
                <div key={i} className={`${
                  log.includes('Acquistato') || log.includes('ACQUISTO') ? 'text-green-400' : 
                  log.includes('Venduto') || log.includes('VENDITA') ? 'text-red-400' : 
                  log.includes('Errore') ? 'text-red-500 font-bold' :
                  'text-gray-400'
                }`}>{log}</div>
              ))
            ) : (
              <div className="text-gray-500">Nessun log disponibile...</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'paper' | 'live'>('paper');

  const [closingSymbols, setClosingSymbols] = useState<string[]>([]);
  const [confirmCloseSymbol, setConfirmCloseSymbol] = useState<{ symbol: string; type: 'paper' | 'live' } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [copiedDebriefRule, setCopiedDebriefRule] = useState(false);

  const handleGenerateDebrief = async () => {
    setDebriefLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/generate-daily-debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.debrief) {
          setStatus(prev => prev ? { ...prev, latestDailyDebrief: data.debrief } : null);
          setSuccessMessage('Debriefing Giornaliero AI generato con successo!');
          setTimeout(() => setSuccessMessage(null), 5000);
        } else {
          setErrorMessage(`Impossibile generare il debriefing: ${data.error || 'Errore sconosciuto'}`);
        }
      } else {
        const errData = await res.json().catch(() => ({ error: 'Errore generico del server' }));
        setErrorMessage(`Errore del server: ${errData.error || 'Generazione fallita'}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Errore di rete: ${err.message}`);
    } finally {
      setDebriefLoading(false);
    }
  };

  const handleClosePosition = async (symbol: string, type: 'paper' | 'live') => {
    setClosingSymbols(prev => [...prev, symbol]);
    setConfirmCloseSymbol(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: type, symbol })
      });
      if (res.ok) {
        setSuccessMessage(`Chiusura della posizione di ${symbol} avviata con successo su Alpaca.`);
        setTimeout(() => setSuccessMessage(null), 5000);
        fetchStatus();
      } else {
        const data = await res.json().catch(() => ({ message: 'Errore durante la chiusura.' }));
        setErrorMessage(`Impossibile chiudere la posizione di ${symbol}: ${data.message}`);
        setTimeout(() => setErrorMessage(null), 6000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Errore di rete: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 6000);
    } finally {
      setClosingSymbols(prev => prev.filter(s => s !== symbol));
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data: BotStateResponse = await res.json();
          setStatus(data.status);
        } else {
          console.warn('Expected JSON response from /api/status, received alternative content type.');
        }
      }
    } catch (error) {
      console.error('Error fetching bot status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleBot = async (target?: 'paper' | 'live' | 'both') => {
    try {
      const res = await fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      if (res.ok) {
        const data: BotStateResponse = await res.json();
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Error toggling bot:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Inizializzazione del motore di trading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Pannello di Controllo Trading
            </h1>
            <p className="text-sm text-gray-500 mt-1">Gestisci separatamente i conti Simulazione (Paper) e Reale (Live)</p>
          </div>

          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
             <button
               onClick={() => setSelectedTab('paper')}
               className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                 selectedTab === 'paper' 
                   ? 'bg-white text-indigo-700 shadow-sm' 
                   : 'text-gray-500 hover:text-gray-700'
               }`}
             >
               Simulazione (Paper)
             </button>
             <button
               onClick={() => setSelectedTab('live')}
               className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${
                 selectedTab === 'live' 
                   ? 'bg-white text-emerald-700 shadow-sm' 
                   : 'text-gray-500 hover:text-gray-700'
               }`}
             >
               Reale (Live)
             </button>
          </div>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="p-4 bg-green-50 text-green-800 border border-green-200 rounded-xl text-sm font-medium flex justify-between items-center shadow-sm animate-pulse">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-medium flex justify-between items-center shadow-sm">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Selected Panel */}
        <div>
          {selectedTab === 'paper' && status?.paper && (
            <AccountPanel 
              account={status.paper} 
              title="Conto Simulazione (Paper)" 
              isActive={!!status.paperActive} 
              type="paper" 
              onToggle={toggleBot} 
              onClosePosition={handleClosePosition}
              closingSymbols={closingSymbols}
              confirmCloseSymbol={confirmCloseSymbol}
              setConfirmCloseSymbol={setConfirmCloseSymbol}
            />
          )}
          {selectedTab === 'live' && status?.live && (
            <AccountPanel 
              account={status.live} 
              title="Conto Reale (Live)" 
              isActive={!!status.liveActive} 
              type="live" 
              onToggle={toggleBot} 
              onClosePosition={handleClosePosition}
              closingSymbols={closingSymbols}
              confirmCloseSymbol={confirmCloseSymbol}
              setConfirmCloseSymbol={setConfirmCloseSymbol}
            />
          )}
        </div>

        {/* Debriefing Giornaliero AI */}
        <div className="bg-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200 mt-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                Debriefing Giornaliero Assistito da AI
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Simula una riunione di fine giornata con Gemini 3.5 per analizzare decisioni, correlazioni e ottenere regole ottimizzate.
              </p>
            </div>
            <button
              onClick={handleGenerateDebrief}
              disabled={debriefLoading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm cursor-pointer ${
                debriefLoading 
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed animate-pulse' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${debriefLoading ? 'animate-spin' : ''}`} />
              {debriefLoading ? 'Analisi in corso...' : 'Avvia Riunione & Debriefing'}
            </button>
          </div>

          {status?.latestDailyDebrief ? (
            <div className="space-y-4">
              {/* Output Analisi */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-inner">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-slate-400" />
                  Rapporto della Riunione di Fine Giornata
                </h3>
                <div className="markdown-body text-sm text-slate-700 leading-relaxed space-y-2">
                  <ReactMarkdown>{status.latestDailyDebrief.analysis}</ReactMarkdown>
                </div>
                {status.latestDailyDebrief.timestamp && (
                  <div className="text-right text-[10px] text-slate-400 mt-3 flex items-center justify-end gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    Analizzato il: {new Date(status.latestDailyDebrief.timestamp).toLocaleString('it-IT')}
                  </div>
                )}
              </div>

              {/* Regola Ottimizzata da Copiare */}
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    Regola Ottimizzata Proposta per il Bot
                  </h3>
                  <button
                    onClick={() => {
                      if (status.latestDailyDebrief) {
                        navigator.clipboard.writeText(status.latestDailyDebrief.suggestedRule);
                        setCopiedDebriefRule(true);
                        setTimeout(() => setCopiedDebriefRule(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition shadow-sm cursor-pointer"
                  >
                    {copiedDebriefRule ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-green-700">Copiata!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copia Regola</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={status.latestDailyDebrief.suggestedRule}
                    rows={2}
                    className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-sm font-mono text-indigo-950 focus:outline-none resize-none shadow-sm"
                  />
                </div>
                <p className="text-[11px] text-indigo-700 font-sans italic leading-normal">
                  💡 <strong>Suggerimento:</strong> Copia questa regola e incollala nel "Loop di Correzione" sottostante per addestrare il bot a migliorare le performance future.
                </p>
              </div>
            </div>
          ) : (
            !debriefLoading && (
              <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                Nessun debriefing generato per oggi. Clicca su "Avvia Riunione & Debriefing" per avviare l'analisi assistita da AI.
              </div>
            )
          )}
        </div>

        {/* Daily Report Motivation */}
        {status?.latestDailyReport && (
          <div className="bg-purple-50 p-6 rounded-2xl shadow-sm border border-purple-100 mt-6 mb-6">
            <h2 className="text-lg font-medium text-purple-900 mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Report Motivazionale di Fine Giornata
            </h2>
            <div className="bg-white p-4 rounded-lg border border-purple-200 whitespace-pre-wrap font-sans text-sm text-purple-800 shadow-inner">
              {status.latestDailyReport}
            </div>
          </div>
        )}

        {/* Feedback Form */}
        <div className="bg-gray-50 p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
           <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
             <MessageSquare className="w-5 h-5 text-gray-500" />
             Loop di Correzione (Invia Regole al Bot)
           </h2>
           <form onSubmit={async (e) => {
             e.preventDefault();
             const formData = new FormData(e.currentTarget);
             const rule = formData.get('rule') as string;
             if (!rule) return;
             await fetch('/api/feedback', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ rule })
             });
             e.currentTarget.reset();
             fetchStatus();
           }} className="flex flex-col gap-3">
             <textarea 
               name="rule" 
               rows={2} 
               placeholder="Es. 'Sei stato troppo aggressivo sull'oro in fase di incertezza, sii più cauto.'"
               className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border"
             ></textarea>
             <button type="submit" className="self-end bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
               Invia Regola
             </button>
           </form>
           {status?.userFeedbackRules && status.userFeedbackRules.length > 0 && (
             <div className="mt-4">
               <h3 className="text-sm font-medium text-gray-700 mb-2">Regole Attive:</h3>
               <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                 {status.userFeedbackRules.map((r, i) => (
                   <li key={i}>{r}</li>
                 ))}
               </ul>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
