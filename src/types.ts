export interface RiskRuleConfig {
  id: string;
  enabled: boolean;
  type: 'PNL_PREVENTIVE_CLOSE' | 'SENTIMENT_LIQUIDITY_SELL' | 'EOD_BUY_LOCK' | 'TIME_STAGNATION_CLOSE' | 'CUSTOM_MAX_EXPOSURE' | 'SPY_QQQ_CORRELATION_SEMICON_CAP' | 'ADX_VOLATILITY_FILTER' | 'ATR_INDIVIDUAL_TRAILING_STOP' | 'MAX_CONCURRENT_POSITIONS_CAP' | 'VOLATILITY_TIME_WINDOW_LOCK' | 'EMA_TREND_CONFIRMATION' | 'CATASTROPHIC_CIRCUIT_BREAKER_SL' | 'ATR_VOLATILITY_FILTER' | 'DYNAMIC_TIME_WINDOW_LOCK' | 'HARD_RISK_MANAGEMENT' | 'TRADING_WINDOW_LOCKDOWN' | 'TIME_BASED_HOLDING' | 'MACRO_VOLATILITY_VIX_FILTER' | 'TIME_BASED_VOLATILITY_THRESHOLD' | 'ADAPTIVE_EMA_FILTER' | 'ATR_VOLATILITY_LOCK' | 'CORRELATION_MOMENTUM_FILTER' | 'DYNAMIC_RISK_MANAGEMENT' | 'AFTERNOON_SESSION_SUSPENSION';
  parameters: {
    maxLossPct?: number;           // es. -0.80 per P&L <= -0.80%
    minSentimentThreshold?: number; // default 0.20 (ingresso rapido su primi rimbalzi)
    vixDropExemptionPct?: number;   // es. -2.0 per calo VIX > 2%
    eodWindowMinutes?: number;      // es. 30 minuti prima della chiusura
    stagnationMinutes?: number;     // es. 30 minuti di stasi per sentiment 0.20 - 0.29
    stagnationMinutesHighSentiment?: number; // es. 60 minuti di stasi per sentiment > 0.30
    stagnationMaxPnlPct?: number;   // es. 0.10% (P&L massimo per considerare posizione stagnante)
    maxSectorExposurePct?: number;  // es. 35 per il 35%
    minSectorsForBullishCoherent?: number; // es. 3 per almeno 3 settori diversi se BULLISH_COHERENT
    minCorrelationThreshold?: number; // es. 0.95 per correlazione SPY-QQQ >= 0.95
    maxSemiconExposurePct?: number;   // es. 40 per limite esposizione 40% ai semiconduttori
    semiconSymbols?: string[];        // es. ['AMD', 'AVGO', 'NVDA']
    minAdxThreshold?: number;         // default 19.0 per ADX base
    minAdxPeriod?: number;            // default 14
    dynamicThresholdEnabled?: boolean;// Se true, soglia dinamica ADX: SPY-QQQ >= 0.95 riduce soglia da 19 a 14
    highCorrThreshold?: number;       // default 0.95
    reducedAdxThreshold?: number;     // default 14.0
    atrMultiplier?: number;           // default 1.5 per Trailing Stop 1.5x ATR
    atrPeriod?: number;               // default 14
    useAtrTrailingStop?: boolean;     // attiva trailing stop individuale su volatilità reale ATR
    minProfitBufferDollars?: number;  // default 0.04 (attiva trailing ATR solo quando garantisce almeno +0.04$ di profitto)
    maxConcurrentPositions?: number;  // default 3-5 (limite max posizioni simultanee)
    blockMorningOpeningWindow?: boolean;   // default true (inibizione 09:30-10:30 EST)
    blockMiddayChopWindow?: boolean;       // default true (inibizione 12:00-14:00 EST)
    blockAfternoonClosingWindow?: boolean; // default true (inibizione 15:30-16:00 EST)
    morningBlockStart?: string;       // default '09:30'
    morningBlockEnd?: string;         // default '10:30'
    middayBlockStart?: string;        // default '12:00'
    middayBlockEnd?: string;          // default '14:00'
    afternoonBlockStart?: string;     // default '15:30'
    afternoonBlockEnd?: string;       // default '16:00'
    requireEmaBullishTrend?: boolean; // default true: richiede Prezzo > EMA 20 e EMA 20 >= EMA 50 su 15m
    catastrophicMaxLossPct?: number;  // default -3.00% (Circuit Breaker estremo sempre attivo)
    enableTechnicalDynamicStop?: boolean; // se true attiva ATR & EMA dynamic stop, se false disattivabile dall'utente
    // --- Nuove Regole di Consenso Multi-IA ---
    atrFilterPeriod?: number;         // default 14 (ATR su 5m)
    atrSmaPeriod?: number;            // default 20 (SMA dell'ATR a 20 periodi)
    consecutiveSlCooldownMinutes?: number; // default 30 minuti dopo 2 SL consecutivi
    consecutiveSlThreshold?: number;  // default 2 SL consecutivi
    blockToxicWindow?: boolean;       // default true (blocco 10:30-12:00 EST finestra tossica)
    toxicWindowStart?: string;        // default '10:30'
    toxicWindowEnd?: string;          // default '12:00'
    hardStopLossPct?: number;         // default -1.00% (SL fisso)
    hardTakeProfitPct?: number;       // default +2.00% (TP fisso / R:R 1:2)
    maxDailyLossPct?: number;         // default -1.00% (blocco operatività giornaliero)
    // --- Nuove Regole Consenso Trading Window Lockdown, Time-Based Holding e Macro-Sentiment Filter ---
    minHoldingMinutes?: number;       // default 60 (mantenimento obbligatorio 60m anti-churn)
    maxVixThreshold?: number;         // default 30.0 (filtro VIX/IV < 30% per nuovi ingressi)
    privilegeMiddayExecution?: boolean; // default true: fascia 12:00-14:30 EST subordinata ad ADX(14) > 14.0
    middayPrimeStart?: string;        // default '12:00'
    middayPrimeEnd?: string;          // default '14:30'
    minMiddayAdxThreshold?: number;   // default 14.0 (ADX(14) > 14.0 nel blocco Midday)
    strictMiddayOnly?: boolean;       // default false (se true vincola ingressi esclusivamente al blocco 12:00-14:30)
    // --- TOP 3 CORREZIONI STRATEGICHE (Consenso Multi-IA) ---
    // #1 Time-Based Volatility Threshold
    vix1hChangeThresholdPct?: number; // default 0.50 (inibizione long se VIX 1h > +0.50%)
    vix1hWindowStart?: string;        // default '09:30'
    vix1hWindowEnd?: string;          // default '10:30'
    // #2 Adaptive EMA Filter
    suspendOnHighCorrelation?: boolean; // default true (sospende filtro EMA 20/50 se Corr SPY-QQQ > 0.95)
    highCorrelationThreshold?: number;  // default 0.95
    // #3 ATR Volatility Lock
    minAtrPercentThreshold?: number;  // default 1.50 (blocco se ATR(14)% < 1.50% per evitare consolidamenti)
    blockLowAtrPercent?: boolean;     // default true
    // #4 Dinamica Ibrida a Scaglioni (Decrescent Tiered Trailing Distance)
    tieredProfitLockEnabled?: boolean; // default true (Dinamica Ibrida a Distanza Decrescente)
    tier1ProfitThresholdPct?: number;  // default 0.50% (Scaglione 1: +0.50% - +0.80%)
    tier1DistancePct?: number;         // default 0.30% (distanza 0.30% dal picco)
    tier2ProfitThresholdPct?: number;  // default 0.80% (Scaglione 2: +0.80% - +1.00%)
    tier2DistancePct?: number;         // default 0.20% (distanza 0.20% dal picco)
    tier3ProfitThresholdPct?: number;  // default 1.00% (Scaglione 3: >= +1.00%)
    tier3DistancePct?: number;         // default 0.10% (distanza 0.10% dal picco)
    // --- CONSENSO MULTI-IA: FILTRO CORRELAZIONE-MOMENTUM & RISK MANAGEMENT DINAMICO & SOSPENSIONE POMERIDIANA ---
    minSpyQqqCorrelation?: number;    // default 0.95 (SPY-QQQ Corr >= 0.95)
    rsiLowerThreshold?: number;       // default 30.0 (RSI < 30 per rimbalzo ipervenduto)
    rsiUpperThreshold?: number;       // default 70.0 (RSI > 70 per momentum breakout)
    maxVixMomentumThreshold?: number; // default 18.0 (VIX < 18.0 per ingresso consentito)
    requireMomentumExtremeRsi?: boolean; // default true (RSI < 30 o RSI > 70)
    dynamicSlPct?: number;            // default -1.50% (Consenso #2: Stop Loss al 1.5%)
    dynamicTpUnits?: number;          // default 2.50 (Consenso #2: Target Profit a 2.5 unità)
    dynamicTsPct?: number;            // default 1.00% (Consenso #2: Trailing Stop al 1%)
    afternoonSuspensionStart?: string;// default '14:00' (Consenso #3: Sospensione 14:00-15:30 EST)
    afternoonSuspensionEnd?: string;  // default '15:30'
    extremeTrendAdxOverride?: number; // default 30.0 (Override se ADX > 30)
    extremeTrendCorrOverride?: number;// default 0.98 (Override se Corr >= 0.98)
  };
}

