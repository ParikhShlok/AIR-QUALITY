from app.services.air_quality import parse_payload
from app.services.recommendations import recommendations, answer
from fastapi.testclient import TestClient
from app.main import app
from app.services.assistant import respond
from app.services.impact import estimate
import asyncio

def test_parse_missing_measurements_stays_missing():
    got = parse_payload({"current":{"time":"2026-11-26T09:00"}}, {}, "Delhi")
    assert got["source"] == "live" and got["aqi"] is None and got["pm25"] is None and got["forecast"] == []

def test_parse_marks_us_aqi_and_future_forecast():
    got = parse_payload({"current":{"time":"2026-11-26T09:00","us_aqi":155,"pm2_5":65.3},"hourly":{"time":["2026-11-26T09:00","2026-11-26T10:00"],"us_aqi":[155,120]}}, {"current":{"temperature_2m":22}}, "Delhi")
    assert got["aqi"] == 155 and got["pm25"] == 65.3 and got["temperature"] == 22
    assert got["forecast"] == [{"time":"10:00","value":120}]

def test_severe_pollution_recommends_indoor_activity():
    result = recommendations({"aqi":250}, {"children":True})
    assert "indoors" in result[0]["title"] and "sports" in result[0]["action"]
    assert result[0]["reason"] and result[0]["benefit"]

def test_poor_aqi_mentions_household_context():
    assert "profile includes" in recommendations({"aqi":155}, {"children":True})[0]["reason"]

def test_missing_data_does_not_claim_clean_air():
    result = recommendations({"aqi":None}, {})[0]
    assert "unavailable" in result["reason"] and "cautious" in result["title"]

def test_assistant_is_explicitly_rule_based_and_structured():
    result = answer("Can we cycle?", {"aqi":240}, {"children":True})
    assert result["mode"] == "rule-based"
    for field in ("summary","action","reason","benefit","confidence","alternative"): assert result[field]

def test_invalid_coordinates_are_rejected():
    response = TestClient(app).get("/api/air?latitude=95&longitude=181")
    assert response.status_code == 422

def test_invalid_assistant_question_is_rejected():
    response = TestClient(app).post("/api/assistant", json={"question":""})
    assert response.status_code == 422

def test_upstream_failure_returns_safe_error_without_sample_data(monkeypatch):
    async def fail(*args, **kwargs): raise TimeoutError("upstream timeout")
    monkeypatch.setattr("app.main.fetch_air", fail)
    response = TestClient(app).get("/api/air?latitude=28.6&longitude=77.2")
    assert response.status_code == 503
    assert "aqi" not in response.json()

def test_ventilation_answer_uses_air_conditions():
    bad = answer("Should we open windows?", {"aqi":180}, {})
    missing = answer("Should we open windows?", {"aqi":None}, {})
    assert "elevated" in bad["action"]
    assert "measurement" in missing["reason"]

def test_assistant_works_without_provider_credentials(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    result = asyncio.run(respond("Can we exercise?", {"aqi":240}, {"children":True}))
    assert result["mode"] == "rule-based"

def test_invalid_configured_provider_falls_back(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("LLM_BASE_URL", "http://127.0.0.1:1/v1")
    result = asyncio.run(respond("Can we exercise?", {"aqi":240}, {"children":True}))
    assert result["mode"] == "rule-based"

def test_impact_formula_and_weekly_total():
    result = estimate(10, "metro", 5)
    assert result["kg_co2e_per_round_trip"] == 4.4912
    assert result["kg_co2e_per_week"] == 22.456

def test_impact_rejects_invalid_alternative():
    try: estimate(10, "private jet")
    except ValueError: pass
    else: raise AssertionError("unsupported alternative must be rejected")
