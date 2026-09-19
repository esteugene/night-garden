import * as T from 'three';
// A six-sided kasuga-style stone lantern (ishidoro), unlit: a silhouette on the far
// right shore. Built from primitives, so it needs no extra asset or licence.
export function createStoneLantern(stone){
 const material=new T.MeshStandardMaterial({map:stone.map,normalMap:stone.normalMap,normalScale:new T.Vector2(.5,.5),color:'#4f554e',roughness:.94,side:T.DoubleSide});
 const group=new T.Group();group.name='stone-lantern';
 const add=(geometry,y,rotationY=0)=>{const m=new T.Mesh(geometry,material);m.position.y=y;m.rotation.y=rotationY;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const lathe=(profile,segments)=>new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),segments);
 add(new T.CylinderGeometry(.33,.36,.1,6),.05);                                  // base slab
 add(lathe([[.3,0],[.26,.05],[.15,.09],[.12,.16]],18),.1);                        // foot
 add(new T.CylinderGeometry(.095,.11,.42,14),.47);                               // pillar (short)
 add(lathe([[.1,0],[.22,.05],[.3,.11],[.28,.15]],6),.68);                         // platform (chudai)
 const boxY=.83,boxH=.3;                                                       // fire box (hibukuro)
 for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3,post=add(new T.BoxGeometry(.05,boxH,.05),boxY+boxH/2);post.position.set(Math.cos(a)*.19,post.position.y,Math.sin(a)*.19);}
 for(const i of [0,2,3,5]){const a=i*Math.PI/3,wall=add(new T.BoxGeometry(.19,boxH,.03),boxY+boxH/2,Math.PI/2-a);wall.position.set(Math.cos(a)*.165,wall.position.y,Math.sin(a)*.165);} // 1 and 4 stay open: the windows
 add(lathe([[0,0],[.42,0],[.44,.04],[.3,.1],[.16,.2],[.06,.27],[0,.28]],6),boxY+boxH); // roof (kasa)
 add(new T.SphereGeometry(.06,10,8),boxY+boxH+.33);add(new T.ConeGeometry(.04,.1,8),boxY+boxH+.42); // jewel
 group.rotation.y=Math.PI/6; // turns one open window toward the viewer
 return group;
}
