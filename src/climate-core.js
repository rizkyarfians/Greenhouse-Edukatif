export function shiftDate(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}

export function summarizeDaily(daily,start,end){
 const keys={temperature:'temperature_2m_mean',min:'temperature_2m_min',max:'temperature_2m_max',rain:'precipitation_sum',humidity:'relative_humidity_2m_mean',et0:'et0_fao_evapotranspiration',radiation:'shortwave_radiation_sum'};
 const rows=[];const times=Array.isArray(daily?.time)?daily.time:[];
 const index=new Map(times.map((d,i)=>[d,i]));
 for(let date=start;date<=end;date=shiftDate(date,1)){
  const i=index.get(date),row={date};
  for(const [key,field] of Object.entries(keys)){const v=i===undefined?null:daily?.[field]?.[i];row[key]=Number.isFinite(v)&&(!['rain','et0','radiation','humidity'].includes(key)||v>=0)&&(key!=='humidity'||v<=100)?v:null;}
  rows.push(row);
 }
 const values=(r,k)=>r.map(x=>x[k]).filter(Number.isFinite);
 const stats=(r,k,mode='mean')=>{const v=values(r,k);return {value:v.length?(mode==='sum'?v.reduce((a,b)=>a+b,0):mode==='min'?Math.min(...v):mode==='max'?Math.max(...v):v.reduce((a,b)=>a+b,0)/v.length):null,days:v.length,expected:r.length};};
 const summarize=r=>({temperature:stats(r,'temperature'),minimum:stats(r,'min','min'),maximum:stats(r,'max','max'),rain:stats(r,'rain','sum'),humidity:stats(r,'humidity'),et0:stats(r,'et0','sum'),radiation:stats(r,'radiation'),rainyDays:{value:values(r,'rain').filter(v=>v>=1).length,days:values(r,'rain').length,expected:r.length}});
 const groups=new Map();for(const r of rows){const m=r.date.slice(0,7);if(!groups.has(m))groups.set(m,[]);groups.get(m).push(r);}
 return {start,end,expectedDays:rows.length,summary:summarize(rows),months:[...groups].map(([month,r])=>({month,...summarize(r)})),rows};
}

export function seasonalBaseline(daily,yearStart,yearEnd,months){
 const lookup=new Map((daily?.time||[]).map((d,i)=>[d,i]));
 return months.map(month=>{
  const samples=[];
  for(let year=yearStart;year<=yearEnd;year++){
   const start=year+'-'+String(month).padStart(2,'0')+'-01';
   const next=new Date(start+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
   const end=shiftDate(next.toISOString().slice(0,10),-1);
   let rain=0,temp=0,n=0,days=0;
   for(let d=start;d<=end;d=shiftDate(d,1)){days++;const i=lookup.get(d),p=daily?.precipitation_sum?.[i],t=daily?.temperature_2m_mean?.[i];if(Number.isFinite(p)&&p>=0&&Number.isFinite(t)){rain+=p;temp+=t;n++;}}
   if(n===days)samples.push({year,rain,temp:temp/n});
  }
  const avg=k=>samples.length?samples.reduce((s,x)=>s+x[k],0)/samples.length:null;
  return {month,years:samples.length,expectedYears:yearEnd-yearStart+1,rainMm:avg('rain'),temperatureC:avg('temp'),rainMinMm:samples.length?Math.min(...samples.map(x=>x.rain)):null,rainMaxMm:samples.length?Math.max(...samples.map(x=>x.rain)):null};
 });
}
