import {loadLand} from './land-storage.js';
import {storageError} from './account-storage-api.js';
import './land-scanner.css';
import './workspace-theme.css';
import './climate.css';
import './workflow-theme.css';
import {measure} from './land-geometry.js';
import {landType} from './land-type.js';
import {shiftDate,summarizeDaily,seasonalBaseline} from './climate-core.js';
const $=id=>document.getElementById(id), key='automotion.climate.v1';
const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString('id-ID',{maximumFractionDigits:d}):'—';
const daily='temperature_2m_mean,temperature_2m_min,temperature_2m_max,relative_humidity_2m_mean,precipitation_sum,et0_fao_evapotranspiration,shortwave_radiation_sum';
const status=t=>{$('cl-status').textContent=t;};
let land=null,profile=null,busy=false;
function today(){const f=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>f.find(p=>p.type===k).value).join('-');}
function fingerprint(p){return JSON.stringify(p.points.map(q=>[q.lat,q.lon]));}
$('land-info').textContent='Memuat profil lahan…';
loadLand().then(p=>{const m=p&&measure(p.points);if(m?.valid){land={type:landType(p.landType),name:typeof p.name==='string'?p.name:'Lahan',fingerprint:fingerprint(p),center:m.center,areaM2:m.area};}
$('land-info').textContent=land?land.name+' · '+(land.type==='greenhouse'?'Greenhouse · iklim luar bangunan':'Lahan terbuka')+' · '+fmt(land.areaM2)+' m² · '+land.center.lat.toFixed(5)+', '+land.center.lon.toFixed(5):'Belum ada profil valid. Kembali ke Scan Lahan lalu simpan profil terlebih dahulu.';
controls();
}).catch(error=>{$('land-info').textContent=storageError(error,'memuat profil lahan');});
function controls(){const consent=$('consent').checked;$('load').disabled=!land||!consent||busy;$('baseline').disabled=!land||!consent||busy||!profile?.history;$('cached').disabled=!land||busy;$('forget').disabled=busy;$('export').disabled=!profile?.history||busy;}
$('consent').addEventListener('change',controls);
function query(endpoint,params){const u=new URL(endpoint);u.search=new URLSearchParams({latitude:land.center.lat.toFixed(5),longitude:land.center.lon.toFixed(5),...params});return u;}
async function get(url){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),25000);try{const r=await fetch(url,{signal:ctrl.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(data.error)throw Error('API error');return data;}finally{clearTimeout(timer);}}
function persist(){try{localStorage.setItem(key,JSON.stringify(profile));return true;}catch{return false;}}
function item(label,value,note){const div=document.createElement('div');div.className='cl-metric';for(const [tag,t] of [['small',label],['strong',value],['span',note]]){const e=document.createElement(tag);e.textContent=t;div.append(e);}return div;}
function metric(label,s,unit,d=1){return item(label,s&&s.days?fmt(s.value,d)+' '+unit:'—',s?s.days+'/'+s.expected+' hari'+(s.days<s.expected?' · tidak lengkap':''):'Data tidak tersedia');}
function fillMetrics(node,s){node.replaceChildren(metric('Suhu rata-rata',s?.temperature,'°C'),metric('Suhu terendah',s?.minimum,'°C'),metric('Suhu tertinggi',s?.maximum,'°C'),metric('Curah hujan',s?.rain,'mm'),metric('Kelembapan',s?.humidity,'%'),metric('ET₀ total',s?.et0,'mm'),metric('Radiasi rata-rata harian',s?.radiation,'MJ/m²'),metric('Hari hujan ≥ 1 mm',s?.rainyDays,'hari',0));}
function render(){
 if(!profile?.history)return;
 $('cl-results').hidden=false;
 const h=profile.history,s=h.summary;
 $('history-period').textContent=h.start+' s/d '+h.end+' · ERA5, jeda arsip 6 hari · '+profile.timezone;
 fillMetrics($('history-metrics'),s);
 $('history-metrics').append(item('Elevasi',Number.isFinite(profile.elevationM)?fmt(profile.elevationM,0)+' mdpl':'—','Copernicus DEM, resolusi 90 m'));
 const chart=$('rain-chart');chart.replaceChildren();const max=Math.max(1,...h.months.map(m=>m.rain.value||0));
 for(const m of h.months){const row=document.createElement('div');row.className='cl-bar-row';const label=document.createElement('span');label.textContent=m.month+' ('+m.rain.days+'/'+m.rain.expected+' hari)';const bar=document.createElement('div');bar.className='cl-bar';const fill=document.createElement('div');fill.style.width=(m.rain.value===null?0:m.rain.value/max*100)+'%';bar.append(fill);const value=document.createElement('strong');value.textContent=m.rain.value===null?'—':fmt(m.rain.value)+' mm';row.append(label,bar,value);chart.append(row);}
 const notes=[];
 if(s.rain.days===s.rain.expected&&s.et0.days===s.et0.expected){const balance=s.rain.value-s.et0.value;notes.push('Selisih hujan − ET₀: '+fmt(balance)+' mm. '+(balance<0?'Permintaan evaporasi referensi melebihi hujan; periksa sumber air.':'Hujan total melebihi ET₀; periksa distribusi hujan dan drainase.'));}
 else notes.push('Data hujan atau ET₀ tidak lengkap; neraca air tidak dihitung.');
 if(s.maximum.days)notes.push('Suhu maksimum tercatat dalam model: '+fmt(s.maximum.value)+' °C; bandingkan dengan toleransi varietas.');
 notes.push('Tidak ada kesimpulan kesesuaian komoditas sebelum data tanah dan air diperiksa.');
 $('insights').replaceChildren(...notes.map(t=>{const p=document.createElement('p');p.textContent=t;return p;}));
 const f=profile.forecast;$('forecast-period').textContent=f?f.start+' s/d '+f.end:'Prakiraan belum tersedia; historis tetap dapat digunakan.';
 fillMetrics($('forecast-metrics'),f?.summary);
 const b=profile.baseline;$('baseline-table').replaceChildren();
 if(b){$('baseline-info').textContent='ERA5 '+b.yearStart+'–'+b.yearEnd+' · tiga bulan kalender penuh setelah bulan ini · rerata historis, bukan prediksi.';for(const m of b.months){const row=document.createElement('div');row.className='cl-baseline-row';row.append(item('Bulan '+m.month,fmt(m.rainMm)+' mm',m.years+'/'+m.expectedYears+' tahun lengkap'),item('Suhu rata-rata',fmt(m.temperatureC)+' °C','Rentang hujan: '+fmt(m.rainMinMm)+'–'+fmt(m.rainMaxMm)+' mm'));$('baseline-table').append(row);}}
 else $('baseline-info').textContent='Belum diambil. Tekan Ambil pola musim 10 tahun. Ini klimatologi sederhana, bukan prakiraan.';
 $('export-info').textContent='Data diambil '+new Date(profile.fetchedAt).toLocaleString('id-ID')+' · tersimpan untuk koordinat/polygon ini. Gunakan analisis baru jika lahan atau tanggal tanam berubah.';
 controls();
}
$('load').addEventListener('click',async()=>{
 if(busy||!land||!$('consent').checked)return;busy=true;controls();status('Mengambil historis, prakiraan, dan elevasi…');
 const now=today(),end=shiftDate(now,-6),start=shiftDate(end,-89),forecastEnd=shiftDate(now,13);
 const common={daily,timezone:'Asia/Jakarta'};
 const jobs=await Promise.allSettled([
 get(query('https://archive-api.open-meteo.com/v1/archive',{...common,models:'era5',start_date:start,end_date:end})),
 get(query('https://api.open-meteo.com/v1/forecast',{...common,forecast_days:14})),
 get(query('https://api.open-meteo.com/v1/elevation',{}))
 ]);
 try{
  if(jobs[0].status!=='fulfilled')throw Error('Historis gagal diambil: '+jobs[0].reason.message);
  const h=summarizeDaily(jobs[0].value.daily,start,end);
  if(!h.summary.temperature.days&&!h.summary.rain.days)throw Error('Arsip tidak mengembalikan data suhu/hujan yang dapat digunakan.');
  const f=jobs[1].status==='fulfilled'?summarizeDaily(jobs[1].value.daily,now,forecastEnd):null;
  const elevation=jobs[2].status==='fulfilled'?jobs[2].value.elevation?.[0]:null;
  profile={version:1,landFingerprint:land.fingerprint,center:land.center,areaM2:land.areaM2,timezone:'Asia/Jakarta',fetchedAt:new Date().toISOString(),source:{history:'Open-Meteo ERA5',forecast:'Open-Meteo forecast',elevation:'Copernicus DEM GLO-90'},history:h,forecast:f&&(f.summary.temperature.days||f.summary.rain.days)?f:null,elevationM:Number.isFinite(elevation)?elevation:null,baseline:null};
  const stored=persist();render();status('Historis tersedia. '+(!profile.forecast?'Prakiraan gagal atau kosong. ':'')+(profile.elevationM===null?'Elevasi belum tersedia. ':'')+(stored?'Hasil disimpan lokal.':'Penyimpanan gagal; ekspor JSON tersedia.'));
 }catch(e){status(e.message+'. Coba lagi; hasil sebelumnya tidak ditimpa.');}finally{busy=false;controls();}
});
$('baseline').addEventListener('click',async()=>{
 if(busy||!profile?.history||!$('consent').checked)return;busy=true;controls();status('Mengambil klimatologi ERA5 10 tahun. Permintaan data lebih besar…');
 try{const now=today(),yearEnd=Number(now.slice(0,4))-1,yearStart=yearEnd-9,month=Number(now.slice(5,7));const months=[1,2,3].map(i=>(month+i-1)%12+1);
 const d=await get(query('https://archive-api.open-meteo.com/v1/archive',{daily:'temperature_2m_mean,precipitation_sum',models:'era5',timezone:'Asia/Jakarta',start_date:yearStart+'-01-01',end_date:yearEnd+'-12-31'}));
 const result=seasonalBaseline(d.daily,yearStart,yearEnd,months);if(!result.some(m=>m.years))throw Error('Tidak ada bulan historis lengkap.');
 profile.baseline={yearStart,yearEnd,generatedAt:new Date().toISOString(),months:result};const stored=persist();render();status('Klimatologi selesai. '+(stored?'Disimpan lokal.':'Penyimpanan gagal; ekspor JSON tersedia.'));
 }catch(e){status('Klimatologi gagal: '+e.message+'. Historis 90 hari tetap tersedia.');}finally{busy=false;controls();}
});
$('cached').addEventListener('click',()=>{try{const p=JSON.parse(localStorage.getItem(key)||'null');if(!p||p.version!==1||p.landFingerprint!==land.fingerprint||!p.history?.summary||!Array.isArray(p.history.months)){status('Tidak ada hasil yang cocok dengan polygon lahan ini.');return;}profile=p;render();status('Hasil lokal dibuka. Data mungkin sudah tidak mutakhir.');}catch{status('Hasil lokal tidak dapat dibuka.');}});
$('forget').addEventListener('click',()=>{if(!confirm('Hapus profil iklim dari perangkat ini?'))return;try{localStorage.removeItem(key);profile=null;$('cl-results').hidden=true;status('Hasil iklim lokal dihapus.');controls();}catch{status('Gagal menghapus hasil lokal.');}});
$('export').addEventListener('click',()=>{if(!profile)return;const url=URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='automotion-climate.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
controls();