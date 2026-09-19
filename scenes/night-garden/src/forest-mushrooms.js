import * as T from 'three';
import {tuned,tunedLight} from './tuning.js';
import {mushroomWind} from './forest-wind.js';
// Art-directed, unequal colonies. Offsets are in each supporting rock's world
// coordinates; roots are raycast onto the rock rather than placed on a flat row.
// Light that seems to come from inside the flesh: strongest at the centre and the
// underside, thinning to the waxy rim. A cheap stand-in for real subsurface scattering.
function waxyGlow(mesh,radius,strength){
 mesh.material.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{capRadius:{value:radius},capGlow:{value:new T.Color('#ffb85c').multiplyScalar(strength)}});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 capLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\ncapLocal=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 capLocal;uniform float capRadius;uniform vec3 capGlow;')
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float rim=clamp(length(capLocal.xz)/capRadius,0.,1.);
    float under=1.-smoothstep(-.05,.35,capLocal.y/capRadius);
    totalEmissiveRadiance+=capGlow*pow(1.-rim,1.3)*(.45+.55*under);`);
 };
 mesh.material.customProgramCacheKey=()=> 'waxy-cap-glow-v1';
}
export function makeForestMushrooms(scene,rocks,depthRocks=[]){
 const lights=[],ray=new T.Raycaster();
 // dx, dz, height, cap radius, stem lean, cap fullness, growth azimuth
 const colonies=[
  {rock:rocks[0],glow:0,items:[[.08,.34,.49,.2,-.11,.9,-.3],[-.26,.02,.22,.13,.06,1.18,.8],[.38,-.24,.32,.12,-.04,.7,-1]]},
  {rock:rocks[1],items:[[-.62,.4,.24,.15,.045,1.25,.5],[-.44,.56,.13,.075,.03,1.1,.9],[-.78,.26,.1,.06,-.04,1.2,-.6]]},
  {rock:rocks[3],glow:0,items:[[-.22,.44,.38,.18,.095,.72,-.7],[.23,-.17,.2,.105,-.045,1.12,.9]]},
  {rock:rocks[5],items:[[-.3,.1,.17,.14,-.03,.58,.3],[.04,.4,.27,.11,.08,1.24,-.8],[-.12,.3,.12,.07,.02,1.1,1.2],[.22,.14,.09,.055,-.03,1.2,-1.4]]},
  // A close clump: four unequal stems rise from one spot on the near rock and fan out,
  // each leaning away from the others (azimuth sets the lean direction).
  {rock:depthRocks[0],foreground:true,glow:0,items:[[.92,.42,1.2,.4,.44,.9,2.6],[.88,.46,.95,.19,.36,1.1,.4],[.96,.4,1.52,.15,.3,.85,-1.3],[.86,.38,.42,.09,.32,1.15,-2.4]]},
  {rock:depthRocks[2],distant:true,items:[[.04,.05,.19,.085,.03,.85,.4]]},
 ];
 colonies.forEach((colony,c)=>{
  if(!colony.rock)return;
  colony.rock.updateWorldMatrix(true,true);
  const box=new T.Box3().setFromObject(colony.rock),center=box.getCenter(new T.Vector3());
  colony.items.forEach(([dx,dz,h,r,lean,dome,azimuth],i)=>{
   ray.set(new T.Vector3(center.x+dx,box.max.y+2,center.z+dz),new T.Vector3(0,-1,0));
   const hit=ray.intersectObject(colony.rock,true)[0];if(!hit)return;
   const group=new T.Group();group.position.copy(hit.point).add(new T.Vector3(0,-.045,0));group.rotation.y=azimuth;
   group.name=`${colony.foreground?'foreground':colony.distant?'distant':'midground'}-mushroom-${c}-${i}`;tuned(`mushroom-${c}-${i}`,group);scene.add(group);
   const curve=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(lean*.08,h*.35,.02),new T.Vector3(lean*.42,h*.74,.035),new T.Vector3(lean,h,0)]);
   const stem=new T.Mesh(new T.TubeGeometry(curve,20,.018+r*.065,9,false),new T.MeshStandardMaterial({color:colony.foreground?'#8e8467':'#c7b78b',emissive:colony.foreground?'#9a7940':'#000000',emissiveIntensity:colony.foreground?.18:0,roughness:.85}));stem.castShadow=true;stem.receiveShadow=true;group.add(stem);
   const profile=[[0,.75],[.22,.74],[.5,.64],[.78,.4],[.97,.12],[1,-.08],[.87,-.18],[.5,-.13],[.08,-.1]].map(([x,y])=>new T.Vector2(x*r,y*r*dome));
   const cap=new T.Mesh(new T.LatheGeometry(profile,40),new T.MeshPhysicalMaterial({color:colony.foreground?'#b19b6c':['#b6a377','#c4af84','#ac9470','#d0bd92'][(c+i)%4],roughness:.5,clearcoat:.45,clearcoatRoughness:.3,side:T.DoubleSide}));
   waxyGlow(cap,r,colony.foreground?.5:colony.distant?.1:.26);cap.position.set(lean,h,0);cap.rotation.z=lean*.8;cap.scale.z=.88+(c%3)*.08;cap.castShadow=true;cap.receiveShadow=true;group.add(cap);
   const underside=new T.Mesh(new T.CircleGeometry(r*.85,36),new T.MeshStandardMaterial({color:'#ddc596',emissive:'#e5ae63',emissiveIntensity:colony.foreground?.55:colony.distant?.12:.18,side:T.DoubleSide}));underside.rotation.x=Math.PI/2;underside.position.set(lean,h-r*.12,0);group.add(underside);
   mushroomWind(group,h);
   if(colony.glow===i){const light=new T.PointLight('#ffd497',colony.foreground?.18:.48,1.4,2);light.position.copy(group.position).add(new T.Vector3(lean,h*.55,.1));light.userData.baseIntensity=light.intensity;light.userData.ownerId=`mushroom-${c}-${i}`;tunedLight(`mushroom-glow-${c}`,light);scene.add(light);lights.push(light);}
  });
 });return lights;
}
