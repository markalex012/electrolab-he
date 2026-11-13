const assert=require('node:assert/strict');
const {PROJECTS}=require('./data.js');
const {evaluate,advance,defaultLimits,validLimits,controlMode}=require('./model.js');
const p=id=>PROJECTS.find(x=>x.id===id);
const vals=p=>Object.fromEntries(p.sensors.map(s=>[s.id,s.value]));
const home=p('home'),limits=defaultLimits(home);limits.t={min:20,max:30};
const calc=(t,old=[])=>evaluate(home,{t,x:90,p:1},25,old,0,limits);
for(const t of [20,20.1,25,29.9,30])for(const old of [[1,0,0],[0,1,0],[]]){assert.equal(calc(t,old)[0],0);assert.equal(calc(t,old)[1],0);}
assert(Math.abs(calc(30.1)[0]-.01)<1e-10);assert.equal(calc(35)[0],.5);assert.equal(calc(40)[0],1);assert.equal(calc(50)[0],1);
assert.equal(calc(15)[1],.5);assert.equal(calc(10)[1],1);assert.equal(calc(19.9)[0],0);
let count=0;
for(const project of PROJECTS){const bands=defaultLimits(project),v=vals(project);
 for(const s of project.sensors){if(s.max!==1)assert(validLimits(s,bands[s.id].min,bands[s.id].max));}
 for(let k=0;k<3;k++){const v=Object.fromEntries(project.sensors.map(s=>[s.id,k===0?s.min:k===1?s.value:s.max]));const power=evaluate(project,v,project.target,[],project.cycle?1:0,bands);assert.equal(power.length,project.outputs.length);assert(power.every(x=>Number.isFinite(x)&&x>=0&&x<=1));const next=advance(project,v,power,10);for(const s of project.sensors)assert(Number.isFinite(next[s.id])&&next[s.id]>=s.min&&next[s.id]<=s.max);count++;}
 // Every project with a thermal band has zero thermal demand throughout that band.
 if(bands.t){for(const t of [bands.t.min,(bands.t.min+bands.t.max)/2,bands.t.max]){const power=evaluate(project,{...v,t},project.target,Array(project.outputs.length).fill(1),1,bands);project.outputs.forEach((o,i)=>{if(['hot','cool','cold','coldWater','coolClosed','occupiedHot','oven','sauna','washHeat','budgetHeat','budgetFan','caseHot'].includes(o.rule))assert.equal(power[i],0,project.id+' '+o.rule+' '+t);});}}
}
assert.equal(evaluate(p('pizza'),{t:100,d:1},300)[0],0);
assert.equal(evaluate(p('sauna'),{t:50,h:25,d:1},80)[0],0);
assert.equal(evaluate(p('aquarium'),{t:10,l:10,x:60},26)[0],0);
assert.equal(evaluate(p('irrigation'),{m:10,l:80,r:1},45)[0],0);
assert.equal(evaluate(p('washer'),{t:10,l:55,d:0},40,[],1)[1],0);
const e=p('energy'),ep=evaluate(e,{w:2450,t:10,x:0},2500);assert(ep.reduce((s,v,i)=>s+v*e.outputs[i].watts,2450)<=2500+1e-9);
for(const [lo,hi]of [[30,20],[20,20],[-1,20],[20,51],[NaN,30]])assert.equal(validLimits(home.sensors[0],lo,hi),false);
assert(validLimits(home.sensors[0],20,30));
const low=advance(home,{t:35,x:60,p:0},[.1,0,0],1),high=advance(home,{t:35,x:60,p:0},[1,0,0],1);assert(high.t<low.t&&low.t<35);assert(Math.abs((35-high.t)/(35-low.t)-10)<1e-8);
const garden=p('irrigation'),gv={m:20,l:80,r:0};const slow=advance(garden,gv,[.1,1,0],1),fast=advance(garden,gv,[1,1,0],1);assert(fast.m>slow.m&&slow.m>gv.m);assert(fast.l<slow.l&&slow.l<gv.l);
assert.equal(controlMode(p('fridge').outputs[0]),'discrete');assert.equal(controlMode(home.outputs[0]),'proportional');
console.log('PASS: '+PROJECTS.length+' projects, '+count+' boundary scenarios, inclusive rest bands, 1/50/100% proportional output, interlocks, power budget, gradual duty-scaled feedback and validation.');
