import assert from 'node:assert/strict';
import {createMothFlock} from '../src/moth-behavior.js';
const flock=createMothFlock({perches:[{x:327,y:581,facing:-.6},{x:466,y:634,facing:-.35},{x:251,y:530,facing:-2.5}],airspace:{x0:90,y0:60,x1:1180,y1:660},config:{flapHz:2.2,cruise:[20,38],rest:[18,40],firstRest:[7,14],fanEvery:[2,5],fanTime:4.5,restWing:.55,fanWing:.12,flyWing:[.1,.64],takeoff:1.8,landing:2.4,airborneLimit:1,turn:.7,flickRate:.015}});
const flying=new Set(),restWing=flock.moths.map(()=>({min:Infinity,max:-Infinity}));
for(let i=0;i<60*300;i++){
 flock.step(1/60);assert.ok(flock.airborne<=1);
 for(const m of flock.moths){assert.ok(Number.isFinite(m.x+m.y+m.wing));if(m.state==='fly')flying.add(m.id);if(m.state==='rest'){restWing[m.id].min=Math.min(restWing[m.id].min,m.wing);restWing[m.id].max=Math.max(restWing[m.id].max,m.wing);}}
}
assert.equal(flying.size,3,'Every moth must leave its perch');assert.ok(flock.events.landings>0,'Must land again');
for(const wing of restWing)assert.ok(wing.max-wing.min>.2,'Every resting moth must visibly fan its wings');
console.log('Calm flock: all moths fly and fan; landing verified; at most one airborne.',flock.events);
