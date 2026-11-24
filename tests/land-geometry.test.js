import test from 'node:test';
import assert from 'node:assert/strict';
import {measure} from '../src/land-geometry.js';
function testGeometry(measure){
 const deg=180/Math.PI/6371008.8;
 const pt=(x,y)=>({lat:y*deg,lon:x*deg});
 const rect=[pt(0,0),pt(40,0),pt(40,30),pt(0,30)];
 const cases=[
 ["rectangle",()=>{const r=measure(rect);return r.valid&&Math.abs(r.area-1200)<.001&&Math.abs(r.perimeter-140)<.001}],
 ["reverse winding",()=>Math.abs(measure([...rect].reverse()).area-1200)<.01],
 ["triangle",()=>Math.abs(measure(rect.slice(0,3)).area-600)<.001],
 ["self crossing",()=>!measure([rect[0],rect[2],rect[1],rect[3]]).valid],
 ["duplicate",()=>!measure([rect[0],rect[1],rect[1],rect[3]]).valid],
 ["collinear",()=>!measure([pt(0,0),pt(10,0),pt(20,0)]).valid],
 ["invalid coordinate",()=>!measure([{lat:100,lon:0},rect[1],rect[2]]).valid],
 ["concave",()=>Math.abs(measure([pt(0,0),pt(40,0),pt(40,30),pt(20,15),pt(0,30)]).area-900)<.001],
 ["too few",()=>!measure(rect.slice(0,2)).valid],
 ["dateline",()=>{const r=measure([{lat:0,lon:179.9999},{lat:0,lon:-179.9999},{lat:.0001,lon:-179.9999},{lat:.0001,lon:179.9999}]);return r.valid&&r.area>200&&r.area<300}],
 ["overlap",()=>!measure([pt(0,0),pt(40,0),pt(20,0),pt(40,30),pt(0,30)]).valid],
 ["distance limit",()=>!measure([pt(0,0),pt(20000,0),pt(0,30)]).valid]
 ]; return cases.map(([name,fn])=>({name,pass:!!fn()}));
}
for (const {name,pass} of testGeometry(measure)) test(name,()=>assert.equal(pass,true));
