export const GO_SIZE=9,GO_KOMI=7.5;
export const GO_STARS=[[2,2],[2,6],[4,4],[6,2],[6,6]];
export const goCoordinate=(r,c)=>'ABCDEFGHJ'[c]+(GO_SIZE-r);
const inside=(r,c)=>Number.isInteger(r)&&Number.isInteger(c)&&r>=0&&c>=0&&r<GO_SIZE&&c<GO_SIZE;
const around=(r,c)=>[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([a,b])=>inside(a,b));
const ILLEGAL={occupied:'这里已经有棋子了。',suicide:'这里没有气，也提不掉对方的子，是禁着点。',ko:'这一手会让全局回到出现过的局面（打劫），请先在别处走一手。'};

function groupOf(board,r,c){const color=board[r][c],stones=[[r,c]],seen=new Set([r*GO_SIZE+c]);let liberties=0;const counted=new Set();for(let i=0;i<stones.length;i++)for(const [a,b] of around(...stones[i])){const key=a*GO_SIZE+b;if(!board[a][b]){if(!counted.has(key)){counted.add(key);liberties++;}}else if(board[a][b]===color&&!seen.has(key)){seen.add(key);stones.push([a,b]);}}return {stones,liberties};}

export class Go {
  constructor(){this.board=Array.from({length:GO_SIZE},()=>Array(GO_SIZE).fill(0));this.size=GO_SIZE;this.turn=1;this.winner=null;this.reason='';this.winning=[];this.history=[];this.snapshots=[];this.passes=0;this.phase='play';this.captures={1:0,2:0};this.finalDead=[];this.positions=[this.key()];}
  key(){return this.board.flat().join('');}
  group(r,c){return groupOf(this.board,r,c);}
  // Works on a copy, so an illegal attempt never touches the real board.
  attempt(r,c,player=this.turn){
    if(!inside(r,c))return {error:'occupied'};if(this.board[r][c])return {error:'occupied'};
    const board=this.board.map(row=>[...row]);board[r][c]=player;const captured=[];
    for(const [a,b] of around(r,c))if(board[a][b]===3-player){const group=groupOf(board,a,b);if(!group.liberties)for(const [x,y] of group.stones){board[x][y]=0;captured.push({r:x,c:y});}}
    if(!groupOf(board,r,c).liberties)return {error:'suicide'};
    if(this.positions.includes(board.flat().join('')))return {error:'ko'};
    return {board,captured};
  }
  illegalText(r,c){if(this.phase!=='play')return '';return ILLEGAL[this.attempt(r,c).error]||'';}
  legalMoves(player=this.turn){if(this.phase!=='play')return [];const moves=[];for(let r=0;r<GO_SIZE;r++)for(let c=0;c<GO_SIZE;c++)if(!this.attempt(r,c,player).error)moves.push({r,c});return moves;}
  remember(){this.snapshots.push({board:this.board,turn:this.turn,winner:this.winner,reason:this.reason,passes:this.passes,phase:this.phase,captures:{...this.captures},finalDead:this.finalDead});}
  move(r,c){
    if(this.phase!=='play')return false;
    const result=this.attempt(r,c);if(result.error)return false;
    this.remember();const player=this.turn;this.board=result.board;this.captures[player]+=result.captured.length;this.passes=0;this.turn=3-player;this.positions.push(this.key());
    const record={r,c,player,label:goCoordinate(r,c)+(result.captured.length?' 提'+result.captured.length:''),captured:result.captured};this.history.push(record);return record;
  }
  pass(){
    if(this.phase!=='play')return false;
    this.remember();const player=this.turn;this.passes++;this.turn=3-player;this.positions.push(this.key());if(this.passes>=2)this.phase='scoring';
    const record={pass:true,player,label:'停一手'};this.history.push(record);return record;
  }
  // Dead stones are part of the record, so replaying a save reaches the same result.
  finish(dead=[]){
    if(this.phase!=='scoring'||!Array.isArray(dead)||dead.some(([r,c])=>!inside(r,c)||!this.board[r][c]))return false;
    this.remember();const score=this.score(dead),player=this.turn;this.phase='over';this.finalDead=dead;this.winner=score.margin>0?1:2;this.positions.push(this.key());
    this.reason=`黑 ${score.black} : 白 ${score.white} + 贴 ${GO_KOMI}，${this.winner===1?'黑':'白'}胜 ${Math.abs(score.margin)} 目`;
    const record={finish:true,dead,player,label:'数子终局'};this.history.push(record);return record;
  }
  undo(){const snapshot=this.snapshots.pop();if(!snapshot)return false;Object.assign(this,snapshot);this.history.pop();this.positions.pop();return true;}
  // Area scoring: stones on the board plus empty points that touch only one color.
  score(dead=[]){
    const board=this.board.map(row=>[...row]);for(const [r,c] of dead)board[r][c]=0;
    const territory=Array.from({length:GO_SIZE},()=>Array(GO_SIZE).fill(0)),seen=new Set();const area={1:0,2:0};
    for(let r=0;r<GO_SIZE;r++)for(let c=0;c<GO_SIZE;c++){
      if(board[r][c]){area[board[r][c]]++;continue;}
      if(seen.has(r*GO_SIZE+c))continue;
      const region=[[r,c]],touches=new Set();seen.add(r*GO_SIZE+c);
      for(let i=0;i<region.length;i++)for(const [a,b] of around(...region[i])){if(board[a][b])touches.add(board[a][b]);else if(!seen.has(a*GO_SIZE+b)){seen.add(a*GO_SIZE+b);region.push([a,b]);}}
      if(touches.size===1){const owner=[...touches][0];area[owner]+=region.length;for(const [a,b] of region)territory[a][b]=owner;}
    }
    return {black:area[1],white:area[2],margin:area[1]-area[2]-GO_KOMI,territory};
  }
}

