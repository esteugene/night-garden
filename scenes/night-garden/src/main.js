import * as T from 'three';
import {createFrameLoop} from './frame-loop.js';
import {randomGenerator} from './math.js';
import {loadMaterials,wind} from './materials.js';
import {buildAssetGarden} from './garden-assets.js';
import {createMoths} from './moths.js';
import {createLens} from './lens.js';
import {fitCamera,point} from './composition.js';
import {loadTuning,tunedLight,applyRender,setEditing} from './tuning.js';

const canvas=document.querySelector('#scene'),loading=document.querySelector('#loading'),button=document.querySelector('#pause');
const host=document.documentElement.dataset.motion==='host';
let paused=!host&&matchMedia('(prefers-reduced-motion: reduce)').matches,rate=host?0:60,battery=false,loop,time=0,world,animals,frameCount=0,editor=null;
const failures=[];
const statsPanel=new URLSearchParams(location.search).has('stats')?document.body.appendChild(document.createElement('output')):null;
if(statsPanel)Object.assign(statsPanel.style,{position:'fixed',top:'12px',left:'12px',color:'#cfdbbd',background:'#07120ddd',padding:'8px',font:'12px monospace',zIndex:10});
let statsTime=performance.now(),statsFrames=0;

window.addEventListener('error',e=>failures.push(e.message));
window.habitatRate=n=>{rate=Number.isFinite(n)?T.MathUtils.clamp(n,0,60):0;loop?.setRate(rate)};
window.habitatPower=b=>{battery=!!b;resize()};
const renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
renderer.debug.onShaderError=(gl,program,vs,fs)=>{const message=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs)].filter(Boolean).join('\n');failures.push(message);console.error(message);loading.textContent='The garden shader could not start. Details are in the browser console.';document.body.appendChild(loading);};
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.info.autoReset=false;
const scene=new T.Scene();scene.background=new T.Color('#07120f');scene.fog=new T.Fog('#0a1614',21,44);
const camera=new T.OrthographicCamera(-7.93,7.93,4.96,-4.96,.1,80);camera.position.set(0,0,20);camera.lookAt(0,0,0);
const lens=createLens(renderer);
const hemisphere=tunedLight('hemisphere',new T.HemisphereLight('#a7b5a4','#302c19',.5));scene.add(hemisphere);
const moon=new T.DirectionalLight('#e1dcc0',1.6);moon.position.set(-5,7,-1);moon.castShadow=true;
moon.shadow.mapSize.set(1536,1536);Object.assign(moon.shadow.camera,{left:-13,right:13,top:10,bottom:-9,near:.1,far:35});moon.shadow.normalBias=.018;moon.shadow.bias=-.00007;moon.shadow.radius=2;
moon.target.position.set(0,-2,1);tunedLight('moon',moon);scene.add(moon,moon.target);
const rim=new T.DirectionalLight('#9bad9b',.85);rim.position.set(5,5,-5);tunedLight('rim',rim);scene.add(rim);
// Camera-side fill: without it every surface facing the viewer saw only the hemisphere.
const fill=new T.DirectionalLight('#b4c8b0',.8);fill.position.set(1.5,4,10);fill.target.position.set(0,-2,0);tunedLight('fill',fill);scene.add(fill,fill.target);
// Cool moonlit accent on the near left rock so its moss reads under the glowing trio.
const nearLight=new T.SpotLight('#d6d9a2',20,24,.6,.7,1.6);nearLight.position.set(-7,5,13);nearLight.target.position.set(-5.6,-3.6,4);tunedLight('near-rock-spot',nearLight);scene.add(nearLight,nearLight.target);
const warm=new T.SpotLight('#ffd29a',24,18,.48,.65,2);warm.position.set(-6,2,4);warm.target.position.set(-5,-2,1);tunedLight('warm-spot',warm);scene.add(warm,warm.target);

const pointer={active:false,position:new T.Vector3(),speed:0,last:0},ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,0,1),-1),hit=new T.Vector3();
canvas.addEventListener('pointermove',e=>{
 const box=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-box.left)/box.width*2-1,1-(e.clientY-box.top)/box.height*2),camera);
 if(!ray.ray.intersectPlane(plane,hit))return;const now=performance.now();pointer.speed=pointer.active?Math.min(35,hit.distanceTo(pointer.position)/Math.max(.008,(now-pointer.last)/1000)):0;
 pointer.position.copy(hit);pointer.last=now;pointer.active=true;
});
canvas.addEventListener('pointerleave',()=>pointer.active=false);

