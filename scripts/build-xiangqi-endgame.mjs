// 穷举「单车胜双士」起始局面能到达的全部局面，生成 dist/xiangqi-endgame-table.js。用法：node scripts/build-xiangqi-endgame.mjs
import { existsSync, writeFileSync } from 'node:fs';
import { Xiangqi } from '../dist/xiangqi.js';

// 表模块由本脚本生成，先写入空表，保证首次运行也能载入下标函数。
const target=new URL('../dist/xiangqi-endgame-table.js',import.meta.url);
if(!existsSync(target))writeFileSync(target,"export const TABLE='';\n");
const { ENDGAME, TABLE_SIZE, stateIndex, encodeTable }=await import('../dist/xiangqi-endgame.js');

const game=Xiangqi.fromPieces(ENDGAME.pieces),nodes=new Map(),pending=[[game.key(),game.board.map(row=>[...row]),1]];
while(pending.length){
  const [key,board,turn]=pending.pop();if(nodes.has(key))continue;
  game.board=board;game.turn=turn;const edges=[];
  for(const move of game.legalMoves())game.temporary(move,()=>{
    if(stateIndex(game.board)<0){edges.push(null);return;}
    const next=game.key();edges.push(next);if(!nodes.has(next))pending.push([next,game.board.map(row=>[...row]),game.turn]);
  });
  nodes.set(key,{turn,edges,index:stateIndex(board),value:edges.length?undefined:turn===2?0:null});
}
// 按层推进：第 d 层是红方恰好走 d 步取胜的局面，黑方局面取所有应着中最长的一条。
for(let d=1;;d++){
  const red=[...nodes.values()].filter(n=>n.turn===1&&n.value===undefined&&n.edges.some(e=>e!==null&&nodes.get(e).value===d-1));
  if(!red.length)break;
  for(const n of red)n.value=d;
  for(const n of nodes.values())if(n.turn===2&&n.value===undefined&&n.edges.every(e=>e!==null&&Number.isInteger(nodes.get(e).value)))n.value=d;
}
const values=new Int8Array(TABLE_SIZE).fill(-1);
let wins=0,total=0,longest=0;
for(const n of nodes.values())if(n.turn===1){total++;if(Number.isInteger(n.value)){values[n.index]=n.value;wins++;longest=Math.max(longest,n.value);}}
const encoded=encodeTable(values);
writeFileSync(target,`// 由 scripts/build-xiangqi-endgame.mjs 生成，请勿手改。\nexport const TABLE='${encoded}';\n`);
console.log(`局面 ${nodes.size}，红方走子 ${total}，必胜 ${wins}，最长 ${longest} 步，表 ${encoded.length} 字节`);
