/* Shared deterministic model: the drawing, readouts and teaching code use these rules. */
const RULES={
hot:['v.t > target + 1','טמפרטורה מעל היעד + 1°C'],cold:['v.t < target - 1','טמפרטורה מתחת ליעד − 1°C'],
coldWater:['v.t < target - 1 && v.l > 20','חימום רק כאשר המפלס מעל 20%'],water:['v.l > 20','הפעלה רק כאשר המפלס מעל 20%'],
dark:['v.x < lightLimit','אור מתחת לסף'],darkOccupied:['v.x < lightLimit && v.p > 0','חושך וגם נוכחות'],
lowHumidity:['v.h < 40','לחות מתחת ל־40%'],dry:['v.m < 40','לחות קרקע מתחת ל־40%'],cool:['v.t > target + 1','טמפרטורה מעל היעד + 1°C'],coolClosed:['v.t > target + 1 && !v.d','קירור כאשר הדלת סגורה'],door:['v.d > 0','דלת פתוחה'],
gas:['v.g > target','CO מעל הסף'],solar:['v.x > 60 && v.t < 65 && v.l > 20','שמש חזקה, מים מתחת ל־65°C ומפלס תקין'],co2:['v.g > 1000','CO₂ מעל 1,000 ppm'],occupiedHot:['v.t > target + 1 && v.p > 0','חום גבוה ונוכחות בכיתה'],
fill:['v.d > 0 && phase == 0 && v.l < 65','מילוי עד 65%, רק בדלת נעולה'],washHeat:['v.d > 0 && phase == 1 && v.l > 40 && v.t < target - 1','חימום בשלב הכביסה בלבד ומעל מפלס 40%'],wash:['v.d > 0 && phase == 1 && v.l > 40','סיבוב בשלב הכביסה עם דלת נעולה'],drain:['v.d > 0 && phase == 2 && v.l > 5','ריקון בשלב הסיום'],oven:['v.t < target - 2 && !v.d && v.t < 420','חימום בדלת סגורה, ניתוק מעל 420°C'],caseHot:['v.t > 60','קירור מעטפת מעל 60°C'],
irrigate:['v.m < target && v.l > 20 && !v.r','קרקע יבשה, מים במאגר וללא גשם'],lowWater:['v.l <= 20','מפלס מים נמוך'],air:['v.g > target','CO₂ מעל הסף'],particles:['v.q > 35','חלקיקים מעל 35 µg/m³'],dirtyWater:['v.q > target && v.l > 20','עכירות גבוהה עם מפלס תקין'],
budgetHeat:['v.t < 22 && v.w + 100 + 80 + 1500 <= target','חימום רק אם תקציב ההספק מאפשר'],budgetFan:['v.w + 100 + 80 <= target','אוורור בעדיפות גבוהה לחימום'],essential:['true','תאורה חיונית נשארת מופעלת'],sauna:['v.t < target - 1 && !v.d && v.t < 105','חימום בדלת סגורה ומתחת ל־105°C'],saunaFan:['v.t > target + 1 || v.h > 65','חום מעל היעד או לחות גבוהה'],always:['true','מופעל בכל זמן שהמערכת תקינה']};
// Configurable engineering limits. Measurement domains remain fixed.
function defaultLimits(p,target=p.target){
 const limits={};for(const s of p.sensors){if(s.max===1)continue;let a=s.min+(s.max-s.min)*.3,b=s.min+(s.max-s.min)*.6;
 if(s.id==='t'){const thermalTarget=p.primary&&p.primary!=='t'?(p.id==='energy'?22:25):target;a=thermalTarget-(p.id==='pizza'?2:1);b=thermalTarget+(p.id==='pizza'?2:1);}
 if(s.id==='l'){a=p.id==='leak'?10:20;b=p.id==='leak'?20:65;}if(s.id==='h'){a=40;b=60;}if(s.id==='m'){a=p.id==='irrigation'?target:40;b=a+15;}
 if(s.id==='x'){a=p.id==='street'?target:30;b=a+10;}if(s.id==='q'){b=p.id==='water'?target:35;a=b*.6;}
 if(s.id==='g'){b=s.max<=100?45:p.primary==='g'?target:1000;a=b*.8;}if(s.id==='w'){b=target;a=Math.max(s.min,target-500);}
 if(s.id==='f'){a=p.id==='pets'?target:p.id==='recycling'?target*.7:20;b=p.id==='pets'?target+50:p.id==='recycling'?target:50;}if(s.id==='u'){a=3;b=20;}if(s.id==='z'){a=1;b=4;}
 a=Math.max(s.min,Math.min(s.max-0.1,a));b=Math.min(s.max,Math.max(a+.1,b));limits[s.id]={min:+a.toFixed(1),max:+b.toFixed(1)};
 }return limits;
}
function validLimits(sensor,min,max){return Number.isFinite(min)&&Number.isFinite(max)&&min>=sensor.min&&max<=sensor.max&&Math.round((max-min)*10)>=1;}
// Normalized power 0..1. The inclusive [min,max] band is a rest zone.
// One band-width beyond a boundary reaches full power; previous power is not latched.
function evaluate(p,v,target,previous=[],phase=0,limits=defaultLimits(p,target)){
 const low=id=>limits[id]?.min,high=id=>limits[id]?.max;
 const clamp=x=>Math.max(0,Math.min(1,x));
 const above=id=>clamp((v[id]-high(id))/(high(id)-low(id)));
 const below=id=>clamp((low(id)-v[id])/(high(id)-low(id)));
 const wet=!('l'in v)||v.l>low('l');
 const power=p.outputs.map(o=>{let request=0;switch(o.rule){
 case 'feed':request=v.p?below('f'):0;break;
 case 'bowlFill':request=below('l');break;
 case 'massLow':request=below('f');break;
 case 'massHigh':request=above('f');break;
 case 'overflow':request=above('l');break;
 case 'leakDrain':request=v.l>high('l')?1:0;break;
 case 'leakAlarm':request=v.l>high('l')||v.h>high('h')?1:0;break;
 case 'supplyWater':request=v.l<low('l')&&v.h<high('h')?1:0;break;
 case 'conveyor':request=v.p&&!v.d&&v.f<high('f')?1:0;break;
 case 'circulateHeat':request=v.z>=low('z')&&v.z<=high('z')?below('t'):0;break;
 case 'geoHeat':request=v.u>=low('u')&&v.z>=low('z')&&v.z<=high('z')?below('t'):0;break;
 case 'loopFault':request=v.z<low('z')||v.z>high('z')?1:0;break;
 case 'gate':request=v.p&&!v.d?1:0;break;
 case 'factoryAlarm':request=v.g>high('g')||v.t>high('t')||v.d?1:0;break;
 case 'foodHeat':request=v.p?below('t'):0;break;
 case 'occupied':request=v.p?1:0;break;
 case 'hot':case 'cool':case 'caseHot':request=above('t');break;
 case 'cold':request=below('t');break;
 case 'coldWater':request=wet?below('t'):0;break;
 case 'coolClosed':request=!v.d?above('t'):0;break;
 case 'occupiedHot':request=v.p?above('t'):0;break;
 case 'oven':request=!v.d&&v.t<420?below('t'):0;break;
 case 'sauna':request=!v.d&&v.t<105?below('t'):0;break;
 case 'saunaFan':request=Math.max(above('t'),above('h'));break;
 case 'water':request=wet?1:0;break;
 case 'lowWater':request=wet?0:1;break;
 case 'dark':request=below('x');break;
 case 'darkOccupied':request=v.p?below('x'):0;break;
 case 'dry':request=below('m');break;
 case 'irrigate':request=wet&&!v.r?below('m'):0;break;
 case 'lowHumidity':request=below('h');break;
 case 'gas':case 'co2':case 'air':request=above('g');break;
 case 'particles':request=above('q');break;
 case 'dirtyWater':request=wet?above('q'):0;break;
 case 'solar':request=wet&&v.t<Math.min(high('t'),65)?above('x'):0;break;
 case 'fill':request=v.d&&phase===0&&v.l<low('l')?1:0;break;
 case 'washHeat':request=v.d&&phase===1&&wet?below('t'):0;break;
 case 'wash':request=v.d&&phase===1&&wet?1:0;break;
 case 'drain':request=v.d&&phase===2&&v.l>5?1:0;break;
 case 'budgetHeat':request=below('t');break;
 case 'budgetFan':request=above('t');break;
 case 'door':request=v.d?1:0;break;
 case 'always':case 'essential':request=1;break;
 }
 // Fixed-speed compressors, solenoids, UV lamps and alarms use suitable discrete drivers.
 return controlMode(o)==='proportional'?request:(request>0?1:0);
 });
 if(p.id==='energy'){
  let remaining=Math.max(0,high('w')-v.w);
  // Essential light, ventilation, heating, in that order; account for actual duty.
  for(const i of [2,1,0]){power[i]=controlMode(p.outputs[i])==='discrete'?(remaining>=p.outputs[i].watts?power[i]:0):Math.min(power[i],remaining/p.outputs[i].watts);remaining=Math.max(0,remaining-power[i]*p.outputs[i].watts);}
 }
 return power;
}
function controlMode(o){
 return ['fan','heater','mist'].includes(o.kind)||o.kind==='pump'&&['dry','irrigate','lowHumidity','dirtyWater','solar','overflow','circulateHeat'].includes(o.rule)||o.kind==='lamp'&&['dark','darkOccupied'].includes(o.rule)?'proportional':'discrete';
}
function driveLabel(o){
 if(o.kind==='heater')return 'SSR במעבר אפס · חלון זמן יחסי';
 if(o.kind==='fan'||o.kind==='pump'&&controlMode(o)==='proportional')return 'מנוע מותאם + בקר מהירות / VFD';
 if(o.kind==='mist')return 'בקר הספק תואם למכשיר';
 if(o.kind==='lamp'&&controlMode(o)==='proportional')return 'תאורה ניתנת לעמעום + דרייבר תואם';
 return o.drive;
}
function advance(p,v,states,dt,limits=defaultLimits(p)){
 const n={...v};let heat=0,cool=0,vent=0,irrigation=0,mist=0,filter=0;
 p.outputs.forEach((o,i)=>{const duty=Number(states[i])||0;if(!duty)return;
 if(o.kind==='heater')heat+=(p.id==='pizza'?.42:p.id==='sauna'?.18:.07)*duty;
 if(o.kind==='fan'&&!['aquarium','aquaponics','pizza'].includes(p.id)){cool+=.055*duty;vent+=duty;}
 if(o.kind==='compressor'){if(['pool','geothermal'].includes(p.id))heat+=.055*duty;else cool+=.12*duty;}
 if(['dry','irrigate'].includes(o.rule)&&o.kind==='pump')irrigation=Math.max(irrigation,duty);
 if(o.rule==='lowHumidity')mist=Math.max(mist,duty);
 if(['dirtyWater','particles'].includes(o.rule)&&['pump','fan'].includes(o.kind))filter=Math.max(filter,duty);
 });
 if('t'in n){const ambient=['fridge','bar'].includes(p.id)?22:p.id==='compost'?40:22;
 const drift=heat||cool?0:(ambient-n.t)*.0008;n.t+=(heat-cool+drift)*dt;}
 if('m'in n)n.m+=(irrigation?.35*irrigation:-.012)*dt;
 if('l'in n&&irrigation)n.l-=.07*irrigation*dt;
 if('h'in n)n.h+=(mist?.18*mist:vent?-.045*vent:-.002)*dt;
 if('g'in n)n.g+=(vent?-4*vent:.15)*dt;
 if('q'in n)n.q+=(filter?-.12*filter:.003)*dt;
 if(p.id==='pets'){n.f+=.7*(states[0]||0)*dt;n.l+=.4*(states[1]||0)*dt;}
 if(p.id==='leak'&&states[0])n.l-=.5*states[0]*dt;
 if(p.id==='greenroof'&&states[2])n.l-=.3*states[2]*dt;
 if(p.id==='recycling'&&states[0])n.f-=.12*states[0]*dt;
 if(p.id==='agriwater')n.u+=(15*(states[0]||0)-n.u)*Math.min(1,dt*.5);
 if(p.id==='geothermal')n.u+=(15*(states[0]||0)-n.u)*Math.min(1,dt*.5);
 if(p.id==='washer'){if(states[0])n.l+=.65*states[0]*dt;if(states[3])n.l-=.8*states[3]*dt;}
 for(const s of p.sensors){
  const band=limits[s.id],old=v[s.id],value=n[s.id];
  // Settle at the boundary once below the visible sensor's 0.1-unit resolution.
  if(band&&old>band.max&&value<old&&value<=band.max+.05)n[s.id]=band.max;
  if(band&&old<band.min&&value>old&&value>=band.min-.05)n[s.id]=band.min;
  n[s.id]=Math.min(s.max,Math.max(s.min,n[s.id]));
 }return n;
};
if(typeof module!=='undefined')module.exports={evaluate,advance,RULES,defaultLimits,validLimits,controlMode,driveLabel};