// Search below runs on a flat bordered board for speed. Superko is only checked at the root.
const W=GO_SIZE+2,CELLS=W*W,BORDER=3;
const toIndex=(r,c)=>(r+1)*W+c+1;
const fromIndex=i=>({r:Math.floor(i/W)-1,c:i%W-1});
const SIDES=[-W,-1,1,W],CORNERS=[-W-1,-W+1,W-1,W+1];
const POINTS=[];for(let r=0;r<GO_SIZE;r++)for(let c=0;c<GO_SIZE;c++)POINTS.push(toIndex(r,c));
const stamp=new Int32Array(CELLS),stack=new Int32Array(CELLS);let generation=0;

function flatten(game){const b=new Int8Array(CELLS).fill(BORDER);for(const i of POINTS){const {r,c}=fromIndex(i);b[i]=game.board[r][c];}return b;}
// Returns the group's liberty count, stopping once it knows there are at least `limit`; `lone` holds the last one found.
let lone=0;
function liberties(b,start,limit){generation++;const color=b[start];let top=0,count=0;stack[top++]=start;stamp[start]=generation;while(top){const p=stack[--top];for(let k=0;k<4;k++){const q=p+SIDES[k],v=b[q];if(stamp[q]===generation)continue;if(v===0){stamp[q]=generation;count++;lone=q;if(count>=limit)return count;}else if(v===color){stamp[q]=generation;stack[top++]=q;}}}return count;}
function removeGroup(b,start,removed){const color=b[start];let top=0,count=0;stack[top++]=start;b[start]=0;while(top){const p=stack[--top];removed?.push(p);count++;for(let k=0;k<4;k++){const q=p+SIDES[k];if(b[q]===color){b[q]=0;stack[top++]=q;}}}return count;}
function isEye(b,i,color){for(let k=0;k<4;k++){const v=b[i+SIDES[k]];if(v!==color&&v!==BORDER)return false;}let foes=0,edge=0;for(let k=0;k<4;k++){const v=b[i+CORNERS[k]];if(v===BORDER)edge=1;else if(v===3-color)foes++;}return foes+edge<2;}
function canPlay(b,i,color,ko){
  if(b[i]!==0||i===ko)return false;
  for(let k=0;k<4;k++){const q=i+SIDES[k],v=b[q];if(v===0)return true;if(v===BORDER)continue;const count=liberties(b,q,2);if(v===color?count>1:count===1)return true;}
  return false;
}
// Assumes canPlay. Returns the new ko point, or 0.
function play(b,i,color,removed){
  b[i]=color;let taken=0,point=0;
  for(let k=0;k<4;k++){const q=i+SIDES[k];if(b[q]===3-color&&liberties(b,q,1)===0){const n=removeGroup(b,q,removed);taken+=n;if(n===1)point=q;}}
  if(taken!==1)return 0;
  return liberties(b,i,2)===1&&lone===point?point:0;
}
// Answer the last move when it left something in atari: take it, or run with our own stones.
function urgent(b,last,color,ko){
  if(!last)return 0;
  if(b[last]===3-color&&liberties(b,last,2)===1&&canPlay(b,lone,color,ko))return lone;
  for(let k=0;k<4;k++){const q=last+SIDES[k];if(b[q]!==color||liberties(b,q,2)!==1)continue;const escape=lone;if(canPlay(b,escape,color,ko)&&!isEye(b,escape,color)){const trial=b.slice();play(trial,escape,color);if(liberties(trial,escape,3)>=2)return escape;}}
  return 0;
}
const pool=new Int32Array(POINTS.length);
function rollout(b,color,ko,last,random,sequence){
  let passes=0,turn=color,moves=0;const limit=POINTS.length*2;
  while(passes<2&&moves++<limit){
    let chosen=urgent(b,last,turn,ko);
    if(!chosen){let n=0;for(const i of POINTS)if(b[i]===0)pool[n++]=i;while(n){const at=Math.floor(random()*n),i=pool[at];pool[at]=pool[--n];if(!isEye(b,i,turn)&&canPlay(b,i,turn,ko)){chosen=i;break;}}}
    if(chosen){ko=play(b,chosen,turn);sequence?.push(chosen,turn);passes=0;last=chosen;}else{passes++;last=0;ko=0;}
    turn=3-turn;
  }
}
function finalOwner(b,i){if(b[i]===1||b[i]===2)return b[i];let owner=0;for(let k=0;k<4;k++){const v=b[i+SIDES[k]];if(v===BORDER)continue;if(!v||(owner&&v!==owner))return 0;owner=v;}return owner;}
function blackWins(b){let score=-GO_KOMI;for(const i of POINTS){const owner=finalOwner(b,i);if(owner===1)score++;else if(owner===2)score--;}return score>0;}

