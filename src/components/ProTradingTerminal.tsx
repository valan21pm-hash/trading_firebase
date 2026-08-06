import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, Shield, Zap, RefreshCw, 
  Layers, BarChart3, Globe, Cpu, Clock, AlertTriangle, 
  Sliders, Search, ArrowUpRight, ArrowDownRight, Terminal, 
  Maximize2, PieChart, DollarSign, Eye, Compass, X, Play, Square, Settings, BookOpen, Key, Sparkles, Check, AlertCircle, Upload
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface ProTradingTerminalProps {
  onClose: () => void;
  botStatus: any;
}

const mockChartData = [
  { time: '09:30', price: 182.50, volume: 1200 },
  { time: '10:00', price: 183.10, volume: 2400 },
  { time: '10:30', price: 182.80, volume: 1800 },
  { time: '11:00', price: 184.20, volume: 3200 },
  { time: '11:30', price: 185.05, volume: 4500 },
  { time: '12:00', price: 184.70, volume: 2100 },
  { time: '12:30', price: 186.15, volume: 5100 },
  { time: '13:00', price: 185.90, volume: 2900 },
  { time: '13:30', price: 187.40, volume: 6200 },
  { time: '14:00', price: 187.10, volume: 3800 },
  { time: '14:30', price: 188.50, volume: 7400 },
  { time: '15:00', price: 189.20, volume: 8900 },
];

const mockOrderBook = {
  bids: [
    { price: 189.18, size: 450, total: 450 },
    { price: 189.15, size: 1200, total: 1650 },
    { price: 189.10, size: 850, total: 2500 },
    { price: 189.05, size: 3000, total: 5500 },
    { price: 189.00, size: 5400, total: 10900 },
  ],
  asks: [
    { price: 189.22, size: 320, total: 320 },
    { price: 189.25, size: 980, total: 1300 },
    { price: 189.30, size: 2100, total: 3400 },
    { price: 189.35, size: 4100, total: 7500 },
    { price: 189.40, size: 6200, total: 13700 },
  ]
};

const topAssets = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 189.20, change: '+1.84%', positive: true, volume: '48.2M' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 124.60, change: '+4.12%', positive: true, volume: '92.5M' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 215.40, change: '-1.25%', positive: false, volume: '34.1M' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 425.80, change: '+0.75%', positive: true, volume: '22.8M' },
  { symbol: 'SPY', name: 'S&P 500 ETF', price: 542.10, change: '+0.45%', positive: true, volume: '61.4M' },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', price: 468.30, change: '+0.92%', positive: true, volume: '41.9M' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.90, change: '-0.35%', positive: false, volume: '29.3M' },
  { symbol: 'BTC', name: 'Bitcoin USD', price: 61420.00, change: '+3.45%', positive: true, volume: '1.2B' },
];

