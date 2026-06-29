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
    news?: string;
    breakdown?: { symbol: string; shares: number; price: number; value: number; pnl?: number; pnlPercent?: number }[];
  }[];
  dailyLogicLogs?: { timestamp: string; symbol: string; action: string; reasoning: string; price?: number }[];
  logs: string[];
}

export interface BotStatus {
  active: boolean; // For legacy compatibility
  paperActive: boolean;
  liveActive: boolean;
  lastCheck: string | null;
  userFeedbackRules?: string[];
  latestDailyReport?: string;
  
  paper: AccountData;
  live: AccountData;
}

export interface BotStateResponse {
  status: BotStatus;
}

