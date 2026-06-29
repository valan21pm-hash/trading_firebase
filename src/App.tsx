import { useEffect, useState } from 'react';
import { Play, Square, Activity, Wallet, Clock, RotateCcw, BookOpen, MessageSquare, TrendingUp, BarChart2 } from 'lucide-react';
import type { BotStateResponse, BotStatus, AccountData } from './types';

function AccountPanel({ account, title, isActive, type, onToggle }: { account: AccountData; title: string; isActive: boolean; type: 'paper' | 'live', onToggle: (type: 'paper' | 'live') => void }) {
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

        {/* Positions */}
        {account.positions && account.positions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2 border-b pb-1">Posizioni Aperte</h3>
            <div className="space-y-2">
              {account.positions.map((pos, i) => (
                <div key={i} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                  <div>
                    <span className="font-bold">{pos.symbol}</span>
                    <span className="text-gray-500 text-xs ml-2">{pos.qty} quote</span>
                  </div>
                  <div className={`font-medium ${parseFloat(pos.unrealized_pl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {parseFloat(pos.unrealized_pl) >= 0 ? '+' : ''}{parseFloat(pos.unrealized_pl).toFixed(2)}$
                  </div>
                </div>
              ))}
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

        {/* Selected Panel */}
        <div>
          {selectedTab === 'paper' && status?.paper && (
            <AccountPanel account={status.paper} title="Conto Simulazione (Paper)" isActive={!!status.paperActive} type="paper" onToggle={toggleBot} />
          )}
          {selectedTab === 'live' && status?.live && (
            <AccountPanel account={status.live} title="Conto Reale (Live)" isActive={!!status.liveActive} type="live" onToggle={toggleBot} />
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