const RAVE_K=800;
const makeNode=(move,player,edge)=>({move,player,N:0,W:0,rN:10,rW:edge?3:5,children:null});
const isEdge=i=>{const {r,c}=fromIndex(i);return r===0||c===0||r===GO_SIZE-1||c===GO_SIZE-1;};
function expand(node,b,color,ko){node.children=[];for(const i of POINTS)if(!isEye(b,i,color)&&canPlay(b,i,color,ko))node.children.push(makeNode(i,color,isEdge(i)));}
function select(node){let best=null,value=-Infinity;for(const child of node.children){const beta=Math.sqrt(RAVE_K/(3*child.N+RAVE_K)),q=child.N?child.W/child.N:.5,score=(1-beta)*q+beta*child.rW/child.rN;if(score>value){value=score;best=child;}}return best;}
const first=new Int8Array(CELLS);
function backup(path,sequence,black){
  for(let depth=0;depth<path.length;depth++){
    const node=path[depth];node.N++;if((node.player===1)===black)node.W++;
    if(!node.children)continue;
    first.fill(0);for(let i=sequence.length-2;i>=depth*2;i-=2)first[sequence[i]]=sequence[i+1];
    for(const child of node.children)if(first[child.move]===child.player){child.rN++;if((child.player===1)===black)child.rW++;}
  }
}
function search(game,candidates,{ms,playouts,random}){
  const base=flatten(game),root=makeNode(0,3-game.turn,false),last=game.history.at(-1),lastPoint=last&&!last.pass?toIndex(last.r,last.c):0;
  root.children=candidates.map(({r,c})=>{const i=toIndex(r,c);return makeNode(i,game.turn,isEdge(i));});
  const started=performance.now();
  for(let n=0;n<playouts;n++){
    if(!(n&15)&&performance.now()-started>ms)break;
    const b=base.slice();let node=root,color=game.turn,ko=0,recent=lastPoint;const path=[root],sequence=[];
    while(node.children?.length){const child=select(node);ko=play(b,child.move,color);sequence.push(child.move,color);recent=child.move;path.push(child);node=child;color=3-color;if(!child.children&&child.N>=2)expand(child,b,color,ko);if(!child.children||!child.children.length)break;if(child.N<2)break;}
    rollout(b,color,ko,recent,random,sequence);backup(path,sequence,blackWins(b));
  }
  return root;
}
export function estimateDead(game,{playouts=240,random=Math.random}={}){
  const base=flatten(game),own=new Int32Array(CELLS),seen=new Set(),dead=[];
  for(let n=0;n<playouts;n++){const b=base.slice();rollout(b,game.turn,0,0,random);for(const i of POINTS)if(base[i]&&finalOwner(b,i)===base[i])own[i]++;}
  for(let r=0;r<GO_SIZE;r++)for(let c=0;c<GO_SIZE;c++){if(!game.board[r][c]||seen.has(r*GO_SIZE+c))continue;const {stones}=game.group(r,c);let alive=0;for(const [x,y] of stones){seen.add(x*GO_SIZE+y);alive+=own[toIndex(x,y)];}if(alive/(stones.length*playouts)<.3)dead.push(...stones);}
  return dead;
}
// Casual opponent: Monte Carlo search with a time budget, so slower devices play a little weaker.
export const GO_THINK_MS=250;
export function chooseGoMove(game,{ms=GO_THINK_MS,playouts=Infinity,random=Math.random}={}){
  if(game.phase!=='play')return null;
  const b=flatten(game),candidates=game.legalMoves().filter(({r,c})=>!isEye(b,toIndex(r,c),game.turn));
  if(!candidates.length)return {pass:true};
  const opponentPassed=game.history.at(-1)?.pass;
  if(opponentPassed){const margin=game.score(estimateDead(game,{playouts:120,random})).margin;if(game.turn===1?margin>0:margin<0)return {pass:true};}
  const root=search(game,candidates,{ms,playouts,random});let best=root.children[0];for(const child of root.children)if(child.N>best.N)best=child;
  // Nothing worth playing for after the opponent stopped: end the game instead of filling in.
  if(opponentPassed&&best.N&&best.W/best.N<.05)return {pass:true};
  return fromIndex(best.move);
}
export function restoreGo(moves){const game=new Go();for(const move of moves){const done=move.finish?game.finish(move.dead):move.pass?game.pass():game.move(move.r,move.c);if(!done)throw new Error('Invalid Go save');}return game;}
