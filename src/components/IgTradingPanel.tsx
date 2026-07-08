import React from 'react';
import { 
  ShieldCheck, 
  Bot, 
  Activity, 
  RefreshCw, 
  Settings, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

interface IgTradingPanelProps {
  igAutoStatus: any;
  igRealAccountId: string;
  setIgRealAccountId: (val: string) => void;
  igRealApiKey: string;
  setIgRealApiKey: (val: string) => void;
  igRealUsername: string;
  setIgRealUsername: (val: string) => void;
  igRealPassword: string;
  setIgRealPassword: (val: string) => void;

  igDemoAccountId: string;
  setIgDemoAccountId: (val: string) => void;
  igDemoApiKey: string;
  setIgDemoApiKey: (val: string) => void;
  igDemoUsername: string;
  setIgDemoUsername: (val: string) => void;
  igDemoPassword: string;
  setIgDemoPassword: (val: string) => void;

  savingIgCreds: boolean;
  triggeringCycle: boolean;
  submittingAutoToggle: boolean;
  confirmCloseInstrument: string | null;
  setConfirmCloseInstrument: (val: string | null) => void;

  handleSaveIgCredentialsForMode: (mode: 'real' | 'demo') => void;
  handleToggleIgBot: (mode: 'real' | 'demo') => void;
  handleTriggerIgBot: (mode: 'real' | 'demo') => void;
  handleResetIgLogs: (mode: 'real' | 'demo') => void;
  handleCloseIgPosition: (symbol: string, mode: 'real' | 'demo') => void;

  editingRealSettings: boolean;
  setEditingRealSettings: (val: boolean) => void;
  draftRealTP: string;
  setDraftRealTP: (val: string) => void;
  draftRealSL: string;
  setDraftRealSL: (val: string) => void;
  draftRealRisk: string;
  setDraftRealRisk: (val: string) => void;
  savingRealSettings: boolean;

  editingDemoSettings: boolean;
  setEditingDemoSettings: (val: boolean) => void;
  draftDemoTP: string;
  setDraftDemoTP: (val: string) => void;
  draftDemoSL: string;
  setDraftDemoSL: (val: string) => void;
  draftDemoRisk: string;
  setDraftDemoRisk: (val: string) => void;
  savingDemoSettings: boolean;

  handleSaveIgSettings: (mode: 'real' | 'demo') => void;
}

export const IgTradingPanel: React.FC<IgTradingPanelProps> = ({
  igAutoStatus,
  igRealAccountId,
  setIgRealAccountId,
  igRealApiKey,
  setIgRealApiKey,
  igRealUsername,
  setIgRealUsername,
  igRealPassword,
  setIgRealPassword,

  igDemoAccountId,
  setIgDemoAccountId,
  igDemoApiKey,
  setIgDemoApiKey,
  igDemoUsername,
  setIgDemoUsername,
  igDemoPassword,
  setIgDemoPassword,

  savingIgCreds,
  triggeringCycle,
  submittingAutoToggle,
  confirmCloseInstrument,
  setConfirmCloseInstrument,

  handleSaveIgCredentialsForMode,
  handleToggleIgBot,
  handleTriggerIgBot,
  handleResetIgLogs,
  handleCloseIgPosition,

  editingRealSettings,
  setEditingRealSettings,
  draftRealTP,
  setDraftRealTP,
  draftRealSL,
  setDraftRealSL,
  draftRealRisk,
  setDraftRealRisk,
  savingRealSettings,

  editingDemoSettings,
  setEditingDemoSettings,
  draftDemoTP,
  setDraftDemoTP,
  draftDemoSL,
  setDraftDemoSL,
  draftDemoRisk,
  setDraftDemoRisk,
  savingDemoSettings,

  handleSaveIgSettings,
}) => {
  return (
    <div className="space-y-8 mb-6" id="ig-dual-trading-panel">
      {/* 1. SEZIONE CONTO REAL */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6" id="conto-real-section">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600 animate-pulse" />
            CONTO REAL (Reale)
          </h3>
          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${igAutoStatus?.real?.status?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {igAutoStatus?.real?.status?.active ? 'BOT ATTIVO' : 'BOT FERMO'}
          </span>
        </div>

        {/* Inputs Credenziali */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Nome Conto (ID)</label>
            <input
              type="text"
              placeholder="es. PTAH8"
              value={igRealAccountId}
              onChange={e => setIgRealAccountId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-mono focus:border-indigo-500 focus:ring-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Chiave API Real</label>
            <input
              type="text"
              placeholder="Chiave API IG"
              value={igRealApiKey}
              onChange={e => setIgRealApiKey(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-mono focus:border-indigo-500 focus:ring-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Username (No Email!)</label>
            <input
              type="text"
              placeholder="Username IG"
              value={igRealUsername}
              onChange={e => setIgRealUsername(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-mono focus:border-indigo-500 focus:ring-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Password</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Aggiorna password"
                value={igRealPassword}
                onChange={e => setIgRealPassword(e.target.value)}
                className="flex-1 text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:border-indigo-500 focus:ring-1"
              />
              <button
                type="button"
                onClick={() => handleSaveIgCredentialsForMode('real')}
                disabled={savingIgCreds}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer border-none"
              >
                Salva
              </button>
            </div>
          </div>
        </div>

        {/* Status Panel (Subito sotto gli input) */}
        <div className="bg-amber-50/20 border border-amber-200/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${igAutoStatus?.real?.status?.active ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase">
                Stato Conto REAL
              </h4>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Nome Conto:</span>
                <span className="text-slate-800 text-xs font-mono font-bold">{igRealAccountId || 'Non configurato'}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Bilancio:</span>
                <span className="text-indigo-600 text-sm font-mono font-bold">
                  {igAutoStatus?.real?.status?.balance !== undefined ? parseFloat(igAutoStatus.real.status.balance).toFixed(2) : '0.00'} EUR
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTriggerIgBot('real')}
              disabled={triggeringCycle}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${triggeringCycle ? 'animate-spin' : ''}`} />
              Esegui Ciclo Real
            </button>
            <button
              type="button"
              onClick={() => handleToggleIgBot('real')}
              disabled={submittingAutoToggle}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs transition-all border-none cursor-pointer ${
                igAutoStatus?.real?.status?.active
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
              }`}
            >
              {igAutoStatus?.real?.status?.active ? 'Arresta Bot Real' : 'Avvia Bot Real'}
            </button>
          </div>
        </div>

        {/* Impostazioni Trade & Posizioni Aperte */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Impostazioni Trade */}
          <div className="lg:col-span-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Settings className="w-3.5 h-3.5 text-indigo-500" />
                  Impostazioni Trade Real
                </span>
                {editingRealSettings ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setEditingRealSettings(false)}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 bg-transparent border-none cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button 
                      onClick={() => handleSaveIgSettings('real')}
                      disabled={savingRealSettings}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-transparent border-none cursor-pointer"
                    >
                      Salva
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setEditingRealSettings(true)}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-transparent border-none cursor-pointer"
                  >
                    Modifica
                  </button>
                )}
              </div>
              
              {editingRealSettings ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">Take Profit (pips)</label>
                      <input 
                        type="number"
                        step="1"
                        value={draftRealTP}
                        onChange={e => setDraftRealTP(e.target.value)}
                        className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">Stop Loss (pips)</label>
                      <input 
                        type="number"
                        step="1"
                        value={draftRealSL}
                        onChange={e => setDraftRealSL(e.target.value)}
                        className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 font-bold block mb-1">Rischio per Trade (% saldo)</label>
                    <input 
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="10"
                      value={draftRealRisk}
                      onChange={e => setDraftRealRisk(e.target.value)}
                      className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block">Take Profit</span>
                    <span className="text-xs font-bold text-green-600">+{igAutoStatus?.real?.status?.defaultTP ?? 20.00} pips</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block">Stop Loss</span>
                    <span className="text-xs font-bold text-rose-600">{igAutoStatus?.real?.status?.defaultSL ?? -50.00} pips</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block">Rischio</span>
                    <span className="text-xs font-bold text-indigo-600">{igAutoStatus?.real?.status?.riskPercentage ?? 5}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 mt-4 border-t border-slate-100 pt-2 font-medium">
              Monitoraggio: <span className="font-bold text-slate-600 uppercase">EUR/USD, GBP/USD, USD/JPY, AUD/USD, EUR/GBP</span>
            </div>
          </div>

          {/* Posizioni Aperte */}
          <div className="lg:col-span-8 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 border-b border-slate-200/60 pb-1">
              Posizioni Aperte REAL ({igAutoStatus?.real?.positions?.length || 0})
            </h4>
            <div className="space-y-2 overflow-y-auto max-h-36">
              {igAutoStatus?.real?.positions && igAutoStatus.real.positions.length > 0 ? (
                igAutoStatus.real.positions.map((pos: any, idx: number) => {
                  const plNum = parseFloat(pos.unrealized_pl || '0');
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/60 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">{pos.symbol.replace('_', '/')}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          pos.side === 'buy' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {pos.side === 'buy' ? 'BUY' : 'SELL'}
                        </span>
                        <span className="text-slate-400 font-mono">Dim: {pos.qty}</span>
                        <span className="text-slate-400 font-mono">Entry: {parseFloat(pos.avg_entry_price).toFixed(5)}</span>
                      </div>
                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <span className={`font-mono font-bold ${plNum >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {plNum >= 0 ? '+' : ''}{plNum.toFixed(2)} €
                        </span>
                        {confirmCloseInstrument === pos.symbol ? (
                          <div className="flex items-center gap-1 bg-red-50 p-0.5 rounded border border-red-100">
                            <button
                              onClick={() => handleCloseIgPosition(pos.symbol, 'real')}
                              className="bg-red-600 text-white font-bold text-[9px] px-2 py-0.5 rounded border-none cursor-pointer"
                            >
                              Sì
                            </button>
                            <button
                              onClick={() => setConfirmCloseInstrument(null)}
                              className="bg-slate-200 text-slate-700 font-bold text-[9px] px-1.5 py-0.5 rounded border-none cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmCloseInstrument(pos.symbol)}
                            className="text-[9px] font-semibold text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded border border-rose-200 cursor-pointer"
                          >
                            Liquida
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-slate-400 italic text-[11px]">
                  Nessuna posizione aperta su IG Markets REAL.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Console Log Real */}
        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col h-[200px]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">
              Console Log & Decisioni REAL
            </span>
            <button
              type="button"
              onClick={() => handleResetIgLogs('real')}
              className="text-[9px] font-semibold text-rose-400 hover:text-rose-300 bg-transparent border-none cursor-pointer"
            >
              Azzera Log Real
            </button>
          </div>
          <div className="p-3 overflow-y-auto font-mono text-[10px] text-slate-300 flex-1 scrollbar-thin">
            {igAutoStatus?.real?.status?.logs && igAutoStatus.real.status.logs.length > 0 ? (
              igAutoStatus.real.status.logs.slice(0, 30).map((log: string, lIdx: number) => {
                let col = 'text-slate-400';
                if (log.includes('Errore') || log.includes('fallita')) col = 'text-rose-400';
                if (log.includes('successo') || log.includes('eseguito')) col = 'text-emerald-400';
                return (
                  <div key={lIdx} className={`py-0.5 border-b border-slate-800/20 ${col}`}>
                    {log}
                  </div>
                );
              })
            ) : (
              <div className="text-slate-500 text-center py-8">Nessun log disponibile per la modalità REAL.</div>
            )}
          </div>
        </div>
      </div>

      {/* 2. SEZIONE CONTO DEMO */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6" id="conto-demo-section">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600 animate-pulse" />
            CONTO DEMO (Virtuale)
          </h3>
          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${igAutoStatus?.demo?.status?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {igAutoStatus?.demo?.status?.active ? 'BOT ATTIVO' : 'BOT FERMO'}
          </span>
        </div>

        {/* Inputs Credenziali */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Nome Conto Demo (ID)</label>
            <input
              type="text"
              placeholder="es. Z6CKEO"
              value={igDemoAccountId}
              onChange={e => setIgDemoAccountId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-mono focus:border-indigo-500 focus:ring-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Chiave API Demo</label>
            <input
              type="text"
              placeholder="Chiave API IG Demo"
              value={igDemoApiKey}
              onChange={e => setIgDemoApiKey(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-mono focus:border-indigo-500 focus:ring-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Username Demo (No Email!)</label>
            <input
              type="text"
              placeholder="Username IG Demo"
              value={igDemoUsername}
              onChange={e => setIgDemoUsername(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-mono focus:border-indigo-500 focus:ring-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Password Demo</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Aggiorna password"
                value={igDemoPassword}
                onChange={e => setIgDemoPassword(e.target.value)}
                className="flex-1 text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:border-indigo-500 focus:ring-1"
              />
              <button
                type="button"
                onClick={() => handleSaveIgCredentialsForMode('demo')}
                disabled={savingIgCreds}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer border-none"
              >
                Salva
              </button>
            </div>
          </div>
        </div>

        {/* Status Panel (Subito sotto gli input) */}
        <div className="bg-indigo-50/20 border border-indigo-200/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${igAutoStatus?.demo?.status?.active ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase">
                Stato Conto DEMO
              </h4>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Nome Conto:</span>
                <span className="text-slate-800 text-xs font-mono font-bold">{igDemoAccountId || 'Non configurato'}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Bilancio:</span>
                <span className="text-indigo-600 text-sm font-mono font-bold">
                  {igAutoStatus?.demo?.status?.balance !== undefined ? parseFloat(igAutoStatus.demo.status.balance).toFixed(2) : '0.00'} EUR
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTriggerIgBot('demo')}
              disabled={triggeringCycle}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${triggeringCycle ? 'animate-spin' : ''}`} />
              Esegui Ciclo Demo
            </button>
            <button
              type="button"
              onClick={() => handleToggleIgBot('demo')}
              disabled={submittingAutoToggle}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs transition-all border-none cursor-pointer ${
                igAutoStatus?.demo?.status?.active
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
              }`}
            >
              {igAutoStatus?.demo?.status?.active ? 'Arresta Bot Demo' : 'Avvia Bot Demo'}
            </button>
          </div>
        </div>

        {/* Impostazioni Trade & Posizioni Aperte */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Impostazioni Trade */}
          <div className="lg:col-span-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Settings className="w-3.5 h-3.5 text-indigo-500" />
                  Impostazioni Trade Demo
                </span>
                {editingDemoSettings ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setEditingDemoSettings(false)}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 bg-transparent border-none cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button 
                      onClick={() => handleSaveIgSettings('demo')}
                      disabled={savingDemoSettings}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-transparent border-none cursor-pointer"
                    >
                      Salva
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setEditingDemoSettings(true)}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-transparent border-none cursor-pointer"
                  >
                    Modifica
                  </button>
                )}
              </div>
              
              {editingDemoSettings ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">Take Profit (pips)</label>
                      <input 
                        type="number"
                        step="1"
                        value={draftDemoTP}
                        onChange={e => setDraftDemoTP(e.target.value)}
                        className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">Stop Loss (pips)</label>
                      <input 
                        type="number"
                        step="1"
                        value={draftDemoSL}
                        onChange={e => setDraftDemoSL(e.target.value)}
                        className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 font-bold block mb-1">Rischio per Trade (% saldo)</label>
                    <input 
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="10"
                      value={draftDemoRisk}
                      onChange={e => setDraftDemoRisk(e.target.value)}
                      className="w-full text-xs p-1.5 rounded border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block">Take Profit</span>
                    <span className="text-xs font-bold text-green-600">+{igAutoStatus?.demo?.status?.defaultTP ?? 20.00} pips</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block">Stop Loss</span>
                    <span className="text-xs font-bold text-rose-600">{igAutoStatus?.demo?.status?.defaultSL ?? -50.00} pips</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold block">Rischio</span>
                    <span className="text-xs font-bold text-indigo-600">{igAutoStatus?.demo?.status?.riskPercentage ?? 5}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 mt-4 border-t border-slate-100 pt-2 font-medium">
              Monitoraggio: <span className="font-bold text-slate-600 uppercase">EUR/USD, GBP/USD, USD/JPY, AUD/USD, EUR/GBP</span>
            </div>
          </div>

          {/* Posizioni Aperte */}
          <div className="lg:col-span-8 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 border-b border-slate-200/60 pb-1">
              Posizioni Aperte DEMO ({igAutoStatus?.demo?.positions?.length || 0})
            </h4>
            <div className="space-y-2 overflow-y-auto max-h-36">
              {igAutoStatus?.demo?.positions && igAutoStatus.demo.positions.length > 0 ? (
                igAutoStatus.demo.positions.map((pos: any, idx: number) => {
                  const plNum = parseFloat(pos.unrealized_pl || '0');
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/60 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">{pos.symbol.replace('_', '/')}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          pos.side === 'buy' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {pos.side === 'buy' ? 'BUY' : 'SELL'}
                        </span>
                        <span className="text-slate-400 font-mono">Dim: {pos.qty}</span>
                        <span className="text-slate-400 font-mono">Entry: {parseFloat(pos.avg_entry_price).toFixed(5)}</span>
                      </div>
                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <span className={`font-mono font-bold ${plNum >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {plNum >= 0 ? '+' : ''}{plNum.toFixed(2)} €
                        </span>
                        {confirmCloseInstrument === pos.symbol ? (
                          <div className="flex items-center gap-1 bg-red-50 p-0.5 rounded border border-red-100">
                            <button
                              onClick={() => handleCloseIgPosition(pos.symbol, 'demo')}
                              className="bg-red-600 text-white font-bold text-[9px] px-2 py-0.5 rounded border-none cursor-pointer"
                            >
                              Sì
                            </button>
                            <button
                              onClick={() => setConfirmCloseInstrument(null)}
                              className="bg-slate-200 text-slate-700 font-bold text-[9px] px-1.5 py-0.5 rounded border-none cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmCloseInstrument(pos.symbol)}
                            className="text-[9px] font-semibold text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded border border-rose-200 cursor-pointer"
                          >
                            Liquida
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-slate-400 italic text-[11px]">
                  Nessuna posizione aperta su IG Markets DEMO.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Console Log Demo */}
        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col h-[200px]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">
              Console Log & Decisioni DEMO
            </span>
            <button
              type="button"
              onClick={() => handleResetIgLogs('demo')}
              className="text-[9px] font-semibold text-rose-400 hover:text-rose-300 bg-transparent border-none cursor-pointer"
            >
              Azzera Log Demo
                </button>
          </div>
          <div className="p-3 overflow-y-auto font-mono text-[10px] text-slate-300 flex-1 scrollbar-thin">
            {igAutoStatus?.demo?.status?.logs && igAutoStatus.demo.status.logs.length > 0 ? (
              igAutoStatus.demo.status.logs.slice(0, 30).map((log: string, lIdx: number) => {
                let col = 'text-slate-400';
                if (log.includes('Errore') || log.includes('fallita')) col = 'text-rose-400';
                if (log.includes('successo') || log.includes('eseguito')) col = 'text-emerald-400';
                return (
                  <div key={lIdx} className={`py-0.5 border-b border-slate-800/20 ${col}`}>
                    {log}
                  </div>
                );
              })
            ) : (
              <div className="text-slate-500 text-center py-8">Nessun log disponibile per la modalità DEMO.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