export interface Position {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  qty: string;
  avg_entry_price: string;
  side: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
  nominalInvestment?: number;
  activeStrategy?: 'Prudente' | 'Conservativa' | 'Aggressiva';
  highestPrice?: number;
  highestProfitPct?: number;
  isTrailingActive?: boolean;
  targetActivationPrice?: number;
  trailingStopPrice?: number;
  stopLossPrice?: number;
  strategyParams?: { tpPct: number; slPct: number; tsPct: number };
  atr?: number;
  atr1_5x?: number;
  adx?: number;
  rsi?: number;
  atrTrailingStopPrice?: number;
  rawAtrTrailingStopPrice?: number;
  minRequiredAtrStopPrice?: number;
  atrActivationPrice?: number;
  minProfitBufferDollars?: number;
  isAtrTrailingActive?: boolean;
  // Campi Dinamica Ibrida a Scaglioni & Override Manuale
  tieredProfitLockEnabled?: boolean;
  currentProfitTier?: number;         // 0: Respiro Base ATR, 1: +0.50%-0.80% (Dist 0.30%), 2: +0.80%-1.00% (Dist 0.20%), 3: >=1.00% (Dist 0.10%)
  currentTierLabel?: string;
  tierDistancePct?: number;
  lockedProfitDollars?: number;
  lockedProfitPct?: number;
  distanceToStopDollars?: number;
  distanceToStopPct?: number;
  manualTrailingStopPrice?: number;   // Prezzo Stop manuale impostato dall'utente
  manualTrailingDistancePct?: number; // Distanza % manuale impostata dall'utente (es. 0.25%)
  isManualTrailingSet?: boolean;      // True se è attivo un override manuale
  enableTechnicalStop?: boolean; // Se true o undefined (default true), applica lo Stop Tecnico Dinamico 1.5x ATR
  enableCatastrophicStop?: boolean; // Se true o undefined (default true), applica il Circuit Breaker Catastrofico (-3%)
}

