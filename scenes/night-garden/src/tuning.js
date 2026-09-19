import * as T from 'three';
// Scene tuning. Placement of rocks, mushrooms and lights is authored in code, but small
// adjustments are read from tuning.json beside the scene (shipped with the wallpaper) and,
// while the editor is open (?edit=1 in the preview), from localStorage on top of it.
// Objects and lights register here by a stable id when they are created; the editor
// (tuning-editor.js) lists them from the same registry.
const data={objects:{},lights:{},render:{},moss:{objects:{},erase:[]}};
export const registry={objects:new Map(),lights:new Map()};
// Moss is baked onto rock surfaces when the scene is built; these registries let the
// editor thin it per rock (data.moss.objects[id] = {fibers 0..1, coat 0..1, patches})
// and rub it out locally (data.moss.erase = [[x,y,z,radius], ...] in world units).
// In the wallpaper the erased fibres are simply not generated; in the editor every
// fibre is generated and an aErase attribute hides them, so painting is live.
let editing=false;
export const setEditing=v=>{editing=v;};
export const isEditing=()=>editing;
export const ERASE_MAX=64; // spheres the undercoat shader looks at (the newest ones)
export const eraseUniforms={spheres:{value:new Float32Array(ERASE_MAX*4)},count:{value:0}};
export const moss={fibers:null,coats:new Map(),patches:new Map(),ids:new Set()};
export const STORAGE_KEY='night-garden-tuning';
export const tuningData=()=>data;
export function mergeTuning(extra){
 for(const k of ['objects','lights'])for(const [id,v] of Object.entries(extra?.[k]||{}))data[k][id]={...data[k][id],...v};
 Object.assign(data.render,extra?.render||{});
 if(extra?.moss){for(const [id,v] of Object.entries(extra.moss.objects||{}))data.moss.objects[id]={...data.moss.objects[id],...v};
  if(Array.isArray(extra.moss.erase))data.moss.erase=extra.moss.erase.map(e=>e.slice(0,4));}
}
export async function loadTuning(){
 try{const r=await fetch('tuning.json',{cache:'no-store'});if(r.ok||r.status===0)mergeTuning(await r.json());}catch{}
 try{const local=localStorage.getItem(STORAGE_KEY);if(local)mergeTuning(JSON.parse(local));}catch{}
 for(const [id,o] of registry.objects)applyObject(id,o);
 for(const [id,l] of registry.lights)applyLight(id,l);
 applyMoss();
 return data;
}
export const mossSettings=id=>isHidden(id)?{fibers:0,coat:0,patches:false}:{fibers:1,coat:1,patches:true,...data.moss.objects[id]};
export const hasMoss=id=>moss.ids.has(id);
/** The tuning id of the rock (or log) a mesh belongs to. */
export function tuneIdOf(object){let o=object;while(o&&!o.userData.tuneId)o=o.parent;return o?.userData.tuneId;}
const inside=(x,y,z,s)=>{const dx=x-s[0],dy=y-s[1],dz=z-s[2];return dx*dx+dy*dy+dz*dz<s[3]*s[3];};
/** 1 for every fibre that the stored settings hide: thinned by density or rubbed out. */
export function fiberMask({positions,owners,ownerIds,keys},spheres=data.moss.erase){
 const n=owners.length,mask=new Uint8Array(n),density=ownerIds.map(id=>mossSettings(id).fibers);
 for(let i=0;i<n;i++){if(keys[i]>=density[owners[i]]){mask[i]=1;continue;}
  const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
  for(const s of spheres)if(inside(x,y,z,s)){mask[i]=1;break;}}
 return mask;
}
/** Register the built fibre geometry (editor mode only; the wallpaper bakes the mask). */
export function registerMossFibers(fibers){
 moss.fibers=fibers;fibers.ownerIds.forEach(id=>moss.ids.add(id));
 fibers.attribute=new T.InstancedBufferAttribute(new Float32Array(fibers.owners.length),1).setUsage(T.DynamicDrawUsage);
 fibers.geometry.setAttribute('aErase',fibers.attribute);applyMossFibers();
}
export function registerMossCoat(id,uniform){if(!id)return;moss.ids.add(id);moss.coats.set(id,[...(moss.coats.get(id)||[]),uniform]);uniform.value=mossSettings(id).coat;}
export function registerMossPatch(id,patch){if(!id)return;moss.ids.add(id);patch.userData.mossOwner=id;moss.patches.set(id,[...(moss.patches.get(id)||[]),patch]);applyMossPatches(id);}
function applyMossFibers(){
 const f=moss.fibers;if(!f)return;
 f.attribute.array.set(fiberMask(f));f.attribute.clearUpdateRanges();f.attribute.needsUpdate=true;
}
function applyMossPatches(only){
 for(const [id,patches] of moss.patches){if(only&&id!==only)continue;const on=mossSettings(id).patches;
  for(const p of patches){const {x,y,z}=p.position;p.visible=on&&!data.moss.erase.some(s=>inside(x,y,z,s));}}
}
function applyEraseUniforms(){
 const list=data.moss.erase.slice(-ERASE_MAX),a=eraseUniforms.spheres.value;a.fill(0);
 list.forEach((s,i)=>a.set(s,i*4));eraseUniforms.count.value=list.length;
}
/** Re-apply every moss setting to the live scene. */
export function applyMoss(){
 for(const [id,uniforms] of moss.coats){const v=mossSettings(id).coat;for(const u of uniforms)u.value=v;}
 applyMossPatches();applyEraseUniforms();applyMossFibers();
}
/** Rub moss out around a world point; cheap enough to call on every pointer move. */
export function eraseMossAt(x,y,z,radius){
 const s=[x,y,z,radius].map(v=>+v.toFixed(3));data.moss.erase.push(s);applyEraseUniforms();
 for(const patches of moss.patches.values())for(const p of patches)if(inside(p.position.x,p.position.y,p.position.z,s))p.visible=false;
 const f=moss.fibers;if(!f)return s;
 const a=f.attribute.array,p=f.positions;let lo=Infinity,hi=-1;
 for(let i=0;i<a.length;i++){if(a[i]||!inside(p[i*3],p[i*3+1],p[i*3+2],s))continue;a[i]=1;if(i<lo)lo=i;if(i>hi)hi=i;}
 if(hi>=0){f.attribute.addUpdateRange(lo,hi-lo+1);f.attribute.needsUpdate=true;}
 return s;
}
export const isHidden=id=>!!data.objects[id]?.hidden;
export function applyObject(id,object){
 const o=data.objects[id];
 // A deleted object is only hidden (hidden:true), so it can be brought back; a light
 // owned by it (the glow of a mushroom) goes with it.
 object.visible=!o?.hidden;
 for(const l of registry.lights.values())if(l.userData.ownerId===id)l.visible=object.visible;
 if(!o)return;
 if(o.position)object.position.fromArray(o.position);
 if(o.rotation)object.rotation.fromArray(o.rotation);
 if(o.scale!=null)object.scale.setScalar(o.scale);
 object.updateMatrixWorld(true);
}
export function applyLight(id,light){
 if(light.userData.ownerId)light.visible=!isHidden(light.userData.ownerId);
 const l=data.lights[id];if(!l)return;
 if(l.color)light.color.set(l.color);
 if(l.groundColor&&light.groundColor)light.groundColor.set(l.groundColor);
 if(l.intensity!=null)light.intensity=l.intensity;
 if(l.position)light.position.fromArray(l.position);
 if(l.target&&light.target)light.target.position.fromArray(l.target);
 for(const k of ['distance','angle','penumbra','decay'])if(l[k]!=null&&k in light)light[k]=l[k];
 if(light.userData.baseIntensity!=null&&l.intensity!=null)light.userData.baseIntensity=l.intensity;
}
export function setHidden(id,hidden){
 const object=registry.objects.get(id);if(!object)return;
 if(hidden)data.objects[id]={...data.objects[id],hidden:true};else if(data.objects[id]){delete data.objects[id].hidden;if(!Object.keys(data.objects[id]).length)delete data.objects[id];}
 applyObject(id,object);applyMoss();
}
/** Register an object under a stable id and apply any stored transform. */
export function tuned(id,object){
 object.userData.tuneId=id;
 // What the code placed, so the editor can take an object back to it.
 object.userData.original={position:object.position.clone(),rotation:object.rotation.clone(),scale:object.scale.x};
 registry.objects.set(id,object);applyObject(id,object);return object;}
