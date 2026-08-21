import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Zap, Clock, TrendingDown, AlertTriangle, Save, RefreshCw, CheckCircle2, Layers, Cpu, ChevronDown, ChevronUp, Activity, Gauge, Sliders, Clock3, Lock } from 'lucide-react';
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
      minAdxThreshold: 19.0,
      minAdxPeriod: 14,
      dynamicThresholdEnabled: true,
      highCorrThreshold: 0.95,
      reducedAdxThreshold: 14.0
    }
  },
  {
    id: 'atr_individual_trailing_stop',
    enabled: true,
    type: 'ATR_INDIVIDUAL_TRAILING_STOP',
    parameters: {
      atrMultiplier: 1.5,
      atrPeriod: 14,
      useAtrTrailingStop: true,
      minProfitBufferDollars: 0.04
    }
  },
  {
    id: 'max_concurrent_positions_cap',
    enabled: true,
    type: 'MAX_CONCURRENT_POSITIONS_CAP',
    parameters: {
      maxConcurrentPositions: 5
    }
  },
  {
    id: 'volatility_time_window_lock',
    enabled: true,
    type: 'VOLATILITY_TIME_WINDOW_LOCK',
    parameters: {
      blockMorningOpeningWindow: true,
      blockMiddayChopWindow: true,
      blockAfternoonClosingWindow: true,
      morningBlockStart: '09:30',
      morningBlockEnd: '09:45',
      middayBlockStart: '12:30',
      middayBlockEnd: '13:30',
      afternoonBlockStart: '15:30',
      afternoonBlockEnd: '16:00'
    }
  },
  {
    id: 'dynamic_time_window_lock',
    enabled: false,
    type: 'DYNAMIC_TIME_WINDOW_LOCK',
    parameters: {
      blockToxicWindow: false,
      toxicWindowStart: '10:30',
      toxicWindowEnd: '12:00'
    }
  },
  {
    id: 'atr_volatility_filter',
    enabled: true,
    type: 'ATR_VOLATILITY_FILTER',
    parameters: {
      atrFilterPeriod: 14,
      atrSmaPeriod: 20
    }
  },
  {
    id: 'hard_risk_management',
    enabled: false,
    type: 'HARD_RISK_MANAGEMENT',
    parameters: {
      hardStopLossPct: -1.00,
      hardTakeProfitPct: 2.00,
      maxDailyLossPct: -1.00,
      consecutiveSlThreshold: 2,
      consecutiveSlCooldownMinutes: 30
    }
  },
  {
    id: 'ema_trend_confirmation',
    enabled: true,
    type: 'EMA_TREND_CONFIRMATION',
    parameters: {
      requireEmaBullishTrend: true
    }
  },
  {
    id: 'catastrophic_circuit_breaker_sl',
    enabled: true,
    type: 'CATASTROPHIC_CIRCUIT_BREAKER_SL',
    parameters: {
      catastrophicMaxLossPct: -3.00
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
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Synchronize with server rules ONLY when the user does NOT have unsaved local edits
  useEffect(() => {
    if (!isDirty && initialRules && initialRules.length > 0) {
      setRules(mergeWithDefaultRules(initialRules));
    }
  }, [initialRules, isDirty]);

  const updateRule = (type: string, updater: (prev: RiskRuleConfig) => RiskRuleConfig) => {
    setRules(prev => prev.map(r => r.type === type ? updater(r) : r));
    setIsDirty(true);
    setSavedSuccess(false);
  };

  const handleDiscardChanges = () => {
    if (initialRules && initialRules.length > 0) {
      setRules(mergeWithDefaultRules(initialRules));
    } else {
      setRules(DEFAULT_RULES);
    }
    setIsDirty(false);
    setSavedSuccess(false);
    if (showToast) showToast('Modifiche annullate. Ricaricati i parametri del server.', 'info', 'Rischio Deterministico');
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
        setIsDirty(false);
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
  const maxPosRule = getRule('MAX_CONCURRENT_POSITIONS_CAP');
  const timeLockRule = getRule('VOLATILITY_TIME_WINDOW_LOCK');
  const toxicWindowRule = getRule('DYNAMIC_TIME_WINDOW_LOCK');
  const atrFilterRule = getRule('ATR_VOLATILITY_FILTER');
  const hardRiskRule = getRule('HARD_RISK_MANAGEMENT');
  const emaRule = getRule('EMA_TREND_CONFIRMATION');
  const catastrophicRule = getRule('CATASTROPHIC_CIRCUIT_BREAKER_SL');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div 
          className="cursor-pointer select-none hover:opacity-85 transition-opacity flex-1"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Regole Automatiche di Rischio (Server Deterministico)</span>
              {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-indigo-600" />}
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              Inviolabile
            </span>
            {isDirty && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-300 animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Modifiche non salvate (Sync in pausa)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vincoli matematici in millisecondi eseguiti dal runtime Node.js prima dei prompt AI. Clicca per espandere/comprimere.
          </p>
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={saving}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="Annulla modifiche e ricarica i parametri attuali dal server"
              >
                Annulla
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                isDirty 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-400 ring-offset-1 animate-pulse' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
              }`}
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : savedSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Salvataggio...' : savedSuccess ? 'Salvato!' : 'Salva Regole'}
            </button>
          </div>
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

        {/* Rule 7: ADX Volatility & Trend Filter (Dynamic ADX Threshold) */}
        <div className={`p-4 rounded-xl border transition-all ${adxRule.enabled ? 'bg-cyan-50/40 border-cyan-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${adxRule.enabled ? 'text-cyan-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">7. Filtro Volatilità / Trend ADX (Dynamic Threshold)</h3>
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
            Inibisce l'apertura di nuove posizioni in assenza di trend direzionale (chop). Include la <strong>soglia dinamica</strong>: quando la correlazione SPY-QQQ &ge; +0.95 (sincronia elevata), la soglia minima ADX scende automaticamente da 19 a 14 per catturare il momentum senza sacrificare il controllo del rischio.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Soglia Base ADX(14) per Acquisti:</span>
                <span className="font-mono text-cyan-600 font-bold">&ge; {(adxRule.parameters.minAdxThreshold ?? 19.0).toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="10"
                max="35"
                step="1"
                value={adxRule.parameters.minAdxThreshold ?? 19.0}
                onChange={(e) => updateRule('ADX_VOLATILITY_FILTER', r => ({
                  ...r,
                  parameters: { ...r.parameters, minAdxThreshold: parseFloat(e.target.value) }
                }))}
                disabled={!adxRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
              />
            </div>

            {/* Dynamic ADX Threshold toggle & reduced threshold */}
            <div className="p-2.5 rounded-md bg-cyan-50/60 border border-cyan-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-cyan-900">Dynamic Threshold (Correlazione SPY-QQQ &ge; 0.95):</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adxRule.parameters.dynamicThresholdEnabled ?? true}
                    onChange={(e) => updateRule('ADX_VOLATILITY_FILTER', r => ({
                      ...r,
                      parameters: { ...r.parameters, dynamicThresholdEnabled: e.target.checked }
                    }))}
                    disabled={!adxRule.enabled}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-3.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>

              {(adxRule.parameters.dynamicThresholdEnabled ?? true) && (
                <div className="flex justify-between items-center text-[11px] text-cyan-800">
                  <span>Soglia Ridotta con Corr &ge; {(adxRule.parameters.highCorrThreshold ?? 0.95).toFixed(2)}:</span>
                  <span className="font-mono font-bold text-cyan-700">&ge; {(adxRule.parameters.reducedAdxThreshold ?? 14.0).toFixed(1)}</span>
                </div>
              )}
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
              Formula: Wilder's Smoothing True Range &amp; DMI. Adattamento dinamico con Pearson Correlation SPY-QQQ.
            </div>
          </div>
        </div>

        {/* Rule 8: Individual Trailing Stop based on 1.5x ATR (Livello 1: Stop Tecnico/Dinamico) */}
        <div className={`p-4 rounded-xl border transition-all ${atrRule.enabled ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge className={`w-4 h-4 ${atrRule.enabled ? 'text-emerald-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">8. Stop Tecnico / Dinamico Primario (1.5x ATR &amp; Trailing - Livello 1)</h3>
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
            <strong>Disattivabile dall'utente</strong>: Governa l'uscita ordinaria adattandosi al respiro della volatilità reale (1.5x ATR) e delle strategie tecniche su timeframe 15m. Se disattivato, il bot non applica chiusure ordinarie su oscillazioni tecniche, lasciando agire esclusivamente il Circuit Breaker catastrofico.
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

            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Profitto Netto Minimo Garantito in $ per Attivazione Trailing:</span>
                <span className="font-mono text-emerald-600 font-bold">+${(atrRule.parameters.minProfitBufferDollars ?? 0.04).toFixed(2)} totali</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.50"
                step="0.01"
                value={atrRule.parameters.minProfitBufferDollars ?? 0.04}
                onChange={(e) => updateRule('ATR_INDIVIDUAL_TRAILING_STOP', r => ({
                  ...r,
                  parameters: { ...r.parameters, minProfitBufferDollars: parseFloat(e.target.value) }
                }))}
                disabled={!atrRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            <div className="pt-1 text-[10px] text-slate-500 font-mono">
              Protezione dinamica individuale: Il Trailing ATR si attiva SOLO quando la soglia di trailing garantisce un profitto monetario complessivo (P&amp;L) sulla posizione di almeno +${(atrRule.parameters.minProfitBufferDollars ?? 0.04).toFixed(2)} (calcolato in base alle quote possedute).
            </div>
          </div>
        </div>

        {/* Rule 9: Max Concurrent Positions Cap (Cap a 5 posizioni) */}
        <div className={`p-4 rounded-xl border transition-all ${maxPosRule.enabled ? 'bg-violet-50/40 border-violet-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sliders className={`w-4 h-4 ${maxPosRule.enabled ? 'text-violet-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">9. Limite Max Posizioni Simultanee (Cap = 5)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={maxPosRule.enabled}
                onChange={(e) => updateRule('MAX_CONCURRENT_POSITIONS_CAP', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Evita l'eccessiva frammentazione del capitale limitando a un massimo di 5 le posizioni aperte simultaneamente. Concentra la liquidità sui migliori asset con il sentiment più elevato.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Numero Massimo Posizioni Aperte:</span>
                <span className="font-mono text-violet-600 font-bold">{maxPosRule.parameters.maxConcurrentPositions ?? 5} posizioni</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={maxPosRule.parameters.maxConcurrentPositions ?? 5}
                onChange={(e) => updateRule('MAX_CONCURRENT_POSITIONS_CAP', r => ({
                  ...r,
                  parameters: { ...r.parameters, maxConcurrentPositions: parseInt(e.target.value, 10) }
                }))}
                disabled={!maxPosRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
              />
            </div>

            <div className="pt-1 text-[10px] text-slate-500 font-mono">
              Quando sono aperte 5 posizioni, i nuovi ordini vengono scartati finché non viene liberato uno slot.
            </div>
          </div>
        </div>

        {/* Rule 10: Inibizione Operatività nelle Fasce di Volatilità (09:30-10:30 & 15:30-16:00 EST) */}
        <div className={`p-4 rounded-xl border transition-all ${timeLockRule.enabled ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock3 className={`w-4 h-4 ${timeLockRule.enabled ? 'text-amber-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">10. Inibizione Fasce Orarie ad Alta Volatilità (EST)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={timeLockRule.enabled}
                onChange={(e) => updateRule('VOLATILITY_TIME_WINDOW_LOCK', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Inibisce l'apertura di posizioni a mercato nei momenti critici di rumore e instabilità: nei primissimi 15 minuti d'asta (09:30 - 09:45 EST) consentendo operatività dalle <strong>09:45 EST</strong>, pausa di metà giornata (12:30 - 13:30 EST) e chiusura (15:30 - 16:00 EST).
          </p>

          <div className="space-y-2.5 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div className="flex items-center justify-between p-2 rounded bg-amber-50/50 border border-amber-100">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <div>
                  <span className="font-semibold text-slate-800">Fascia Apertura Iniziale (09:30 - 09:45 EST)</span>
                  <p className="text-[10px] text-slate-500">Assorbe lo spread dell'asta e sblocca il trading dalle 09:45 EST</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeLockRule.parameters.blockMorningOpeningWindow ?? true}
                  onChange={(e) => updateRule('VOLATILITY_TIME_WINDOW_LOCK', r => ({
                    ...r,
                    parameters: { ...r.parameters, blockMorningOpeningWindow: e.target.checked }
                  }))}
                  disabled={!timeLockRule.enabled}
                  className="sr-only peer"
                />
                <div className="w-7 h-3.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-amber-50/50 border border-amber-100">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <div>
                  <span className="font-semibold text-slate-800">Pausa Metà Giornata / Chop (12:30 - 13:30 EST)</span>
                  <p className="text-[10px] text-slate-500">Evita periodi a basso volume e drawdown da stasi</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeLockRule.parameters.blockMiddayChopWindow ?? true}
                  onChange={(e) => updateRule('VOLATILITY_TIME_WINDOW_LOCK', r => ({
                    ...r,
                    parameters: { ...r.parameters, blockMiddayChopWindow: e.target.checked }
                  }))}
                  disabled={!timeLockRule.enabled}
                  className="sr-only peer"
                />
                <div className="w-7 h-3.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-amber-50/50 border border-amber-100">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <div>
                  <span className="font-semibold text-slate-800">Fascia Chiusura / Asta (15:30 - 16:00 EST)</span>
                  <p className="text-[10px] text-slate-500">Evita il ribilanciamento degli ETF e la volatilità di chiusura</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeLockRule.parameters.blockAfternoonClosingWindow ?? true}
                  onChange={(e) => updateRule('VOLATILITY_TIME_WINDOW_LOCK', r => ({
                    ...r,
                    parameters: { ...r.parameters, blockAfternoonClosingWindow: e.target.checked }
                  }))}
                  disabled={!timeLockRule.enabled}
                  className="sr-only peer"
                />
                <div className="w-7 h-3.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className="pt-1 text-[10px] text-slate-500 font-mono">
              Fasce di trading attivo consentite: 09:45 - 12:30 EST e 13:30 - 15:30 EST (15:45 - 21:30 CET).
            </div>
          </div>
        </div>

        {/* Rule 11: Conferma Tecnica di Trend EMA 20/50 (Timeframe 15m) */}
        <div className={`p-4 rounded-xl border transition-all ${emaRule.enabled ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${emaRule.enabled ? 'text-emerald-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">11. Conferma Trend Tecnico EMA 20/50 (Swing 15m)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emaRule.enabled}
                onChange={(e) => updateRule('EMA_TREND_CONFIRMATION', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Elimina il micro-scalping casuale e i falsi segnali richiedendo la conferma tecnica su barre a 15 minuti: un asset viene acquistato solo se <strong>Prezzo &gt; EMA(20)</strong> e la media veloce è superiore a quella lenta (<strong>EMA 20 &gt; EMA 50</strong>).
          </p>

          <div className="space-y-2.5 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div className="flex items-center justify-between p-2 rounded bg-emerald-50/50 border border-emerald-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <div>
                  <span className="font-semibold text-slate-800">Filtro Allineamento Medie Mobili Esponenziali</span>
                  <p className="text-[10px] text-slate-500">Inibisce acquisti in contro-trend o durante ribassi prolungati anche in presenza di sentiment positivo</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                15m Bullish Regime
              </span>
            </div>

            <div className="pt-1 text-[10px] text-slate-500 font-mono">
              Condizione di ingresso: Prezzo &gt;= EMA(20) &amp;&amp; EMA(20) &gt;= EMA(50). Target TP medio: +2.50%, Trailing Stop: 1.5x ATR (~1.2%).
            </div>
          </div>
        </div>

        {/* Rule 12: Stop Loss Catastrofico / Circuit Breaker (Livello 2 - Disattivabile a scelta) */}
        <div className={`p-4 rounded-xl border transition-all ${catastrophicRule.enabled ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className={`w-4 h-4 ${catastrophicRule.enabled ? 'text-rose-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">12. Stop Loss Catastrofico / Circuit Breaker (Livello 2)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={catastrophicRule.enabled}
                onChange={(e) => updateRule('CATASTROPHIC_CIRCUIT_BREAKER_SL', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            <strong>Attivo di default, disattivabile a scelta</strong>: Protegge il conto da crolli verticali, flash crash o notizie improvvise di shock tagliando la posizione a una perdita massima di sicurezza, senza interferire con le oscillazioni ordinarie.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div>
              <div className="flex justify-between text-slate-700 font-medium mb-1">
                <span>Soglia Massima Perdita Catastrofica:</span>
                <span className="font-mono text-rose-600 font-bold">{(catastrophicRule.parameters.catastrophicMaxLossPct ?? -3.00).toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="-6.0"
                max="-1.5"
                step="0.25"
                value={catastrophicRule.parameters.catastrophicMaxLossPct ?? -3.00}
                onChange={(e) => updateRule('CATASTROPHIC_CIRCUIT_BREAKER_SL', r => ({
                  ...r,
                  parameters: { ...r.parameters, catastrophicMaxLossPct: parseFloat(e.target.value) }
                }))}
                disabled={!catastrophicRule.enabled}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-rose-50/50 border border-rose-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                <div>
                  <span className="font-semibold text-slate-800">Paracadute di Emergenza Fondi</span>
                  <p className="text-[10px] text-slate-500">Non compete con lo Stop Tecnico (Livello 1) e interviene solo in caso di anomalie gravi</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                Hard Protection
              </span>
            </div>
          </div>
        </div>

        {/* Rule 13: Filtro Volatilità Operativa ATR (5m vs SMA 20) */}
        <div className={`p-4 rounded-xl border transition-all ${atrFilterRule.enabled ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${atrFilterRule.enabled ? 'text-amber-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">13. Filtro Volatilità Operativa ATR [ATR(14) 5m &gt;= SMA(20)]</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={atrFilterRule.enabled}
                onChange={(e) => updateRule('ATR_VOLATILITY_FILTER', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Inibisce l&apos;apertura di nuovi trade se l&apos;<strong>ATR(14) a 5 minuti</strong> è inferiore alla sua media mobile semplice a 20 periodi (<strong>SMA 20 dell&apos;ATR</strong>), evitando di entrare durante fasi di compressione, liquidità spenta o falso movimento laterale.
          </p>

          <div className="space-y-2.5 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div className="flex items-center justify-between p-2 rounded bg-amber-50/50 border border-amber-100">
              <div className="flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5 text-amber-600" />
                <div>
                  <span className="font-semibold text-slate-800">Controllo Espansione di Volatilità</span>
                  <p className="text-[10px] text-slate-500">Garantisce che il mercato abbia sufficiente momentum e ampiezza per raggiungere i target di profitto</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                ATR 5m Dynamic
              </span>
            </div>
          </div>
        </div>

        {/* Rule 14: Blocco Finestra Tossica Multi-IA (10:30 - 12:00 EST) */}
        <div className={`p-4 rounded-xl border transition-all ${toxicWindowRule.enabled ? 'bg-purple-50/50 border-purple-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock3 className={`w-4 h-4 ${toxicWindowRule.enabled ? 'text-purple-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">14. Blocco Finestra Tossica Multi-IA (10:30 - 12:00 EST)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={toxicWindowRule.enabled}
                onChange={(e) => updateRule('DYNAMIC_TIME_WINDOW_LOCK', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Blocco algoritmico basato sull&apos;analisi di consenso Multi-IA: inibisce nuovi ingressi nella fascia <strong>10:30 - 12:00 EST</strong>, identificata come la fascia oraria ad alta inefficienza e falsi breakout (mean-reversion noise).
          </p>

          <div className="space-y-2.5 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div className="flex items-center justify-between p-2 rounded bg-purple-50/50 border border-purple-100">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-purple-600" />
                <div>
                  <span className="font-semibold text-slate-800">Protezione da Rumore e Chop Intraday</span>
                  <p className="text-[10px] text-slate-500">Conserva il capitale e previene l&apos;overtrading nelle ore di stallo istituzionale</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                10:30 - 12:00 EST
              </span>
            </div>
          </div>
        </div>

        {/* Rule 15: Hard-Risk Management (Stop Loss -1%, TP +2%, Cooldown SL & Max Daily Loss) */}
        <div className={`p-4 rounded-xl border transition-all ${hardRiskRule.enabled ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${hardRiskRule.enabled ? 'text-indigo-600' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">15. Hard-Risk Management (R:R 1:2, Cooldown &amp; Daily Loss Limit)</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hardRiskRule.enabled}
                onChange={(e) => updateRule('HARD_RISK_MANAGEMENT', r => ({ ...r, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <p className="text-[11px] text-slate-600 mb-3">
            Protocollo matematico di conservazione del capitale: <strong>Stop Loss -1.00%</strong>, <strong>Take Profit +2.00% (R:R 1:2)</strong>, <strong>Cooldown di 30 min</strong> dopo 2 Stop-Loss consecutivi e <strong>blocco operatività giornaliero al -1.00%</strong> di perdita sul conto.
          </p>

          <div className="space-y-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-1">
                  <span>Limite Perdita Giornaliera:</span>
                  <span className="font-mono text-rose-600 font-bold">{(hardRiskRule.parameters.maxDailyLossPct ?? -1.00).toFixed(2)}%</span>
                </div>
                <input
                  type="range"
                  min="-3.0"
                  max="-0.5"
                  step="0.25"
                  value={hardRiskRule.parameters.maxDailyLossPct ?? -1.00}
                  onChange={(e) => updateRule('HARD_RISK_MANAGEMENT', r => ({
                    ...r,
                    parameters: { ...r.parameters, maxDailyLossPct: parseFloat(e.target.value) }
                  }))}
                  disabled={!hardRiskRule.enabled}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-1">
                  <span>Cooldown Stop Consecutivi (min):</span>
                  <span className="font-mono text-indigo-600 font-bold">{hardRiskRule.parameters.consecutiveSlCooldownMinutes ?? 30} min</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="5"
                  value={hardRiskRule.parameters.consecutiveSlCooldownMinutes ?? 30}
                  onChange={(e) => updateRule('HARD_RISK_MANAGEMENT', r => ({
                    ...r,
                    parameters: { ...r.parameters, consecutiveSlCooldownMinutes: parseInt(e.target.value, 10) }
                  }))}
                  disabled={!hardRiskRule.enabled}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-indigo-50/50 border border-indigo-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <div>
                  <span className="font-semibold text-slate-800">Regola Anti-Martingala &amp; Salvaguardia Capitale</span>
                  <p className="text-[10px] text-slate-500">R:R 1:2 rigoroso, stop automatico alla seconda perdita consecutiva</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                Hard Stop &amp; Cooldown
              </span>
            </div>
          </div>
        </div>

      </div>
      )}
    </div>
  );
}
