import assert from 'node:assert/strict';
import * as T from 'three';
import {buildGarden} from '../src/garden.js';
import {leafMaterial} from '../src/materials.js';
import {createMoths} from '../src/moths.js';
const scene=new T.Scene(),material=new T.MeshStandardMaterial();
const materials={ground:material,stone:material,wood:material,leaves:leafMaterial(),left:new T.Texture(),right:new T.Texture(),body:new T.Texture()};
const world=buildGarden(scene,materials),animals=createMoths(scene,materials);
scene.updateMatrixWorld(true);let triangles=0,meshes=0;
scene.traverse(object=>{
 if(!object.geometry)return;meshes++;
 const geometry=object.geometry;
 for(const [name,attribute] of Object.entries(geometry.attributes)){
  for(const value of attribute.array)assert(Number.isFinite(value),`${object.type} ${name} contains non-finite value`);
 }
 if(geometry.index)for(const index of geometry.index.array)assert(index<geometry.attributes.position.count,'index outside vertices');
 const count=object.isInstancedMesh?object.count:1;triangles+=(geometry.index?.count??geometry.attributes.position.count)/3*count;
 geometry.computeBoundingSphere();assert(Number.isFinite(geometry.boundingSphere.radius));
});
for(let i=0;i<1800;i++)animals.update(1/30,i/30,{position:[-4,3,1],speed:i<900?.3:5});
for(const {group} of animals.moths)for(const value of [...group.position,...group.rotation.toArray().slice(0,3)])assert(Number.isFinite(value));
assert(world.geometry.mossInstances>5000);
assert(world.geometry.foliageVertices>10000);
assert(triangles<1800000,`Triangle budget exceeded: ${triangles}`);
assert(meshes<160,`Object budget exceeded: ${meshes}`);
console.log(JSON.stringify({status:'pass',meshes,triangles:Math.round(triangles),...world.geometry},null,2));
