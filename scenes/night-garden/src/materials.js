import * as T from 'three';
export const wind={value:0};
const stochasticGLSL=`
// Offset three unrelated projections and vary the blend continuously. No repeated grid.
vec3 mossSample(vec2 p){
 float w=noise3(vec3(p*.38,2.));
 vec3 a=texture2D(mossMap,p).rgb;
 vec3 b=texture2D(mossMap,mat2(.8,-.6,.6,.8)*p*.83+vec2(.317,.731)).rgb;
 vec3 c=texture2D(mossMap,mat2(-.28,.96,-.96,-.28)*p*1.27+vec2(.71,.19)).rgb;
 return mix(mix(a,b,smoothstep(.2,.8,w)),c,.2+.25*noise3(vec3(p*.61,8.)));
}`;
const noiseGLSL=`
float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}`;

export async function loadMaterials(renderer){
 const loader=new T.TextureLoader();
 async function tex(path,color=true,repeat=1){const t=await loader.loadAsync(path);if(color)t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
 const [rock,rockNormal,bark,barkNormal,moss,background,left,right,body,sageLeft,sageRight,sageBody]=await Promise.all([
  tex('assets/rock_boulder_dry_diff.jpg'),tex('assets/rock_boulder_dry_nor_gl.jpg',false),
  tex('assets/rough_wood_diff.jpg'),tex('assets/rough_wood_nor_gl.jpg',false),
  tex('assets/moss-color.png'),tex('assets/distant-forest.png'),
  tex('assets/moth-cream-wing-left.png'),tex('assets/moth-cream-wing-right.png'),tex('assets/moth-cream-body.png'),
  tex('assets/moth-sage-wing-left.png'),tex('assets/moth-sage-wing-right.png'),tex('assets/moth-sage-body.png')]);
 background.wrapS=background.wrapT=T.ClampToEdgeWrapping;
 const stone=new T.MeshPhysicalMaterial({map:rock,normalMap:rockNormal,normalScale:new T.Vector2(.7,.7),color:'#737d79',roughness:.78,clearcoat:.06,clearcoatRoughness:.65,vertexColors:true});
 const wood=new T.MeshStandardMaterial({map:bark,normalMap:barkNormal,normalScale:new T.Vector2(.85,.85),color:'#7b725d',roughness:.58,vertexColors:true});
 // Moss grows according to world-space orientation and colony noise, never UV seams.
 for(const [material,scale] of [[stone,1.2],[wood,2.2]]){
  material.onBeforeCompile=s=>{
   s.uniforms.mossMap={value:moss};s.uniforms.mossScale={value:scale};
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 gardenP; varying vec3 gardenN;').replace('#include <begin_vertex>','#include <begin_vertex>\ngardenP=(modelMatrix*vec4(position,1.)).xyz;gardenN=normalize(mat3(modelMatrix)*normal);');
   s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 gardenP;varying vec3 gardenN;uniform sampler2D mossMap;uniform float mossScale;${noiseGLSL}\n${stochasticGLSL}\nfloat mossAmount;`)
    .replace('#include <color_fragment>',`#include <color_fragment>
     float colony=noise3(gardenP*1.9)+.3*noise3(gardenP*7.);
     mossAmount=smoothstep(.36,.74,colony+gardenN.y*.36-.18);
     vec3 mossColor=mossSample((gardenP.xy*.75+gardenP.xz*.25)*mossScale);
     diffuseColor.rgb=mix(diffuseColor.rgb,mossColor*.72,mossAmount);`)
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.97,mossAmount);');
  };material.customProgramCacheKey=()=>`garden-moss-${scale}`;
 }
 const ground=new T.MeshStandardMaterial({color:'#73774a',roughness:.98});
 ground.onBeforeCompile=s=>{
  s.uniforms.mossMap={value:moss};
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 gardenP;').replace('#include <begin_vertex>','#include <begin_vertex>\ngardenP=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 gardenP;uniform sampler2D mossMap;${noiseGLSL}\n${stochasticGLSL}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    vec3 mossColor=mossSample(gardenP.xy*1.45);
    float colony=noise3(gardenP*2.1+vec3(9,0,0));
    diffuseColor.rgb=mix(vec3(.024,.022,.012),mossColor*.52,smoothstep(.21,.64,colony));`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float relief=dot(mossSample(gardenP.xy*1.45),vec3(.22,.7,.08));
    normal=normalize(normal+vec3(-dFdx(relief),-dFdy(relief),0.)*.5);`);
 };
 ground.customProgramCacheKey=()=> 'moss-bank-stochastic-v1';
 const leaves=leafMaterial();
 return {stone,wood,ground,leaves,moss,background,left,right,body,sage:{left:sageLeft,right:sageRight,body:sageBody}};
}

export function leafMaterial(){
 const material=new T.MeshPhysicalMaterial({color:'#acb392',vertexColors:true,side:T.DoubleSide,roughness:.29,clearcoat:.7,clearcoatRoughness:.15,specularIntensity:.9});
 material.onBeforeCompile=s=>{
  s.uniforms.gardenTime=wind;
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
   uniform float gardenTime;attribute vec3 anchor;attribute vec4 bend;attribute vec4 along;varying vec2 leafUv;varying vec3 leafP;`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    leafUv=uv;leafP=position;
    float freeLength=min(along.w*along.w,5.);
    transformed+=bend.xyz*sin(gardenTime*.52+anchor.x*.8+anchor.z*.45)*bend.w*freeLength*.018;`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec2 leafUv;varying vec3 leafP;${noiseGLSL}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    float midrib=1.-smoothstep(.004,.023,abs(leafUv.x-.5));
    float veins=pow(.5+.5*cos((leafUv.y-abs(leafUv.x-.5)*.32)*155.),25.);
    float mottling=noise3(leafP*26.);
    diffuseColor.rgb*=.83+.18*mottling+.16*veins;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.38,midrib*.6);`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float ribs=sin((leafUv.y-abs(leafUv.x-.5)*.32)*155.);
    normal=normalize(normal+vec3(dFdx(ribs),dFdy(ribs),0.)*.17);`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    float dew=noise3(leafP*95.);
    roughnessFactor=mix(.22,.4,smoothstep(.4,.7,dew));`);
 };material.customProgramCacheKey=()=> 'garden-leaf-wet-v2';return material;
}
