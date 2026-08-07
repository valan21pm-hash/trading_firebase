import os
import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.models.trade import TradeEvaluationRequest, TradeEvaluationResponse
from backend.app.services.ig_markets import ig_client
from backend.app.services.gemini_service import gemini_evaluator

app = FastAPI(
    title=settings.app_name,
    description="FastAPI Backend for IG Markets & Google AI Studio Gemini Trading Evaluation",
    version="1.0.0"
)

# Enable CORS for React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", status_code=status.HTTP_200_OK)
@app.get("/api/status", status_code=status.HTTP_200_OK)
def health_check():
    """
    Health check endpoint returning service status and environment metadata.
    """
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": "1.0.0",
        "environment": settings.environment,
        "ig_configured": bool(settings.ig_api_key and settings.ig_username),
        "gemini_configured": bool(settings.gemini_api_key)
    }

@app.post("/evaluate-trade", response_model=TradeEvaluationResponse, status_code=status.HTTP_200_OK)
def evaluate_trade(request: TradeEvaluationRequest):
    """
    Evaluates a proposed trade using IG Markets data and Google AI Studio Gemini model.
    """
    try:
        # Fetch IG Markets live data or snapshot
        market_info = ig_client.fetch_market_details(request.symbol)
        
        # Perform trade evaluation using Gemini AI Evaluator
        evaluation = gemini_evaluator.evaluate(request, market_info)
        return evaluation
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore nella valutazione del trade: {str(err)}"
        )

# Servizio file statici e routing SPA React
dist_path = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(dist_path):
    assets_path = os.path.join(dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target_file = os.path.join(dist_path, full_path)
        if full_path and os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
        index_file = os.path.join(dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"status": "ok", "service": settings.app_name}

if __name__ == "__main__":
    uvicorn.run("main.py:app", host="0.0.0.0", port=8000, reload=True)

