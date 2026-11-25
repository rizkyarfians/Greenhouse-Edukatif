import './land-scanner.css';
import {measure} from './land-geometry.js';
import {landType} from './land-type.js';
import {createCameraOverlay} from './land-camera-overlay.js';
const $=id=>document.getElementById(id);
const key='automotion.land.v1';
const requested=new URLSearchParams(location.search).get('type');
try{const saved=JSON.parse(localStorage.getItem(key)||'null');$('land-type').value=landType(requested||saved?.landType);}catch{$('land-type').value=landType(requested);}
let points=[], edit=-1, stream=null, opening=false, cameraRequest=0, locating=false, positionRequest=0;
const cameraOverlay = createCameraOverlay({
  button: $('camera-markers-toggle'),
  overlay: $('camera-overlay'),
  markers: $('camera-markers'),
  message: $('camera-direction'),
  getPoints: () => points,
});
const fmt=(n,d=1)=>n.toLocaleString('id-ID',{maximumFractionDigits:d});
const status=t=>{$('status').textContent=t;};
const saveStatus=t=>{$('save-status').textContent=t;};
const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs,text)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
function render(){
  const r=measure(points);
  $('point-count').textContent=points.length+' patok';
  $('area').textContent=r.valid?fmt(r.area)+' m²':'—';
  $('hectare').textContent=r.valid?fmt(r.area/10000,4)+' ha':'';
  $('perimeter').textContent=r.valid?fmt(r.perimeter)+' m':'—';
  $('geometry-status').textContent=r.valid?'Polygon valid. Pastikan seluruh titik sesuai batas fisik.':r.error;
  $('save').disabled=$('download').disabled=!r.valid;
  $('undo').disabled=!points.length||locating;$('clear').disabled=!points.length;
  $('gps-add').disabled=locating||points.length>=200;
  const acc=points.filter(p=>Number.isFinite(p.accuracy)).map(p=>p.accuracy);
  const max=acc.length?Math.max(...acc):null;
  const unknown=points.length-acc.length;
  $('quality').textContent=points.length?'Akurasi GPS terburuk yang dilaporkan: '+(max===null?'tidak tersedia':'±'+fmt(max)+' m')+(unknown?' · '+unknown+' titik manual/tanpa akurasi':'')+'. '+(max!==null&&(max>10||(r.valid&&max*r.perimeter/r.area>.2))?'Ketidakpastian relatif terhadap ukuran lahan tinggi; ukur ulang atau gunakan referensi terukur.':'Akurasi titik bukan jaminan akurasi luas.'):'Belum ada data GPS.';
  $('map-link').hidden=!r.valid;if(r.valid)$('map-link').href='https://www.openstreetmap.org/?mlat='+r.center.lat+'&mlon='+r.center.lon+'#map=18/'+r.center.lat+'/'+r.center.lon;
  const list=$('point-list');list.replaceChildren();
  points.forEach((p,i)=>{
    const li=document.createElement('li'), desc=document.createElement('div'), title=document.createElement('strong'), detail=document.createElement('small');
    title.textContent='Patok '+(i+1);detail.textContent=p.lat.toFixed(6)+', '+p.lon.toFixed(6)+' · '+(p.accuracy==null?'Manual':'GPS ±'+fmt(p.accuracy)+' m');desc.append(title,detail);
    const actions=document.createElement('div');actions.className='ls-point-actions';
    for(const [label,fn,disabled] of [['↑',()=>{[points[i-1],points[i]]=[points[i],points[i-1]];resetEdit();render();},i===0],['↓',()=>{[points[i+1],points[i]]=[points[i],points[i+1]];resetEdit();render();},i===points.length-1],['Edit',()=>{edit=i;$('lat').value=p.lat;$('lon').value=p.lon;$('manual-submit').textContent='Simpan koreksi';$('cancel-edit').hidden=false;$('manual-form').parentElement.open=true;$('lat').focus();},false],['×',()=>{points.splice(i,1);resetEdit();render();},false]]){
      const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.disabled=disabled||locating;b.setAttribute('aria-label',label+' patok '+(i+1));b.addEventListener('click',fn);actions.append(b);
    }li.append(desc,actions);list.append(li);
  });
  const svg=$('diagram');svg.replaceChildren();
  for(let x=20;x<360;x+=20)svg.append(el('line',{x1:x,y1:0,x2:x,y2:260,stroke:'#dce6d9','stroke-width':1}));
  for(let y=20;y<260;y+=20)svg.append(el('line',{x1:0,y1:y,x2:360,y2:y,stroke:'#dce6d9','stroke-width':1}));
  svg.append(el('text',{x:334,y:19,'text-anchor':'middle',fill:'#526b57','font-size':11},'↑ N'));
  if(!points.length){svg.append(el('text',{x:180,y:130,'text-anchor':'middle',fill:'#526b57','font-size':14},'Belum ada patok'));return;}
  const lat0=points[0].lat,lon0=points[0].lon,cos=Math.cos(lat0*Math.PI/180);
  const xy=points.map(p=>[(((p.lon-lon0+540)%360)-180)*cos,p.lat-lat0]);
  const minX=Math.min(...xy.map(p=>p[0])),maxX=Math.max(...xy.map(p=>p[0])),minY=Math.min(...xy.map(p=>p[1])),maxY=Math.max(...xy.map(p=>p[1]));
  const scale=Math.min(280/Math.max(maxX-minX,1e-8),180/Math.max(maxY-minY,1e-8));
  const screen=xy.map(p=>[180+(p[0]-(minX+maxX)/2)*scale,130-(p[1]-(minY+maxY)/2)*scale]);
  if(screen.length>=2)svg.append(el(screen.length>=3?'polygon':'polyline',{points:screen.map(p=>p.join(',')).join(' '),fill:r.valid?'#7fbd9144':'none',stroke:r.valid?'#246348':'#b46c3b','stroke-width':2.5,'stroke-dasharray':r.valid?'none':'5 4'}));
  screen.forEach(([x,y],i)=>{svg.append(el('circle',{cx:x,cy:y,r:8,fill:'#246348',stroke:'white','stroke-width':2}));svg.append(el('text',{x,y:y+3.5,'text-anchor':'middle',fill:'white','font-size':9},i+1));});
}
function resetEdit(){edit=-1;$('manual-form').reset();$('manual-submit').textContent='Tambah koordinat';$('cancel-edit').hidden=true;}
function stopCamera(){cameraOverlay.stop();$('camera-markers-toggle').hidden=true;cameraRequest++;opening=false;stream?.getTracks().forEach(t=>t.stop());stream=null;$('camera').srcObject=null;$('camera').hidden=true;$('camera-placeholder').hidden=false;$('camera-toggle').textContent='Buka kamera';$('camera-toggle').disabled=false;$('camera-state').textContent='Kamera opsional';}
$('camera-toggle').addEventListener('click',async()=>{
 if(stream||opening){stopCamera();return;}
 if(!navigator.mediaDevices?.getUserMedia){status('Kamera tidak tersedia. Gunakan HTTPS atau masukkan koordinat manual.');return;}
 const request=++cameraRequest;opening=true;$('camera-toggle').disabled=true;
 try{const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});if(request!==cameraRequest){next.getTracks().forEach(t=>t.stop());return;}stream=next;$('camera').srcObject=stream;$('camera').hidden=false;$('camera-placeholder').hidden=true;$('camera-state').textContent='Kamera aktif · GPS mengukur posisi HP';$('camera-toggle').textContent='Tutup kamera';$('camera-markers-toggle').hidden=false;}
 catch(e){if(request===cameraRequest)status('Kamera tidak dapat dibuka. Periksa izin atau gunakan GPS saja.');}
 finally{if(request===cameraRequest){opening=false;$('camera-toggle').disabled=false;}}
});
$('gps-add').addEventListener('click',()=>{
 if(locating||points.length>=200)return;
 if(!navigator.geolocation){status('GPS tidak tersedia. Gunakan HTTPS atau koordinat manual.');return;}
 locating=true;const request=++positionRequest;render();status('Mengambil lokasi GPS…');
 navigator.geolocation.getCurrentPosition(pos=>{
  if(request!==positionRequest)return;locating=false;
  const {latitude:lat,longitude:lon,accuracy}=pos.coords;
  if(Date.now()-pos.timestamp>30000||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180){status('Lokasi tidak valid atau terlalu lama. Coba lagi.');render();return;}
  points.push({lat,lon,accuracy:Number.isFinite(accuracy)?accuracy:null,source:'gps',capturedAt:new Date(pos.timestamp).toISOString()});status('Patok '+points.length+' tersimpan'+(accuracy>10?' · akurasi rendah, pertimbangkan koreksi.':'.'));render();
 },err=>{if(request!==positionRequest)return;locating=false;status('GPS gagal: '+({1:'izin ditolak',2:'lokasi tidak tersedia',3:'waktu habis'}[err.code]||'kesalahan lokasi')+'. Coba kembali atau input manual.');render();},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
});
$('manual-form').addEventListener('submit',e=>{e.preventDefault();if(locating){status('Tunggu GPS selesai.');return;}if(edit<0&&points.length>=200){status('Maksimal 200 patok.');return;}const lat=$('lat').valueAsNumber,lon=$('lon').valueAsNumber;if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180){status('Koordinat tidak valid.');return;}const p={lat,lon,accuracy:null,source:'manual',capturedAt:new Date().toISOString()};if(edit>=0)points[edit]=p;else points.push(p);resetEdit();status('Koordinat manual disimpan.');render();});
$('cancel-edit').addEventListener('click',resetEdit);
$('undo').addEventListener('click',()=>{points.pop();resetEdit();render();});
$('clear').addEventListener('click',()=>{if(!confirm('Kosongkan patok yang sedang diedit? Simpanan tetap tersedia.'))return;positionRequest++;locating=false;points=[];resetEdit();status('Patok dikosongkan.');render();});
function project(){const m=measure(points);if(!m.valid)return null;return {version:1,landType:landType($('land-type').value),name:$('project-name').value.trim()||'Lahan tanpa nama',points:points.map(p=>({...p})),areaM2:m.area,perimeterM:m.perimeter,center:m.center,updatedAt:new Date().toISOString(),method:'local-tangent-plane-estimate'};}
$('save').addEventListener('click',()=>{const p=project();if(!p)return;try{if(localStorage.getItem(key)&&!confirm('Ganti profil lahan yang tersimpan di browser ini?'))return;localStorage.setItem(key,JSON.stringify(p));saveStatus('Profil disimpan di browser ini: '+p.name);}catch(e){saveStatus('Gagal menyimpan. Gunakan Ekspor GeoJSON.');}});
$('restore').addEventListener('click',()=>{if(locating){saveStatus('Tunggu GPS selesai.');return;}try{const raw=localStorage.getItem(key);if(!raw){saveStatus('Belum ada profil tersimpan.');return;}const p=JSON.parse(raw);if(p.version!==1||!measure(p.points).valid)throw Error('Invalid');if(points.length&&!confirm('Ganti patok saat ini dengan profil tersimpan?'))return;points=p.points.map(q=>({lat:q.lat,lon:q.lon,accuracy:Number.isFinite(q.accuracy)&&q.accuracy>=0?q.accuracy:null,source:q.source==='gps'?'gps':'manual',capturedAt:q.capturedAt}));$('project-name').value=typeof p.name==='string'?p.name:'';$('land-type').value=landType(p.landType);resetEdit();render();saveStatus('Profil dibuka.');}catch(e){saveStatus('Simpanan tidak tersedia atau rusak.');}});
$('delete-save').addEventListener('click',()=>{if(!confirm('Hapus profil yang tersimpan di browser ini?'))return;try{localStorage.removeItem(key);saveStatus('Simpanan dihapus.');}catch(e){saveStatus('Gagal menghapus simpanan.');}});
$('download').addEventListener('click',()=>{const p=project();if(!p)return;let ring=p.points.map(q=>[q.lon,q.lat]);const xy=measure(p.points).xy;const signed=xy.reduce((s,a,i)=>{const b=xy[(i+1)%xy.length];return s+a[0]*b[1]-b[0]*a[1];},0);if(signed<0)ring.reverse();ring.push([...ring[0]]);const geo={type:'Feature',geometry:{type:'Polygon',coordinates:[ring]},properties:p};const url=URL.createObjectURL(new Blob([JSON.stringify(geo,null,2)],{type:'application/geo+json'}));const a=document.createElement('a');a.href=url;a.download='automotion-land.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCamera();positionRequest++;locating=false;render();}});
window.addEventListener('pagehide',stopCamera);
if(!window.isSecureContext)status('Kamera/GPS biasanya memerlukan HTTPS atau localhost. Input manual tetap tersedia.');
render();