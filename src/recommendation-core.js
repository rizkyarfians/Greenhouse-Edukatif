export function rangeScore(v,opt,limit){
 if(!Number.isFinite(v))return null;
 if(v<limit[0]||v>limit[1])return 0;
 if(v>=opt[0]&&v<=opt[1])return 1;
 return v<opt[0]?(v-limit[0])/(opt[0]-limit[0]):(limit[1]-v)/(limit[1]-opt[1]);
}

export function extractClimate(profile,now){
 const age=(Date.parse(now)-Date.parse(profile?.fetchedAt))/86400000;
 if(!Number.isFinite(age)||age<-.1||age>30)return {temperature:null,source:'Iklim tidak tersedia atau lebih dari 30 hari',rain:null,forecastMax:null,seasonRain:null};
 const h=profile.history?.summary,t=h?.temperature,r=h?.rain;
 const baseline=profile.baseline?.months;
 const currentMonth=new Date(now).getUTCMonth()+1;
 const next=[1,2,3].map(i=>(currentMonth+i-1)%12+1);
 const valid=Array.isArray(baseline)&&baseline.length===3&&baseline.every((m,i)=>m.month===next[i]&&m.years>=8&&Number.isFinite(m.temperatureC)&&Number.isFinite(m.rainMm));
 const good=t&&Number.isFinite(t.value)&&t.expected>0&&t.days/t.expected>=.8;
 const freshForecast=age<=2;
 const fx=profile.forecast?.summary?.maximum;
 return {temperature:valid?baseline.reduce((a,b)=>a+b.temperatureC,0)/3:good?t.value:null,source:valid?'Rerata historis tiga bulan kalender berikutnya (bukan prediksi)':good?'Historis 90 hari (bukan prediksi)':'Data suhu belum cukup',rain:r&&r.days===r.expected&&r.expected>0&&Number.isFinite(r.value)?r.value:null,seasonRain:valid?baseline.reduce((a,b)=>a+b.rainMm,0):null,forecastMax:freshForecast&&fx?.days>0&&Number.isFinite(fx.value)?fx.value:null};
}

export function assess(crop,land,climate){
 const checks=[],blocks=[],risks=[],missing=[];
 const add=(key,label,weight,score,reason,critical=false)=>{checks.push({key,label,weight,score,reason});if(score===null){missing.push(label);if(critical)risks.push(label+' belum diketahui.');}};
 const temp=rangeScore(climate.temperature,crop.temp,crop.tempLimit);
 add('temperature','Suhu rata-rata',25,temp,temp===null?'Belum ada suhu representatif':climate.temperature.toFixed(1)+' °C; kisaran optimal awal '+crop.temp.join('–')+' °C',true);
 if(temp===0)blocks.push('Suhu rata-rata di luar batas screening awal.');
 if(Number.isFinite(climate.forecastMax)&&climate.forecastMax>crop.tempLimit[1])risks.push('Prakiraan maksimum melampaui batas suhu screening; periksa varietas dan fase tumbuh.');
 const ph=rangeScore(land.ph,crop.ph,crop.phLimit);
 add('ph','pH tanah',15,ph,ph===null?'Perlu pengukuran pH':'pH '+land.ph+'; kisaran optimal awal '+crop.ph.join('–'),true);
 if(ph===0)blocks.push('pH di luar batas screening awal; perlu evaluasi/perbaikan tanah.');
 const soil=land.soil==='unknown'||!land.soil?null:crop.soils.includes(land.soil)?1:.4;
 add('soil','Tekstur tanah',15,soil,soil===null?'Tekstur belum diketahui':soil===1?'Tekstur termasuk pilihan awal':'Tekstur perlu pengelolaan tambahan',true);
 const drain=land.drain==='unknown'||!land.drain?null:crop.system==='paddy'?(land.drain==='paddy'?1:land.drain==='poor'?.3:.4):land.drain==='good'?1:0;
 add('drain','Drainase / tipe lahan',20,drain,drain===null?'Drainase belum diketahui':crop.system==='paddy'?(drain===1?'Sawah dengan air terkendali':'Belum dikonfirmasi sebagai sawah terkendali'):(drain===1?'Drainase baik':'Genangan tidak sesuai untuk screening lahan kering'),true);
 if(drain===0)blocks.push('Risiko genangan untuk komoditas lahan kering.');
 if(crop.system==='paddy'&&drain!==null&&drain<1)risks.push('Perlu evaluasi kesiapan sawah dan pengendalian air; jangan menganggap genangan liar cocok.');
 const water=land.water==='unknown'||!land.water?null:land.water==='reliable'?.85:land.water==='limited'?(crop.water==='high'?.2:.45):(crop.water==='high'?.25:.5);
 add('water','Ketersediaan air',25,water,water===null?'Sumber air belum diketahui':land.water==='reliable'?'Sumber air dinyatakan tersedia; debit belum diverifikasi':land.water==='limited'?'Air terbatas; belum dihitung neraca air tanaman':'Tadah hujan; distribusi hujan dan kebutuhan tanaman belum dihitung',true);
 if(land.water!=='reliable'&&land.water!=='unknown'&&land.water)risks.push('Validasi pasokan air selama seluruh umur budidaya.');
 if(crop.system==='paddy'&&land.water==='limited')blocks.push('Air terbatas untuk model padi sawah yang digunakan.');
 if(climate.seasonRain!==null&&crop.waterMm&&climate.seasonRain<crop.waterMm[0])risks.push('Hujan klimatologi 3 bulan di bawah kisaran kebutuhan air satu siklus; periode berbeda, cek neraca air dan irigasi.');
 const known=checks.filter(x=>x.score!==null),coverage=known.reduce((s,x)=>s+x.weight,0);
 const score=coverage?Math.round(known.reduce((s,x)=>s+x.weight*x.score,0)/coverage*100):null;
 const verdict=blocks.length?'blocked':coverage<100?'incomplete':score<65||risks.length?'conditional':'candidate';
 const usable=Number.isFinite(land.usable)?Math.min(100,Math.max(0,land.usable)):80;
 const effective=Number.isFinite(land.areaM2)&&land.areaM2>0?land.areaM2*usable/100:null;
 const population=effective===null?null:Math.floor(effective/(crop.spacing[0]*crop.spacing[1]));
 return {crop,checks,blocks,risks,missing,coverage,score,verdict,effectiveArea:effective,population};
}

export function rank(crops,land,climate){const order={candidate:0,conditional:1,incomplete:2,blocked:3};return crops.map(c=>assess(c,land,climate)).sort((a,b)=>order[a.verdict]-order[b.verdict]||(b.score??-1)-(a.score??-1)||a.crop.name.localeCompare(b.crop.name,'id'));}