export interface AccountData {
  balance: number;
  cash?: number;
  accountNumber?: string;
  totalDeposits?: number;
  netDeposits?: number;
  initialDeposit?: number;
  modeLabel: string;
  isConfigured: boolean;
  positions?: Position[];
  dailyPnL?: { 
    date: string; 
    pnl: number; 
    balance: number;
    realized?: number;
    unrealized?: number;
    news?: string;
    breakdown?: { symbol: string; shares: number; price: number; value: number; pnl?: number; pnlPercent?: number }[];
  }[];
  dailyLogicLogs?: { timestamp: string; symbol: string; action: string; reasoning: string; price?: number }[];
  logs: string[];
  errorAlpaca?: string | null;
}

export interface GeminiSignal {
  asset: string;
  score: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  timestamp?: string;
}

export interface HourlySlotStat {
  slotKey: string;
  hourBucket: number;
  tradesCount: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  totalPnL: number;
  meanPnL: number;
  meanReturnPct: number;
  stdDev: number;
  standardError: number;
  tStatistic: number;
  pValueEstimate: number;
  isStatisticallySignificant: boolean;
  confidenceInterval95: [number, number];
  distinctDaysCount: number;
  positiveDaysCount: number;
  constancyScorePct: number;
  isPersistentConstant: boolean;
  inferentialRating: 'GOLDEN_CONSTANT' | 'PROMISING_EDGE' | 'NEUTRAL_NOISE' | 'HIGH_RISK_DRAWDOWNS';
  verbalEvaluation: string;
}

export interface HourlyEfficiencyReport {
  analyzedPeriod: {
    startDate: string;
    endDate: string;
    mode: 'paper' | 'live';
  };
  totalOperations: number;
  totalTradingDays: number;
  overallWinRatePct: number;
  overallNetPnL: number;
  slotStats: HourlySlotStat[];
  bestHourlyWindow: HourlySlotStat | null;
  worstHourlyWindow: HourlySlotStat | null;
  constancySummary: {
    hasProvenConstantEdge: boolean;
    provenConstantSlots: string[];
    riskProneSlots: string[];
    keyInsight: string;
  };
  markdownTable: string;
  formattedSummaryPrompt: string;
}

export interface BotStatus {
  active: boolean; // For legacy compatibility
  paperActive: boolean;
  liveActive: boolean;
  lastCheck: string | null;
  userFeedbackRules?: string[];
  systemRiskRules?: RiskRuleConfig[];
  monitoredSymbols?: string[];
  geminiSignals?: GeminiSignal[];
  latestDailyReport?: string;
  latestDailyDebrief?: {
    analysis: string;
    suggestedRule: string;
    top3Corrections?: string[];
    participatingProviders?: string[];
    timestamp: string;
  };
  defaultTP?: number;
  defaultSL?: number;
  trailingStop?: number;
  timeframe?: number;
  riskPercentage?: number;
  maxConcurrentPositions?: number;
  
  paper: AccountData;
  live: AccountData;
}

export interface BotStateResponse {
  status: BotStatus;
}

