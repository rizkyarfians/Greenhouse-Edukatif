import './land-scanner.css';
import {browserLand, landStore} from './land-storage.js';
import {storageError} from './account-storage-api.js';
import {landProfile} from './land-profile.js';
import {measure} from './land-geometry.js';
import {landType} from './land-type.js';
import {createCameraOverlay} from './land-camera-overlay.js';
const $=id=>document.getElementById(id);
const requested=new URLSearchParams(location.search).get('type');
$('land-type').value=landType(requested);
let store, stored = null, storageBusy = true;
let storageSession = landStore();
let savedSignature;
let points=[], edit=-1, stream=null, opening=false, cameraRequest=0, locating=false, positionRequest=0;
const cameraOverlay = createCameraOverlay({
  button: $('camera-markers-toggle'),
  overlay: $('camera-overlay'),
  markers: $('camera-markers'),
  models: $('camera-stake-models'),
  message: $('camera-direction'),
  savedStake: $('camera-saved-stake'),
  camera: $('camera'),
  getPoints: () => points,
});
const fmt=(n,d=1)=>n.toLocaleString('id-ID',{maximumFractionDigits:d});
const cameraDialog = $('camera-dialog');
const status = text => {
  $('status').textContent = text;
  if (cameraDialog.open) $('camera-status').textContent = text;
};
const saveStatus=t=>{$('save-status').textContent=t;};
const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs,text)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
function render(){
  const r=measure(points);
  $('point-count').textContent=points.length+' patok';
  $('camera-count').textContent = $('point-count').textContent;
  $('area').textContent=r.valid?fmt(r.area)+' m²':'—';
  $('hectare').textContent=r.valid?fmt(r.area/10000,4)+' ha':'';
  $('perimeter').textContent=r.valid?fmt(r.perimeter)+' m':'—';
  $('geometry-status').textContent=r.valid?'Polygon valid. Pastikan seluruh titik sesuai batas fisik.':r.error;
  $('save').disabled=storageBusy || locating || !points.length;
  $('restore').disabled=storageBusy || locating;
  $('delete-save').disabled=storageBusy || !stored?.profile;
  $('import-browser-land').disabled=storageBusy || locating;
  $('download').disabled=!r.valid;
  if (store) {
    const pending = points.length && profileSignature() !== savedSignature;
    $('storage-description').textContent = pending ? 'Ada perubahan yang belum disimpan. Tekan Simpan patok.' :
      store.account ? 'Patok disimpan ke akun Google ini.' :
        'Mode tamu menyimpan patok di browser ini. Masuk lewat beranda untuk membukanya dari browser lain.';
  }
  $('undo').disabled=!points.length||locating;$('clear').disabled=!points.length;
  $('gps-add').disabled=locating||points.length>=200;
  $('camera-add').disabled = $('gps-add').disabled;
  $('camera-add').textContent = locating ? 'Mengambil lokasi…' : '+ Tambah patok GPS';
  $('camera-undo').disabled = $('undo').disabled;
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
function stopCamera() {
  cameraOverlay.stop();
  cameraRequest++;
  opening = false;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  $('camera').srcObject = null;
  if (cameraDialog.open) cameraDialog.close();
  $('camera-toggle').disabled = false;
}

$('camera-toggle').addEventListener('click', async () => {
  if (stream || opening) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    status('Kamera tidak tersedia. Gunakan HTTPS atau masukkan koordinat manual.');
    return;
  }

  const request = ++cameraRequest;
  opening = true;
  $('camera-toggle').disabled = true;
  try {
    const next = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    if (request !== cameraRequest) {
      next.getTracks().forEach(track => track.stop());
      return;
    }

    stream = next;
    $('camera').srcObject = stream;
    cameraDialog.showModal();
    $('camera-status').textContent = 'Datangi patok, lalu tekan Tambah patok GPS.';
    cameraOverlay.startAutomatically();
  } catch {
    if (request === cameraRequest) {
      stopCamera();
      status('Kamera tidak dapat dibuka. Periksa izin atau gunakan GPS saja.');
    }
  } finally {
    if (request === cameraRequest) {
      opening = false;
      $('camera-toggle').disabled = false;
    }
  }
});

