import { Chess } from './vendor/chess.js';

export const PUZZLE_FEN = '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1';
const directions = [[1,0],[0,1],[1,1],[1,-1]];
const allDirections = [...directions,...directions.map(([r,c])=>[-r,-c])];
const inside = (r,c,n) => r>=0&&c>=0&&r<n&&c<n;
export const coordinate = (r,c,n) => `${'ABCDEFGHIJKLMNOP'.charAt(c)}${n-r}`;

export class GridGame {
  constructor(kind) {
    this.kind=kind;this.size=kind==='gomoku'?15:kind==='reversi'?8:3;
    this.board=Array.from({length:this.size},()=>Array(this.size).fill(0));
    this.turn=1;this.winner=null;this.history=[];this.snapshots=[];this.winning=[];
    if(kind==='reversi'){this.board[3][3]=this.board[4][4]=2;this.board[3][4]=this.board[4][3]=1;}
  }
  flips(r,c,player=this.turn) {
    if(!inside(r,c,this.size)||this.board[r][c])return [];
    const result=[];
    for(const [dr,dc] of allDirections){const line=[];let nr=r+dr,nc=c+dc;while(inside(nr,nc,this.size)&&this.board[nr][nc]===3-player){line.push([nr,nc]);nr+=dr;nc+=dc;}if(line.length&&inside(nr,nc,this.size)&&this.board[nr][nc]===player)result.push(...line);}
    return result;
  }
  legalMoves(player=this.turn){
    if(this.winner!==null)return [];
    const result=[];for(let r=0;r<this.size;r++)for(let c=0;c<this.size;c++)if(!this.board[r][c]&&(this.kind!=='reversi'||this.flips(r,c,player).length))result.push({r,c});return result;
  }
  move(r,c){
    if(this.winner!==null||!inside(r,c,this.size)||this.board[r][c])return false;
    const flips=this.kind==='reversi'?this.flips(r,c):[];
    if(this.kind==='reversi'&&!flips.length)return false;
    this.snapshots.push({board:this.board.map(row=>[...row]),turn:this.turn,winner:this.winner,winning:[...this.winning]});
    const player=this.turn;this.board[r][c]=player;for(const [fr,fc] of flips)this.board[fr][fc]=player;
    const record={r,c,player,label:coordinate(r,c,this.size),flips:flips.length,flipped:flips.map(([r,c])=>({r,c}))};this.history.push(record);
    if(this.kind==='reversi'){
      this.turn=3-player;
      if(!this.legalMoves().length){this.turn=player;record.pass=true;if(!this.legalMoves().length){const [black,white]=this.score();this.winner=black===white?0:black>white?1:2;}}
    }else{
      const needed=this.kind==='gomoku'?5:3;
      for(const [dr,dc] of directions){const line=[[r,c]];for(const sign of [-1,1]){let nr=r+dr*sign,nc=c+dc*sign;while(inside(nr,nc,this.size)&&this.board[nr][nc]===player){line.push([nr,nc]);nr+=dr*sign;nc+=dc*sign;}}if(line.length>=needed){this.winner=player;this.winning=line;break;}}
      if(this.winner===null&&this.board.every(row=>row.every(Boolean)))this.winner=0;
      this.turn=3-player;
    }
    return record;
  }
  undo(){const previous=this.snapshots.pop();if(!previous)return false;Object.assign(this,previous);this.history.pop();return true;}
  score(){return [this.board.flat().filter(x=>x===1).length,this.board.flat().filter(x=>x===2).length];}
}

