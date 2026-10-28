const FACE_INFO={
  U:{axis:'y',sign:1,color:'#F7F7F7'},D:{axis:'y',sign:-1,color:'#FFD500'},
  R:{axis:'x',sign:1,color:'#C8102E'},L:{axis:'x',sign:-1,color:'#FF6D00'},
  F:{axis:'z',sign:1,color:'#009B48'},B:{axis:'z',sign:-1,color:'#0051BA'}
};
const NORMALS={'x+':[1,0,0],'x-':[-1,0,0],'y+':[0,1,0],'y-':[0,-1,0],'z+':[0,0,1],'z-':[0,0,-1]};
const keyFor=v=>{const axis=v[0]?'x':v[1]?'y':'z',value=v[axis==='x'?0:axis==='y'?1:2];return `${axis}${value>0?'+':'-'}`};
export const RUBIK_FACES=FACE_INFO;
export function createRubikCube(){const cube=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const stickers={};if(x===1)stickers['x+']=FACE_INFO.R.color;if(x===-1)stickers['x-']=FACE_INFO.L.color;if(y===1)stickers['y+']=FACE_INFO.U.color;if(y===-1)stickers['y-']=FACE_INFO.D.color;if(z===1)stickers['z+']=FACE_INFO.F.color;if(z===-1)stickers['z-']=FACE_INFO.B.color;cube.push({pos:{x,y,z},stickers});}return cube;}
function rotate(v,axis,q){let [x,y,z]=v;if(axis==='x')return q===1?[x,-z,y]:[x,z,-y];if(axis==='y')return q===1?[z,y,-x]:[-z,y,x];return q===1?[-y,x,z]:[y,-x,z];}
export function rubikMove(face,clockwise=true){const info=FACE_INFO[face];if(!info)throw new Error(`Unknown face: ${face}`);return {face,clockwise,axis:info.axis,layer:info.sign,q:(clockwise?-1:1)*info.sign};}
export function inverseRubikMove(move){return rubikMove(move.face,!move.clockwise);}
export function applyRubikMove(cube,move){const {axis,layer,q}=move.axis?move:rubikMove(move.face,move.clockwise);for(const cubie of cube){if(cubie.pos[axis]!==layer)continue;const p=rotate([cubie.pos.x,cubie.pos.y,cubie.pos.z],axis,q);cubie.pos={x:p[0],y:p[1],z:p[2]};const stickers={};for(const [normal,color] of Object.entries(cubie.stickers)){const n=rotate(NORMALS[normal],axis,q);stickers[keyFor(n)]=color;}cubie.stickers=stickers;}return cube;}
export function isRubikSolved(cube){for(const [face,{axis,sign,color}] of Object.entries(FACE_INFO)){const side=cube.filter(c=>c.pos[axis]===sign);if(side.length!==9||side.some(c=>c.stickers[`${axis}${sign>0?'+':'-'}`]!==color))return false;}return true;}
export function makeRubikScramble(length=18,random=Math.random){const moves=[];let previous='';for(let i=0;i<length;i++){let face;do{face=Object.keys(FACE_INFO)[Math.floor(random()*6)];}while(face===previous);moves.push(rubikMove(face,random()>.5));previous=face;}return moves;}
