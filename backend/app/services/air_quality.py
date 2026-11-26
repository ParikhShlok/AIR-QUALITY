"""Open-Meteo integration with short-lived cache and strict missing-data handling."""
from __future__ import annotations
import os, time, asyncio
from typing import Any
import httpx

AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
TIMEOUT = float(os.getenv("OPEN_METEO_TIMEOUT_SECONDS", "8"))
_cache: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}

def _finite(value: Any) -> float | None:
    try:
        number = float(value)
        return number if number == number and abs(number) != float("inf") else None
    except (TypeError, ValueError):
        return None

def _at(values: Any, index: int = 0) -> float | None:
    return _finite(values[index]) if isinstance(values, list) and len(values) > index else None

def _nonnegative(value: Any) -> float | None:
    number = _finite(value)
    return number if number is not None and number >= 0 else None

def _valid_aqi(value: Any) -> float | None:
    number = _finite(value)
    return number if number is not None and 0 <= number <= 500 else None

def parse_payload(air: dict[str, Any], weather: dict[str, Any], city: str) -> dict[str, Any]:
    current = air.get("current", {}) if isinstance(air, dict) else {}
    hourly = air.get("hourly", {}) if isinstance(air, dict) else {}
    weather_current = weather.get("current", {}) if isinstance(weather, dict) else {}
    times, aqi_series = hourly.get("time", []), hourly.get("us_aqi", [])
    forecast, now = [], str(current.get("time", ""))
    for t, value in zip(times, aqi_series):
        forecast_value = _valid_aqi(value)
        if isinstance(t, str) and t > now and forecast_value is not None:
            forecast.append({"time": t[11:16], "value": forecast_value})
            if len(forecast) >= 24: break
    aqi = _valid_aqi(current.get("us_aqi"))
    if aqi is None:
        idx = times.index(now) if now in times else 0
        aqi = _valid_aqi(_at(aqi_series, idx))
    return {"source":"live", "city":city, "aqi":aqi,
      "pm25":_nonnegative(current.get("pm2_5")), "pm10":_nonnegative(current.get("pm10")),
      "temperature":_finite(weather_current.get("temperature_2m")),
      "humidity":_finite(weather_current.get("relative_humidity_2m")),
      "wind":_finite(weather_current.get("wind_speed_10m")), "updated":current.get("time"),
      "forecast":forecast, "note":"Open-Meteo model data; AQI uses the US AQI system."}

async def fetch_air(latitude: float, longitude: float, city: str) -> dict[str, Any]:
    key = (round(latitude, 3), round(longitude, 3))
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < 600:
        data = dict(cached[1]); data["source"] = "cached"; data["city"] = city
        data["note"] = "Cached Open-Meteo model data; AQI uses the US AQI system."
        return data
    params = {"latitude":latitude,"longitude":longitude,"current":"pm2_5,pm10,us_aqi","hourly":"pm2_5,pm10,us_aqi","forecast_days":2,"timezone":"auto"}
    wp = {"latitude":latitude,"longitude":longitude,"current":"temperature_2m,relative_humidity_2m,wind_speed_10m","timezone":"auto"}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        ar, wr = await asyncio.gather(client.get(AIR_URL, params=params), client.get(WEATHER_URL, params=wp))
        ar.raise_for_status(); wr.raise_for_status()
        result = parse_payload(ar.json(), wr.json(), city)
    _cache[key] = (time.time(), result)
    return result

async def geocode_city(name: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(GEOCODE_URL, params={"name":name,"count":1,"language":"en","format":"json"})
        response.raise_for_status()
        results = response.json().get("results", [])
    if not results:
        raise LookupError("City was not found")
    item = results[0]
    return {"latitude":item["latitude"],"longitude":item["longitude"],"city":item.get("name",name),"country":item.get("country","")}
