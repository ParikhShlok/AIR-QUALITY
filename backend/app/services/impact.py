"""Indicative transport emission calculation using documented reference factors."""
FACTORS = {"average gasoline car":0.249, "bus":0.10151, "metro":0.02444,
           "walking":0.0, "cycling":0.0, "carpool":0.1245}

def estimate(distance_km: float, alternative: str, workdays: int = 5) -> dict:
    if distance_km < 0 or distance_km > 500:
        raise ValueError("Distance must be between 0 and 500 km.")
    if alternative not in FACTORS or alternative == "average gasoline car":
        raise ValueError("Choose a supported lower-emission alternative.")
    daily = max(0.0, distance_km * 2 * (FACTORS["average gasoline car"] - FACTORS[alternative]))
    return {"kg_co2e_per_round_trip":round(daily, 4), "kg_co2e_per_week":round(daily * workdays, 4),
            "workdays":workdays, "formula":"2 × one-way km × (vehicle factor − alternative factor)"}
