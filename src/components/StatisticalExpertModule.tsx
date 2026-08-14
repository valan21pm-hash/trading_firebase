import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Cpu, ShieldCheck, RefreshCw, BarChart2 } from 'lucide-react';

export interface StatisticalMetrics {
  timestamp: string;
  indexPrices: Record<string, number>;
  indexChanges24h: Record<string, number>;
  correlations: {
    spy_qqq: number;
    spy_vix: number;
    qqq_iwm: number;
    market_coherence: number;
  };
  marketState: 'BULLISH_COHERENT' | 'BEARISH_COHERENT' | 'DIVERGENT_ROTATION' | 'HIGH_VOLATILITY_PANIC' | 'NEUTRAL_STAGNANT';
  statisticalAdvice: string;
  divergenceWarning: boolean;
  recommendedPositionSizeMultiplier: number;
}

export function StatisticalExpertModule() {
  const [metrics, setMetrics] = useState<StatisticalMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/statistical-analysis');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (e) {
      console.error('Errore nel recupero analisi statistica:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 20000); // Polling ogni 20 sec
    return () => clearInterval(interval);
  }, []);

  const getMarketStateBadge = (state?: string) => {
    switch (state) {
      case 'BULLISH_COHERENT':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Sincronia Rialzista (Alta Coerenza)</span>;
      case 'BEARISH_COHERENT':
        return <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Pressione Ribassista Diffusa</span>;
      case 'DIVERGENT_ROTATION':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Divergenza Indici (Rotazione Settoriale)</span>;
      case 'HIGH_VOLATILITY_PANIC':
        return <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Panico & Alta Volatilità (VIX Spike)</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Mercato Stazionario / Consolidamento</span>;
    }
  };

  if (loading && !metrics) {
    return (
      <div className="bg-[#10172A] border border-slate-800 rounded-2xl p-6 text-slate-400 flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
        <span>Elaborazione matrici di correlazione tra indici in corso...</span>
      </div>
    );
  }

  const { correlations, indexChanges24h, indexPrices, statisticalAdvice, recommendedPositionSizeMultiplier } = metrics || {
    correlations: { spy_qqq: 0.9, spy_vix: -0.85, qqq_iwm: 0.75, market_coherence: 0.8 },
    indexChanges24h: { SPY: 0.1, QQQ: 0.2, DIA: -0.1, IWM: 0.0, VIX: -1.2 },
    indexPrices: { SPY: 520, QQQ: 450, DIA: 390, IWM: 200, VIX: 15 },
    statisticalAdvice: 'Matrice statistica in aggiornamento.',
    recommendedPositionSizeMultiplier: 1.0
  };

  return (
    <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-5 text-slate-200">
      {/* Header Modulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-wide">Esperto di Statistica di Sfondo</h2>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">Background AI Support</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Analisi quantitativa continua di correlazione Pearson tra indici guida (SPY, QQQ, VIX, IWM, DIA).
          </p>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-center">
          {getMarketStateBadge(metrics?.marketState)}
          <button
            onClick={fetchMetrics}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Ricarica Analisi"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Raccomandazione Decisionale dell'Esperto */}
      <div className="bg-[#090D16] border border-indigo-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> MOTIVAZIONE E RACCOMANDAZIONE ALL'IA
          </div>
          <p className="text-sm font-medium text-slate-200">
            {statisticalAdvice}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-lg shrink-0">
          <BarChart2 className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Moltiplicatore Taglia</div>
            <div className="text-base font-extrabold text-white">
              {(recommendedPositionSizeMultiplier ?? 1.0).toFixed(2)}x
            </div>
          </div>
        </div>
      </div>

      {/* Grid Matrice di Correlazione tra Indici */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* SPY vs QQQ */}
        <div className="bg-[#0B101D] border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 flex justify-between">
            <span>Correlazione SPY / QQQ</span>
            <span className={correlations.spy_qqq > 0.7 ? 'text-emerald-400' : 'text-amber-400'}>
              {correlations.spy_qqq >= 0 ? '+' : ''}{correlations.spy_qqq}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full ${correlations.spy_qqq > 0.5 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.abs(correlations.spy_qqq) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">
            {correlations.spy_qqq > 0.7 ? 'Forte sincronia tra mercato S&P 500 e Nasdaq Tech.' : 'Sincronia moderata/disallineamento.'}
          </p>
        </div>

        {/* SPY vs VIX */}
        <div className="bg-[#0B101D] border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 flex justify-between">
            <span>Correlazione SPY / VIX</span>
            <span className={correlations.spy_vix < -0.6 ? 'text-emerald-400' : 'text-rose-400'}>
              {correlations.spy_vix >= 0 ? '+' : ''}{correlations.spy_vix}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full ${correlations.spy_vix < -0.5 ? 'bg-indigo-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.abs(correlations.spy_vix) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">
            {correlations.spy_vix < -0.6 ? 'Inversione classica (VIX cala nei trend rialzisti).' : 'Comportamento anomalo di volatilità.'}
          </p>
        </div>

        {/* QQQ vs IWM */}
        <div className="bg-[#0B101D] border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 flex justify-between">
            <span>Correlazione QQQ / IWM</span>
            <span className="text-cyan-400">
              {correlations.qqq_iwm >= 0 ? '+' : ''}{correlations.qqq_iwm}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500"
              style={{ width: `${Math.abs(correlations.qqq_iwm) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">
            Confronto tra Big Tech e Small Caps (Russell 2000).
          </p>
        </div>

        {/* Market Coherence */}
        <div className="bg-[#0B101D] border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 flex justify-between">
            <span>Indice Coerenza Mercato</span>
            <span className={correlations.market_coherence > 0.3 ? 'text-emerald-400' : 'text-amber-400'}>
              {correlations.market_coherence >= 0 ? '+' : ''}{correlations.market_coherence}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full ${correlations.market_coherence > 0.3 ? 'bg-emerald-400' : 'bg-amber-400'}`}
              style={{ width: `${Math.min(100, Math.abs(correlations.market_coherence) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500">
            Misura la convergenza direzionale complessiva.
          </p>
        </div>
      </div>

      {/* Tabella Prezzi e Variazioni Indici Monitorati */}
      <div className="bg-[#090D16] border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
          Andamento Indici Macro di Riferimento
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(indexPrices || {}).map(([sym, price]) => {
            const chg = indexChanges24h[sym] ?? 0;
            const isPositive = chg >= 0;
            return (
              <div key={sym} className="bg-[#0F1628] border border-slate-800/80 p-3 rounded-lg text-center">
                <div className="text-xs font-extrabold text-slate-200">{sym}</div>
                <div className="text-sm font-bold text-white mt-0.5">${price.toFixed(2)}</div>
                <div className={`text-[11px] font-bold mt-0.5 flex items-center justify-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? '+' : ''}{chg.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {lastUpdated && (
        <div className="text-[10px] text-slate-500 text-right font-mono">
          Ultimo aggiornamento analisi statistica: {lastUpdated}
        </div>
      )}
    </div>
  );
}