export function ProTradingTerminal({ onClose, botStatus }: ProTradingTerminalProps) {
  const [activeTab, setActiveTab] = useState<'terminal' | 'depth' | 'ai' | 'analytics' | 'news' | 'debrief' | 'api' | 'settings'>('terminal');
  const [selectedAsset, setSelectedAsset] = useState(topAssets[0]);
  const [timeframe, setTimeframe] = useState('1D');
  const [tickerTime, setTickerTime] = useState(new Date().toLocaleTimeString());
  
  // Controls state (isolated UI mirror)
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>('paper');
  const [isBotRunning, setIsBotRunning] = useState<boolean>(botStatus?.paper?.isRunning || false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiSecretInput, setApiSecretInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTickerTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F17] text-slate-100 flex flex-col font-sans select-none overflow-hidden animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-2xl font-mono text-xs flex items-center gap-2 border border-indigo-400">
          <Sparkles className="w-4 h-4 text-amber-300" />
          {toastMessage}
        </div>
      )}

      {/* Top Ticker Marquee / Bar */}
      <div className="bg-[#131B2E] border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            BLOOMBERG & TRADINGVIEW PRO TERMINAL v4.2 (PRO MODE)
          </div>
          {topAssets.slice(0, 5).map(ast => (
            <div key={ast.symbol} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-400 font-semibold">{ast.symbol}</span>
              <span className="text-slate-200">${ast.price.toFixed(2)}</span>
              <span className={ast.positive ? 'text-emerald-400' : 'text-rose-400'}>{ast.change}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 text-slate-400 shrink-0">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {tickerTime} UTC</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] font-bold">LIVE FEED</span>
        </div>
      </div>

      {/* Main Terminal Header with Panic, Loop, Paper/Live controls */}
      <div className="bg-[#0E1526] border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                {selectedAsset.symbol} <span className="text-xs font-normal text-slate-400 font-mono">({selectedAsset.name})</span>
              </h1>
              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                <span>Vol: <strong className="text-slate-200">{selectedAsset.volume}</strong></span>
                <span>Bid/Ask: <strong className="text-slate-200">0.02</strong></span>
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800 mx-2 hidden lg:block" />

          {/* Paper / Live Toggle */}
          <div className="flex items-center bg-[#131B2E] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => { setTradingMode('paper'); showToast('Modalità simulazione (Paper) attivata'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono ${tradingMode === 'paper' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Paper
            </button>
            <button
              onClick={() => { setTradingMode('live'); showToast('Modalità reale (Live) attivata'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer font-mono ${tradingMode === 'live' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Live
            </button>
          </div>

          {/* Loop Start / Stop Control */}
          <button
            onClick={() => {
              setIsBotRunning(!isBotRunning);
              showToast(isBotRunning ? 'Loop Bot fermato con successo' : 'Loop Bot avviato con successo');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer font-mono ${
              isBotRunning
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {isBotRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {isBotRunning ? 'Ferma Loop Bot' : 'Avvia Loop Bot'}
          </button>

          {/* Panic Button */}
          <button
            onClick={() => setShowPanicModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer font-mono border border-rose-500"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            PANIC BUTTON
          </button>
        </div>

        {/* Exit Pro Terminal Button */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition shadow-md border border-slate-700 cursor-pointer"
        >
          <X className="w-4 h-4 text-rose-400" />
          Torna alla Dashboard Classica
        </button>
      </div>

      {/* Sub Navbar Tabs */}
      <div className="bg-[#10172A] border-b border-slate-800 px-6 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar font-mono text-xs">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'terminal' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Grafico & Mercati
        </button>
        <button
          onClick={() => setActiveTab('depth')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'depth' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Layers className="w-3.5 h-3.5" /> Market Depth
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'ai' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Cpu className="w-3.5 h-3.5" /> AI Neural Matrix
        </button>
        <button
          onClick={() => setActiveTab('debrief')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'debrief' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Debriefing & Regole
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'api' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Key className="w-3.5 h-3.5" /> Importazione API & Backup
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Settings className="w-3.5 h-3.5" /> Parametri Bot & LLM
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Shield className="w-3.5 h-3.5" /> Telemetria & Rischio
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'news' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Globe className="w-3.5 h-3.5" /> Notizie & Wire
        </button>
      </div>

      {/* Terminal Workspace Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 overflow-y-auto bg-[#0B0F17]">
        
        {/* Left Column: Watchlist & Asset Selector */}
        <div className="lg:col-span-1 bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" /> Watchlist Mercati ({tradingMode.toUpperCase()})
            </span>
            <span className="text-[10px] font-mono text-slate-500">{topAssets.length} asset</span>
          </div>

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca simbolo (es. AAPL)..."
              className="w-full bg-[#090D16] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {topAssets.map(ast => (
              <div
                key={ast.symbol}
                onClick={() => setSelectedAsset(ast)}
                className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between font-mono ${
                  selectedAsset.symbol === ast.symbol
                    ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md'
                    : 'bg-[#0E1526] border-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    {ast.symbol}
                    {ast.positive ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[110px]">{ast.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-200">${ast.price.toFixed(2)}</div>
                  <div className={`text-[10px] font-semibold ${ast.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ast.change}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center/Main Column: Active Tab Content */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {activeTab === 'terminal' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 min-h-[420px]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white font-mono">{selectedAsset.symbol} / USD</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-800">REALTIME</span>
                </div>
                <div className="flex items-center gap-1 bg-[#0E1526] p-1 rounded-lg border border-slate-800 font-mono text-xs">
                  {['1H', '4H', '1D', '1W', '1M'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2 py-0.5 rounded transition ${timeframe === tf ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full min-h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockChartData}>
                    <defs>
                      <linearGradient id="proChartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                    <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#090D16', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="price" stroke="#818cf8" strokeWidth={2.5} fillOpacity={1} fill="url(#proChartGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'depth' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1">
              <h2 className="text-sm font-bold font-mono text-slate-200 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" /> Analisi Profondità del Libro Ordini (Level 2)
              </h2>
              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-emerald-400 font-bold mb-2 pb-1 border-b border-emerald-900/50">ACQUISTI (BIDS)</div>
                  <div className="space-y-1.5">
                    {mockOrderBook.bids.map((b, i) => (
                      <div key={i} className="flex justify-between text-slate-300">
                        <span className="text-emerald-400 font-bold">${b.price.toFixed(2)}</span>
                        <span>{b.size}</span>
                        <span className="text-slate-500">{b.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-rose-400 font-bold mb-2 pb-1 border-b border-rose-900/50">VENDITE (ASKS)</div>
                  <div className="space-y-1.5">
                    {mockOrderBook.asks.map((a, i) => (
                      <div key={i} className="flex justify-between text-slate-300">
                        <span className="text-rose-400 font-bold">${a.price.toFixed(2)}</span>
                        <span>{a.size}</span>
                        <span className="text-slate-500">{a.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" /> AI Sentiment Matrix & Neural Prediction
              </h2>
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Confidence Score:</span>
                  <span className="text-emerald-400 font-bold text-sm">89.4% (Bullish Momentum)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full w-[89%]" />
                </div>
                <p className="text-slate-300 leading-relaxed font-sans pt-2">
                  L'algoritmo neurale rileva forti segnali di accumulo istituzionale su {selectedAsset.symbol} con correlazione macroeconomica positiva sui tassi d'interesse FED e volumi di scambio in aumento del +24%.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'debrief' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" /> Debriefing & Regole di Trading IA
              </h2>
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-3">
                <p className="text-slate-300 font-sans">
                  Qui puoi generare e visualizzare il report analitico avanzato basato sulle performance storiche e sui log delle decisioni del bot.
                </p>
                <button
                  onClick={() => showToast('Generazione debriefing IA avviata con successo')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer shadow-md"
                >
                  Genera Report Debriefing Periodo
                </button>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-4 overflow-y-auto">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" /> Schema Importazione API & Provider LLM (Multi-Model & Alpaca)
              </h2>
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="text-slate-400 text-[11px]">
                  Configura le chiavi API per i diversi provider LLM supportati (Gemini, Mistral, Anthropic, DeepSeek, Groq) e le credenziali Alpaca Paper / Live.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Gemini', 'Mistral', 'Anthropic', 'DeepSeek', 'Groq'].map((provider) => (
                    <div key={provider} className="bg-[#10172A] p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white uppercase">{provider}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px]">CONFIGURATO</span>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">API Key</label>
                        <input
                          type="password"
                          placeholder="************************"
                          className="w-full bg-[#0E1526] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Modello Preferito</label>
                        <input
                          type="text"
                          defaultValue={provider === 'Gemini' ? 'gemini-2.5-pro' : provider === 'Anthropic' ? 'claude-3-5-sonnet' : 'default'}
                          className="w-full bg-[#0E1526] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <h3 className="font-bold text-white text-xs">Credenziali Alpaca Broker API</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Alpaca Paper Key / Secret</label>
                      <input
                        type="password"
                        placeholder="PK... / Secret..."
                        className="w-full bg-[#0E1526] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Alpaca Live Key / Secret</label>
                      <input
                        type="password"
                        placeholder="AK... / Secret..."
                        className="w-full bg-[#0E1526] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-indigo-400" /> Importa Configurazione & Chiavi API da File Sheet
                  </h3>
                  <div className="flex items-center gap-3 bg-[#0E1526] p-3 rounded-xl border border-slate-800">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv, .json"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          showToast(`Sheet "${e.target.files[0].name}" importato con successo!`);
                        }
                      }}
                      className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500">Seleziona un file Sheet (.xlsx, .csv) o JSON di backup per ripristinare credenziali e parametri</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    onClick={() => showToast('Configurazione API e Schema LLM salvati con successo')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer shadow-md"
                  >
                    Salva Configurazione API
                  </button>
                  <button
                    onClick={() => showToast('Backup configurazione esportato su JSON')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition cursor-pointer border border-slate-700"
                  >
                    Esporta Backup JSON
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" /> Parametri Bot, Posizioni, Timeframe & Failover LLM
              </h2>
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-[#10172A] p-3 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block mb-1">Max Posizioni Contemporanee</label>
                    <input
                      type="number"
                      defaultValue={10}
                      className="w-full bg-[#0E1526] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
                    />
                  </div>
                  <div className="bg-[#10172A] p-3 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block mb-1">Timeframe Analisi (min)</label>
                    <input
                      type="number"
                      defaultValue={15}
                      className="w-full bg-[#0E1526] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
                    />
                  </div>
                  <div className="bg-[#10172A] p-3 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block mb-1">Rischio per Operazione (%)</label>
                    <input
                      type="number"
                      defaultValue={2.5}
                      className="w-full bg-[#0E1526] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 font-bold"
                    />
                  </div>
                </div>

                <div className="bg-[#10172A] p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-bold">Failover Automatico Provider LLM</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 text-[10px]">ATTIVO</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Se il provider primario (es. Gemini) fallisce o risponde con errore di rate limit, il sistema passa automaticamente al provider secondario in sequenza (Mistral, Anthropic, DeepSeek, Groq).
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => showToast('Parametri bot e preferenze LLM aggiornati con successo')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer shadow-md"
                  >
                    Salva Parametri Bot
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" /> Telemetria di Rischio e Margini Portafoglio
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Value at Risk (VaR 95%):</div>
                  <div className="text-white font-bold text-sm mt-1">-$142.50</div>
                </div>
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Leverage Effettivo:</div>
                  <div className="text-emerald-400 font-bold text-sm mt-1">1.0x (Cash Secured)</div>
                </div>
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Sharpe Ratio:</div>
                  <div className="text-indigo-400 font-bold text-sm mt-1">2.41</div>
                </div>
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Max Drawdown:</div>
                  <div className="text-rose-400 font-bold text-sm mt-1">-3.12%</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'news' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" /> Ultime Notizie & Wire Finanziari
              </h2>
              <div className="space-y-2">
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>REUTERS • 4 min fa</span>
                    <span className="text-emerald-400 font-bold">IMPULSO POSITIVO</span>
                  </div>
                  <p className="text-slate-200 font-sans font-medium text-xs">
                    I mercati azionari globali registrano nuovi massimi grazie ai dati sull'inflazione USA in linea con le attese degli analisti.
                  </p>
                </div>
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>BLOOMBERG • 18 min fa</span>
                    <span className="text-indigo-400 font-bold">ANALISI TECNICA</span>
                  </div>
                  <p className="text-slate-200 font-sans font-medium text-xs">
                    {selectedAsset.symbol} supera le resistenze chiave di breve periodo con volumi record registrati nel settore tecnologico.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Order Book & Quick Stats */}
        <div className="lg:col-span-1 bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl font-mono">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Book Ordini ({tradingMode.toUpperCase()})
          </span>

          <div className="bg-[#090D16] rounded-xl border border-slate-800 p-3 space-y-3 flex-1 flex flex-col justify-between text-xs">
            <div>
              <div className="text-[10px] text-rose-400 font-bold uppercase mb-1">Vendite (Asks)</div>
              <div className="space-y-1">
                {mockOrderBook.asks.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex justify-between text-slate-400">
                    <span className="text-rose-400 font-bold">${a.price.toFixed(2)}</span>
                    <span>{a.size}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="py-2 my-1 border-y border-slate-800 text-center">
              <span className="text-sm font-bold text-white">${selectedAsset.price.toFixed(2)}</span>
              <span className="text-[10px] text-emerald-400 block">{selectedAsset.change} (Ultimo Prezzo)</span>
            </div>

            <div>
              <div className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Acquisti (Bids)</div>
              <div className="space-y-1">
                {mockOrderBook.bids.slice(0, 4).map((b, i) => (
                  <div key={i} className="flex justify-between text-slate-400">
                    <span className="text-emerald-400 font-bold">${b.price.toFixed(2)}</span>
                    <span>{b.size}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <div className="text-[10px] text-slate-500 mb-1">Stato Bot Collegato</div>
              <div className={`p-2 rounded-lg border text-[11px] font-bold flex items-center justify-between ${isBotRunning ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                <span>{isBotRunning ? 'BOT ATTIVO' : 'BOT FERMO'}</span>
                <span className={`w-2 h-2 rounded-full ${isBotRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Panic Button Confirmation Modal */}
      {showPanicModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#10172A] border border-rose-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
              <h3 className="text-lg font-bold">ATTENZIONE: PANIC LIQUIDATION</h3>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Stai per attivare la procedura di emergenza: chiusura immediata di tutte le posizioni aperte e cancellazione di tutti gli ordini pendenti nella modalità <strong className="text-white uppercase">{tradingMode}</strong>.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowPanicModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  setShowPanicModal(false);
                  showToast('⚠️ PANIC LIQUIDATION ESEGUITA CON SUCCESSO!');
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg"
              >
                Conferma Liquidazione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

