import * as T from 'three';
import {wind} from './materials.js';
// The pool behind the middle rocks. The stage camera is orthographic and looks straight
// along -z, so a truly horizontal surface would be edge-on and invisible. The surface is
// therefore a screen-facing band that reads as horizontal through the cues a viewer
// actually uses: the scene mirrored across the far waterline, ripples that flatten and
// crowd together toward that line, and a reflection that gives way to dark water toward
// the viewer. The reflection is the previous frame's HDR image (lens.history), so no
// second scene pass is needed.
export const WATERLINE=-2.05; // world y of the far shore, source y 701 on the reference
const NEAR=-5.4,DEPTH=-12,LEFT=-4.6,RIGHT=6.6;
export function createForestWater(scene){
 const geometry=new T.PlaneGeometry(RIGHT-LEFT,WATERLINE-NEAR,1,1);
 geometry.translate((LEFT+RIGHT)/2,(WATERLINE+NEAR)/2,0);
 const uniforms={time:wind,reflection:{value:null},waterline:{value:WATERLINE},near:{value:NEAR},edges:{value:new T.Vector2(LEFT,RIGHT)}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:true,
 vertexShader:`uniform float waterline;varying vec3 worldP;varying vec4 mirrorClip;
 void main(){worldP=(modelMatrix*vec4(position,1.)).xyz;
  // Mirror across the horizontal plane y = waterline; in this orthographic front view that
  // is exactly a vertical flip of the image about the waterline.
  mirrorClip=projectionMatrix*viewMatrix*vec4(worldP.x,2.*waterline-worldP.y,worldP.z,1.);
  gl_Position=projectionMatrix*viewMatrix*vec4(worldP,1.);}`,
 fragmentShader:`uniform float time;uniform sampler2D reflection;uniform float waterline;uniform float near;uniform vec2 edges;
 varying vec3 worldP;varying vec4 mirrorClip;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){
  float v=clamp((waterline-worldP.y)/(waterline-near),0.,1.); // 0 at the far shore, 1 nearest
  // Rows of the band stand for ground depth: far rows are compressed, near rows stretched.
  float gz=1./(v+.08);
  vec2 g=vec2(worldP.x*gz*.34,gz);
  float wave=sin(g.x*5.4+g.y*8.4-time*.25)*.55+sin(g.x*-9.2+g.y*13.2+time*.19)*.3+sin(g.x*17.+g.y*25.2-time*.37)*.15;
  float wave2=sin(g.x*10.-g.y*7.+time*.17)*.6+sin(g.x*-21.4+g.y*17.2-time*.3)*.4;
  float calm=smoothstep(0.,.25,v); // no shimmer right at the horizon, where waves are sub-pixel
  vec2 uv=mirrorClip.xy/mirrorClip.w*.5+.5;
  vec2 shift=vec2(wave2*.0007,wave*(.001+.0055*v))*calm;
  float smear=(.003+.009*v)*calm;
  vec3 mirrored=(texture2D(reflection,uv+shift).rgb+texture2D(reflection,uv+shift+vec2(0.,smear)).rgb+texture2D(reflection,uv+shift-vec2(0.,smear*.6)).rgb)/3.;
  vec3 deep=vec3(.010,.017,.014);
  float grazing=mix(.88,.3,smoothstep(0.,1.,v)); // sky and bank reflect strongly at the far shore, less nearby
  vec3 c=mix(deep,mirrored*.82,grazing);
  // Sparse moonlit glitter, gathered toward the far shore of the pool.
  // Two crossing band patterns multiply into isolated sparkles that drift with the waves.
  float glint=pow(.5+.5*sin(g.x*7.+g.y*11.+wave*2.4-time*.4),30.)*pow(.5+.5*sin(g.x*-9.+g.y*8.+wave2*2.+time*.32),30.)*pow(1.-v,2.4)*exp(-pow((worldP.x-3.2)/2.8,2.))*calm;
  c+=vec3(.11,.12,.1)*glint;
  // A faint broken sheen marks the waterline itself.
  float shore=1.-smoothstep(0.,.05,v);
  c+=vec3(.018,.026,.022)*shore*(.6+.4*sin(worldP.x*9.+time*.1));
  float alpha=smoothstep(0.,.045,waterline-worldP.y)*smoothstep(0.,.35,worldP.x-edges.x)*smoothstep(0.,.35,edges.y-worldP.x);
  gl_FragColor=vec4(c,alpha);
 }`});
 const mesh=new T.Mesh(geometry,material);mesh.position.z=DEPTH;mesh.name='mirrored-pool';mesh.renderOrder=-1;scene.add(mesh);
 return {mesh,waterline:WATERLINE,
  // The lens hands over its half-resolution copy of the previous frame.
  setReflection(target){uniforms.reflection.value=target.texture;},
  dispose(){geometry.dispose();material.dispose();}};
}
