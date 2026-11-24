import './land-scanner.css';
import './recommendation.css';
import {measure} from './land-geometry.js';
import {crops,modelVersion} from './crop-database.js';
import {extractClimate,rank} from './recommendation-core.js';
const $=id=>document.getElementById(id),key='automotion.recommendation.v1';
const labels={candidate:'Kandidat awal',conditional:'Perlu perlakuan / verifikasi',incomplete:'Data belum lengkap',blocked:'Faktor pembatas terdeteksi'};
const fmt=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('id-ID',{maximumFractionDigits:d}):'—';
let land=null,profile=null,climate=null,input=null,results=[],selected=null;
function read(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
const saved=read('automotion.land.v1'),m=saved&&measure(saved.points);
if(m?.valid){land={name:typeof saved.name==='string'?saved.name:'Lahan',points:saved.points.map(q=>({lat:q.lat,lon:q.lon})),areaM2:m.area,center:m.center,fingerprint:JSON.stringify(saved.points.map(q=>[q.lat,q.lon]))};const c=read('automotion.climate.v1');if(c?.version===1&&c.landFingerprint===land.fingerprint)profile=c;}
climate=extractClimate(profile,new Date().toISOString());
$('land-info').textContent=land?land.name+' · '+fmt(land.areaM2)+' m² · Lahan terbuka':'Belum ada profil valid. Simpan lahan melalui Scan Lahan.';
$('climate-info').textContent=climate.source+(climate.temperature===null?' — kembali ke analisis iklim untuk mengambil data.':' · suhu '+fmt(climate.temperature)+' °C')+(climate.seasonRain!==null?' · hujan klimatologi '+fmt(climate.seasonRain)+' mm / 3 bulan':'');
$('run').disabled=!land;$('restore').disabled=!land;
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function list(title,items){const d=node('div');d.append(node('strong',title));const u=node('ul');for(const i of items)u.append(node('li',i));d.append(u);return d;}
function render(){
 $('results').hidden=false;$('crop-list').replaceChildren();
 for(const r of results){const c=r.crop,card=node('article',undefined,'rc-card'),head=node('div',undefined,'rc-head'),name=node('div');name.append(node('h3',c.name),node('small',c.species));head.append(name,node('span',labels[r.verdict],'rc-tag '+r.verdict));card.append(head);
 const stats=node('div',undefined,'rc-stats');for(const [title,value] of [['Skor data tersedia',r.score===null?'—':r.score+'/100'],['Cakupan data',r.coverage+'%'],['Umur ilustratif',c.days.join('–')+' hari']]){const div=node('div');div.append(node('small',title),node('strong',value));stats.append(div);}card.append(stats);
 if(r.blocks.length)card.append(list('Faktor pembatas',r.blocks));if(r.missing.length)card.append(list('Data diperlukan',r.missing));if(r.risks.length)card.append(list('Catatan risiko',r.risks));
 const details=node('details'),summary=node('summary','Rincian penilaian');details.append(summary);for(const k of r.checks){const p=node('p',k.label+' · '+(k.score===null?'belum diketahui':Math.round(k.score*100)+'/100')+' · '+k.reason,'ls-note');details.append(p);}details.append(node('p','Kebutuhan air per siklus (indikatif): '+(c.waterMm?c.waterMm.join('–')+' mm, bukan volume irigasi':'belum tersedia untuk profil ini'),'ls-note'));card.append(details);
 card.append(node('p','Kapasitas geometris: '+fmt(r.population,0)+' '+c.unit+' · jarak asumsi '+fmt(c.spacing[0]*100)+' × '+fmt(c.spacing[1]*100)+' cm','ls-note'));
 const button=node('button',r.verdict==='candidate'?'Pilih kandidat':'Pilih untuk simulasi saja');button.type='button';button.disabled=r.verdict==='blocked';button.addEventListener('click',()=>choose(r));card.append(button);$('crop-list').append(card);
 }
}
function choose(r){if(r.verdict==='blocked')return;selected=r;$('plan').hidden=false;$('selection').textContent=r.crop.name+' · '+labels[r.verdict];$('capacity').textContent='Area efektif '+fmt(r.effectiveArea)+' m² · estimasi '+fmt(r.population,0)+' '+r.crop.unit+'. Tidak memperhitungkan polygon aktual, varietas, bedengan atau akses. '+(r.verdict==='candidate'?'Tetap perlu validasi lapangan.':'Hanya untuk simulasi, bukan rekomendasi tanam.');$('plan-status').textContent='';$('plan').scrollIntoView({block:'nearest'});}
function values(){return {water:$('water').value,soil:$('soil').value,drain:$('drain').value,ph:$('ph').value===''?null:$('ph').valueAsNumber,usable:$('usable').valueAsNumber,areaM2:land.areaM2};}
function analyze(){input=values();selected=null;$('plan').hidden=true;results=rank(crops,input,climate);render();$('status').textContent='10 komoditas dianalisis. Skor bersifat screening awal; periksa faktor pembatas dan kelengkapan data.';}
$('assessment').addEventListener('submit',e=>{e.preventDefault();if(land)analyze();});
$('assessment').addEventListener('input',()=>{selected=null;results=[];$('plan').hidden=true;$('results').hidden=true;});
function plan(){return selected?{version:1,modelVersion,landFingerprint:land.fingerprint,land:{name:land.name,points:land.points,areaM2:land.areaM2,center:land.center},climateFetchedAt:profile?.fetchedAt||null,climate,input,selected:selected.crop,assessment:{verdict:selected.verdict,score:selected.score,coverage:selected.coverage,blocks:selected.blocks,risks:selected.risks,missing:selected.missing},effectiveAreaM2:selected.effectiveArea,population:selected.population,createdAt:new Date().toISOString()}:null;}
$('save-plan').addEventListener('click',()=>{const p=plan();if(!p)return;try{localStorage.setItem(key,JSON.stringify(p));$('plan-status').textContent='Rencana disimpan di perangkat ini.';}catch{$('plan-status').textContent='Penyimpanan gagal. Gunakan ekspor JSON.';}});
$('export-plan').addEventListener('click',()=>{const p=plan();if(!p)return;const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='automotion-farm-plan.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('restore').addEventListener('click',()=>{const p=read(key);if(!p||p.version!==1||p.landFingerprint!==land.fingerprint||!p.input){$('status').textContent='Tidak ada rencana yang cocok dengan lahan ini.';return;}for(const k of ['water','soil','drain']){const select=$(k);if([...select.options].some(o=>o.value===p.input[k]))select.value=p.input[k];}$('ph').value=Number.isFinite(p.input.ph)&&p.input.ph>=0&&p.input.ph<=14?p.input.ph:'';$('usable').value=Number.isFinite(p.input.usable)&&p.input.usable>=1&&p.input.usable<=100?p.input.usable:80;if(!$('assessment').reportValidity())return;analyze();const r=results.find(x=>x.crop.id===p.selected?.id);if(r&&r.verdict!=='blocked')choose(r);$('status').textContent='Input tersimpan dibuka dan dinilai ulang dengan data iklim yang tersedia.';});
