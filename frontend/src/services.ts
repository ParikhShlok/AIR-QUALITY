import type {AirData, Profile, Recommendation, AssistantAnswer} from './types';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export async function getAir(lat:number, lon:number, city:string):Promise<AirData>{
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),10000);
  try { const r=await fetch(`${API}/api/air?latitude=${lat}&longitude=${lon}&city=${encodeURIComponent(city)}`,{signal:ctl.signal}); if(!r.ok) throw Error('Air service unavailable'); return await r.json(); }
  finally { clearTimeout(timer); }
}
export async function findCity(name:string):Promise<{latitude:number;longitude:number;city:string;country:string}>{
  const r=await fetch(`${API}/api/location?name=${encodeURIComponent(name)}`); if(!r.ok) throw Error('City lookup unavailable'); return r.json();
}
export async function askAssistant(question:string, air:AirData, profile:Profile):Promise<AssistantAnswer>{
  const r=await fetch(`${API}/api/assistant`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,air,profile})}); if(!r.ok) throw Error('Assistant unavailable'); return r.json() as Promise<AssistantAnswer>;
}
export function localRecommendations(air:AirData,p:Profile):Recommendation[]{
 const severe=air.aqi!==null&&air.aqi>200; const poor=air.aqi!==null&&air.aqi>100; const people=p.children||p.elderly||p.sensitive;
 if(air.aqi===null) return [{title:'Use a cautious routine today',action:'Check an official local air quality source before planning prolonged outdoor exercise. Keep indoor sources low and ventilate when conditions are known to be favorable.',reason:'Current outdoor measurements are unavailable, so conditions cannot be assessed reliably.',benefit:'Avoids treating missing information as clean air.',priority:1,category:'Today'}];
 const items:Recommendation[]=[];
 if(severe) items.push({title:'Move strenuous activity indoors',action:'Postpone outdoor sports or choose a cleaner indoor space; recheck conditions before rescheduling.',reason:`The reported AQI is ${air.aqi} (US AQI); prolonged exertion can increase inhaled pollution.`,benefit:'Reduces time spent breathing outdoor pollution during exertion.',priority:1,category:'Family'});
 else if(poor) items.push({title:'Make outdoor time shorter and gentler',action:'Reduce prolonged or strenuous outdoor activity, especially for children and sensitive household members.',reason:`The reported AQI is ${air.aqi} (US AQI). ${people?'Your profile includes household members who may benefit from extra caution.':'Consider individual sensitivity and symptoms.'}`,benefit:'Limits exposure while preserving flexibility for essential trips.',priority:1,category:'Family'});
 else items.push({title:'Check again before longer outdoor plans',action:'Use the forecast and current conditions to choose outdoor exercise times; shorten activity if conditions worsen.',reason:'Air quality can change during the day and by neighborhood.',benefit:'Helps align activity with measured conditions.',priority:2,category:'Today'});
 items.push({title:'Ventilate when outdoor air is better',action:'Check current outdoor conditions first. If favorable, open windows briefly for cross-ventilation; close them again if pollution rises.',reason:'Ventilation trades indoor pollutants for outdoor air, so timing matters.',benefit:'Supports fresh-air exchange without assuming outdoor air is always cleaner.',priority:2,category:'Home'});
 items.push({title:'Keep indoor particle sources low',action:'Use kitchen exhaust that vents outdoors while cooking; avoid indoor smoking and unnecessary incense; damp-dust surfaces.',reason:'Cooking and combustion can add particles indoors even when outdoor air is poor.',benefit:'Can reduce avoidable indoor particle sources.',priority:3,category:'Home'});
 return items;
}
