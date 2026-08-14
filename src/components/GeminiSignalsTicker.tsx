import React, { useEffect, useState } from 'react';
import { ShoppingCart, Plus, ChevronDown, ChevronUp } from 'lucide-react';

interface GeminiSignal {
  asset: string;
  score: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
}

interface GeminiSignalsTickerProps {
  onOpenForceBuy?: (symbol: string) => void;
}

export const GeminiSignalsTicker: React.FC<GeminiSignalsTickerProps> = ({ onOpenForceBuy }) => {
  const [signals, setSignals] = useState<GeminiSignal[]>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSignals = async () => {
      try {
        const res = await fetch('/api/gemini-signals');
        if (res.ok && isMounted) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data) && isMounted) {
              setSignals(data);
            }
          }
        }
      } catch (e) {
        // Silently catch transient network/restart fetch errors to keep ticker stable
      }
    };
    
    fetchSignals();
    const interval = setInterval(fetchSignals, 15000); // Ogni 15 sec

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (signals.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 my-5 overflow-hidden shadow-xl">
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-left cursor-pointer focus:outline-none group"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Analisi Sentiment & Segnali Gemini AI</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-800/50">
            {signals.length} {signals.length === 1 ? 'indice' : 'indici'}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">Aggiornato in tempo reale</span>
          <div className="p-1 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-slate-700 transition">
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {!isCollapsed && (
        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-800/80">
          {signals.map((sig) => (
            <div key={sig.asset} className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-inner">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-base font-mono tracking-wide">{sig.asset}</span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    sig.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                    sig.action === 'SELL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                    'bg-slate-700/40 text-slate-300 border border-slate-600/40'
                  }`}>{sig.action} ({sig.score >= 0 ? `+${sig.score.toFixed(2)}` : sig.score.toFixed(2)})</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{sig.reasoning}</p>
              </div>
              {onOpenForceBuy && (
                <div className="flex-shrink-0 sm:w-48">
                  <button
                    onClick={() => onOpenForceBuy(sig.asset)}
                    className="w-full py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Forza Acquisto {sig.asset}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