/** Same for a light. */
export function tunedLight(id,light){
 light.userData.tuneId=id;
 light.userData.original={color:'#'+light.color.getHexString(),groundColor:light.groundColor?'#'+light.groundColor.getHexString():undefined,intensity:light.intensity,position:light.position.toArray(),target:light.target?light.target.position.toArray():undefined,distance:light.distance,angle:light.angle,penumbra:light.penumbra,decay:light.decay};
 registry.lights.set(id,light);applyLight(id,light);return light;}
export function applyRender(renderer,scene){
 const r=data.render;
 if(r.exposure!=null)renderer.toneMappingExposure=r.exposure;
 if(scene.fog){if(r.fogNear!=null)scene.fog.near=r.fogNear;if(r.fogFar!=null)scene.fog.far=r.fogFar;if(r.fogColor)scene.fog.color.set(r.fogColor);}
 if(r.backgroundIntensity!=null)scene.backgroundIntensity=r.backgroundIntensity;
}
/** Colour of a black body at the given temperature, for the light temperature slider. */
export function kelvinToColor(kelvin){
 const t=T.MathUtils.clamp(kelvin,1000,40000)/100;let r,g,b;
 r=t<=66?255:329.698727446*Math.pow(t-60,-.1332047592);
 g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.0755148492);
 b=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;
 const c=v=>T.MathUtils.clamp(v,0,255)/255;
 return new T.Color(c(r),c(g),c(b));
}
