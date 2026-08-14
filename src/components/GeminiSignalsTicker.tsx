import React, { useEffect, useState } from 'react';
import { ShoppingCart, Plus } from 'lucide-react';

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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Analisi Sentiment & Segnali Gemini AI</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">Aggiornato in tempo reale</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
        {signals.map((sig) => (
          <div key={sig.asset} className="flex-shrink-0 bg-slate-950/80 p-3 rounded-xl border border-slate-800 min-w-[220px] flex flex-col justify-between gap-2 shadow-inner">
            <div className="flex justify-between items-center">
              <span className="font-bold text-white text-base font-mono">{sig.asset}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                sig.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                sig.action === 'SELL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                'bg-slate-700/40 text-slate-300 border border-slate-600/40'
              }`}>{sig.action} ({sig.score >= 0 ? `+${sig.score.toFixed(2)}` : sig.score.toFixed(2)})</span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2" title={sig.reasoning}>{sig.reasoning}</p>
            {onOpenForceBuy && (
              <button
                onClick={() => onOpenForceBuy(sig.asset)}
                className="w-full mt-1 py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Forza Acquisto {sig.asset}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
