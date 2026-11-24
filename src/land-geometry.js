export function measure(points) {
  const R=6371008.8, rad=Math.PI/180;
  if(!Array.isArray(points)||points.length<3) return {valid:false,error:'Minimal tiga patok diperlukan.'};
  if(points.length>200 || points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>85||Math.abs(p.lon)>180)) return {valid:false,error:'Koordinat tidak valid.'};
  const lat0=points[0].lat,lon0=points[0].lon,cos=Math.cos(lat0*rad);
  const xy=points.map(p=>[R*(((p.lon-lon0+540)%360)-180)*rad*cos,R*(p.lat-lat0)*rad]);
  const n=xy.length;
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  if(xy.some(p=>dist(p,[0,0])>10000)) return {valid:false,error:'Cakupan lebih dari 10 km; metode lokal tidak didukung.'};
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(dist(xy[i],xy[j])<.2) return {valid:false,error:'Patok terlalu dekat atau duplikat.'};
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const sign=v=>Math.abs(v)<1e-7?0:Math.sign(v);
  const on=(a,b,c)=>c[0]>=Math.min(a[0],b[0])-1e-7&&c[0]<=Math.max(a[0],b[0])+1e-7&&c[1]>=Math.min(a[1],b[1])-1e-7&&c[1]<=Math.max(a[1],b[1])+1e-7;
  const intersects=(a,b,c,d)=>{
    const s=[sign(cross(a,b,c)),sign(cross(a,b,d)),sign(cross(c,d,a)),sign(cross(c,d,b))];
    return (s[0]*s[1]<0&&s[2]*s[3]<0)||(!s[0]&&on(a,b,c))||(!s[1]&&on(a,b,d))||(!s[2]&&on(c,d,a))||(!s[3]&&on(c,d,b));
  };
  for(let i=0;i<n;i++) {
    const prev=xy[(i+n-1)%n],a=xy[i],b=xy[(i+1)%n];
    if(sign(cross(prev,a,b))===0&&((prev[0]-a[0])*(b[0]-a[0])+(prev[1]-a[1])*(b[1]-a[1]))>0) return {valid:false,error:'Garis batas bertumpuk.'};
    for(let j=i+1;j<n;j++){
      if(j===i+1||(i===0&&j===n-1)) continue;
      if(intersects(a,b,xy[j],xy[(j+1)%n])) return {valid:false,error:'Garis batas berpotongan. Urutkan patok mengelilingi lahan.'};
    }
  }
  let twice=0,cx=0,cy=0,perimeter=0;
  for(let i=0;i<n;i++){const a=xy[i],b=xy[(i+1)%n],c=a[0]*b[1]-b[0]*a[1];twice+=c;cx+=(a[0]+b[0])*c;cy+=(a[1]+b[1])*c;perimeter+=dist(a,b);}
  const area=Math.abs(twice)/2;
  if(area<1) return {valid:false,error:'Luas terlalu kecil atau patok segaris.'};
  const center={lat:lat0+cy/(3*twice)/R/rad,lon:((lon0+cx/(3*twice)/R/rad/cos+540)%360)-180};
  return {valid:true,area,perimeter,center,xy};
}
