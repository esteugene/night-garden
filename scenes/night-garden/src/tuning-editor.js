import * as T from 'three';
import {registry,tuningData,STORAGE_KEY,kelvinToColor,hasMoss,mossSettings,applyMoss,eraseMossAt,moss,isHidden,setHidden} from './tuning.js';
// Placement editor for the preview (?edit=1). Click a rock, fern, mushroom or a light
// marker to select it; drag to move it across the picture, shift-drag to move it in
// depth, alt-drag to turn it. The panel on the right edits the same values as sliders,
// plus colour, temperature and intensity of every light and the render settings.
// Everything is written to localStorage as you go and shown as JSON; save that JSON as
// tuning.json beside the scene to make it permanent (the wallpaper ships that file).
// Moss fibres and moss patches are baked onto rock surfaces at build time, so after
// moving a rock the moss follows only after a reload. Moss itself is edited live: per
// rock (density of fibres, undercoat, patches) in the object section, and with the
// eraser (section Moss), which stores world-space spheres that hide everything inside.
const round=v=>+v.toFixed(3);
const hex=c=>'#'+c.getHexString();
export function createTuningEditor({scene,camera,renderer,canvas,loop,world}){
 const data=tuningData();
 const style=document.createElement('style');style.textContent=`
  #tuning{position:fixed;top:12px;right:12px;bottom:12px;width:330px;overflow:auto;z-index:20;background:#07120df0;color:#dbe4d2;font:12px/1.35 system-ui;border:1px solid #ffffff1c;border-radius:12px;padding:12px 14px;box-sizing:border-box}
  #tuning h3{margin:12px 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#c5b88b}
  #tuning .row{display:grid;grid-template-columns:82px 1fr 52px;gap:8px;align-items:center;margin:2px 0}
  #tuning .row label{color:#aab8a4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #tuning .row output{text-align:right;font-variant-numeric:tabular-nums;color:#e8efdf}
  #tuning input[type=range]{width:100%;accent-color:#c5b88b;margin:0}
  #tuning input[type=color]{width:100%;height:22px;border:0;background:none;padding:0}
  #tuning select{width:100%;background:#0f1d18;color:#e8efdf;border:1px solid #ffffff22;border-radius:6px;padding:4px}
  #tuning button{background:#16261f;color:#e8efdf;border:1px solid #ffffff22;border-radius:8px;padding:5px 9px;margin:3px 4px 3px 0;cursor:pointer;font:inherit}
  #tuning button:hover{background:#1f3329}
  #tuning textarea{width:100%;height:150px;background:#0a1511;color:#b9c7b1;border:1px solid #ffffff18;border-radius:6px;font:10px/1.3 ui-monospace,monospace;box-sizing:border-box}
  #tuning .hint{color:#8f9d8a;margin:4px 0}
  #tuning .name{color:#f0d9a2;font-weight:600}
  #tuning button.on{background:#c5b88b;color:#14201a;border-color:#c5b88b}
  #tuning .row input[type=checkbox]{justify-self:start;accent-color:#c5b88b}`;
 document.head.appendChild(style);
 const panel=document.createElement('aside');panel.id='tuning';document.body.appendChild(panel);
 const el=(tag,props={},...children)=>{const e=document.createElement(tag);Object.assign(e,props);e.append(...children);return e;};
 const stop=e=>e.stopPropagation();
 for(const type of ['pointerdown','pointermove','pointerup','keydown','wheel'])panel.addEventListener(type,stop);

 // ----- state
 let selected=null; // {kind:'object'|'light', id, object, light, part:'position'|'target'}
 let saveTimer=0;
 const persist=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch{}json.value=JSON.stringify(data,null,1);},150);};
 const redraw=()=>{renderer.shadowMap.needsUpdate=true;loop?.invalidate();};

 // ----- serialisation of the live scene into the data record
 function recordObject(id,o){
  const orig=o.userData.original;
  const entry={position:o.position.toArray().map(round),rotation:[round(o.rotation.x),round(o.rotation.y),round(o.rotation.z)],scale:round(o.scale.x)};
  const same=orig&&entry.position.every((v,i)=>v===round(orig.position.getComponent(i)))&&entry.rotation[0]===round(orig.rotation.x)&&entry.rotation[1]===round(orig.rotation.y)&&entry.rotation[2]===round(orig.rotation.z)&&entry.scale===round(orig.scale);
  const hidden=isHidden(id);
  if(same&&!hidden)delete data.objects[id];else data.objects[id]=hidden?{...entry,hidden:true}:entry;
  if(id==='lantern'&&world?.landmarks?.lantern)world.landmarks.lantern.copy(o.position).add(new T.Vector3(0,.98*o.scale.y,0));
  o.updateMatrixWorld(true);persist();redraw();
 }
 function recordLight(id,l){
  const entry={color:hex(l.color),intensity:round(l.userData.baseIntensity??l.intensity)};
  if(l.groundColor)entry.groundColor=hex(l.groundColor);
  if(!l.isHemisphereLight)entry.position=l.position.toArray().map(round);
  if(l.isDirectionalLight||l.isSpotLight)entry.target=l.target.position.toArray().map(round);
  if(l.isSpotLight){entry.distance=round(l.distance);entry.angle=round(l.angle);entry.penumbra=round(l.penumbra);entry.decay=round(l.decay);}
  if(l.isPointLight){entry.distance=round(l.distance);entry.decay=round(l.decay);}
  data.lights[id]=entry;l.target?.updateMatrixWorld(true);persist();redraw();
 }
 function recordRender(){data.render={exposure:round(renderer.toneMappingExposure),fogNear:round(scene.fog.near),fogFar:round(scene.fog.far),fogColor:hex(scene.fog.color),backgroundIntensity:round(scene.backgroundIntensity)};persist();redraw();}

 // ----- generic controls
 function slider(label,min,max,step,get,set){
  const input=el('input',{type:'range',min,max,step}),out=el('output');
  const row=el('div',{className:'row'},el('label',{textContent:label,title:label}),input,out);
  row.refresh=()=>{const v=get();input.value=v;out.textContent=(+v).toFixed(step<.01?3:2);};
  input.oninput=()=>{set(+input.value);out.textContent=(+input.value).toFixed(step<.01?3:2);};
  row.refresh();return row;
 }
 function colorRow(label,get,set){
  const input=el('input',{type:'color'}),out=el('output');
  const row=el('div',{className:'row'},el('label',{textContent:label}),input,out);
  row.refresh=()=>{input.value=get();out.textContent=get();};
  input.oninput=()=>{set(input.value);out.textContent=input.value;};
  row.refresh();return row;
 }
 function toggleRow(label,get,set){
  const input=el('input',{type:'checkbox'}),out=el('output');
  const row=el('div',{className:'row'},el('label',{textContent:label}),input,out);
  row.refresh=()=>{input.checked=get();out.textContent=get()?'yes':'no';};
  input.onchange=()=>{set(input.checked);out.textContent=input.checked?'yes':'no';};
  row.refresh();return row;
 }
 function recordMoss(id,patch){
  const entry={...mossSettings(id),...patch};
  if(entry.fibers===1&&entry.coat===1&&entry.patches===true)delete data.moss.objects[id];else data.moss.objects[id]=entry;
  applyMoss();persist();redraw();
 }
 function section(title){const h=el('h3',{textContent:title});panel.append(h);return h;}

 // ----- object section
 section('Object');
 const objectSelect=el('select');
 const objectIds=[...registry.objects.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 objectSelect.append(el('option',{value:'',textContent:'— click the scene or pick one —'}),...objectIds.map(id=>el('option',{value:id,textContent:id})));
 objectSelect.onchange=()=>selectObject(objectSelect.value);
 panel.append(objectSelect);
 const objectName=el('div',{className:'hint'});panel.append(objectName);
 const objectBox=el('div');panel.append(objectBox);
 const hiddenList=el('div',{className:'hint'});panel.append(hiddenList);
 function refreshHidden(){
  const ids=objectIds.filter(isHidden);hiddenList.replaceChildren();if(!ids.length)return;
  hiddenList.append('Removed: ');for(const id of ids){const b=el('button',{textContent:`restore ${id}`});b.onclick=()=>{setHidden(id,false);persist();redraw();refreshHidden();if(selected?.id===id)selectObject(id);};hiddenList.append(b);}
 }
 function deleteObject(id,hidden=true){setHidden(id,hidden);persist();redraw();refreshHidden();selectObject(id);}
 panel.append(el('div',{className:'hint',textContent:'Drag with the mouse: shift for depth, alt to turn, arrow keys nudge 5 cm (50 cm with shift), Delete removes from the scene. Moss on rocks is recomputed after a reload.'}));
 refreshHidden();
 const objectRows=[];
 function selectObject(id){
  const o=registry.objects.get(id);selected=o?{kind:'object',id,object:o}:null;objectSelect.value=o?id:'';objectBox.replaceChildren();objectRows.length=0;
  objectName.replaceChildren();if(!o){box.visible=false;return;}
  objectName.append('Selected: ',el('span',{className:'name',textContent:id}),` · ${o.name||o.type}`);
  if(isHidden(id)){const back=el('button',{textContent:'Put back'});back.onclick=()=>deleteObject(id,false);objectBox.append(el('div',{className:'hint',textContent:'Removed from the scene (hidden), together with its moss and light.'}),back);box.visible=false;return;}
  const base=o.scale.x;
  const rec=()=>recordObject(id,o);
  const rows=[
   slider('x',-10,10,.01,()=>o.position.x,v=>{o.position.x=v;rec();}),
   slider('y',-7,7,.01,()=>o.position.y,v=>{o.position.y=v;rec();}),
   slider('z (depth)',-20,14,.01,()=>o.position.z,v=>{o.position.z=v;rec();}),
   slider('turn x',-3.1416,3.1416,.01,()=>o.rotation.x,v=>{o.rotation.x=v;rec();}),
   slider('turn y',-3.1416,3.1416,.01,()=>o.rotation.y,v=>{o.rotation.y=v;rec();}),
   slider('turn z',-3.1416,3.1416,.01,()=>o.rotation.z,v=>{o.rotation.z=v;rec();}),
   slider('size ×',.25,4,.01,()=>o.scale.x/base,v=>{o.scale.setScalar(base*v);rec();}),
  ];
  if(hasMoss(id)){
   const m=()=>mossSettings(id);
   rows.push(el('div',{className:'hint',textContent:'Moss on this object (applies at once):'}),
    slider('moss fibres',0,1,.01,()=>Math.min(1,m().fibers),v=>recordMoss(id,{fibers:v})),
    slider('undercoat',0,1,.01,()=>m().coat,v=>recordMoss(id,{coat:v})),
    toggleRow('moss patches',()=>m().patches,v=>recordMoss(id,{patches:v})));
   const bare=el('button',{textContent:'Strip all moss'});bare.onclick=()=>{recordMoss(id,{fibers:0,coat:0,patches:false});objectRows.forEach(r=>r.refresh?.());};
   const full=el('button',{textContent:'Restore moss'});full.onclick=()=>{recordMoss(id,{fibers:1,coat:1,patches:true});objectRows.forEach(r=>r.refresh?.());};
   rows.push(el('div',{},bare,full));
  }
  objectRows.push(...rows);objectBox.append(...rows);
  const del=el('button',{textContent:'Remove from scene'});del.onclick=()=>deleteObject(id);objectBox.append(del);
  const reset=el('button',{textContent:'Reset to code'});reset.onclick=()=>{const g=o.userData.original;if(!g)return;o.position.copy(g.position);o.rotation.copy(g.rotation);o.scale.setScalar(g.scale);delete data.objects[id];o.updateMatrixWorld(true);persist();redraw();selectObject(id);};
  objectBox.append(reset);
  box.setFromObject(o);box.visible=true;
 }

 // ----- light section
 section('Light');
 const lightSelect=el('select');
 const lightIds=[...registry.lights.keys()].sort();
 lightSelect.append(el('option',{value:'',textContent:'— pick a light or click a marker —'}),...lightIds.map(id=>el('option',{value:id,textContent:id})));
 lightSelect.onchange=()=>selectLight(lightSelect.value);
 panel.append(lightSelect);
 const lightName=el('div',{className:'hint'});panel.append(lightName);
 const lightBox=el('div');panel.append(lightBox);
 panel.append(el('div',{className:'hint',textContent:'Markers: ring = source, square = target. Both can be dragged.'}));
 const lightRows=[];
 let kelvin=4500;
 function selectLight(id,part='position'){
  const l=registry.lights.get(id);selected=l?{kind:'light',id,light:l,part}:null;lightSelect.value=l?id:'';lightBox.replaceChildren();lightRows.length=0;
  lightName.replaceChildren();if(!l){box.visible=false;return;}
  lightName.append('Selected: ',el('span',{className:'name',textContent:id}),` · ${l.type}`);
  const rec=()=>recordLight(id,l);
  const setIntensity=v=>{if(l.userData.baseIntensity!=null)l.userData.baseIntensity=v;l.intensity=v;rec();};
  const max=l.isSpotLight?80:l.isPointLight?4:l.isHemisphereLight?2:5;
  const rows=[];
  if(id==='lantern-glow')rows.push(el('div',{className:'hint',textContent:'The fireflies at the lantern set this light\'s intensity; only colour and radius are edited here.'}));
  else rows.push(slider('intensity',0,max,.01,()=>l.userData.baseIntensity??l.intensity,setIntensity));
  rows.push(colorRow('colour',()=>hex(l.color),v=>{l.color.set(v);rec();lightRows.forEach(r=>r.refresh?.());}));
  rows.push(slider('temperature K',1500,12000,50,()=>kelvin,v=>{kelvin=v;l.color.copy(kelvinToColor(v));rec();lightRows.forEach(r=>r.refresh?.());}));
  if(l.groundColor)rows.push(colorRow('ground colour',()=>hex(l.groundColor),v=>{l.groundColor.set(v);rec();}));
  if(!l.isHemisphereLight){
   rows.push(slider('x',-14,14,.01,()=>l.position.x,v=>{l.position.x=v;rec();}),slider('y',-8,12,.01,()=>l.position.y,v=>{l.position.y=v;rec();}),slider('z',-20,20,.01,()=>l.position.z,v=>{l.position.z=v;rec();}));
  }
  if(l.isDirectionalLight||l.isSpotLight){
   rows.push(slider('target x',-14,14,.01,()=>l.target.position.x,v=>{l.target.position.x=v;rec();}),slider('target y',-8,12,.01,()=>l.target.position.y,v=>{l.target.position.y=v;rec();}),slider('target z',-20,20,.01,()=>l.target.position.z,v=>{l.target.position.z=v;rec();}));
  }
  if(l.isSpotLight)rows.push(slider('distance',0,60,.1,()=>l.distance,v=>{l.distance=v;rec();}),slider('angle',.05,1.5,.01,()=>l.angle,v=>{l.angle=v;rec();}),slider('penumbra',0,1,.01,()=>l.penumbra,v=>{l.penumbra=v;rec();}),slider('decay',0,3,.05,()=>l.decay,v=>{l.decay=v;rec();}));
  if(l.isPointLight)rows.push(slider('distance',0,12,.05,()=>l.distance,v=>{l.distance=v;rec();}),slider('decay',0,3,.05,()=>l.decay,v=>{l.decay=v;rec();}));
  lightRows.push(...rows);lightBox.append(...rows);
  const reset=el('button',{textContent:'Reset to code'});reset.onclick=()=>{const g=l.userData.original;if(!g)return;l.color.set(g.color);if(g.groundColor)l.groundColor.set(g.groundColor);l.intensity=g.intensity;if(l.userData.baseIntensity!=null)l.userData.baseIntensity=g.intensity;l.position.fromArray(g.position);if(g.target)l.target.position.fromArray(g.target);if(g.distance!=null)l.distance=g.distance;if(g.angle!=null)l.angle=g.angle;if(g.penumbra!=null)l.penumbra=g.penumbra;if(g.decay!=null)l.decay=g.decay;delete data.lights[id];l.target?.updateMatrixWorld(true);persist();redraw();selectLight(id);};
  lightBox.append(reset);box.visible=false;
 }

 // ----- moss eraser section
 section('Moss');
 let eraser=false,eraserRadius=.35,strokes=[],lastErase=null;
 const eraserButton=el('button',{textContent:'Eraser: off'});
 const setEraser=v=>{eraser=v;eraserButton.textContent=eraser?'Eraser: on':'Eraser: off';eraserButton.classList.toggle('on',eraser);canvas.style.cursor=eraser?'crosshair':'';eraserCursor.visible=false;if(eraser){box.visible=false;}};
 eraserButton.onclick=()=>setEraser(!eraser);
 const eraserRows=[slider('eraser radius',.05,1.5,.01,()=>eraserRadius,v=>{eraserRadius=v;})];
 const eraserCount=el('div',{className:'hint'});
 const refreshEraser=()=>{eraserCount.textContent=`Erased spots: ${data.moss.erase.length}${data.moss.erase.length>64?' (the undercoat honours the last 64)':''}`;};
 const undo=el('button',{textContent:'Undo stroke'});undo.onclick=()=>{const n=strokes.pop();if(!n)return;data.moss.erase.splice(-n,n);applyMoss();persist();redraw();refreshEraser();};
 const clearErase=el('button',{textContent:'Restore erased moss'});clearErase.onclick=()=>{if(!data.moss.erase.length)return;data.moss.erase=[];strokes=[];applyMoss();persist();redraw();refreshEraser();};
 panel.append(eraserButton,...eraserRows,el('div',{},undo,clearErase),eraserCount,el('div',{className:'hint',textContent:'With the eraser on (hotkey E) drag across a rock or the log: fibres, patches and the green undercoat inside the circle disappear at once. The wallpaper never generates erased fibres.'}));
 refreshEraser();

 // ----- render section
 section('Frame');
 const renderRows=[
  slider('exposure',.3,2,.01,()=>renderer.toneMappingExposure,v=>{renderer.toneMappingExposure=v;recordRender();}),
  slider('background',.2,4,.01,()=>scene.backgroundIntensity,v=>{scene.backgroundIntensity=v;recordRender();}),
  slider('fog near',0,40,.5,()=>scene.fog.near,v=>{scene.fog.near=v;recordRender();}),
  slider('fog far',10,90,.5,()=>scene.fog.far,v=>{scene.fog.far=v;recordRender();}),
  colorRow('fog colour',()=>hex(scene.fog.color),v=>{scene.fog.color.set(v);recordRender();}),
 ];
 panel.append(...renderRows);

 // ----- file section
 section('Save');
 const buttons=el('div');
 const copy=el('button',{textContent:'Copy JSON'});copy.onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(data,null,1));copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy JSON',1200);}catch{json.select();}};
 const download=el('button',{textContent:'Download tuning.json'});download.onclick=()=>{const a=el('a',{href:URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:'application/json'})),download:'tuning.json'});a.click();};
 const reload=el('button',{textContent:'Reload (rebuild moss)'});reload.onclick=()=>location.reload();
 const clear=el('button',{textContent:'Reset everything'});clear.onclick=()=>{if(!confirm('Discard all edits in localStorage and reload? tuning.json in the scene folder is not touched.'))return;try{localStorage.removeItem(STORAGE_KEY);}catch{}location.reload();};
 buttons.append(copy,download,reload,clear);panel.append(buttons);
 const json=el('textarea',{readOnly:true,value:JSON.stringify(data,null,1),spellcheck:false});panel.append(json);
 panel.append(el('div',{className:'hint',textContent:'Edits live in the browser\'s localStorage and apply on every preview load. To ship them, save the JSON as tuning.json beside the scene and reinstall the app.'}));

 // ----- scene helpers: selection box and light markers
 const box=new T.BoxHelper(new T.Object3D(),0xf0d9a2);box.material.depthTest=false;box.material.transparent=true;box.renderOrder=999;box.visible=false;scene.add(box);
 const helpers=new T.Group();helpers.name='tuning-helpers';scene.add(helpers);
 const markerTexture=(shape)=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.lineWidth=6;g.strokeStyle='#fff';g.fillStyle='rgba(255,255,255,.18)';if(shape==='ring'){g.beginPath();g.arc(32,32,22,0,6.2832);g.fill();g.stroke();}else{g.fillRect(12,12,40,40);g.strokeRect(12,12,40,40);}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;};
 const ring=markerTexture('ring'),square=markerTexture('square');
 const eraserCursor=new T.Sprite(new T.SpriteMaterial({map:ring,color:0xf0d9a2,depthTest:false,transparent:true,opacity:.7}));eraserCursor.renderOrder=1001;eraserCursor.visible=false;helpers.add(eraserCursor);
 const markers=[];
 for(const [id,l] of registry.lights){
  if(l.isHemisphereLight)continue;
  const m=new T.Sprite(new T.SpriteMaterial({map:ring,color:l.color,depthTest:false,transparent:true,opacity:.9}));m.scale.setScalar(.36);m.renderOrder=1000;m.userData.marker={id,light:l,part:'position'};helpers.add(m);markers.push(m);
  if(l.isDirectionalLight||l.isSpotLight){
   const t=new T.Sprite(new T.SpriteMaterial({map:square,color:0xbfc9b8,depthTest:false,transparent:true,opacity:.8}));t.scale.setScalar(.26);t.renderOrder=1000;t.userData.marker={id,light:l,part:'target'};helpers.add(t);markers.push(t);
   const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0xbfc9b8,depthTest:false,transparent:true,opacity:.5}));line.renderOrder=998;line.userData.link={light:l};helpers.add(line);
  }
 }
 function updateHelpers(){
  for(const m of markers){const {light,part}=m.userData.marker;m.visible=light.visible;m.position.copy(part==='target'?light.target.position:light.position);m.material.color.copy(part==='target'?new T.Color(0xbfc9b8):light.color);}
  for(const h of helpers.children)if(h.userData.link){const {light}=h.userData.link;h.visible=light.visible;const p=h.geometry.attributes.position;p.setXYZ(0,light.position.x,light.position.y,light.position.z);p.setXYZ(1,light.target.position.x,light.target.position.y,light.target.position.z);p.needsUpdate=true;}
  if(selected?.kind==='object'&&box.visible)box.setFromObject(selected.object);
 }

 // ----- picking and dragging
 const ray=new T.Raycaster(),ndc=new T.Vector2();
 const roots=[...registry.objects.values()];
 const mossRoots=()=>[...moss.ids].map(id=>registry.objects.get(id)).filter(Boolean);
 let drag=null,erasing=false;
 function mossHit(e){
  const r=canvas.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);
  return ray.intersectObjects(mossRoots().filter(o=>o.visible),true)[0]?.point||null;
 }
 function eraseAt(p){
  if(lastErase&&lastErase.distanceTo(p)<eraserRadius*.35)return;
  lastErase=p.clone();eraseMossAt(p.x,p.y,p.z,eraserRadius);strokes[strokes.length-1]++;loop?.invalidate();persist();refreshEraser();
 }
 const unitsPerPixel=()=>({x:(camera.right-camera.left)/camera.zoom/canvas.clientWidth,y:(camera.top-camera.bottom)/camera.zoom/canvas.clientHeight});
 function pick(e){
  const r=canvas.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);
  const hitMarker=ray.intersectObjects(markers,false)[0];if(hitMarker)return {marker:hitMarker.object.userData.marker};
  const hit=ray.intersectObjects(roots.filter(o=>o.visible),true)[0];if(!hit)return null;
  let o=hit.object;while(o&&!o.userData.tuneId)o=o.parent;return o?{object:o}:null;
 }
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  if(eraser){const p=mossHit(e);if(!p)return;erasing=true;lastErase=null;strokes.push(0);eraseAt(p);canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}
  const found=pick(e);
  if(!found){return;}
  if(found.marker){selectLight(found.marker.id,found.marker.part);}else selectObject(found.object.userData.tuneId);
  const target=selected.kind==='light'?(selected.part==='target'?selected.light.target:selected.light):selected.object;
  drag={target,x:e.clientX,y:e.clientY,start:target.position.clone(),rotation:selected.kind==='object'?target.rotation.y:0};
  canvas.setPointerCapture(e.pointerId);e.preventDefault();
 });
 canvas.addEventListener('pointermove',e=>{
  if(eraser){const p=mossHit(e);eraserCursor.visible=!!p;if(p){eraserCursor.position.copy(p);eraserCursor.scale.setScalar(eraserRadius*2);if(erasing)eraseAt(p);}loop?.invalidate();return;}
  if(!drag)return;const u=unitsPerPixel(),dx=e.clientX-drag.x,dy=e.clientY-drag.y,t=drag.target;
  if(e.altKey&&selected.kind==='object'){t.rotation.y=drag.rotation+dx*.01;}
  else if(e.shiftKey){t.position.z=drag.start.z-dy*u.y*2;}
  else{t.position.x=drag.start.x+dx*u.x;t.position.y=drag.start.y-dy*u.y;}
  commit();
 });
 const endDrag=e=>{if(erasing){erasing=false;if(!strokes[strokes.length-1])strokes.pop();}if(!drag)return;drag=null;try{canvas.releasePointerCapture(e.pointerId);}catch{}};
 canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
 function commit(){
  if(!selected)return;
  if(selected.kind==='object'){recordObject(selected.id,selected.object);objectRows.forEach(r=>r.refresh?.());}
  else{recordLight(selected.id,selected.light);lightRows.forEach(r=>r.refresh?.());}
 }
 addEventListener('keydown',e=>{
  if(e.code==='KeyE'&&!e.metaKey&&!e.ctrlKey&&e.target.tagName!=='INPUT'&&e.target.tagName!=='TEXTAREA'){setEraser(!eraser);return;}
  if(!selected||e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  if((e.code==='Delete'||e.code==='Backspace')&&selected.kind==='object'){e.preventDefault();deleteObject(selected.id);return;}
  const step=e.shiftKey?.5:.05;const t=selected.kind==='light'?(selected.part==='target'?selected.light.target:selected.light):selected.object;
  const moves={ArrowLeft:[-step,0,0],ArrowRight:[step,0,0],ArrowUp:[0,step,0],ArrowDown:[0,-step,0],PageUp:[0,0,-step],PageDown:[0,0,step]};
  if(!moves[e.code])return;e.preventDefault();t.position.add(new T.Vector3(...moves[e.code]));commit();
 });

 const api={select:id=>registry.objects.has(id)?selectObject(id):selectLight(id),selected:()=>selected&&{kind:selected.kind,id:selected.id},data:()=>data,update:updateHelpers,eraser:setEraser,eraseAt:(x,y,z,r=eraserRadius)=>{strokes.push(1);eraseMossAt(x,y,z,r);persist();refreshEraser();loop?.invalidate();},
  dispose(){panel.remove();style.remove();scene.remove(box,helpers);}};
 window.habitatEditor=api;
 return api;
}
