import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Flame, 
  ShoppingCart, 
  RefreshCw, 
  X, 
  Shield, 
  AlertTriangle, 
  Clock, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Power, 
  Layers, 
  CheckCircle2, 
  DollarSign,
  AlertOctagon,
  Maximize2
} from 'lucide-react';
import type { BotStatus, AccountData } from '../types';
import { ForceBuyModal } from './ForceBuyModal';

interface SmartViewProps {
  onClose: () => void;
  botStatus: BotStatus | null;
  initialMode?: 'paper' | 'live';
  onStatusUpdate?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
}

export const SmartView: React.FC<SmartViewProps> = ({
  onClose,
  botStatus,
  initialMode = 'paper',
  onStatusUpdate,
  showToast
}) => {
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>(initialMode);
  const [closingSymbols, setClosingSymbols] = useState<string[]>([]);
  const [confirmCloseSymbol, setConfirmCloseSymbol] = useState<string | null>(null);
  const [forceBuyOpen, setForceBuyOpen] = useState(false);
  const [forceBuyPrefill, setForceBuyPrefill] = useState('');
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicLoading, setPanicLoading] = useState(false);
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);

  // Dati di conto in base alla modalità selezionata
  const account: AccountData = botStatus?.[tradingMode] || {
    balance: 0,
    cash: 0,
    modeLabel: tradingMode === 'live' ? 'Live Real' : 'Paper Sim',
    isConfigured: false,
    positions: [],
    dailyPnL: [],
    logs: []
  };

  const isBotActive = tradingMode === 'live' ? botStatus?.liveActive : botStatus?.paperActive;
  const openPositions = account.positions || [];

  // Calcolo P&L totale aperto in $ e in %
  const totalOpenPnL = openPositions.reduce((acc, pos) => acc + (parseFloat(pos.unrealized_pl || '0')), 0);
  const totalMarketVal = openPositions.reduce((acc, pos) => acc + (parseFloat(pos.market_value || '0')), 0);
  const totalOpenPnLPct = totalMarketVal > 0 ? (totalOpenPnL / (totalMarketVal - totalOpenPnL)) * 100 : 0;

  // Intervallo di aggiornamento rapido (ogni 4 secondi per massima prontezza operativa)
  useEffect(() => {
    const interval = setInterval(() => {
      if (onStatusUpdate) onStatusUpdate();
    }, 4000);
    return () => clearInterval(interval);
  }, [onStatusUpdate]);

  const handleManualRefresh = async () => {
    setLocalRefreshing(true);
    if (onStatusUpdate) await onStatusUpdate();
    setTimeout(() => setLocalRefreshing(false), 500);
  };

  const handleToggleBot = async () => {
    setTogglingBot(true);
    try {
      const res = await fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: tradingMode })
      });
      if (res.ok) {
        if (showToast) {
          showToast(
            `Motore ${tradingMode.toUpperCase()} ${isBotActive ? 'MESSO IN PAUSA' : 'ATTIVATO'} con successo!`,
            'info',
            'Stato Bot'
          );
        }
        if (onStatusUpdate) onStatusUpdate();
      }
    } catch (err: any) {
      if (showToast) showToast(`Errore: ${err.message}`, 'error', 'Controllo Motore');
    } finally {
      setTogglingBot(false);
    }
  };

  const handleToggleProtection = async (symbol: string, type: 'technical' | 'catastrophic', currentVal: boolean | undefined) => {
    const newVal = currentVal === undefined ? false : !currentVal;
    try {
      const payload: any = {
        symbol,
        mode: tradingMode
      };
      if (type === 'technical') {
        payload.enableTechnicalStop = newVal;
      } else {
        payload.enableCatastrophicStop = newVal;
      }
      const res = await fetch('/api/trading/position-stops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        if (showToast) {
          showToast(
            `${type === 'technical' ? 'Stop ATR Dinamico' : 'Stop Catastrofico (-3%)'} per ${symbol} ${newVal ? 'ATTIVATO' : 'DISATTIVATO'}!`,
            'success',
            'Gestione Rischio'
          );
        }
        if (onStatusUpdate) onStatusUpdate();
      }
    } catch (e: any) {
      if (showToast) showToast(`Errore di rete: ${e.message}`, 'error', 'Protezione Stop');
    }
  };

  const handleClosePosition = async (symbol: string) => {
    setClosingSymbols(prev => [...prev, symbol]);
    setConfirmCloseSymbol(null);
    try {
      const res = await fetch('/api/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: tradingMode, symbol })
      });
      if (res.ok) {
        if (showToast) {
          showToast(`Chiusura a mercato per ${symbol} inviata a Alpaca con successo!`, 'success', 'Posizione Chiusa');
        }
        if (onStatusUpdate) onStatusUpdate();
      } else {
        const err = await res.json().catch(() => ({ message: 'Errore durante la chiusura' }));
        if (showToast) showToast(`Errore: ${err.message}`, 'error', 'Chiusura Posizione');
      }
    } catch (err: any) {
      if (showToast) showToast(`Errore di rete: ${err.message}`, 'error', 'Chiusura Posizione');
    } finally {
      setClosingSymbols(prev => prev.filter(s => s !== symbol));
    }
  };

  const handlePanicLiquidate = async () => {
    setPanicLoading(true);
    try {
      const res = await fetch('/api/panic-liquidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => ({ success: false, message: 'Errore dal server.' }));
      if (res.ok && data.success) {
        if (showToast) showToast(data.message || 'Liquidazione totale completata!', 'warning', 'PANIC LIQUIDATION');
        setShowPanicModal(false);
        if (onStatusUpdate) onStatusUpdate();
      } else {
        if (showToast) showToast(data.message || 'Errore durante la liquidazione di emergenza.', 'error', 'PANIC BUTTON');
      }
    } catch (e: any) {
      if (showToast) showToast(`Errore di connessione: ${e.message}`, 'error', 'PANIC BUTTON');
    } finally {
      setPanicLoading(false);
    }
  };

  // Calcolo VIX dalle statistiche o fallback
  const vixRule = botStatus?.systemRiskRules?.find(r => r.type === 'MACRO_VOLATILITY_VIX_FILTER');
  const maxVixThreshold = vixRule?.parameters?.maxVixThreshold ?? 30.0;
  const isVixActive = vixRule?.enabled ?? true;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col text-slate-100 font-sans overflow-hidden animate-fade-in select-none">
      
      {/* 1. TOP BAR COMPATTA & SPIE PRINCIPALI DEL CRUSCOTTO */}
      <header className="bg-slate-900 border-b border-slate-800/90 px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
        
        {/* Identità Smart View & Selettore Conto */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">SMART VIEW</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Massima Densità
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">Solo posizioni aperte & comandi diretti</p>
            </div>
          </div>

          {/* Toggle Paper / Live */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 ml-1 sm:ml-3">
            <button
              onClick={() => setTradingMode('paper')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                tradingMode === 'paper' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Paper
            </button>
            <button
              onClick={() => setTradingMode('live')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                tradingMode === 'live' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Live
            </button>
          </div>
        </div>

        {/* SPIE ESSENZIALI DEL CRUSCOTTO (Gauges) */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1 text-xs">
          
          {/* Spia 1: Motore Algoritmico */}
          <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Motore:</span>
            <button
              onClick={handleToggleBot}
              disabled={togglingBot}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                isBotActive 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' 
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
              }`}
              title="Clicca per mettere in pausa o avviare il motore"
            >
              <Power className={`w-3 h-3 ${isBotActive ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
              <span>{isBotActive ? 'ATTIVO' : 'IN PAUSA'}</span>
            </button>
          </div>

          {/* Spia 2: Filtro Rischio VIX */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">VIX:</span>
            <span className={`font-mono font-bold text-xs flex items-center gap-1 ${
              isVixActive ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              <Shield className="w-3 h-3 text-emerald-400" />
              &lt; {maxVixThreshold.toFixed(0)}%
            </span>
          </div>

          {/* Spia 3: Saldo & Liquidità */}
          <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-mono block leading-none">Capitale</span>
              <span className="font-mono font-extrabold text-white text-xs sm:text-sm">
                ${(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800 mx-1" />
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-mono block leading-none">Cassa</span>
              <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                ${(account.cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Spia 4: P&L Aperto Totale */}
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${
            totalOpenPnL >= 0 
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}>
            <div>
              <span className="text-[9px] uppercase font-mono block leading-none opacity-80">P&L Aperto</span>
              <div className="flex items-center gap-1 font-mono font-extrabold text-xs sm:text-sm">
                {totalOpenPnL >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{totalOpenPnL >= 0 ? '+' : ''}${totalOpenPnL.toFixed(2)}</span>
                <span className="text-[10px] opacity-80">({totalOpenPnLPct >= 0 ? '+' : ''}{totalOpenPnLPct.toFixed(2)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* COMANDI RAPIDI OPERATIVI */}
        <div className="flex items-center gap-2">
          
          {/* Forza Acquisto Rapido */}
          <button
            onClick={() => { setForceBuyPrefill(''); setForceBuyOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Apri una nuova posizione manuale a mercato"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Forza Acquisto</span>
          </button>

          {/* Panic Button */}
          <button
            onClick={() => setShowPanicModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="Liquidazione totale immediata di emergenza"
          >
            <Flame className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Panic</span>
          </button>

          {/* Refresh Manuale */}
          <button
            onClick={handleManualRefresh}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
            title="Aggiorna dati istantaneamente"
          >
            <RefreshCw className={`w-4 h-4 ${localRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* Esci / Chiudi Smart View */}
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
            title="Torna al cruscotto completo"
          >
            <X className="w-4 h-4" />
            <span className="hidden md:inline">Chiudi</span>
          </button>
        </div>
      </header>

      {/* 2. AREA PRINCIPALE: ESCLUSIVAMENTE POSIZIONI APERTE */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950 space-y-4">
        
        {/* Intestazione Sezione Posizioni */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h2 className="font-bold text-sm sm:text-base text-white tracking-wide">
              POSIZIONI APERTE ATTIVE ({openPositions.length})
            </h2>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Modalità: <strong className={tradingMode === 'live' ? 'text-emerald-400' : 'text-indigo-400'}>{tradingMode.toUpperCase()}</strong>
          </div>
        </div>

        {/* GESTIONE STATO VUOTO */}
        {openPositions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 p-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3">
              <CheckCircle2 className="w-7 h-7 text-indigo-400/80" />
            </div>
            <h3 className="text-base font-bold text-slate-200">Nessuna posizione aperta in {tradingMode.toUpperCase()}</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
              Il bot è in ascolto del mercato per rilevare segnali ad alta probabilità. Puoi avviare un trade immediato con il comando qui sotto.
            </p>
            <button
              onClick={() => { setForceBuyPrefill(''); setForceBuyOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              Forza Apertura Posizione
            </button>
          </div>
        ) : (
          /* GRIGLIA AD ALTA DENSITÀ DELLE POSIZIONI */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {openPositions.map((pos: any, idx: number) => {
              const qty = parseFloat(pos.qty || '0');
              const avgPrice = parseFloat(pos.avg_entry_price || '0');
              const currPrice = parseFloat(pos.current_price || '0');
              const marketVal = parseFloat(pos.market_value || '0');
              const plVal = parseFloat(pos.unrealized_pl || '0');
              const plPct = parseFloat(pos.unrealized_plpc || '0') * 100;
              const isProfit = plVal >= 0;
              const isClosing = closingSymbols.includes(pos.symbol);

              // Calcolo Stop ATR & Stop Catastrofico
              const currentAtr = pos.atr_14 ? parseFloat(pos.atr_14) : 1.25;
              const atrTrailingPrice = pos.atrTrailingStopPrice || (currPrice - (1.5 * currentAtr));
              const catastrophicStopPrice = avgPrice * 0.97;

              return (
                <div 
                  key={pos.symbol || idx}
                  className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-md flex flex-col justify-between gap-3 hover:border-slate-700 transition-all"
                >
                  {/* Header Card: Ticker + P&L */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg sm:text-xl text-white tracking-tight font-mono">
                          {pos.symbol}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold uppercase border border-emerald-500/30">
                          {pos.side ? pos.side.toUpperCase() : 'LONG'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {qty} quote • Valore: <strong className="text-slate-200">${marketVal.toFixed(2)}</strong>
                      </span>
                    </div>

                    {/* P&L Badge Compatto ad Alto Contrasto */}
                    <div className={`px-2.5 py-1 rounded-xl font-mono text-right border ${
                      isProfit 
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                        : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                    }`}>
                      <div className="font-extrabold text-sm sm:text-base leading-none">
                        {isProfit ? '+' : ''}${plVal.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-bold mt-0.5 opacity-90">
                        {isProfit ? '+' : ''}{plPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Prezzi & Metriche Operative */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/60">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">Ingresso Medio</span>
                      <span className="font-bold text-slate-300">${avgPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">Prezzo Attuale</span>
                      <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${currPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Target Stop ATR:</span>
                      <span className="font-bold text-indigo-300">${atrTrailingPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Spie di Protezione & Controlli Rapidi */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-1.5 text-[10px]">
                      
                      {/* Toggle Stop ATR */}
                      <button
                        onClick={() => handleToggleProtection(pos.symbol, 'technical', pos.enableTechnicalStop !== false)}
                        className={`flex-1 py-1 px-2 rounded-lg font-bold border transition flex items-center justify-center gap-1 cursor-pointer ${
                          pos.enableTechnicalStop !== false
                            ? 'bg-indigo-950/50 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50'
                            : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                        }`}
                        title="Attiva/Disattiva Stop Loss Dinamico basato su ATR"
                      >
                        <Shield className="w-3 h-3" />
                        <span>ATR {pos.enableTechnicalStop !== false ? 'ON' : 'OFF'}</span>
                      </button>

                      {/* Toggle Stop Catastrofico -3% */}
                      <button
                        onClick={() => handleToggleProtection(pos.symbol, 'catastrophic', pos.enableCatastrophicStop !== false)}
                        className={`flex-1 py-1 px-2 rounded-lg font-bold border transition flex items-center justify-center gap-1 cursor-pointer ${
                          pos.enableCatastrophicStop !== false
                            ? 'bg-rose-950/50 border-rose-500/40 text-rose-300 hover:bg-rose-900/50'
                            : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                        }`}
                        title="Attiva/Disattiva Circuit Breaker Catastrofico a -3%"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>-3% {pos.enableCatastrophicStop !== false ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>

                    {/* Bottone Esecutivo Chiusura Posizione */}
                    <button
                      onClick={() => setConfirmCloseSymbol(pos.symbol)}
                      disabled={isClosing}
                      className={`w-full py-2 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isClosing
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed animate-pulse'
                          : 'bg-red-600/90 hover:bg-red-600 active:scale-95 shadow-md shadow-red-950/50'
                      }`}
                    >
                      {isClosing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Chiusura in corso...</span>
                        </>
                      ) : (
                        <>
                          <X className="w-3.5 h-3.5" />
                          <span>Chiudi Posizione a Mercato</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL CONFERMA CHIUSURA SINGOLA POSIZIONE */}
      {confirmCloseSymbol && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-slate-100 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                <AlertOctagon className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide text-white">Conferma Chiusura</h3>
                <p className="text-xs text-slate-400">Liquidazione immediata a mercato</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800/80 font-mono">
              Sei sicuro di voler liquidare la posizione attiva su <strong className="text-white font-bold">{confirmCloseSymbol}</strong> sul conto <strong className="text-indigo-400">{tradingMode.toUpperCase()}</strong>?
            </p>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setConfirmCloseSymbol(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => handleClosePosition(confirmCloseSymbol)}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
              >
                Conferma Chiusura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PANIC BUTTON */}
      {showPanicModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-100 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-500">
              <div className="p-3 bg-red-500/15 rounded-full border border-red-500/30">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-base uppercase tracking-wider text-white">ATTIVAZIONE PANIC BUTTON</h3>
                <p className="text-xs text-red-400 font-mono">Liquidazione di emergenza globale</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>Questa operazione eseguirà immediatamente:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 font-mono text-[11px]">
                <li>Messa in <strong className="text-white">PAUSA</strong> sia del bot Paper che Live.</li>
                <li>Chiusura immediata a mercato di <strong className="text-rose-400">TUTTE le posizioni aperte</strong>.</li>
                <li>Cancellazione di tutti gli ordini pendenti su Alpaca.</li>
              </ul>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => setShowPanicModal(false)}
                disabled={panicLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={handlePanicLiquidate}
                disabled={panicLoading}
                className={`flex items-center gap-1.5 px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold transition cursor-pointer shadow-lg shadow-red-950 ${
                  panicLoading ? 'opacity-50 cursor-not-allowed animate-pulse' : ''
                }`}
              >
                {panicLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Liquidazione in corso...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5" />
                    <span>Conferma Liquidazione Globale</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORZA ACQUISTO */}
      {forceBuyOpen && (
        <ForceBuyModal
          isOpen={forceBuyOpen}
          onClose={() => setForceBuyOpen(false)}
          initialSymbol={forceBuyPrefill}
          initialMode={tradingMode}
          onSuccess={() => {
            if (onStatusUpdate) onStatusUpdate();
            if (showToast) showToast('Ordine di acquisto forzato inviato ad Alpaca!', 'success', 'Forza Acquisto');
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};
