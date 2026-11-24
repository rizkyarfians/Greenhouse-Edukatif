import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout} from '../src/farm-layout.js';
function inside(p,polygon){
 let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;
}
function runTests(){
 const rect=[[0,0],[40,0],[40,30],[0,30]],r=makeLayout(rect,[.75,.25],80),concave=[[0,0],[40,0],[40,10],[10,10],[10,30],[0,30]],c=makeLayout(concave,[.25,.25],100,1000);
 const tiny=makeLayout([[0,0],[.3,0],[.3,10],[0,10]],[1,1],80);
 const large=makeLayout([[0,0],[500,0],[500,500],[0,500]],[.2,.15],80,3000);
 const reject=f=>{try{f();return false;}catch{return true;}};
 return [['rectangle area',r.area===1200],['capacity target',r.capacity===5120],['sample cap',r.samples.length===3000],['zone totals',r.allocated.A+r.allocated.B===r.capacity],['samples inside',r.samples.every(p=>inside([p.x,p.y],r.polygon))],['concave area',c.area===600],['concave clipping',c.samples.every(p=>inside([p.x,p.y],c.polygon))],['lines inside',c.lines.every(l=>inside([l.x,(l.from+l.to)/2],c.polygon))],['reverse winding',makeLayout([...rect].reverse(),[.75,.25],80).capacity===r.capacity],['tiny no rows',tiny.capacity===0&&tiny.samples.length===0],['large bounded',large.samples.length===3000&&large.capacity>100000],['invalid spacing',reject(()=>makeLayout(rect,[0,.5],80))],['invalid area fraction',reject(()=>makeLayout(rect,[.5,.5],101))],['unique visuals',new Set(r.samples.map(p=>p.x+','+p.y)).size===r.samples.length]];
}
for(const [name,pass] of runTests())test(name,()=>assert.equal(pass,true));
