import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle2, AlertCircle, Save, Table, Eye, EyeOff, RefreshCw, Key } from 'lucide-react';
import { initAuth, googleSignIn, getAccessToken } from '../auth';
import { User } from 'firebase/auth';

interface ProviderConfig {
  provider: string;
  model: string;
  hasKey: boolean;
  maskedKey: string;
}

export function LLMSettings() {
  const providers = ['gemini', 'mistral', 'anthropic', 'deepseek', 'groq'];

  // LLM Configs
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({});
  const [preferredProvider, setPreferredProvider] = useState<string>('gemini');
  const [failoverEnabled, setFailoverEnabled] = useState<boolean>(true);
  const [providerOrder, setProviderOrder] = useState<string[]>(providers);
  const [orderInput, setOrderInput] = useState<string>('');

  // Editable keys for LLMs
  const [llmKeys, setLlmKeys] = useState<Record<string, string>>({
    gemini: '',
    mistral: '',
    anthropic: '',
    deepseek: '',
    groq: ''
  });
  const [llmModels, setLlmModels] = useState<Record<string, string>>({
    gemini: '',
    mistral: '',
    anthropic: '',
    deepseek: '',
    groq: ''
  });

  // Editable keys for Alpaca
  const [alpacaPaperKey, setAlpacaPaperKey] = useState('');
  const [alpacaPaperSecret, setAlpacaPaperSecret] = useState('');
  const [alpacaLiveKey, setAlpacaLiveKey] = useState('');
  const [alpacaLiveSecret, setAlpacaLiveSecret] = useState('');

  // Password visibility state
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const toggleShowSecret = (fieldKey: string) => {
    setShowSecrets(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Backup & Sheets state
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [sheetsSyncLoading, setSheetsSyncLoading] = useState(false);
  const [sheetsExportLoading, setSheetsExportLoading] = useState(false);
  const [sheetsSyncMsg, setSheetsSyncMsg] = useState<string | null>(null);

  const [needsAuth, setNeedsAuth] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    initAuth(
      (u, t) => { setNeedsAuth(false); setToken(t); setUser(u); },
      () => setNeedsAuth(true)
    );
  }, []);

  const handleExportToSheets = async () => {
    setSheetsExportLoading(true);
    setSheetsSyncMsg(null);
    setBackupError(null);
    try {
      let currentToken = token;
      if (needsAuth || !currentToken) {
        setIsLoggingIn(true);
        const result = await googleSignIn();
        if (result) {
          currentToken = result.accessToken;
          setToken(currentToken);
          setNeedsAuth(false);
        }
        setIsLoggingIn(false);
      }
      const res = await fetch('/api/sheets/backup-credentials', { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setSheetsSyncMsg(data.message || 'Chiavi API esportate con successo su Google Sheets nella scheda API KEYS!');
      } else {
        throw new Error(data.error || 'Errore durante l\'esportazione');
      }
    } catch (err: any) {
      setBackupError('Errore esportazione Sheets: ' + (err.message || 'Impossibile inviare dati'));
    } finally {
      setSheetsExportLoading(false);
    }
  };

  const handleSyncFromSheets = async () => {
    setSheetsSyncLoading(true);
    setSheetsSyncMsg(null);
    setBackupError(null);
    try {
      let currentToken = token;
      if (needsAuth || !currentToken) {
        setIsLoggingIn(true);
        const result = await googleSignIn();
        if (result) {
          currentToken = result.accessToken;
          setToken(currentToken);
          setNeedsAuth(false);
        }
        setIsLoggingIn(false);
      }
      const res = await fetch('/api/sheets/sync', { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setSheetsSyncMsg(data.message || 'Sincronizzazione da Google Sheets completata!');
        await loadAllCredentials();
      } else {
        throw new Error(data.error || 'Errore sincronizzazione');
      }
    } catch (err: any) {
      setBackupError('Errore sincronizzazione Sheets: ' + (err.message || 'Impossibile completare'));
    } finally {
      setSheetsSyncLoading(false);
    }
  };

  useEffect(() => {
    loadAllCredentials();
  }, []);

  const loadAllCredentials = async () => {
    try {
      setLoading(true);
      
      // Load Alpaca keys
      const credsRes = await fetch('/api/trading/credentials');
      if (credsRes.ok) {
        const credsData = await credsRes.json();
        const paper = credsData.config?.alpaca?.paper || {};
        const real = credsData.config?.alpaca?.real || credsData.config?.alpaca?.live || {};
        setAlpacaPaperKey(paper.apiKey || paper.username || '');
        setAlpacaPaperSecret(paper.secretKey || paper.password || '');
        setAlpacaLiveKey(real.apiKey || real.username || '');
        setAlpacaLiveSecret(real.secretKey || real.password || '');
      }

      // Load LLM Configs
      const llmRes = await fetch('/api/llm/configs');
      if (llmRes.ok) {
        const data = await llmRes.json();
        if (data.success) {
          setConfigs(data.configs || {});
          setPreferredProvider(data.preferredProvider || 'gemini');
          setFailoverEnabled(data.failoverEnabled ?? true);
          if (data.providerOrder) {
            setProviderOrder(data.providerOrder);
            setOrderInput(data.providerOrder.join(', '));
          } else {
            setOrderInput(providers.join(', '));
          }

          // Set default model inputs if present
          const newModels: Record<string, string> = {};
          providers.forEach(p => {
            newModels[p] = data.configs?.[p]?.model || '';
          });
          setLlmModels(prev => ({ ...prev, ...newModels }));
        }
      }
    } catch (e) {
      console.error('Failed to load credentials:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAllKeys = async () => {
    try {
      setSaving(true);
      setStatusMsg(null);

      // 1. Save Alpaca Paper
      if (alpacaPaperKey.trim() || alpacaPaperSecret.trim()) {
        await fetch('/api/trading/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            broker: 'alpaca',
            env: 'paper',
            credentials: { apiKey: alpacaPaperKey.trim(), secretKey: alpacaPaperSecret.trim() }
          })
        });
      }

      // 2. Save Alpaca Live
      if (alpacaLiveKey.trim() || alpacaLiveSecret.trim()) {
        await fetch('/api/trading/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            broker: 'alpaca',
            env: 'real',
            credentials: { apiKey: alpacaLiveKey.trim(), secretKey: alpacaLiveSecret.trim() }
          })
        });
      }

      // 3. Save LLM Keys
      for (const p of providers) {
        const keyVal = llmKeys[p]?.trim();
        const modelVal = llmModels[p]?.trim();
        if (keyVal || modelVal) {
          const payload: any = { provider: p };
          if (keyVal) payload.apiKey = keyVal;
          if (modelVal) payload.model = modelVal;

          await fetch('/api/llm/configs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      }

      // 4. Save LLM Preferences
      await fetch('/api/llm/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredProvider, failoverEnabled, providerOrder })
      });

      // 5. Automatic Sheet Backup
      try {
        await fetch('/api/sheets/backup-credentials', { method: 'POST' });
      } catch (err) {
        console.warn('Sheets backup sync skipped:', err);
      }

      setStatusMsg({ type: 'success', text: 'Tutte le chiavi API (Alpaca & LLM) salvate e sincronizzate con successo!' });
      
      // Clear key inputs to preserve security, reload config
      setLlmKeys({ gemini: '', mistral: '', anthropic: '', deepseek: '', groq: '' });
      await loadAllCredentials();

    } catch (e: any) {
      setStatusMsg({ type: 'error', text: 'Errore nel salvataggio delle chiavi: ' + (e.message || 'Errore di connessione') });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const handleSavePreferencesOnly = async () => {
    try {
      setSaving(true);
      setStatusMsg(null);

      const res = await fetch('/api/llm/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredProvider, failoverEnabled, providerOrder })
      });
      const data = await res.json();
      
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Preferenze LLM aggiornate con successo!' });
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Errore nell\'aggiornamento.' });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Errore di connessione al server.' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  if (loading) {
    return <div className="text-xs text-slate-400 p-4">Caricamento tabella chiavi in corso...</div>;
  }

  return (
    <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-5 animate-in fade-in duration-200 mt-2">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            Gestione Unificata Chiavi API & LLM
          </h4>
        </div>
        <button
          onClick={handleSaveAllKeys}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-md cursor-pointer border-none disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'SALVATAGGIO...' : 'SALVA TUTTE LE CHIAVI'}
        </button>
      </div>

      {statusMsg && (
        <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span className="font-medium">{statusMsg.text}</span>
        </div>
      )}

      {/* 2-COLUMN SHEET TABLE */}
      <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
              Tabella Credenziali (Struttura Google Sheets / Cloud)
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Scheda: API KEYS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 tracking-wider">
              <tr>
                <th className="px-4 py-3 w-1/3 border-r border-slate-800">
                  COLONNA 1: NOME CHIAVE
                </th>
                <th className="px-4 py-3 w-2/3">
                  COLONNA 2: CODICE / VALORE CHIAVE
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              
              {/* ALPACA PAPER API KEY */}
              <tr className="hover:bg-slate-900/40 transition-colors">
                <td className="px-4 py-2.5 font-bold text-indigo-300 border-r border-slate-800/80">
                  Alpaca Paper API Key ID
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecrets['paperKey'] ? 'text' : 'password'}
                      value={alpacaPaperKey}
                      onChange={(e) => setAlpacaPaperKey(e.target.value)}
                      placeholder="PKXXXXXXXXXXXXXXXXXX"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-emerald-300 font-mono focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('paperKey')}
                      className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer border-none bg-transparent"
                      title="Mostra/Nascondi"
                    >
                      {showSecrets['paperKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>

              {/* ALPACA PAPER SECRET KEY */}
              <tr className="hover:bg-slate-900/40 transition-colors">
                <td className="px-4 py-2.5 font-bold text-indigo-300 border-r border-slate-800/80">
                  Alpaca Paper Secret Key
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecrets['paperSecret'] ? 'text' : 'password'}
                      value={alpacaPaperSecret}
                      onChange={(e) => setAlpacaPaperSecret(e.target.value)}
                      placeholder="Inserisci Secret Key Paper..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-emerald-300 font-mono focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('paperSecret')}
                      className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer border-none bg-transparent"
                      title="Mostra/Nascondi"
                    >
                      {showSecrets['paperSecret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>

              {/* ALPACA LIVE API KEY */}
              <tr className="hover:bg-slate-900/40 transition-colors">
                <td className="px-4 py-2.5 font-bold text-amber-300 border-r border-slate-800/80">
                  Alpaca Live API Key ID
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecrets['liveKey'] ? 'text' : 'password'}
                      value={alpacaLiveKey}
                      onChange={(e) => setAlpacaLiveKey(e.target.value)}
                      placeholder="AKXXXXXXXXXXXXXXXXXX"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-200 font-mono focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('liveKey')}
                      className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer border-none bg-transparent"
                      title="Mostra/Nascondi"
                    >
                      {showSecrets['liveKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>

              {/* ALPACA LIVE SECRET KEY */}
              <tr className="hover:bg-slate-900/40 transition-colors">
                <td className="px-4 py-2.5 font-bold text-amber-300 border-r border-slate-800/80">
                  Alpaca Live Secret Key
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecrets['liveSecret'] ? 'text' : 'password'}
                      value={alpacaLiveSecret}
                      onChange={(e) => setAlpacaLiveSecret(e.target.value)}
                      placeholder="Inserisci Secret Key Live..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-200 font-mono focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('liveSecret')}
                      className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer border-none bg-transparent"
                      title="Mostra/Nascondi"
                    >
                      {showSecrets['liveSecret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>

              {/* LLM PROVIDER ROWS */}
              {providers.map((p) => {
                const conf = configs[p];
                const isGemini = p === 'gemini';
                const hasKey = conf?.hasKey || isGemini;
                const pLabel = p.toUpperCase();

                return (
                  <tr key={p} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-slate-200 border-r border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span>API {pLabel}</span>
                        {preferredProvider === p && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[8px] uppercase font-bold border border-indigo-500/30">
                            Primario
                          </span>
                        )}
                      </div>
                      <span className={`text-[9px] font-normal flex items-center gap-1 ${hasKey ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {hasKey ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {hasKey ? 'Attivo' : 'Mancante'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type={showSecrets[p] ? 'text' : 'password'}
                            value={llmKeys[p] || ''}
                            onChange={(e) => setLlmKeys({ ...llmKeys, [p]: e.target.value })}
                            placeholder={conf?.maskedKey ? `Configurato: ${conf.maskedKey}` : `Inserisci API Key ${pLabel}...`}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowSecret(p)}
                            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer border-none bg-transparent"
                            title="Mostra/Nascondi"
                          >
                            {showSecrets[p] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Modello Configurato */}
                        <div className="sm:w-1/3">
                          <input
                            type="text"
                            value={llmModels[p] || ''}
                            onChange={(e) => setLlmModels({ ...llmModels, [p]: e.target.value })}
                            placeholder={conf?.model || 'Modello default'}
                            className="w-full bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:border-indigo-500 outline-none text-right sm:text-left"
                            title="Modello AI utilizzato per questo provider"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>

        <div className="bg-slate-900/80 p-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleSaveAllKeys}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-md cursor-pointer border-none disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'SALVATAGGIO...' : 'SALVA TUTTE LE CHIAVI IN TABELLA'}
          </button>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-3 bg-slate-800/40 p-3.5 rounded-xl border border-slate-800">
        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          Preferenze Cascata & Failover Multi-LLM
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Provider Preferito (Primario)</label>
            <select
              value={preferredProvider}
              onChange={(e) => setPreferredProvider(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
            >
              {providers.map(p => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Ordine di Cascata (separato da virgola)</label>
            <input
              type="text"
              value={orderInput}
              onChange={(e) => {
                setOrderInput(e.target.value);
                const order = e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(s => providers.includes(s));
                if (order.length > 0) setProviderOrder(order);
              }}
              placeholder="es. gemini, mistral, anthropic"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none font-mono"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input 
                type="checkbox" 
                checked={failoverEnabled}
                onChange={(e) => setFailoverEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 bg-slate-900"
              />
              <span className="text-xs text-slate-300 font-medium">Abilita Failover Automatico (Cascata)</span>
            </label>
          </div>
        </div>
        <button
          onClick={handleSavePreferencesOnly}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer border-none"
        >
          Salva Preferenze Cascata
        </button>
      </div>

      {/* Sezione Gestione Backup dei Log */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Strategia Precauzionale & Backup Log
            </h5>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] uppercase font-mono font-medium flex items-center gap-1">
            ● Locale Resiliente
          </span>
        </div>

        {/* Sezione Google Drive Sync */}
        <div className="border border-indigo-900/50 bg-indigo-950/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-400" />
              <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Google Drive Sync (Cartella ID: 1ZtwUz2SMUQg20nPWYf_KWHfljK5kya1_)
              </h5>
            </div>
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[9px] uppercase font-mono font-medium">
              Attivo
            </span>
          </div>
          <div className="text-[11px] text-slate-300 space-y-1">
            <p>• <strong className="text-white">StoriaLOG.json</strong>: Salvataggio automatico dei log ogni 15 minuti (append senza sovrascrivere).</p>
            <p>• <strong className="text-white">ChiaviAPI.json</strong>: Salvataggio automatico ad ogni modifica chiavi e caricamento all'avvio bot.</p>
          </div>
        </div>

        {/* Sezione Google Sheets Sync / Export */}
        <div className="border border-emerald-900/50 bg-emerald-950/20 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4 text-emerald-400" />
              <h5 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                Google Sheets Integration (Scheda: API KEYS)
              </h5>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] uppercase font-mono font-medium">
              Sincronizzato
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Esporta automaticamente o sincronizza a due colonne (<strong>Tipo Chiave</strong>, <strong>Valore Chiave</strong>) tutte le credenziali Alpaca Paper, Live e i provider LLM (Gemini, Mistral, Anthropic, DeepSeek, Groq) nel foglio Google Sheets dedicato nella scheda <strong>API KEYS</strong>.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleExportToSheets}
              disabled={sheetsExportLoading || sheetsSyncLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 shadow cursor-pointer border-none disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sheetsExportLoading ? 'animate-spin' : ''}`} />
              {sheetsExportLoading ? 'ESPORTAZIONE IN CORSO...' : 'ESPORTA ORA CHIAVI SU GOOGLE SHEETS'}
            </button>
            <button
              onClick={handleSyncFromSheets}
              disabled={sheetsSyncLoading || sheetsExportLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 shadow cursor-pointer border-none disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sheetsSyncLoading ? 'animate-spin' : ''}`} />
              {sheetsSyncLoading ? 'SINCRONIZZAZIONE IN CORSO...' : 'RECUPERA / SINCRONIZZA DA GOOGLE SHEETS'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          I log operativi e decisionali (loop al bot) vengono salvati e aggregati continuamente sia in tempo reale su 
          Firestore (Firebase), sia localmente sul server in un file di backup persistente a intervalli di 30 secondi. 
          Se Firebase dovesse esaurire le quote di lettura, il bot utilizzerà automaticamente i dati locali 
          senza interrompere l'analisi dei debriefing settimanali.
        </p>

        {sheetsSyncMsg && (
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-xs">
            {sheetsSyncMsg}
          </div>
        )}

        {backupLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 justify-center py-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span>Elaborazione del backup in corso...</span>
          </div>
        )}

        {backupError && (
          <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-xs">
            {backupError}
          </div>
        )}

        {backupSuccess && (
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-xs">
            {backupSuccess}
          </div>
        )}
      </div>
    </div>
  );
}

