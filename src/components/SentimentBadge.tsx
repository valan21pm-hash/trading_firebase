import React from 'react';
import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GeminiSignal } from '../types';

interface SentimentBadgeProps {
  symbol: string;
  signals?: GeminiSignal[];
  signal?: GeminiSignal;
  showReasoning?: boolean;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({
  symbol,
  signals,
  signal: directSignal,
  showReasoning = false
}) => {
  const matchedSignal = directSignal || signals?.find(
    s => s.asset?.toUpperCase() === symbol?.toUpperCase()
  );

  if (!matchedSignal) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800/40 border border-slate-700/50">
        <Brain className="w-3 h-3 text-slate-500 animate-pulse" />
        <span>Neu / In Analisi</span>
      </span>
    );
  }

  const { score, action, confidence, reasoning } = matchedSignal;
  const isBuy = action === 'BUY' || score >= 0.2;
  const isSell = action === 'SELL' || score <= -0.2;

  const bgClass = isBuy
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : isSell
    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
    : 'bg-slate-800/60 text-slate-300 border-slate-700/60';

  const formattedScore = score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);

  return (
    <div className="inline-flex flex-col gap-0.5">
      <div 
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${bgClass} font-mono text-[11px] font-bold select-none`}
        title={reasoning || `Score: ${formattedScore} (${action})`}
      >
        <Brain className="w-3 h-3 flex-shrink-0" />
        <span className="uppercase">{action}</span>
        <span className="opacity-80">({formattedScore})</span>
        {isBuy ? (
          <TrendingUp className="w-3 h-3 text-emerald-400" />
        ) : isSell ? (
          <TrendingDown className="w-3 h-3 text-rose-400" />
        ) : (
          <Minus className="w-3 h-3 text-slate-400" />
        )}
      </div>
      {showReasoning && reasoning && (
        <p className="text-[10px] text-slate-400 max-w-[200px] truncate" title={reasoning}>
          {reasoning}
        </p>
      )}
    </div>
  );
};
