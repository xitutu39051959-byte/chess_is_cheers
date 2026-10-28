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
function minimaxTTT(game,player){
  if(game.winner!==null)return game.winner===0?0:game.winner===player?10:-10;
  const maximize=game.turn===player;let best=maximize?-Infinity:Infinity;
  for(const {r,c} of game.legalMoves()){game.move(r,c);const value=minimaxTTT(game,player);game.undo();best=maximize?Math.max(best,value):Math.min(best,value);}return best;
}
export function chooseGridMove(game){
  const moves=game.legalMoves();if(!moves.length)return null;
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
export function chooseChessMove(chess){
  const player=chess.turn();const moves=chess.moves({verbose:true}).sort((a,b)=>(pieceValues[b.captured]||0)-(pieceValues[a.captured]||0));
  let best=-Infinity,choice=null;
  for(const move of moves){chess.move(move);let value=evaluateChess(chess,player);
    if(!chess.isGameOver()){let worst=Infinity;for(const reply of chess.moves()){chess.move(reply);worst=Math.min(worst,evaluateChess(chess,player));chess.undo();}value=worst;}
    chess.undo();if(value>best){best=value;choice=move;}
  }return choice;
}

export function restoreGrid(kind,moves){const game=new GridGame(kind);for(const move of moves){if(!game.move(move.r,move.c))throw new Error('Invalid saved move');}return game;}