function gomokuValue(game,r,c,player){
  let score=0;
  for(const [dr,dc] of directions){let count=1,open=0;for(const sign of [-1,1]){let nr=r+dr*sign,nc=c+dc*sign;while(inside(nr,nc,game.size)&&game.board[nr][nc]===player){count++;nr+=dr*sign;nc+=dc*sign;}if(inside(nr,nc,game.size)&&game.board[nr][nc]===0)open++;}if(count>=5)score+=1000000;else if(count===4)score+=open===2?50000:open===1?9000:0;else if(count===3)score+=open===2?3500:open===1?150:0;else if(count===2)score+=open===2?100:open===1?20:0;else score+=open*2;}
  return score;
}
const AI_LEVEL_ORDER=['easy','casual','advanced','serious'];
const TIMEOUT=Symbol('ai-timeout');
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
const aiLevelOf=options=>AI_LEVEL_ORDER.includes(options?.level)?options.level:'casual';
function makeBudget(options={},defaultMs=Infinity){
  const timeMs=Number.isFinite(options.timeMs)?options.timeMs:defaultMs;
  const nodeLimit=Number.isFinite(options.nodeLimit)?options.nodeLimit:Infinity;
  const deadline=timeMs===Infinity?Infinity:now()+timeMs;
  let nodes=0;
  return {check(){nodes++;if(nodes>nodeLimit)throw TIMEOUT;if((nodes&63)===0&&deadline!==Infinity&&now()>deadline)throw TIMEOUT;}};
}
const GOMOKU_MATE=1000000;
function gomokuWinningCells(game,player){
  const cells=[];
  for(let r=0;r<game.size;r++)for(let c=0;c<game.size;c++)if(!game.board[r][c]&&gomokuValue(game,r,c,player)>=GOMOKU_MATE)cells.push({r,c});
  return cells;
}
function gomokuNearby(game,r,c){
  for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
    const nr=r+dr,nc=c+dc;
    if(inside(nr,nc,game.size)&&game.board[nr][nc])return true;
  }
  return false;
}
function gomokuRankedMoves(game,limit=Infinity){
  const cells=[];
  for(let r=0;r<game.size;r++)for(let c=0;c<game.size;c++){
    if(game.board[r][c]||!gomokuNearby(game,r,c))continue;
    const attack=gomokuValue(game,r,c,game.turn),defense=gomokuValue(game,r,c,3-game.turn);
    cells.push({r,c,attack,defense,value:attack>=GOMOKU_MATE?1e9:defense>=GOMOKU_MATE?1e8:attack+defense*.95+7-Math.abs(7-r)*.2-Math.abs(7-c)*.2});
  }
  cells.sort((a,b)=>b.value-a.value);
  return limit===Infinity?cells:cells.slice(0,limit);
}
function gomokuPositionScore(game,player){
  let attack=0,defense=0;
  for(let r=0;r<game.size;r++)for(let c=0;c<game.size;c++){
    if(game.board[r][c]||!gomokuNearby(game,r,c))continue;
    attack=Math.max(attack,gomokuValue(game,r,c,player));
    defense=Math.max(defense,gomokuValue(game,r,c,3-player));
  }
  if(attack>=GOMOKU_MATE)return GOMOKU_MATE;
  if(defense>=GOMOKU_MATE)return -GOMOKU_MATE;
  return attack-defense*.95;
}
function gomokuSearch(game,depth,player,budget,widths,ply){
  budget.check();
  if(game.winner!==null)return game.winner===0?0:game.winner===player?GOMOKU_MATE-ply:-GOMOKU_MATE+ply;
  if(depth<=0)return gomokuPositionScore(game,player);
  const moves=gomokuRankedMoves(game,widths[Math.min(ply,widths.length-1)]||widths.at(-1));
  if(!moves.length)return gomokuPositionScore(game,player);
  let best=-Infinity;
  for(const move of moves){
    if(!game.move(move.r,move.c))continue;
    let value;
    try{value=-gomokuSearch(game,depth-1,3-player,budget,widths,ply+1);}
    finally{game.undo();}
    if(value>best)best=value;
  }
  return best;
}
function chooseGomokuSearch(game,depth,widths,options,defaultMs){
  const player=game.turn;
  const wins=gomokuWinningCells(game,player);if(wins.length)return wins[0];
  const blocks=gomokuWinningCells(game,3-player);
  if(blocks.length){let best=blocks[0],bestValue=-Infinity;for(const move of blocks){const value=gomokuValue(game,move.r,move.c,player);if(value>bestValue){bestValue=value;best=move;}}return best;}
  const roots=gomokuRankedMoves(game,widths[0]);if(!roots.length)return game.legalMoves()[0]||null;
  const budget=makeBudget(options,defaultMs);
  let bestMove=roots[0],bestScore=-Infinity,timedOut=false;
  for(const move of roots){
    if(game.board[move.r][move.c])continue;
    let moved=false,value;
    try{
      budget.check();
      if(!game.move(move.r,move.c))continue;
      moved=true;
      if(game.winner!==null)value=game.winner===0?0:game.winner===player?GOMOKU_MATE:-GOMOKU_MATE;
      else value=-gomokuSearch(game,depth-1,3-player,budget,widths,1);
    }catch(error){if(error!==TIMEOUT)throw error;timedOut=true;}
    finally{if(moved)game.undo();}
    if(value!==undefined&&value>bestScore){bestScore=value;bestMove=move;}
    if(timedOut)break;
  }
  return bestMove;
}
function chooseGomokuEasy(game,options){
  const random=options.random||Math.random;
  const wins=gomokuWinningCells(game,game.turn);if(wins.length)return wins[0];
  const moves=gomokuRankedMoves(game);
  if(!moves.length)return game.legalMoves()[0]||null;
  for(const move of moves)move.value=move.attack>=GOMOKU_MATE?1e9:move.attack+move.defense*.55+7-Math.abs(7-move.r)*.2-Math.abs(7-move.c)*.2;
  moves.sort((a,b)=>b.value-a.value);
  const top=moves.slice(0,5);
  return top[Math.floor(random()*top.length)]||moves[0];
}
function minimaxTTT(game,player){
  if(game.winner!==null)return game.winner===0?0:game.winner===player?10:-10;
  const maximize=game.turn===player;let best=maximize?-Infinity:Infinity;
  for(const {r,c} of game.legalMoves()){game.move(r,c);const value=minimaxTTT(game,player);game.undo();best=maximize?Math.max(best,value):Math.min(best,value);}return best;
}
export function chooseGridMove(game,options={}){
  const moves=game.legalMoves();if(!moves.length)return null;
  const level=aiLevelOf(options);
  if(game.kind==='tictactoe'){
    let best=-Infinity,chosen=moves[0];const player=game.turn;
    // Center and corners make equal-value openings feel intentional.
    moves.sort((a,b)=>(a.r===1&&a.c===1?-1:0)-(b.r===1&&b.c===1?-1:0));
    for(const move of moves){game.move(move.r,move.c);const value=minimaxTTT(game,player);game.undo();if(value>best){best=value;chosen=move;}}return chosen;
  }
  if(game.kind==='reversi'){
    let best=-Infinity,chosen=moves[0];const player=game.turn;
    for(const move of moves){const {r,c}=move;const corner=(r===0||r===7)&&(c===0||c===7);const danger=([0,1].includes(r)&&[0,1].includes(c)&&!game.board[0][0])||([0,1].includes(r)&&[6,7].includes(c)&&!game.board[0][7])||([6,7].includes(r)&&[0,1].includes(c)&&!game.board[7][0])||([6,7].includes(r)&&[6,7].includes(c)&&!game.board[7][7]);
      const flips=game.flips(r,c).length;game.move(r,c);const mobility=game.legalMoves(3-player).length;game.undo();const value=(corner?1000:danger?-200:0)+(r===0||r===7||c===0||c===7?20:0)+flips*2-mobility*5;if(value>best){best=value;chosen=move;}}
    return chosen;
  }
  if(!game.history.length)return {r:7,c:7};
  if(level==='easy')return chooseGomokuEasy(game,options);
  if(level==='advanced')return chooseGomokuSearch(game,2,[24,12],options,80);
  if(level==='serious')return chooseGomokuSearch(game,3,[16,10,8],options,150);
  let best=-Infinity,chosen=moves[0];
  for(const move of moves){const {r,c}=move;const nearby=game.history.some(m=>Math.abs(m.r-r)<=2&&Math.abs(m.c-c)<=2);if(!nearby)continue;
    const attack=gomokuValue(game,r,c,game.turn),defense=gomokuValue(game,r,c,3-game.turn);
    const value=attack>=1000000?1e9:defense>=1000000?1e8:attack+defense*.95+7-Math.abs(7-r)*.2-Math.abs(7-c)*.2;
    if(value>best){best=value;chosen=move;}
  }return chosen;
}

