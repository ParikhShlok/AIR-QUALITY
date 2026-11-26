from typing import Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.services.air_quality import fetch_air, geocode_city
from app.services.assistant import respond
from app.services.impact import estimate

app = FastAPI(title="AirAware AI API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    air: dict[str, Any] = Field(default_factory=dict)
    profile: dict[str, Any] = Field(default_factory=dict)

class ImpactRequest(BaseModel):
    distance_km: float = Field(ge=0, le=500)
    alternative: str = Field(min_length=1, max_length=30)
    workdays: int = Field(default=5, ge=1, le=7)

@app.get("/api/health")
async def health(): return {"status":"ok"}

@app.get("/api/air")
async def air(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180), city: str = Query(default="Selected location", max_length=100)):
    try: return await fetch_air(latitude, longitude, city.strip() or "Selected location")
    except Exception as exc: raise HTTPException(status_code=503, detail="Live air data is temporarily unavailable.") from exc

@app.get("/api/location")
async def location(name: str = Query(min_length=2, max_length=100)):
    try: return await geocode_city(name.strip())
    except LookupError as exc: raise HTTPException(status_code=404, detail="City was not found.") from exc
    except Exception as exc: raise HTTPException(status_code=503, detail="Location lookup is temporarily unavailable.") from exc

@app.post("/api/assistant")
async def assistant(request: AssistantRequest):
    return await respond(request.question.strip(), request.air, request.profile)

@app.post("/api/impact")
async def impact(request: ImpactRequest):
    try: return estimate(request.distance_km, request.alternative.casefold(), request.workdays)
    except ValueError as exc: raise HTTPException(status_code=422, detail=str(exc)) from exc
