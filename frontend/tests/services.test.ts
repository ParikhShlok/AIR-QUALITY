import {describe,expect,it,vi} from 'vitest';
import {findCity,getAir} from '../src/services';

const json=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});

describe('API fallbacks for static hosting',()=>{
  it('uses Open-Meteo geocoding when the backend is unavailable',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.includes('localhost:8000')) throw new TypeError('connection refused');
      return json({results:[{latitude:19.07,longitude:72.87,name:'Mumbai',country:'India'}]});
    }));
    await expect(findCity('Mumbai')).resolves.toEqual({latitude:19.07,longitude:72.87,city:'Mumbai',country:'India'});
  });

  it('retrieves and labels live Open-Meteo data when backend is unavailable',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.includes('localhost:8000')) throw new TypeError('connection refused');
      if(url.includes('air-quality-api')) return json({current:{time:'2026-11-28T12:00',us_aqi:78,pm2_5:18,pm10:31},hourly:{time:['2026-11-28T12:00','2026-11-28T13:00'],us_aqi:[78,74]}});
      return json({current:{temperature_2m:28,relative_humidity_2m:50,wind_speed_10m:8}});
    }));
    const data=await getAir(19.07,72.87,'Mumbai');
    expect(data.source).toBe('live');
    expect(data.aqi).toBe(78);
    expect(data.pm25).toBe(18);
    expect(data.forecast).toEqual([{time:'13:00',value:74}]);
    expect(data.note).toContain('Open-Meteo');
  });
});
