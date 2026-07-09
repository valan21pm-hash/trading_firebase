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
  const activeBroker = 'ig';
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

  // Auto-Trading states
  const [autoStatus, setAutoStatus] = useState<any | null>(null);
  const [openPositions, setOpenPositions] = useState<any[]>([]);

  

  const [closingInstruments, setClosingInstruments] = useState<string[]>([]);
  const [confirmCloseInstrument, setConfirmCloseInstrument] = useState<string | null>(null);
  const [testingConn, setTestingConn] = useState<boolean>(false);
  const [connTestResult, setConnTestResult] = useState<any | null>(null);
  const [loadingAutoStatus, setLoadingAutoStatus] = useState<boolean>(false);
  const [submittingAutoToggle, setSubmittingAutoToggle] = useState<boolean>(false);
  const [triggeringCycle, setTriggeringCycle] = useState<boolean>(false);
  const [activeLogTab, setActiveLogTab] = useState<'system' | 'logic'>('system');
  
  const [editingSettings, setEditingSettings] = useState(false);
  const [draftTP, setDraftTP] = useState<string>('0.10');
  const [draftSL, setDraftSL] = useState<string>('-1.00');
  const [draftRisk, setDraftRisk] = useState<string>('2');
  const [draftTimeframe, setDraftTimeframe] = useState<string>('15');
  const [draftTrailingStop, setDraftTrailingStop] = useState<string>('0');
  const [savingSettings, setSavingSettings] = useState(false);
  
  

  const currentAutoStatus = autoStatus;
  const currentPositions = openPositions;

  useEffect(() => {
    if (currentAutoStatus) {
      setDraftTP(String(currentAutoStatus.defaultTP ?? (0.10)));
      setDraftSL(String(currentAutoStatus.defaultSL ?? (-1.00)));
      setDraftRisk(String(currentAutoStatus.riskPercentage ?? (2)));
      setDraftTimeframe(String(currentAutoStatus.timeframe ?? (15)));
      setDraftTrailingStop(String(currentAutoStatus.trailingStop ?? (0)));
    }
  }, [currentAutoStatus?.defaultTP, currentAutoStatus?.defaultSL, currentAutoStatus?.riskPercentage, currentAutoStatus?.timeframe, currentAutoStatus?.trailingStop, activeBroker]);

  const [wrapLogs, setWrapLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem('ig_wrapLogs');
    return saved !== null ? saved === 'true' : true;
  });
  const [reverseLogs, setReverseLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem('ig_reverseLogs');
    return saved !== null ? saved === 'true' : true;
  });
  const [showTimestamps, setShowTimestamps] = useState<boolean>(() => {
    const saved = localStorage.getItem('ig_showTimestamps');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('ig_wrapLogs', String(wrapLogs));
  }, [wrapLogs]);

  useEffect(() => {
    localStorage.setItem('ig_reverseLogs', String(reverseLogs));
  }, [reverseLogs]);

  useEffect(() => {
    localStorage.setItem('ig_showTimestamps', String(showTimestamps));
  }, [showTimestamps]);

  const fetchAutoStatus = async (broker = activeBroker) => {
    setLoadingAutoStatus(true);
    try {
      const url = `/api/trading/${activeBroker}-status`;
      const res = await fetch(url);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setAutoStatus(data.status); setOpenPositions(data.positions || []);
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
      const url = `/api/trading/${activeBroker}-status`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentAutoStatus.active })
      });
      if (res.ok) {
        const data = await res.json();
        setAutoStatus(prev => prev ? { ...prev, active: data.active } : null);
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
      const url = `/api/trading/${activeBroker}-trigger`;
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

  const handleResetLogs = async () => {
    if (!window.confirm(`Sei sicuro di voler azzerare tutti i log di ${activeBroker.toUpperCase()}?`)) return;
    try {
      const url = `/api/trading/${activeBroker}-reset-logs`;
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
    const isXtb = false;
    const isIg = true;
    const isAlpaca = false;
    const limitMsg = isXtb ? '50€' : (isIg ? '30000€' : '100000$');
    if (!window.confirm(`Sei sicuro di voler azzerare il saldo (${limitMsg}) e tutte le posizioni di ${activeBroker.toUpperCase()}?`)) return;
    try {
      const url = `/api/trading/${activeBroker}-reset-balance`;
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

  const handleClosePosition = async (symbol: string) => {
    setClosingInstruments(prev => [...prev, symbol]);
    try {
      const url = `/api/trading/${activeBroker}-close-position`;
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


  const [credentials, setCredentials] = useState<any>({});
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [showCredForm, setShowCredForm] = useState<{ broker: string, env: string } | null>(null);
  const [tempCreds, setTempCreds] = useState<any>({});

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/trading/credentials');
      const data = await res.json();
      if (data.success) {
        // Uniamo le credenziali ricevute dal server con i valori predefiniti forniti dall'utente
        const merged = {
          ig: {
            real: {
              apiKey: '105b853f29b3410a78ca67b9f6212e53fa306602',
              accountId: 'Z6CKEN',
              username: '',
              password: '',
              ...((data.config && data.config.ig && data.config.ig.real) || {})
            },
            demo: {
              apiKey: 'a8d55b956ea4c124366088c0424c6a59d44bb6a3',
              accountId: 'Z6CKEN2',
              username: '',
              password: '',
              ...((data.config && data.config.ig && data.config.ig.demo) || {})
            }
          }
        };
        setCredentials(merged);
      }
    } catch (err) {
      console.error('Error fetching credentials:', err);
    }
  };

  const saveCredentials = async (broker: string, env: string) => {
    try {
      const res = await fetch('/api/trading/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker, env, credentials: tempCreds })
      });
      if (res.ok) {
        setSuccessMessage(`Credenziali ${broker.toUpperCase()} ${env.toUpperCase()} salvate con successo!`);
        setShowCredForm(null);
        fetchCredentials();
      }
    } catch (err) {
      setErrorMessage('Errore salvataggio credenziali.');
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  // Available instruments
  const instruments = useMemo(() => {
    return [
      { value: 'EUR_USD', label: 'EUR/USD (Euro / Dollaro US)' },
      { value: 'GBP_USD', label: 'GBP/USD (Sterlina / Dollaro US)' },
      { value: 'USD_JPY', label: 'USD/JPY (Dollaro US / Yen Giapponese)' },
      { value: 'AUD_USD', label: 'AUD/USD (Dollaro Australiano / Dollaro US)' },
      { value: 'EUR_GBP', label: 'EUR/GBP (Euro / Sterlina)' },
    ];
  }, []);

  useEffect(() => {
    // Reset selection when broker changes
    setSelectedInstrument('EUR_USD');
  }, [activeBroker]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const url = `/api/trading/${activeBroker}-settings`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultTP: parseFloat(draftTP) || 0.10,
          defaultSL: parseFloat(draftSL) || -1.00,
          riskPercentage: parseFloat(draftRisk) || 2,
          timeframe: parseInt(draftTimeframe) || 15,
          trailingStop: parseFloat(draftTrailingStop) || 0
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
    setConnTestResult(null);
    try {
      const mode = showCredForm?.env || 'demo';
      const res = await fetch('/api/trading/ig-test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credentials: tempCreds,
          mode: mode
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnTestResult({
          success: true,
          message: data.message,
          geminiStatus: data.geminiStatus
        });
      } else {
        throw new Error(data.error || 'Errore sconosciuto');
      }
    } catch (err: any) {
      setConnTestResult({
        success: false,
        message: err.message || 'Errore durante la connessione'
      });
    } finally {
      setTestingConn(false);
    }
  };

  const fetchAccount = async (broker = activeBroker) => {
    setLoadingAccount(true);
    try {
      const url = `/api/trading/${broker}-account`;
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
      const url = `/api/trading/${broker}-analysis/${instrument}`;
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
      const url = `/api/trading/${activeBroker}-order`;
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

      {/* Broker Switcher removed */}

      {/* SEZIONI CONTO REAL E DEMO */}
      <div className="flex flex-col gap-8">
        {/* SEZIONE CONTO REAL */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5" />
              <h3 className="font-bold uppercase tracking-wider text-sm">Conto Reale IG</h3>
            </div>
            <button 
              onClick={() => {
                setTempCreds(credentials[activeBroker]?.real || {});
                setShowCredForm({ broker: activeBroker, env: 'real' });
              }}
              className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg backdrop-blur-md transition border-none cursor-pointer"
            >
              GESTISCI CREDENZIALI
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Account Info Column */}
              <div className="md:col-span-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Bilancio</p>
                    <p className="text-xl font-bold text-slate-900 font-mono">0.00 EUR</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">NAV</p>
                    <p className="text-xl font-bold text-indigo-600 font-mono">0.00 EUR</p>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">ID Conto</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{credentials[activeBroker]?.real?.accountId || 'Non configurato'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Stato</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-600">Disconnesso</span>
                  </div>
                </div>

                {showCredForm?.broker === activeBroker && showCredForm?.env === 'real' && (
                  <div className="bg-slate-900 p-5 rounded-2xl shadow-xl space-y-4 animate-in fade-in zoom-in-95">
                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase">Configurazione Real IG</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Seleziona Conto Reale Preconfigurato</label>
                        <select 
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 outline-none mb-2 cursor-pointer"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'custom') {
                              setTempCreds({ apiKey: '', username: '', password: '', accountId: '' });
                            } else if (val === 'Z6CKEN') {
                              setTempCreds({
                                apiKey: '105b853f29b3410a78ca67b9f6212e53fa306602',
                                accountId: 'Z6CKEN',
                                username: tempCreds.username || '',
                                password: tempCreds.password || ''
                              });
                            }
                          }}
                          value={tempCreds.accountId === 'Z6CKEN' && tempCreds.apiKey === '105b853f29b3410a78ca67b9f6212e53fa306602' ? 'Z6CKEN' : 'custom'}
                        >
                          <option value="custom">-- Personalizzato / Inserimento Manuale --</option>
                          <option value="Z6CKEN">Z6CKEN (Chiave API: 105b853f29...)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Chiave API (Real)</label>
                        <input 
                          type="text" 
                          placeholder="Inserisci la Chiave API Real..."
                          value={tempCreds.apiKey || ''} 
                          onChange={(e) => setTempCreds({ ...tempCreds, apiKey: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Nome Utente IG</label>
                        <input 
                          type="text" 
                          placeholder="Il tuo username di login..."
                          value={tempCreds.username || ''} 
                          onChange={(e) => setTempCreds({ ...tempCreds, username: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Password IG</label>
                        <input 
                          type="password" 
                          placeholder="La tua password..."
                          value={tempCreds.password || ''} 
                          onChange={(e) => setTempCreds({ ...tempCreds, password: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">ID Conto (Opzionale)</label>
                        <input 
                          type="text" 
                          placeholder="Es. XY123..."
                          value={tempCreds.accountId || ''} 
                          onChange={(e) => setTempCreds({ ...tempCreds, accountId: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                        />
                      </div>
                      {connTestResult && (
                        <div className={`p-3 rounded-lg text-xs font-sans space-y-2 ${connTestResult.success ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-200' : 'bg-rose-950/40 border border-rose-800 text-rose-200'}`}>
                          <div className="flex items-start gap-2">
                            {connTestResult.success ? <CheckCircle2 size={14} className="mt-0.5 text-emerald-400 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 text-rose-400 shrink-0" />}
                            <div>
                              <p className="font-semibold">{connTestResult.success ? 'Connessione Broker OK' : 'Connessione Fallita'}</p>
                              <p className="opacity-90 leading-relaxed text-[11px]">{connTestResult.message}</p>
                            </div>
                          </div>
                          {connTestResult.geminiStatus && (
                            <div className={`p-2 rounded border text-[11px] leading-relaxed ${connTestResult.geminiStatus.success ? 'bg-indigo-950/20 border-indigo-800/40 text-indigo-300' : 'bg-amber-950/30 border-amber-800/40 text-amber-300'}`}>
                              <div className="flex items-start gap-1.5">
                                <Sparkles size={12} className={`mt-0.5 shrink-0 ${connTestResult.geminiStatus.success ? 'text-indigo-400' : 'text-amber-400'}`} />
                                <p className="opacity-90">{connTestResult.geminiStatus.message}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-col gap-2 pt-2">
                        <button 
                          onClick={handleTestConnection} 
                          disabled={testingConn || !tempCreds.username || !tempCreds.password} 
                          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2 rounded-lg text-xs transition cursor-pointer border-none flex items-center justify-center gap-1.5"
                        >
                          {testingConn ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          {testingConn ? 'TEST IN CORSO...' : 'TESTA CONNESSIONE'}
                        </button>
                        <div className="flex gap-2">
                          <button onClick={() => saveCredentials(activeBroker, 'real')} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg text-xs hover:bg-emerald-700 transition cursor-pointer border-none">SALVA</button>
                          <button onClick={() => { setShowCredForm(null); setConnTestResult(null); }} className="flex-1 bg-slate-800 text-slate-400 font-bold py-2 rounded-lg text-xs hover:bg-slate-700 transition cursor-pointer border-none">ANNULLA</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bot Controls & Positions Column */}
              <div className="md:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Automazione Reale</h4>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-3 h-3 rounded-full ${false ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <span className="text-xs font-bold text-slate-700">{false ? 'BOT ATTIVO' : 'BOT DISATTIVATO'}</span>
                      </div>
                    </div>
                    <button className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition border-none cursor-pointer">
                      AVVIA TRADING REALE
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">P&L Giornaliero</h4>
                      <p className="text-xl font-bold text-slate-800 font-mono">0.00 EUR</p>
                    </div>
                    <div className="h-10 bg-slate-200/50 rounded-lg mt-2"></div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    Posizioni Reali Aperte
                  </h4>
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-8 flex flex-col items-center justify-center text-slate-400">
                    <Activity className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-xs italic">Nessuna posizione reale attiva.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SEZIONE CONTO DEMO */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-amber-500 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Activity className="w-5 h-5" />
              <h3 className="font-bold uppercase tracking-wider text-sm">Conto Demo IG</h3>
            </div>
            <button 
              onClick={() => {
                setTempCreds(credentials[activeBroker]?.demo || {});
                setShowCredForm({ broker: activeBroker, env: 'demo' });
              }}
              className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg backdrop-blur-md transition border-none cursor-pointer"
            >
              GESTISCI CREDENZIALI
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Account Info Column */}
              <div className="md:col-span-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Bilancio</p>
                    <p className="text-xl font-bold text-slate-900 font-mono">{parseFloat(account?.balance || '0').toFixed(2)} EUR</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">NAV</p>
                    <p className="text-xl font-bold text-indigo-600 font-mono">{parseFloat(account?.NAV || '0').toFixed(2)} EUR</p>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">ID Conto</span>
                    <span className="text-xs font-bold text-slate-700 font-mono">{account?.id || credentials[activeBroker]?.demo?.accountId || 'DEMO_ACC'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Stato</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700">Simulazione</span>
                  </div>
                </div>

                {showCredForm?.broker === activeBroker && showCredForm?.env === 'demo' && (
                  <div className="bg-slate-900 p-5 rounded-2xl shadow-xl space-y-4 animate-in fade-in zoom-in-95">
                    <h4 className="text-[10px] font-bold text-amber-400 uppercase">Configurazione Demo IG</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Seleziona Conto Demo Preconfigurato</label>
                        <select 
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500 outline-none mb-2 cursor-pointer"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'custom') {
                              setTempCreds({ apiKey: '', username: '', password: '', accountId: '' });
                            } else if (val === 'Z6CKEN2') {
                              setTempCreds({
                                apiKey: 'a8d55b956ea4c124366088c0424c6a59d44bb6a3',
                                accountId: 'Z6CKEN2',
                                username: tempCreds.username || '',
                                password: tempCreds.password || ''
                              });
                            } else if (val === 'Z6CKEO') {
                              setTempCreds({
                                apiKey: 'a9ce4121b0e9ee3153111e44a4152dfb141d1ea8',
                                accountId: 'Z6CKEO',
                                username: tempCreds.username || '',
                                password: tempCreds.password || ''
                              });
                            }
                          }}
                          value={
                            tempCreds.accountId === 'Z6CKEN2' && tempCreds.apiKey === 'a8d55b956ea4c124366088c0424c6a59d44bb6a3' ? 'Z6CKEN2' : 
                            tempCreds.accountId === 'Z6CKEO' && tempCreds.apiKey === 'a9ce4121b0e9ee3153111e44a4152dfb141d1ea8' ? 'Z6CKEO' : 'custom'
                          }
                        >
                          <option value="custom">-- Personalizzato / Inserimento Manuale --</option>
                          <option value="Z6CKEN2">Z6CKEN2 (Chiave API: a8d55b956e...)</option>
                          <option value="Z6CKEO">Z6CKEO (Chiave API: a9ce4121b0...)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Chiave API (Demo)</label>
                        <input 
                          type="text" 
                          placeholder="Inserisci la Chiave API Demo..."
                          value={tempCreds.apiKey || ''} 
                          onChange={(e) => setTempCreds({ ...tempCreds, apiKey: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Nome Utente IG</label>
                        <input 
                          type="text" 
                          placeholder="Il tuo username di login..."
                          value={tempCreds.username || ''} 
                          onChange={(e) => setTempCreds({ ...tempCreds, username: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Password IG</label>
                        <input 
                          type="password" 
                          placeholder="La tua password..."
                          value={tempCreds.password || ''} 
                          onChange={(e) => setTempCreds({ ...tempCreds, password: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">ID Conto (Opzionale)</label>
                        <input 
                          type="text" 
                          placeholder="Es. XY123..."
                          value={tempCreds.accountId || ''} 
                          onChange={(e) => setTempCreds({ ...tempCreds, accountId: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500 outline-none"
                        />
                      </div>
                      {connTestResult && (
                        <div className={`p-3 rounded-lg text-xs font-sans space-y-2 ${connTestResult.success ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-200' : 'bg-rose-950/40 border border-rose-800 text-rose-200'}`}>
                          <div className="flex items-start gap-2">
                            {connTestResult.success ? <CheckCircle2 size={14} className="mt-0.5 text-emerald-400 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 text-rose-400 shrink-0" />}
                            <div>
                              <p className="font-semibold">{connTestResult.success ? 'Connessione Broker OK' : 'Connessione Fallita'}</p>
                              <p className="opacity-90 leading-relaxed text-[11px]">{connTestResult.message}</p>
                            </div>
                          </div>
                          {connTestResult.geminiStatus && (
                            <div className={`p-2 rounded border text-[11px] leading-relaxed ${connTestResult.geminiStatus.success ? 'bg-indigo-950/20 border-indigo-800/40 text-indigo-300' : 'bg-amber-950/30 border-amber-800/40 text-amber-300'}`}>
                              <div className="flex items-start gap-1.5">
                                <Sparkles size={12} className={`mt-0.5 shrink-0 ${connTestResult.geminiStatus.success ? 'text-indigo-400' : 'text-amber-400'}`} />
                                <p className="opacity-90">{connTestResult.geminiStatus.message}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-col gap-2 pt-2">
                        <button 
                          onClick={handleTestConnection} 
                          disabled={testingConn || !tempCreds.username || !tempCreds.password} 
                          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2 rounded-lg text-xs transition cursor-pointer border-none flex items-center justify-center gap-1.5"
                        >
                          {testingConn ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          {testingConn ? 'TEST IN CORSO...' : 'TESTA CONNESSIONE'}
                        </button>
                        <div className="flex gap-2">
                          <button onClick={() => saveCredentials(activeBroker, 'demo')} className="flex-1 bg-amber-600 text-white font-bold py-2 rounded-lg text-xs hover:bg-amber-700 transition cursor-pointer border-none">SALVA</button>
                          <button onClick={() => { setShowCredForm(null); setConnTestResult(null); }} className="flex-1 bg-slate-800 text-slate-400 font-bold py-2 rounded-lg text-xs hover:bg-slate-700 transition cursor-pointer border-none">ANNULLA</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bot Controls & Positions Column */}
              <div className="md:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase">Automazione Demo</h4>
                        <button onClick={() => setEditingSettings(!editingSettings)} className="text-[10px] text-indigo-600 font-bold uppercase hover:underline border-none bg-transparent cursor-pointer">
                          Impostazioni
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-3 h-3 rounded-full ${currentAutoStatus?.active ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <span className="text-xs font-bold text-slate-700">{currentAutoStatus?.active ? 'BOT ATTIVO' : 'BOT DISATTIVATO'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleToggleAutoTrading}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition border-none cursor-pointer ${
                          currentAutoStatus?.active ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-amber-600 text-white hover:bg-amber-700'
                        }`}
                      >
                        {currentAutoStatus?.active ? 'FERMA' : 'AVVIA'}
                      </button>
                      <button 
                        onClick={handleTriggerAutoTrading}
                        disabled={triggeringCycle}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition border-none cursor-pointer disabled:opacity-50"
                        title="Esegui ciclo ora"
                      >
                        <RefreshCw className={`w-4 h-4 ${triggeringCycle ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 md:col-span-2 shadow-sm">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                          <Bot className="w-4 h-4 text-indigo-600" />
                          Parametri Operativi Auto-Trading
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Definisci le soglie di rischio e temporali per la chiusura automatica delle posizioni</p>
                      </div>
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                        Attivi su {activeBroker.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Timeframe (Minuti)</label>
                        <select value={draftTimeframe} onChange={e => setDraftTimeframe(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500">
                          <option value="5">5 Minuti</option>
                          <option value="10">10 Minuti</option>
                          <option value="15">15 Minuti</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Take Profit (€)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">€</span>
                          <input type="number" step="0.01" value={draftTP} onChange={e => setDraftTP(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Stop Loss (€)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">€</span>
                          <input type="number" step="0.01" value={draftSL} onChange={e => setDraftSL(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trailing Stop (€)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">€</span>
                          <input type="number" step="0.01" value={draftTrailingStop} onChange={e => setDraftTrailingStop(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500" placeholder="0 = Off" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rischio % per Operazione</label>
                        <input type="number" step="0.1" value={draftRisk} onChange={e => setDraftRisk(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={handleSaveSettings} disabled={savingSettings} className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition border-none cursor-pointer disabled:opacity-50 shadow-sm flex items-center gap-1.5">
                        {savingSettings ? 'Salvataggio...' : 'Salva Parametri'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase">P&L Storico Demo</h4>
                      <span className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">Sandbox</span>
                    </div>
                    <div className="h-16 w-full">
                      {currentAutoStatus?.dailyPnL && currentAutoStatus.dailyPnL.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={currentAutoStatus.dailyPnL}>
                            <Area type="monotone" dataKey="realized" stroke="#f59e0b" fill="#fef3c7" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full bg-slate-200/30 rounded-lg flex items-center justify-center">
                          <BarChart2 className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    Posizioni Demo Aperte
                  </h4>
                  <div className="space-y-2">
                    {currentPositions && currentPositions.length > 0 ? (
                      currentPositions.map((pos: any, i: number) => (
                        <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-900">{pos.symbol}</span>
                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold ${pos.side === 'buy' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {pos.side.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-slate-600">{parseFloat(pos.qty).toFixed(2)}</span>
                            <span className={`font-mono font-bold ${parseFloat(pos.unrealized_pl) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {parseFloat(pos.unrealized_pl).toFixed(2)}
                            </span>
                            <button 
                              onClick={() => handleClosePosition(pos.symbol)}
                              className="text-slate-400 hover:text-rose-600 transition p-1"
                            >
                              <TrendingDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 flex flex-col items-center justify-center text-slate-400">
                        <p className="text-[11px] italic">Nessuna posizione demo attiva.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selezione Strumento */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Strumento di Trading</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-800`}>
            IG FX
          </span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
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

          <div className="flex items-baseline gap-2 ml-auto">
            <span className="text-xs text-slate-400 font-medium">Prezzo Ultimo:</span>
            <span className="text-xl font-bold text-slate-900 font-mono">
              {currentPrice ? currentPrice.toFixed(5) : '...'}
            </span>
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
                onClick={handleResetLogs}
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
                    if (log.includes('[Errore]')  || log.includes('Errore Critico')) {
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
              Gli ordini di mercato {'IG Markets'} vengono eseguiti con modalità FOK (Fill-Or-Kill) per prevenire slittamenti improvvisi di prezzo.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
