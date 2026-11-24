export function landType(value){return value==='greenhouse'?'greenhouse':'open-field';}
export function cropChoices(crops,type){return landType(type)==='greenhouse'?crops.filter(c=>['melon','tomato','chili','cucumber','cabbage'].includes(c.id)):crops.filter(c=>c.id!=='melon');}
export function climateForType(climate,type,indoorTemperature){return landType(type)==='greenhouse'?{temperature:Number.isFinite(indoorTemperature)?indoorTemperature:null,source:'Suhu rencana di dalam greenhouse (input pengguna), bukan suhu outdoor',rain:null,seasonRain:null,forecastMax:null}:climate;}
export function sameLandType(a,b){return landType(a)===landType(b);}
