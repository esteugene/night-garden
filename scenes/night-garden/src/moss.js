import * as T from 'three';
import {noise,randomGenerator} from './math.js';

// Area-weighted sampling avoids vertex/pole bands and depends on surface area, not tessellation.
export function surfaceSampler(mesh,random){
 mesh.updateMatrixWorld(true);const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,index=g.index;
 const normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld),entries=[];let total=0;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),cross=new T.Vector3();
 for(let i=0;i<(index?.count??p.count);i+=3){
  const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
  a.fromBufferAttribute(p,ids[0]).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,ids[1]).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,ids[2]).applyMatrix4(mesh.matrixWorld);
  const area=cross.subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).length()*.5;
  if(area>1e-10){total+=area;entries.push({ids,total})}
 }
 return ()=>{
  const target=random()*total;let lo=0,hi=entries.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(entries[mid].total<target)lo=mid+1;else hi=mid}
  const {ids}=entries[lo],s=Math.sqrt(random()),weights=[1-s,s*(1-random()),0];weights[2]=1-weights[0]-weights[1];
  const position=new T.Vector3(),normal=new T.Vector3();
  ids.forEach((id,j)=>{position.addScaledVector(a.fromBufferAttribute(p,id),weights[j]);normal.addScaledVector(b.fromBufferAttribute(n,id),weights[j])});
  return {point:position.applyMatrix4(mesh.matrixWorld),normal:normal.applyMatrix3(normalMatrix).normalize()};
 };
}
// A connected carpet with broad colonies, not isolated random bald spots.
export function mossCoverage(p,n){
 const colony=noise(p.x*1.8+9,p.y*1.8,p.z*1.8);
 const exposure=T.MathUtils.smoothstep(n.y*.7+n.z*.3,-.32,.44);
 return exposure*T.MathUtils.smoothstep(colony+n.y*.12,.16,.49);
}
function mossHeight(p){return .035+.16*noise(p.x*5+4,p.y*5,p.z*5)**2.2;}
const fiberGLSL=`
float mh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float mn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(mh(i),mh(i+vec3(1,0,0)),f.x),mix(mh(i+vec3(0,1,0)),mh(i+vec3(1,1,0)),f.x),f.y),mix(mix(mh(i+vec3(0,0,1)),mh(i+vec3(1,0,1)),f.x),mix(mh(i+vec3(0,1,1)),mh(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
function addMossCarpet(scene,surfaces){
 const positions=[],normals=[],roots=[],layers=[],coverage=[],indices=[],normalMatrix=new T.Matrix3();
 // Eight actual surface layers: dense bottom, gradually thinning fibers above it.
 for(const {mesh,bias=0} of surfaces){
  mesh.updateMatrixWorld(true);const source=mesh.geometry,p=source.attributes.position,n=source.attributes.normal;
  normalMatrix.getNormalMatrix(mesh.matrixWorld);
  const points=[],ns=[],covers=[];
  for(let i=0;i<p.count;i++){
   const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld),normal=new T.Vector3().fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
   points.push(v);ns.push(normal);covers.push(Math.min(1,mossCoverage(v,normal)+bias));
  }
  for(let layer=0;layer<8;layer++){
   const h=layer/7,offset=positions.length/3;
   for(let i=0;i<p.count;i++){
    const v=points[i],c=covers[i],lift=.003+mossHeight(v)*c*(.32+.68*h);
    positions.push(v.x+ns[i].x*lift,v.y+ns[i].y*lift,v.z+ns[i].z*lift);normals.push(...ns[i]);roots.push(...v);layers.push(h);coverage.push(c);
   }
   for(let j=0;j<(source.index?.count??p.count);j+=3){
    const ids=[0,1,2].map(k=>source.index?source.index.getX(j+k):j+k);
    if(Math.max(...ids.map(i=>covers[i]))>.18)indices.push(...ids.map(i=>offset+i));
   }
  }
 }
 const g=new T.BufferGeometry();
 for(const [key,array,size] of [['position',positions,3],['normal',normals,3],['mossRoot',roots,3],['mossLayer',layers,1],['mossCover',coverage,1]])g.setAttribute(key,new T.Float32BufferAttribute(array,size));
 g.setIndex(indices);
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:1});
 material.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 mossRoot;attribute float mossLayer;attribute float mossCover;varying vec3 rootP;varying float layerH;varying float cover;').replace('#include <begin_vertex>','#include <begin_vertex>\nrootP=mossRoot;layerH=mossLayer;cover=mossCover;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 rootP;varying float layerH;varying float cover;'+fiberGLSL)
  .replace('#include <color_fragment>',`#include <color_fragment>
   float fiber=mn(rootP*155.);
   float edge=mn(rootP*37.);
   if(cover<.22+edge*.13 || fiber<layerH*.79)discard;
   float colonyTint=mn(rootP*4.2);
   vec3 mossColor=mix(vec3(.012,.022,.005),vec3(.095,.125,.023),colonyTint);
   diffuseColor.rgb=mossColor*mix(.32,1.12,pow(layerH,.7))*(.8+.3*fiber);`)
  .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   totalEmissiveRadiance+=diffuseColor.rgb*.06;`);
 };
 material.customProgramCacheKey=()=> 'moss-carpet-shell-v1';
 const carpet=new T.Mesh(g,material);carpet.name='continuous-moss-carpet';carpet.receiveShadow=true;carpet.castShadow=false;scene.add(carpet);
}
function tuftGeometry(seed){
 const rnd=randomGenerator(seed),positions=[],indices=[];
 // Thin tapered pinnae along multiple bent stems; no repeated radial star shape.
 const stems=2+Math.floor(rnd()*2);
 for(let f=0;f<stems;f++){
  const a=rnd()*6.28,height=.025+rnd()*.055,lean=.015+rnd()*.035;
  for(let j=1;j<6;j++){
   const t=j/6,y=t*height,x=Math.cos(a)*lean*t*t,z=Math.sin(a)*lean*t*t;
   const length=(.003+.013*Math.sin(t*Math.PI))*(.75+rnd()*.4);
   for(const side of [-1,1]){
    const dx=Math.cos(a+side*1.1)*length,dz=Math.sin(a+side*1.1)*length,k=positions.length/3,w=.0025*(1-t*.6);
    positions.push(x,y,z,x+dx*.55-dz*w/length,y+.001,z+dz*.55+dx*w/length,x+dx,y+.006,z+dz,x+dx*.55+dz*w/length,y+.001,z+dz*.55-dx*w/length);
    indices.push(k,k+1,k+2,k,k+2,k+3);
   }
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function growMoss(scene,surfaces,random){
 addMossCarpet(scene,surfaces);
 const samples=[];
 for(const {mesh,count,bias=0} of surfaces){
  const sample=surfaceSampler(mesh,random);
  for(let i=0;i<count;i++){const s=sample();if(random()<Math.min(1,mossCoverage(s.point,s.normal)+bias))samples.push(s)}
 }
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.98,side:T.DoubleSide});
 const dummy=new T.Object3D(),up=new T.Vector3(0,1,0),variants=6;
 for(let v=0;v<variants;v++){
  const group=samples.filter((_,i)=>i%variants===v),mesh=new T.InstancedMesh(tuftGeometry(211+v*47),material,group.length);
  group.forEach(({point,normal},i)=>{
   dummy.position.copy(point).addScaledVector(normal,.008+mossHeight(point)*mossCoverage(point,normal)*.8);dummy.quaternion.setFromUnitVectors(up,normal);dummy.rotateY(random()*6.28);
   const size=.9+random()*.8;dummy.scale.set(size,size*(.7+random()*.5),size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   const patch=noise(point.x*1.3,point.y*1.3,point.z*1.3);mesh.setColorAt(i,new T.Color().setRGB(.018+patch*.075,.033+patch*.10,.007+patch*.017));
  });mesh.receiveShadow=true;scene.add(mesh);
 }
 return samples.length;
}
