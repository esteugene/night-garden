import * as T from 'three';
import {GLTFLoader} from '../vendor/three-addons/loaders/GLTFLoader.js';
import {point,BRANCH,ROCKS} from './composition.js';
import {branchGeometry} from './surfaces.js';
import {makeForestMushrooms} from './forest-mushrooms.js';
import {surfaceSampler} from './moss.js';
import {randomGenerator,noise} from './math.js';
import {wind} from './materials.js';
import {createForestWater} from './forest-water.js';
import {fernWind,mossUndercoat} from './forest-wind.js';
import {addForestDetails} from './forest-details.js';
import {createStoneLantern} from './stone-lantern.js';
import {tuned,tuneIdOf,isEditing,fiberMask,registerMossFibers,registerMossPatch} from './tuning.js';

// iMoss by Hieu Le, adapted under CC BY-NC 4.0. See THIRD-PARTY.md.
// `rocks` holds [mesh, vivid, samples]: vivid above 1 grows brighter, taller, greener fibres.
async function mossFibers(scene,rocks){
 const vertexShader=await (await fetch('vendor/imoss/src/shaders/mossball.vert')).text();
 const rnd=randomGenerator(7731),values={aBasePos:[],aNormal:[],aTangent:[],aBitangent:[],aBendState:[],aHeightScale:[],aLengthScale:[],aVivid:[]};
 const owners=[],keys=[],ownerIds=[];
 for(const [rock,vivid=1,samples=95000] of rocks){const sample=surfaceSampler(rock,rnd),owner=ownerIds.push(tuneIdOf(rock)||rock.name||'?')-1;for(let i=0;i<samples;i++){
  const {point:p,normal:n}=sample();if(n.y*.65+n.z*.35<.05||noise(p.x*2,p.y*2,p.z*2)<.1)continue;
  const tangent=new T.Vector3().crossVectors(Math.abs(n.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0),n).normalize();
  tangent.applyAxisAngle(n,noise(p.x*.8+100,p.y*.8,p.z*.8)*6.28);const bitangent=new T.Vector3().crossVectors(n,tangent);
  values.aBasePos.push(...p);values.aNormal.push(...n);values.aTangent.push(...tangent);values.aBitangent.push(...bitangent);
  values.aBendState.push((rnd()-.5)*.014,(rnd()-.5)*.014);values.aHeightScale.push((.65+rnd()*.7)*(1+Math.max(0,vivid-1)*.5));values.aLengthScale.push(.55+noise(p.x*6,p.y*6,p.z*6)*.9);values.aVivid.push(vivid);owners.push(owner);keys.push(rnd());
 }}
 // Tuning: per-rock density and the eraser. The wallpaper drops hidden fibres here;
 // the editor keeps them all and hides them through aErase so painting is live.
 const fibers={positions:values.aBasePos,owners,ownerIds,keys};
 if(!isEditing()){const mask=fiberMask(fibers);const keep=[];for(let i=0;i<mask.length;i++)if(!mask[i])keep.push(i);
  const widths={aBendState:2,aHeightScale:1,aLengthScale:1,aVivid:1};
  for(const [name,arr] of Object.entries(values)){const w=widths[name]||3,out=new Array(keep.length*w);keep.forEach((k,j)=>{for(let c=0;c<w;c++)out[j*w+c]=arr[k*w+c];});values[name]=out;}}
 const base=new T.PlaneGeometry(.024,.043,1,2);base.translate(0,.0215,0);const geometry=new T.InstancedBufferGeometry();geometry.index=base.index;geometry.attributes={...base.attributes};
 for(const [name,data] of Object.entries(values))geometry.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(data),name==='aBendState'?2:name==='aHeightScale'||name==='aLengthScale'||name==='aVivid'?1:3));
 geometry.instanceCount=values.aLengthScale.length;
 if(isEditing())registerMossFibers({geometry,positions:new Float32Array(values.aBasePos),owners:new Uint8Array(owners),ownerIds,keys:new Float32Array(keys)});
 const material=new T.MeshStandardMaterial({color:0xffffff,side:T.DoubleSide,roughness:1});
 // Keep iMoss bending, but let real scene lighting and shadow maps shade it.
 const header=vertexShader.slice(0,vertexShader.indexOf('varying float vHeight;'))+'\nvarying float mossH;varying vec3 mossP;attribute float aVivid;varying float mossVivid;'+(isEditing()?'attribute float aErase;':'const float aErase=0.;');
 const body=vertexShader.slice(vertexShader.indexOf('  vec3 pos = position;'),vertexShader.indexOf('  vWorldPos = worldPos;')).replace('vHeight = t;','mossH = t;');
 material.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{uTime:wind,uWindSpeed:{value:.5},uWindAmplitude:{value:.012},uLengthMultiplier:{value:1},uClumpStrength:{value:.009},uMotionClumpBoost:{value:0}});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\n'+header)
   .replace('#include <beginnormal_vertex>','vec3 objectNormal=normalize(aNormal);')
   .replace('#include <begin_vertex>',body+'\nvec3 transformed=aErase>.5?vec3(0.):worldPos;mossP=worldPos;mossVivid=aVivid;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float mossH;varying vec3 mossP;varying float mossVivid;')
   .replace('#include <color_fragment>',`#include <color_fragment>
    float colony=.5+.5*sin(mossP.x*3.+sin(mossP.z*4.))*cos(mossP.y*4.);
    float extra=clamp(mossVivid-1.,0.,1.);
    vec3 root=vec3(.014,.019,.004)*mossVivid;vec3 tip=mix(vec3(.14,.19,.035),vec3(.22,.26,.055),colony)*mix(vec3(1.),vec3(.85,1.15,.65),extra)*mossVivid;
    diffuseColor.rgb*=mix(root,tip,smoothstep(0.,1.,mossH));`);
 };
 material.customProgramCacheKey=()=> 'forest-moss-scene-light-v4'+(isEditing()?'e':'');
 const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.name='iMoss-surface-fibers';scene.add(mesh);return geometry.instanceCount;
}
function prepared(source,width){
 const copy=source.clone(true);copy.position.set(0,0,0);copy.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(copy),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
 const group=new T.Group();copy.position.sub(center);group.add(copy);group.scale.setScalar(width/size.x);
 copy.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.side=T.DoubleSide;o.material.roughness=.9;o.castShadow=true;o.receiveShadow=true;if(o.material.map)o.material.map.anisotropy=4;}});return group;
}
export async function buildAssetGarden(scene,materials){
 const loader=new GLTFLoader();const [rockSet,ferns,moss]=await Promise.all(['rock_moss_set_01','fern_02','moss_01'].map(n=>loader.loadAsync(`assets/${n}/${n}.gltf`)));
 const textureLoader=new T.TextureLoader();
 const alpha=await Promise.all(['fern_02','moss_01'].map(n=>textureLoader.loadAsync(`assets/${n}/alpha.png`)));
 [ferns,moss].forEach((asset,i)=>{alpha[i].flipY=false;asset.scene.traverse(o=>{if(o.isMesh){o.material.alphaMap=alpha[i];o.material.alphaTest=.45;o.material.alphaToCoverage=true;o.material.transparent=false;o.material.depthWrite=true;o.material.needsUpdate=true;}})});
 const rockMeshes=[];
 ROCKS.forEach(({box,z},i)=>{const rock=prepared(rockSet.scene.children[i%6],(box[2]-box[0])/100*1.15);rock.position.copy(point((box[0]+box[2])/2,(box[1]+box[3])/2,z));if(i===4){rock.position.x+=.55;rock.position.y+=.28;}rock.rotation.set(.36,(i-2)*.31,(i%2?-.08:.08));tuned(`rock-${i}`,rock);scene.add(rock);rock.updateMatrixWorld(true);rock.traverse(o=>{if(o.isMesh){mossUndercoat(o,i===0?1.6:1);rockMeshes.push(o)}});});
 const heroMesh=rockMeshes[0];
 // Lower supporting stones close gaps without obstructing the distant forest.
 for(let i=0;i<7;i++){const rock=prepared(rockSet.scene.children[(i+2)%6],2.8);rock.position.set(-8+i*2.7+(i===3?-1.05:0),-5.1,1);rock.rotation.set(.5,i*.67,0);tuned(`shore-rock-${i}`,rock);scene.add(rock);rock.updateMatrixWorld(true);rock.traverse(o=>{if(o.isMesh){mossUndercoat(o);rockMeshes.push(o)}});}
 // Foreground softly frames the corners; middle ground carries the crisp foliage;
 // smaller darker ferns behind the branch create a third depth layer.
 const fernLayout=[
 [-7.2,1.3,1.3,5.8,.5],[-6.2,-.1,1.7,4.6,-.45],[-5.1,-1.3,.1,3.8,.8],
 [-7.8,3,-1.5,4.2,-.4],[-6.5,2.5,-2.8,3.2,.8],[-4.9,.5,-2,3.5,1.2],
 [-4,-2.1,.4,2.8,-.5],[-2.2,-3,1,2.5,.6],[-1,-3.5,1.5,1.7,-.7],
 [7.4,.1,1,5.6,-.7],[6.1,-1.2,.3,3.9,.4],[5,-2.2,-.8,3.4,-.6],
 [7.7,2,-2.8,3.8,.2],[6.2,.3,-3.2,3,.7],[4.3,-2.6,-2.5,2.5,1.1],
 [-8.6,-2.6,8.8,4.2,-.1],[7.6,-3.4,8.8,5.2,.2],[-8.9,-5.4,8.6,3.4,.6],
 [3.7,-5.1,8.6,3.8,-.6],[-3.8,-4,2.5,1.8,.9],[3.3,-3.9,2,1.9,-.4],
 [5.2,-4.2,2.8,2,.6],[-6,-3.6,3.5,2.2,-1],
 ];
 fernLayout.forEach(([x,y,z,w,r],i)=>{const f=prepared(ferns.scene.children[i%4],w);f.position.set(x,y,z);f.rotation.set(.2+(i%3)*.12,r,i%2?.22:-.18);f.name=z>6?'soft-foreground-fern':z<0?'background-fern':'midground-fern';
 f.traverse(o=>{if(o.isMesh){o.material.color.set(z<0?'#657e76':'#aeb997');fernWind(o,w);}});tuned(`fern-${i}`,f);scene.add(f);});
 const rnd=randomGenerator(7352);
 // Real frond silhouettes in small islands; fibers fill the transitions.
 for(let i=0;i<92;i++){const source=moss.scene.children[i%12],patch=prepared(source,.3+rnd()*.45);patch.rotation.set(.9,rnd()*6.28,0);patch.scale.y*=.6;const host=rockMeshes[i%rockMeshes.length];patch.traverse(o=>{if(!o.isMesh)return;o.material.color.set(host===heroMesh?'#9dc47e':'#b8ad78');fernWind(o,1.2,.35);});const sample=surfaceSampler(host,rnd);let s;for(let k=0;k<30;k++){s=sample();if(s.normal.y>.4&&s.normal.z>-.2)break;}patch.position.copy(s.point).addScaledVector(s.normal,.015);scene.add(patch);registerMossPatch(tuneIdOf(host),patch);}
 const log=new T.Mesh(branchGeometry(BRANCH.map(p=>point(...p)),.29,.075,6.3),materials.wood);log.castShadow=true;log.receiveShadow=true;tuned('log',log);scene.add(log);
 const depthRocks=[],nearMeshes=[];
 // Near rock lip in both lower corners; small, dim banks guide the eye into the pool.
 // The left one carries the glowing trio, so it rises well into the frame and is mossed
 // like the middle rocks (undercoat, fibres and model patches) rather than left bare.
 for(const [i,x,y,z,w] of [[2,-5.8,-4.4,6.6,5],[4,5.6,-5.13,7.2,4.2],[1,-1.5,-2.6,-5,1.5],[3,2.8,-2.5,-8,.85],[0,1.2,-2,-14,.5]]){
  const rock=prepared(rockSet.scene.children[i],w);rock.position.set(x,y,z);rock.rotation.set(.3,i*.8,0);tuned(`depth-rock-${depthRocks.length}`,rock);scene.add(rock);rock.updateMatrixWorld(true);depthRocks.push(rock);
  rock.traverse(o=>{if(!o.isMesh)return;o.material.color.set(z<0?'#596455':'#777551');if(depthRocks.length===1){mossUndercoat(o,1.9);nearMeshes.push(o);}});
 }
 const lanternRock=prepared(rockSet.scene.children[5],1.5);lanternRock.position.set(3.9,-2.45,-6.5);lanternRock.rotation.set(.2,1.1,0);lanternRock.traverse(o=>{if(o.isMesh)o.material.color.set('#4d574d')});tuned('lantern-rock',lanternRock);scene.add(lanternRock);
 const lantern=createStoneLantern(materials.stone);lantern.position.set(3.9,-1.98,-6.5);lantern.scale.setScalar(.95);tuned('lantern',lantern);scene.add(lantern);
 const landmarks={lantern:lantern.position.clone().add(new T.Vector3(0,.98*lantern.scale.y,0))}; // the fire box, where fireflies hover
 for(let i=0;i<28;i++){const patch=prepared(moss.scene.children[(i*5)%12],.6+rnd()*.6);patch.rotation.set(.9,rnd()*6.28,0);patch.scale.y*=.6;patch.traverse(o=>{if(!o.isMesh)return;o.material.color.set('#96bd7a');fernWind(o,1.2,.35);});const sample=surfaceSampler(nearMeshes[0],rnd);let s;for(let k=0;k<40;k++){s=sample();if(s.normal.y>.35&&s.normal.z>-.2&&s.point.y>-5.3)break;}patch.position.copy(s.point).addScaledVector(s.normal,.015);patch.name='near-rock-moss-patch';scene.add(patch);registerMossPatch(tuneIdOf(nearMeshes[0]),patch);}
 if(!log.geometry.attributes.normal)log.geometry.computeVertexNormals();
 const fibers=await mossFibers(scene,[...rockMeshes.slice(0,8).map((m,i)=>m===heroMesh?[m,1.6,160000]:i<6?[m,1.35,135000]:[m,1,95000]),[log,1.25,70000],...nearMeshes.map(m=>[m,1.9,170000])]);
 const water=createForestWater(scene);
 addForestDetails(scene,rockSet.scene,rockMeshes,prepared,materials.wood,materials.stone);
 return {water,mushroomGlows:makeForestMushrooms(scene,rockMeshes,depthRocks),geometry:{mossInstances:fibers},landmarks};
}
