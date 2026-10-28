import * as T from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createRubikCube, rubikMove, inverseRubikMove, applyRubikMove, makeRubikScramble, isRubikSolved, RUBIK_FACES } from './rubik-engine.js';

const EASE=t=>1-(1-t)**3;
const FACE_NORMAL={U:[0,1,0],D:[0,-1,0],R:[1,0,0],L:[-1,0,0],F:[0,0,1],B:[0,0,-1]};
const FACE_AXIS={U:'y',D:'y',R:'x',L:'x',F:'z',B:'z'};
export class Rubik3D{
  constructor(host,onUpdate,onView=()=>{}){this.host=host;this.onUpdate=onUpdate;this.onView=onView;this.bottomView=false;this.cube=createRubikCube();this.history=[];this.busy=false;this.active=false;this.raf=0;this.materials=new Map();this.geometries=new Map();
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.canvas=this.renderer.domElement;this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','3D 魔方：拖动旋转视角或使用底面视角按钮，使用旁边的面转按钮转动色层。');host.append(this.canvas);
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(38,1,.1,80);this.camera.position.set(6,6,8);
    this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.set(0,-.02,0);this.controls.enablePan=false;this.controls.enableDamping=false;this.controls.minDistance=6.8;this.controls.maxDistance=18;this.controls.minPolarAngle=T.MathUtils.degToRad(15);this.controls.maxPolarAngle=T.MathUtils.degToRad(165);this.controls.rotateSpeed=.72;
    this.scene.add(new T.HemisphereLight(0xfff7e6,0x918b72,2.35));this.keyLight=new T.DirectionalLight(0xffedca,4.2);this.keyLight.castShadow=true;this.keyLight.shadow.mapSize.set(1536,1536);Object.assign(this.keyLight.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:1,far:24});this.keyLight.shadow.bias=-.001;this.keyLight.shadow.normalBias=.025;this.scene.add(this.keyLight);this.scene.add(this.keyLight.target);const fill=new T.DirectionalLight(0xd9e6e2,2.2);fill.position.set(6,5,-6);this.scene.add(fill);this.bottomFill=new T.DirectionalLight(0xf5e8c9,2.8);this.bottomFill.position.set(0,-6,0);this.bottomFill.target.position.set(0,0,0);this.scene.add(this.bottomFill,this.bottomFill.target);
    this.cubeRoot=new T.Group();this.scene.add(this.cubeRoot);this.drawCube();this.controls.addEventListener('change',()=>{this.updateLight();this.bottomView=this.controls.getPolarAngle()>Math.PI/2;this.onView(this.bottomView);this.draw();});this.updateLight();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  }
  geom(key,make){if(!this.geometries.has(key))this.geometries.set(key,make());return this.geometries.get(key);}
  mat(color,metalness=.05,roughness=.29){if(!this.materials.has(color))this.materials.set(color,new T.MeshStandardMaterial({color,metalness,roughness}));return this.materials.get(color);}
  box(w,h,d,color,parent,x=0,y=0,z=0){const mesh=new T.Mesh(this.geom(`box:${w}:${h}:${d}`,()=>new T.BoxGeometry(w,h,d)),this.mat(color),);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  setBottomView(bottom=true){this.bottomView=bottom;const target=this.controls.target,theta=this.controls.getAzimuthalAngle(),phi=T.MathUtils.degToRad(bottom?136:48),distance=this.camera.position.distanceTo(target);this.camera.position.set(target.x+Math.sin(phi)*Math.sin(theta)*distance,target.y+Math.cos(phi)*distance,target.z+Math.sin(phi)*Math.cos(theta)*distance);this.controls.update();this.onView(this.bottomView);this.draw();}
  drawCube(){this.cubeRoot.clear();const spacing=1.035;for(const cubie of this.cube){const group=new T.Group();group.position.set(cubie.pos.x*spacing,cubie.pos.y*spacing,cubie.pos.z*spacing);const core=new T.Mesh(this.geom('cubie',()=>new T.BoxGeometry(.97,.97,.97)),this.mat('#1d2522',.12,.3));core.castShadow=true;core.receiveShadow=true;group.add(core);
      for(const [normal,color] of Object.entries(cubie.stickers)){const [axis,sign]=[normal[0],normal[1]==='+'?1:-1],p=FACE_NORMAL[axis==='x'?(sign>0?'R':'L'):axis==='y'?(sign>0?'U':'D'):(sign>0?'F':'B')];const trimSize=.83,stickerSize=.76,thin=.055,offset=.492;
        const dims=axis==='x'?[thin,trimSize,trimSize]:axis==='y'?[trimSize,thin,trimSize]:[trimSize,trimSize,thin];const insetDims=axis==='x'?[thin*.45,stickerSize,stickerSize]:axis==='y'?[stickerSize,thin*.45,stickerSize]:[stickerSize,stickerSize,thin*.45];
        const pos=p.map(v=>v*offset);this.box(...dims,'#28312e',group,...pos);const cpos=p.map(v=>v*(offset+.027));this.box(...insetDims,color,group,...cpos);
      }this.cubeRoot.add(group);
    }this.draw();}
  updateLight(){const az=this.controls.getAzimuthalAngle(),polar=T.MathUtils.degToRad(33),d=11;this.keyLight.position.set(Math.sin(polar)*Math.sin(az)*d,Math.cos(polar)*d,Math.sin(polar)*Math.cos(az)*d);this.keyLight.target.position.set(0,-.35,0);}
  resize(){const size=Math.max(1,Math.min(this.host.clientWidth,this.host.clientHeight||this.host.clientWidth));this.renderer.setSize(size,size,false);this.camera.aspect=1;this.camera.updateProjectionMatrix();this.draw();}
  draw(){if(this.active&&!document.hidden)this.renderer.render(this.scene,this.camera);}
  setActive(active){this.active=active;this.controls.enabled=active;if(!active){cancelAnimationFrame(this.raf);if(this.finishMove)this.finishMove();this.cubeRoot.rotation.y=0;}if(active){this.resize();this.draw();}}
  publish(face=''){this.onUpdate?.({moves:this.history.length,scramble:this.scramble?.length||18,solved:isRubikSolved(this.cube),busy:this.busy,face});}
  move(face,clockwise=true,record=true){if(this.busy||!this.active)return false;const move=rubikMove(face,clockwise),axis=FACE_AXIS[face],layer=RUBIK_FACES[face].sign,selected=this.cubeRoot.children.filter(group=>Math.round(group.position[axis]/1.035)===layer);if(selected.length!==9)return false;
    this.busy=true;this.publish(face);const pivot=new T.Group();this.cubeRoot.add(pivot);for(const mesh of selected)pivot.attach(mesh);const start=performance.now(),target=move.q*Math.PI/2;const finish=()=>{if(!this.busy)return;this.busy=false;this.finishMove=null;this.cubeRoot.clear();applyRubikMove(this.cube,move);if(record)this.history.push(move);this.drawCube();this.publish(face);if(isRubikSolved(this.cube))this.celebrate();};this.finishMove=finish;
    const tick=now=>{const t=Math.min(1,(now-start)/210);pivot.rotation[axis]=target*EASE(t);this.draw();if(t<1)this.raf=requestAnimationFrame(tick);else finish();};this.raf=requestAnimationFrame(tick);return true;
  }
  undo(){if(this.busy||!this.history.length)return false;const previous=this.history.pop();return this.move(previous.face,!previous.clockwise,false);}
  newChallenge(){if(this.busy)return;this.scramble=makeRubikScramble(18);this.cube=createRubikCube();for(const move of this.scramble)applyRubikMove(this.cube,move);this.history=[];this.drawCube();this.publish();}
  celebrate(){let start=null;const spin=now=>{if(!this.active)return;if(start===null)start=now;const t=Math.min(1,(now-start)/900);this.cubeRoot.rotation.y=Math.sin(t*Math.PI*4)*.07;this.draw();if(t<1)this.raf=requestAnimationFrame(spin);else{this.cubeRoot.rotation.y=0;this.draw();}};this.raf=requestAnimationFrame(spin);}
}
