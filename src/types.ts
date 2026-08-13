export interface RiskRuleConfig {
  id: string;
  enabled: boolean;
  type: 'PNL_PREVENTIVE_CLOSE' | 'SENTIMENT_LIQUIDITY_SELL' | 'EOD_BUY_LOCK' | 'TIME_STAGNATION_CLOSE' | 'CUSTOM_MAX_EXPOSURE';
  parameters: {
    maxLossPct?: number;           // es. -0.80 per P&L <= -0.80%
    minSentimentThreshold?: number; // es. 0.20 o 0.15
    vixDropExemptionPct?: number;   // es. -2.0 per calo VIX > 2%
    eodWindowMinutes?: number;      // es. 30 minuti prima della chiusura
    stagnationMinutes?: number;     // es. 30 minuti di stasi per sentiment 0.20 - 0.29
    stagnationMinutesHighSentiment?: number; // es. 60 minuti di stasi per sentiment > 0.30
    stagnationMaxPnlPct?: number;   // es. 0.10% (P&L massimo per considerare posizione stagnante)
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
}

export interface AccountData {
  balance: number;
  cash?: number;
  accountNumber?: string;
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
}

export interface GeminiSignal {
  asset: string;
  score: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  timestamp?: string;
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

