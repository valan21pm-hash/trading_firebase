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

interface XtbAccount {
  id: string;
  balance: string;
  currency: string;
  NAV: string;
  openPositionCount: number;
  pendingOrderCount: number;
  alias?: string;
}

export default function TradingModule() {
  const [activeBroker, setActiveBroker] = useState<'xtb' | 'ig'>('ig');
  const [selectedInstrument, setSelectedInstrument] = useState<string>('EUR_USD');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [analysis, setAnalysis] = useState<string>('');
  const [account, setAccount] = useState<XtbAccount | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [loadingAccount, setLoadingAccount] = useState<boolean>(false);
  const [isDemo, setIsDemo] = useState<boolean>(true);
  const [units, setUnits] = useState<number>(1000);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderResult, setOrderResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-Trading states (XTB)
  const [xtbAutoStatus, setXtbAutoStatus] = useState<any | null>(null);
  const [xtbPositions, setXtbPositions] = useState<any[]>([]);

  // Auto-Trading states (IG)
  const [igAutoStatus, setIgAutoStatus] = useState<any | null>(null);
  const [igPositions, setIgPositions] = useState<any[]>([]);

  const [closingInstruments, setClosingInstruments] = useState<string[]>([]);
  const [confirmCloseInstrument, setConfirmCloseInstrument] = useState<string | null>(null);
  const [loadingAutoStatus, setLoadingAutoStatus] = useState<boolean>(false);
  const [submittingAutoToggle, setSubmittingAutoToggle] = useState<boolean>(false);
  const [triggeringCycle, setTriggeringCycle] = useState<boolean>(false);
  const [activeLogTab, setActiveLogTab] = useState<'system' | 'logic'>('system');
  
  const [editingSettings, setEditingSettings] = useState(false);
  const [draftTP, setDraftTP] = useState<string>('0.10');
  const [draftSL, setDraftSL] = useState<string>('-1.00');
  const [draftRisk, setDraftRisk] = useState<string>('2');
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConn, setTestingConn] = useState<boolean>(false);
  const [connTestResult, setConnTestResult] = useState<{ success: boolean; message: string; error?: string } | null>(null);

  const currentAutoStatus = activeBroker === 'xtb' ? xtbAutoStatus : igAutoStatus;
  const currentPositions = activeBroker === 'xtb' ? xtbPositions : igPositions;

  useEffect(() => {
    if (currentAutoStatus) {
      setDraftTP(String(currentAutoStatus.defaultTP ?? (activeBroker === 'xtb' ? 0.10 : 20.00)));
      setDraftSL(String(currentAutoStatus.defaultSL ?? (activeBroker === 'xtb' ? -1.00 : -50.00)));
      setDraftRisk(String(currentAutoStatus.riskPercentage ?? (activeBroker === 'xtb' ? 2 : 5)));
    }
  }, [currentAutoStatus?.defaultTP, currentAutoStatus?.defaultSL, currentAutoStatus?.riskPercentage, activeBroker]);

  const [wrapLogs, setWrapLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem('xtb_wrapLogs');
    return saved !== null ? saved === 'true' : true;
  });
  const [reverseLogs, setReverseLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem('xtb_reverseLogs');
    return saved !== null ? saved === 'true' : true;
  });
  const [showTimestamps, setShowTimestamps] = useState<boolean>(() => {
    const saved = localStorage.getItem('xtb_showTimestamps');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('xtb_wrapLogs', String(wrapLogs));
  }, [wrapLogs]);

  useEffect(() => {
    localStorage.setItem('xtb_reverseLogs', String(reverseLogs));
  }, [reverseLogs]);

  useEffect(() => {
    localStorage.setItem('xtb_showTimestamps', String(showTimestamps));
  }, [showTimestamps]);

  const fetchAutoStatus = async (broker = activeBroker) => {
    setLoadingAutoStatus(true);
    try {
      const url = broker === 'xtb' ? '/api/trading/xtb-status' : '/api/trading/ig-status';
      const res = await fetch(url);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (broker === 'xtb') {
            setXtbAutoStatus(data.status);
            setXtbPositions(data.positions || []);
          } else {
            setIgAutoStatus(data.status);
            setIgPositions(data.positions || []);
          }
        } else {
          console.warn(`Expected JSON response from ${url}, received alternative content type.`);
        }
      }
    } catch (err) {
      console.error(`Errore caricamento stato automatico ${broker.toUpperCase()}:`, err);
    } finally {
      setLoadingAutoStatus(false);
    }
  };

  const handleToggleAutoTrading = async () => {
    if (!currentAutoStatus) return;
    setSubmittingAutoToggle(true);
    try {
      const url = activeBroker === 'xtb' ? '/api/trading/xtb-status' : '/api/trading/ig-status';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentAutoStatus.active })
      });
      if (res.ok) {
        const data = await res.json();
        if (activeBroker === 'xtb') {
          setXtbAutoStatus(prev => prev ? { ...prev, active: data.active } : null);
        } else {
          setIgAutoStatus(prev => prev ? { ...prev, active: data.active } : null);
        }
        setSuccessMessage(`Trading automatico ${activeBroker.toUpperCase()} ${data.active ? 'attivato' : 'disattivato'} con successo!`);
        fetchAutoStatus();
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
      const url = activeBroker === 'xtb' ? '/api/trading/xtb-trigger' : '/api/trading/ig-trigger';
      const res = await fetch(url, {
        method: 'POST'
      });
      if (res.ok) {
        setSuccessMessage(`Ciclo di trading automatico Forex ${activeBroker.toUpperCase()} eseguito ed aggiornato!`);
        fetchAutoStatus();
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

  const handleResetXtbLogs = async () => {
    if (!window.confirm(`Sei sicuro di voler azzerare tutti i log di ${activeBroker.toUpperCase()}?`)) return;
    try {
      const url = activeBroker === 'xtb' ? '/api/trading/xtb-reset-logs' : '/api/trading/ig-reset-logs';
      const res = await fetch(url, {
        method: 'POST'
      });
      if (res.ok) {
        setSuccessMessage(`Log ${activeBroker.toUpperCase()} azzerati con successo.`);
        fetchAutoStatus();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore azzeramento log.');
    }
  };

  const handleResetBalance = async () => {
    const isXtb = activeBroker === 'xtb';
    const limitMsg = isXtb ? '50€' : '30000.00€';
    if (!window.confirm(`Sei sicuro di voler azzerare il saldo (${limitMsg}) e tutte le posizioni di ${activeBroker.toUpperCase()}?`)) return;
    try {
      const url = isXtb ? '/api/trading/xtb-reset-balance' : '/api/trading/ig-reset-balance';
      const res = await fetch(url, {
        method: 'POST'
      });
      if (res.ok) {
        setSuccessMessage(`Saldo ${activeBroker.toUpperCase()} azzerato con successo.`);
        fetchAutoStatus();
        fetchAccount();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore azzeramento saldo.');
    }
  };

  const handleCloseXtbPosition = async (symbol: string) => {
    setClosingInstruments(prev => [...prev, symbol]);
    try {
      const url = activeBroker === 'xtb' ? '/api/trading/xtb-close-position' : '/api/trading/ig-close-position';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (res.ok) {
        setSuccessMessage(`Posizione su ${symbol.replace('_', '/')} chiusa manualmente con successo.`);
        setConfirmCloseInstrument(null);
        fetchAutoStatus();
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

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const url = activeBroker === 'xtb' ? '/api/trading/xtb-settings' : '/api/trading/ig-settings';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultTP: parseFloat(draftTP) || (activeBroker === 'xtb' ? 0.10 : 20.00),
          defaultSL: parseFloat(draftSL) || (activeBroker === 'xtb' ? -1.00 : -50.00),
          riskPercentage: parseFloat(draftRisk) || (activeBroker === 'xtb' ? 2 : 5)
        })
      });
      if (res.ok) {
        setSuccessMessage('Impostazioni salvate con successo.');
        setEditingSettings(false);
        fetchAutoStatus();
      } else {
        const errData = await res.json();
        setErrorMessage(errData.error || 'Errore salvataggio impostazioni.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Errore di connessione.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setConnTestResult(null);
    try {
      const res = await fetch('/api/trading/ig-test-connection', {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const msg = `Test di connessione IG Markets completato con successo! Collegato all'account ${data.accountName || 'IG'} (ID: ${data.accountId}) con un saldo di ${parseFloat(data.balance).toFixed(2)} € (caricato in tempo reale).`;
        setSuccessMessage(msg);
        setConnTestResult({ success: true, message: msg });
        fetchAccount('ig');
        fetchAutoStatus('ig');
      } else {
        const errMsg = data.error || 'Test di connessione fallito. Controlla le credenziali.';
        setErrorMessage(errMsg);
        setConnTestResult({ success: false, message: errMsg });
      }
    } catch (err: any) {
      const errMsg = err.message || 'Errore di rete durante il test di connessione.';
      setErrorMessage(errMsg);
      setConnTestResult({ success: false, message: errMsg });
    } finally {
      setTestingConn(false);
    }
  };

  const fetchAccount = async (broker = activeBroker) => {
    setLoadingAccount(true);
    try {
      const url = broker === 'xtb' ? '/api/trading/account' : '/api/trading/ig-account';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account);
        setIsDemo(!!data.isDemo);
      }
    } catch (err: any) {
      console.error(`Errore caricamento account ${broker.toUpperCase()}:`, err);
    } finally {
      setLoadingAccount(false);
    }
  };

  const fetchAnalysisAndCandles = async (instrument: string, broker = activeBroker) => {
    setLoadingAnalysis(true);
    setErrorMessage(null);
    try {
      const url = broker === 'xtb' ? `/api/trading/analysis/${instrument}` : `/api/trading/ig-analysis/${instrument}`;
      const res = await fetch(url);
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
    fetchAccount(activeBroker);
    fetchAnalysisAndCandles(selectedInstrument, activeBroker);
    fetchAutoStatus(activeBroker);

    // Polling periodico per tenere aggiornati i log e lo stato automatico
    const interval = setInterval(() => {
      fetchAutoStatus(activeBroker);
    }, 12000);

    return () => clearInterval(interval);
  }, [activeBroker]);

  const handleInstrumentChange = (inst: string) => {
    setSelectedInstrument(inst);
    fetchAnalysisAndCandles(inst, activeBroker);
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
      const url = activeBroker === 'xtb' ? '/api/trading/order' : '/api/trading/ig-order';
      const res = await fetch(url, {
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
          setSuccessMessage(`[DEMO ${activeBroker.toUpperCase()}] Ordine simulato eseguito correttamente!`);
        } else if (data.orderFillTransaction) {
          setSuccessMessage(`Ordine reale compilato con successo! ID: ${data.orderFillTransaction.id}`);
        } else {
          setSuccessMessage('Richiesta d\'ordine inviata con successo.');
        }
        fetchAccount(activeBroker);
        fetchAutoStatus(activeBroker);
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
              <h3 className="font-semibold text-amber-900 text-sm">
                Modalità Demo {activeBroker === 'xtb' ? 'XTB' : 'IG Markets'} Attiva
              </h3>
              <p className="text-xs text-amber-700 mt-1">
                L'applicazione sta funzionando in modalità simulata Sandbox per {activeBroker === 'xtb' ? 'XTB' : 'IG Markets (chiave: Z6CKEN)'}.
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
              <h3 className="font-semibold text-emerald-950 text-sm">Connessione {activeBroker === 'xtb' ? 'XTB' : 'IG Markets'} Attiva</h3>
              <p className="text-xs text-emerald-700">Il modulo è correttamente collegato al tuo account reale/practice su {activeBroker === 'xtb' ? 'XTB' : 'IG Markets'}.</p>
            </div>
          </div>
          <div className="text-xs bg-emerald-100 text-emerald-900 px-3 py-1.5 rounded-lg font-medium border border-emerald-200 shrink-0">
            Live Connected
          </div>
        </div>
      )}

      {/* Risultato del Test di Connessione IG */}
      {connTestResult && (
        <div className={`rounded-2xl p-5 border shadow-sm ${connTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          <div className="flex gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${connTestResult.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {connTestResult.success ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div className="space-y-1.5">
              <h4 className="font-bold text-sm">
                {connTestResult.success ? 'Esito Test: Connessione Stabilita!' : 'Esito Test: Errore di Connessione'}
              </h4>
              <p className="text-xs leading-relaxed">{connTestResult.message}</p>
              {!connTestResult.success && (
                <div className="text-xs text-red-700 bg-red-100/50 p-3 rounded-lg border border-red-200/50 mt-2 font-medium">
                  <strong>Istruzioni Utente per IG Markets:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Verifica che <strong>IG_USERNAME</strong> nei Secrets di AI Studio non sia la tua email. Deve essere lo username alfanumerico esatto del sito di IG.</li>
                    <li>La tua chiave API (105b85...) è di tipo <strong>REAL (LIVE)</strong>. Per connetterti, devi aggiungere la variabile d'ambiente <strong>IG_MODE</strong> impostata su <strong>real</strong> nei Secrets di AI Studio.</li>
                    <li>Se vuoi usare l'account Demo virtuale integrato nel bot, clicca sul tasto rosso "Azzera Conto" per riportare il saldo di simulazione a 30.000,00 € (il saldo di default di IG).</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid Superiore: Informazioni Account e Selezione Strumento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Account */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account {activeBroker === 'xtb' ? 'XTB' : 'IG Markets'}</h3>
              {loadingAccount ? (
                <RefreshCcw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : (
                <div className="flex gap-2 items-center">
                  {activeBroker === 'ig' && (
                    <button 
                      onClick={handleTestConnection}
                      disabled={testingConn}
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold hover:bg-indigo-100 transition border-none cursor-pointer disabled:opacity-50"
                      title="Esegui test di connessione REST API a IG"
                    >
                      {testingConn ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Activity className="w-3 h-3" />
                      )}
                      Test Connessione
                    </button>
                  )}
                  <button 
                    onClick={handleResetBalance}
                    className="flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-600 rounded text-xs font-medium hover:bg-rose-100 transition border-none cursor-pointer"
                    title={`Azzera conto simulazione a ${activeBroker === 'xtb' ? '50' : '30000'}€ e chiudi posizioni`}
                  >
                    Reset {activeBroker === 'xtb' ? '50€' : '30k€'}
                  </button>
                  <button 
                    onClick={() => fetchAccount(activeBroker)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition border-none cursor-pointer bg-transparent"
                    title="Aggiorna dati account"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-lg font-bold text-slate-800 mt-2 font-mono">
              {account?.id || (activeBroker === 'xtb' ? 'IT/M189975/EUR' : 'Z6CKEN')}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Broker: <span className="font-semibold text-slate-700">{activeBroker === 'xtb' ? 'XTB' : 'IG Markets'}</span>
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Bilancio</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
                {parseFloat(account?.balance || (activeBroker === 'xtb' ? '50.00' : '30000.00')).toFixed(2)} {account?.currency || 'EUR'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Net Asset Value (NAV)</p>
              <p className="text-xl font-bold text-indigo-600 mt-0.5 font-mono">
                {parseFloat(account?.NAV || (activeBroker === 'xtb' ? '50.00' : '30000.00')).toFixed(2)} {account?.currency || 'EUR'}
              </p>
            </div>
          </div>
        </div>

        {/* Selezione Strumento */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between md:col-span-2">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Strumento di Trading</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${activeBroker === 'xtb' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-800'}`}>
                {activeBroker === 'xtb' ? 'XTB FX' : 'IG Markets FX'}
              </span>
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

      {/* Sezione: Pannello Controllo Auto-Trading AI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Pannello Account & P&L */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-800">
                  Conto Simulato {activeBroker === 'xtb' ? 'XTB' : 'IG Markets'} AI
                </h3>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${currentAutoStatus?.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {currentAutoStatus?.active ? 'AUTO ATTIVO' : 'AUTO FERMO'}
              </span>
            </div>
 
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Saldo Equity</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5 font-mono">
                  {currentAutoStatus?.equity !== undefined ? currentAutoStatus.equity.toFixed(2) : parseFloat(account?.NAV || (activeBroker === 'xtb' ? '50.00' : '30000.00')).toFixed(2)} €
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Broker</p>
                <p className="text-sm font-semibold text-indigo-600 mt-1">
                  {activeBroker === 'xtb' ? 'XTB Forex Sandbox' : 'IG Markets CFD Sandbox'}
                </p>
              </div>
            </div>
 
            {/* Grafico P&L Storico */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 mb-6">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
                    Andamento Storico P&L ({activeBroker === 'xtb' ? 'Forex' : 'CFD'})
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
                {currentAutoStatus?.dailyPnL && currentAutoStatus.dailyPnL.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={currentAutoStatus.dailyPnL}
                      margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id={`${activeBroker}ColorRealized`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id={`${activeBroker}ColorUnrealized`} x1="0" y1="0" x2="0" y2="1">
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
                      <Area type="monotone" dataKey="realized" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill={`url(#${activeBroker}ColorRealized)`} />
                      <Area type="monotone" dataKey="unrealized" stroke="#0ea5e9" strokeWidth={1.5} fillOpacity={1} fill={`url(#${activeBroker}ColorUnrealized)`} />
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
                Posizioni {activeBroker === 'xtb' ? 'Forex' : 'CFD'} Aperte
              </h4>
              <div className="space-y-2">
                {currentPositions && currentPositions.length > 0 ? (
                  currentPositions.map((pos: any, i: number) => {
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
                                onClick={() => handleCloseXtbPosition(pos.symbol)}
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
                    Nessuna posizione {activeBroker === 'xtb' ? 'Forex' : 'CFD'} attualmente aperta.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
                {/* Pannello Controllo Bot & Logs */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Bot Automation Controller Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Automazione & Controllo IA ({activeBroker === 'xtb' ? 'XTB' : 'IG Markets'})
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
                  disabled={submittingAutoToggle || !currentAutoStatus}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs transition-all border-none cursor-pointer ${
                    currentAutoStatus?.active
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {currentAutoStatus?.active ? 'Fermare Bot' : 'Avviare Bot'}
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
                  disabled={triggeringCycle || !currentAutoStatus}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition disabled:opacity-50 shadow-sm border-none cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${triggeringCycle ? 'animate-spin' : ''}`} />
                  {triggeringCycle ? 'Analisi...' : 'Esegui Ciclo'}
                </button>
              </div>
 
              {/* Impostazioni Globali Trade */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-700">Impostazioni Trade</span>
                  {editingSettings ? (
                     <div className="flex gap-2">
                       <button 
                         onClick={() => setEditingSettings(false)}
                         className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 transition"
                       >
                         Annulla
                       </button>
                       <button 
                         onClick={handleSaveSettings}
                         disabled={savingSettings}
                         className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition"
                       >
                         {savingSettings ? 'Salvataggio...' : 'Salva'}
                       </button>
                     </div>
                  ) : (
                    <button 
                      onClick={() => setEditingSettings(true)}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
                    >
                      Modifica
                    </button>
                  )}
                </div>
                {editingSettings ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">
                          Take Profit ({activeBroker === 'xtb' ? '€' : 'pips'})
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          value={draftTP}
                          onChange={e => setDraftTP(e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">
                          Stop Loss ({activeBroker === 'xtb' ? '€' : 'pips'})
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          value={draftSL}
                          onChange={e => setDraftSL(e.target.value)}
                          className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-medium block mb-1">Rischio per Trade (% saldo)</label>
                      <input 
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="10"
                        value={draftRisk}
                        onChange={e => setDraftRisk(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white"
                      />
                      <span className="text-[9px] text-slate-400 mt-1 block">Calcola la dimensione della posizione per rischiare questa % del saldo (Money Management)</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-500 font-medium block">Take Profit</span>
                      <span className="text-xs font-bold text-green-600">
                        {activeBroker === 'xtb' ? '+' : ''}{currentAutoStatus?.defaultTP?.toFixed(2) || (activeBroker === 'xtb' ? '0.10' : '20.00')} {activeBroker === 'xtb' ? '€' : 'pips'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-500 font-medium block">Stop Loss</span>
                      <span className="text-xs font-bold text-rose-600">
                        {currentAutoStatus?.defaultSL?.toFixed(2) || (activeBroker === 'xtb' ? '-1.00' : '-50.00')} {activeBroker === 'xtb' ? '€' : 'pips'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-500 font-medium block">Rischio</span>
                      <span className="text-xs font-bold text-indigo-600">{currentAutoStatus?.riskPercentage || (activeBroker === 'xtb' ? '2' : '5')}%</span>
                    </div>
                  </div>
                )}
              </div>
 
              <div className="text-[10px] text-slate-500 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/40">
                <span className="font-bold text-indigo-950 block mb-0.5">Asset Monitorati dal Bot ({currentAutoStatus?.monitoredInstruments?.length || 0})</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {currentAutoStatus?.monitoredInstruments?.map((inst: string) => (
                    <span key={inst} className="text-[9px] font-bold bg-white text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">
                      {inst.replace('_', '/')}
                    </span>
                  ))}
                </div>
                {currentAutoStatus?.lastCheck && (
                  <span className="text-[9px] text-slate-400 block mt-2">
                    Ultimo ciclo: {new Date(currentAutoStatus.lastCheck).toLocaleString('it-IT')}
                  </span>
                )}
              </div>
            </div>
          </div>
 
          {/* Console Logs */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex flex-col h-[560px]">
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
                onClick={handleResetXtbLogs}
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

            <div className="p-4 overflow-y-auto font-mono text-xs text-slate-300 scrollbar-thin scrollbar-thumb-slate-800 flex-1">
              {activeLogTab === 'system' ? (
                (() => {
                  const rawLogs = currentAutoStatus?.logs || [];
                  let processedLogs = reverseLogs ? rawLogs : [...rawLogs].reverse();
                  processedLogs = processedLogs.slice(0, 30);
 
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
                    if (log.includes('[XTB Errore]') || log.includes('[IG Errore]') || log.includes('Errore Critico')) {
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
                  const rawLogicLogs = currentAutoStatus?.logicLogs || [];
                  let processedLogicLogs = reverseLogs ? rawLogicLogs : [...rawLogicLogs].reverse();
                  processedLogicLogs = processedLogicLogs.slice(0, 30);
 
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
              Gli ordini di mercato {activeBroker === 'xtb' ? 'XTB' : 'IG Markets'} vengono eseguiti con modalità FOK (Fill-Or-Kill) per prevenire slittamenti improvvisi di prezzo.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