const rnd=randomGenerator(19371),range=(a,b)=>a+(b-a)*rnd();
const flies=[];
function makeFireflies(){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(64,64,0,64,64,64);
 grad.addColorStop(0,'rgba(255,248,209,1)');grad.addColorStop(.07,'rgba(255,238,173,1)');grad.addColorStop(.16,'rgba(255,208,110,.42)');grad.addColorStop(.42,'rgba(232,159,61,.085)');grad.addColorStop(1,'rgba(220,148,60,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
 // A second, out-of-focus disc for fireflies in front of the near rocks: the lens pass
 // cannot blur them (sprites write no depth), so the texture is the bokeh itself.
 const c2=document.createElement('canvas');c2.width=c2.height=128;const ctx2=c2.getContext('2d'),soft=ctx2.createRadialGradient(64,64,0,64,64,64);
 soft.addColorStop(0,'rgba(255,240,190,.8)');soft.addColorStop(.5,'rgba(255,214,130,.62)');soft.addColorStop(.8,'rgba(236,170,80,.22)');soft.addColorStop(1,'rgba(220,148,60,0)');ctx2.fillStyle=soft;ctx2.fillRect(0,0,128,128);
 const bokeh=new T.CanvasTexture(c2);bokeh.colorSpace=T.SRGBColorSpace;
 // The stage camera is orthographic, so distance is shown by hand: a pseudo-perspective
 // factor shrinks and dims sprites as they recede (about 30 % at the far tree line).
 for(let i=0;i<70;i++){
  const front=i>=64,far=!front&&i%10<7,z=front?range(8.5,10.5):far?-(4+rnd()**1.2*28):range(-2,3);
  const material=new T.SpriteMaterial({map:front?bokeh:map,color:i%4===0?new T.Color(.75,.62,.3):new T.Color(.52,.82,.26),transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false});
  const s=new T.Sprite(material);s.position.copy(point(range(70,1520),far?range(60,700):range(75,755),z));scene.add(s);
  if(i<6&&world.landmarks.lantern)s.position.copy(world.landmarks.lantern).add(new T.Vector3(range(-.9,.9),range(-.5,.9),range(-.8,.8)));
  // curiosity: how much this one cares about the pointer (many hardly do); interest: how far
  // it has warmed to the current visit. Both keep the gathering slow, partial and uneven.
  flies.push({sprite:s,front,origin:s.position.clone(),velocity:new T.Vector3(),phase:rnd()*6.28,panic:0,size:front?range(.06,.09):range(.09,.17),following:false,curiosity:front?0:rnd()**1.5,interest:0,wander:[range(.5,.9),range(.7,1.3),range(.35,.8),range(.5,1.3)]});
 }
}
const perspective=z=>12/(12+(1-z));
// Fireflies that hover at the lantern light it: one point light follows their centroid.
const lanternGlow=tunedLight('lantern-glow',new T.PointLight('#ffc978',0,1.8,2));scene.add(lanternGlow);const centroid=new T.Vector3();
const delta=new T.Vector3(),goal=new T.Vector3(),orbit=new T.Vector3();
function draw(dt,now){
 time+=dt;wind.value=time;frameCount++;if(pointer.active&&now-pointer.last>70)pointer.speed*=Math.exp(-dt*8);
 animals.update(dt,time,pointer.active?{position:pointer.position.toArray(),speed:pointer.speed}:null);
 for(const f of flies){
  const p=f.sprite.position;goal.copy(f.origin);goal.x+=Math.sin(time*.26+f.phase)*.7;goal.y+=Math.sin(time*.43+f.phase)*.3;goal.z+=Math.cos(time*.21+f.phase)*.5;
  let drawn=false;
  if(pointer.active){delta.subVectors(pointer.position,p);const distance=Math.hypot(delta.x,delta.y);if(distance<3.2){if(pointer.speed>3)f.panic=.8;if(f.panic>0)goal.copy(p).addScaledVector(delta.normalize(),-2);else if(pointer.speed<.9&&f.curiosity>.35)drawn=true;}}
  f.interest=T.MathUtils.clamp(f.interest+(drawn?dt*.12*f.curiosity:-dt*.2),0,1);f.following=f.interest>.05;
  if(f.following){
   // Each one wanders on its own looping path around the pointer, at its own radius and
   // depth, so the group never settles into a ring.
   const [a,b,c,radius]=f.wander,t=time+f.phase*4;
   orbit.set(Math.sin(t*a)*radius+Math.sin(t*b*1.7)*.25,Math.cos(t*c)*radius*.6+Math.sin(t*a*.6)*.2,-1.4+Math.sin(t*b*.5)*1.1);
   goal.lerp(orbit.add(pointer.position),f.interest);
  }
  f.panic=Math.max(0,f.panic-dt);delta.subVectors(goal,p);f.velocity.addScaledVector(delta,dt*(f.following?.9:1.6)).multiplyScalar(Math.exp(-dt*2));p.addScaledVector(f.velocity,dt);
  p.x=T.MathUtils.clamp(p.x,-7.8,7.8);p.y=T.MathUtils.clamp(p.y,-3.5,4.3);p.z=T.MathUtils.clamp(p.z,-33,f.front?11:5);
  const near=perspective(p.z);f.sprite.scale.setScalar(f.size*near);f.sprite.material.opacity=(.2+.3*Math.sin(time*.5+f.phase)**2)*(f.front?.3:Math.pow(near,.7));
 }
 if(world.landmarks.lantern){let count=0;centroid.set(0,0,0);for(const f of flies){if(f.sprite.position.distanceTo(world.landmarks.lantern)<1.5){count++;centroid.add(f.sprite.position);}}
  lanternGlow.intensity+=((count?Math.min(.55,count*.12)*(.8+.2*Math.sin(time*2.3)):0)-lanternGlow.intensity)*(1-Math.exp(-dt*3));if(count)lanternGlow.position.lerp(centroid.multiplyScalar(1/count),1-Math.exp(-dt*2));}
 world.mushroomGlows.forEach((light,i)=>light.intensity=(light.userData.baseIntensity??.48)*(1+Math.sin(time*.35+i)*.03));
 editor?.update();renderer.info.reset();lens.render(scene,camera);
 if(statsPanel){statsFrames++;const stamp=performance.now();if(stamp-statsTime>2000){statsPanel.textContent=`${(statsFrames*1000/(stamp-statsTime)).toFixed(0)} fps · ${(renderer.info.render.triangles/1e6).toFixed(2)}M triangles · ${renderer.info.render.calls} draws`;statsTime=stamp;statsFrames=0;}}

}
function resize(){
 const w=innerWidth,h=innerHeight,dpr=window.habitatDprOverride||Math.min(devicePixelRatio,battery?1:1.5);renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);lens.resize(Math.round(w*dpr),Math.round(h*dpr));
 fitCamera(camera,w,h);
 if(scene.background?.isTexture){const imageAspect=scene.background.image.width/scene.background.image.height,aspect=w/h;scene.background.repeat.set(Math.min(1,aspect/imageAspect),Math.min(1,imageAspect/aspect));scene.background.offset.set((1-scene.background.repeat.x)/2,(1-scene.background.repeat.y)/2);}
 loop?.invalidate();
}
resize();addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>loop?.setHidden(document.hidden));
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();loop?.setHidden(true)});canvas.addEventListener('webglcontextrestored',()=>location.reload());
function toggle(){paused=!paused;loop?.setPaused(paused);button.textContent=paused?'Resume':'Pause'}button.onclick=toggle;button.textContent=paused?'Resume':'Pause';
addEventListener('keydown',e=>{if(!host&&e.code==='Space'&&e.target!==button){e.preventDefault();toggle()}});
if(statsPanel)window.habitatDebug={scene,renderer,lens,camera,moon,resize};
window.habitatStats=()=>({version:'registered-composition',frames:frameCount,loop:loop?.state,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometry:world?.geometry,failures,
 moths:animals?.moths.map(({state,depth})=>({mode:state.state,position:[state.x,state.y],depth:+depth.toFixed(2)})),
 pointer:{active:pointer.active,speed:+pointer.speed.toFixed(2),position:pointer.position.toArray().map(v=>+v.toFixed(2))},
 fireflies:{total:flies.length,following:flies.filter(f=>f.following).length,near:flies.filter(f=>f.sprite.position.z>-4).length,panicking:flies.filter(f=>f.panic>0).length,front:flies.filter(f=>f.front).map(f=>({position:f.sprite.position.toArray().map(v=>+v.toFixed(2)),scale:+f.sprite.scale.x.toFixed(2),opacity:+f.sprite.material.opacity.toFixed(2)}))}});
