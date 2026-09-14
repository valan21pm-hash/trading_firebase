import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertOctagon, 
  ShieldAlert, 
  Clock, 
  Trash2, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Search, 
  Filter, 
  Flame,
  Layers,
  Sparkles,
  Database
} from 'lucide-react';
import { DiagnosticLogEntry, ExecutionCycleMetric, DiagnosticSummaryResponse, DiagnosticLogLevel } from '../types';

interface AdvancedDiagnosticLogsProps {
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning', title?: string) => void;
  onRefreshParentStatus?: () => void;
}

export const AdvancedDiagnosticLogs: React.FC<AdvancedDiagnosticLogsProps> = ({
  showToast,
  onRefreshParentStatus
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);
  const [data, setData] = useState<DiagnosticSummaryResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<DiagnosticLogLevel>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const fetchDiagnosticLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/diagnostics/summary');
      if (res.ok) {
        const json: DiagnosticSummaryResponse = await res.json();
        setData(json);
        setLastFetchTime(new Date());
      } else {
        if (!silent && showToast) {
          showToast('Errore durante il recupero dei log diagnostici.', 'error', 'Diagnostica');
        }
      }
    } catch (err: any) {
      if (!silent && showToast) {
        showToast(`Errore di rete: ${err.message}`, 'error', 'Diagnostica');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnosticLogs();
  }, []);

  // Polling automatico ogni 12 secondi se espanso e abilitato
  useEffect(() => {
    if (isCollapsed || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchDiagnosticLogs(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [isCollapsed, autoRefresh]);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/diagnostics/clear-cache', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        if (showToast) {
          showToast(result.message || 'Cache dei log diagnostici resettata con successo.', 'success', 'Cache Pulita');
        }
        await fetchDiagnosticLogs();
        if (onRefreshParentStatus) onRefreshParentStatus();
      } else {
        if (showToast) {
          showToast('Impossibile pulire la cache dei log.', 'error', 'Errore Cache');
        }
      }
    } catch (err: any) {
      if (showToast) {
        showToast(`Errore di comunicazione: ${err.message}`, 'error', 'Errore Cache');
      }
    } finally {
      setClearing(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!data || !data.logs) return [];
    return data.logs.filter(log => {
      // Filtro Categoria
      if (activeFilter === 'CRITICAL' && log.category !== 'CRITICAL_ERROR') return false;
      if (activeFilter === 'AUTH' && log.category !== 'AUTH_401') return false;
      if (activeFilter === 'TIMEOUT' && log.category !== 'TIMEOUT') return false;
      if (activeFilter === 'EXECUTION' && log.category !== 'EXECUTION_ANOMALY' && log.category !== 'WARNING') return false;

      // Ricerca testuale
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchMsg = log.message?.toLowerCase().includes(term);
        const matchSource = log.source?.toLowerCase().includes(term);
        const matchErr = log.errorType?.toLowerCase().includes(term);
        return matchMsg || matchSource || matchErr;
      }
      return true;
    });
  }, [data, activeFilter, searchTerm]);

  // Conteggio rapido badge critici
  const totalCriticalBadges = (data?.criticalErrorsCount || 0) + (data?.authErrorsCount || 0) + (data?.timeoutErrorsCount || 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mt-6 overflow-hidden transition-all duration-200">
      {/* Intestazione Sezione Comprimibile */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div 
          className="cursor-pointer select-none flex-1 group"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 group-hover:bg-rose-100 transition">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Log Diagnostici Avanzati & Anomalie Esecutive</span>
                {totalCriticalBadges > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-600 text-white animate-pulse">
                    {totalCriticalBadges} {totalCriticalBadges === 1 ? 'criticità' : 'criticità'}
                  </span>
                )}
                {data?.anomaliesCount && data.anomaliesCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {data.anomaliesCount} anomalie timing
                  </span>
                ) : null}
                {isCollapsed ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-rose-600 group-hover:text-rose-700 transition" />
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Isolamento automatico errori critici di runtime (401 Unauthorized, ordersToSubmit, Timeout API, crash) e monitoraggio ritardi cicli bot.
              </p>
            </div>
          </div>
        </div>

        {/* Pulsanti Rapidi Header */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={handleClearCache}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Svuota la cache dei log in memoria per liberare risorse e azzerare i log obsoleti"
          >
            <Trash2 className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
            <span>Pulisci Cache Log</span>
          </button>

          <button
            type="button"
            onClick={() => fetchDiagnosticLogs()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
            title="Aggiorna analisi log diagnostici"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Contenuto Espandibile */}
      {!isCollapsed && (
        <div className="p-4 sm:p-6 space-y-6 bg-slate-50/40">
          
          {/* 1. Bar Statistiche & KPI Diagnostici */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div 
              onClick={() => setActiveFilter('CRITICAL')}
              className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                activeFilter === 'CRITICAL' 
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20' 
                  : 'bg-white border-slate-200 hover:border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">Errori Critici</span>
                <span className="p-1 rounded-lg bg-rose-100 text-rose-600">
                  <Flame className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-rose-700">
                  {data?.criticalErrorsCount || 0}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">es. ReferenceError, Crash</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveFilter('AUTH')}
              className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                activeFilter === 'AUTH' 
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20' 
                  : 'bg-white border-slate-200 hover:border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">Auth 401 / Revoca</span>
                <span className="p-1 rounded-lg bg-amber-100 text-amber-700">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-amber-700">
                  {data?.authErrorsCount || 0}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Chiavi Alpaca / Token</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveFilter('TIMEOUT')}
              className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                activeFilter === 'TIMEOUT' 
                  ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20' 
                  : 'bg-white border-slate-200 hover:border-indigo-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">Timeout API / Rete</span>
                <span className="p-1 rounded-lg bg-indigo-100 text-indigo-700">
                  <Clock className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-indigo-700">
                  {data?.timeoutErrorsCount || 0}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Alpaca, Firebase, AI</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveFilter('EXECUTION')}
              className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                activeFilter === 'EXECUTION' 
                  ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-500/20' 
                  : 'bg-white border-slate-200 hover:border-purple-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">Anomalie Timing</span>
                <span className="p-1 rounded-lg bg-purple-100 text-purple-700">
                  <Activity className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-purple-700">
                  {data?.anomaliesCount || 0}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Ritardi & Spikes nei cicli</span>
              </div>
            </div>
          </div>

          {/* 2. Visualizzazione Grafica & Temporale Anomalie Cicli di Esecuzione */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <span>Sequenza Temporale Cicli di Trading & Analisi Anomalie Timing</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Evidenziazione ottica di ritardi nell'intervallo operativo schedulato (15m standard) o picchi anomali di durata del ciclo.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Normale
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Ritardo &gt;1.5x
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Blocco / Ritardo Critico
                </span>
              </div>
            </div>

            {/* Cicli Timeline Cards */}
            {data?.executionCycles && data.executionCycles.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {data.executionCycles.slice(0, 6).map((cycle) => {
                    const isSpike = cycle.anomalyType === 'EXECUTION_SPIKE';
                    const isDelay = cycle.anomalyType === 'DELAYED_INTERVAL';
                    const isRisk = cycle.anomalyType === 'TIMEOUT_RISK';
                    const isNormal = !isSpike && !isDelay && !isRisk;

                    const cardBg = isRisk 
                      ? 'bg-rose-50/80 border-rose-200 text-rose-950' 
                      : isDelay || isSpike 
                      ? 'bg-amber-50/70 border-amber-200 text-amber-950' 
                      : 'bg-slate-50/80 border-slate-200 text-slate-800';

                    const badgeColor = isRisk 
                      ? 'bg-rose-600 text-white' 
                      : isDelay 
                      ? 'bg-amber-600 text-white' 
                      : isSpike 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-emerald-600 text-white';

                    return (
                      <div 
                        key={cycle.id}
                        className={`p-3 rounded-lg border text-xs font-mono flex flex-col justify-between gap-2 ${cardBg}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}>
                              {cycle.mode.toUpperCase()}
                            </span>
                            <span className="font-bold text-[11px] text-slate-800 truncate">
                              {new Date(cycle.timestamp).toLocaleTimeString('it-IT')}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isNormal ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {cycle.anomalyType || 'NORMAL'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/50">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase">Durata Ciclo:</span>
                            <span className={`font-bold ${cycle.durationMs > 5000 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {(cycle.durationMs / 1000).toFixed(2)}s
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase">Intervallo trascorso:</span>
                            <span className={`font-bold ${
                              cycle.timeSinceLastCycleMs > cycle.expectedIntervalMs * 1.5 ? 'text-amber-600' : 'text-slate-700'
                            }`}>
                              {cycle.timeSinceLastCycleMs > 0 ? `${(cycle.timeSinceLastCycleMs / (60 * 1000)).toFixed(1)}m` : 'Inizio'}
                            </span>
                          </div>
                        </div>

                        {cycle.anomalyDescription && (
                          <div className="text-[10px] text-rose-700 bg-rose-100/70 p-1.5 rounded border border-rose-200/60 leading-tight">
                            ⚠️ {cycle.anomalyDescription}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500 font-mono">
                Nessuna anomalia o ciclo registrato negli ultimi minuti. Il motore esecutivo sta operando regolarmente.
              </div>
            )}
          </div>

          {/* 3. Sezione Filtraggio e Lista Log Critici Parsati */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              {/* Filtri Categoria Tabs */}
              <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    activeFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tutti i Log Critici ({data?.logs?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('CRITICAL')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'CRITICAL'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <Flame className="w-3 h-3" />
                  <span>Errori Runtime ({data?.criticalErrorsCount || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('AUTH')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'AUTH'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>401 Auth ({data?.authErrorsCount || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('TIMEOUT')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'TIMEOUT'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Timeout API ({data?.timeoutErrorsCount || 0})</span>
                </button>
              </div>

              {/* Ricerca Testuale & Auto-refresh */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cerca 'ordersToSubmit', '401', 'timeout'..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 w-48 sm:w-64"
                  />
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer font-mono select-none">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Auto-Refresh</span>
                </label>
              </div>
            </div>

            {/* Tabella / Lista Log Critici */}
            <div className="bg-slate-950 text-slate-100 rounded-xl p-3 sm:p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-2 border border-slate-800 shadow-inner">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const isCritical = log.category === 'CRITICAL_ERROR';
                  const isAuth = log.category === 'AUTH_401';
                  const isTimeout = log.category === 'TIMEOUT';

                  const badgeClass = isCritical 
                    ? 'bg-rose-950 text-rose-400 border border-rose-800 font-bold' 
                    : isAuth 
                    ? 'bg-amber-950 text-amber-400 border border-amber-800 font-bold' 
                    : isTimeout 
                    ? 'bg-indigo-950 text-indigo-400 border border-indigo-800 font-bold' 
                    : 'bg-slate-800 text-slate-300 border border-slate-700';

                  return (
                    <div 
                      key={log.id} 
                      className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${badgeClass}`}>
                            {log.category.replace('_', ' ')}
                          </span>
                          <span className="text-slate-400">
                            [{new Date(log.timestamp).toLocaleString('it-IT')}]
                          </span>
                          <span className="text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                            {log.source}
                          </span>
                          {log.mode && (
                            <span className="text-[10px] text-slate-400">
                              Modo: <strong className="text-slate-200">{log.mode}</strong>
                            </span>
                          )}
                        </div>
                        {log.errorType && (
                          <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-950/80 px-2 py-0.5 rounded border border-rose-900/60">
                            {log.errorType}
                          </span>
                        )}
                      </div>

                      <div className="text-slate-200 text-xs break-words whitespace-pre-wrap leading-relaxed">
                        {log.message}
                      </div>

                      {log.trace && (
                        <div className="text-[10px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800/80 max-h-24 overflow-y-auto whitespace-pre font-mono">
                          {log.trace}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-slate-500 font-mono text-xs space-y-2">
                  <div className="inline-flex p-3 rounded-full bg-slate-900 border border-slate-800 text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>Nessun errore critico o anomalia rilevata nei log analizzati.</div>
                  <div className="text-[10px] text-slate-600">I log operativi del server sono sani e conformi ai parametri di risk management.</div>
                </div>
              )}
            </div>

            {/* Footer Stats Cache */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <span>
                  Log in Cache Server: <strong className="text-slate-700">{data?.cacheStats?.inMemoryLogsCount || 0}</strong>
                </span>
                <span>•</span>
                <span>
                  Buffer di scrittura: <strong className="text-slate-700">{data?.cacheStats?.logBufferSize || 0}</strong>
                </span>
              </div>
              <div>
                Ultimo controllo: {lastFetchTime ? lastFetchTime.toLocaleTimeString('it-IT') : 'In corso...'}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
export default AdvancedDiagnosticLogs;
