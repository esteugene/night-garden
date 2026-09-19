import * as T from 'three';
import {wind} from './materials.js';
import {surfaceSampler} from './moss.js';
import {randomGenerator} from './math.js';
import {branchGeometry,rockGeometry} from './surfaces.js';
import {mergeGeometries} from '../vendor/three-addons/utils/BufferGeometryUtils.js';

export function addForestDetails(scene,rockSet,rocks,prepared,wood,stone){
 const rnd=randomGenerator(92018);
 scatterPebbles(scene,rocks,stone,rnd);
 // Rest small chips on actual rock surfaces; unequal scales avoid a gravel row.
 for(let i=0;i<23;i++){
  const support=rocks[(i*3+1)%rocks.length],sample=surfaceSampler(support,rnd);let hit;
  for(let j=0;j<40;j++){hit=sample();if(hit.normal.y>.6&&hit.normal.z>-.1)break;}
  const chip=prepared(rockSet.children[i%6],.11+rnd()**2*.35);
  chip.rotation.set(rnd()*.5,rnd()*6.28,rnd()*.4);chip.position.copy(hit.point).addScaledVector(hit.normal,.025);
  chip.traverse(o=>{if(o.isMesh)o.material.color.set('#6d6c50');});chip.name='scattered-rock-chip';scene.add(chip);
 }
 // Slender fallen branches on the right shore, with two broken forks.
 const paths=[
  [[7.5,-1.5,1.5],[6.4,-1.88,1.8],[5.5,-2.25,2.5],[4.4,-2.9,3],[3.65,-3.24,3.4]],
  [[6.1,-2,2.1],[5.96,-1.5,2],[5.53,-1.12,1.8]],
  [[5.15,-2.47,2.7],[4.35,-2.34,2.4],[3.94,-2.12,2.2]],
  [[3.1,-4.25,4.6],[2.55,-4,4.8],[1.7,-3.96,4.8]]
 ];
 paths.forEach((path,i)=>{const branch=new T.Mesh(branchGeometry(path.map(p=>new T.Vector3(p[0],p[1]-(i<3?.32:0),p[2])),i===0?.115:.045,.012,19+i),wood);branch.castShadow=true;branch.receiveShadow=true;branch.name='right-shore-fallen-branch';scene.add(branch);});
 const greens=[new T.Color('#536137'),new T.Color('#78824b'),new T.Color('#343e24')];
 for(let k=0;k<9;k++){
  const sample=surfaceSampler(rocks[k%6],rnd);let hit;
  for(let j=0;j<60;j++){hit=sample();if(hit.normal.y>.4&&hit.normal.z>-.05&&hit.point.y> -4.1)break;}
  const pos=[],colors=[],indices=[];
  for(let b=0;b<64;b++){
   const a=rnd()*Math.PI*2,rad=Math.sqrt(rnd())*.19,x=Math.cos(a)*rad,z=Math.sin(a)*rad,h=.18+rnd()**1.5*.48,w=.016+rnd()*.012,lean=.12+rnd()*.27;
   const start=pos.length/3,c=greens[b%3];
   for(let j=0;j<=5;j++)for(let side=0;side<2;side++){
    const t=j/5,offset=(side-.5)*w*(1-t)*2;
    pos.push(x+Math.cos(a)*offset+Math.cos(a)*lean*t*t,h*t,z+Math.sin(a)*offset+Math.sin(a)*lean*t*t);
    colors.push(c.r*(.42+.58*t),c.g*(.42+.58*t),c.b*(.42+.58*t));
    if(j<5&&side===0){const n=start+j*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
   }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  const m=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.94,emissive:'#617139',emissiveIntensity:.07});
  m.onBeforeCompile=s=>{
   s.uniforms.forestTime=wind;
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float forestTime;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     vec3 anchor=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
     float gust=sin(forestTime*.72+anchor.x*.24+anchor.z*.17);
     transformed.x+=(gust*.24+sin(forestTime*1.4+position.z*7.)*.04)*position.y*position.y;
     transformed.z+=cos(forestTime*.57+anchor.x*.24)*.13*position.y*position.y;`);
  };m.customProgramCacheKey=()=> 'long-moss-wind-v1';
  const tuft=new T.Mesh(g,m);tuft.name='long-moss-tuft';tuft.position.copy(hit.point).addScaledVector(hit.normal,-.12);tuft.receiveShadow=true;scene.add(tuft);
 }
}

// Small stones in loose clusters on the rock tops and along the lower lip. Low-detail
// procedural pebbles merged into one mesh: about a hundred of them cost one draw and
// roughly twenty thousand triangles, where the licensed rock models would cost millions.
function scatterPebbles(scene,rocks,stone,rnd){
 const bases=[0,1,2,3,4,5].map(i=>rockGeometry(3.7+i*1.31,12));
 const pieces=[],up=new T.Vector3(0,1,0),quaternion=new T.Quaternion(),matrix=new T.Matrix4(),scale=new T.Vector3();
 function place(hit,size){
  const g=bases[Math.floor(rnd()*bases.length)].clone();
  quaternion.setFromUnitVectors(up,hit.normal).multiply(new T.Quaternion().setFromAxisAngle(up,rnd()*6.28));
  scale.set(size*(.8+rnd()*.5),size*(.5+rnd()*.3),size*(.8+rnd()*.5));
  matrix.compose(new T.Vector3().copy(hit.point).addScaledVector(hit.normal,size*.28),quaternion,scale);
  g.applyMatrix4(matrix);pieces.push(g);
 }
 const supports=rocks.filter((_,i)=>i!==0&&i!==5); // not the far-left and far-right boulders, where nothing is seen
 for(let c=0;c<16;c++){
  const support=supports[(c*5+2)%supports.length],sample=surfaceSampler(support,rnd);let centre;
  for(let j=0;j<80;j++){centre=sample();if(centre.normal.y>.55&&centre.normal.z>-.1&&centre.point.y>-4.85)break;}
  const count=3+Math.floor(rnd()*6),radius=.14+rnd()*.24;
  for(let k=0;k<count;k++){
   let hit;for(let j=0;j<400;j++){hit=sample();if(hit.point.distanceTo(centre.point)<radius&&hit.normal.y>.45)break;}
   place(hit,.03+rnd()**2*.13);
  }
 }
 for(let i=0;i<22;i++){
  const support=supports[(i*7+3)%supports.length],sample=surfaceSampler(support,rnd);let hit;
  for(let j=0;j<80;j++){hit=sample();if(hit.normal.y>.5&&hit.normal.z>-.1&&hit.point.y>-4.85)break;}
  place(hit,.04+rnd()**2*.16);
 }
 const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
 const mesh=new T.Mesh(merged,stone);mesh.receiveShadow=true;mesh.name='pebble-field';scene.add(mesh);
}
