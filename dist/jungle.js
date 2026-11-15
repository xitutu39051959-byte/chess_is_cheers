export const JUNGLE_ROWS=9,JUNGLE_COLS=7;
export const JUNGLE_ANIMALS={elephant:{name:'象',rank:8},lion:{name:'狮',rank:7},tiger:{name:'虎',rank:6},leopard:{name:'豹',rank:5},wolf:{name:'狼',rank:4},dog:{name:'狗',rank:3},cat:{name:'猫',rank:2},rat:{name:'鼠',rank:1}};
export const jungleCoordinate=(r,c)=>'ABCDEFG'[c]+(JUNGLE_ROWS-r);
const inside=(r,c)=>Number.isInteger(r)&&Number.isInteger(c)&&r>=0&&c>=0&&r<JUNGLE_ROWS&&c<JUNGLE_COLS;
const steps=[[1,0],[-1,0],[0,1],[0,-1]];
// Player 1 starts at the bottom (row 8) with the lion at the right hand; player 2 is the same layout turned 180°.
const LAYOUT=[[8,0,'tiger'],[8,6,'lion'],[7,1,'cat'],[7,5,'dog'],[6,0,'elephant'],[6,2,'wolf'],[6,4,'leopard'],[6,6,'rat']];
export const isWater=(r,c)=>r>=3&&r<=5&&(c===1||c===2||c===4||c===5);
export const denOwner=(r,c)=>c===3?(r===8?1:r===0?2:0):0;
export const trapOwner=(r,c)=>(r===8&&(c===2||c===4))||(r===7&&c===3)?1:(r===0&&(c===2||c===4))||(r===1&&c===3)?2:0;
const clone=board=>board.map(row=>row.map(piece=>piece?{...piece}:null));

export function canCapture(attacker,target,from,to){
  if(attacker.color===target.color)return false;
  // Neither side can strike across the shoreline; only a rat can be in the water.
  if(isWater(from.r,from.c)!==isWater(to.r,to.c))return false;
  // In an enemy trap an animal has rank 0: anything may take it, and it can take nothing.
  if(trapOwner(from.r,from.c)===target.color)return false;
  if(trapOwner(to.r,to.c)===attacker.color)return true;
  if(attacker.type==='rat'&&target.type==='elephant')return true;
  if(attacker.type==='elephant'&&target.type==='rat')return false;
  return JUNGLE_ANIMALS[attacker.type].rank>=JUNGLE_ANIMALS[target.type].rank;
}

export class Jungle {
  constructor(){
    this.board=Array.from({length:JUNGLE_ROWS},()=>Array(JUNGLE_COLS).fill(null));
    for(const [r,c,type] of LAYOUT){this.board[r][c]={type,color:1};this.board[JUNGLE_ROWS-1-r][JUNGLE_COLS-1-c]={type,color:2};}
    this.turn=1;this.winner=null;this.reason='';this.winning=[];this.history=[];this.snapshots=[];this.halfMoves=0;this.positions=[this.key()];
  }
  static fromPieces(pieces,turn=1){const game=new Jungle();game.board=Array.from({length:JUNGLE_ROWS},()=>Array(JUNGLE_COLS).fill(null));for(const [r,c,type,color] of pieces)game.board[r][c]={type,color};game.turn=turn;game.positions=[game.key()];return game;}
  key(){return this.turn+':'+this.board.map(row=>row.map(p=>p?p.color+p.type[0]+p.type[1]:'.').join('')).join('/');}
  destination(fr,fc,dr,dc){
    const piece=this.board[fr][fc];let r=fr+dr,c=fc+dc;if(!inside(r,c))return null;
    if(isWater(r,c)){
      if(piece.type==='rat')return {r,c};
      if(piece.type!=='lion'&&piece.type!=='tiger')return null;
      // A jump is blocked by a rat of either color anywhere on the crossed water.
      while(isWater(r,c)){if(this.board[r][c])return null;r+=dr;c+=dc;}
    }
    return {r,c};
  }
  legalMoves(color=this.turn){
    if(this.winner!==null)return [];
    const moves=[];
    for(let fr=0;fr<JUNGLE_ROWS;fr++)for(let fc=0;fc<JUNGLE_COLS;fc++){const piece=this.board[fr][fc];if(piece?.color!==color)continue;
      for(const [dr,dc] of steps){const to=this.destination(fr,fc,dr,dc);if(!to||denOwner(to.r,to.c)===color)continue;const target=this.board[to.r][to.c];if(target&&!canCapture(piece,target,{r:fr,c:fc},to))continue;moves.push({fr,fc,r:to.r,c:to.c,player:color,type:piece.type,captured:target?{...target}:null});}
    }return moves;
  }
  move(fr,fc,r,c){
    if(!inside(fr,fc)||!inside(r,c)||this.winner!==null)return false;
    const move=this.legalMoves().find(m=>m.fr===fr&&m.fc===fc&&m.r===r&&m.c===c);if(!move)return false;
    this.snapshots.push({board:clone(this.board),turn:this.turn,winner:this.winner,reason:this.reason,halfMoves:this.halfMoves});
    this.board[r][c]=this.board[fr][fc];this.board[fr][fc]=null;this.turn=3-move.player;this.halfMoves=move.captured?0:this.halfMoves+1;
    move.fromCell={r:fr,c:fc};move.label=JUNGLE_ANIMALS[move.type].name+' '+jungleCoordinate(fr,fc)+(move.captured?'×':'→')+jungleCoordinate(r,c);this.history.push(move);this.positions.push(this.key());
    if(denOwner(r,c)===3-move.player){this.winner=move.player;this.reason='攻入兽穴';}
    else if(!this.board.flat().some(p=>p?.color===this.turn)){this.winner=move.player;this.reason='吃光对方动物';}
    else if(!this.legalMoves().length){this.winner=move.player;this.reason='对方无子可动';}
    else if(this.halfMoves>=100){this.winner=0;this.reason='连续 100 手未吃子';}
    else if(this.positions.filter(k=>k===this.positions.at(-1)).length>=3){this.winner=0;this.reason='同局面三次重复';}
    return move;
  }
  undo(){const snapshot=this.snapshots.pop();if(!snapshot)return false;Object.assign(this,snapshot);this.history.pop();this.positions.pop();return true;}
}

