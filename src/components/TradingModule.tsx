import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Activity, 
  DollarSign, 
  RefreshCcw, 
  TrendingDown, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ArrowRight, 
  BarChart2, 
  Sparkles,
  ChevronDown,
  Bot,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import ReactMarkdown from 'react-markdown';

interface CandleData {
  time: string;
  mid: {
    o: string;
    h: string;
    l: string;
    c: string;
  };
  volume: number;
}

interface OandaAccount {
  id: string;
  balance: string;
  currency: string;
  NAV: string;
  openPositionCount: number;
  pendingOrderCount: number;
  alias?: string;
}

export default function TradingModule() {
  const [selectedInstrument, setSelectedInstrument] = useState<string>('EUR_USD');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [analysis, setAnalysis] = useState<string>('');
  const [account, setAccount] = useState<OandaAccount | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [loadingAccount, setLoadingAccount] = useState<boolean>(false);
  const [isDemo, setIsDemo] = useState<boolean>(true);
  const [units, setUnits] = useState<number>(1000);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderResult, setOrderResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // OANDA Auto-Trading states
  const [oandaAutoStatus, setOandaAutoStatus] = useState<{
    active: boolean;
    lastCheck: string | null;
    monitoredInstruments: string[];
    logs: string[];
    logicLogs: { timestamp: string; instrument: string; action: string; reasoning: string; price?: number }[];
    balance: number;
    dailyPnL: { date: string; realized: number; unrealized: number }[];
    unrealizedPnL: number;
    equity?: number;
  } | null>(null);
  const [oandaPositions, setOandaPositions] = useState<any[]>([]);
  const [closingInstruments, setClosingInstruments] = useState<string[]>([]);
  const [confirmCloseInstrument, setConfirmCloseInstrument] = useState<string | null>(null);
  const [loadingAutoStatus, setLoadingAutoStatus] = useState<boolean>(false);
  const [submittingAutoToggle, setSubmittingAutoToggle] = useState<boolean>(false);
  const [triggeringCycle, setTriggeringCycle] = useState<boolean>(false);
  const [activeLogTab, setActiveLogTab] = useState<'system' | 'logic'>('system');

  const [wrapLogs, setWrapLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem('oanda_wrapLogs');
    return saved !== null ? saved === 'true' : true;
  });
  const [reverseLogs, setReverseLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem('oanda_reverseLogs');
    return saved !== null ? saved === 'true' : true;
  });
  const [showTimestamps, setShowTimestamps] = useState<boolean>(() => {
    const saved = localStorage.getItem('oanda_showTimestamps');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('oanda_wrapLogs', String(wrapLogs));
  }, [wrapLogs]);

  useEffect(() => {
    localStorage.setItem('oanda_reverseLogs', String(reverseLogs));
  }, [reverseLogs]);

  useEffect(() => {
    localStorage.setItem('oanda_showTimestamps', String(showTimestamps));
  }, [showTimestamps]);

  const fetchOandaAutoStatus = async () => {
    setLoadingAutoStatus(true);
    try {
      const res = await fetch('/api/trading/oanda-status');
      if (res.ok) {
        const data = await res.json();
        setOandaAutoStatus(data.status);
        setOandaPositions(data.positions || []);
      }
    } catch (err) {
      console.error('Errore caricamento stato automatico OANDA:', err);
    } finally {
      setLoadingAutoStatus(false);
    }
  };

  const handleToggleAutoTrading = async () => {
    if (!oandaAutoStatus) return;
    setSubmittingAutoToggle(true);
    try {
      const res = await fetch('/api/trading/oanda-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !oandaAutoStatus.active })
      });
      if (res.ok) {
        const data = await res.json();
        setOandaAutoStatus(prev => prev ? { ...prev, active: data.active } : null);
        setSuccessMessage(`Trading automatico OANDA ${data.active ? 'attivato' : 'disattivato'} con successo!`);
        fetchOandaAutoStatus();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore durante la modifica dello stato dell\'auto-trading.');
    } finally {
      setSubmittingAutoToggle(false);
    }
  };

  const handleTriggerAutoTrading = async () => {
    setTriggeringCycle(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/trading/oanda-trigger', {
        method: 'POST'
      });
      if (res.ok) {
        setSuccessMessage('Ciclo di trading automatico Forex eseguito ed aggiornato!');
        fetchOandaAutoStatus();
        fetchAccount();
        fetchAnalysisAndCandles(selectedInstrument);
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || 'Errore esecuzione ciclo automatico.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore di connessione.');
    } finally {
      setTriggeringCycle(false);
    }
  };

  const handleResetOandaLogs = async () => {
    if (!window.confirm('Sei sicuro di voler azzerare tutti i log di OANDA?')) return;
    try {
      const res = await fetch('/api/trading/oanda-reset-logs', {
        method: 'POST'
      });
      if (res.ok) {
        setSuccessMessage('Log OANDA azzerati con successo.');
        fetchOandaAutoStatus();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore azzeramento log.');
    }
  };

  const handleCloseOandaPosition = async (symbol: string) => {
    setClosingInstruments(prev => [...prev, symbol]);
    try {
      const res = await fetch('/api/trading/oanda-close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (res.ok) {
        setSuccessMessage(`Posizione su ${symbol.replace('_', '/')} chiusa manualmente con successo.`);
        setConfirmCloseInstrument(null);
        fetchOandaAutoStatus();
        fetchAccount();
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || 'Errore durante la chiusura della posizione.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore di connessione.');
    } finally {
      setClosingInstruments(prev => prev.filter(s => s !== symbol));
    }
  };


  // Available instruments
  const instruments = [
    { value: 'EUR_USD', label: 'EUR/USD (Euro / Dollaro US)' },
    { value: 'GBP_USD', label: 'GBP/USD (Sterlina / Dollaro US)' },
    { value: 'USD_JPY', label: 'USD/JPY (Dollaro US / Yen Giapponese)' },
    { value: 'AUD_USD', label: 'AUD/USD (Dollaro Australiano / Dollaro US)' },
    { value: 'EUR_GBP', label: 'EUR/GBP (Euro / Sterlina)' },
  ];

  const fetchAccount = async () => {
    setLoadingAccount(true);
    try {
      const res = await fetch('/api/trading/account');
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account);
        setIsDemo(!!data.isDemo);
      }
    } catch (err: any) {
      console.error('Errore caricamento account OANDA:', err);
    } finally {
      setLoadingAccount(false);
    }
  };

  const fetchAnalysisAndCandles = async (instrument: string) => {
    setLoadingAnalysis(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/trading/analysis/${instrument}`);
      if (res.ok) {
        const data = await res.json();
        setCandles(data.candles || []);
        setAnalysis(data.analysis || '');
        if (data.isDemo !== undefined) {
          setIsDemo(data.isDemo);
        }
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || 'Errore durante il caricamento dei dati.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore di connessione al server.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    fetchAccount();
    fetchAnalysisAndCandles(selectedInstrument);
    fetchOandaAutoStatus();

    // Polling periodico per tenere aggiornati i log e lo stato automatico di OANDA
    const interval = setInterval(() => {
      fetchOandaAutoStatus();
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  const handleInstrumentChange = (inst: string) => {
    setSelectedInstrument(inst);
    fetchAnalysisAndCandles(inst);
    setOrderResult(null);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (units <= 0) {
      setErrorMessage('La quantità deve essere maggiore di zero.');
      return;
    }

    setSubmittingOrder(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setOrderResult(null);

    try {
      const res = await fetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument: selectedInstrument,
          units,
          side: orderSide
        })
      });

      if (res.ok) {
        const data = await res.json();
        setOrderResult(data);
        if (data.isDemo) {
          setSuccessMessage(`[DEMO] Ordine simulato eseguito correttamente!`);
        } else if (data.orderFillTransaction) {
          setSuccessMessage(`Ordine reale compilato con successo! ID: ${data.orderFillTransaction.id}`);
        } else {
          setSuccessMessage('Richiesta d\'ordine inviata con successo.');
        }
        // Aggiorna l'account per mostrare il saldo aggiornato
        fetchAccount();
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || 'Errore durante l\'invio dell\'ordine.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore di connessione durante l\'invio dell\'ordine.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Convert candles for charting
  const chartData = useMemo(() => {
    return candles.map((c, index) => {
      const date = new Date(c.time);
      return {
        name: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullDate: date.toLocaleString(),
        close: parseFloat(c.mid.c),
        open: parseFloat(c.mid.o),
        high: parseFloat(c.mid.h),
        low: parseFloat(c.mid.l),
        volume: c.volume
      };
    });
  }, [candles]);

  // Determine current price and net changes
  const currentPrice = useMemo(() => {
    if (candles.length === 0) return 0;
    return parseFloat(candles[candles.length - 1].mid.c);
  }, [candles]);

  const priceChange = useMemo(() => {
    if (candles.length < 2) return { value: 0, percent: 0, isPositive: true };
    const first = parseFloat(candles[0].mid.c);
    const last = parseFloat(candles[candles.length - 1].mid.c);
    const diff = last - first;
    const pct = (diff / first) * 100;
    return {
      value: diff,
      percent: pct,
      isPositive: diff >= 0
    };
  }, [candles]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs space-y-1">
          <p className="font-semibold text-slate-300">{data.fullDate}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 border-t border-slate-800">
            <p>Apertura:</p><p className="font-mono text-right">{data.open.toFixed(5)}</p>
            <p>Massimo:</p><p className="font-mono text-right text-green-400">{data.high.toFixed(5)}</p>
            <p>Minimo:</p><p className="font-mono text-right text-red-400">{data.low.toFixed(5)}</p>
            <p className="font-semibold text-white">Chiusura:</p><p className="font-mono text-right text-indigo-300 font-semibold">{data.close.toFixed(5)}</p>
            <p className="text-slate-400">Volume:</p><p className="font-mono text-right text-slate-400">{data.volume}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Banner di modalità Demo o Connessione */}
      {isDemo ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 text-sm">Modalità Demo OANDA Attiva</h3>
              <p className="text-xs text-amber-700 mt-1">
                L'applicazione sta funzionando in modalità simulata perché non sono state configurate le variabili d'ambiente <strong>OANDA_API_KEY</strong> e <strong>OANDA_ACCOUNT_ID</strong> nel file <code>.env</code>.
              </p>
            </div>
          </div>
          <div className="text-xs bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg font-medium border border-amber-200 shrink-0">
            Demo Sandbox
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-950 text-sm">Connessione OANDA Attiva</h3>
              <p className="text-xs text-emerald-700">Il modulo è correttamente collegato al tuo account reale/practice su OANDA.</p>
            </div>
          </div>
          <div className="text-xs bg-emerald-100 text-emerald-900 px-3 py-1.5 rounded-lg font-medium border border-emerald-200 shrink-0">
            Live Connected
          </div>
        </div>
      )}

      {/* Grid Superiore: Informazioni Account e Selezione Strumento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Account OANDA */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account OANDA</h3>
              {loadingAccount ? (
                <RefreshCcw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : (
                <button 
                  onClick={fetchAccount}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition"
                  title="Aggiorna dati account"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-lg font-bold text-slate-800 mt-2 font-mono">
              {account?.id || 'IT/M189975/EUR'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Broker: <span className="font-semibold text-slate-700">OANDA TMS Brokers S.A.</span>
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Bilancio</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
                {parseFloat(account?.balance || '50.00').toFixed(2)} {account?.currency || 'EUR'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Net Asset Value (NAV)</p>
              <p className="text-xl font-bold text-indigo-600 mt-0.5 font-mono">
                {parseFloat(account?.NAV || '50.00').toFixed(2)} {account?.currency || 'EUR'}
              </p>
            </div>
          </div>
        </div>

        {/* Selezione Strumento */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between md:col-span-2">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Strumento di Trading</h3>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">OANDA FX</span>
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative w-full sm:w-auto">
                <select 
                  value={selectedInstrument} 
                  onChange={(e) => handleInstrumentChange(e.target.value)}
                  className="w-full sm:w-80 appearance-none bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer pr-10"
                >
                  {instruments.map(inst => (
                    <option key={inst.value} value={inst.value}>{inst.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>

              <button 
                onClick={() => fetchAnalysisAndCandles(selectedInstrument)}
                disabled={loadingAnalysis}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer border-none"
              >
                <RefreshCcw className={`w-4 h-4 ${loadingAnalysis ? 'animate-spin' : ''}`} />
                Aggiorna Analisi IA
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-400 font-medium">Prezzo Ultimo:</span>
              <span className="text-2xl font-bold text-slate-900 font-mono">
                {currentPrice ? currentPrice.toFixed(5) : '...'}
              </span>
            </div>
            {currentPrice !== 0 && (
              <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                priceChange.isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {priceChange.isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{priceChange.isPositive ? '+' : ''}{priceChange.value.toFixed(5)} ({priceChange.percent.toFixed(2)}%)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Centrale: Grafico ed Analisi IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafico Prezzi */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              Andamento Prezzi (Ultime 50 ore)
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Prezzo medio (H1)</span>
          </div>

          <div className="h-72 w-full mt-2">
            {loadingAnalysis ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCcw className="w-6 h-6 animate-spin text-indigo-500" />
                <p className="text-sm">Caricamento grafico...</p>
              </div>
            ) : candles.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Nessun dato candlestick disponibile.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#94a3b8" 
                    fontSize={10} 
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#94a3b8" 
                    fontSize={10}
                    tickFormatter={(val) => val.toFixed(4)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="close" 
                    stroke="#4f46e5" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium pt-4 mt-2 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
              Chiusura Oraria
            </span>
            <span>Grafico interattivo. Passa il cursore per l'OHLC completo.</span>
          </div>
        </div>

        {/* Box Analisi Tecnica Gemini */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                Analisi Tecnica IA
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">Gemini 2.0</span>
            </div>

            {loadingAnalysis ? (
              <div className="py-12 space-y-4">
                <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6"></div>
                <div className="h-4 bg-slate-100 rounded animate-pulse w-2/3"></div>
                <div className="h-4 bg-slate-100 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-slate-100 rounded animate-pulse w-4/5"></div>
              </div>
            ) : analysis ? (
              <div className="text-xs text-slate-600 overflow-y-auto max-h-80 pr-1 leading-relaxed">
                <div className="markdown-body">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-12">Nessun dato di analisi disponibile.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Basato sugli ultimi 50 candlestick orari e sul sentiment globale.</span>
          </div>
        </div>
      </div>

      {/* Sezione: Pannello Controllo Auto-Trading OANDA AI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Pannello Account & P&L (Simile ad Alpaca) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-800">
                  Conto Simulato OANDA AI
                </h3>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${oandaAutoStatus?.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {oandaAutoStatus?.active ? 'AUTO ATTIVO' : 'AUTO FERMO'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Saldo Equity</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5 font-mono">
                  {oandaAutoStatus?.equity !== undefined ? oandaAutoStatus.equity.toFixed(2) : parseFloat(account?.NAV || '50.00').toFixed(2)} €
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Broker</p>
                <p className="text-sm font-semibold text-emerald-600 mt-1">
                  OANDA Forex Sandbox
                </p>
              </div>
            </div>

            {/* Grafico P&L Storico */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 mb-6">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
                    Andamento Storico P&L (Forex)
                  </h4>
                  <p className="text-[10px] text-slate-500">Profitti/perdite realizzati cumulativi in EUR</p>
                </div>
                <div className="flex gap-4 text-[10px] font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
                    <span className="text-slate-600">Realizzato</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-sky-400 inline-block"></span>
                    <span className="text-slate-600">Non Realizzato</span>
                  </div>
                </div>
              </div>

              <div className="h-44 w-full">
                {oandaAutoStatus?.dailyPnL && oandaAutoStatus.dailyPnL.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={oandaAutoStatus.dailyPnL}
                      margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="oandaColorRealized" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="oandaColorUnrealized" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} />
                      <YAxis stroke="#94a3b8" fontSize={9} tickFormatter={(v) => `${v.toFixed(2)}€`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                        formatter={(value: any) => [`${parseFloat(value).toFixed(2)} €`]}
                      />
                      <Area type="monotone" dataKey="realized" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#oandaColorRealized)" />
                      <Area type="monotone" dataKey="unrealized" stroke="#0ea5e9" strokeWidth={1.5} fillOpacity={1} fill="url(#oandaColorUnrealized)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                    In attesa di transazioni per generare il grafico P&L
                  </div>
                )}
              </div>
            </div>

            {/* Posizioni Aperte */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 border-b pb-1">
                Posizioni Forex Aperte
              </h4>
              <div className="space-y-2">
                {oandaPositions && oandaPositions.length > 0 ? (
                  oandaPositions.map((pos: any, i: number) => {
                    const unrealizedPlNum = parseFloat(pos.unrealized_pl || '0');
                    return (
                      <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/60 gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{pos.symbol.replace('_', '/')}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              pos.side === 'buy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {pos.side === 'buy' ? 'LONG' : 'SHORT'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:flex sm:gap-4 text-[11px] text-slate-500">
                            <div>
                              <span className="text-slate-400">Dimensione: </span>
                              <span className="font-mono font-semibold text-slate-700">{pos.qty} unità</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Prezzo acq: </span>
                              <span className="font-mono font-semibold text-slate-700">{parseFloat(pos.avg_entry_price).toFixed(5)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Attuale: </span>
                              <span className="font-mono font-semibold text-slate-700">{parseFloat(pos.current_price).toFixed(5)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0">
                          <span className={`font-mono font-bold text-xs ${unrealizedPlNum >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {unrealizedPlNum >= 0 ? '+' : ''}{unrealizedPlNum.toFixed(2)} €
                          </span>

                          {confirmCloseInstrument === pos.symbol ? (
                            <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-100">
                              <button
                                type="button"
                                onClick={() => handleCloseOandaPosition(pos.symbol)}
                                disabled={closingInstruments.includes(pos.symbol)}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2.5 py-1 rounded transition border-none cursor-pointer"
                              >
                                {closingInstruments.includes(pos.symbol) ? '...' : 'Sì'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmCloseInstrument(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] px-2 py-1 rounded transition border-none cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmCloseInstrument(pos.symbol)}
                              className="text-[10px] font-semibold text-rose-600 hover:text-white hover:bg-rose-600 px-2.5 py-1 rounded-lg border border-rose-200 hover:border-rose-600 transition cursor-pointer"
                            >
                              Liquida
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-slate-400 italic">
                    Nessuna posizione Forex attualmente aperta.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pannello Controllo Bot & Logs (Simile ad Alpaca) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Bot Automation Controller Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Automazione & Controllo IA
            </h4>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Stato Robot</span>
                  <span className="text-[10px] text-slate-400">Periodicità di analisi: 1 ora</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoTrading}
                  disabled={submittingAutoToggle || !oandaAutoStatus}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs transition-all border-none cursor-pointer ${
                    oandaAutoStatus?.active
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {oandaAutoStatus?.active ? 'Fermare Bot' : 'Avviare Bot'}
                </button>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Esecuzione Forzata</span>
                  <span className="text-[10px] text-slate-400">Analizza mercati adesso</span>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerAutoTrading}
                  disabled={triggeringCycle || !oandaAutoStatus}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition disabled:opacity-50 shadow-sm border-none cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${triggeringCycle ? 'animate-spin' : ''}`} />
                  {triggeringCycle ? 'Analisi...' : 'Esegui Ciclo'}
                </button>
              </div>

              <div className="text-[10px] text-slate-500 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/40">
                <span className="font-bold text-indigo-950 block mb-0.5">Asset Monitorati dal Bot ({oandaAutoStatus?.monitoredInstruments?.length || 0})</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {oandaAutoStatus?.monitoredInstruments?.map((inst: string) => (
                    <span key={inst} className="text-[9px] font-bold bg-white text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">
                      {inst.replace('_', '/')}
                    </span>
                  ))}
                </div>
                {oandaAutoStatus?.lastCheck && (
                  <span className="text-[9px] text-slate-400 block mt-2">
                    Ultimo ciclo: {new Date(oandaAutoStatus.lastCheck).toLocaleString('it-IT')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Console Logs */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex-1 flex flex-col min-h-[280px]">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveLogTab('system')}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition border-none cursor-pointer ${
                    activeLogTab === 'system' ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Log di Sistema
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLogTab('logic')}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition border-none cursor-pointer ${
                    activeLogTab === 'logic' ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Decisioni IA
                </button>
              </div>
              
              <button
                type="button"
                onClick={handleResetOandaLogs}
                className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 bg-transparent border-none cursor-pointer px-2 py-0.5 rounded transition"
              >
                Azzera
              </button>
            </div>

            {/* Log Controls */}
            <div className="flex flex-wrap items-center gap-4 px-4 py-1.5 bg-slate-950 border-b border-slate-800/60 text-[10px] text-slate-400 select-none">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wrapLogs}
                  onChange={(e) => setWrapLogs(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-3.5 h-3.5 cursor-pointer"
                />
                <span>A capo automatico</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reverseLogs}
                  onChange={(e) => setReverseLogs(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Ordine inverso</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Mostra timestamp</span>
              </label>
            </div>

            <div className="p-4 h-64 overflow-y-auto font-mono text-xs text-slate-300 scrollbar-thin scrollbar-thumb-slate-800 flex-1">
              {activeLogTab === 'system' ? (
                (() => {
                  const rawLogs = oandaAutoStatus?.logs || [];
                  const processedLogs = reverseLogs ? rawLogs : [...rawLogs].reverse();

                  if (processedLogs.length === 0) {
                    return <div className="text-slate-500 text-center py-16">In attesa di log... Attiva il bot o esegui un ciclo manuale.</div>;
                  }

                  const formatLogMsg = (msg: string) => {
                    const timestampRegex = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\]\s*/;
                    const match = msg.match(timestampRegex);
                    if (match) {
                      const rawMsg = msg.replace(timestampRegex, '');
                      if (showTimestamps) {
                        const date = new Date(match[1]);
                        const formatted = isNaN(date.getTime()) ? match[1] : date.toLocaleTimeString('it-IT');
                        return `[${formatted}] ${rawMsg}`;
                      } else {
                        return rawMsg;
                      }
                    }
                    return msg;
                  };

                  return processedLogs.map((log: string, idx: number) => {
                    let colorClass = 'text-slate-400';
                    if (log.includes('[OANDA Errore]') || log.includes('Errore Critico')) {
                      colorClass = 'text-rose-400';
                    } else if (log.includes('eseguito') || log.includes('chiusa con successo') || log.includes('chiusa manualmente')) {
                      colorClass = 'text-emerald-400';
                    } else if (log.includes('Sentiment: BUY')) {
                      colorClass = 'text-emerald-300/90';
                    } else if (log.includes('Sentiment: SELL')) {
                      colorClass = 'text-amber-300/90';
                    } else if (log.includes('[AI Quota Exceeded]') || log.includes('[AI Cooldown]')) {
                      colorClass = 'text-yellow-500';
                    }
                    const formattedText = formatLogMsg(log);
                    return (
                      <div
                        key={idx}
                        className={`py-0.5 leading-relaxed border-b border-slate-800/20 ${colorClass} ${
                          wrapLogs ? 'break-words whitespace-pre-wrap' : 'whitespace-nowrap overflow-x-auto truncate'
                        }`}
                      >
                        {formattedText}
                      </div>
                    );
                  });
                })()
              ) : (
                (() => {
                  const rawLogicLogs = oandaAutoStatus?.logicLogs || [];
                  const processedLogicLogs = reverseLogs ? rawLogicLogs : [...rawLogicLogs].reverse();

                  if (processedLogicLogs.length === 0) {
                    return <div className="text-slate-500 text-center py-16">Nessuna decisione IA registrata.</div>;
                  }

                  return processedLogicLogs.map((log: any, idx: number) => {
                    const sideColor = log.action === 'BUY' || log.action === 'CHIUSURA_POSITIVA' ? 'text-emerald-400' : log.action === 'SELL' ? 'text-rose-400' : 'text-slate-500';
                    const timeStr = showTimestamps 
                      ? new Date(log.timestamp).toLocaleTimeString('it-IT') 
                      : '';

                    return (
                      <div key={idx} className="py-2 border-b border-slate-800 last:border-b-0">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-2">
                            {showTimestamps && (
                              <span className="text-[10px] text-slate-500">{timeStr}</span>
                            )}
                            <span className="font-bold text-indigo-400">{log.instrument.replace('_', '/')}</span>
                            <span className={`font-bold px-1 rounded bg-slate-800 text-[10px] uppercase ${sideColor}`}>{log.action}</span>
                          </div>
                          {log.price && <span className="text-slate-400 font-bold">@ {log.price.toFixed(5)}</span>}
                        </div>
                        <p className={`text-slate-400 text-xs italic pl-2 border-l border-slate-800 ${
                          wrapLogs ? 'break-words whitespace-pre-wrap' : 'whitespace-nowrap overflow-x-auto truncate'
                        }`}>{log.reasoning}</p>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sezione Inferiore: Desk di Trading */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-indigo-600" />
          Trading Desk Operativo
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Inserimento Ordine */}
          <form onSubmit={handlePlaceOrder} className="space-y-4 lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                  Unità (Lotto / Volume)
                </label>
                <input 
                  type="number" 
                  value={units} 
                  onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="1"
                />
                <p className="text-[10px] text-slate-400 mt-1">Esempio: 1000 = micro lotto standard</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                  Direzione Ordine
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setOrderSide('buy')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                      orderSide === 'buy' 
                        ? 'bg-green-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    ACQUISTA (BUY)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderSide('sell')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                      orderSide === 'sell' 
                        ? 'bg-red-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    VENDI (SELL)
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Scegli BUY per andare long o SELL per short.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={submittingOrder || loadingAnalysis}
                className={`flex-1 flex items-center justify-center gap-2 text-white font-bold rounded-xl py-3.5 text-sm shadow-md transition-all active:scale-95 border-none cursor-pointer ${
                  orderSide === 'buy' 
                    ? 'bg-green-600 hover:bg-green-700 shadow-green-100' 
                    : 'bg-red-600 hover:bg-red-700 shadow-red-100'
                } disabled:opacity-50`}
              >
                {submittingOrder ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    Inizializzazione Ordine in corso...
                  </>
                ) : (
                  <>
                    Esegui Ordine di {orderSide === 'buy' ? 'Acquisto' : 'Vendita'} ({units} Unità)
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Risultato Transazione */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Stato Operazione</h4>
              
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {!errorMessage && !successMessage && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Nessun ordine inoltrato in questa sessione.
                </div>
              )}

              {orderResult && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5 font-mono text-[10px] text-slate-600">
                  <div className="flex justify-between">
                    <span>ID Transazione:</span>
                    <span className="font-semibold text-slate-900">{orderResult.orderFillTransaction?.id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Strumento:</span>
                    <span className="font-semibold text-slate-900">{orderResult.orderFillTransaction?.instrument || selectedInstrument}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unità Eseguite:</span>
                    <span className="font-semibold text-slate-900">{orderResult.orderFillTransaction?.units || units}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prezzo Medio:</span>
                    <span className="font-semibold text-slate-900">{orderResult.orderFillTransaction?.price || '...'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>P&L Realizzato:</span>
                    <span className="font-semibold text-slate-900">{orderResult.orderFillTransaction?.pl || '0.00'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 mt-4 leading-normal">
              Gli ordini di mercato OANDA vengono eseguiti con modalità FOK (Fill-Or-Kill) per prevenire slittamenti improvvisi di prezzo.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