export function createChess(puzzle=false){return new Chess(puzzle?PUZZLE_FEN:undefined);}
const pieceValues={p:100,n:320,b:330,r:500,q:900,k:0};
function evaluateChess(chess,player){
  if(chess.isCheckmate())return chess.turn()===player?-100000:100000;
  if(chess.isDraw())return 0;
  let score=0;
  for(const [r,row] of chess.board().entries())for(const [c,piece] of row.entries())if(piece){const central=3.5-(Math.abs(3.5-r)+Math.abs(3.5-c))/2;const advancement=piece.type==='p'?(piece.color==='w'?6-r:r-1)*5:0;score+=(pieceValues[piece.type]+central*(piece.type==='n'?12:4)+advancement)*(piece.color===player?1:-1);}return score;
}
function chooseChessCasual(chess){
  const player=chess.turn();const moves=chess.moves({verbose:true}).sort((a,b)=>(pieceValues[b.captured]||0)-(pieceValues[a.captured]||0));
  let best=-Infinity,choice=null;
  for(const move of moves){chess.move(move);let value=evaluateChess(chess,player);
    if(!chess.isGameOver()){let worst=Infinity;for(const reply of chess.moves()){chess.move(reply);worst=Math.min(worst,evaluateChess(chess,player));chess.undo();}value=worst;}
    chess.undo();if(value>best){best=value;choice=move;}
  }return choice;
}
const CHESS_MATE=1000000;
function chessMoves(chess,previous=null){
  const moves=chess.moves({verbose:true}).sort((a,b)=>(pieceValues[b.captured]||0)-(pieceValues[a.captured]||0));
  if(previous){const i=moves.findIndex(m=>m.from===previous.from&&m.to===previous.to&&(m.promotion||'')===(previous.promotion||''));if(i>0)moves.unshift(moves.splice(i,1)[0]);}
  return moves;
}
function chooseChessEasy(chess,options){
  const player=chess.turn(),moves=chessMoves(chess),scored=[];
  for(const move of moves){
    chess.move(move);
    let value;
    try{value=chess.isCheckmate()?CHESS_MATE:evaluateChess(chess,player);}
    finally{chess.undo();}
    scored.push({move,value});
  }
  const mates=scored.filter(x=>x.value>=CHESS_MATE);if(mates.length)return mates[0].move;
  scored.sort((a,b)=>b.value-a.value);const top=scored.slice(0,4),random=options.random||Math.random;
  return (top[Math.floor(random()*top.length)]||scored[0])?.move||null;
}
function chessQuiescence(chess,alpha,beta,budget,ply,qDepth){
  budget.check();
  const stand=evaluateChess(chess,chess.turn());
  if(qDepth>=4)return stand;
  if(stand>=beta)return beta;
  if(stand>alpha)alpha=stand;
  const inCheck=chess.isCheck();
  const moves=chess.moves({verbose:true}).filter(move=>inCheck||move.captured);
  for(const move of moves){
    chess.move(move);
    let value;
    try{value=-chessQuiescence(chess,-beta,-alpha,budget,ply+1,qDepth+1);}
    finally{chess.undo();}
    if(value>=beta)return beta;
    if(value>alpha)alpha=value;
  }
  return alpha;
}
function chessSearch(chess,depth,player,alpha,beta,budget,ply){
  budget.check();
  if(chess.isCheckmate())return -CHESS_MATE+ply;
  if(chess.isDraw())return 0;
  if(depth<=0)return chessQuiescence(chess,alpha,beta,budget,ply,0);
  const moves=chessMoves(chess);
  let best=-Infinity;
  for(const move of moves){
    chess.move(move);
    let value;
    try{value=-chessSearch(chess,depth-1,3-player,-beta,-alpha,budget,ply+1);}
    finally{chess.undo();}
    if(value>best)best=value;
    if(value>alpha)alpha=value;
    if(alpha>=beta)break;
  }
  return best;
}
function chessRoot(chess,depth,player,budget,previous){
  const moves=chessMoves(chess,previous);
  let bestMove=null,bestScore=-Infinity,alpha=-Infinity;
  for(const move of moves){
    budget.check();
    chess.move(move);
    let value;
    try{
      if(chess.isCheckmate())value=CHESS_MATE-1;
      else if(chess.isDraw())value=0;
      else value=-chessSearch(chess,depth-1,3-player,-Infinity,-alpha,budget,1);
    }finally{chess.undo();}
    if(value>bestScore){bestScore=value;bestMove=move;}
    if(value>alpha)alpha=value;
  }
  return bestMove?{move:bestMove,score:bestScore}:null;
}
function chooseChessSearch(chess,maxDepth,options){
  const player=chess.turn(),roots=chessMoves(chess);
  if(!roots.length)return null;
  const budget=makeBudget(options,maxDepth>=3?200:120);
  let bestMove=roots[0];
  for(let depth=1;depth<=maxDepth;depth++){
    try{const result=chessRoot(chess,depth,player,budget,bestMove);if(result)bestMove=result.move;}
    catch(error){if(error!==TIMEOUT)throw error;break;}
  }
  return bestMove;
}
export function chooseChessMove(chess,options={}){
  const level=aiLevelOf(options);
  if(level==='easy')return chooseChessEasy(chess,options);
  if(level==='advanced')return chooseChessSearch(chess,2,options);
  if(level==='serious')return chooseChessSearch(chess,3,options);
  return chooseChessCasual(chess);
}

export function restoreGrid(kind,moves){const game=new GridGame(kind);for(const move of moves){if(!game.move(move.r,move.c))throw new Error('Invalid saved move');}return game;}
