from typing import Dict, Any
from backend.app.models.trade import TradeEvaluationRequest, TradeEvaluationResponse
from backend.app.services.ai_service import evaluate_trade_with_gemini

class GeminiTradeEvaluator:
    def evaluate(self, request: TradeEvaluationRequest, ig_market_info: Dict[str, Any]) -> TradeEvaluationResponse:
        """
        Evaluate market conditions and trade request using Gemini AI Service.
        """
        trade_payload = {
            "symbol": request.symbol,
            "current_price": request.current_price,
            "timeframe": request.timeframe,
            "indicators": request.indicators.dict() if request.indicators else {},
            "account": request.account.dict() if request.account else {},
            "custom_rules": request.custom_rules or [],
            "ig_market_status": ig_market_info.get("snapshot", {}).get("marketStatus", "UNKNOWN")
        }

        eval_result = evaluate_trade_with_gemini(trade_payload)

        return TradeEvaluationResponse(
            symbol=request.symbol,
            action=eval_result.get("action", "HOLD").upper(),
            confidence=float(eval_result.get("confidence", 0.5)),
            reasoning=eval_result.get("reasoning", "Valutazione completata."),
            suggested_stop_loss=eval_result.get("suggested_stop_loss"),
            suggested_take_profit=eval_result.get("suggested_take_profit"),
            suggested_position_size=eval_result.get("suggested_position_size"),
            market_source="IG_MARKETS"
        )

gemini_evaluator = GeminiTradeEvaluator()

