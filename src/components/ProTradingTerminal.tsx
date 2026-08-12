import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, Shield, Zap, RefreshCw, 
  Layers, BarChart3, Globe, Cpu, Clock, AlertTriangle, 
  Search, ArrowUpRight, ArrowDownRight,
  Maximize2, PieChart, DollarSign, Eye, X, Play, Square, Settings, BookOpen, Key, Sparkles, Check, AlertCircle, Upload, Download,
  Wallet, Percent, ArrowUp, ArrowDown, Briefcase, FileText, Trash2, Filter, Save, FileUp, FolderArchive, Plus, ShoppingCart
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { LLMSettings } from './LLMSettings';
import { GeminiSignalsTicker } from './GeminiSignalsTicker';
import { AlpacaMonitorModule } from './AlpacaMonitorModule';
import { SentimentBadge } from './SentimentBadge';
import { ForceBuyModal } from './ForceBuyModal';
import { getAccessToken } from '../auth';
import { GeminiSignal } from '../types';

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

const defaultTopAssets = [
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
  const [activeTab, setActiveTab] = useState<'terminal' | 'positions' | 'depth' | 'ai' | 'analytics' | 'news' | 'debrief' | 'api' | 'settings' | 'monitor'>('terminal');
  const [topAssets, setTopAssets] = useState(defaultTopAssets);
  const [selectedAsset, setSelectedAsset] = useState(defaultTopAssets[0]);
  const [timeframe, setTimeframe] = useState('1D');
  const [tickerTime, setTickerTime] = useState(new Date().toLocaleTimeString());
  
  // Realtime backend status synced directly with main dashboard
  const [currentStatus, setCurrentStatus] = useState<any>(botStatus);
  const [closingSymbols, setClosingSymbols] = useState<string[]>([]);

  // Trading Mode state ('paper' or 'live') synced with backend
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>(
    botStatus?.tradingMode === 'live' ? 'live' : 'paper'
  );

  // Settings inputs state (synced with currentStatus)
  const [maxPosInput, setMaxPosInput] = useState<number>(botStatus?.maxConcurrentPositions || 10);
  const [tfInput, setTfInput] = useState<number>(botStatus?.timeframe || 15);
  const [riskInput, setRiskInput] = useState<number>(botStatus?.riskPercentage || 95);

  // Loading and UI states
  const [savingSettings, setSavingSettings] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicLoading, setPanicLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Gemini Signals & Force Buy Modal States
  const [geminiSignals, setGeminiSignals] = useState<GeminiSignal[]>(botStatus?.geminiSignals || []);
  const [forceBuyModalOpen, setForceBuyModalOpen] = useState(false);
  const [forceBuySymbol, setForceBuySymbol] = useState('');

  const handleOpenForceBuy = (sym?: string) => {
    setForceBuySymbol(sym || selectedAsset?.symbol || 'AAPL');
    setForceBuyModalOpen(true);
  };

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const res = await fetch('/api/gemini-signals');
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data)) setGeminiSignals(data);
          }
        }
      } catch (e) {}
    };
    fetchSignals();
    const interval = setInterval(fetchSignals, 15000);
    return () => clearInterval(interval);
  }, []);

  // Debriefing State
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefResult, setDebriefResult] = useState<string | null>(null);
  const [rangeStartDate, setRangeStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [rangeEndDate, setRangeEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [rangeLoading, setRangeLoading] = useState(false);

  // AI Feedback & Rules State
  const [ruleInput, setRuleInput] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Operations & Telemetry State
  const [operationsData, setOperationsData] = useState<any>(null);
  const [closedTradesList, setClosedTradesList] = useState<any[]>([]);
  const [closedStartDate, setClosedStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [closedEndDate, setClosedEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [closedSymbolFilter, setClosedSymbolFilter] = useState('');
  const [closedLoading, setClosedLoading] = useState(false);

  // Ticker timer
  useEffect(() => {
    const timer = setInterval(() => setTickerTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch status periodically to keep 100% in sync with backend
  const refreshBackendStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setCurrentStatus(data.status ? data.status : data);
      }
    } catch (err) {
      // silent network catch
    }
  };

  // Fetch Momentum Assets
  const fetchMomentumAssets = async () => {
    try {
      const res = await fetch('/api/momentum-assets');
      if (res.ok) {
        const data = await res.json();
        if (data.assets && data.assets.length > 0) {
          const formatted = data.assets.map((ast: any) => ({
            symbol: ast.symbol,
            name: ast.symbol,
            price: ast.price || 0,
            change: `${ast.changePercent >= 0 ? '+' : ''}${(ast.changePercent || 0).toFixed(2)}%`,
            positive: (ast.changePercent || 0) >= 0,
            volume: ast.volume ? `${(ast.volume / 1000000).toFixed(1)}M` : 'N/D'
          }));
          setTopAssets(formatted);
        }
      }
    } catch (err) {}
  };

  // Auto-connect and sync Google Sheets / Drive credentials on mount
  const autoConnectGoogleSheetsAndDrive = async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // 1. Sync credentials from Google Sheets (SHEET_ID: 1945r1-sCFj45myHM6APOMc9Q1d8He0-WBuWFfcuJfOU)
      await fetch('/api/sheets/sync', { method: 'POST', headers });
      
      // 2. Sync feedback rules from Google Sheets (FEEDBACK_SHEET_ID: 1rFR1J0W9_WyvPfhaGyI1VXj9ABSgJGx8IrjFWgkepqc)
      await fetch('/api/feedback/sync-sheets', { method: 'POST', headers });

      // 3. Trigger Drive log sync
      await fetch('/api/drive/sync-logs', { method: 'POST', headers });

      await refreshBackendStatus();
    } catch (err) {
      console.warn('Auto-sync Google Sheets/Drive skipped:', err);
    }
  };

  useEffect(() => {
    refreshBackendStatus();
    fetchMomentumAssets();
    autoConnectGoogleSheetsAndDrive();
    const interval = setInterval(refreshBackendStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Operations and Closed Positions when mode or filters change
  const fetchOperations = async () => {
    try {
      const res = await fetch(`/api/operations?mode=${tradingMode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setOperationsData(data);
      }
    } catch (err) {}
  };

  const fetchClosedPositions = async () => {
    setClosedLoading(true);
    try {
      const params = new URLSearchParams({
        mode: tradingMode,
        startDate: closedStartDate,
        endDate: closedEndDate,
        symbol: closedSymbolFilter
      });
      const res = await fetch(`/api/closed-positions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setClosedTradesList(data.positions || []);
      }
    } catch (err) {
    } finally {
      setClosedLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
    fetchClosedPositions();
  }, [tradingMode, closedStartDate, closedEndDate, closedSymbolFilter]);

  // Sync inputs when status updates from server
  useEffect(() => {
    if (currentStatus) {
      const statusObj = currentStatus.status ? currentStatus.status : currentStatus;
      if (statusObj.maxConcurrentPositions !== undefined) {
        setMaxPosInput(statusObj.maxConcurrentPositions);
      }
      if (statusObj.timeframe !== undefined) {
        setTfInput(statusObj.timeframe);
      }
      if (statusObj.riskPercentage !== undefined) {
        setRiskInput(statusObj.riskPercentage);
      }
      if (statusObj.tradingMode) {
        setTradingMode(statusObj.tradingMode);
      }
    }
  }, [currentStatus]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const statusObj = currentStatus?.status ? currentStatus.status : currentStatus;

  // Determine if bot is active for the current selected mode
  const isBotActiveInCurrentMode = tradingMode === 'paper' 
    ? !!(statusObj?.paperActive || statusObj?.paper?.isRunning)
    : !!(statusObj?.liveActive || statusObj?.live?.isRunning);

  // 1. TOGGLE BOT HANDLER
  const handleToggleBot = async () => {
    try {
      showToast(`Invio comando modifica stato Bot (${tradingMode.toUpperCase()})...`);
      const res = await fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: tradingMode })
      });

      if (res.ok) {
        const freshData = await res.json();
        const nextStatus = freshData.status ? freshData.status : freshData;
        setCurrentStatus(nextStatus);
        const isActiveNow = tradingMode === 'paper' ? nextStatus.paperActive : nextStatus.liveActive;
        showToast(`✅ Bot (${tradingMode.toUpperCase()}) ora è ${isActiveNow ? 'ATTIVO 🟢' : 'FERMO 🔴'}`);
      } else {
        showToast('❌ Impossibile modificare lo stato del bot dal server.');
      }
    } catch (err: any) {
      showToast(`❌ Errore di connessione: ${err.message}`);
    }
  };

  // 2. SWITCH TRADING MODE HANDLER
  const handleSwitchMode = async (mode: 'paper' | 'live') => {
    setTradingMode(mode);
    try {
      await fetch('/api/set-trading-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      await refreshBackendStatus();
      showToast(`Modalità di visualizzazione impostata su: ${mode.toUpperCase()}`);
    } catch (err) {
      showToast(`Passato a conto: ${mode.toUpperCase()}`);
    }
  };

  // 3. SAVE BOT SETTINGS HANDLER
  const handleSaveBotSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/trading/alpaca-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxConcurrentPositions: Number(maxPosInput),
          timeframe: Number(tfInput),
          riskPercentage: Number(riskInput)
        })
      });

      if (res.ok) {
        showToast('✅ Parametri del bot salvati e sincronizzati sul backend!');
        await refreshBackendStatus();
      } else {
        showToast('❌ Errore nel salvataggio dei parametri del bot');
      }
    } catch (err: any) {
      showToast(`❌ Errore: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  // 4. POSITION STRATEGY UPDATE HANDLER
  const handleUpdateStrategy = async (symbol: string, strategy: 'Prudente' | 'Conservativa' | 'Aggressiva') => {
    try {
      showToast(`Aggiornamento strategia per ${symbol} a ${strategy}...`);
      const response = await fetch('/api/trading/position-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: tradingMode, symbol, strategy })
      });
      if (response.ok) {
        showToast(`✅ Strategia ${symbol} impostata su ${strategy}`);
        await refreshBackendStatus();
      } else {
        showToast(`❌ Errore impostazione strategia ${symbol}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore di rete: ${err.message}`);
    }
  };

  // 5. CLOSE POSITION HANDLER
  const handleClosePosition = async (symbol: string) => {
    try {
      setClosingSymbols(prev => [...prev, symbol]);
      showToast(`Invio ordine di chiusura per ${symbol}...`);
      
      const res = await fetch('/api/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: tradingMode, symbol })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✅ Posizione ${symbol} chiusa con successo!`);
        await refreshBackendStatus();
      } else {
        showToast(`❌ Errore chiusura ${symbol}: ${data.message || 'Impossibile completare l\'ordine'}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore di rete: ${err.message}`);
    } finally {
      setClosingSymbols(prev => prev.filter(s => s !== symbol));
    }
  };

  // 6. PANIC LIQUIDATE HANDLER
  const handlePanicLiquidate = async () => {
    setPanicLoading(true);
    try {
      const res = await fetch('/api/panic-liquidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('🚨 PANIC BUTTON ESEGUITO: Tutte le posizioni chiuse e Bot arrestato!');
        await refreshBackendStatus();
      } else {
        showToast(`❌ Errore liquidazione di emergenza: ${data.message || 'Errore del server'}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore di rete: ${err.message}`);
    } finally {
      setPanicLoading(false);
      setShowPanicModal(false);
    }
  };

  // 7. DAILY & RANGE DEBRIEF GENERATION HANDLERS
  const handleGenerateDebrief = async () => {
    setDebriefLoading(true);
    try {
      showToast('Generazione Daily Debrief AI in corso...');
      const res = await fetch('/api/generate-daily-debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.debrief) {
          setDebriefResult(data.debrief);
          showToast('✅ Debrief Giornaliero generato con successo!');
          await refreshBackendStatus();
        } else {
          showToast(`❌ Errore: ${data.error || 'Nessun debrief ricevuto'}`);
        }
      }
    } catch (err: any) {
      showToast(`❌ Errore: ${err.message}`);
    } finally {
      setDebriefLoading(false);
    }
  };

  const handleGenerateRangeDebrief = async () => {
    setRangeLoading(true);
    try {
      showToast(`Generazione Debrief di Periodo (${rangeStartDate} - ${rangeEndDate})...`);
      const res = await fetch('/api/generate-range-debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: rangeStartDate,
          endDate: rangeEndDate,
          mode: tradingMode
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDebriefResult(data.debrief);
          showToast('✅ Report analitico di periodo generato con successo!');
        } else {
          showToast(`❌ Errore: ${data.error || 'Impossibile generare report'}`);
        }
      }
    } catch (err: any) {
      showToast(`❌ Errore: ${err.message}`);
    } finally {
      setRangeLoading(false);
    }
  };

  const handleDownloadCustomReport = () => {
    window.location.href = `/api/report/download?startDate=${rangeStartDate}&endDate=${rangeEndDate}`;
    showToast('Download report TXT avviato');
  };

  const exportDebriefPDF = () => {
    if (!debriefResult) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Debriefing Analitico IA - Trading Terminal Pro', 14, 20);
    doc.setFontSize(10);
    doc.text(`Data Generazione: ${new Date().toLocaleString('it-IT')}`, 14, 28);
    doc.text(`Modalità: ${tradingMode.toUpperCase()}`, 14, 34);

    const splitText = doc.splitTextToSize(debriefResult, 180);
    let y = 44;
    for (let i = 0; i < splitText.length; i++) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(splitText[i], 14, y);
      y += 6;
    }
    doc.save(`debriefing_ai_${tradingMode}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Documento PDF scaricato con successo');
  };

  // 8. AI FEEDBACK & RULES HANDLERS
  const handleAddRule = async () => {
    if (!ruleInput.trim()) {
      showToast('Inserisci prima una regola correttiva valida!');
      return;
    }
    setFeedbackLoading(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({ rule: ruleInput.trim() })
      });
      if (res.ok) {
        showToast('✅ Nuova regola correttiva salvata ed attiva con successo!');
        setRuleInput('');
        await refreshBackendStatus();
      } else {
        showToast('❌ Errore salvataggio regola');
      }
    } catch (err: any) {
      showToast(`❌ Errore: ${err.message}`);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleSyncFeedbackFromSheets = async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/feedback/sync-sheets', { method: 'POST', headers });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ [Google Sheets] ${data.message}`);
        await refreshBackendStatus();
      } else {
        showToast(`❌ Errore: ${data.error}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore: ${err.message}`);
    }
  };

  const handleExportFeedbackToSheets = async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/feedback/export-sheets', { method: 'POST', headers });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message}`);
      } else {
        showToast(`❌ Errore: ${data.error}`);
      }
    } catch (err: any) {
      showToast(`❌ Errore: ${err.message}`);
    }
  };

  const handleDeleteRule = async (index: number) => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/feedback/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ index })
      });
      if (res.ok) {
        showToast('✅ Regola eliminata con successo!');
        await refreshBackendStatus();
      }
    } catch (err: any) {
      showToast(`❌ Errore: ${err.message}`);
    }
  };

  // 9. JSON BACKUP IMPORT & EXPORT HANDLERS
  const handleImportBackupJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast('Caricamento ed elaborazione del file di backup JSON...');
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });

      if (res.ok) {
        showToast('✅ Backup completo importato e sincronizzato con successo!');
        await refreshBackendStatus();
        await fetchOperations();
      } else {
        const errData = await res.json();
        showToast(`❌ Errore importazione: ${errData.error || 'Errore del server'}`);
      }
    } catch (err: any) {
      showToast(`❌ File JSON non valido: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleExportBackupJSON = () => {
    window.location.href = '/api/backup/export';
    showToast('Download file di backup JSON completo avviato');
  };

  // 10. CSV EXPORT HANDLER
  const exportClosedTradesCSV = () => {
    if (closedTradesList.length === 0) return;
    const headers = ["Simbolo", "Quantità", "Prezzo Ingresso", "Prezzo Uscita", "PnL ($)", "PnL (%)", "Data Chiusura"];
    const rows = closedTradesList.map(t => [
      t.symbol,
      t.qty,
      t.avg_entry_price,
      t.current_price || t.close_price,
      t.unrealized_pl || t.realized_pl,
      t.unrealized_plpc || t.realized_plpc,
      t.closed_at || new Date().toISOString()
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `operazioni_chiuse_${tradingMode}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Esportazione CSV completata');
  };

  // Dynamic Performance Metrics Calculation
  const performanceMetrics = useMemo(() => {
    const activities = operationsData?.activities || [];
    const statusVal = currentStatus?.status ? currentStatus.status : currentStatus;
    const dailyPnL = statusVal?.[tradingMode]?.dailyPnL || [];

    // Aggregate calculations
    let totalWinCount = 0;
    let totalLossCount = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let peakBalance = 0;
    let maxDrawdownAmount = 0;
    let maxDrawdownPercent = 0;

    const pnlHistory: { date: string; balance: number; pnl: number }[] = [];

    dailyPnL.forEach((entry: any) => {
      const bal = entry.balance || 0;
      const pnl = entry.pnl || 0;
      if (bal > peakBalance) peakBalance = bal;
      const drawdown = peakBalance - bal;
      const drawdownPct = peakBalance > 0 ? (drawdown / peakBalance) * 100 : 0;

      if (drawdown > maxDrawdownAmount) maxDrawdownAmount = drawdown;
      if (drawdownPct > maxDrawdownPercent) maxDrawdownPercent = drawdownPct;

      if (pnl > 0) {
        totalProfit += pnl;
        totalWinCount++;
      } else if (pnl < 0) {
        totalLoss += Math.abs(pnl);
        totalLossCount++;
      }

      pnlHistory.push({
        date: entry.date || entry.timestamp || '',
        balance: bal,
        pnl: pnl
      });
    });

    const totalClosed = totalWinCount + totalLossCount;
    const winRate = totalClosed > 0 ? (totalWinCount / totalClosed) * 100 : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99.9 : 0;

    return {
      winRate,
      profitFactor,
      maxDrawdownPercent,
      maxDrawdownAmount,
      pnlHistory,
      totalWinCount,
      totalLossCount,
      totalProfit,
      totalLoss
    };
  }, [operationsData, currentStatus, tradingMode]);

  // Real financial calculations from active account
  const accountData = (currentStatus?.status ? currentStatus.status : currentStatus)?.[tradingMode] || { balance: 0, cash: 0, positions: [], dailyPnL: [] };
  const rawPositions: any[] = accountData.positions || [];
  const positions: any[] = rawPositions.length > 0 ? rawPositions : (operationsData?.positions || []);
  const reasoningLogs: string[] = accountData.reasoningLogs || [];
  const operationalLogs: string[] = accountData.logs || [];
  const activeFeedbackRules: string[] = statusObj?.activeFeedbackRules || statusObj?.rules || statusObj?.userFeedbackRules || [];

  // Helper to extract reliable market value for a position
  const getPosMarketValue = (pos: any): number => {
    if (pos.market_value !== undefined && pos.market_value !== null) {
      const val = parseFloat(pos.market_value);
      if (!isNaN(val) && val !== 0) return val;
    }
    if (pos.currentValue !== undefined && pos.currentValue !== null) {
      const val = parseFloat(pos.currentValue);
      if (!isNaN(val) && val !== 0) return val;
    }
    const qty = parseFloat(pos.qty || '0');
    const price = parseFloat(pos.current_price || pos.avg_entry_price || '0');
    if (!isNaN(qty) && !isNaN(price)) return qty * price;
    return 0;
  };

  // Helper to extract reliable cost basis / margin for a position
  const getPosCostBasis = (pos: any): number => {
    if (pos.cost_basis !== undefined && pos.cost_basis !== null) {
      const val = parseFloat(pos.cost_basis);
      if (!isNaN(val) && val !== 0) return val;
    }
    if (pos.nominalInvestment !== undefined && pos.nominalInvestment !== null) {
      const val = parseFloat(pos.nominalInvestment);
      if (!isNaN(val) && val !== 0) return val;
    }
    const qty = parseFloat(pos.qty || '0');
    const price = parseFloat(pos.avg_entry_price || '0');
    if (!isNaN(qty) && !isNaN(price)) return qty * price;
    return 0;
  };

  // Financial KPIs
  const totalInvested = positions.reduce((acc, pos) => acc + getPosMarketValue(pos), 0);
  const totalMarginUsed = positions.reduce((acc, pos) => acc + getPosCostBasis(pos), 0);

  const initialRefBalance = accountData.dailyPnL && accountData.dailyPnL.length > 0 && accountData.dailyPnL[0]?.balance
    ? accountData.dailyPnL[0].balance
    : (tradingMode === 'paper' ? 100000 : 50);

  const rawBalance = accountData.balance;
  const totalBalance = (rawBalance !== undefined && rawBalance !== null && !isNaN(rawBalance) && rawBalance > 0)
    ? rawBalance
    : ((accountData.cash && accountData.cash > 0) ? accountData.cash + totalInvested : initialRefBalance);
  
  // Exact remaining liquid cash
  const calculatedCash = Math.max(0, totalBalance - totalInvested);
  const cashAvailable = (accountData.cash !== undefined && accountData.cash !== null && !isNaN(accountData.cash) && accountData.cash > 0 && Math.abs(accountData.cash - calculatedCash) < 10)
    ? accountData.cash
    : calculatedCash;

  const dailyPnLVal = positions.reduce((acc, pos) => acc + (parseFloat(pos.unrealized_intraday_pl || '0') || 0), 0);
  const dailyPnLPct = totalBalance > 0 ? (dailyPnLVal / totalBalance) * 100 : 0;

  const totalUnrealizedPL = positions.reduce((acc, pos) => acc + (parseFloat(pos.unrealized_pl || '0') || 0), 0);
  const historicalPnLVal = (totalBalance - initialRefBalance) + totalUnrealizedPL;
  const historicalPnLPct = initialRefBalance > 0 ? (historicalPnLVal / initialRefBalance) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F17] text-slate-100 flex flex-col font-sans select-none overflow-hidden animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-2xl font-mono text-xs flex items-center gap-2 border border-indigo-400">
          <Sparkles className="w-4 h-4 text-amber-300" />
          {toastMessage}
        </div>
      )}

      {/* Panic Modal */}
      {showPanicModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#10172A] border border-rose-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center gap-3 text-rose-500 font-bold text-base">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <span>CONFERMA LIQUIDAZIONE DI EMERGENZA</span>
            </div>
            <p className="text-slate-300 font-sans leading-relaxed">
              Stai per attivare il <strong>Panic Button</strong>. Questa azione chiuderà <strong>IMMEDIATAMENTE</strong> tutte le posizioni aperte sul conto {tradingMode.toUpperCase()} ed arresterà il bot di trading.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                disabled={panicLoading}
                onClick={() => setShowPanicModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Annulla
              </button>
              <button
                disabled={panicLoading}
                onClick={handlePanicLiquidate}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-lg"
              >
                {panicLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                {panicLoading ? 'Esecuzione...' : 'SÌ, LIQUIDA TUTTO E FERMA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Ticker Marquee / Bar */}
      <div className="bg-[#131B2E] border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-0.5 flex-1 md:flex-initial">
          <div className="flex items-center gap-2 text-amber-400 font-bold whitespace-nowrap shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            PRO TRADING TERMINAL v4.2
          </div>
          {topAssets.slice(0, 5).map(ast => (
            <div key={ast.symbol} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-400 font-semibold">{ast.symbol}</span>
              <span className="text-slate-200">${ast.price.toFixed(2)}</span>
              <span className={ast.positive ? 'text-emerald-400' : 'text-rose-400'}>{ast.change}</span>
            </div>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-4 text-slate-400 shrink-0">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {tickerTime} UTC</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] font-bold">LIVE FEED</span>
        </div>
      </div>

      {/* Main Terminal Header with Panic, Loop, Paper/Live controls */}
      <div className="bg-[#0E1526] border-b border-slate-800 px-4 py-3 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Row 1: Selected Asset Info & Exit Button */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                {selectedAsset.symbol} <span className="text-[10px] md:text-xs font-normal text-slate-400 font-mono">({selectedAsset.name})</span>
              </h1>
              <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs font-mono text-slate-400">
                <span>Vol: <strong className="text-slate-200">{selectedAsset.volume}</strong></span>
                <span>
                  Stato: <strong className={isBotActiveInCurrentMode ? 'text-emerald-400' : 'text-rose-400'}>
                    {isBotActiveInCurrentMode ? 'ATTIVO 🟢' : 'FERMO 🔴'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Exit Button */}
          <button
            onClick={onClose}
            className="flex md:hidden items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition shadow-md border border-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>Esci</span>
          </button>
        </div>

        {/* Row 2: Action Controls Row */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Paper / Live Toggle */}
          <div className="flex items-center bg-[#131B2E] p-0.5 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => handleSwitchMode('paper')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer font-mono ${tradingMode === 'paper' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Paper
            </button>
            <button
              onClick={() => handleSwitchMode('live')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer font-mono ${tradingMode === 'live' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Live
            </button>
          </div>

          {/* REAL Loop Start / Stop Control */}
          <button
            onClick={handleToggleBot}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer font-mono shrink-0 ${
              isBotActiveInCurrentMode
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {isBotActiveInCurrentMode ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            <span>{isBotActiveInCurrentMode ? 'Ferma Bot' : 'Avvia Bot'}</span>
          </button>

          {/* Panic Button */}
          <button
            onClick={() => setShowPanicModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold transition shadow-lg cursor-pointer font-mono border border-rose-500 shrink-0"
          >
            <AlertTriangle className="w-3 h-3" />
            <span>PANIC</span>
          </button>

          {/* Backup Import / Export Quick Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold transition cursor-pointer font-mono border border-slate-700" title="Ripristina backup JSON">
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Importa</span>
              <input type="file" accept=".json" onChange={handleImportBackupJSON} className="hidden" />
            </label>
            <button
              onClick={handleExportBackupJSON}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold transition cursor-pointer font-mono border border-slate-700"
              title="Scarica backup JSON completo"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Esporta</span>
            </button>
          </div>
        </div>

        {/* Desktop Exit Button */}
        <button
          onClick={onClose}
          className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition shadow-md border border-slate-700 cursor-pointer shrink-0"
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
          onClick={() => setActiveTab('positions')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'positions' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Briefcase className="w-3.5 h-3.5 text-amber-400" /> Posizioni Aperte & Margini ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Settings className="w-3.5 h-3.5" /> Parametri Bot & Rischio
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'monitor' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" /> Scanner & Monitor Alpaca
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
          <Cpu className="w-3.5 h-3.5" /> AI Neural Matrix & Regole
        </button>
        <button
          onClick={() => setActiveTab('debrief')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'debrief' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <BookOpen className="w-3.5 h-3.5" /> Debriefing & Report
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'api' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Key className="w-3.5 h-3.5" /> Provider LLM & Credenziali
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Shield className="w-3.5 h-3.5" /> Telemetria & Storico
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${activeTab === 'news' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 bg-[#0E1526]'}`}
        >
          <Globe className="w-3.5 h-3.5" /> Notizie & Wire
        </button>
        <button
          onClick={() => handleOpenForceBuy()}
          className="px-3 py-1.5 rounded-lg transition font-bold cursor-pointer flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md border border-emerald-500/50"
          title="Invia ordine di acquisto forzato istantaneo"
        >
          <ShoppingCart className="w-3.5 h-3.5" /> Forza Acquisto
        </button>
      </div>

      {/* RIEPILOGO FINANZIARIO CAPITALE E MARGINI (STRISCIA KPI REALE) */}
      <div className="bg-[#090D16] border-b border-slate-800 px-6 py-2.5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs shadow-inner">
        {/* 1. CAPITALE TOTALE */}
        <div className="bg-[#10172A] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Wallet className="w-3 h-3 text-indigo-400" /> Capitale Totale
            </div>
            <div className="text-sm font-bold text-white mt-0.5">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tradingMode === 'live' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-indigo-950 text-indigo-400 border border-indigo-800'}`}>
            {tradingMode.toUpperCase()}
          </span>
        </div>

        {/* 2. CAPITALE INVESTITO & MARGINE */}
        <div className="bg-[#10172A] p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <PieChart className="w-3 h-3 text-amber-400" /> Capitale Investito
          </div>
          <div className="text-sm font-bold text-amber-300 mt-0.5">${totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-[9px] text-slate-400 truncate">Margine: ${totalMarginUsed.toFixed(2)}</div>
        </div>

        {/* 3. CAPITALE DISPONIBILE */}
        <div className="bg-[#10172A] p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" /> Liquidità Disponibile
          </div>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">${cashAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-[9px] text-slate-400">
            {totalBalance > 0 ? `${((cashAvailable / totalBalance) * 100).toFixed(1)}% del totale` : '100%'}
          </div>
        </div>

        {/* 4. POSIZIONI APERTE */}
        <div className="bg-[#10172A] p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-sky-400" /> Posizioni Aperte
          </div>
          <div className="text-sm font-bold text-white mt-0.5">{positions.length} asset attivi</div>
          <div className="text-[9px] text-slate-400">
            Esposizione: {totalBalance > 0 ? `${((totalInvested / totalBalance) * 100).toFixed(1)}%` : '0%'}
          </div>
        </div>

        {/* 5. VARIAZIONE GIORNALIERA */}
        <div className="bg-[#10172A] p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between">
            <span>Var. Giornaliera</span>
            {dailyPnLVal >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
          </div>
          <div className={`text-sm font-bold mt-0.5 ${dailyPnLVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {dailyPnLVal >= 0 ? '+' : ''}${dailyPnLVal.toFixed(2)}
          </div>
          <div className={`text-[9px] font-semibold ${dailyPnLVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {dailyPnLPct >= 0 ? '+' : ''}{dailyPnLPct.toFixed(2)}%
          </div>
        </div>

        {/* 6. VARIAZIONE STORICA */}
        <div className="bg-[#10172A] p-2.5 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between">
            <span>Var. Storica Totale</span>
            {historicalPnLVal >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-rose-400" />}
          </div>
          <div className={`text-sm font-bold mt-0.5 ${historicalPnLVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {historicalPnLVal >= 0 ? '+' : ''}${historicalPnLVal.toFixed(2)}
          </div>
          <div className={`text-[9px] font-semibold ${historicalPnLVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {historicalPnLPct >= 0 ? '+' : ''}{historicalPnLPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Gemini Signals Ticker */}
      <div className="px-6 pt-2 bg-[#0B0F17]">
        <GeminiSignalsTicker />
      </div>

      {/* Terminal Workspace Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 overflow-y-auto bg-[#0B0F17]">
        
        {/* Left Column: Watchlist & Asset Selector */}
        <div className="order-2 lg:order-1 lg:col-span-1 bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl max-h-[350px] lg:max-h-none">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" /> Watchlist Mercati ({tradingMode.toUpperCase()})
            </span>
            <button
              onClick={fetchMomentumAssets}
              className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              title="Aggiorna Watchlist Momentum"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <div className="relative mb-3 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca simbolo (es. AAPL)..."
              className="w-full bg-[#090D16] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[220px] lg:max-h-[480px]">
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
                <div className="flex flex-col gap-1">
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    {ast.symbol}
                    {ast.positive ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
                  </div>
                  <SentimentBadge symbol={ast.symbol} signals={geminiSignals} />
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="text-xs font-bold text-slate-200">${ast.price.toFixed(2)}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenForceBuy(ast.symbol);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 transition cursor-pointer flex items-center gap-0.5"
                    title="Forza acquisto di quote"
                  >
                    <Plus className="w-2.5 h-2.5" /> Acquista
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center/Main Column: Active Tab Content */}
        <div className="order-1 lg:order-2 lg:col-span-3 flex flex-col gap-4">
          
          {/* TAB: POSIZIONI APERTE & MARGINI */}
          {activeTab === 'positions' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-amber-400" /> Posizioni Aperte e Margini Impegnati ({tradingMode.toUpperCase()})
                  </h2>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    Monitora in tempo reale il valore di mercato, il margine impegnato e gestisci le strategie di rischio (Prudente, Conservativa, Aggressiva).
                  </p>
                </div>
                <button
                  onClick={refreshBackendStatus}
                  className="p-2 bg-[#0E1526] hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> Aggiorna
                </button>
              </div>

              {positions.length === 0 ? (
                <div className="bg-[#090D16] border border-slate-800 rounded-xl p-8 text-center space-y-3 my-auto">
                  <Shield className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="text-slate-300 font-bold text-sm">Nessuna posizione aperta al momento</div>
                  <p className="text-slate-500 font-sans text-xs max-w-sm mx-auto">
                    Il bot sta monitorando il mercato in modalità {tradingMode.toUpperCase()}. Quando le condizioni saranno favorevoli, aprirà posizioni automaticamente.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop view: Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0E1526] text-slate-400 text-[10px] uppercase border-b border-slate-800">
                          <th className="py-2.5 px-3">Asset</th>
                          <th className="py-2.5 px-3">Quantità</th>
                          <th className="py-2.5 px-3">Prezzo Carico</th>
                          <th className="py-2.5 px-3">Prezzo Attuale</th>
                          <th className="py-2.5 px-3">Valore Mercato</th>
                          <th className="py-2.5 px-3">Sentiment IA</th>
                          <th className="py-2.5 px-3">Strategia Rischio</th>
                          <th className="py-2.5 px-3">P&L Giornaliero</th>
                          <th className="py-2.5 px-3">P&L Totale</th>
                          <th className="py-2.5 px-3 text-right">Azione</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {positions.map((pos: any) => {
                          const qty = parseFloat(pos.qty || '0');
                          const avgEntry = parseFloat(pos.avg_entry_price || '0');
                          const currentPrice = parseFloat(pos.current_price || '0');
                          const marketVal = parseFloat(pos.market_value || '0');
                          const unrealizedPL = parseFloat(pos.unrealized_pl || '0');
                          const unrealizedPLPC = parseFloat(pos.unrealized_plpc || '0') * 100;
                          const intradayPL = parseFloat(pos.unrealized_intraday_pl || '0');
                          const intradayPLPC = parseFloat(pos.unrealized_intraday_plpc || '0') * 100;
                          const isClosing = closingSymbols.includes(pos.symbol);
                          const currentStrategy = pos.strategy || 'Conservativa';

                          return (
                            <tr key={pos.symbol} className="bg-[#090D16] hover:bg-[#0E1526] transition">
                              <td className="py-3 px-3">
                                <span className="font-bold text-white text-xs">{pos.symbol}</span>
                                <span className="block text-[9px] text-slate-500 uppercase">{pos.exchange || 'NASDAQ/NYSE'}</span>
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-200">
                                {qty < 1 ? qty.toFixed(4) : qty.toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-slate-300">${avgEntry.toFixed(2)}</td>
                              <td className="py-3 px-3 font-bold text-white">${currentPrice.toFixed(2)}</td>
                              <td className="py-3 px-3 font-bold text-amber-300">${marketVal.toFixed(2)}</td>
                              <td className="py-3 px-3">
                                <SentimentBadge symbol={pos.symbol} signals={geminiSignals} showReasoning={true} />
                              </td>
                              <td className="py-3 px-3">
                                <select
                                  value={currentStrategy}
                                  onChange={(e) => handleUpdateStrategy(pos.symbol, e.target.value as any)}
                                  className="bg-[#0E1526] border border-slate-700 text-xs text-indigo-300 rounded px-2 py-1 focus:outline-none"
                                >
                                  <option value="Prudente">Prudente</option>
                                  <option value="Conservativa">Conservativa</option>
                                  <option value="Aggressiva">Aggressiva</option>
                                </select>
                              </td>
                              <td className={`py-3 px-3 font-semibold ${intradayPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {intradayPL >= 0 ? '+' : ''}${intradayPL.toFixed(2)}
                                <span className="block text-[9px]">({intradayPLPC >= 0 ? '+' : ''}{intradayPLPC.toFixed(2)}%)</span>
                              </td>
                              <td className={`py-3 px-3 font-bold ${unrealizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {unrealizedPL >= 0 ? '+' : ''}${unrealizedPL.toFixed(2)}
                                <span className="block text-[9px]">({unrealizedPLPC >= 0 ? '+' : ''}{unrealizedPLPC.toFixed(2)}%)</span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenForceBuy(pos.symbol)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 transition cursor-pointer flex items-center gap-1"
                                    title="Forza acquisto di ulteriori quote"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Acquista
                                  </button>
                                  <button
                                    disabled={isClosing}
                                    onClick={() => handleClosePosition(pos.symbol)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                      isClosing 
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                        : 'bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/40'
                                    }`}
                                  >
                                    {isClosing ? 'Chiusura...' : 'Chiudi'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile view: Cards list */}
                  <div className="block md:hidden space-y-3">
                    {positions.map((pos: any) => {
                      const qty = parseFloat(pos.qty || '0');
                      const avgEntry = parseFloat(pos.avg_entry_price || '0');
                      const currentPrice = parseFloat(pos.current_price || '0');
                      const marketVal = parseFloat(pos.market_value || '0');
                      const unrealizedPL = parseFloat(pos.unrealized_pl || '0');
                      const unrealizedPLPC = parseFloat(pos.unrealized_plpc || '0') * 100;
                      const intradayPL = parseFloat(pos.unrealized_intraday_pl || '0');
                      const intradayPLPC = parseFloat(pos.unrealized_intraday_plpc || '0') * 100;
                      const isClosing = closingSymbols.includes(pos.symbol);
                      const currentStrategy = pos.strategy || 'Conservativa';

                      return (
                        <div key={pos.symbol} className="bg-[#090D16] border border-slate-800 rounded-xl p-3.5 space-y-3">
                          {/* Header: Symbol & P&L Totale */}
                          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                            <div>
                              <span className="font-bold text-sm text-white">{pos.symbol}</span>
                              <span className="text-[9px] text-slate-500 ml-2 font-mono">{pos.exchange || 'NASDAQ'}</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${unrealizedPL >= 0 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'}`}>
                                {unrealizedPL >= 0 ? '+' : ''}${unrealizedPL.toFixed(2)} ({unrealizedPLPC >= 0 ? '+' : ''}{unrealizedPLPC.toFixed(1)}%)
                              </span>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-[11px] font-mono">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Quantità</span>
                              <span className="font-semibold text-slate-200">{qty < 1 ? qty.toFixed(4) : qty.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Valore Mercato</span>
                              <span className="font-semibold text-amber-300">${marketVal.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">P. Carico</span>
                              <span className="text-slate-300">${avgEntry.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">P. Attuale</span>
                              <span className="text-white font-bold">${currentPrice.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">P&L Giornaliero</span>
                              <span className={`font-semibold ${intradayPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {intradayPL >= 0 ? '+' : ''}${intradayPL.toFixed(2)} ({intradayPLPC >= 0 ? '+' : ''}{intradayPLPC.toFixed(1)}%)
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Strategia</span>
                              <select
                                value={currentStrategy}
                                onChange={(e) => handleUpdateStrategy(pos.symbol, e.target.value as any)}
                                className="bg-[#0E1526] border border-slate-700 text-[10px] text-indigo-300 rounded px-1.5 py-0.5 mt-0.5 focus:outline-none"
                              >
                                <option value="Prudente">Prudente</option>
                                <option value="Conservativa">Conservativa</option>
                                <option value="Aggressiva">Aggressiva</option>
                              </select>
                            </div>
                          </div>

                          {/* Footer Button: Actions */}
                          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
                            <button
                              onClick={() => handleOpenForceBuy(pos.symbol)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Acquista
                            </button>
                            <button
                              disabled={isClosing}
                              onClick={() => handleClosePosition(pos.symbol)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                                isClosing 
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                  : 'bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20'
                              }`}
                            >
                              {isClosing ? 'Chiusura...' : 'Chiudi'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: PARAMETRI BOT & RISCHIO */}
          {activeTab === 'settings' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-5 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-400" /> Parametri di Trading del Bot & Gestione Rischio
                  </h2>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                    I parametri modificati qui vengono salvati direttamente sul server e sincronizzati con il bot di trading.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg font-bold text-[10px]">
                  ALLINEATO COL BACKEND
                </span>
              </div>

              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#10172A] p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                    <label className="text-[11px] text-slate-300 font-bold block">
                      Max Posizioni Contemporanee
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={maxPosInput}
                      onChange={e => setMaxPosInput(Number(e.target.value))}
                      className="w-full bg-[#0E1526] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-500 block">Numero massimo di posizioni aperte contemporaneamente dal bot.</span>
                  </div>

                  <div className="bg-[#10172A] p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                    <label className="text-[11px] text-slate-300 font-bold block">
                      Timeframe Analisi (Minuti)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={tfInput}
                      onChange={e => setTfInput(Number(e.target.value))}
                      className="w-full bg-[#0E1526] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-500 block">Frequenza dell'algoritmo di analisi candele.</span>
                  </div>

                  <div className="bg-[#10172A] p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                    <label className="text-[11px] text-slate-300 font-bold block">
                      Target Allocazione Capitale (%)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min={10}
                      max={100}
                      value={riskInput}
                      onChange={e => setRiskInput(Number(e.target.value))}
                      className="w-full bg-[#0E1526] border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-400 font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-500 block">Percentuale totale dell'equity distribuita sul mercato (fino al 95%).</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-sans">
                    I campi riflettono le opzioni reali del motore: <strong>Max Posizioni ({statusObj?.maxConcurrentPositions ?? 10})</strong>, <strong>Timeframe ({statusObj?.timeframe ?? 15}m)</strong>, <strong>Allocazione Capitale ({statusObj?.riskPercentage ?? 95}%)</strong>.
                  </div>
                  <button
                    disabled={savingSettings}
                    onClick={handleSaveBotSettings}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition cursor-pointer shadow-lg flex items-center gap-2"
                  >
                    {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {savingSettings ? 'Salvataggio...' : 'Salva Parametri Bot'}
                  </button>
                </div>
              </div>

              {/* Embedded Unified API & LLM Settings Component */}
              <div className="pt-2">
                <LLMSettings />
              </div>
            </div>
          )}

          {/* TAB: MONITOR & SCANNER ALPACA */}
          {activeTab === 'monitor' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1">
              <AlpacaMonitorModule />
            </div>
          )}

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

              <div className="flex-1 w-full min-h-[300px]">
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

              {/* RIEPILOGO RAPIDO POSIZIONI SOTTO IL GRAFICO */}
              <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-xs">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-amber-400" /> Posizioni Aperte nel Portafoglio ({positions.length})
                  </span>
                  <button
                    onClick={() => setActiveTab('positions')}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px] font-bold underline cursor-pointer"
                  >
                    Vedi dettaglio margini →
                  </button>
                </div>
                {positions.length === 0 ? (
                  <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800/80 text-slate-500 text-[11px]">
                    Nessuna posizione aperta in {tradingMode.toUpperCase()}. Liquidità completamente disponibile (${cashAvailable.toFixed(2)}).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {positions.slice(0, 4).map((pos: any) => {
                      const mVal = getPosMarketValue(pos);
                      const pl = parseFloat(pos.unrealized_pl || '0');
                      return (
                        <div key={pos.symbol} className="bg-[#090D16] p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-white">{pos.symbol}</span>
                            <span className="text-[10px] text-slate-400 block">{pos.qty} azioni @ ${parseFloat(pos.avg_entry_price || '0').toFixed(2)}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-amber-300">${mVal.toFixed(2)}</div>
                            <div className={`text-[10px] font-bold ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

          {/* TAB: AI NEURAL MATRIX & REGOLE */}
          {activeTab === 'ai' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-4 overflow-y-auto">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" /> AI Neural Matrix & Regole Correttive
              </h2>

              {/* Regole Correttive AI Manager */}
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                    Gestione Regole Correttive AI (Google Sheets Sincronizzato)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSyncFeedbackFromSheets}
                      className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer border border-indigo-500/40"
                    >
                      <RefreshCw className="w-3 h-3" /> Sync da Sheets
                    </button>
                    <button
                      onClick={handleExportFeedbackToSheets}
                      className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer border border-emerald-500/40"
                    >
                      <Save className="w-3 h-3" /> Esporta su Sheets
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ruleInput}
                    onChange={(e) => setRuleInput(e.target.value)}
                    placeholder="Esempio: Non aprire posizioni su titoli con RSI > 80..."
                    className="flex-1 bg-[#0E1526] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    disabled={feedbackLoading}
                    onClick={handleAddRule}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition cursor-pointer"
                  >
                    Aggiungi Regola
                  </button>
                </div>

                {activeFeedbackRules.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Regole Attive ({activeFeedbackRules.length}):</span>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {activeFeedbackRules.map((rule, idx) => (
                        <div key={idx} className="bg-[#10172A] p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-300 text-[11px]">{rule}</span>
                          <button
                            onClick={() => handleDeleteRule(idx)}
                            className="text-rose-400 hover:text-rose-300 p-1 rounded transition cursor-pointer"
                            title="Elimina regola"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ultimi Ragionamenti AI */}
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide block">
                  Ultimi Ragionamenti Generati da Gemini / LLM ({tradingMode.toUpperCase()})
                </span>
                {((accountData.dailyLogicLogs && accountData.dailyLogicLogs.length > 0) ? accountData.dailyLogicLogs : (operationsData?.dailyLogicLogs || [])).length === 0 ? (
                  <div className="text-slate-500 text-xs font-sans">Nessun log di ragionamento presente al momento.</div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {[...((accountData.dailyLogicLogs && accountData.dailyLogicLogs.length > 0) ? accountData.dailyLogicLogs : (operationsData?.dailyLogicLogs || []))].reverse().slice(0, 15).map((log: any, i: number) => (
                      <div key={i} className="bg-[#10172A] p-2.5 rounded-lg border border-slate-800 text-slate-300 text-[11px] font-sans leading-relaxed space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800/80 pb-1">
                          <span className="text-indigo-400 font-semibold">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Data N/D'}
                          </span>
                          {log.symbol && (
                            <span className="font-bold text-white px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                              {log.symbol} {log.action ? `(${log.action})` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-200">{typeof log === 'string' ? log : (log.reasoning || JSON.stringify(log))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Log Operativi Bot */}
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide block">
                  Log Operativi e Tracciamento Decisionale ({tradingMode.toUpperCase()})
                </span>
                {operationalLogs.length === 0 ? (
                  <div className="text-slate-500 text-xs font-sans">Nessun log operativo registrato.</div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-[10px] text-slate-400">
                    {operationalLogs.slice(-20).reverse().map((l, i) => (
                      <div key={i} className="border-b border-slate-800/40 pb-1">
                        {l}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: DEBRIEFING & REPORT */}
          {activeTab === 'debrief' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" /> Debriefing Analitico & Report di Periodo IA
                </h2>
                <div className="flex gap-2">
                  <button
                    disabled={debriefLoading}
                    onClick={handleGenerateDebrief}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    {debriefLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {debriefLoading ? 'Generazione...' : 'Debrief Giornaliero'}
                  </button>
                </div>
              </div>

              {/* Selezione Intervallo Date per Report Personalizzato */}
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide block">
                  Genera Debriefing su Intervallo Personalizzato
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Data Inizio</label>
                    <input
                      type="date"
                      value={rangeStartDate}
                      onChange={(e) => setRangeStartDate(e.target.value)}
                      className="w-full bg-[#0E1526] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Data Fine</label>
                    <input
                      type="date"
                      value={rangeEndDate}
                      onChange={(e) => setRangeEndDate(e.target.value)}
                      className="w-full bg-[#0E1526] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={rangeLoading}
                      onClick={handleGenerateRangeDebrief}
                      className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold transition cursor-pointer"
                    >
                      {rangeLoading ? 'Elaborazione...' : 'Genera Report Periodo'}
                    </button>
                    <button
                      onClick={handleDownloadCustomReport}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition cursor-pointer flex items-center gap-1"
                      title="Scarica report TXT"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-400" />
                      TXT
                    </button>
                  </div>
                </div>
              </div>

              {/* Display Debrief Result */}
              {debriefResult ? (
                <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-3 font-sans text-xs">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="font-bold text-emerald-400 text-sm font-mono flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Report Debriefing Generato
                    </span>
                    <button
                      onClick={exportDebriefPDF}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer font-mono"
                    >
                      <Download className="w-3.5 h-3.5" /> Scarica PDF
                    </button>
                  </div>
                  <div className="text-slate-300 leading-relaxed max-h-96 overflow-y-auto pr-2">
                    <ReactMarkdown>{debriefResult}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="bg-[#090D16] p-6 rounded-xl border border-slate-800 text-center text-slate-500 font-sans">
                  Nessun report generato per questa sessione. Clicca su "Debrief Giornaliero" o "Genera Report Periodo" per avviare l'analisi IA.
                </div>
              )}
            </div>
          )}

          {/* TAB: PROVIDER LLM & CREDENZIALI */}
          {activeTab === 'api' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-4 overflow-y-auto">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" /> Gestione Unificata Credenziali API, Google Drive & Sheets
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Gestisci le chiavi API Alpaca (Paper/Live), i provider LLM (Gemini, Mistral, Anthropic, DeepSeek, Groq) e la sincronizzazione automatica a due colonne con Google Sheets ed il salvataggio persistente su Google Drive.
              </p>
              <LLMSettings />
            </div>
          )}

          {/* TAB: TELEMETRIA & STORICO */}
          {activeTab === 'analytics' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" /> Telemetria di Rischio, Performance & Storico Operazioni ({tradingMode.toUpperCase()})
                </h2>
                <button
                  onClick={exportClosedTradesCSV}
                  disabled={closedTradesList.length === 0}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Download className="w-3.5 h-3.5" /> Esporta CSV Storico
                </button>
              </div>

              {/* Key Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Win Rate %</div>
                  <div className="text-emerald-400 font-bold text-base mt-0.5">
                    {performanceMetrics.winRate.toFixed(1)}%
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {performanceMetrics.totalWinCount} W / {performanceMetrics.totalLossCount} L
                  </div>
                </div>

                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Profit Factor</div>
                  <div className="text-indigo-400 font-bold text-base mt-0.5">
                    {performanceMetrics.profitFactor.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Gains: ${performanceMetrics.totalProfit.toFixed(2)}
                  </div>
                </div>

                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Max Drawdown (%)</div>
                  <div className="text-rose-400 font-bold text-base mt-0.5">
                    -{performanceMetrics.maxDrawdownPercent.toFixed(2)}%
                  </div>
                  <div className="text-[9px] text-slate-500">
                    -${performanceMetrics.maxDrawdownAmount.toFixed(2)}
                  </div>
                </div>

                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Operazioni Chiuse</div>
                  <div className="text-white font-bold text-base mt-0.5">
                    {closedTradesList.length}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Modalità: {tradingMode.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Equity Curve Chart */}
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wide block">
                  Andamento Saldo Portafoglio (Equity Curve)
                </span>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={
                      performanceMetrics.pnlHistory.length > 0 
                        ? performanceMetrics.pnlHistory.map(item => ({ time: item.date, price: item.balance, volume: item.pnl }))
                        : mockChartData
                    }>
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#090D16', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#eqGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Filtered Closed Trades Table */}
              <div className="bg-[#090D16] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                    Storico Operazioni Chiuse
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filtra simbolo..."
                      value={closedSymbolFilter}
                      onChange={(e) => setClosedSymbolFilter(e.target.value)}
                      className="bg-[#0E1526] border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    />
                    <input
                      type="date"
                      value={closedStartDate}
                      onChange={(e) => setClosedStartDate(e.target.value)}
                      className="bg-[#0E1526] border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    />
                    <input
                      type="date"
                      value={closedEndDate}
                      onChange={(e) => setClosedEndDate(e.target.value)}
                      className="bg-[#0E1526] border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {closedTradesList.length === 0 ? (
                  <div className="text-slate-500 text-center py-6 font-sans">
                    Nessuna operazione chiusa registrata nell'intervallo selezionato.
                  </div>
                ) : (
                  <>
                    {/* Desktop view: Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#0E1526] text-slate-400 text-[10px] uppercase border-b border-slate-800">
                            <th className="py-2 px-3">Asset</th>
                            <th className="py-2 px-3">Quantità</th>
                            <th className="py-2 px-3">Prezzo Ingresso</th>
                            <th className="py-2 px-3">Prezzo Uscita</th>
                            <th className="py-2 px-3">PnL Realizzato</th>
                            <th className="py-2 px-3">Data Chiusura</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs">
                          {closedTradesList.map((t, idx) => {
                            const pnl = parseFloat(t.unrealized_pl || t.realized_pl || '0');
                            return (
                              <tr key={idx} className="hover:bg-[#0E1526]">
                                <td className="py-2 px-3 font-bold text-white">{t.symbol}</td>
                                <td className="py-2 px-3 text-slate-300">{t.qty}</td>
                                <td className="py-2 px-3 text-slate-300">${parseFloat(t.avg_entry_price || '0').toFixed(2)}</td>
                                <td className="py-2 px-3 text-slate-300">${parseFloat(t.current_price || t.close_price || '0').toFixed(2)}</td>
                                <td className={`py-2 px-3 font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                </td>
                                <td className="py-2 px-3 text-slate-500 text-[10px]">{t.closed_at || t.timestamp || 'Recente'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile view: Adaptive grid cards */}
                    <div className="block md:hidden space-y-2">
                      {closedTradesList.map((t, idx) => {
                        const pnl = parseFloat(t.unrealized_pl || t.realized_pl || '0');
                        return (
                          <div key={idx} className="bg-[#0E1526] border border-slate-800/80 rounded-xl p-3 space-y-2 font-mono text-[11px]">
                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-1.5">
                              <span className="font-bold text-white text-xs">{t.symbol}</span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${pnl >= 0 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/80 text-rose-400 border border-rose-800/40'}`}>
                                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-slate-300">
                              <div>Quantità: <span className="text-white font-semibold">{t.qty}</span></div>
                              <div>Entrata: <span className="text-white">${parseFloat(t.avg_entry_price || '0').toFixed(2)}</span></div>
                              <div>Uscita: <span className="text-white">${parseFloat(t.current_price || t.close_price || '0').toFixed(2)}</span></div>
                              <div className="text-slate-400 text-[9px] truncate" title={t.closed_at || t.timestamp || 'Recente'}>
                                Chiuso: {t.closed_at || t.timestamp || 'Recente'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'news' && (
            <div className="bg-[#10172A] border border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-xl flex-1 font-mono text-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" /> Live Market Wire & Sentiment Feed
              </h2>
              <div className="space-y-2">
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-indigo-400 font-bold text-[10px]">BLOOMBERG TERMINAL WIRE</div>
                  <div className="text-white font-bold mt-1">FED sostiene la stabilità dei tassi per il trimestre in corso</div>
                  <div className="text-slate-400 text-[11px] mt-1 font-sans">
                    L'impatto sui mercati azionari tecnologici rimane positivo con continuazione del rally sui semiconduttori.
                  </div>
                </div>
                <div className="bg-[#090D16] p-3 rounded-xl border border-slate-800">
                  <div className="text-emerald-400 font-bold text-[10px]">REUTERS FINANCIAL MARKET</div>
                  <div className="text-white font-bold mt-1">Settore AI & Chip mostra volumi record in apertura mercato</div>
                  <div className="text-slate-400 text-[11px] mt-1 font-sans">
                    Forte spinta rialzista registrata sui principali ticker semiconduttori ed etf di settore.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Modal Acquisto Forzato Manuale */}
      <ForceBuyModal
        isOpen={forceBuyModalOpen}
        onClose={() => setForceBuyModalOpen(false)}
        initialSymbol={forceBuySymbol}
        initialMode={tradingMode}
        onSuccess={fetchStatus}
        showToast={(msg, type, title) => setToastMessage(`${title ? title + ': ' : ''}${msg}`)}
      />
    </div>
  );
}
