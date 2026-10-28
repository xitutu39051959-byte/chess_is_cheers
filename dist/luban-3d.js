import * as T from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const MOVE_ORDER=[
  {piece:'front',direction:'z+',hint:'迎面楔'},
  {piece:'upper',direction:'y+',hint:'上层销'},
  {piece:'right',direction:'x+',hint:'右侧榫'},
  {piece:'left',direction:'x-',hint:'左侧榫'},
  {piece:'rear',direction:'z-',hint:'后梁销'},
  {piece:'heart',direction:'y+',hint:'心轴'}
];
const PARTS=[
  {id:'front',name:'迎面楔',axis:'x',position:[0,.48,1.02],length:3.55,color:'#9b6946'},
  {id:'upper',name:'上层销',axis:'y',position:[-.33,.05,-.14],length:3.45,color:'#c29b60'},
  {id:'right',name:'右侧榫',axis:'z',position:[1.03,-.18,.02],length:3.35,color:'#809378'},
  {id:'left',name:'左侧榫',axis:'z',position:[-1.03,.18,-.02],length:3.35,color:'#7c8e99'},
  {id:'rear',name:'后梁销',axis:'x',position:[0,-.55,-1.02],length:3.55,color:'#ae7866'},
  {id:'heart',name:'心轴',axis:'y',position:[.34,-.02,.18],length:3.15,color:'#b4ab7e'}
];
const DIRS={
  'x+':{axis:'x',sign:1,label:'右'},'x-':{axis:'x',sign:-1,label:'左'},
  'y+':{axis:'y',sign:1,label:'上'},'y-':{axis:'y',sign:-1,label:'下'},
  'z+':{axis:'z',sign:1,label:'前'},'z-':{axis:'z',sign:-1,label:'后'}
};
const SPREAD=[[0,.25,1],[-.5,1,0],[1,0,0],[-1,0,0],[0,-.25,-1],[.5,-1,0]];
const ease=t=>1-(1-t)**3;
export class LubanLock3D{
  constructor(host,onUpdate,onSelect){this.host=host;this.onUpdate=onUpdate;this.onSelect=onSelect;this.explode=0;this.zoom=1;this.step=0;this.selected='front';this.busy=false;this.active=false;this.raf=0;this.materials=new Map();this.geometries=new Map();this.groups=new Map();
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.22;
    this.canvas=this.renderer.domElement;this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','鲁班锁 3D 木构机关：拖动旋转观察，点击木销选择，再用方向按钮尝试抽取。');host.append(this.canvas);
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(38,1,.1,80);this.camera.position.set(6.8,6.2,8.4);this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.set(0,0,0);this.controls.enablePan=false;this.controls.enableDamping=false;this.controls.minDistance=8;this.controls.maxDistance=17;this.controls.minPolarAngle=T.MathUtils.degToRad(16);this.controls.maxPolarAngle=T.MathUtils.degToRad(165);this.controls.rotateSpeed=.72;
    this.scene.add(new T.HemisphereLight(0xfff5df,0xaaa08a,2.4));this.keyLight=new T.DirectionalLight(0xffe6bd,4);this.keyLight.castShadow=true;this.keyLight.shadow.mapSize.set(1536,1536);Object.assign(this.keyLight.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:25});this.keyLight.shadow.bias=-.001;this.keyLight.shadow.normalBias=.03;this.scene.add(this.keyLight);this.scene.add(this.keyLight.target);const fill=new T.DirectionalLight(0xd7e6e2,1.6);fill.position.set(6,5,-7);this.scene.add(fill);const under=new T.DirectionalLight(0xffeed5,2);under.position.set(0,-6,0);this.scene.add(under);
    this.table=new T.Group();this.partsRoot=new T.Group();this.scene.add(this.table,this.partsRoot);for(const part of PARTS)this.makePart(part);this.select('front',false);this.controls.addEventListener('change',()=>{this.updateLight();this.draw();});this.updateLight();this.controls.enabled=false;this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
    this.raycaster=new T.Raycaster();this.pointer=new T.Vector2();this.canvas.addEventListener('pointerdown',e=>{this.pointerStart={x:e.clientX,y:e.clientY,id:e.pointerId};});this.canvas.addEventListener('pointerup',e=>{const start=this.pointerStart;this.pointerStart=null;if(!start||start.id!==e.pointerId||Math.hypot(start.x-e.clientX,start.y-e.clientY)>6)return;const rect=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const objects=[...this.partsRoot.children].flatMap(g=>g.children);const hit=this.raycaster.intersectObjects(objects,true).find(x=>x.object.userData.part);if(hit)this.select(hit.object.userData.part);});this.publish();
  }
  geometry(key,make){if(!this.geometries.has(key))this.geometries.set(key,make());return this.geometries.get(key);}
  material(color,metalness=.06,roughness=.36){const key=`${color}:${metalness}:${roughness}`;if(!this.materials.has(key))this.materials.set(key,new T.MeshStandardMaterial({color,metalness,roughness}));return this.materials.get(key);}
  addBox(parent,w,h,d,color,x=0,y=0,z=0,metalness=.06,roughness=.36){const mesh=new T.Mesh(this.geometry(`b:${w}:${h}:${d}`,()=>new T.BoxGeometry(w,h,d)),this.material(color,metalness,roughness));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  makePart(part){const group=new T.Group();group.position.set(...part.position);group.userData.part=part.id;this.partsRoot.add(group);this.groups.set(part.id,group);const width=.54,depth=.58,length=part.length,axis=part.axis;
    const dims=axis==='x'?[length,width,depth]:axis==='y'?[width,length,depth]:[width,depth,length];const beam=this.addBox(group,...dims,part.color);beam.userData.part=part.id;beam.material=beam.material.clone();group.userData.bodyMaterial=beam.material;const edges=new T.LineSegments(new T.EdgesGeometry(beam.geometry),new T.LineBasicMaterial({color:0x493d30,transparent:true,opacity:.45}));group.add(edges);group.userData.edges=edges;
    const band=this.material('#bd9b5d',.55,.28),dark=this.material('#4d3428',.02,.62);
    // Fine brass ferrules and dark mortise grooves make each sliding member legible.
    for(const sign of [-1,1]){const p=sign*(length/2-.18),capDims=axis==='x'?[.11,width+.025,depth+.025]:axis==='y'?[width+.025,.11,depth+.025]:[width+.025,depth+.025,.11];const cap=this.addBox(group,...capDims,'#bd9b5d',axis==='x'?p:0,axis==='y'?p:0,axis==='z'?p:0,.48,.3);cap.userData.part=part.id;}
    const groovePositions=axis==='x'?[-.42,.42]:axis==='y'?[-.42,.42]:[-.42,.42];for(const offset of groovePositions){let gdims,gpos=[0,0,0];if(axis==='x'){gdims=[.08,width+.006,.1];gpos=[offset,width/2-.015,0];}else if(axis==='y'){gdims=[.1,.08,depth+.006];gpos=[0,offset,depth/2-.015];}else{gdims=[.1,depth+.006,.08];gpos=[width/2-.015,0,offset];}const groove=this.addBox(group,...gdims,'#4a3428',...gpos,.02,.7);groove.userData.part=part.id;}
    // Small end tongues suggest the alternating mortises of a traditional burr lock.
    const tongueDims=axis==='x'?[.28,.28,.3]:axis==='y'?[.3,.28,.28]:[.3,.3,.28];for(const sign of [-1,1]){const p=sign*(length/2-.04),tongue=this.addBox(group,...tongueDims,part.color,axis==='x'?p:0,axis==='y'?p:0,axis==='z'?p:0);tongue.userData.part=part.id;}
    this.addNumber(group,part);
  }
  addNumber(group,part){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#faf4e5';ctx.beginPath();ctx.arc(64,64,49,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a48b5a';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#594a32';ctx.font='bold 49px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(PARTS.indexOf(part)+1).padStart(2,'0'),64,66);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map,depthTest:false,depthWrite:false}));sprite.scale.set(.43,.43,1);const end=part.length/2+.25;sprite.position.set(part.axis==='x'?end:0,part.axis==='y'?end:.36,part.axis==='z'?end:0);sprite.userData.part=part.id;sprite.renderOrder=10;group.add(sprite);}
  setExplode(value){if(this.busy)return;this.explode=Math.max(0,Math.min(1,Number(value)||0));PARTS.forEach((p,i)=>{if(i<this.step)return;this.groups.get(p.id).position.set(...p.position.map((v,k)=>v+SPREAD[i][k]*this.explode*1.55));});this.publish();this.draw();}
  setView(name){const phi=T.MathUtils.degToRad(({angle:52,top:16,front:88,side:88,bottom:140})[name]||52),theta=name==='front'?0:name==='side'?Math.PI/2:Math.PI/5,d=12.5/this.zoom;this.camera.position.set(Math.sin(phi)*Math.sin(theta)*d,Math.cos(phi)*d,Math.sin(phi)*Math.cos(theta)*d);this.controls.update();this.draw();}
  setZoom(value){this.zoom=Math.max(.8,Math.min(1.5,Number(value)||1));this.camera.position.setLength(12.5/this.zoom);this.controls.update();this.draw();}
  updateLight(){const az=this.controls.getAzimuthalAngle(),p=T.MathUtils.degToRad(34),d=12;this.keyLight.position.set(Math.sin(p)*Math.sin(az)*d,Math.cos(p)*d,Math.sin(p)*Math.cos(az)*d);this.keyLight.target.position.set(0,-.2,0);}
  resize(){const width=this.host.clientWidth;if(!width)return;const size=Math.min(width,this.host.clientHeight||width);this.renderer.setSize(size,size,false);this.camera.aspect=1;this.camera.updateProjectionMatrix();this.draw();}
  draw(){if(this.active&&!document.hidden)this.renderer.render(this.scene,this.camera);}
  setActive(active){this.active=active;this.controls.enabled=active;if(active){this.resize();this.draw();}}
  publish(message=''){this.onUpdate?.({step:this.step,total:MOVE_ORDER.length,selected:this.selected,expected:MOVE_ORDER[this.step]||null,busy:this.busy,explode:this.explode,solved:this.step>=MOVE_ORDER.length,message,parts:PARTS.map(p=>({id:p.id,name:p.name,removed:PARTS.indexOf(p)<this.step}))});}
  select(id,notify=true){if(this.busy||!this.groups.has(id)||!this.groups.get(id).visible)return;this.selected=id;for(const [key,group] of this.groups){const picked=key===id;group.userData.bodyMaterial.emissive.set(picked?'#685029':'#000000');group.userData.bodyMaterial.emissiveIntensity=picked?.25:0;group.userData.edges.material.color.set(picked?'#f5d391':'#493d30');group.userData.edges.material.opacity=picked?1:.45;}if(notify)this.onSelect?.(id);this.publish();this.draw();}
  tryMove(direction){if(this.explode>0){this.publish('当前为分解观察；将滑杆归零后再抽取木销。');return;}if(this.busy||this.step>=MOVE_ORDER.length||!DIRS[direction])return;const expected=MOVE_ORDER[this.step],group=this.groups.get(this.selected);if(this.selected!==expected.piece||direction!==expected.direction){this.jiggle(group,direction);this.publish('榫口仍然咬合，再换一根木销或方向试试。');return;}
    const vector=DIRS[direction],axis=vector.axis,sign=vector.sign,start=group.position[axis],time=performance.now();this.busy=true;this.publish('木销松动，正在抽出…');const finish=()=>{group.position[axis]=start+sign*2.85;group.visible=false;this.busy=false;this.step++;this.selected=MOVE_ORDER[this.step]?.piece||'';if(this.selected)this.select(this.selected,false);this.publish();this.draw();};const tick=now=>{const t=Math.min(1,(now-time)/520);group.position[axis]=start+sign*2.85*ease(t);this.draw();if(t<1)this.raf=requestAnimationFrame(tick);else finish();};this.raf=requestAnimationFrame(tick);
  }
  jiggle(group,direction){if(!group||this.busy)return;const dir=DIRS[direction],axis=dir.axis,base=group.position[axis],time=performance.now();this.busy=true;this.publish('榫口仍然咬合，再换一根木销或方向试试。');const tick=now=>{const t=Math.min(1,(now-time)/230);group.position[axis]=base+dir.sign*Math.sin(t*Math.PI*4)*.09*(1-t);this.draw();if(t<1)this.raf=requestAnimationFrame(tick);else{group.position[axis]=base;this.busy=false;this.publish('榫口仍然咬合，再换一根木销或方向试试。');}};this.raf=requestAnimationFrame(tick);}
  restart(){if(this.busy)return;for(const part of PARTS){const group=this.groups.get(part.id);group.position.set(...part.position);group.scale.setScalar(1);group.visible=true;}this.step=0;this.selected='front';this.setExplode(this.explode);this.select('front',false);this.publish();this.draw();}
}