for(const [key,rule] of Object.entries(RULES)){
 if(['hot','cool','cold','coldWater','coolClosed','occupiedHot','oven','sauna','washHeat'].includes(key))rule[1]='בקרה לפי Tmin / Tmax, עם חסימות דלת ומפלס לפי הצורך';
 if(['dry','irrigate'].includes(key))rule[1]='השקיה מתחת ל־Soilmin עד הגעה ל־Soilmax, בכפוף למפלס ולגשם';
 if(key==='lowHumidity')rule[1]='הוספת לחות מתחת ל־Hmin עד Hmax';
 if(['dark','darkOccupied'].includes(key))rule[1]='תאורה מתחת ל־Lightmin עד Lightmax; נוכחות לפי הפרויקט';
 if(['gas','co2','air'].includes(key))rule[1]='אוורור מעל Gasmax עד Gasmin';
 if(['particles','dirtyWater'].includes(key))rule[1]='סינון מעל Qualitymax עד Qualitymin, עם הגנת מפלס במערכת מים';
 if(key==='water')rule[1]='הפעלה רק מעל מפלס המינימום';
 if(key==='lowWater')rule[1]='התראה במפלס נמוך מהמינימום';
 if(key==='fill')rule[1]='מילוי עד Levelmax בשלב המילוי ורק בדלת נעולה';
 if(key==='wash')rule[1]='כביסה בשלב המתאים ורק מעל Levelmin ובדלת נעולה';
 if(key==='solar')rule[1]='סחרור בשמש מעל Lightmax, מתחת ל־Tmax ועד 65°C, עם מים במאגר';
 if(key==='saunaFan')rule[1]='אוורור מעל Tmax או Hmax';
 if(['budgetHeat','budgetFan'].includes(key))rule[1]='הפעלה רק אם ההספק הכולל אינו עובר Powermax, לפי סדר העדיפויות';
}

