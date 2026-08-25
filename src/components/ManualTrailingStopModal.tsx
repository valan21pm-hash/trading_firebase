import React, { useState, useEffect } from 'react';
import { Sliders, X, Shield, ArrowUpRight, RefreshCw, AlertTriangle, Check, DollarSign, Percent, Lock } from 'lucide-react';

interface ManualTrailingStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: any;
  mode?: 'paper' | 'live';
  tradingMode?: 'paper' | 'live';
  onSuccess?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
}

export const ManualTrailingStopModal: React.FC<ManualTrailingStopModalProps> = ({
  isOpen,
  onClose,
  position,
  mode,
  tradingMode = 'paper',
  onSuccess,
  showToast
}) => {
  const activeTradingMode = mode || tradingMode;
  const [overrideType, setOverrideType] = useState<'price' | 'distancePct'>('price');
  const [priceInput, setPriceInput] = useState<string>('');
  const [distancePctInput, setDistancePctInput] = useState<string>('0.20');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const symbol = position?.symbol || '';
  const currentPrice = parseFloat(position?.current_price || '0');
  const avgEntry = parseFloat(position?.avg_entry_price || '0');
  const highestPrice = parseFloat(position?.highestPrice || position?.current_price || '0');
  const qty = parseFloat(position?.qty || '1') || 1;
  const currentStop = parseFloat(position?.atrTrailingStopPrice || '0');
  const hasExistingOverride = Boolean(position?.isManualTrailingSet || position?.manualTrailingStopPrice || position?.manualTrailingDistancePct);

  useEffect(() => {
    if (!isOpen || !position) return;
    setErrorMsg(null);

    if (position.manualTrailingStopPrice) {
      setOverrideType('price');
      setPriceInput(String(position.manualTrailingStopPrice));
      setDistancePctInput('0.20');
    } else if (position.manualTrailingDistancePct) {
      setOverrideType('distancePct');
      setDistancePctInput(String(position.manualTrailingDistancePct));
      setPriceInput(currentStop > 0 ? String(currentStop) : String((currentPrice * 0.998).toFixed(2)));
    } else {
      // Default initial value
      setOverrideType('price');
      if (currentStop > 0) {
        setPriceInput(String(currentStop));
      } else if (avgEntry > 0) {
        setPriceInput(String(avgEntry.toFixed(2)));
      } else {
        setPriceInput(String((currentPrice * 0.995).toFixed(2)));
      }
      setDistancePctInput('0.20');
    }
  }, [isOpen, position]);

  if (!isOpen || !position) return null;

  // Real-time calculations
  const parsedPrice = parseFloat(priceInput);
  const parsedDistance = parseFloat(distancePctInput);

  let simulatedStopPrice = 0;
  if (overrideType === 'price') {
    simulatedStopPrice = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0;
  } else {
    simulatedStopPrice = !isNaN(parsedDistance) && parsedDistance > 0 && highestPrice > 0 
      ? highestPrice * (1 - parsedDistance / 100) 
      : 0;
  }

  const simulatedDistanceDollars = currentPrice > 0 && simulatedStopPrice > 0 
    ? Math.max(0, currentPrice - simulatedStopPrice) 
    : 0;
  const simulatedDistancePct = currentPrice > 0 && simulatedStopPrice > 0 
    ? ((currentPrice - simulatedStopPrice) / currentPrice) * 100 
    : 0;
  const simulatedLockedProfitDollars = simulatedStopPrice > 0 && avgEntry > 0 
    ? (simulatedStopPrice - avgEntry) * qty 
    : 0;
  const simulatedLockedProfitPct = simulatedStopPrice > 0 && avgEntry > 0 
    ? ((simulatedStopPrice - avgEntry) / avgEntry) * 100 
    : 0;

  const handleSaveOverride = async () => {
    setErrorMsg(null);

    let manualTrailingStopPrice: number | undefined = undefined;
    let manualTrailingDistancePct: number | undefined = undefined;

    if (overrideType === 'price') {
      const val = parseFloat(priceInput);
      if (isNaN(val) || val <= 0) {
        setErrorMsg('Inserisci un prezzo di stop valido maggiore di 0.');
        return;
      }
      if (val > currentPrice) {
        setErrorMsg(`Il prezzo di stop ($${val.toFixed(2)}) non può essere superiore al prezzo attuale ($${currentPrice.toFixed(2)}).`);
        return;
      }
      manualTrailingStopPrice = parseFloat(val.toFixed(2));
    } else {
      const val = parseFloat(distancePctInput);
      if (isNaN(val) || val <= 0 || val >= 100) {
        setErrorMsg('Inserisci una distanza percentuale valida (es. 0.10, 0.20, 0.30).');
        return;
      }
      manualTrailingDistancePct = parseFloat(val.toFixed(2));
    }

    setLoading(true);
    try {
      const res = await fetch('/api/trading/position-stops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          mode: activeTradingMode,
          manualTrailingStopPrice,
          manualTrailingDistancePct,
          clearManualTrailing: false
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (showToast) {
          showToast(
            `Trailing stop manuale per ${symbol} configurato con successo!`,
            'success',
            'Override Salvato'
          );
        }
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || data.message || 'Errore nel salvataggio del trailing stop.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  const handleResetToAuto = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/trading/position-stops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          mode: activeTradingMode,
          clearManualTrailing: true
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (showToast) {
          showToast(
            `Override manuale per ${symbol} rimosso. Ripristinato algoritmo dinamico automatico.`,
            'info',
            'Algoritmo Ripristinato'
          );
        }
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || data.message || 'Errore nel ripristino dell\'algoritmo.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-[#0b101d] border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0e1628] border-b border-slate-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Modifica Trailing Stop Manuale
                <span className="px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-mono text-xs border border-indigo-700/50">
                  {symbol}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Imposta un prezzo fisso o una distanza percentuale per questa specifica posizione
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Position Info Bar */}
          <div className="grid grid-cols-3 gap-2 bg-[#080c16] p-3 rounded-xl border border-slate-800/80 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-sans">Prezzo Carico</span>
              <span className="text-slate-300 font-semibold">${avgEntry.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-sans">Prezzo Attuale</span>
              <span className="text-white font-bold">${currentPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-sans">Picco Massimo</span>
              <span className="text-amber-400 font-bold">${highestPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Current Status Badge */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">Regola Attiva:</span>
              <span className="text-slate-200 font-semibold font-mono">
                {position.currentTierLabel || 'Algoritmo Automatico a Scaglioni'}
              </span>
            </div>
            {hasExistingOverride && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Override Manuale
              </span>
            )}
          </div>

          {/* Tab Selector: Prezzo Fisso vs Distanza % */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block">
              Modalità di Override
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#080c16] rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setOverrideType('price')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  overrideType === 'price'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                Prezzo di Stop Fisso ($)
              </button>
              <button
                type="button"
                onClick={() => setOverrideType('distancePct')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  overrideType === 'distancePct'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                Distanza % dal Picco
              </button>
            </div>
          </div>

          {/* Inputs based on type */}
          {overrideType === 'price' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Prezzo Stop Loss / Trailing ($):
                </label>
                <span className="text-[10px] text-slate-400">Max consentito: ${currentPrice.toFixed(2)}</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono">
                  $
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={currentPrice}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="Es. 182.50"
                  className="w-full bg-[#080c16] border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Quick Preset Buttons for Price */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPriceInput(avgEntry.toFixed(2))}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700 transition"
                  title="Pareggio esatto al prezzo medio di acquisto"
                >
                  Pareggio (BE: ${avgEntry.toFixed(2)})
                </button>
                {highestPrice > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPriceInput((highestPrice * 0.997).toFixed(2))}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700 transition"
                      title="Distanza 0.30% dal picco"
                    >
                      -0.30% Picco (${(highestPrice * 0.997).toFixed(2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceInput((highestPrice * 0.998).toFixed(2))}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700 transition"
                      title="Distanza 0.20% dal picco"
                    >
                      -0.20% Picco (${(highestPrice * 0.998).toFixed(2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceInput((highestPrice * 0.999).toFixed(2))}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700 transition"
                      title="Distanza 0.10% dal picco"
                    >
                      -0.10% Picco (${(highestPrice * 0.999).toFixed(2)})
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Distanza Trailing dal Massimo Raggiunto (%):
                </label>
                <span className="text-[10px] text-slate-400">Picco attuale: ${highestPrice.toFixed(2)}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="10.0"
                  value={distancePctInput}
                  onChange={(e) => setDistancePctInput(e.target.value)}
                  placeholder="Es. 0.20"
                  className="w-full bg-[#080c16] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500 font-mono">
                  %
                </div>
              </div>

              {/* Quick Preset Buttons for Distance % */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDistancePctInput('0.30')}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition ${
                    distancePctInput === '0.30' 
                      ? 'bg-indigo-950 text-indigo-300 border-indigo-600' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  0.30% (Scaglione 1: +0.50%-+0.80%)
                </button>
                <button
                  type="button"
                  onClick={() => setDistancePctInput('0.20')}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition ${
                    distancePctInput === '0.20' 
                      ? 'bg-indigo-950 text-indigo-300 border-indigo-600' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  0.20% (Scaglione 2: +0.80%-+1.00%)
                </button>
                <button
                  type="button"
                  onClick={() => setDistancePctInput('0.10')}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition ${
                    distancePctInput === '0.10' 
                      ? 'bg-indigo-950 text-indigo-300 border-indigo-600' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  0.10% (Scaglione 3: ≥+1.00%)
                </button>
              </div>
            </div>
          )}

          {/* Simulation Preview Card */}
          <div className="bg-[#070b14] p-3.5 rounded-xl border border-indigo-900/40 space-y-2 text-xs">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1">
              <Lock className="w-3 h-3" /> Simulazione Esecutiva & Protezione
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-[#0d1424] p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9px] font-sans">Stop Esecutivo Risultante</span>
                <span className="text-white font-bold">${simulatedStopPrice.toFixed(2)}</span>
              </div>
              <div className="bg-[#0d1424] p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9px] font-sans">Distanza dal Prezzo Attuale</span>
                <span className="text-slate-300 font-bold">${simulatedDistanceDollars.toFixed(2)} ({simulatedDistancePct.toFixed(2)}%)</span>
              </div>
              <div className="col-span-2 bg-[#0d1424] p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[9px] font-sans">Guadagno/Perdita Protetti allo Stop</span>
                  <span className={`font-bold ${simulatedLockedProfitDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {simulatedLockedProfitDollars >= 0 ? '+' : ''}${simulatedLockedProfitDollars.toFixed(2)} ({simulatedLockedProfitPct >= 0 ? '+' : ''}{simulatedLockedProfitPct.toFixed(2)}%)
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                  simulatedLockedProfitDollars >= 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                }`}>
                  {simulatedLockedProfitDollars >= 0 ? 'UTILE PROTETTO' : 'STOP LOSS'}
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0e1628] border-t border-slate-800 flex items-center justify-between gap-2">
          {hasExistingOverride ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleResetToAuto}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
              title="Rimuovi override e ripristina la gestione automatica con scaglioni dinamici 0.30% / 0.20% / 0.10%"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Ripristina Automatico
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSaveOverride}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Salva Trailing Stop
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
