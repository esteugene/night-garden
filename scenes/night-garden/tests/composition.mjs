import assert from 'node:assert/strict';
import * as T from 'three';
import {point,fitCamera,BRANCH,LEAVES,ROCKS,MUSHROOMS,bankTop} from '../src/composition.js';
import {coverTransform} from '../src/stage.js';
import {surfaceSampler} from '../src/moss.js';
import {randomGenerator} from '../src/math.js';
const camera=new T.OrthographicCamera(-1,1,1,-1,.1,80);camera.position.set(0,0,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();
for(const [width,height] of [[1586,992],[1920,1080],[1440,900],[900,1200]]){
 fitCamera(camera,width,height);const cover=coverTransform(width,height);
 const markers=[...BRANCH,...LEAVES.flatMap(l=>[l.base,l.tip]),...ROCKS.flatMap(({box:b})=>[[b[0],b[1]],[b[2],b[3]]]),...MUSHROOMS];
 for(const [x,y] of markers){const projected=point(x,y,2).project(camera),expected=cover.toView(x,y);assert(Math.abs((projected.x+1)*width/2-expected.x)<1e-8);assert(Math.abs((1-projected.y)*height/2-expected.y)<1e-8)}
}
assert.equal(bankTop(0),615);assert.equal(bankTop(1586),807);assert.equal(bankTop(1700),807);
// A triangle with 4x the area receives 4x the samples, independent of vertex count.
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,10,0,0,12,0,0,10,2,0],3));g.computeVertexNormals();
const sample=surfaceSampler(new T.Mesh(g),randomGenerator(271)),counts=[0,0];for(let i=0;i<10000;i++)counts[sample().point.x>5?1:0]++;
assert(counts[1]/counts[0]>3.6&&counts[1]/counts[0]<4.4);
console.log('PASS: exact reference projection at 4 viewport ratios, bank edges, area-weighted moss sampling');