$('camera-close').addEventListener('click', stopCamera);
cameraDialog.addEventListener('cancel', event => {
  event.preventDefault();
  stopCamera();
});
$('camera-add').addEventListener('click', () => $('gps-add').click());
$('camera-undo').addEventListener('click', () => $('undo').click());
$('gps-add').addEventListener('click',()=>{
 if(locating||points.length>=200)return;
 if(!navigator.geolocation){status('GPS tidak tersedia. Gunakan HTTPS atau koordinat manual.');return;}
 locating=true;const request=++positionRequest;render();status('Mengambil lokasi GPS…');
 navigator.geolocation.getCurrentPosition(pos=>{
  if(request!==positionRequest)return;locating=false;
  const {latitude:lat,longitude:lon,accuracy}=pos.coords;
  if(Date.now()-pos.timestamp>30000||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180){status('Lokasi tidak valid atau terlalu lama. Coba lagi.');render();return;}
  points.push({lat,lon,accuracy:Number.isFinite(accuracy)?accuracy:null,source:'gps',capturedAt:new Date(pos.timestamp).toISOString()});status('Patok '+points.length+' ditambahkan'+(accuracy>10?' · akurasi rendah, pertimbangkan koreksi.':'.'));if(cameraDialog.open)cameraOverlay.usePositionFix(pos);render();
 },err=>{if(request!==positionRequest)return;locating=false;status('GPS gagal: '+({1:'izin ditolak',2:'lokasi tidak tersedia',3:'waktu habis'}[err.code]||'kesalahan lokasi')+'. Coba kembali atau input manual.');render();},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
});
$('manual-form').addEventListener('submit',e=>{e.preventDefault();if(locating){status('Tunggu GPS selesai.');return;}if(edit<0&&points.length>=200){status('Maksimal 200 patok.');return;}const lat=$('lat').valueAsNumber,lon=$('lon').valueAsNumber;if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180){status('Koordinat tidak valid.');return;}const p={lat,lon,accuracy:null,source:'manual',capturedAt:new Date().toISOString()};if(edit>=0)points[edit]=p;else points.push(p);resetEdit();status('Koordinat manual ditambahkan ke daftar patok.');render();});
$('cancel-edit').addEventListener('click',resetEdit);
$('undo').addEventListener('click', () => {
  const number = points.length;
  points.pop();
  resetEdit();
  status('Patok ' + number + ' dihapus.');
  render();
});
$('clear').addEventListener('click',()=>{if(!confirm('Kosongkan patok yang sedang diedit? Simpanan tetap tersedia.'))return;positionRequest++;locating=false;points=[];resetEdit();status('Patok dikosongkan.');render();});
function project() {
  return landProfile({version: 1, name: $('project-name').value.trim() || 'Lahan tanpa nama',
    landType: $('land-type').value, points});
}

function profileSignature(profile) {
  const list = profile?.points ?? points;
  return JSON.stringify([
    profile?.name ?? ($('project-name').value.trim() || 'Lahan tanpa nama'),
    profile?.landType ?? $('land-type').value,
    list.map(({lat, lon, source, accuracy, capturedAt}) => [lat, lon, source, accuracy, capturedAt]),
  ]);
}

function openProfile(profile) {
  points = profile.points.map(point => ({...point}));
  $('project-name').value = profile.name;
  $('land-type').value = profile.landType;
  resetEdit();
  render();
}

async function getStore() {
  if (store) return store;
  store = await storageSession.catch(error => {
    storageSession = null;
    throw error;
  });
  return store;
}

async function withStorage(action, callback) {
  if (storageBusy || locating) return;
  storageBusy = true;
  render();
  try {
    storageSession ??= landStore();
    await getStore();
    await callback();
  } catch (error) {
    if (error.status === 409) {
      stored = null;
      saveStatus('Profil berubah di browser lain. Buka simpanan terbaru sebelum mengganti data.');
    } else saveStatus(storageError(error, action));
  } finally {
    storageBusy = false;
    render();
  }
}