for(const key of ['hot','cool','caseHot','coolClosed','occupiedHot'])RULES[key][1]='קירור יחסי רק מעל Tmax; בתחום Tmin–Tmax ההספק אפס';
for(const key of ['cold','coldWater','oven','sauna','washHeat'])RULES[key][1]='חימום יחסי רק מתחת ל־Tmin; בתחום המנוחה ההספק אפס, בכפוף לחסימות';
for(const key of ['dry','irrigate'])RULES[key][1]='השקיה יחסית לחוסר בלחות מתחת ל־Soilmin, עם חסימות מים וגשם';
RULES.lowHumidity[1]='הוספת לחות יחסית לחוסר מתחת ל־Hmin';
for(const key of ['dark','darkOccupied'])RULES[key][1]='עוצמת תאורה יחסית לחוסר מתחת ל־Lightmin, בכפוף לנוכחות לפי הפרויקט';
for(const key of ['gas','co2','air'])RULES[key][1]='אוורור יחסי לחריגה מעל Gasmax; התראה בינארית לפי הצורך';
for(const key of ['particles','dirtyWater'])RULES[key][1]='סינון יחסי לחריגה מעל Qualitymax; UV נשאר בינארי';
RULES.saunaFan[1]='אוורור לפי החריגה הגדולה מבין Tmax ו־Hmax';
RULES.fill[1]='מילוי מתחת ל־Levelmin בשלב המילוי ובדלת נעולה';
RULES.solar[1]='סחרור יחסי לשמש מעל Lightmax, בכפוף לטמפרטורה ולמפלס';
RULES.budgetFan[1]='אוורור יחסי מעל Tmax, בכפוף לתקציב ההספק';
RULES.budgetHeat[1]='חימום יחסי מתחת ל־Tmin לפי התקציב שנותר אחרי תאורה ואוורור';

