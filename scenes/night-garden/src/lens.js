import * as T from 'three';
// Two quarter-resolution blur passes. No temporal accumulation / long light trails.
export function createLens(renderer){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:4});
 target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
 const a=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}),b=a.clone();
 // Half-resolution copy of the finished frame; the pool samples it next frame, mirrored.
 const history=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{source:{value:null},direction:{value:new T.Vector2()},extract:{value:1}},vertexShader,fragmentShader:`
  varying vec2 vUv;uniform sampler2D source;uniform vec2 direction;uniform float extract;
  vec3 tap(vec2 uv){vec3 c=texture2D(source,uv).rgb;float l=max(c.r,max(c.g,c.b));return c*mix(1.,smoothstep(.65,1.7,l),extract);}
  void main(){vec3 c=tap(vUv)*.227027;c+=(tap(vUv+direction*1.384615)+tap(vUv-direction*1.384615))*.316216;c+=(tap(vUv+direction*3.230769)+tap(vUv-direction*3.230769))*.070270;gl_FragColor=vec4(c,1.);}`});
 const copy=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{source:{value:target.texture}},vertexShader,fragmentShader:'varying vec2 vUv;uniform sampler2D source;void main(){gl_FragColor=texture2D(source,vUv);}'});
 const final=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:target.texture},bloom:{value:b.texture},depthMap:{value:target.depthTexture},pixel:{value:new T.Vector2()}},vertexShader,fragmentShader:`
  varying vec2 vUv;uniform sampler2D source;uniform sampler2D bloom;uniform sampler2D depthMap;uniform vec2 pixel;
  void main(){float depth=texture2D(depthMap,vUv).r;float radius=(1.-smoothstep(.143,.172,depth))*7.+smoothstep(.28,.4,depth)*1.6;vec3 c=texture2D(source,vUv).rgb;float weight=1.;
   for(int i=0;i<16;i++){float angle=float(i)*2.399963;vec2 offset=vec2(cos(angle),sin(angle))*sqrt((float(i)+.5)/16.)*radius*pixel;c+=texture2D(source,vUv+offset).rgb;weight+=1.;}c=c/weight+texture2D(bloom,vUv).rgb*.19;
   float edge=pow(length((vUv-.5)*vec2(1.,.78)),2.);c*=1.-edge*.36;
   gl_FragColor=vec4(c,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),final);scene.add(quad);let w=1,h=1;
 return {history,resize(width,height){w=Math.max(1,width);h=Math.max(1,height);final.uniforms.pixel.value.set(1/w,1/h);target.setSize(w,h);a.setSize(Math.max(1,w>>2),Math.max(1,h>>2));b.setSize(Math.max(1,w>>2),Math.max(1,h>>2));history.setSize(Math.max(1,w>>1),Math.max(1,h>>1));},
  render(world,view){
   renderer.setRenderTarget(target);renderer.render(world,view);
   quad.material=copy;renderer.setRenderTarget(history);renderer.render(scene,camera);
   quad.material=blur;blur.uniforms.source.value=target.texture;blur.uniforms.direction.value.set(4/w,0);blur.uniforms.extract.value=1;
   renderer.setRenderTarget(a);renderer.render(scene,camera);
   blur.uniforms.source.value=a.texture;blur.uniforms.direction.value.set(0,4/h);blur.uniforms.extract.value=0;
   renderer.setRenderTarget(b);renderer.render(scene,camera);
   quad.material=final;renderer.setRenderTarget(null);renderer.render(scene,camera);
  }};
}
