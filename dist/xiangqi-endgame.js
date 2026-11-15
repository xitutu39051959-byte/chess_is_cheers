import { Xiangqi, XIANGQI_NAMES, xiangqiCoordinate } from './xiangqi.js';
import { TABLE } from './xiangqi-endgame-table.js';

// 单车胜双士：表内数值由 scripts/build-xiangqi-endgame.mjs 穷举生成，tests/xiangqi-endgame.test.js 逐局面校验。
export const ENDGAME={
  name:'单车胜双士',english:'ROOK VS TWO ADVISORS',
  summary:'基本实用残局。黑方双士守在底线，红方只有一车一帅，却能逼得黑方无棋可走。',
  rules:'红方先行，目标是将死黑将或令其无合法走法。「主线讲解」可逐步查看关键着法和要点；「自己试走」由你执红，电脑按最顽强的防守应对，并判断你的每一步是否仍保持胜势。本局不写入棋谱存档。',
  pieces:[[9,3,'k',1],[5,0,'r',1],[0,4,'k',2],[0,3,'a',2],[0,5,'a',2]],
  intro:['起始局面','黑将左右都被自家的士占住，只有中路一条出路。红帅已在 D 线，黑将也不能走上这条线，否则将帅照面。先想想：红车第一步该去哪？'],
  line:[
    {fr:5,fc:0,r:5,c:4,title:'车九平五 · 抢占中路',note:'直接将军。黑将两侧被士堵住，向前又走在车的火力线上，只能用士来挡。'},
    {fr:0,fc:5,r:1,c:4,title:'士6进5 · 垫将',note:'最顽强的挡法。如果改用 D10 的士来挡，红方会赢得更快，可以切到「自己试走」对照。'},
    {fr:9,fc:3,r:9,c:4,title:'帅六平五 · 帅也参战',note:'全局的关键。E9 的士被车钉在中路，一动黑将就被将军；D10 的士也没有落点。黑方只剩下将可以动。'},
    {fr:0,fc:4,r:0,c:5,title:'将5平6 · 唯一的合法着法',note:'D10 被自家的士占着，E9 的士不能离开中路，黑方别无选择。'},
    {fr:5,fc:4,r:5,c:5,title:'车五平四 · 追将',note:'换到 F 线将军。黑方可以把将退回中路；也可以走士 E9→F8 挡将，但红车吃士后立即绝杀。'},
    {fr:0,fc:5,r:0,c:4,title:'将6平5 · 回到中路',note:'黑将回到原位。现在轮到红方走，而红方并不需要再将军。'},
    {fr:5,fc:5,r:4,c:5,title:'车四退一 · 等着，困毙',note:'车留在 F 线封住 F10，再让出一步棋。E9 的士一动就会将帅照面，D10 的士没有落点，黑将也无路可走。黑方无合法走法，判负。'}
  ],
  ideas:['用车控制中路，钉住挡将的士。','帅占中线，让照面规则替你控制棋盘。','不必一味将军，一步等着就可能困毙对手。']
};

const ADVISOR_POINTS=['0,3','0,5','1,4','2,3','2,5'];
export const TABLE_SIZE=9*9*90*32;
export function createEndgame(){return Xiangqi.fromPieces(ENDGAME.pieces);}
export const moveLabel=(game,m)=>`${XIANGQI_NAMES[game.board[m.fr][m.fc].color][game.board[m.fr][m.fc].type]} ${xiangqiCoordinate(m.fr,m.fc)}${game.board[m.r][m.c]?'×':'→'}${xiangqiCoordinate(m.r,m.c)}`;

// 红帅、黑将、红车和黑士的位置组成表的下标；没有红车时返回 -1。
export function stateIndex(board){
  let redKing=-1,blackKing=-1,rook=-1,mask=0;
  for(let r=0;r<10;r++)for(let c=0;c<9;c++){const p=board[r][c];if(!p)continue;
    if(p.type==='k'&&p.color===1)redKing=(r-7)*3+c-3;
    else if(p.type==='k')blackKing=r*3+c-3;
    else if(p.type==='r'&&p.color===1)rook=r*9+c;
    else if(p.type==='a'&&p.color===2)mask|=1<<ADVISOR_POINTS.indexOf(r+','+c);
    else return -1;}
  return redKing<0||blackKing<0||rook<0?-1:(((redKing*9+blackKing)*90+rook)*32)+mask;
}
export function encodeTable(values){let out='';for(let i=0;i<values.length;){let j=i;while(j<values.length&&values[j]===values[i])j++;out+=(values[i]<0?'.':String.fromCharCode(65+values[i]))+(j-i>1?(j-i).toString(36):'');i=j;}return out;}
let decoded=null;
function table(){if(decoded)return decoded;decoded=new Int8Array(TABLE_SIZE).fill(-1);let i=0;for(const [,token,run] of TABLE.matchAll(/([A-Z.])([0-9a-z]*)/g)){const n=run?parseInt(run,36):1;if(token!=='.')decoded.fill(token.charCodeAt(0)-65,i,i+n);i+=n;}return decoded;}

// 红方走子时：红方最少还需走几步才能取胜；已无胜势时为 null。
export function redDistance(game){const index=stateIndex(game.board);if(index<0)return null;const value=table()[index];return value<0?null:value;}
// 黑方走子时：无论黑方怎么应，红方最少还需走几步；黑方无棋可走为 0，能吃掉红车为 null。
export function blackDistance(game){const replies=game.legalMoves();let worst=0;for(const reply of replies){const value=game.temporary(reply,()=>redDistance(game));if(value===null)return null;worst=Math.max(worst,value);}return worst;}
export const positionDistance=game=>game.turn===1?redDistance(game):blackDistance(game);

// 列出当前一方的全部着法，remaining 为走完后红方还需走的步数，最佳着法排在最前。
export function analyze(game){
  if(game.winner!==null)return {side:game.turn,distance:null,moves:[]};
  const red=game.turn===1,moves=game.legalMoves().map(move=>({fr:move.fr,fc:move.fc,r:move.r,c:move.c,label:moveLabel(game,move),remaining:game.temporary(move,()=>red?blackDistance(game):redDistance(game))}));
  // null 表示红方已无胜势：对红方是最差的结果，对黑方是最好的结果。
  const rank=m=>m.remaining===null?99:m.remaining;
  moves.sort((a,b)=>red?rank(a)-rank(b):rank(b)-rank(a));
  return {side:game.turn,distance:positionDistance(game),moves};
}
export const chooseDefense=game=>analyze(game).moves[0]||null;
