export const TIAOQI_SIZE=17,TIAOQI_PIECES=10;
// The star is stored as axial coordinates in a 17×17 array; points outside it are null.
export const isHole=(r,c)=>{if(!Number.isInteger(r)||!Number.isInteger(c)||r<0||c<0||r>=TIAOQI_SIZE||c>=TIAOQI_SIZE)return false;const a=c-8,b=r-8,d=-a-b;return (a<=4&&b<=4&&d<=4)||(a>=-4&&b>=-4&&d>=-4);};
// Player 1 starts in the bottom point and heads for the top one; player 2 the reverse.
export const homeOwner=(r,c)=>!isHole(r,c)?0:r>=13?1:r<=3?2:0;
const targetOf=player=>3-player;
export const TIAOQI_HOLES=[];for(let r=0;r<TIAOQI_SIZE;r++)for(let c=0;c<TIAOQI_SIZE;c++)if(isHole(r,c))TIAOQI_HOLES.push([r,c]);
const DIRECTIONS=[[0,1],[0,-1],[1,0],[-1,0],[1,-1],[-1,1]];
// Screen position relative to the board centre, in units of one hole spacing.
export const tiaoqiXY=(r,c)=>({x:c+r/2-12,y:(r-8)*Math.sqrt(3)/2});
export const TIAOQI_EDGES=TIAOQI_HOLES.flatMap(([r,c])=>[[0,1],[1,0],[1,-1]].filter(([dr,dc])=>isHole(r+dr,c+dc)).map(([dr,dc])=>[r,c,r+dr,c+dc]));
const rowStart=Array.from({length:TIAOQI_SIZE},(_,r)=>TIAOQI_HOLES.find(h=>h[0]===r)[1]);
// Rows are lettered from the bottom point, and holes numbered from the left of each row.
export const tiaoqiCoordinate=(r,c)=>'ABCDEFGHIJKLMNOPQ'[TIAOQI_SIZE-1-r]+(c-rowStart[r]+1);
const targetHoles=player=>TIAOQI_HOLES.filter(([r,c])=>homeOwner(r,c)===targetOf(player));
const TARGETS={1:targetHoles(1),2:targetHoles(2)};

export class Tiaoqi {
  constructor(){
    this.board=Array.from({length:TIAOQI_SIZE},(_,r)=>Array.from({length:TIAOQI_SIZE},(_,c)=>isHole(r,c)?homeOwner(r,c):null));
    this.turn=1;this.winner=null;this.reason='';this.winning=[];this.history=[];this.positions=[this.key()];
  }
  static fromPieces(pieces,turn=1){const game=new Tiaoqi();game.board=game.board.map(row=>row.map(v=>v===null?null:0));for(const [r,c,color] of pieces)game.board[r][c]=color;game.turn=turn;game.positions=[game.key()];return game;}
  key(){return this.turn+':'+TIAOQI_HOLES.map(([r,c])=>this.board[r][c]).join('');}
  arrived(player){let own=0;for(const [r,c] of TARGETS[player]){const v=this.board[r][c];if(!v)return false;if(v===player)own++;}return own>0;}
  progress(player){return TARGETS[player].filter(([r,c])=>this.board[r][c]===player).length;}
  // Every landing point for one piece. Hops chain from the piece's new position, and it may stop after any of them.
  destinations(fr,fc){
    const found=[],color=this.board[fr][fc],seen=new Set([fr+','+fc]);
    for(const [dr,dc] of DIRECTIONS){const r=fr+dr,c=fc+dc;if(isHole(r,c)&&!this.board[r][c])found.push({r,c,hops:0,path:[[fr,fc],[r,c]]});}
    // The moving piece has left its start, so it cannot be hopped over and its hole can be crossed.
    this.board[fr][fc]=0;const queue=[{r:fr,c:fc,path:[[fr,fc]]}];
    while(queue.length){const at=queue.shift();for(const [dr,dc] of DIRECTIONS){const over=[at.r+dr,at.c+dc],r=at.r+dr*2,c=at.c+dc*2;if(!isHole(r,c)||!isHole(...over)||!this.board[over[0]][over[1]]||this.board[r][c]||seen.has(r+','+c))continue;seen.add(r+','+c);const path=[...at.path,[r,c]];found.push({r,c,hops:path.length-1,path});queue.push({r,c,path});}}
    this.board[fr][fc]=color;return found;
  }
  legalMoves(color=this.turn){
    if(this.winner!==null)return [];
    const moves=[];for(const [fr,fc] of TIAOQI_HOLES)if(this.board[fr][fc]===color)for(const to of this.destinations(fr,fc))moves.push({fr,fc,...to,player:color});
    return moves;
  }
  move(fr,fc,r,c){
    if(!isHole(fr,fc)||!isHole(r,c)||this.winner!==null||this.board[fr][fc]!==this.turn)return false;
    const to=this.destinations(fr,fc).find(m=>m.r===r&&m.c===c);if(!to)return false;
    const player=this.turn,move={fr,fc,...to,player,fromCell:{r:fr,c:fc},previous:{reason:this.reason},label:tiaoqiCoordinate(fr,fc)+(to.hops?'⤴':'→')+tiaoqiCoordinate(r,c)+(to.hops>1?` · ${to.hops} 连跳`:'')};
    this.board[r][c]=player;this.board[fr][fc]=0;this.turn=3-player;this.history.push(move);this.positions.push(this.key());
    // Checking the other side too means a player cannot stop a win by keeping or moving pieces back into their own home.
    const arrived=this.arrived(player)?player:this.arrived(3-player)?3-player:0;
    if(arrived){this.winner=arrived;this.reason=this.progress(arrived)===TIAOQI_PIECES?'全部棋子到达对角':'对角已被占满';this.winning=TARGETS[arrived].filter(([a,b])=>this.board[a][b]===arrived);}
    else if(!this.legalMoves().length){this.winner=player;this.reason='对方无子可动';}
    else if(this.positions.filter(k=>k===this.positions.at(-1)).length>=3){this.winner=0;this.reason='同局面三次重复';}
    else if(this.history.length>=400){this.winner=0;this.reason='双方合计 400 手仍未分胜负';}
    return move;
  }
  undo(){const move=this.history.pop();if(!move)return false;this.board[move.fr][move.fc]=move.player;this.board[move.r][move.c]=0;this.turn=move.player;this.winner=null;this.reason=move.previous.reason;this.winning=[];this.positions.pop();return true;}
}

