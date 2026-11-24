import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftDate,summarizeDaily,seasonalBaseline} from '../src/climate-core.js';
function runChecks(){
 const d={time:['2024-02-28','2024-02-29','2024-03-01'],precipitation_sum:[0,null,12],temperature_2m_mean:[25,27,29],relative_humidity_2m_mean:[80,0,100],et0_fao_evapotranspiration:[2,3,4]};
 const s=summarizeDaily(d,'2024-02-28','2024-03-02');
 const baseline=seasonalBaseline({time:Array.from({length:31},(_,i)=>'2020-01-'+String(i+1).padStart(2,'0')),precipitation_sum:Array(31).fill(2),temperature_2m_mean:Array(31).fill(25)},2020,2021,[1,2]);
 return [['leap day',shiftDate('2024-02-28',1)==='2024-02-29'],['year rollover',shiftDate('2025-12-31',1)==='2026-01-01'],['missing day',s.expectedDays===4&&s.summary.temperature.days===3],['null rain not zero',s.summary.rain.value===12&&s.summary.rain.days===2],['zero valid',s.summary.humidity.days===3&&s.summary.humidity.value===60],['monthly groups',s.months.length===2&&s.months[0].rain.days===1],['ET0',s.summary.et0.value===9&&s.summary.et0.days===3],['rain days',s.summary.rainyDays.value===1&&s.summary.rainyDays.days===2],['baseline full months only',baseline[0].years===1&&baseline[0].rainMm===62&&baseline[0].temperatureC===25],['baseline missing month',baseline[1].years===0&&baseline[1].rainMm===null]];
}
for(const [name,pass] of runChecks())test(name,()=>assert.equal(pass,true));