const values={elephant:1000,lion:900,tiger:800,leopard:450,wolf:350,dog:300,cat:200,rat:500};
const WIN=1000000;
function evaluate(game,player){let score=0;for(let r=0;r<JUNGLE_ROWS;r++)for(let c=0;c<JUNGLE_COLS;c++){const piece=game.board[r][c];if(!piece)continue;const den=piece.color===1?0:8,distance=Math.abs(r-den)+Math.abs(c-3);const inTrap=trapOwner(r,c)===3-piece.color;score+=(values[piece.type]-distance*8-(inTrap?values[piece.type]/3:0))*(piece.color===player?1:-1);}return score;}
// Moves mutate the board directly; game state such as history stays untouched during search.
function apply(game,move){const moving=game.board[move.fr][move.fc],captured=game.board[move.r][move.c];game.board[move.r][move.c]=moving;game.board[move.fr][move.fc]=null;game.turn=3-move.player;return ()=>{game.board[move.fr][move.fc]=moving;game.board[move.r][move.c]=captured;game.turn=move.player;};}
const ordered=moves=>moves.sort((a,b)=>(values[b.captured?.type]||0)-(values[a.captured?.type]||0));
function search(game,depth,alpha,beta){
  const player=game.turn,moves=game.legalMoves(player);
  if(!moves.length)return -WIN-depth;
  if(!depth)return evaluate(game,player);
  let best=-Infinity;
  for(const move of ordered(moves)){
    let value;
    if(denOwner(move.r,move.c)===3-player)value=WIN+depth;
    else{const restore=apply(game,move);value=-search(game,depth-1,-beta,-alpha);restore();}
    if(value>best)best=value;if(best>alpha)alpha=best;if(alpha>=beta)break;
  }return best;
}
export const JUNGLE_DEPTH=5;
export function chooseJungleMove(game,depth=JUNGLE_DEPTH){
  const player=game.turn;let best=-Infinity,chosen=null;
  for(const move of ordered(game.legalMoves())){
    let value;
    if(denOwner(move.r,move.c)===3-player)value=WIN+depth;
    else{const restore=apply(game,move);value=-search(game,depth-1,-Infinity,-best);
      // Walking back into an earlier position leads to a draw by repetition, so break ties forward.
      if(value<WIN/2&&game.positions.includes(game.key()))value-=40;
      restore();}
    if(value>best){best=value;chosen=move;}
  }return chosen;
}
export function restoreJungle(moves){const game=new Jungle();for(const move of moves)if(!game.move(move.fr,move.fc,move.r,move.c))throw new Error('Invalid Jungle save');return game;}
