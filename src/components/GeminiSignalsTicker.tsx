import React, { useEffect, useState } from 'react';

interface GeminiSignal {
  asset: string;
  score: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
}

export const GeminiSignalsTicker: React.FC = () => {
  const [signals, setSignals] = useState<GeminiSignal[]>([]);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const res = await fetch('/api/gemini-signals');
        if (res.ok) {
          const data = await res.json();
          setSignals(data);
        }
      } catch (e) {
        console.error("Errore fetch segnali Gemini", e);
      }
    };
    
    fetchSignals();
    const interval = setInterval(fetchSignals, 60000); // Ogni 15 sec

    return () => clearInterval(interval);
  }, []);

  if (signals.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 mt-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Gemini AI Live Signals</span>
        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {signals.map((sig) => (
          <div key={sig.asset} className="flex-shrink-0 bg-slate-800/50 p-2 rounded-md border border-slate-700 min-w-[200px]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-white text-sm">{sig.asset}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                sig.action === 'BUY' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                sig.action === 'SELL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                'bg-slate-500/20 text-slate-400 border border-slate-500/30'
              }`}>{sig.action} ({sig.confidence.toFixed(0)}%)</span>
            </div>
            <p className="text-xs text-slate-400 truncate" title={sig.reasoning}>{sig.reasoning}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
