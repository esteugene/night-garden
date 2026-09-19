import {wind} from './materials.js';
import {registerMossCoat,tuneIdOf,eraseUniforms,ERASE_MAX} from './tuning.js';
// Shared low-frequency gust field. Roots stay fixed; movement grows toward tips.
// `width` is the plant's world width: big fronds swing slowly, small ones flutter faster.
// `sway` scales the amplitude (moss fronds use a fraction of a fern's travel).
export function fernWind(mesh,width=3.6,sway=1){
 mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;
 const reach=Math.max(b.max.x-b.min.x,b.max.z-b.min.z)*.5;
 const rate=Math.min(1.5,Math.max(.7,Math.sqrt(3.6/width)));
 mesh.material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{forestTime:wind,plantReach:{value:reach},plantRate:{value:rate},plantSway:{value:sway}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float forestTime;uniform float plantReach;uniform float plantRate;uniform float plantSway;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    vec3 anchor=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
    float freeTip=clamp(length(position.xyz)/plantReach,0.,1.);
    float t=forestTime*plantRate;
    float gust=sin(t*.72+anchor.x*.24+anchor.z*.17);
    float flutter=sin(t*1.13+position.x*5.+anchor.x*.2);
    float travel=plantReach*plantSway*freeTip*freeTip;
    transformed.x+=travel*(gust*.095+flutter*.014);
    transformed.y+=travel*sin(t*.72+anchor.x*.24+position.z*2.)*.027;
    transformed.z+=travel*cos(t*.57+anchor.x*.24+anchor.z*.17)*.032;`);
 };
 mesh.material.customProgramCacheKey=()=> 'forest-shared-wind-v3';
}
// All pieces of a mushroom use one world-space bend, anchored at the root.
export function mushroomWind(group,height){
 group.updateWorldMatrix(true,true);
 group.traverse(mesh=>{if(!mesh.isMesh)return;
  const inverse=mesh.matrixWorld.clone().invert();
  mesh.material.onBeforeCompile=s=>{
   Object.assign(s.uniforms,{forestTime:wind,fungusRoot:{value:group.position.clone()},fungusHeight:{value:height},fungusInverse:{value:inverse}});
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float forestTime;uniform vec3 fungusRoot;uniform float fungusHeight;uniform mat4 fungusInverse;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     vec3 p=(modelMatrix*vec4(position,1.)).xyz;
     float tip=clamp((p.y-fungusRoot.y)/fungusHeight,0.,1.);
     p.x+=sin(forestTime*.72+fungusRoot.x*.24+fungusRoot.z*.17)*.019*fungusHeight*tip*tip;
     p.z+=cos(forestTime*.57+fungusRoot.x*.24)*.008*fungusHeight*tip*tip;
     transformed=(fungusInverse*vec4(p,1.)).xyz;`);
  };mesh.material.customProgramCacheKey=()=> 'forest-fungus-wind-v1';
 });
}
// Dense short growth needs a continuous base below its individual strands.
// `vivid` above 1 makes the coat brighter, greener and more complete (the near rock).
export function mossUndercoat(mesh,vivid=1){
 const amount={value:1};registerMossCoat(tuneIdOf(mesh),amount); // 0..1 from the editor; 0 leaves bare rock
 mesh.material.onBeforeCompile=s=>{
  s.uniforms.mossVivid={value:vivid};s.uniforms.mossAmount=amount;s.uniforms.mossErase=eraseUniforms.spheres;s.uniforms.mossEraseCount=eraseUniforms.count;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 coatP;varying vec3 coatN;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\ncoatP=(modelMatrix*vec4(position,1.)).xyz;coatN=normalize(mat3(modelMatrix)*normal);');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 coatP;varying vec3 coatN;uniform float mossVivid;uniform float mossAmount;uniform vec4 mossErase['+ERASE_MAX+'];uniform int mossEraseCount;')
   .replace('#include <color_fragment>',`#include <color_fragment>
    float extra=clamp(mossVivid-1.,0.,1.);
    float colony=.5+.22*sin(coatP.x*3.1+sin(coatP.z*2.7))+.2*cos(coatP.y*4.3+coatP.z*2.1);
    float growth=smoothstep(.03-.13*extra,.55-.2*extra,coatN.y*.65+coatN.z*.35)*smoothstep(.12-.1*extra,.4-.1*extra,colony)*mossAmount;
    for(int i=0;i<${ERASE_MAX};i++){if(i>=mossEraseCount)break;vec4 s=mossErase[i];growth*=smoothstep(s.w*.75,s.w,distance(coatP,s.xyz));}
    float detail=dot(diffuseColor.rgb,vec3(.3,.5,.2));
    vec3 mossBase=mix(vec3(.036,.052,.009),vec3(.09,.115,.027),colony)*(.65+detail*1.5)*mix(vec3(1.),vec3(.9,1.2,.7),extra)*mossVivid;
    diffuseColor.rgb=mix(diffuseColor.rgb,mossBase,growth*mix(.82,.96,extra));`);
 };
 mesh.material.customProgramCacheKey=()=> 'forest-moss-undercoat-v3';
}
