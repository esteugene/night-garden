import assert from 'node:assert/strict';
import {createMoth,updateMoth} from '../src/flight.js';
const home=[-3,1.8,.3];
for(const fps of [20,30,60]){
 const m=createMoth(home);let flew=false,landed=false;
 for(let j=0;j<fps*180;j++){
  updateMoth(m,1/fps,j/fps,null);
  assert(m.position.every(Number.isFinite));
  for(const [i,lo,hi] of [[0,-8,8],[1,.55,6.3],[2,-3.5,3.5]])assert(m.position[i]>=lo&&m.position[i]<=hi);
  if(m.mode==='fly')flew=true;if(flew&&m.mode==='rest')landed=true;
 }assert(flew&&landed);
}
const startled=createMoth(home);
updateMoth(startled,1/60,0,{position:[-2.7,1.8,.3],speed:8});
assert.equal(startled.mode,'fly');assert(startled.velocity[0]<0);assert(startled.panic>0);
const curious=createMoth(home);
updateMoth(curious,1/60,0,{position:[-2.7,1.8,.3],speed:.1});assert.equal(curious.mode,'fly');
const far=createMoth(home);
updateMoth(far,1/60,0,{position:[8,5,1],speed:12});assert.equal(far.mode,'rest');
console.log('PASS: flight, landing, bounds at 20/30/60 fps, cursor attraction/escape/range');
