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
export function chooseXiangqiMove(game){
  const player=game.turn,moves=game.legalMoves().sort((a,b)=>(values[b.captured?.type]||0)-(values[a.captured?.type]||0));let best=-Infinity,chosen=null;
  for(const move of moves){const value=game.temporary(move,()=>{const replies=game.legalMoves();if(!replies.length)return 100000;let worst=Infinity;for(const reply of replies){const score=game.temporary(reply,()=>evaluate(game,player));worst=Math.min(worst,score);if(worst<best)break;}return worst+(game.isInCheck()?8:0);});if(value>best){best=value;chosen=move;}}
  return chosen;
}
export function restoreXiangqi(moves){const game=new Xiangqi();for(const move of moves)if(!game.move(move.fr,move.fc,move.r,move.c))throw new Error('Invalid Xiangqi save');return game;}
