from typing import Any
import math

def recommendations(air: dict[str, Any], profile: dict[str, Any]) -> list[dict[str, Any]]:
    aqi = air.get("aqi")
    if isinstance(aqi, bool) or not isinstance(aqi, (int, float)) or not math.isfinite(aqi) or not 0 <= aqi <= 500:
        return [{"title":"Use a cautious routine today","action":"Check an official local air quality source before planning prolonged outdoor exercise. Keep indoor sources low and ventilate when conditions are known to be favorable.","reason":"Current outdoor measurements are unavailable, so conditions cannot be assessed reliably.","benefit":"Avoids treating missing information as clean air.","priority":1,"category":"Today"}]
    people = any(profile.get(k) for k in ("children", "elderly", "sensitive"))
    if aqi > 200:
        first = {"title":"Move strenuous activity indoors","action":"Postpone outdoor sports or choose a cleaner indoor space; recheck conditions before rescheduling.","reason":f"The reported AQI is {aqi} (US AQI); prolonged exertion can increase inhaled pollution.","benefit":"Reduces time spent breathing outdoor pollution during exertion.","priority":1,"category":"Family"}
    elif aqi > 100:
        first = {"title":"Make outdoor time shorter and gentler","action":"Reduce prolonged or strenuous outdoor activity, especially for children and sensitive household members.","reason":f"The reported AQI is {aqi} (US AQI). {'Your profile includes household members who may benefit from extra caution.' if people else 'Consider individual sensitivity and symptoms.'}","benefit":"Limits exposure while preserving flexibility for essential trips.","priority":1,"category":"Family"}
    else:
        first = {"title":"Check again before longer outdoor plans","action":"Use the forecast and current conditions to choose outdoor exercise times; shorten activity if conditions worsen.","reason":"Air quality can change during the day and by neighborhood.","benefit":"Helps align activity with measured conditions.","priority":2,"category":"Today"}
    return [first,
      {"title":"Ventilate when outdoor air is better","action":"Check current outdoor conditions first. If favorable, open windows briefly for cross-ventilation; close them again if pollution rises.","reason":"Ventilation trades indoor pollutants for outdoor air, so timing matters.","benefit":"Supports fresh-air exchange without assuming outdoor air is always cleaner.","priority":2,"category":"Home"},
      {"title":"Keep indoor particle sources low","action":"Use kitchen exhaust that vents outdoors while cooking; avoid indoor smoking and unnecessary incense; damp-dust surfaces.","reason":"Cooking and combustion can add particles indoors even when outdoor air is poor.","benefit":"Can reduce avoidable indoor particle sources.","priority":3,"category":"Home"}]

def answer(question: str, air: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    q = question.casefold()
    items = recommendations(air, profile)
    aqi = air.get("aqi")
    if any(word in q for word in ("window", "ventilat", "open our")):
        rec = items[1] if len(items) > 1 else items[0]
        if aqi is None:
            rec = {**rec, "action":"Check a trusted local air quality source first. If conditions are favorable, ventilate briefly; maintain required ventilation for combustion appliances.", "reason":"No outdoor measurement is available to compare with indoor conditions."}
        elif aqi > 100:
            rec = {**rec, "action":"Outdoor air is currently elevated. Keep windows closed during poor conditions where practical, but do not block required ventilation or combustion appliance flues. Recheck before airing rooms.", "reason":f"The supplied US AQI is {aqi}; opening windows can bring outdoor particles indoors."}
    elif any(word in q for word in ("commute", "cycling", "cycle", "bike", "walk", "travel", "office", "college")):
        rec = {"title":"Choose a lower-exposure trip plan","action":"Use public transport or combine errands when practical. If outdoor AQI is very poor, reduce strenuous walking or cycling and consider a shorter route or postponing optional travel.","reason":"Lower-emission travel can still involve outdoor exposure; the available AQI and trip activity both matter.","benefit":"Can reduce vehicle use while keeping exposure in the decision.","priority":1,"category":"Commute"}
        if aqi is None: rec = {**rec,"action":"Check a trusted local air source before strenuous walking or cycling. Public transport or a shorter trip may reduce time outdoors when needed.","reason":"No current outdoor reading is available, so commute exposure cannot be assessed reliably."}
    else:
        rec = items[0]
    return {"mode":"rule-based", "question":question,
      "summary":"I cannot see a verified current air reading." if aqi is None else f"The reported US AQI is {aqi}.",
      "action":rec["action"], "reason":rec["reason"], "benefit":rec["benefit"], "impact":None,
      "confidence":"Limited: no current measurement is available." if aqi is None else "Moderate: based on supplied measurement and saved profile.",
      "alternative":"Choose a shorter, less strenuous activity indoors if conditions are unclear.",
      "medical_note":"This is general environmental guidance, not diagnosis or treatment."}
