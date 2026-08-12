import React, { useState, useEffect } from 'react';
import { ShoppingCart, X, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface ForceBuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSymbol?: string;
  initialMode?: 'paper' | 'live';
  onSuccess?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
}

export const ForceBuyModal: React.FC<ForceBuyModalProps> = ({
  isOpen,
  onClose,
  initialSymbol = '',
  initialMode = 'paper',
  onSuccess,
  showToast
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [buyType, setBuyType] = useState<'qty' | 'notional'>('qty');
  const [qtyValue, setQtyValue] = useState<string>('1');
  const [notionalValue, setNotionalValue] = useState<string>('50');
  const [mode, setMode] = useState<'paper' | 'live'>(initialMode);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol.toUpperCase());
    if (initialMode) setMode(initialMode);
  }, [initialSymbol, initialMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetSymbol = symbol.trim().toUpperCase();
    if (!targetSymbol) {
      setErrorMsg('Inserisci un simbolo valido (es. AAPL, NVDA, SPY).');
      return;
    }

    if (buyType === 'qty') {
      const numQty = parseFloat(qtyValue);
      if (isNaN(numQty) || numQty <= 0) {
        setErrorMsg('Inserisci una quantità di quote valida (es. 1, 2, 5).');
        return;
      }
    } else {
      const numNotional = parseFloat(notionalValue);
      if (isNaN(numNotional) || numNotional <= 0) {
        setErrorMsg('Inserisci un ammontare in $ valido (es. 25, 50, 100).');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch('/api/force-buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: targetSymbol,
          qty: buyType === 'qty' ? qtyValue : undefined,
          notional: buyType === 'notional' ? notionalValue : undefined,
          mode
        })
      });

      const data = await res.json();

      if (data.success) {
        if (showToast) {
          showToast(
            `Acquisto forzato di ${targetSymbol} inviato con successo!`,
            'success',
            'Ordine Inviato'
          );
        }
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(data.message || 'Errore durante l\'esecuzione dell\'ordine.');
        if (showToast) {
          showToast(data.message || 'Errore ordine', 'error', 'Acquisto Fallito');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Errore di rete durante la richiesta.';
      setErrorMsg(msg);
      if (showToast) showToast(msg, 'error', 'Errore Rete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Forza Acquisto Manuale</h3>
              <p className="text-[11px] text-slate-400">Invia un ordine di acquisto istantaneo a mercato su Alpaca</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Simbolo */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Simbolo Strumento / Ticker
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="es. AAPL, NVDA, SPY, TSLA"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 uppercase"
              required
            />
          </div>

          {/* Tipo Acquisto: Quote / Notional */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Modalità di Quantità
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setBuyType('qty')}
                className={`py-2 text-xs font-bold rounded-lg transition ${
                  buyType === 'qty'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Numero di Quote (Azioni)
              </button>
              <button
                type="button"
                onClick={() => setBuyType('notional')}
                className={`py-2 text-xs font-bold rounded-lg transition ${
                  buyType === 'notional'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ammontare in Capitale ($)
              </button>
            </div>
          </div>

          {/* Input valore in base a buyType */}
          {buyType === 'qty' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Numero di Quote / Azioni da Acquistare
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={qtyValue}
                  onChange={(e) => setQtyValue(e.target.value)}
                  placeholder="es. 1, 2, 5, 10"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500/50"
                  required
                />
                <div className="flex gap-1.5">
                  {['1', '2', '5', '10'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQtyValue(preset)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-bold border transition ${
                        qtyValue === preset
                          ? 'bg-slate-800 border-indigo-500 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Ammontare Totale ($ Notional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={notionalValue}
                  onChange={(e) => setNotionalValue(e.target.value)}
                  placeholder="es. 50, 100, 250"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                  required
                />
                <div className="flex gap-1.5">
                  {['25', '50', '100', '250'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNotionalValue(preset)}
                      className={`px-2 py-2 rounded-lg text-xs font-bold border transition ${
                        notionalValue === preset
                          ? 'bg-slate-800 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Modalità Conto Alpaca */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Conto di Destinazione Alpaca
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('paper')}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                  mode === 'paper'
                    ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    Simulazione (Paper)
                  </div>
                  <div className="text-[10px] text-slate-500">Capitale Virtuale</div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${mode === 'paper' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`} />
              </button>

              <button
                type="button"
                onClick={() => setMode('live')}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                  mode === 'live'
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Reale (Live)
                  </div>
                  <div className="text-[10px] text-slate-500">Denaro Reale</div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ${mode === 'live' ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'}`} />
              </button>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Invio Ordine...</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  <span>Conferma Acquisto</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
