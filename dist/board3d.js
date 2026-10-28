import * as T from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { XIANGQI_NAMES } from './xiangqi.js';

const TAU=Math.PI*2;
const ease=t=>1-Math.pow(1-t,3);
const squareRC=s=>[8-Number(s[1]),s.charCodeAt(0)-97];

// Geometry and materials are reused across positions. Only changed positions rebuild.
export class Board3D {
  constructor(host,onCell,onOrbit,onFailure){
    this.host=host;this.onCell=onCell;this.onOrbit=onOrbit;this.onFailure=onFailure;
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
    const canvas=this.renderer.domElement;canvas.setAttribute('aria-label','三维棋盘：点击落子，拖动旋转，滚轮缩放。键盘可使用下方棋盘。');canvas.setAttribute('role','img');host.append(canvas);
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(39,1,.1,100);this.camera.position.set(1,10,10);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.target.set(0,.3,0);this.controls.enablePan=false;this.controls.minDistance=10.5;this.controls.maxDistance=23;this.controls.minPolarAngle=T.MathUtils.degToRad(15);this.controls.maxPolarAngle=T.MathUtils.degToRad(65);this.controls.rotateSpeed=.65;this.controls.enableDamping=false;
    this.controls.addEventListener('change',()=>{this.draw();if(!this.settingCamera)this.onOrbit?.(T.MathUtils.radToDeg(this.controls.getPolarAngle()),T.MathUtils.radToDeg(this.controls.getAzimuthalAngle()));});
    this.scene.add(new T.HemisphereLight(0xfff9ea,0x6c7662,2));
    const key=new T.DirectionalLight(0xffedcb,4);key.position.set(-4,12,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:1,far:30});key.shadow.bias=-.001;key.shadow.normalBias=.035;this.scene.add(key);
    const rim=new T.DirectionalLight(0xd9e6e5,2.3);rim.position.set(6,6,-7);this.scene.add(rim);
    this.root=new T.Group();this.scene.add(this.root);this.surface=new T.Group();this.pieces=new T.Group();this.marks=new T.Group();this.particles=new T.Group();this.root.add(this.surface,this.pieces,this.marks,this.particles);
    this.materials=new Map();this.geometry=new Map();this.meshes=new Map();this.tweens=[];this.raf=0;this.active=true;this.layoutKey='';this.positionKey='';this.images={};this.n=8;this.kind='chess';
    this.raycaster=new T.Raycaster();this.pointer=new T.Vector2();
    canvas.addEventListener('pointerdown',event=>{this.pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};});
    canvas.addEventListener('pointerup',event=>{const start=this.pointerStart;this.pointerStart=null;if(!start||start.id!==event.pointerId||Math.hypot(event.clientX-start.x,event.clientY-start.y)>7)return;const rect=canvas.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hits=this.raycaster.intersectObjects([...this.pieces.children,...this.hitPlanes||[]],true);const hit=hits.find(h=>h.object.userData.cell);if(hit){const {r,c}=hit.object.userData.cell;this.onCell(r,c);}});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.setActive(false);this.onFailure?.();});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
    for(const theme of ['terrain','world','xiangqi-board']){const image=new Image();image.onload=()=>{this.images[theme]=image;if(this.theme===theme||(theme==='xiangqi-board'&&this.kind==='xiangqi')){this.layoutKey='';this.sync(this.lastState);}};image.src=`assets/${theme}.svg`;}
    this.setCamera(48,-12);this.resize();
  }
  material(color,metalness=.05,roughness=.36){const key=[color,metalness,roughness].join();if(!this.materials.has(key))this.materials.set(key,new T.MeshStandardMaterial({color,metalness,roughness}));return this.materials.get(key);}
  geom(key,make){if(!this.geometry.has(key)){const geometry=make();geometry.userData.shared=true;this.geometry.set(key,geometry);}return this.geometry.get(key);}
  mesh(geometry,material,parent=this.root,x=0,y=0,z=0){const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  box(w,h,d,material,parent,x=0,y=0,z=0){return this.mesh(this.geom(`box${w},${h},${d}`,()=>new T.BoxGeometry(w,h,d)),material,parent,x,y,z);}
  cylinder(top,bottom,height,material,parent,y=0){return this.mesh(this.geom(`cyl${top},${bottom},${height}`,()=>new T.CylinderGeometry(top,bottom,height,40)),material,parent,0,y,0);}
  sphere(radius,material,parent,x=0,y=0,z=0){return this.mesh(this.geom(`sphere${radius}`,()=>new T.SphereGeometry(radius,24,16)),material,parent,x,y,z);}
  clear(group){group.traverse(object=>{if(object.geometry&&!object.geometry.userData.shared)object.geometry.dispose();if(object.userData.disposeMaterial)object.material.dispose();object.userData.texture?.dispose();});group.clear();}
  position(r,c){const spacing=8/this.n;return {x:(c-((this.columns||this.n)-1)/2)*spacing,z:(r-(this.n-1)/2)*spacing};}
  setCamera(angle,rotation){this.settingCamera=true;const distance=this.camera.position.distanceTo(this.controls.target)||17;const polar=T.MathUtils.degToRad(angle),azimuth=T.MathUtils.degToRad(rotation);this.camera.position.set(Math.sin(polar)*Math.sin(azimuth)*distance,Math.cos(polar)*distance+.3,Math.sin(polar)*Math.cos(azimuth)*distance);this.controls.update();this.settingCamera=false;this.draw();}
  resize(){const size=this.host.clientWidth;if(!size)return;this.renderer.setSize(size,size,false);this.camera.aspect=1;this.camera.updateProjectionMatrix();this.draw();}
  setActive(active){this.active=active;this.controls.enabled=active;if(!active){cancelAnimationFrame(this.raf);this.raf=0;this.resetEffects();}else{this.resize();this.draw();}}
  draw(){if(this.active&&!document.hidden)this.renderer.render(this.scene,this.camera);}
  texture(kind,theme){const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle=theme==='classic'?(kind==='reversi'?'#7d9270':'#d7bf91'):'#b8c6a5';ctx.fillRect(0,0,1024,1024);if(this.images[theme])ctx.drawImage(this.images[theme],0,0,1024,1024);const n=this.n,step=1024/n;
    if(kind==='xiangqi'){if(theme!=='classic'){ctx.fillStyle='rgba(245,231,192,.28)';ctx.fillRect(0,0,1024,1024);}if(this.images['xiangqi-board'])ctx.drawImage(this.images['xiangqi-board'],0,0,1024,1024);}
    else if(kind==='chess'){for(let r=0;r<n;r++)for(let c=0;c<n;c++){ctx.fillStyle=(r+c)%2?(theme==='classic'?'#526249':'rgba(48,75,53,.60)'):(theme==='classic'?'#e6d6ac':'rgba(255,247,211,.25)');ctx.fillRect(c*step,r*step,step,step);}}
    else{ctx.strokeStyle=kind==='tictactoe'?'#7f7960':theme==='classic'?'#766c4b':'#4f705b';ctx.lineWidth=kind==='tictactoe'?4:1.4;ctx.beginPath();if(kind==='gomoku'){for(let i=0;i<n;i++){const p=(i+.5)*step;ctx.moveTo(step/2,p);ctx.lineTo(1024-step/2,p);ctx.moveTo(p,step/2);ctx.lineTo(p,1024-step/2);}ctx.stroke();for(const r of [3,7,11])for(const c of [3,7,11]){ctx.beginPath();ctx.arc((c+.5)*step,(r+.5)*step,4,0,TAU);ctx.fillStyle='#786947';ctx.fill();}}
      else{for(let i=1;i<n;i++){ctx.moveTo(i*step,0);ctx.lineTo(i*step,1024);ctx.moveTo(0,i*step);ctx.lineTo(1024,i*step);}ctx.stroke();}}
    if(theme==='classic'&&kind!=='reversi'){ctx.globalAlpha=.045;for(let i=0;i<150;i++){ctx.strokeStyle=i%2?'#513d24':'#fff7db';ctx.lineWidth=1+i%3;ctx.beginPath();ctx.moveTo(0,i*8);ctx.bezierCurveTo(300,i*8+9,700,i*8-8,1024,i*8+3);ctx.stroke();}ctx.globalAlpha=1;}
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());return texture;
  }
  buildSurface(){this.clear(this.surface);this.surfaceTexture?.dispose();const wood=this.material(this.theme==='classic'?'#65472e':'#475c46',.1,.35),gold=this.material('#b6a06a',.65,.28);
    const width=this.kind==='xiangqi'?7.2:8;
    this.box(width+.9,.45,8.9,wood,this.surface,0,-.1,0);this.box(width+.98,.08,8.98,gold,this.surface,0,-.18,0);this.box(width+.83,.12,8.83,wood,this.surface,0,-.35,0);this.box(width+.5,.12,8.5,this.material('#332d22'),this.surface,0,.13,0);
    this.surfaceTexture=this.texture(this.kind,this.theme);const surfaceMaterial=new T.MeshStandardMaterial({map:this.surfaceTexture,roughness:.62,metalness:.02});const top=this.mesh(new T.BoxGeometry(width,.05,8),surfaceMaterial,this.surface,0,.215,0);top.userData.disposeMaterial=true;
    const spacing=8/this.n;for(let r=0;r<this.n;r++)for(let c=0;c<this.columns;c++){const p=this.position(r,c);const tile=this.mesh(this.geom(`hit${spacing}`,()=>new T.PlaneGeometry(spacing,spacing)),this.material('#ffffff'),this.surface,p.x,.247,p.z);tile.rotation.x=-Math.PI/2;tile.visible=false;tile.userData.cell={r,c};}
    // Invisible hit planes are raycast explicitly, independently of visual geometry.
    this.hitPlanes=this.surface.children.filter(x=>x.userData.cell);
    const shadowMaterial=new T.ShadowMaterial({opacity:.22});const ground=this.mesh(new T.PlaneGeometry(200,200),shadowMaterial,this.surface,0,-.45,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;ground.userData.disposeMaterial=true;
    for(let c=0;c<this.columns;c++){if(this.n>10&&c%2)continue;this.label(String.fromCharCode(65+c),this.position(0,c).x,4.25);}for(let r=0;r<this.n;r++){if(this.n>10&&r%2)continue;this.label(String(this.n-r),-width/2-.27,this.position(r,0).z);}
  }
  label(text,x,z){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#d9c797';ctx.font='36px Georgia';ctx.textAlign='center';ctx.fillText(text,32,45);const texture=new T.CanvasTexture(canvas);const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});const mesh=this.mesh(new T.PlaneGeometry(.22,.22),material,this.surface,x,.24,z);mesh.rotation.x=-Math.PI/2;mesh.userData.disposeMaterial=true;mesh.userData.texture=texture;mesh.castShadow=false;}
  makePiece(type,color,kind=this.kind){const group=new T.Group();const white=color===2||color==='w';const material=this.material(white?'#f4e5c3':'#233b30',white?.16:.3,white?.25:.23),gold=this.material(white?'#b79857':'#9d8655',.65,.28);
    if(kind==='xiangqi'){
      const wood=this.material('#ddba7e',.07,.36),rim=this.material('#a77c3d',.35,.3);this.cylinder(.305,.32,.16,wood,group,.09);this.cylinder(.306,.306,.025,rim,group,.17);
      const key='xiangqi-face-'+type+'-'+color;if(!this.materials.has(key)){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#f1d69f';ctx.fillRect(0,0,256,256);ctx.strokeStyle=color===1?'#a43f2b':'#283e33';ctx.lineWidth=5;ctx.beginPath();ctx.arc(128,128,112,0,TAU);ctx.stroke();ctx.font='bold 158px "Noto Serif SC","Songti SC",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ctx.strokeStyle;ctx.fillText(XIANGQI_NAMES[color][type],128,137);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.materials.set(key,new T.MeshStandardMaterial({map:texture,roughness:.55,metalness:.01}));}
      const face=this.mesh(this.geom('xiangqi-face',()=>new T.CircleGeometry(.295,48)),this.materials.get(key),group,0,.187,0);face.rotation.x=-Math.PI/2;return group;
    }
    if(kind==='gomoku'){const stone=this.sphere(.23,material,group,0,.10,0);stone.scale.y=.47;return group;}
    if(kind==='reversi'){this.cylinder(.34,.34,.14,material,group,.09);this.cylinder(.345,.345,.025,gold,group,.07);this.cylinder(.31,.31,.018,material,group,.17);return group;}
    if(kind==='tictactoe'){const m=this.material(white?'#6b8362':'#b96340',.22,.3);if(white){const torus=this.mesh(this.geom('ttt-ring',()=>new T.TorusGeometry(.62,.12,16,48)),m,group,0,.15,0);torus.rotation.x=Math.PI/2;}else for(const angle of [-Math.PI/4,Math.PI/4]){const arm=this.box(1.6,.2,.22,m,group,0,.12,0);arm.rotation.y=angle;}return group;}
    const heights={p:.9,r:1.12,n:1.2,b:1.37,q:1.55,k:1.7},height=heights[type]||1;const body=height*.65;
    const profile=[[0,0],[.33,0],[.36,.06],[.36,.13],[.30,.2],[.25,.24],[.24,.3],[.17,body*.7],[.16,body*.83],[.25,body*.9],[.25,body],[0,body]].map(([r,y])=>new T.Vector2(r,y));
    this.mesh(this.geom('lathe-'+type,()=>new T.LatheGeometry(profile,40)),material,group);
    this.cylinder(.325,.325,.028,gold,group,.145);this.cylinder(.225,.225,.025,gold,group,body-.04);
    if(type==='p')this.sphere(.21,material,group,0,body+.15);
    if(type==='r'){this.cylinder(.28,.25,.19,material,group,body+.06);for(let i=0;i<6;i++){const a=i*TAU/6;this.box(.13,.17,.13,material,group,Math.cos(a)*.23,body+.2,Math.sin(a)*.23);}}
    if(type==='b'){const head=this.sphere(.22,material,group,0,body+.19);head.scale.y=1.5;this.sphere(.065,gold,group,0,body+.54);const slit=this.box(.028,.21,.36,gold,group,0,body+.28,0);slit.rotation.z=-.4;}
    if(type==='q'){this.cylinder(.30,.17,.27,material,group,body+.13);for(let i=0;i<7;i++){const a=i*TAU/7;this.sphere(.067,gold,group,Math.cos(a)*.26,body+.31,Math.sin(a)*.26);}this.sphere(.09,material,group,0,body+.38);}
    if(type==='k'){this.cylinder(.22,.17,.19,material,group,body+.09);this.box(.11,.38,.11,gold,group,0,body+.36,0);this.box(.34,.1,.11,gold,group,0,body+.4,0);}
    if(type==='n'){const shape=new T.Shape();shape.moveTo(-.25,0);shape.lineTo(-.18,.4);shape.lineTo(-.38,.38);shape.lineTo(-.4,.51);shape.lineTo(-.18,.78);shape.lineTo(-.12,.96);shape.lineTo(.02,.84);shape.quadraticCurveTo(.35,.74,.29,.35);shape.lineTo(.25,0);shape.closePath();const geo=this.geom('knight-head',()=>{const g=new T.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.045,bevelThickness:.04});g.translate(0,body-.17,-.14);return g;});this.mesh(geo,material,group);this.sphere(.035,gold,group,-.18,body+.4,.185);this.sphere(.035,gold,group,-.18,body+.4,-.185);}
    return group;
  }
  sync(state){if(!state)return;this.lastState=state;this.kind=state.kind;this.n=state.kind==='xiangqi'?10:state.kind==='gomoku'?15:state.kind==='tictactoe'?3:8;this.columns=state.kind==='xiangqi'?9:this.n;this.theme=state.theme;const layout=`${state.kind}:${state.theme}`;if(this.layoutKey!==layout){this.layoutKey=layout;this.buildSurface();this.positionKey='';}
    const positionKey=JSON.stringify(state.board);if(this.positionKey!==positionKey){this.tweens=[];this.clear(this.pieces);this.clear(this.particles);this.root.position.set(0,0,0);this.root.rotation.set(0,0,0);this.meshes.clear();state.board.forEach((row,r)=>row.forEach((value,c)=>{if(!value)return;const group=this.makePiece(value.type||'',value.color||value);const p=this.position(r,c);group.position.set(p.x,.25,p.z);if(value.type==='n'&&value.color==='b')group.rotation.y=Math.PI;group.traverse(mesh=>{if(mesh.isMesh)mesh.userData.cell={r,c};});this.pieces.add(group);this.meshes.set(r+','+c,group);}));this.positionKey=positionKey;}
    this.clear(this.marks);for(const mark of state.marks||[]){const p=this.position(mark.r,mark.c),spacing=8/this.n;const color=mark.type==='selected'?'#edc777':mark.type==='legal'?'#c9824d':'#c6ad69';const ring=this.mesh(new T.RingGeometry(spacing*(this.kind==='xiangqi'?.40:.3),spacing*(this.kind==='xiangqi'?.47:.39),40),new T.MeshBasicMaterial({color,transparent:true,opacity:mark.type==='last'?.55:.95,side:T.DoubleSide,depthWrite:false}),this.marks,p.x,.255,p.z);ring.rotation.x=-Math.PI/2;ring.userData.disposeMaterial=true;ring.castShadow=false;}
    this.draw();
  }
  pick(event){const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);return this.raycaster.intersectObjects(this.hitPlanes||[],false)[0];}
  animate(duration,update,done){const start=performance.now();this.tweens.push({start,duration,update,done});this.requestFrame();}
  requestFrame(){if(this.raf||!this.active)return;this.raf=requestAnimationFrame(now=>{this.raf=0;const pending=[];for(const tween of this.tweens){const t=Math.min(1,(now-tween.start)/tween.duration);tween.update(t);if(t<1)pending.push(tween);else tween.done?.();}this.tweens=pending;this.draw();if(pending.length)this.requestFrame();});}
  move(event,reduced=false){if(reduced)return;const key=event.r+','+event.c,p=this.position(event.r,event.c),piece=this.meshes.get(key);if(piece){const target=piece.position.clone(),start=event.from?squareRC(event.from):event.fromCell?[event.fromCell.r,event.fromCell.c]:null,origin=start?this.position(...start):p;this.animate(430,t=>{const progress=ease(t);piece.position.set(origin.x+(target.x-origin.x)*progress,target.y+Math.sin(Math.PI*t)*(start?.7:.55),origin.z+(target.z-origin.z)*progress);});}
    if(event.capture||event.flips){this.burst(event.r,event.c,event.capture?36:14);this.shake(event.capture?1:.4);}
    for(const [index,cell] of (event.flipped||[]).entries()){const stone=this.meshes.get(cell.r+','+cell.c);if(stone)this.animate(480+index*30,t=>{stone.rotation.x=Math.PI*2*ease(t);stone.position.y=.25+Math.sin(Math.PI*t)*.4;});}
    if(event.castle){const r=event.r,fromC=event.c===6?7:0,toC=event.c===6?5:3,rook=this.meshes.get(r+','+toC);if(rook){const start=this.position(r,fromC),end=this.position(r,toC);this.animate(430,t=>{rook.position.x=start.x+(end.x-start.x)*ease(t);rook.position.y=.25+Math.sin(Math.PI*t)*.25;});}}
  }
  shake(strength=1){this.animate(420,t=>{const decay=(1-t)**2;this.root.position.x=Math.sin(t*75)*.1*decay*strength;this.root.position.y=Math.sin(t*48)*.045*decay*strength;this.root.rotation.z=Math.sin(t*60)*.012*decay*strength;},()=>{this.root.position.set(0,0,0);this.root.rotation.set(0,0,0);});}
  burst(r,c,count=32){const p=this.position(r,c);for(let i=0;i<count;i++){const angle=i/count*TAU,velocity=.7+Math.random()*1.3;const particle=this.mesh(this.geom('spark',()=>new T.OctahedronGeometry(.065)),this.material(i%3?'#d0a65d':'#eee6c2',.6,.3),this.particles,p.x,.45,p.z);this.animate(650+Math.random()*300,t=>{particle.position.set(p.x+Math.cos(angle)*velocity*t,.4+Math.sin(Math.PI*t)*(.7+velocity)-t*.3,p.z+Math.sin(angle)*velocity*t);particle.rotation.set(t*10,t*12,t*5);particle.scale.setScalar((1-t)*1.3);},()=>particle.removeFromParent());}}
  celebrate(){let i=0;for(const piece of this.meshes.values()){const delay=(i++%8)*35;this.animate(1200+delay,t=>{const phase=Math.max(0,(t*(1200+delay)-delay)/1200);piece.position.y=.25+Math.sin(phase*Math.PI*3)**2*(1-phase)*.5;},()=>{piece.position.y=.25;});}this.burst(3,3,45);}
  resetEffects(){this.tweens=[];this.clear(this.particles);this.root.position.set(0,0,0);this.root.rotation.set(0,0,0);for(const [key,piece] of this.meshes){const [r,c]=key.split(',').map(Number),position=this.position(r,c);piece.position.set(position.x,.25,position.z);if(this.kind==='reversi')piece.rotation.x=0;}this.draw();}
}