async function prepareStorage() {
  try {
    await getStore();
    if (store.account) {
      try { $('import-browser-land').hidden = !browserLand(); } catch { /* Browser storage is unavailable. */ }
      const {firebase, uid} = store.account;
      firebase?.watchUser(user => {
        if (user?.uid === uid) return;
        document.body.hidden = true;
        location.reload();
      });
    }
    stored = await store.load();
    savedSignature = stored.profile ? profileSignature(stored.profile) : undefined;
    if (stored.profile && !points.length && !locating && !$('project-name').value) {
      openProfile(stored.profile);
      saveStatus('Profil tersimpan dibuka: ' + stored.profile.name);
    }
  } catch (error) {
    saveStatus(storageError(error, 'memuat profil lahan'));
  } finally {
    storageBusy = false;
    render();
  }
}

$('save').addEventListener('click', () => withStorage('menyimpan patok', async () => {
  const profile = project();
  if (!profile?.points.length) return;
  stored ??= await store.load();
  if (stored.profile && !confirm('Ganti profil lahan yang tersimpan?')) return;
  saveStatus('Menyimpan patok…');
  stored = await store.save(profile, stored.revision);
  savedSignature = profileSignature(stored.profile);
  saveStatus('Patok tersimpan ' + (store.account ? 'ke akun Google: ' : 'di browser ini: ') + profile.name +
    (profile.areaM2 === null ? ' · Lengkapi polygon sebelum lanjut ke analisis.' : '.'));
}));

$('restore').addEventListener('click', () => withStorage('membuka patok', async () => {
  stored = await store.load();
  savedSignature = stored.profile ? profileSignature(stored.profile) : undefined;
  if (!stored.profile) { saveStatus('Belum ada profil tersimpan.'); return; }
  if (points.length && !confirm('Ganti patok saat ini dengan profil tersimpan?')) return;
  openProfile(stored.profile);
  saveStatus('Profil dibuka: ' + stored.profile.name);
}));

$('delete-save').addEventListener('click', () => withStorage('menghapus profil', async () => {
  if (!stored?.profile || !confirm('Hapus profil lahan yang tersimpan?')) return;
  await store.remove(stored.revision);
  stored = null;
  savedSignature = undefined;
  saveStatus('Profil tersimpan dihapus. Patok yang sedang diedit masih bisa disimpan lagi.');
}));

$('import-browser-land').addEventListener('click', () => withStorage('membuka patok lama', async () => {
  const profile = browserLand();
  if (!profile) { saveStatus('Simpanan lama tidak tersedia di browser ini.'); return; }
  if (points.length && !confirm('Ganti patok yang sedang diedit dengan simpanan browser lama?')) return;
  openProfile(profile);
  saveStatus('Patok lama dibuka. Tekan Simpan patok untuk menyalin ke akun Google.');
}));

$('project-name').addEventListener('change', render);
$('land-type').addEventListener('change', render);

$('download').addEventListener('click',()=>{const p=project();if(!p||p.areaM2===null)return;let ring=p.points.map(q=>[q.lon,q.lat]);const xy=measure(p.points).xy;const signed=xy.reduce((s,a,i)=>{const b=xy[(i+1)%xy.length];return s+a[0]*b[1]-b[0]*a[1];},0);if(signed<0)ring.reverse();ring.push([...ring[0]]);const geo={type:'Feature',geometry:{type:'Polygon',coordinates:[ring]},properties:{...p,updatedAt:new Date().toISOString()}};const url=URL.createObjectURL(new Blob([JSON.stringify(geo,null,2)],{type:'application/geo+json'}));const a=document.createElement('a');a.href=url;a.download='automotion-land.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCamera();positionRequest++;locating=false;render();}});
window.addEventListener('pagehide',stopCamera);
if(!window.isSecureContext)status('Kamera/GPS biasanya memerlukan HTTPS atau localhost. Input manual tetap tersedia.');
render();
prepareStorage();
