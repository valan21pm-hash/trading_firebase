import React, { useState, useEffect } from 'react';
import { Clock, Play, RotateCcw, Zap, CheckCircle2, PauseCircle, AlertCircle } from 'lucide-react';

interface VisualCycleTimerProps {
  lastRunTime?: number;
  nextRunTime?: number;
  timeframeMinutes?: number;
  isActive: boolean;
  isOperatingHours?: boolean;
  onForceRun?: () => Promise<void> | void;
  className?: string;
  compact?: boolean;
}

export const VisualCycleTimer: React.FC<VisualCycleTimerProps> = ({
  lastRunTime,
  nextRunTime,
  timeframeMinutes = 15,
  isActive,
  isOperatingHours = true,
  onForceRun,
  className = '',
  compact = false
}) => {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const [isRunningForce, setIsRunningForce] = useState<boolean>(false);
  const totalDurationMs = Math.max(1, (timeframeMinutes || 15) * 60 * 1000);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      let targetTime = nextRunTime || 0;

      if (!targetTime && lastRunTime && lastRunTime > 0) {
        targetTime = lastRunTime + totalDurationMs;
      }

      if (!targetTime || targetTime <= 0) {
        // Fallback default: calcola rispetto al timeframe
        setTimeLeftMs(0);
        return;
      }

      const diff = Math.max(0, targetTime - now);
      setTimeLeftMs(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lastRunTime, nextRunTime, totalDurationMs]);

  const minutes = Math.floor(timeLeftMs / 60000);
  const seconds = Math.floor((timeLeftMs % 60000) / 1000);
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPct = Math.min(
    100,
    Math.max(0, ((totalDurationMs - timeLeftMs) / totalDurationMs) * 100)
  );

  const handleManualRun = async () => {
    if (isRunningForce || !onForceRun) return;
    setIsRunningForce(true);
    try {
      await onForceRun();
    } catch (e) {
      console.error('Manual force run error:', e);
    } finally {
      setTimeout(() => setIsRunningForce(false), 2000);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
        !isActive 
          ? 'bg-slate-100 border-slate-200 text-slate-500'
          : !isOperatingHours
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : timeLeftMs <= 60000
          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 animate-pulse'
          : 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
      } ${className}`}>
        <Clock className={`w-3.5 h-3.5 ${isActive && isOperatingHours ? 'text-indigo-600 animate-spin-slow' : 'text-slate-400'}`} />
        <div className="flex items-center gap-1 text-xs font-mono font-bold">
          <span className="text-[10px] uppercase font-sans tracking-wide text-slate-500">Prossimo Ciclo:</span>
          <span>{!isActive ? 'PAUSA' : !isOperatingHours ? 'OFF-HOURS' : formattedTime}</span>
        </div>
        {onForceRun && (
          <button
            onClick={handleManualRun}
            disabled={isRunningForce}
            title="Esegui subito il ciclo di scansione"
            className="ml-1 p-1 hover:bg-white/80 active:scale-95 rounded transition cursor-pointer text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            <Zap className={`w-3 h-3 ${isRunningForce ? 'animate-bounce text-amber-500' : ''}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between gap-3 ${className}`}>
      {/* Header & Stato */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${
            !isActive 
              ? 'bg-slate-100 text-slate-500' 
              : !isOperatingHours
              ? 'bg-amber-100 text-amber-700'
              : 'bg-indigo-100 text-indigo-700'
          }`}>
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Timer Scansione Mercato
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                {timeframeMinutes}m
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {!isActive 
                ? 'Bot inattivo: riprendi per avviare il ciclo' 
                : !isOperatingHours 
                ? 'Fuori orario USA (09:15 - 16:15 EST)'
                : 'Scansione automatica & esecuzione ordini'}
            </p>
          </div>
        </div>

        {/* Badge Timer Grande */}
        <div className="text-right">
          <div className="font-mono text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1 justify-end">
            {!isActive ? (
              <span className="text-sm font-sans font-bold text-slate-400 flex items-center gap-1">
                <PauseCircle className="w-4 h-4 text-slate-400" /> In Pausa
              </span>
            ) : !isOperatingHours ? (
              <span className="text-xs font-sans font-bold text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Chiuso
              </span>
            ) : (
              <span className="text-indigo-600">{formattedTime}</span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 block font-medium">
            {isActive && isOperatingHours ? 'Tempo al prossimo check' : 'In attesa'}
          </span>
        </div>
      </div>

      {/* Barra di Progresso Temporale */}
      {isActive && isOperatingHours && (
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden relative">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Azioni Rapide */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Verifica continua real-time (5s) attiva per uscite e stop</span>
        </div>

        {onForceRun && (
          <button
            type="button"
            onClick={handleManualRun}
            disabled={isRunningForce}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg border border-indigo-200 active:scale-95 transition cursor-pointer disabled:opacity-50"
          >
            <Zap className={`w-3 h-3 ${isRunningForce ? 'animate-spin text-amber-600' : 'text-indigo-600'}`} />
            <span>{isRunningForce ? 'Scansione in corso...' : 'Scansiona Ora'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
export default VisualCycleTimer;
