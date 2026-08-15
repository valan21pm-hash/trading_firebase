import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, Clock, TrendingDown, AlertTriangle, Save, RefreshCw, CheckCircle2, Layers, Cpu, ChevronDown, ChevronUp, Activity, Gauge } from 'lucide-react';
import { RiskRuleConfig } from '../types';

interface SystemRiskRulesManagerProps {
  initialRules?: RiskRuleConfig[];
  onRulesUpdated?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info', title?: string) => void;
}

const DEFAULT_RULES: RiskRuleConfig[] = [
  {
    id: 'pnl_preventive_close',
    enabled: true,
    type: 'PNL_PREVENTIVE_CLOSE',
    parameters: {
      maxLossPct: -0.80,
      minSentimentThreshold: 0.20
    }
  },
  {
    id: 'sentiment_liquidity_sell',
    enabled: true,
    type: 'SENTIMENT_LIQUIDITY_SELL',
    parameters: {
      minSentimentThreshold: 0.15,
      vixDropExemptionPct: -2.0
    }
  },
  {
    id: 'time_stagnation_close',
    enabled: true,
    type: 'TIME_STAGNATION_CLOSE',
    parameters: {
      stagnationMinutes: 30,
      stagnationMinutesHighSentiment: 60,
      stagnationMaxPnlPct: 0.10
    }
  },
  {
    id: 'eod_buy_lock',
    enabled: true,
    type: 'EOD_BUY_LOCK',
    parameters: {
      eodWindowMinutes: 30
    }
  },
  {
    id: 'custom_max_exposure',
    enabled: true,
    type: 'CUSTOM_MAX_EXPOSURE',
    parameters: {
      maxSectorExposurePct: 35,
      minSectorsForBullishCoherent: 3
    }
  },
  {
    id: 'spy_qqq_corr_semicon_cap',
    enabled: true,
    type: 'SPY_QQQ_CORRELATION_SEMICON_CAP',
    parameters: {
      minCorrelationThreshold: 0.95,
      maxSemiconExposurePct: 40,
      semiconSymbols: ['AMD', 'AVGO', 'NVDA', 'QCOM', 'INTC', 'MU', 'SMCI', 'ARM', 'TSM', 'ASML', 'SOXL', 'SOXX', 'SMH']
    }
  },
  {
    id: 'adx_volatility_filter',
    enabled: true,
    type: 'ADX_VOLATILITY_FILTER',
    parameters: {
      minAdxThreshold: 25.0,
      minAdxPeriod: 14
    }
  },
  {
    id: 'atr_individual_trailing_stop',
    enabled: true,
    type: 'ATR_INDIVIDUAL_TRAILING_STOP',
    parameters: {
      atrMultiplier: 1.5,
      atrPeriod: 14,
      useAtrTrailingStop: true
    }
  }
];

function mergeWithDefaultRules(incomingRules?: RiskRuleConfig[]): RiskRuleConfig[] {
  if (!incomingRules || !Array.isArray(incomingRules) || incomingRules.length === 0) {
    return DEFAULT_RULES;
  }
  return DEFAULT_RULES.map(defaultRule => {
    const existing = incomingRules.find(r => r.type === defaultRule.type || r.id === defaultRule.id);
    if (!existing) return defaultRule;
    return {
      ...defaultRule,
      ...existing,
      enabled: existing.enabled ?? defaultRule.enabled,
      parameters: {
        ...defaultRule.parameters,
        ...(existing.parameters || {})
      }
    };
  });
}

