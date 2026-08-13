import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, Clock, TrendingDown, AlertTriangle, Save, RefreshCw, CheckCircle2 } from 'lucide-react';
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Regole Automatiche di Rischio (Server Deterministico)
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              Inviolabile
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vincoli matematici in millisecondi eseguiti dal runtime Node.js prima dei prompt AI.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : savedSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Salvataggio...' : savedSuccess ? 'Salvato!' : 'Salva Regole'}
        </button>
      </div>

      {/* Rules List Grid */}
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

      </div>
    </div>
  );
}
