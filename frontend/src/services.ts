import type {AirData, Profile, Recommendation, AssistantAnswer} from './types';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const directCache = new Map<string,{savedAt:number;data:AirData}>();

async function getJson(url:string, init:RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url,{...init,signal:controller.signal});
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return await response.json();
  } finally { window.clearTimeout(timeout); }
}

export async function getAir(lat:number, lon:number, city:string):Promise<AirData>{
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),10000);
  try {
    const r=await fetch(`${API}/api/air?latitude=${lat}&longitude=${lon}&city=${encodeURIComponent(city)}`,{signal:ctl.signal});
    if(!r.ok) throw Error('Air service unavailable');
    return await r.json();
  } catch { return await getOpenMeteoAir(lat,lon,city); }
  finally { clearTimeout(timer); }
}
export async function findCity(name:string):Promise<{latitude:number;longitude:number;city:string;country:string}>{
  try {
    const r=await fetch(`${API}/api/location?name=${encodeURIComponent(name)}`);
    if(!r.ok) throw Error('Location service unavailable');
    return await r.json();
  } catch {
    const result=await getJson(`${GEOCODE_URL}?${new URLSearchParams({name:name.trim(),count:'1',language:'en',format:'json'})}`);
    const item=result.results?.[0];
    if(!item) throw Error('City was not found');
    return {latitude:item.latitude,longitude:item.longitude,city:item.name,country:item.country||''};
  }
}

async function getOpenMeteoAir(latitude:number,longitude:number,city:string):Promise<AirData>{
  const key=`${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached=directCache.get(key);
  if(cached&&Date.now()-cached.savedAt<600000) return {...cached.data,source:'cached',city,note:'Cached Open-Meteo model data; AQI uses the US AQI system.'};
  const params=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),current:'pm2_5,pm10,us_aqi',hourly:'us_aqi',forecast_days:'2',timezone:'auto'});
  const weatherParams=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),current:'temperature_2m,relative_humidity_2m,wind_speed_10m',timezone:'auto'});
  const [air,weather]=await Promise.all([getJson(`${AIR_URL}?${params}`),getJson(`${WEATHER_URL}?${weatherParams}`)]);
  const current=air.current||{}, weatherNow=weather.current||{}, times=air.hourly?.time||[], aqiValues=air.hourly?.us_aqi||[];
  let aqi=validAqi(current.us_aqi);
  if(aqi===null){const index=times.indexOf(current.time);aqi=validAqi(aqiValues[index<0?0:index]);}
  const forecast=times.flatMap((time:string,index:number)=>{
    const value=validAqi(aqiValues[index]);
    return time>String(current.time||'')&&value!==null?[{time:time.slice(11,16),value}]:[];
  }).slice(0,24);
  const data:AirData={source:'live',city,aqi,pm25:nonnegative(current.pm2_5),pm10:nonnegative(current.pm10),
    temperature:finite(weatherNow.temperature_2m),humidity:finite(weatherNow.relative_humidity_2m),wind:finite(weatherNow.wind_speed_10m),
    updated:current.time||null,forecast,note:'Open-Meteo model estimates; AQI uses the US AQI system.'};
  directCache.set(key,{savedAt:Date.now(),data});
  return data;
}

function finite(value:unknown):number|null{
  return typeof value==='number'&&Number.isFinite(value)?value:null;
}
function nonnegative(value:unknown):number|null{
  const number=finite(value);return number!==null&&number>=0?number:null;
}
function validAqi(value:unknown):number|null{
  const number=finite(value);return number!==null&&number>=0&&number<=500?number:null;
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