export function SystemRiskRulesManager({ initialRules, onRulesUpdated, showToast }: SystemRiskRulesManagerProps) {
  const [rules, setRules] = useState<RiskRuleConfig[]>(mergeWithDefaultRules(initialRules));
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (initialRules && initialRules.length > 0) {
      setRules(mergeWithDefaultRules(initialRules));
    }
  }, [initialRules]);

  const updateRule = (type: string, updater: (prev: RiskRuleConfig) => RiskRuleConfig) => {
    setRules(prev => prev.map(r => r.type === type ? updater(r) : r));
    setSavedSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await fetch('/api/settings/system-risk-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemRiskRules: rules })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSavedSuccess(true);
        if (showToast) showToast('Regole di rischio salvate con successo!', 'success', 'Rischio Deterministico');
        if (onRulesUpdated) onRulesUpdated();
      } else {
        if (showToast) showToast(`Errore: ${data.error || 'Salvataggio fallito'}`, 'error', 'Rischio Deterministico');
      }
    } catch (err: any) {
      if (showToast) showToast(`Errore di rete: ${err.message}`, 'error', 'Rischio Deterministico');
    } finally {
      setSaving(false);
    }
  };

  const getRule = (type: string): RiskRuleConfig => {
    return rules.find(r => r.type === type) || DEFAULT_RULES.find(r => r.type === type)!;
  };

  const pnlRule = getRule('PNL_PREVENTIVE_CLOSE');
  const sentRule = getRule('SENTIMENT_LIQUIDITY_SELL');
  const stagRule = getRule('TIME_STAGNATION_CLOSE');
  const eodRule = getRule('EOD_BUY_LOCK');
  const exposureRule = getRule('CUSTOM_MAX_EXPOSURE');
  const semiconRule = getRule('SPY_QQQ_CORRELATION_SEMICON_CAP');
  const adxRule = getRule('ADX_VOLATILITY_FILTER');
  const atrRule = getRule('ATR_INDIVIDUAL_TRAILING_STOP');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div 
          className="cursor-pointer select-none hover:opacity-85 transition-opacity flex-1"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Regole Automatiche di Rischio (Server Deterministico)</span>
              {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-indigo-600" />}
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              Inviolabile
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vincoli matematici in millisecondi eseguiti dal runtime Node.js prima dei prompt AI. Clicca per espandere/comprimere.
          </p>
        </div>

        {!isCollapsed && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : savedSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Salvataggio...' : savedSuccess ? 'Salvato!' : 'Salva Regole'}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Rule 1: PNL Preventive Close */}
        <div className={`p-4 rounded-xl border transition-all ${pnlRule.enabled ? 'bg-indigo-50/40 border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className={`w-4 h-4 ${pnlRule.enabled ? 'text-indigo-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">1. Chiusura Preventiva P&L</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={pnlRule.enabled}
                onChange={(e) => updateRule('PNL_PREVENTIVE_CLOSE', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Chiude una posizione se la perdita supera la soglia e il sentiment scende sotto il livello critico.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Soglia Perdita P&L Max:</span>
                <span className="font-mono text-red-600 font-bold">{pnlRule.parameters.maxLossPct ?? -0.80}%</span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="-0.2"
                step="0.05"
                value={pnlRule.parameters.maxLossPct ?? -0.80}
                onChange={(e) => updateRule('PNL_PREVENTIVE_CLOSE', r => ({
                  ...r,
                  parameters: { ...r.parameters, maxLossPct: parseFloat(e.target.value) }
                }))}
                disabled={!pnlRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Soglia Sentiment Minimo:</span>
                <span className="font-mono text-indigo-600 font-bold">{pnlRule.parameters.minSentimentThreshold ?? 0.20}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.5"
                step="0.05"
                value={pnlRule.parameters.minSentimentThreshold ?? 0.20}
                onChange={(e) => updateRule('PNL_PREVENTIVE_CLOSE', r => ({
                  ...r,
                  parameters: { ...r.parameters, minSentimentThreshold: parseFloat(e.target.value) }
                }))}
                disabled={!pnlRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Rule 2: Sentiment Liquidity Sell */}
        <div className={`p-4 rounded-xl border transition-all ${sentRule.enabled ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className={`w-4 h-4 ${sentRule.enabled ? 'text-amber-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">2. Vendita per Sentiment Basso</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={sentRule.enabled}
                onChange={(e) => updateRule('SENTIMENT_LIQUIDITY_SELL', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Vende la posizione per proteggere la liquidità se il sentiment crolla, salvo forte calo del VIX.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Sentiment Critico Minimo:</span>
                <span className="font-mono text-amber-600 font-bold">{sentRule.parameters.minSentimentThreshold ?? 0.15}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.4"
                step="0.05"
                value={sentRule.parameters.minSentimentThreshold ?? 0.15}
                onChange={(e) => updateRule('SENTIMENT_LIQUIDITY_SELL', r => ({
                  ...r,
                  parameters: { ...r.parameters, minSentimentThreshold: parseFloat(e.target.value) }
                }))}
                disabled={!sentRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Esenzione Calo VIX (24h):</span>
                <span className="font-mono text-emerald-600 font-bold">{sentRule.parameters.vixDropExemptionPct ?? -2.0}%</span>
              </div>
              <input
                type="range"
                min="-5.0"
                max="-0.5"
                step="0.5"
                value={sentRule.parameters.vixDropExemptionPct ?? -2.0}
                onChange={(e) => updateRule('SENTIMENT_LIQUIDITY_SELL', r => ({
                  ...r,
                  parameters: { ...r.parameters, vixDropExemptionPct: parseFloat(e.target.value) }
                }))}
                disabled={!sentRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>
          </div>
        </div>

        {/* Rule 3: Time Stagnation Close (Anti-StopLoss-Drain) */}
        <div className={`p-4 rounded-xl border transition-all ${stagRule.enabled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${stagRule.enabled ? 'text-emerald-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">3. Chiusura per Stagnazione (Time-Stop)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={stagRule.enabled}
                onChange={(e) => updateRule('TIME_STAGNATION_CLOSE', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            <strong>Protezione Guadagni:</strong> Se una posizione non si muove o resta in stasi per oltre il tempo limite, viene chiusa per liberare capitale invece di attendere lo Stop Loss.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Stasi per Sentiment tra 0.20 e 0.29:</span>
                <span className="font-mono text-emerald-700 font-bold">{stagRule.parameters.stagnationMinutes ?? 30} minuti</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={stagRule.parameters.stagnationMinutes ?? 30}
                onChange={(e) => updateRule('TIME_STAGNATION_CLOSE', r => ({
                  ...r,
                  parameters: { ...r.parameters, stagnationMinutes: parseInt(e.target.value, 10) }
                }))}
                disabled={!stagRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Stasi per Sentiment &gt; 0.30:</span>
                <span className="font-mono text-emerald-700 font-bold">{stagRule.parameters.stagnationMinutesHighSentiment ?? 60} minuti</span>
              </div>
              <input
                type="range"
                min="15"
                max="180"
                step="5"
                value={stagRule.parameters.stagnationMinutesHighSentiment ?? 60}
                onChange={(e) => updateRule('TIME_STAGNATION_CLOSE', r => ({
                  ...r,
                  parameters: { ...r.parameters, stagnationMinutesHighSentiment: parseInt(e.target.value, 10) }
                }))}
                disabled={!stagRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>P&L Max per Considerare Stasi:</span>
                <span className="font-mono text-emerald-700 font-bold">+{stagRule.parameters.stagnationMaxPnlPct ?? 0.10}%</span>
              </div>
              <input
                type="range"
                min="-0.20"
                max="0.50"
                step="0.05"
                value={stagRule.parameters.stagnationMaxPnlPct ?? 0.10}
                onChange={(e) => updateRule('TIME_STAGNATION_CLOSE', r => ({
                  ...r,
                  parameters: { ...r.parameters, stagnationMaxPnlPct: parseFloat(e.target.value) }
                }))}
                disabled={!stagRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Rule 4: EOD Buy Lock */}
        <div className={`p-4 rounded-xl border transition-all ${eodRule.enabled ? 'bg-blue-50/40 border-blue-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${eodRule.enabled ? 'text-blue-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">4. Blocco Acquisti EOD (Fine Giornata)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={eodRule.enabled}
                onChange={(e) => updateRule('EOD_BUY_LOCK', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Blocca l'apertura di nuovi acquisti prima della chiusura se il sentiment generale di mercato è in calo.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Finestra EOD prima della Chiusura:</span>
                <span className="font-mono text-blue-600 font-bold">{eodRule.parameters.eodWindowMinutes ?? 30} minuti</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={eodRule.parameters.eodWindowMinutes ?? 30}
                onChange={(e) => updateRule('EOD_BUY_LOCK', r => ({
                  ...r,
                  parameters: { ...r.parameters, eodWindowMinutes: parseInt(e.target.value, 10) }
                }))}
                disabled={!eodRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Rule 5: Custom Sector Max Exposure & Diversification */}
        <div className={`p-4 rounded-xl border transition-all ${exposureRule.enabled ? 'bg-indigo-50/40 border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className={`w-4 h-4 ${exposureRule.enabled ? 'text-indigo-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">5. Esposizione Settoriale e Diversificazione</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={exposureRule.enabled}
                onChange={(e) => updateRule('CUSTOM_MAX_EXPOSURE', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Previene il rischio di cluster limitando l'esposizione sul singolo settore durante gli acquisti simultanei, e impone la diversificazione nei mercati rialzisti coerenti.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Esposizione Max per Settore (NAV %):</span>
                <span className="font-mono text-indigo-600 font-bold">{exposureRule.parameters.maxSectorExposurePct ?? 35}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={exposureRule.parameters.maxSectorExposurePct ?? 35}
                onChange={(e) => updateRule('CUSTOM_MAX_EXPOSURE', r => ({
                  ...r,
                  parameters: { ...r.parameters, maxSectorExposurePct: parseInt(e.target.value, 10) }
                }))}
                disabled={!exposureRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Minimo Settori in BULLISH_COHERENT:</span>
                <span className="font-mono text-indigo-600 font-bold">{exposureRule.parameters.minSectorsForBullishCoherent ?? 3} settori</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={exposureRule.parameters.minSectorsForBullishCoherent ?? 3}
                onChange={(e) => updateRule('CUSTOM_MAX_EXPOSURE', r => ({
                  ...r,
                  parameters: { ...r.parameters, minSectorsForBullishCoherent: parseInt(e.target.value, 10) }
                }))}
                disabled={!exposureRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Rule 6: Semiconductor Exposure Cap on High SPY-QQQ Correlation */}
        <div className={`p-4 rounded-xl border transition-all ${semiconRule.enabled ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className={`w-4 h-4 ${semiconRule.enabled ? 'text-amber-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">6. Cap Semiconduttori (Corr SPY-QQQ &gt; 0.95)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={semiconRule.enabled}
                onChange={(e) => updateRule('SPY_QQQ_CORRELATION_SEMICON_CAP', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Se la correlazione tra SPY e QQQ supera la soglia, limita l'esposizione totale ai semiconduttori (AMD, AVGO, NVDA, ecc.) al 40% del portafoglio per prevenire il rischio di concentrazione settoriale.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Soglia Correlazione SPY-QQQ:</span>
                <span className="font-mono text-amber-600 font-bold">&gt; +{(semiconRule.parameters.minCorrelationThreshold ?? 0.95).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.80"
                max="0.99"
                step="0.01"
                value={semiconRule.parameters.minCorrelationThreshold ?? 0.95}
                onChange={(e) => updateRule('SPY_QQQ_CORRELATION_SEMICON_CAP', r => ({
                  ...r,
                  parameters: { ...r.parameters, minCorrelationThreshold: parseFloat(e.target.value) }
                }))}
                disabled={!semiconRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Esposizione Max Semiconduttori (NAV %):</span>
                <span className="font-mono text-amber-600 font-bold">{semiconRule.parameters.maxSemiconExposurePct ?? 40}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={semiconRule.parameters.maxSemiconExposurePct ?? 40}
                onChange={(e) => updateRule('SPY_QQQ_CORRELATION_SEMICON_CAP', r => ({
                  ...r,
                  parameters: { ...r.parameters, maxSemiconExposurePct: parseInt(e.target.value, 10) }
                }))}
                disabled={!semiconRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>

            <div className="pt-1 text-[10px] text-slate-500 font-mono">
              Asset monitorati: AMD, AVGO, NVDA, QCOM, INTC, MU, SMCI, ARM, TSM, ASML, SOXL, SOXX, SMH
            </div>
          </div>
        </div>

        {/* Rule 7: ADX Volatility & Trend Filter (ADX < 25) */}
        <div className={`p-4 rounded-xl border transition-all ${adxRule.enabled ? 'bg-cyan-50/40 border-cyan-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${adxRule.enabled ? 'text-cyan-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">7. Filtro Volatilità / Trend (ADX &lt; 25)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={adxRule.enabled}
                onChange={(e) => updateRule('ADX_VOLATILITY_FILTER', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Inibisce l'apertura di nuove posizioni quando l'ADX a 14 periodi scende sotto la soglia specificata (25), indicando un mercato laterale, privo di direzionalità (chop) o caratterizzato da compressione della volatilità.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Soglia Minima ADX(14) per Acquisti:</span>
                <span className="font-mono text-cyan-600 font-bold">&ge; {(adxRule.parameters.minAdxThreshold ?? 25.0).toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="15"
                max="40"
                step="1"
                value={adxRule.parameters.minAdxThreshold ?? 25.0}
                onChange={(e) => updateRule('ADX_VOLATILITY_FILTER', r => ({
                  ...r,
                  parameters: { ...r.parameters, minAdxThreshold: parseFloat(e.target.value) }
                }))}
                disabled={!adxRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Periodi di Calcolo ADX (Barre 15m / 1D):</span>
                <span className="font-mono text-cyan-600 font-bold">{adxRule.parameters.minAdxPeriod ?? 14} periodi (Wilder)</span>
              </div>
              <input
                type="range"
                min="7"
                max="28"
                step="1"
                value={adxRule.parameters.minAdxPeriod ?? 14}
                onChange={(e) => updateRule('ADX_VOLATILITY_FILTER', r => ({
                  ...r,
                  parameters: { ...r.parameters, minAdxPeriod: parseInt(e.target.value, 10) }
                }))}
                disabled={!adxRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
              />
            </div>

            <div className="pt-1 text-[10px] text-slate-500 font-mono">
              Formula: Wilder's Smoothing True Range, +DI / -DI e Directional Movement Index (DMI).
            </div>
          </div>
        </div>

        {/* Rule 8: Individual Trailing Stop based on 1.5x ATR */}
        <div className={`p-4 rounded-xl border transition-all ${atrRule.enabled ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge className={`w-4 h-4 ${atrRule.enabled ? 'text-emerald-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">8. Trailing Stop Individuale Dinamico (1.5x ATR)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={atrRule.enabled}
                onChange={(e) => updateRule('ATR_INDIVIDUAL_TRAILING_STOP', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Sostituisce la chiusura massiva e indiscriminata del portafoglio con una gestione del rischio sartoriale per singolo titolo: calcola l'ATR (Average True Range) del sottostante e imposta un Trailing Stop dinamico ancorato al Massimo Raggiunto (High-Water Mark) a -1.5x ATR.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Moltiplicatore ATR di Trailing Stop:</span>
                <span className="font-mono text-emerald-600 font-bold">{(atrRule.parameters.atrMultiplier ?? 1.5).toFixed(1)}x ATR</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={atrRule.parameters.atrMultiplier ?? 1.5}
                onChange={(e) => updateRule('ATR_INDIVIDUAL_TRAILING_STOP', r => ({
                  ...r,
                  parameters: { ...r.parameters, atrMultiplier: parseFloat(e.target.value) }
                }))}
                disabled={!atrRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Periodi di Calcolo ATR (Barre di Volatilità):</span>
                <span className="font-mono text-emerald-600 font-bold">{atrRule.parameters.atrPeriod ?? 14} periodi</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={atrRule.parameters.atrPeriod ?? 14}
                onChange={(e) => updateRule('ATR_INDIVIDUAL_TRAILING_STOP', r => ({
                  ...r,
                  parameters: { ...r.parameters, atrPeriod: parseInt(e.target.value, 10) }
                }))}
                disabled={!atrRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            <div className="pt-1 text-[10px] text-slate-500 font-mono">
              Protezione individuale: Trigger Chiusura = PeakPrice - (1.5 &times; ATR14). Nessun impatto sulle altre posizioni in profitto.
            </div>
          </div>
        </div>

      </div>
      )}
    </div>
  );
}