Object.assign(RULES,{feed:['','מזין פועל מתחת ל־Massmin ורק עם תג מורשה'],bowlFill:['','מילוי מים מתחת ל־Levelmin'],massLow:['','התראת משקל מתחת למינימום'],massHigh:['','התראת משקל מעל למקסימום'],overflow:['','ניקוז מאגר מעל Levelmax'],leakDrain:['','ניקוז הצפה מעל Levelmax'],leakAlarm:['','התראה על מפלס או לחות מעל המקסימום'],supplyWater:['','שסתום NC מוזן רק ללא רטיבות; ללא מתח נסגר'],conveyor:['','מסוע פועל עם פריט, מגן סגור וללא עומס יתר'],circulateHeat:['','סחרור יחסי בדרישת חימום ובלחץ לולאה תקין'],geoHeat:['','מדחס לחימום רק עם ספיקה ולחץ תקינים'],loopFault:['','התראת לחץ מחוץ לתחום'],gate:['','פקודת פתיחה לבקר מחסום כאשר הכניסה מאושרת וללא מכשול'],factoryAlarm:['','התראה בחום, עשן או פתיחת מגן'],foodHeat:['','חימום יחסי מתחת ל־Tmin ורק בעמדה פעילה'],occupied:['','תאורה רק כשהעמדה פעילה']});
