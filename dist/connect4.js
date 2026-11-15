export const CONNECT4_ROWS=6,CONNECT4_COLS=7;
const directions=[[0,1],[1,0],[1,1],[1,-1]];
const centerFirst=[3,2,4,1,5,0,6];
const inside=(r,c)=>r>=0&&c>=0&&r<CONNECT4_ROWS&&c<CONNECT4_COLS;
export const connect4Coordinate=(r,c)=>'ABCDEFG'[c]+(CONNECT4_ROWS-r);

export class ConnectFour {
  constructor(){this.board=Array.from({length:CONNECT4_ROWS},()=>Array(CONNECT4_COLS).fill(0));this.heights=Array(CONNECT4_COLS).fill(0);this.turn=1;this.winner=null;this.winning=[];this.history=[];}
  legalMoves(){if(this.winner!==null)return [];const result=[];for(let c=0;c<CONNECT4_COLS;c++)if(this.heights[c]<CONNECT4_ROWS)result.push({r:CONNECT4_ROWS-1-this.heights[c],c});return result;}
  // Any cell of a column drops to that column's lowest free cell, so r is not part of the rule.
  move(r,c){
    if(this.winner!==null||!Number.isInteger(c)||c<0||c>=CONNECT4_COLS||this.heights[c]>=CONNECT4_ROWS)return false;
    const row=CONNECT4_ROWS-1-this.heights[c],player=this.turn;this.board[row][c]=player;this.heights[c]++;
    const record={r:row,c,player,label:connect4Coordinate(row,c)};this.history.push(record);
    for(const [dr,dc] of directions){const line=[[row,c]];for(const sign of [-1,1]){let nr=row+dr*sign,nc=c+dc*sign;while(inside(nr,nc)&&this.board[nr][nc]===player){line.push([nr,nc]);nr+=dr*sign;nc+=dc*sign;}}if(line.length>=4){this.winner=player;this.winning=line;break;}}
    if(this.winner===null&&this.history.length===CONNECT4_ROWS*CONNECT4_COLS)this.winner=0;
    this.turn=3-player;return record;
  }
  undo(){const last=this.history.pop();if(!last)return false;this.board[last.r][last.c]=0;this.heights[last.c]--;this.turn=last.player;this.winner=null;this.winning=[];return true;}
}

const windows=[];
for(let r=0;r<CONNECT4_ROWS;r++)for(let c=0;c<CONNECT4_COLS;c++)for(const [dr,dc] of directions)if(inside(r+dr*3,c+dc*3))windows.push(Array.from({length:4},(_,i)=>[r+dr*i,c+dc*i]));
function evaluate(board,player){let score=0;for(const line of windows){let own=0,foe=0;for(const [r,c] of line){const value=board[r][c];if(value===player)own++;else if(value)foe++;}if(own&&foe)continue;score+=own===3?40:own===2?6:foe===3?-40:foe===2?-6:0;}for(let r=0;r<CONNECT4_ROWS;r++){const value=board[r][3];if(value)score+=value===player?4:-4;}return score;}
function search(game,depth,alpha,beta){
  if(game.winner!==null)return game.winner===0?0:-(1000+depth);
  if(!depth)return evaluate(game.board,game.turn);
  let best=-Infinity;
  for(const c of centerFirst){if(game.heights[c]>=CONNECT4_ROWS)continue;game.move(0,c);const value=-search(game,depth-1,-beta,-alpha);game.undo();if(value>best)best=value;if(best>alpha)alpha=best;if(alpha>=beta)break;}
  return best;
}
// Casual opponent: fixed-depth search sees short forced lines but not long-range zugzwang plans.
export const CONNECT4_DEPTH=7;
export function chooseConnect4Move(game,depth=CONNECT4_DEPTH){
  let best=-Infinity,chosen=null;
  for(const c of centerFirst){if(game.heights[c]>=CONNECT4_ROWS)continue;const r=CONNECT4_ROWS-1-game.heights[c];game.move(0,c);const value=-search(game,depth-1,-Infinity,-best);game.undo();if(value>best){best=value;chosen={r,c};}}
  return chosen;
}
export function restoreConnect4(moves){const game=new ConnectFour();for(const move of moves){if(!game.move(move.r,move.c))throw new Error('Invalid Connect Four save');}return game;}
