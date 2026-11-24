export function makeLayout(xy,spacing,usable=80,maxVisual=3000){
 if(!Array.isArray(xy)||xy.length<3||xy.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('Polygon tidak valid.');
 if(!Array.isArray(spacing)||spacing.length!==2||spacing.some(v=>!Number.isFinite(v)||v<.1||v>20)||!Number.isFinite(usable)||usable<1||usable>100||!Number.isInteger(maxVisual)||maxVisual<1||maxVisual>5000)throw Error('Parameter layout tidak valid.');
 const minX=Math.min(...xy.map(p=>p[0])),maxX=Math.max(...xy.map(p=>p[0])),minY=Math.min(...xy.map(p=>p[1])),maxY=Math.max(...xy.map(p=>p[1]));
 const width=maxX-minX,depth=maxY-minY;
 if(width<=0||depth<=0||Math.max(width,depth)>20000)throw Error('Dimensi lahan di luar batas.');
 const origin=[(minX+maxX)/2,(minY+maxY)/2],polygon=xy.map(p=>[p[0]-origin[0],p[1]-origin[1]]);
 const area=Math.abs(polygon.reduce((s,p,i)=>{const q=polygon[(i+1)%polygon.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
 const [dx,dy]=spacing,rows=[],totals={A:0,B:0};
 const x0=-width/2+dx/2,y0=-depth/2+dy/2;
 const rowCount=Math.floor(width/dx+1e-8);
 if(rowCount*polygon.length>15000000)throw Error('Lahan terlalu kompleks untuk kalkulasi di perangkat ini.');
 for(let i=0;i<rowCount;i++){
  const x=x0+i*dx,zone=x<0?'A':'B',cross=[];
  for(let j=0;j<polygon.length;j++){
   const a=polygon[j],b=polygon[(j+1)%polygon.length];
   if((a[0]<=x&&x<b[0])||(b[0]<=x&&x<a[0]))cross.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));
  }
  cross.sort((a,b)=>a-b);
  for(let j=0;j+1<cross.length;j+=2){
   const lo=cross[j],hi=cross[j+1];
   const first=Math.max(0,Math.ceil((lo+dy/2-y0)/dy-1e-8)),last=Math.floor((hi-dy/2-y0)/dy+1e-8);
   if(last<first)continue;
   const count=last-first+1;
   rows.push({x,lo,hi,first,count,zone,start:totals[zone]});totals[zone]+=count;
  }
 }
 const total=totals.A+totals.B,capacity=Math.min(total,Math.floor(area*usable/100/(dx*dy)+1e-8));
 const allocated={A:total?Math.round(capacity*totals.A/total):0,B:0};allocated.B=capacity-allocated.A;
 const visualCount=Math.min(capacity,maxVisual);
 const visual={A:capacity?Math.round(visualCount*allocated.A/capacity):0,B:0};visual.B=visualCount-visual.A;
 const samples=[],lines=[],anchors={};
 for(const zone of ['A','B']){
  const rr=rows.filter(r=>r.zone===zone);
  if(rr.length){
   const anchor=rr.reduce((a,b)=>a.count>=b.count?a:b);
   anchors[zone]=[anchor.x,y0+(anchor.first+Math.floor((anchor.count-1)/2))*dy];
  }
  let j=0;
  for(let k=0;k<visual[zone];k++){
   const planned=Math.floor((k+.5)*allocated[zone]/visual[zone]);
   const idx=Math.min(totals[zone]-1,Math.floor((planned+.5)*totals[zone]/allocated[zone]));
   while(j+1<rr.length&&idx>=rr[j].start+rr[j].count)j++;
   const r=rr[j];samples.push({x:r.x,y:y0+(r.first+idx-r.start)*dy,zone});
  }
  const n=Math.min(60,rr.length);
  for(let k=0;k<n;k++){
   const r=rr[Math.floor((k+.5)*rr.length/n)];
   lines.push({x:r.x,from:y0+r.first*dy,to:y0+(r.first+r.count-1)*dy,zone});
  }
 }
 return {polygon,area,width,depth,capacity,total,allocated,samples,lines,anchors,spacing,usable};
}
