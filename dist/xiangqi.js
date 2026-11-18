export const XIANGQI_NAMES={1:{k:'帅',a:'仕',e:'相',h:'马',r:'车',c:'炮',p:'兵'},2:{k:'将',a:'士',e:'象',h:'马',r:'车',c:'炮',p:'卒'}};
export const xiangqiCoordinate=(r,c)=>'ABCDEFGHI'[c]+(10-r);
const inside=(r,c)=>Number.isInteger(r)&&Number.isInteger(c)&&r>=0&&r<10&&c>=0&&c<9;
const palace=(r,c,color)=>c>=3&&c<=5&&(color===1?r>=7&&r<=9:r>=0&&r<=2);
const clone=board=>board.map(row=>row.map(piece=>piece?{...piece}:null));

export class Xiangqi {
  constructor(){
    this.board=Array.from({length:10},()=>Array(9).fill(null));
    const back=['r','h','e','a','k','a','e','h','r'];
    for(const color of [1,2]){const r=color===1?9:0;back.forEach((type,c)=>{this.board[r][c]={type,color};});for(const c of [1,7])this.board[color===1?7:2][c]={type:'c',color};for(const c of [0,2,4,6,8])this.board[color===1?6:3][c]={type:'p',color};}
    this.turn=1;this.winner=null;this.reason='';this.history=[];this.snapshots=[];this.winning=[];this.halfMoves=0;this.positions=[this.key()];
  }
  static fromPieces(pieces,turn=1){const game=new Xiangqi();game.board=Array.from({length:10},()=>Array(9).fill(null));for(const [r,c,type,color] of pieces)game.board[r][c]={type,color};game.turn=turn;game.positions=[game.key()];return game;}
  key(){return this.turn+':'+this.board.map(row=>row.map(p=>p?(p.color===1?p.type.toUpperCase():p.type):'.').join('')).join('/');}
  pseudoMoves(color=this.turn){
    const moves=[];const add=(fr,fc,r,c)=>{if(!inside(r,c)||this.board[r][c]?.color===color)return;moves.push({fr,fc,r,c,player:color,type:this.board[fr][fc].type,captured:this.board[r][c]?{...this.board[r][c]}:null});};
    for(let fr=0;fr<10;fr++)for(let fc=0;fc<9;fc++){const piece=this.board[fr][fc];if(!piece||piece.color!==color)continue;const {type}=piece;
      if(type==='r'||type==='c')for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){let screen=false;for(let r=fr+dr,c=fc+dc;inside(r,c);r+=dr,c+=dc){const target=this.board[r][c];if(type==='r'){if(target){add(fr,fc,r,c);break;}add(fr,fc,r,c);}else if(!screen){if(target)screen=true;else add(fr,fc,r,c);}else if(target){add(fr,fc,r,c);break;}}}
      else if(type==='h')for(const [dr,dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]){const lr=fr+(Math.abs(dr)===2?Math.sign(dr):0),lc=fc+(Math.abs(dc)===2?Math.sign(dc):0);if(!this.board[lr]?.[lc])add(fr,fc,fr+dr,fc+dc);}
      else if(type==='e')for(const [dr,dc] of [[2,2],[2,-2],[-2,2],[-2,-2]]){const r=fr+dr;if((color===1?r>=5:r<=4)&&!this.board[fr+dr/2]?.[fc+dc/2])add(fr,fc,r,fc+dc);}
      else if(type==='a')for(const [dr,dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]){if(palace(fr+dr,fc+dc,color))add(fr,fc,fr+dr,fc+dc);}
      else if(type==='k'){
        for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]])if(palace(fr+dr,fc+dc,color))add(fr,fc,fr+dr,fc+dc);
        for(const dr of [-1,1])for(let r=fr+dr;inside(r,fc);r+=dr){const target=this.board[r][fc];if(target){if(target.type==='k'&&target.color!==color)add(fr,fc,r,fc);break;}}
      }else if(type==='p'){add(fr,fc,fr+(color===1?-1:1),fc);if(color===1?fr<=4:fr>=5){add(fr,fc,fr,fc-1);add(fr,fc,fr,fc+1);}}
    }return moves;
  }
  isInCheck(color=this.turn){let king=null;for(let r=0;r<10;r++)for(let c=0;c<9;c++)if(this.board[r][c]?.color===color&&this.board[r][c].type==='k')king={r,c};if(!king)return true;return this.pseudoMoves(3-color).some(move=>move.r===king.r&&move.c===king.c);}
  temporary(move,callback){const moving=this.board[move.fr][move.fc],captured=this.board[move.r][move.c],turn=this.turn;this.board[move.r][move.c]=moving;this.board[move.fr][move.fc]=null;this.turn=3-move.player;try{return callback();}finally{this.board[move.fr][move.fc]=moving;this.board[move.r][move.c]=captured;this.turn=turn;}}
  legalMoves(color=this.turn){if(this.winner!==null)return [];return this.pseudoMoves(color).filter(move=>move.captured?.type!=='k'&&this.temporary(move,()=>!this.isInCheck(color)));}
  move(fr,fc,r,c){
    if(!inside(fr,fc)||!inside(r,c)||this.winner!==null)return false;
    const move=this.legalMoves().find(m=>m.fr===fr&&m.fc===fc&&m.r===r&&m.c===c);if(!move)return false;
    this.snapshots.push({board:clone(this.board),turn:this.turn,winner:this.winner,reason:this.reason,halfMoves:this.halfMoves});
    this.board[r][c]=this.board[fr][fc];this.board[fr][fc]=null;this.turn=3-this.turn;this.halfMoves=move.captured?0:this.halfMoves+1;
    move.fromCell={r:fr,c:fc};move.check=this.isInCheck();move.label=XIANGQI_NAMES[move.player][move.type]+' '+xiangqiCoordinate(fr,fc)+(move.captured?'×':'→')+xiangqiCoordinate(r,c)+(move.check?' 将军':'');this.history.push(move);this.positions.push(this.key());
    if(!this.legalMoves().length){this.winner=move.player;this.reason=move.check?'将死':'困毙';}
    else if(!this.board.flat().some(p=>p&&['r','h','c','p'].includes(p.type))){this.winner=0;this.reason='双方均无进攻子力';}
    else if(this.halfMoves>=120){this.winner=0;this.reason='连续 120 手未吃子';}
    else{const key=this.key(),repeats=this.positions.reduce((all,k,i)=>k===key?[...all,i]:all,[]);if(repeats.length>=3){const cycle=this.history.slice(repeats.at(-3)),checks=[1,2].map(player=>{const own=cycle.filter(m=>m.player===player);return own.length>0&&own.every(m=>m.check);});if(checks[0]!==checks[1]){this.winner=checks[0]?2:1;this.reason='单方长将判负';}else{this.winner=0;this.reason='同局面三次重复';}}}
    return move;
  }
  undo(){const snapshot=this.snapshots.pop();if(!snapshot)return false;Object.assign(this,snapshot);this.history.pop();this.positions.pop();return true;}
}

