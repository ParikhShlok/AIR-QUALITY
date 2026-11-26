"""Optional OpenAI-compatible structured assistant; deterministic rules remain the fallback."""
import json
import os
import httpx
from app.services.recommendations import answer as rule_answer

FIELDS = ("summary", "action", "reason", "benefit", "confidence", "alternative")

async def respond(question: str, air: dict, profile: dict) -> dict:
    fallback = rule_answer(question, air, profile)
    api_key, model = os.getenv("LLM_API_KEY", "").strip(), os.getenv("LLM_MODEL", "").strip()
    if not api_key or not model:
        return fallback
    base = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    context = {"question":question, "air":air, "profile":profile}
    system = ("You are a cautious family air-quality information assistant. Use only supplied environmental data and household context. "
      "Do not diagnose, prescribe, promise prevention, or invent readings, forecasts, health facts, or numerical impact. "
      "If data is absent, say so. Distinguish US AQI. Prioritize personal exposure over low-emission activity. "
      "Never recommend sealing homes with combustion appliances; do not recommend ozone devices. "
      "Return a JSON object with exactly these string keys: summary, action, reason, benefit, confidence, alternative.")
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(f"{base}/chat/completions", headers={"Authorization":f"Bearer {api_key}","Content-Type":"application/json"}, json={
              "model":model,"temperature":0.2,"response_format":{"type":"json_object"},
              "messages":[{"role":"system","content":system},{"role":"user","content":json.dumps(context, ensure_ascii=False)}]})
            response.raise_for_status()
            payload = response.json()["choices"][0]["message"]["content"]
            parsed = json.loads(payload)
        if not isinstance(parsed, dict) or any(not isinstance(parsed.get(k), str) or not parsed[k].strip() for k in FIELDS):
            return fallback
        return {"mode":"llm", "question":question, **{k:parsed[k][:1500] for k in FIELDS}, "impact":None,
          "medical_note":"This is general environmental guidance, not diagnosis or treatment."}
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return fallback