async function start(){
 setEditing(!host&&new URLSearchParams(location.search).has('edit'));await loadTuning();
 const materials=await loadMaterials(renderer);scene.background=materials.background;scene.backgroundIntensity=1.7;applyRender(renderer,scene);
 world=await buildAssetGarden(scene,materials);world.water.setReflection(lens.history);animals=createMoths(scene,materials);makeFireflies();resize();
 // Static scenery casts one shadow map; wing and wind motion is too small to justify
 // re-rendering hundreds of thousands of shadow triangles every frame.
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 loop=createFrameLoop(draw,{fps:rate,paused,hidden:document.hidden});loading.remove();
 // The placement editor is preview-only: ?edit=1 loads it after the scene is built.
 if(!host&&new URLSearchParams(location.search).has('edit')){const {createTuningEditor}=await import('./tuning-editor.js');editor=createTuningEditor({scene,camera,renderer,canvas,loop,world});}
}
start().catch(e=>{console.error(e);failures.push(e.message);loading.textContent='Could not load garden: '+e.message});
// A labelled concept overlay enables comparison at the same viewport and crop.
const referenceButton=document.querySelector('#reference'),referenceView=document.querySelector('#reference-view');
referenceButton?.addEventListener('click',()=>{const open=referenceView.hidden;referenceView.hidden=!open;referenceButton.setAttribute('aria-pressed',String(open));referenceButton.textContent=open?'Back to garden':'Reference';referenceView.style.opacity=String(Number(document.querySelector('#reference-opacity').value)/100)});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!referenceView.hidden)referenceButton.click()});

const overlaySlider=document.querySelector("#reference-opacity");overlaySlider?.addEventListener("input",()=>{referenceView.style.opacity=String(Number(overlaySlider.value)/100)});
