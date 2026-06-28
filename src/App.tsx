import { useEffect, useState } from 'react';
import { Play, Square, Activity, Wallet, Clock, RotateCcw } from 'lucide-react';
import type { BotStateResponse, BotStatus } from './types';

const EQUITIES_SYMBOLS = ['SPY', 'VOO', 'IVV', 'VTI', 'QQQ'];
const COMMODITIES_SYMBOLS = ['GLD', 'SLV', 'USO', 'UNG', 'DBA', 'DBC', 'PDBC', 'UGA', 'WEAT', 'CORN'];
const BONDS_SYMBOLS = ['BND', 'AGG', 'TLT', 'IEF', 'SHY', 'LQD', 'HYG', 'TIP', 'GOVT', 'VCIT'];

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [marketAnalysis, setMarketAnalysis] = useState<{ analysis: string; improvementPrompt: string } | null>(null);
  
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareStartDate, setCompareStartDate] = useState('');
  const [compareEndDate, setCompareEndDate] = useState('');
  const [compareAnalysis, setCompareAnalysis] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data: BotStateResponse = await res.json();
        setStatus(data.status);
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Error fetching bot status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh status every 5 seconds, or 500ms if simulation is running
    const delay = status?.simulationRunning ? 500 : 5000;
    const interval = setInterval(fetchStatus, delay);
    return () => clearInterval(interval);
  }, [status?.simulationRunning]);

  const toggleBot = async () => {
    try {
      const res = await fetch('/api/toggle', { method: 'POST' });
      if (res.ok) {
        const data: BotStateResponse = await res.json();
        setStatus(data.status);
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Error toggling bot:', error);
    }
  };

  const resetBot = async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        const data: BotStateResponse = await res.json();
        setStatus(data.status);
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Error resetting bot:', error);
    }
  };

  const studyMarkets = async () => {
    setAnalysisLoading(true);
    setMarketAnalysis(null);
    try {
      const res = await fetch('/api/study-markets', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setMarketAnalysis(data);
      }
    } catch (error) {
      console.error('Error studying markets:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const compareResults = async () => {
    if (!compareStartDate || !compareEndDate) return;
    setCompareLoading(true);
    setCompareAnalysis(null);
    try {
      const res = await fetch('/api/compare-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: compareStartDate, endDate: compareEndDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompareAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Error comparing results:', error);
    } finally {
      setCompareLoading(false);
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
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Motore di Trading
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-gray-500">
                Google Cloud Run Backend
              </span>
              <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${status?.mode === 'Alpaca' ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-blue-50 text-blue-700 ring-blue-700/10'}`}>
                Broker: {status?.mode === 'Alpaca' ? 'Alpaca (Paper Trading)' : 'API Simulazione'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={studyMarkets}
              disabled={analysisLoading}
              className={`p-2 px-4 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${analysisLoading ? 'bg-purple-100 text-purple-400 cursor-not-allowed' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
              title="Avvia 100 Test e Analizza Mercato"
            >
              {analysisLoading ? 'Analisi in corso...' : '100 Test & Studia Mercati'}
            </button>
            <button
              onClick={async () => {
                await fetch('/api/simulate-day', { method: 'POST' });
                fetchStatus();
              }}
              disabled={status?.simulationRunning}
              className={`p-2 px-4 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${status?.simulationRunning ? 'bg-blue-100 text-blue-400 cursor-not-allowed' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
              title="Avvia test su 1 settimana"
            >
              {status?.simulationRunning ? 'Simulazione in corso...' : 'Backtest Veloce (1 Settimana)'}
            </button>
            <button
              onClick={resetBot}
              className="p-2 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              title="Ripristina Simulazione"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={toggleBot}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                status?.active 
                  ? 'bg-red-50 text-red-700 hover:bg-red-100' 
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {status?.active ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  Ferma Bot
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Avvia Bot
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">Stato Servizio</span>
            </div>
            <div className="text-2xl font-semibold flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${status?.active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              {status?.active ? 'Attivo' : 'In Pausa'}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Wallet className="w-4 h-4" />
              <span className="text-sm font-medium">Saldo Corrente</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight">
              €{(status?.balance ?? 0).toFixed(2)}
            </div>
            {status?.cash !== undefined && (
              <div className="text-xs text-gray-500 mt-1 font-mono">
                Liquidità: €{(status?.cash ?? 0).toFixed(2)}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Ultimo Controllo</span>
            </div>
            <div className="text-sm font-medium text-gray-900">
              {status?.lastCheck 
                ? new Date(status.lastCheck).toLocaleTimeString() 
                : 'Nessun controllo effettuato'}
            </div>
          </div>
        </div>

        {status?.simulationRunning && (
          <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 mb-6 overflow-hidden relative">
             <div className="absolute inset-0 bg-blue-50/50" />
             <div className="relative z-10 flex flex-col gap-2">
                <div className="flex justify-between text-sm font-medium text-blue-900">
                  <span>Simulazione giornata in corso (Fast-Forward)...</span>
                  <span>{status.simulationProgress || 0}%</span>
                </div>
                <div className="w-full bg-blue-200/50 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${status.simulationProgress || 0}%` }}
                  />
                </div>
             </div>
          </div>
        )}

        {/* Positions Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-medium text-gray-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-gray-400" />
              Resoconto Strategie
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            
            {/* Colonna 1: Azioni (Equities) */}
            <div>
              <div className="bg-blue-50/50 p-3 border-b border-gray-100 text-center">
                <h3 className="text-sm font-semibold text-blue-900">Azioni (Equities)</h3>
              </div>
              <div className="p-4 max-h-[500px] overflow-y-auto space-y-2">
                {EQUITIES_SYMBOLS.map((sym) => {
                  const pos = status?.positions?.find(p => p.symbol === sym);
                  const assetInfo = status?.simulatedAssets?.[sym];
                  
                  if (pos) {
                    const marketValue = parseFloat(pos.market_value);
                    const pl = parseFloat(pos.unrealized_pl);
                    const plpc = parseFloat(pos.unrealized_plpc) * 100;
                    
                    return (
                      <div key={sym} className="flex flex-col gap-1.5 p-3 bg-white rounded-xl border border-blue-100 shadow-sm transition-all duration-200 hover:shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 text-sm">{sym}</span>
                            <span className="text-[9px] bg-blue-100 text-blue-800 font-semibold px-1 py-0.5 rounded">ACTIVE</span>
                          </div>
                          <span className="font-bold text-blue-900 text-sm">${marketValue.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 font-mono">Qtà: {parseFloat(pos.qty).toFixed(4)}</span>
                          <span className={`font-semibold ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pl >= 0 ? '+' : ''}${pl.toFixed(2)} ({plpc.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  } else {
                    const price = assetInfo?.lastPrice;
                    return (
                      <div key={sym} className="flex items-center justify-between p-2.5 bg-gray-50/60 rounded-lg border border-gray-100/80 transition-all duration-200">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-700 text-sm">{sym}</span>
                          <span className="text-[9px] text-gray-400 font-medium bg-gray-100 px-1 py-0.5 rounded border border-gray-200/50">CASH</span>
                        </div>
                        <span className="text-xs font-mono text-gray-500">
                          {price ? `$${price.toFixed(2)}` : 'In attesa'}
                        </span>
                      </div>
                    );
                  }
                })}
              </div>
            </div>

            {/* Colonna 2: Materie Prime (Commodities) */}
            <div>
              <div className="bg-amber-50/50 p-3 border-b border-gray-100 text-center">
                <h3 className="text-sm font-semibold text-amber-900">Materie Prime</h3>
              </div>
              <div className="p-4 max-h-[500px] overflow-y-auto space-y-2">
                {COMMODITIES_SYMBOLS.map((sym) => {
                  const pos = status?.positions?.find(p => p.symbol === sym);
                  const assetInfo = status?.simulatedAssets?.[sym];
                  
                  if (pos) {
                    const marketValue = parseFloat(pos.market_value);
                    const pl = parseFloat(pos.unrealized_pl);
                    const plpc = parseFloat(pos.unrealized_plpc) * 100;
                    
                    return (
                      <div key={sym} className="flex flex-col gap-1.5 p-3 bg-white rounded-xl border border-amber-100 shadow-sm transition-all duration-200 hover:shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 text-sm">{sym}</span>
                            <span className="text-[9px] bg-amber-100 text-amber-800 font-semibold px-1 py-0.5 rounded">ACTIVE</span>
                          </div>
                          <span className="font-bold text-amber-900 text-sm">${marketValue.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 font-mono">Qtà: {parseFloat(pos.qty).toFixed(4)}</span>
                          <span className={`font-semibold ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pl >= 0 ? '+' : ''}${pl.toFixed(2)} ({plpc.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  } else {
                    const price = assetInfo?.lastPrice;
                    return (
                      <div key={sym} className="flex items-center justify-between p-2.5 bg-gray-50/60 rounded-lg border border-gray-100/80 transition-all duration-200">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-700 text-sm">{sym}</span>
                          <span className="text-[9px] text-gray-400 font-medium bg-gray-100 px-1 py-0.5 rounded border border-gray-200/50">CASH</span>
                        </div>
                        <span className="text-xs font-mono text-gray-500">
                          {price ? `$${price.toFixed(2)}` : 'In attesa'}
                        </span>
                      </div>
                    );
                  }
                })}
              </div>
            </div>

            {/* Colonna 3: Obbligazioni (Bonds) */}
            <div>
              <div className="bg-emerald-50/50 p-3 border-b border-gray-100 text-center">
                <h3 className="text-sm font-semibold text-emerald-900">Obbligazioni (Bonds)</h3>
              </div>
              <div className="p-4 max-h-[500px] overflow-y-auto space-y-2">
                {BONDS_SYMBOLS.map((sym) => {
                  const pos = status?.positions?.find(p => p.symbol === sym);
                  const assetInfo = status?.simulatedAssets?.[sym];
                  
                  if (pos) {
                    const marketValue = parseFloat(pos.market_value);
                    const pl = parseFloat(pos.unrealized_pl);
                    const plpc = parseFloat(pos.unrealized_plpc) * 100;
                    
                    return (
                      <div key={sym} className="flex flex-col gap-1.5 p-3 bg-white rounded-xl border border-emerald-100 shadow-sm transition-all duration-200 hover:shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 text-sm">{sym}</span>
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-semibold px-1 py-0.5 rounded">ACTIVE</span>
                          </div>
                          <span className="font-bold text-emerald-900 text-sm">${marketValue.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 font-mono">Qtà: {parseFloat(pos.qty).toFixed(4)}</span>
                          <span className={`font-semibold ${pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pl >= 0 ? '+' : ''}${pl.toFixed(2)} ({plpc.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  } else {
                    const price = assetInfo?.lastPrice;
                    return (
                      <div key={sym} className="flex items-center justify-between p-2.5 bg-gray-50/60 rounded-lg border border-gray-100/80 transition-all duration-200">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-700 text-sm">{sym}</span>
                          <span className="text-[9px] text-gray-400 font-medium bg-gray-100 px-1 py-0.5 rounded border border-gray-200/50">CASH</span>
                        </div>
                        <span className="text-xs font-mono text-gray-500">
                          {price ? `$${price.toFixed(2)}` : 'In attesa'}
                        </span>
                      </div>
                    );
                  }
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Daily PnL */}
        {status?.dailyPnL && status.dailyPnL.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-medium text-gray-900">Resoconto Giornaliero (P&L)</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {status.dailyPnL.map((day, idx) => (
                <div key={idx} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">{day.date}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">Saldo: ${(day.balance ?? 0).toFixed(2)}</span>
                      <span className={`font-bold ${(day.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(day.pnl ?? 0) >= 0 ? '+' : ''}${(day.pnl ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {day.news && (
                    <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded flex items-start gap-2">
                      <span className="font-bold">News:</span> {day.news}
                    </div>
                  )}
                  {day.breakdown && day.breakdown.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 text-xs">
                      <div className="text-gray-500 mb-2 font-medium">Composizione Portafoglio a fine giornata:</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {day.breakdown.map((item, bIdx) => (
                          <div key={bIdx} className="bg-white p-2 rounded border border-gray-200">
                            <div className="font-bold text-gray-800 flex justify-between items-center">
                              <span>{item.symbol}</span>
                              {item.pnl !== undefined && item.pnlPercent !== undefined && (
                                <span className={(item.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {(item.pnl ?? 0) >= 0 ? '+' : ''}${(item.pnl ?? 0).toFixed(2)} ({(item.pnl ?? 0) >= 0 ? '+' : ''}{(item.pnlPercent ?? 0).toFixed(2)}%)
                                </span>
                              )}
                            </div>
                            <div className="text-gray-500">Qtà: {(item.shares ?? 0).toFixed(4)}</div>
                            <div className="text-gray-500">Prezzo: ${(item.price ?? 0).toFixed(2)}</div>
                            <div className="text-gray-700 font-medium">Valore: ${(item.value ?? 0).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Analysis Results */}
        {marketAnalysis && (
          <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100 shadow-sm space-y-4">
            <h2 className="font-semibold text-purple-900 text-lg flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Risultati 100 Test & Analisi
            </h2>
            <div className="space-y-4 text-sm text-purple-800">
              <div>
                <h3 className="font-medium text-purple-900 mb-1">Analisi Dettagliata</h3>
                <div className="bg-white p-4 rounded-lg border border-purple-100 whitespace-pre-wrap font-sans">
                  {marketAnalysis.analysis}
                </div>
              </div>
              <div>
                <h3 className="font-medium text-purple-900 mb-1">Prompt Auto-Generato (Per l'AI)</h3>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                  {marketAnalysis.improvementPrompt}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compare Results Section */}
        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 shadow-sm space-y-4 mt-6">
          <h2 className="font-semibold text-blue-900 text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Confronta Risultati (Reale vs Simulata)
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-blue-700 font-medium mb-1">Dal (Inizio)</label>
              <input
                type="date"
                value={compareStartDate}
                onChange={(e) => setCompareStartDate(e.target.value)}
                className="px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-blue-700 font-medium mb-1">Al (Fine)</label>
              <input
                type="date"
                value={compareEndDate}
                onChange={(e) => setCompareEndDate(e.target.value)}
                className="px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col w-full sm:w-auto mt-auto">
              <button
                onClick={compareResults}
                disabled={compareLoading || !compareStartDate || !compareEndDate}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${compareLoading || !compareStartDate || !compareEndDate ? 'bg-blue-200 text-blue-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                {compareLoading ? 'Confronto in corso...' : 'Confronta'}
              </button>
            </div>
          </div>
          
          {compareAnalysis && (
            <div className="space-y-4 text-sm text-blue-800 mt-4">
              <div>
                <h3 className="font-medium text-blue-900 mb-1">Risultato del Confronto</h3>
                <div className="bg-white p-4 rounded-lg border border-blue-100 whitespace-pre-wrap font-sans">
                  {compareAnalysis}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-medium text-gray-900">Registro Operazioni (Server)</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center mt-4">Nessun evento registrato.</p>
            ) : (
              logs.map((log, index) => {
                // Extract timestamp and message
                const match = log.match(/^\[(.*?)\] (.*)$/);
                if (match) {
                  const [_, timestamp, message] = match;
                  const time = new Date(timestamp).toLocaleTimeString();
                  
                  // Colorize profit/loss
                  let msgClass = "text-gray-700";
                  if (message.includes('+€')) msgClass = "text-green-600 font-medium";
                  if (message.includes('-€')) msgClass = "text-red-600 font-medium";

                  return (
                    <div key={index} className="text-sm font-mono flex gap-4 p-2 hover:bg-gray-50 rounded">
                      <span className="text-gray-400 shrink-0">{time}</span>
                      <span className={msgClass}>{message}</span>
                    </div>
                  );
                }
                return <div key={index} className="text-sm font-mono text-gray-700 p-2">{log}</div>;
              })
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