const values={k:20000,r:900,h:410,c:450,e:200,a:200,p:100};
function evaluate(game,player){let score=0;for(let r=0;r<10;r++)for(let c=0;c<9;c++){const piece=game.board[r][c];if(!piece)continue;const crossed=piece.color===1?r<=4:r>=5;const advancement=piece.color===1?9-r:r;const positional=piece.type==='p'?(crossed?80:0)+advancement*9:['h','c','r'].includes(piece.type)?(4-Math.abs(c-4))*5+advancement*2:0;score+=(values[piece.type]+positional)*(piece.color===player?1:-1);}return score;}
function chooseXiangqiCasual(game){
  const player=game.turn,moves=game.legalMoves().sort((a,b)=>(values[b.captured?.type]||0)-(values[a.captured?.type]||0));let best=-Infinity,chosen=null;
  for(const move of moves){const value=game.temporary(move,()=>{const replies=game.legalMoves();if(!replies.length)return 100000;let worst=Infinity;for(const reply of replies){const score=game.temporary(reply,()=>evaluate(game,player));worst=Math.min(worst,score);if(worst<best)break;}return worst+(game.isInCheck()?8:0);});if(value>best){best=value;chosen=move;}}
  return chosen;
}
const AI_LEVEL_ORDER=['easy','casual','advanced','serious'];
const XQ_TIMEOUT=Symbol('xq-ai-timeout');
const xqNow=()=>typeof performance!=='undefined'?performance.now():Date.now();
const xqLevelOf=options=>AI_LEVEL_ORDER.includes(options?.level)?options.level:'casual';
function xqBudget(options={},defaultMs=Infinity){
  const timeMs=Number.isFinite(options.timeMs)?options.timeMs:defaultMs;
  const nodeLimit=Number.isFinite(options.nodeLimit)?options.nodeLimit:Infinity;
  const deadline=timeMs===Infinity?Infinity:xqNow()+timeMs;
  let nodes=0;
  return {check(){nodes++;if(nodes>nodeLimit)throw XQ_TIMEOUT;if((nodes&63)===0&&deadline!==Infinity&&xqNow()>deadline)throw XQ_TIMEOUT;}};
}
const XQ_MATE=1000000;
function orderXqMoves(moves,previous=null,width=Infinity){
  const ordered=[...moves].sort((a,b)=>(values[b.captured?.type]||0)-(values[a.captured?.type]||0));
  if(previous){const i=ordered.findIndex(m=>m.fr===previous.fr&&m.fc===previous.fc&&m.r===previous.r&&m.c===previous.c);if(i>0)ordered.unshift(ordered.splice(i,1)[0]);}
  return width===Infinity?ordered:ordered.slice(0,width);
}
function xqMoves(game,previous=null,width=Infinity){return orderXqMoves(game.legalMoves(),previous,width);}
function chooseXiangqiEasy(game,options){
  const player=game.turn,random=options.random||Math.random,moves=xqMoves(game);
  if(!moves.length)return null;
  const scored=[];
  for(const move of moves){const value=game.temporary(move,()=>game.legalMoves().length?evaluate(game,player):XQ_MATE);scored.push({move,value});}
  const mates=scored.filter(x=>x.value>=XQ_MATE);if(mates.length)return mates[0].move;
  scored.sort((a,b)=>b.value-a.value);const top=scored.slice(0,4);
  return (top[Math.floor(random()*top.length)]||scored[0]).move;
}
function xqQuiescence(game,alpha,beta,budget,ply,qDepth){
  budget.check();
  const moves=game.legalMoves();
  if(!moves.length)return -XQ_MATE+ply;
  let stand=evaluate(game,game.turn);
  if(qDepth>=4)return stand;
  if(stand>=beta)return beta;
  if(stand>alpha)alpha=stand;
  const inCheck=game.isInCheck(game.turn);
  const captures=inCheck?moves:moves.filter(move=>move.captured);
  for(const move of captures){
    const value=game.temporary(move,()=>-xqQuiescence(game,-beta,-alpha,budget,ply+1,qDepth+1));
    if(value>=beta)return beta;
    if(value>alpha)alpha=value;
  }
  return alpha;
}
function xqSearch(game,depth,player,alpha,beta,budget,ply,widths){
  budget.check();
  const moves=game.legalMoves();
  if(!moves.length)return -XQ_MATE+ply;
  if(depth<=0)return xqQuiescence(game,alpha,beta,budget,ply,0);
  const width=widths?widths[Math.min(ply,widths.length-1)]:Infinity;
  const ordered=orderXqMoves(moves,null,width);
  let best=-Infinity;
  for(const move of ordered){
    const value=game.temporary(move,()=>-xqSearch(game,depth-1,3-player,-beta,-alpha,budget,ply+1,widths));
    if(value>best)best=value;
    if(value>alpha)alpha=value;
    if(alpha>=beta)break;
  }
  return best;
}
function xqRoot(game,depth,player,budget,previous,widths){
  const width=widths?widths[0]:Infinity;
  const moves=xqMoves(game,previous,width);
  let bestMove=null,bestScore=-Infinity,alpha=-Infinity;
  for(const move of moves){
    budget.check();
    const value=game.temporary(move,()=>{
      const replies=game.legalMoves();
      if(!replies.length)return XQ_MATE-1;
      return -xqSearch(game,depth-1,3-player,-Infinity,-alpha,budget,1,widths);
    });
    if(value>bestScore){bestScore=value;bestMove=move;}
    if(value>alpha)alpha=value;
  }
  return bestMove?{move:bestMove,score:bestScore}:null;
}
function chooseXiangqiSearch(game,maxDepth,options,widths){
  const player=game.turn;
  let bestMove=xqMoves(game)[0]||null;
  if(!bestMove)return null;
  const budget=xqBudget(options,maxDepth>=3?200:120);
  for(let depth=1;depth<=maxDepth;depth++){
    try{const result=xqRoot(game,depth,player,budget,bestMove,widths);if(result)bestMove=result.move;}
    catch(error){if(error!==XQ_TIMEOUT)throw error;break;}
  }
  return bestMove;
}
export function chooseXiangqiMove(game,options={}){
  const level=xqLevelOf(options);
  if(level==='easy')return chooseXiangqiEasy(game,options);
  if(level==='advanced')return chooseXiangqiSearch(game,2,options,undefined);
  if(level==='serious')return chooseXiangqiSearch(game,3,options,[16,12,8]);
  return chooseXiangqiCasual(game);
}
export function restoreXiangqi(moves){const game=new Xiangqi();for(const move of moves)if(!game.move(move.fr,move.fc,move.r,move.c))throw new Error('Invalid Xiangqi save');return game;}
