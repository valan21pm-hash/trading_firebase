import os
import json
import logging
from typing import Dict, Any
import google.generativeai as genai

logger = logging.getLogger(__name__)

FALLBACK_HOLD_DECISION: Dict[str, Any] = {
    "action": "HOLD",
    "confidence": 0.5,
    "reasoning": "Decisione di sicurezza HOLD attivata automaticamente a causa di un errore di connessione o di parsing del JSON con il servizio Gemini.",
    "suggested_stop_loss": None,
    "suggested_take_profit": None,
    "suggested_position_size": 0.0,
    "market_source": "FALLBACK_SAFETY_HOLD"
}

def evaluate_trade_with_gemini(trade_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Valuta un'operazione di trading utilizzando l'SDK ufficiale google-generativeai con gemini-1.5-flash.
    
    Garanzie:
    1. Usa System Instruction per forzare ESCLUSIVAMENTE un JSON valido senza testo discorsivo.
    2. Imposta response_mime_type="application/json".
    3. Gestisce qualsiasi eccezione o errore di parsing restituendo la decisione di sicurezza "HOLD".
    4. Accede alla chiave API esclusivamente tramite la variabile d'ambiente os.getenv("GEMINI_API_KEY").
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("Variabile d'ambiente GEMINI_API_KEY non trovata. Attivazione fallback di sicurezza HOLD.")
        return FALLBACK_HOLD_DECISION

    try:
        genai.configure(api_key=api_key)

        system_instruction = (
            "Sei un sistema quantitativo di valutazione del rischio di trading. "
            "Devi valutare la richiesta e restituire ESCLUSIVAMENTE un oggetto JSON valido, "
            "senza alcun testo discorsivo, spiegazione, o formattazione prima o dopo. "
            "L'oggetto JSON deve contenere esattamente queste chiavi: "
            "'action' (valori ammessi: 'BUY', 'SELL', 'HOLD'), "
            "'confidence' (flottante da 0.0 a 1.0), "
            "'reasoning' (stringa con la motivazione sintetica), "
            "'suggested_stop_loss' (numero o null), "
            "'suggested_take_profit' (numero o null), "
            "'suggested_position_size' (numero)."
        )

        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction
        )

        prompt = f"Valuta la seguente operazione di trading:\n{json.dumps(trade_data, ensure_ascii=False)}"

        generation_config = genai.types.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.1
        )

        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )

        if not response or not response.text:
            logger.error("Risposta vuota ricevuta da Gemini API.")
            return FALLBACK_HOLD_DECISION

        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`").replace("json\n", "").replace("json", "").strip()

        parsed_result = json.loads(raw_text)

        action = parsed_result.get("action", "").upper()
        if action not in ["BUY", "SELL", "HOLD"]:
            parsed_result["action"] = "HOLD"

        return parsed_result

    except Exception as err:
        logger.error(f"Eccezione catturata in ai_service.py: {str(err)}. Ritorno decisione di sicurezza HOLD.")
        fallback = FALLBACK_HOLD_DECISION.copy()
        fallback["reasoning"] = f"Errore durante l'elaborazione dell'IA ({type(err).__name__}). Decisione di sicurezza di ripiego impostata su HOLD."
        return fallback
