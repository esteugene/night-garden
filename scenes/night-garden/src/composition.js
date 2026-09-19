import * as T from 'three';
// All landmarks measured on the approved 1586 x 992 image, top-left origin.
// Depth changes light/occlusion without changing the registered screen composition.
export const SOURCE={width:1586,height:992};
export const point=(x,y,z=0)=>new T.Vector3((x-793)/100,(496-y)/100,z);
export function fitCamera(camera,width,height){
 const scale=Math.max(width/SOURCE.width,height/SOURCE.height);
 const w=width/scale/100,h=height/scale/100;
 camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();
}
export const BRANCH=[[115,489,.3],[267,557,.5],[427,624,.6],[601,698,.4],[738,747,.3]];
// Leaf petiole attachment -> apex, blade width in source pixels; no random colonies.
export const LEAVES=[
 {base:[42,333],tip:[114,523],width:146,z:1.7},
 {base:[6,472],tip:[107,704],width:120,z:2.1},
 {base:[92,557],tip:[142,708],width:104,z:1.8},
 {base:[9,224],tip:[102,167],width:76,z:.5},
 {base:[13,164],tip:[136,200],width:73,z:.4},
 {base:[18,355],tip:[132,287],width:83,z:1},
 {base:[1528,574],tip:[1420,770],width:159,z:2.2},
 {base:[1576,610],tip:[1502,778],width:116,z:2.5},
 {base:[1483,526],tip:[1361,604],width:106,z:1.2},
 {base:[1535,444],tip:[1434,501],width:94,z:.8},
 {base:[1573,425],tip:[1537,524],width:78,z:1.1},
 {base:[1523,362],tip:[1418,389],width:71,z:.1},
];
// Rock screen bounding boxes, depth thickness. These are placement targets, not images.
export const ROCKS=[
 {box:[68,734,380,992],z:2.1,depth:1.1},
 {box:[446,740,822,915],z:1.7,depth:1},
 {box:[995,789,1247,946],z:2.3,depth:.8},
 {box:[1248,710,1518,849],z:1.2,depth:.9},
 {box:[866,895,1188,1062],z:3.6,depth:.9},
 {box:[1324,873,1630,1032],z:3.8,depth:1},
];
export const FERNS=[
 {root:[121,566],tips:[[113,230],[226,197],[359,288],[486,356]],size:1},
 {root:[214,636],tips:[[386,454],[532,552],[593,601]],size:.8},
 {root:[588,783],tips:[[681,615],[730,601],[828,675]],size:.55},
 {root:[1372,780],tips:[[1267,443],[1190,540],[1148,643]],size:.8},
 {root:[1516,526],tips:[[1564,301],[1648,253]],size:.65},
];
export const MUSHROOMS=[
 [340,728,52,19],[310,723,28,13],[325,726,16,8],
 [1229,869,33,15],[1275,870,29,14],[1250,883,22,10],
 [119,909,39,17],[431,861,19,8],
];
export const BANK=[[0,615],[170,649],[340,693],[535,742],[735,796],[900,862],[1080,826],[1260,814],[1420,797],[1586,807]];
export function bankTop(x){
 const found=BANK.findIndex(p=>p[0]>=x);
 const i=found<0?BANK.length-2:Math.max(0,found-1);
 const a=BANK[i],b=BANK[i+1],t=T.MathUtils.clamp((x-a[0])/(b[0]-a[0]),0,1);
 return T.MathUtils.lerp(a[1],b[1],t);
}
