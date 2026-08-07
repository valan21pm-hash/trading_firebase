from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class IndicatorData(BaseModel):
    rsi: Optional[float] = None
    macd: Optional[float] = None
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    sentiment_score: Optional[float] = None

class AccountMetrics(BaseModel):
    balance: float = 10000.0
    available_cash: float = 10000.0
    open_positions_count: int = 0
    max_positions: int = 10
    risk_percentage: float = 2.0

class TradeEvaluationRequest(BaseModel):
    symbol: str = Field(..., example="EURUSD")
    timeframe: str = Field(default="15m", example="15m")
    current_price: float = Field(..., example="1.0850")
    indicators: Optional[IndicatorData] = Field(default_factory=IndicatorData)
    account: Optional[AccountMetrics] = Field(default_factory=AccountMetrics)
    custom_rules: Optional[List[str]] = Field(default_factory=list)
    mode: str = Field(default="paper", example="paper")

class TradeEvaluationResponse(BaseModel):
    symbol: str
    action: str = Field(..., description="BUY, SELL, or HOLD")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0")
    reasoning: str
    suggested_stop_loss: Optional[float] = None
    suggested_take_profit: Optional[float] = None
    suggested_position_size: Optional[float] = None
    market_source: str = "IG_MARKETS"
