import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './land-scanner.css';
import './farm.css';
import {measure} from './land-geometry.js';
import {allCrops} from './crop-database.js';
import {landType,cropChoices,sameLandType} from './land-type.js';
import {makeLayout} from './farm-layout.js';
const $=id=>document.getElementById(id),key='automotion.farm.v1';
const fmt=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('id-ID',{maximumFractionDigits:d}):'—';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}};
const land=read('automotion.land.v1'),plan=read('automotion.recommendation.v1'),m=land&&measure(land.points);
const fingerprint=m?.valid?JSON.stringify(land.points.map(q=>[q.lat,q.lon])):null;
const type=landType(land?.landType),greenhouse=type==='greenhouse';
const crop=cropChoices(allCrops,type).find(c=>c.id===plan?.selected?.id);
const valid=m?.valid&&plan?.version===1&&plan.landFingerprint===fingerprint&&sameLandType(plan.landType,type)&&crop&&['candidate','conditional','incomplete'].includes(plan.assessment?.verdict);
let layout=null,viewer=null,selectedZone='all',selectedDevice=null,devices=[],active=null,waterTimer=null,wet={A:45,B:45};
function stat(label,value){const d=document.createElement('div'),s=document.createElement('small'),v=document.createElement('strong');s.textContent=label;v.textContent=value;d.append(s,v);return d;}
function device(id,name,type,zone,position){return {id,name,type,zone,position};}
function getDevices(l){
 const list=[];for(const zone of ['A','B']){const p=l.anchors[zone];if(p){list.push(device('soil-'+zone,'Sensor tanah '+zone,'soil',zone,p),device('valve-'+zone,'Katup '+zone,'valve',zone,[p[0],p[1]]));}}
 const p=l.anchors.A||l.anchors.B;
 if(p){list.push(device('weather',greenhouse?'Sensor udara dalam greenhouse':'Sensor cuaca','weather',null,p),device('pump','Pompa air','pump',null,p),device('tank','Tandon air','tank',null,p));}
 return list;
}
function deviceNote(d){
 if(d.type==='soil')return 'Kelembapan contoh: '+wet[d.zone]+'%. Posisi hanya titik representatif; lakukan survei untuk jumlah dan lokasi sensor.';
 if(d.type==='valve')return 'Status simulasi: '+(active===d.zone?'terbuka':'tertutup')+'. Bukan perintah ke katup fisik.';
 if(d.type==='pump')return 'Status simulasi: '+(active?'menyala di Zone '+active:'mati')+'. Debit, tekanan dan kapasitas pompa belum dihitung.';
 if(d.type==='tank')return 'Tandon konseptual. Volume, ketinggian dan kapasitas belum ditentukan.';
 return 'Sensor suhu/kelembapan udara konseptual. Tidak ada pembacaan aktual.';
}
function selectDevice(id){const d=devices.find(x=>x.id===id);if(!d)return;selectedDevice=id;$('device-detail').textContent=d.name+' — '+deviceNote(d);for(const b of $('device-list').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.device===id));viewer?.selectDevice(id);}
function renderPanel(){
 $('farm-stats').replaceChildren(stat('Luas polygon',fmt(layout.area)+' m²'),stat('Target efektif',fmt(layout.area*layout.usable/100)+' m²'),stat('Kapasitas grid',fmt(layout.capacity,0)+' '+crop.unit),stat('Objek visual',fmt(layout.samples.length,0)),stat('Zone A',fmt(layout.allocated.A,0)),stat('Zone B',fmt(layout.allocated.B,0)));
 $('model-note').textContent='Grid '+fmt(layout.spacing[0])+' × '+fmt(layout.spacing[1])+' m · '+fmt(layout.samples.length,0)+' representasi dari '+fmt(layout.capacity,0)+' posisi rencana';
 $('device-list').replaceChildren();for(const d of devices){const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.device=d.id;b.textContent=d.name;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>selectDevice(d.id));$('device-list').append(b);}
 selectedDevice=null;$('device-detail').textContent=devices.length?'Pilih perangkat untuk melihat detail.':'Tidak ada posisi tanam pada grid ini.';
 for(const b of document.querySelectorAll('[data-zone]'))b.disabled=b.dataset.zone!=='all'&&!layout.allocated[b.dataset.zone];
 for(const o of $('irrigation-zone').options)o.disabled=!layout.allocated[o.value];
 $('irrigation-zone').value=layout.allocated.A?'A':'B';$('irrigate').disabled=!layout.capacity;
 $('irrigation-note').textContent=crop.system==='paddy'?'Padi sawah: visualisasi pengisian air secara konseptual, bukan sistem irigasi tetes atau rekomendasi debit.':'Lahan kering: contoh aliran di baris, belum desain irigasi spesifik komoditas.';
}
function chooseZone(z){selectedZone=z;for(const b of document.querySelectorAll('[data-zone]'))b.setAttribute('aria-pressed',String(b.dataset.zone===z));viewer?.setZone(z);}
function stopWater(completed=false){clearTimeout(waterTimer);const z=active;active=null;if(completed&&z)wet[z]=Math.min(100,wet[z]+5);viewer?.setWater(null);$('water-status').textContent=completed?'Simulasi selesai. Kelembapan contoh diperbarui.':'Pompa simulasi mati.';$('irrigate').disabled=!layout?.capacity;$('stop-water').disabled=true;$('irrigation-zone').disabled=false;if(selectedDevice)selectDevice(selectedDevice);}
function startWater(){const z=$('irrigation-zone').value;if(active||!layout?.allocated[z])return;active=z;chooseZone(z);viewer?.setWater(z);$('irrigate').disabled=true;$('stop-water').disabled=false;$('irrigation-zone').disabled=true;$('water-status').textContent='Aliran air simulasi aktif — Zone '+z;if(selectedDevice)selectDevice(selectedDevice);waterTimer=setTimeout(()=>stopWater(true),7500);}
function initViewer(container,l){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xe8f0e2,1);renderer.outputColorSpace=THREE.SRGBColorSpace;container.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.05,2000),controls=new OrbitControls(camera,renderer.domElement);
 const scale=30/Math.max(l.width,l.depth),world=(x,y,h=0)=>new THREE.Vector3(x*scale,h,-y*scale);
 controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.48;controls.minDistance=5;controls.maxDistance=140;controls.target.set(0,0,0);
 scene.add(new THREE.HemisphereLight(0xf9ffed,0x7c846b,2.4));const sun=new THREE.DirectionalLight(0xfff1dc,2.3);sun.position.set(15,35,20);scene.add(sun);
 const shape=new THREE.Shape();l.polygon.forEach((p,i)=>i?shape.lineTo(p[0]*scale,p[1]*scale):shape.moveTo(p[0]*scale,p[1]*scale));shape.closePath();
 const earth=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.6,bevelEnabled:false}),[new THREE.MeshStandardMaterial({color:crop.system==='paddy'?0x859b70:0x987a52,roughness:1}),new THREE.MeshStandardMaterial({color:0x725039,roughness:1})]);earth.rotation.x=-Math.PI/2;earth.position.y=-.6;scene.add(earth);
 const outlinePoints=l.polygon.map(p=>world(p[0],p[1],.025));outlinePoints.push(outlinePoints[0].clone());scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePoints),new THREE.LineBasicMaterial({color:0x52684d})));
 const frameGroup=new THREE.Group();if(greenhouse){const frameHeight=2.5;const lines=[];for(let i=0;i<l.polygon.length;i++){const a=l.polygon[i],b=l.polygon[(i+1)%l.polygon.length];lines.push(world(a[0],a[1],0),world(a[0],a[1],frameHeight),world(a[0],a[1],frameHeight),world(b[0],b[1],frameHeight));}frameGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines),new THREE.LineBasicMaterial({color:0x879b9b,transparent:true,opacity:.8})));scene.add(frameGroup);}
 const parts={A:[],B:[]},waterLines={A:[],B:[]},markers=[],dummy=new THREE.Object3D();
 const baseSize=Math.max(.055,Math.min(.35,Math.min(...l.spacing)*scale*.42));
 const style={rice:[0x4c8838,.85,1],maize:[0x558b38,1.8,.8],soybean:[0x4f803d,.65,1.3],groundnut:[0x659341,.5,1.4],chili:[0x387c3e,1.2,1],tomato:[0x427e3c,1.2,1.25],cabbage:[0x76a459,.45,1.6],potato:[0x56833c,.65,1.3],cucumber:[0x4d8a46,.8,1.2],shallot:[0x6c9149,1.05,.65],melon:[0x659847,.9,1.4]}[crop.id];
 for(const z of ['A','B']){
  const pp=l.samples.filter(p=>p.zone===z);
  const mat=new THREE.MeshStandardMaterial({color:style[0],roughness:.9}),geo=crop.id==='cabbage'?new THREE.SphereGeometry(1,7,5):new THREE.ConeGeometry(1,2,5);
  const plants=new THREE.InstancedMesh(geo,mat,pp.length);for(let i=0;i<pp.length;i++){const p=pp[i],height=baseSize*style[1];dummy.position.copy(world(p.x,p.y,height));dummy.scale.set(baseSize*style[2],height,baseSize*style[2]);dummy.rotation.set(0,(i*2.399)%6.283,0);dummy.updateMatrix();plants.setMatrixAt(i,dummy.matrix);}plants.instanceMatrix.needsUpdate=true;scene.add(plants);parts[z].push({mesh:plants,color:style[0]});
  for(const line of l.lines.filter(x=>x.zone===z)){const geom=new THREE.BufferGeometry().setFromPoints([world(line.x,line.from,.065),world(line.x,line.to,.065)]);const pipe=new THREE.Line(geom,new THREE.LineBasicMaterial({color:0x537c94,transparent:true,opacity:.45}));scene.add(pipe);waterLines[z].push(pipe);}
 }
 const colors={soil:0x37b8d9,valve:0xe0a74b,weather:0x5f86d5,pump:0x9f77cb,tank:0x447ca9};
 const offsets={soil:0,valve:.65,weather:1.5,pump:2.2,tank:2.9};
 for(const d of devices){
  const pos=world(d.position[0],d.position[1]),height=.65+offsets[d.type];const g=new THREE.Group();g.position.copy(pos);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,height,6),new THREE.MeshStandardMaterial({color:0x4b5753}));pole.position.y=height/2;g.add(pole);
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8),new THREE.MeshStandardMaterial({color:colors[d.type],emissive:colors[d.type],emissiveIntensity:.15}));marker.position.y=height;marker.userData.device=d.id;g.add(marker);scene.add(g);markers.push(marker);
 }
 const draw=()=>renderer.render(scene,camera);
 function reset(){camera.position.set(35,34,38);controls.target.set(0,0,0);controls.update();draw();}
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw();}
 const observer=new ResizeObserver(resize);observer.observe(container);controls.addEventListener('change',draw);resize();reset();
 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null;
 function pointerDown(e){down=[e.clientX,e.clientY];}
 function pointerUp(e){if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(markers,false)[0];if(hit)selectDevice(hit.object.userData.device);}
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
 let frame=0,waterZone=null;
 function animate(t){if(!waterZone)return;for(const p of waterLines[waterZone])p.material.opacity=.65+.35*Math.sin(t/180);draw();frame=requestAnimationFrame(animate);}
 return {reset,toggleFrame(){frameGroup.visible=!frameGroup.visible;draw();return frameGroup.visible;},setZone(z){for(const k of ['A','B'])for(const p of parts[k]){p.mesh.material.color.setHex(p.color);if(z!=='all'&&z!==k)p.mesh.material.color.multiplyScalar(.42);p.mesh.material.emissive.setHex(z===k?0x4ea97a:0);p.mesh.material.emissiveIntensity=z===k?.2:0;}draw();},selectDevice(id){for(const p of markers){p.scale.setScalar(p.userData.device===id?1.5:1);p.material.emissiveIntensity=p.userData.device===id?.9:.15;}draw();},setWater(z){cancelAnimationFrame(frame);waterZone=z;for(const k of ['A','B'])for(const p of waterLines[k]){p.material.color.setHex(z===k?0x19bce9:0x537c94);p.material.opacity=z===k?1:.45;}draw();if(z)frame=requestAnimationFrame(animate);},dispose(){cancelAnimationFrame(frame);observer.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();}});renderer.dispose();renderer.domElement.remove();}};
}
function fallback(l){
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 400 300');svg.classList.add('farm-fallback');const k=Math.min(340/l.width,240/l.depth),p=(x,y)=>[200+x*k,150-y*k];
 const poly=document.createElementNS(NS,'polygon');poly.setAttribute('points',l.polygon.map(q=>p(...q).join(',')).join(' '));poly.setAttribute('fill','#b6c99e');poly.setAttribute('stroke','#52684d');svg.append(poly);
 for(const v of l.samples){const circle=document.createElementNS(NS,'circle'),[x,y]=p(v.x,v.y);circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','1.4');circle.setAttribute('fill',v.zone==='A'?'#34794b':'#63934b');svg.append(circle);}
 $('farm-view').append(svg);
}
function generate(){
 const spacing=[$('row-space').valueAsNumber,$('plant-space').valueAsNumber],usable=$('usable').valueAsNumber;
 let next;try{next=makeLayout(m.xy,spacing,usable);}catch(e){$('layout-status').textContent=e.message;return;}
 stopWater();viewer?.dispose();viewer=null;$('farm-view').querySelector('.farm-fallback')?.remove();layout=next;wet={A:45,B:45};devices=getDevices(layout);renderPanel();chooseZone('all');
 try{viewer=initViewer($('farm-view'),layout);$('viewer-status').textContent='3D · Simulasi';$('reset-view').disabled=false;$('toggle-frame').disabled=false;$('toggle-frame').textContent='Sembunyikan rangka';}catch(e){console.warn('3D unavailable',e);$('farm-view').querySelector('canvas')?.remove();fallback(layout);$('viewer-status').textContent='WebGL tidak tersedia · sketsa 2D';$('reset-view').disabled=true;$('toggle-frame').disabled=true;}
 $('layout-status').textContent='Layout diperbarui. Simpan jika ingin membukanya kembali.';
}
function data(){return {version:1,landType:type,landFingerprint:fingerprint,cropId:crop.id,planCreatedAt:plan.createdAt,spacing:layout.spacing,usable:layout.usable,capacity:layout.capacity,zoneCounts:layout.allocated,areaM2:layout.area,visualCount:layout.samples.length,updatedAt:new Date().toISOString(),mode:'simulation-only'};}
if(!valid){$('farm-info').textContent='Belum ada rencana tanaman yang cocok dengan lahan ini. Kembali ke rekomendasi, pilih komoditas dan simpan rencana lokal.';}
else{
 $('farm-info').textContent=(typeof land.name==='string'?land.name:'Lahan')+' · '+fmt(m.area)+' m² · '+(plan.assessment.verdict==='candidate'?'Kandidat screening awal':'Hanya untuk simulasi; perlu verifikasi');
 $('farm-content').hidden=false;$('crop-name').textContent=crop.name+' · '+(greenhouse?'Greenhouse':'Lahan terbuka');$('toggle-frame').hidden=!greenhouse;$('toggle-frame').addEventListener('click',()=>{if(viewer){$('toggle-frame').textContent=viewer.toggleFrame()?'Sembunyikan rangka':'Tampilkan rangka';}});
 const saved=read(key),match=saved?.version===1&&saved.landFingerprint===fingerprint&&sameLandType(saved.landType,type)&&saved.cropId===crop.id&&saved.planCreatedAt===plan.createdAt;
 const sp=match&&Array.isArray(saved.spacing)&&saved.spacing.length===2&&saved.spacing.every(v=>Number.isFinite(v)&&v>=.1&&v<=20)?saved.spacing:crop.spacing;
 $('row-space').value=sp[0];$('plant-space').value=sp[1];const u=match?saved.usable:plan.input?.usable;$('usable').value=Number.isInteger(u)&&u>=1&&u<=100?u:80;
 $('layout-form').addEventListener('submit',e=>{e.preventDefault();generate();});
 for(const b of document.querySelectorAll('[data-zone]'))b.addEventListener('click',()=>chooseZone(b.dataset.zone));
 $('reset-view').addEventListener('click',()=>viewer?.reset());$('irrigate').addEventListener('click',startWater);$('stop-water').addEventListener('click',()=>stopWater());
 $('save-layout').addEventListener('click',()=>{if(!layout)return;try{localStorage.setItem(key,JSON.stringify(data()));$('layout-status').textContent='Layout disimpan di perangkat ini.';}catch{$('layout-status').textContent='Penyimpanan gagal; gunakan ekspor.';}});
 $('export-layout').addEventListener('click',()=>{if(!layout)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='automotion-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 window.addEventListener('pagehide',()=>{stopWater();});generate();
}