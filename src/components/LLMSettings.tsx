import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle2, AlertCircle, Download, Upload, RefreshCw } from 'lucide-react';

interface ProviderConfig {
  provider: string;
  model: string;
  hasKey: boolean;
  maskedKey: string;
}

export function LLMSettings() {
  const providers = ['gemini', 'mistral', 'anthropic', 'deepseek', 'groq'];

  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({});
  const [preferredProvider, setPreferredProvider] = useState<string>('gemini');
  const [failoverEnabled, setFailoverEnabled] = useState<boolean>(true);
  const [providerOrder, setProviderOrder] = useState<string[]>(providers);

  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form states for adding/editing keys
  const [selectedProvider, setSelectedProvider] = useState<string>('mistral');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [orderInput, setOrderInput] = useState<string>('');

  // Backup states and handlers
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);

  const handleExport = async () => {
    setBackupLoading(true);
    setBackupError(null);
    setBackupSuccess(null);
    try {
      const res = await fetch('/api/backup/export');
      if (!res.ok) throw new Error('Errore durante il download del backup');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trading_bot_logs_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setBackupSuccess('Backup esportato con successo!');
    } catch (err: any) {
      setBackupError(err.message || 'Errore durante l\'esportazione.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setBackupLoading(true);
    setBackupError(null);
    setBackupSuccess(null);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        const response = await fetch('/api/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });
        
        const result = await response.json();
        if (result.success) {
          setBackupSuccess(`Backup importato con successo! Uniti: ${result.counts.paperLogicLogs} log Paper e ${result.counts.liveLogicLogs} log Live.`);
        } else {
          throw new Error(result.error || 'Errore sconosciuto');
        }
      } catch (err: any) {
        setBackupError('File non valido: ' + (err.message || 'Controlla la struttura del JSON.'));
      } finally {
        setBackupLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/llm/configs');
      const data = await res.json();
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
      }
    } catch (e) {
      console.error('Failed to fetch LLM configs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProvider = async () => {
    if (!selectedProvider) return;
    
    try {
      setSaving(true);
      setStatusMsg(null);
      
      const payload: any = { provider: selectedProvider };
      if (apiKeyInput.trim()) payload.apiKey = apiKeyInput;
      if (modelInput.trim()) payload.model = modelInput;

      const res = await fetch('/api/llm/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Configurazione aggiornata con successo!' });
        setApiKeyInput('');
        setModelInput('');
        await fetchConfigs();
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

  const handleSavePreferences = async () => {
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
        setStatusMsg({ type: 'success', text: 'Preferenze aggiornate con successo!' });
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
    return <div className="text-xs text-slate-400">Caricamento configurazioni LLM...</div>;
  }

  return (
    <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-5 animate-in fade-in duration-200 mt-2">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-bold text-indigo-400 uppercase">Configurazione Multi-LLM</h4>
        </div>
        <button 
          onClick={async () => {
            setLoading(true);
            try {
              const res = await fetch('/api/llm/sync', { method: 'POST' });
              if (res.ok) {
                setStatusMsg({ type: 'success', text: 'Chiavi API e configurazioni reimportate!' });
                await fetchConfigs();
              }
            } catch (e) {
              setStatusMsg({ type: 'error', text: 'Errore di reimportazione' });
            } finally {
              setLoading(false);
              setTimeout(() => setStatusMsg(null), 3000);
            }
          }}
          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors flex items-center gap-1"
        >
          🔄 Reimporta Chiavi/Config
        </button>
      </div>

      {statusMsg && (
        <div className={`p-2 rounded-md text-xs flex items-center gap-1.5 ${statusMsg.type === 'success' ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800' : 'bg-rose-950/40 text-rose-300 border border-rose-800'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {statusMsg.text}
        </div>
      )}

      {/* Preferences Section */}
      <div className="space-y-3 bg-slate-800/50 p-3 rounded-lg border border-slate-800">
        <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Preferenze Generali</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Provider Preferito (Primario)</label>
            <select
              value={preferredProvider}
              onChange={(e) => setPreferredProvider(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
            >
              {providers.map(p => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Ordine di Cascata (virgola sep.)</label>
            <input
              type="text"
              value={orderInput}
              onChange={(e) => {
                setOrderInput(e.target.value);
                const order = e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(s => providers.includes(s));
                if (order.length > 0) setProviderOrder(order);
              }}
              placeholder="es. mistral, gemini, anthropic"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none font-mono"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer pb-1.5">
              <input 
                type="checkbox" 
                checked={failoverEnabled}
                onChange={(e) => setFailoverEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 bg-slate-800"
              />
              <span className="text-xs text-slate-300">Abilita Failover Automatico (Cascata)</span>
            </label>
          </div>
        </div>
        <button
          onClick={handleSavePreferences}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          Salva Preferenze
        </button>
      </div>

      {/* API Keys Configuration */}
      <div className="space-y-3">
        <h5 className="text-[10px] font-bold text-slate-400 uppercase">Gestione Chiavi API & Modelli</h5>
        
        <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1.5fr_auto] gap-2 items-end">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setModelInput(configs[e.target.value]?.model || '');
                setApiKeyInput('');
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
            >
              {providers.filter(p => p !== 'gemini').map(p => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
              <option value="gemini">GEMINI (Env Default)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">API Key {configs[selectedProvider]?.hasKey ? '(Configurata)' : ''}</label>
            <input
              type="password"
              placeholder={configs[selectedProvider]?.hasKey ? "Lascia vuoto per non modificare" : "Inserisci API Key..."}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Modello (Opzionale)</label>
            <input
              type="text"
              placeholder={configs[selectedProvider]?.model || 'Modello default'}
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none font-mono"
            />
          </div>
          <div>
            <button
              onClick={handleUpdateProvider}
              disabled={saving}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
            >
              Aggiorna
            </button>
          </div>
        </form>
      </div>
      
      {/* Status Table */}
      <div className="bg-slate-950/50 rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[9px]">
            <tr>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Stato</th>
              <th className="px-3 py-2">Modello Configurato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {providers.map(p => {
              const conf = configs[p];
              const isGemini = p === 'gemini';
              // Per Gemini, se non c'è una chiave specifica ma c'è quella d'ambiente, lo consideriamo attivo (viene gestito lato backend)
              const hasKey = conf?.hasKey || isGemini;
              
              return (
                <tr key={p}>
                  <td className="px-3 py-2 font-medium capitalize flex items-center gap-1.5">
                    {p} 
                    {preferredProvider === p && <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[8px] uppercase">Primario</span>}
                  </td>
                  <td className="px-3 py-2">
                    {hasKey ? (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Attivo</span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Mancante</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">
                    {conf?.model || 'Default System'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sezione Gestione Backup dei Log */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-lg p-4 mt-4 space-y-4">
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

        <p className="text-[11px] text-slate-400 leading-relaxed">
          I log operativi e decisionali (loop al bot) vengono salvati e aggregati continuamente sia in tempo reale su 
          Firestore (Firebase), sia localmente sul server in un file di backup persistente a intervalli di 30 secondi. 
          Se Firebase dovesse esaurire le quote di lettura, il bot utilizzerà automaticamente i dati locali 
          senza interrompere l'analisi dei debriefing settimanali.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleExport}
            disabled={backupLoading}
            className="flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-200 text-xs font-medium px-4 py-2.5 rounded-md transition-all disabled:opacity-50 animate-pulse-subtle"
          >
            <Download className="w-3.5 h-3.5" />
            Esporta Backup Log (JSON)
          </button>

          <label className="flex items-center justify-center gap-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-medium px-4 py-2.5 rounded-md transition-all cursor-pointer disabled:opacity-50 text-center">
            <Upload className="w-3.5 h-3.5" />
            Importa Backup Log (JSON)
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={backupLoading}
              className="hidden"
            />
          </label>
        </div>

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