const hexDistance=(r,c,a,b)=>{const dr=r-a,dc=c-b;return Math.max(Math.abs(dr),Math.abs(dc),Math.abs(dr+dc));};
const TIPS={1:[0,12],2:[16,4]};
const toTip=player=>Array.from({length:TIAOQI_SIZE},(_,r)=>Array.from({length:TIAOQI_SIZE},(_,c)=>isHole(r,c)?hexDistance(r,c,...TIPS[player]):0));
const DISTANCE={1:toTip(1),2:toTip(2)};
const WIN=1000000;
// The ten holes nearest the far tip are exactly the target, so summed distance bottoms out only when it is filled.
// Squaring pulls stragglers along; the nearest-empty term steers the last pieces sideways onto an open hole.
function sideScore(game,player){
  const distance=DISTANCE[player],empties=TARGETS[player].filter(([r,c])=>!game.board[r][c]);let cost=0;
  for(const [r,c] of TIAOQI_HOLES){if(game.board[r][c]!==player)continue;const d=distance[r][c];cost+=d*20+d*d;if(homeOwner(r,c)!==targetOf(player)&&empties.length){let near=99;for(const [a,b] of empties){const gap=hexDistance(r,c,a,b);if(gap<near)near=gap;}cost+=near*4;}}
  return -cost;
}
const evaluate=(game,player)=>sideScore(game,player)-sideScore(game,3-player);
const gain=m=>DISTANCE[m.player][m.fr][m.fc]-DISTANCE[m.player][m.r][m.c];
const ordered=(moves,limit)=>moves.sort((a,b)=>gain(b)-gain(a)).slice(0,limit);
function apply(game,move){game.board[move.fr][move.fc]=0;game.board[move.r][move.c]=move.player;game.turn=3-move.player;return ()=>{game.board[move.r][move.c]=0;game.board[move.fr][move.fc]=move.player;game.turn=move.player;};}
function search(game,depth,alpha,beta){
  const player=game.turn;
  if(!depth)return evaluate(game,player);
  const moves=ordered(game.legalMoves(player),TIAOQI_WIDTH);if(!moves.length)return -WIN-depth;
  let best=-Infinity;
  for(const move of moves){
    const restore=apply(game,move),value=game.arrived(player)?WIN+depth:game.arrived(3-player)?-WIN-depth:-search(game,depth-1,-beta,-alpha);restore();
    if(value>best)best=value;if(best>alpha)alpha=best;if(alpha>=beta)break;
  }return best;
}
export const TIAOQI_DEPTH=4,TIAOQI_WIDTH=18;
export function chooseTiaoqiMove(game,depth=TIAOQI_DEPTH){
  const player=game.turn;let best=-Infinity,chosen=null;
  for(const move of ordered(game.legalMoves(),TIAOQI_WIDTH*2)){
    const restore=apply(game,move);let value=game.arrived(player)?WIN+depth:game.arrived(3-player)?-WIN-depth:-search(game,depth-1,-Infinity,-best);
    // Walking back into an earlier position leads to a draw by repetition, so break ties forward.
    if(Math.abs(value)<WIN/2&&game.positions.includes(game.key()))value-=60;
    restore();
    if(value>best){best=value;chosen=move;}
  }return chosen;
}
export function restoreTiaoqi(moves){const game=new Tiaoqi();for(const move of moves)if(!game.move(move.fr,move.fc,move.r,move.c))throw new Error('Invalid Tiaoqi save');return game;}
