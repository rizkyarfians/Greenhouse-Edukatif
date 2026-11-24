import test from 'node:test';
import assert from 'node:assert/strict';
import {crops} from '../src/crop-database.js';
import {rangeScore,extractClimate,assess,rank} from '../src/recommendation-core.js';
function checks(){
 const c=crops[1],rice=crops[0],land={areaM2:1200,usable:80,ph:6.5,soil:'loam',drain:'good',water:'reliable'},cl={temperature:26,seasonRain:null,forecastMax:31};
 const r=assess(c,land,cl),missing=assess(c,{...land,ph:null,water:'unknown'},cl);
 const p={fetchedAt:'2026-11-24T00:00:00Z',history:{summary:{temperature:{value:26,days:90,expected:90},rain:{value:200,days:89,expected:90}}},baseline:{months:[{month:12,years:10,temperatureC:24,rainMm:100},{month:1,years:9,temperatureC:25,rainMm:200},{month:2,years:10,temperatureC:26,rainMm:300}]}};
 return [['ten unique crops',crops.length===10&&new Set(crops.map(c=>c.id)).size===10],['full coverage',r.coverage===100&&r.verdict==='candidate'],['population',r.population===5120],['unknown does not pass',missing.verdict==='incomplete'&&missing.coverage===60],['waterlogging blocks',assess(c,{...land,drain:'paddy'},cl).verdict==='blocked'],['rice water limited blocks',assess(rice,{...land,drain:'paddy',water:'limited'},cl).verdict==='blocked'],['temperature blocks',assess(c,land,{...cl,temperature:45}).verdict==='blocked'],['pH blocks',assess(c,{...land,ph:3},cl).verdict==='blocked'],['unknown climate',assess(c,land,{...cl,temperature:null}).verdict==='incomplete'],['ranking blocked last',rank(crops,{...land,drain:'paddy'},cl).at(-1).verdict==='blocked'],['season next year',extractClimate(p,'2026-11-24T01:00:00Z').temperature===25&&extractClimate(p,'2026-11-24T01:00:00Z').seasonRain===600],['partial rain missing',extractClimate(p,'2026-11-24T01:00:00Z').rain===null],['stale climate',extractClimate(p,'2027-01-01T00:00:00Z').temperature===null],['season fallback',extractClimate(p,'2026-12-01T00:00:00Z').temperature===26],['range interpolation',rangeScore(16,[20,30],[12,38])===.5]];
}
for(const [name,pass] of checks())test(name,()=>assert.equal(pass,true));
