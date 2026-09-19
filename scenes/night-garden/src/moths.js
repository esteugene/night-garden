import * as T from 'three';
import {createMothFlock} from './moth-behavior.js';
import {point} from './composition.js';
// Claude's accepted texture split, hinge, pose and complete landing/takeoff animation.
export function createMoths(scene,maps){
 const flock=createMothFlock({perches:[{x:327,y:581,facing:-.6},{x:466,y:634,facing:-.35},{x:251,y:530,facing:-2.5},{x:600,y:698,facing:-.2}],sizes:[52,44,40,34],airspace:{x0:90,y0:60,x1:1180,y1:660},haunt:{x0:140,y0:120,x1:820,y1:560},config:{flapHz:2.2,cruise:[20,38],rest:[18,40],firstRest:[7,14],fanEvery:[2,5],fanTime:4.5,restWing:.55,fanWing:.12,flyWing:[.1,.64],takeoff:1.8,landing:2.4,airborneLimit:1,turn:.7,flickRate:.015}});
 const material=(map,tint)=>new T.MeshStandardMaterial({map,roughness:1,color:tint,side:T.DoubleSide,alphaTest:.015,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 const moths=flock.moths.map(state=>{
  // The second moth wears the sage skin; the others are cream, darkened for the night.
  const sage=state.id===1,skin=sage?maps.sage:maps,tint=sage?new T.Color(.6,.68,.56):new T.Color(.72,.66,.52);
  const width=state.size/.93/100,height=width*2/3,group=new T.Group();group.rotation.order='ZYX';scene.add(group);
  const body=new T.Mesh(new T.PlaneGeometry(width,height),material(skin.body,tint));body.position.z=.0035;body.receiveShadow=true;group.add(body);
  const wings=[];for(const side of [-1,1]){
   const g=new T.PlaneGeometry(width/2,height),uv=g.attributes.uv;
   for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*.5+(side>0?.5:0));g.translate(side*width/4,0,0);
   const wing=new T.Mesh(g,material(side<0?skin.left:skin.right,tint));wing.receiveShadow=true;group.add(wing);wings.push({wing,side});
  }
  group.position.copy(point(state.x,state.y,1.05));return {state,group,wings,heading:state.heading,depth:1.05,depthGoal:1.05,flying:false,leg:0,retime:0};
 });
 return {moths,flock,update(dt,time,pointer){
  if(pointer){const x=pointer.position[0]*100+793,y=496-pointer.position[1]*100;
   for(const m of flock.moths)if(Math.hypot(m.x-x,m.y-y)<120){
    if(m.state==='rest'&&pointer.speed>1.5)m.timer=0;
    else if(m.state==='fly'){m.goal=pointer.speed>1.5?{x:m.x+(m.x-x)*2,y:m.y+(m.y-y)*2}:{x:x+Math.sin(time+m.id)*40,y:y+Math.cos(time*.7+m.id)*30};m.goalTimer=.3;}
   }
  }
  flock.step(dt);
  for(const item of moths){
   const {state:m,group,wings}=item;
   // While cruising, a moth may drift several metres back toward the pool and return;
   // any other state brings it back to the branch plane before it lands.
   // Every cruise is an excursion: a couple of seconds near the branch, then 8–16 s far
   // out over the pool (8–15 units back), then back to the branch plane to land.
   if(m.state==='fly'){item.retime-=dt;
    if(!item.flying){item.flying=true;item.leg=0;item.retime=1.5+Math.random()*2;item.depthGoal=1.05;}
    else if(item.retime<0){item.leg++;if(item.leg===1){item.depthGoal=-(8+Math.random()*7);item.retime=8+Math.random()*8;}else{item.depthGoal=1.05;item.retime=Infinity;}}}
   else{item.flying=false;item.depthGoal=1.05;}
   item.depth+=(item.depthGoal-item.depth)*(1-Math.exp(-dt*(m.state==='fly'?.5:1.6)));
   // Pseudo-perspective with a short focal length so the shrink is plain to see (about a
   // third of its size at the far end of the excursion).
   const scale=8/(8+(1.05-item.depth));group.scale.setScalar(scale);
   group.position.lerp(point(m.x,m.y+m.bob,item.depth-.02+m.id*.015+Math.sin(time*.7+m.id)*m.air*.15),1-Math.exp(-dt*7));
   item.heading+=Math.atan2(Math.sin(m.heading-item.heading),Math.cos(m.heading-item.heading))*(1-Math.exp(-dt*4));
   group.rotation.set(m.tilt*.55,m.bank*.45,-item.heading-Math.PI/2);
   for(const {wing,side} of wings)wing.rotation.y=-side*(m.wing+(m.state==='rest'?Math.sin(time*.8+m.id)*.035:0));
  }
 }};
}
