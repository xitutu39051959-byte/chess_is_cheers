import test from 'node:test';import assert from 'node:assert/strict';
import { Tiaoqi, TIAOQI_HOLES, TIAOQI_EDGES, isHole, homeOwner, tiaoqiCoordinate, tiaoqiXY, chooseTiaoqiMove, restoreTiaoqi } from '../dist/tiaoqi.js';

function rng(seed){return ()=>(seed=(seed*1664525+1013904223)>>>0)/2**32;}
const targetRows={1:[0,1,2,3],2:[13,14,15,16]};
const moveTo=(g,fr,fc,r,c)=>g.legalMoves().find(m=>m.fr===fr&&m.fc===fc&&m.r===r&&m.c===c);

test('the star has 121 holes in the known row widths, and ten pieces a side',()=>{
  assert.equal(TIAOQI_HOLES.length,121);
  const widths=Array(17).fill(0);for(const [r] of TIAOQI_HOLES)widths[r]++;assert.deepEqual(widths,[1,2,3,4,13,12,11,10,9,10,11,12,13,4,3,2,1]);
  const g=new Tiaoqi(),count=p=>g.board.flat().filter(v=>v===p).length;assert.equal(count(1),10);assert.equal(count(2),10);assert.equal(g.turn,1);
  assert.equal(isHole(0,0),false);assert.equal(isHole(0,12),true);assert.equal(isHole(-1,12),false);
});
test('holes sit one spacing apart on screen along every edge, and rows are symmetric',()=>{
  for(const [a,b,c,d] of TIAOQI_EDGES){const p=tiaoqiXY(a,b),q=tiaoqiXY(c,d);assert.ok(Math.abs(Math.hypot(p.x-q.x,p.y-q.y)-1)<1e-9);}
  for(let r=0;r<17;r++){const xs=TIAOQI_HOLES.filter(h=>h[0]===r).map(([a,b])=>tiaoqiXY(a,b).x);assert.equal(Math.min(...xs)+Math.max(...xs),0);}
  assert.equal(tiaoqiCoordinate(16,4),'A1');assert.equal(tiaoqiCoordinate(0,12),'Q1');
});
test('the opening offers eight steps and six single hops',()=>{
  const g=new Tiaoqi(),moves=g.legalMoves();
  // Front row D has four pieces and five holes ahead; each piece reaches two of them. Row C pieces hop over row D.
  const steps=moves.filter(m=>!m.hops),hops=moves.filter(m=>m.hops);assert.equal(steps.length,8);assert.equal(hops.length,6);assert.ok(hops.every(m=>m.hops===1));assert.ok(moves.every(m=>m.player===1));
});
test('a step reaches only adjacent empty holes, in six directions',()=>{const g=Tiaoqi.fromPieces([[8,8,1]]);const moves=g.legalMoves();assert.equal(moves.length,6);for(const [r,c] of [[8,9],[8,7],[9,8],[7,8],[9,7],[7,9]])assert.ok(moveTo(g,8,8,r,c),r+','+c);assert.equal(g.move(8,8,6,8),false);assert.equal(g.turn,1);});
test('a hop goes over one adjacent piece of either colour, without removing it',()=>{
  const g=Tiaoqi.fromPieces([[8,8,1],[8,9,2],[7,8,1]]);assert.equal(moveTo(g,8,8,8,10).hops,1);assert.equal(moveTo(g,8,8,6,8).hops,1);
  const m=g.move(8,8,8,10);assert.ok(m);assert.equal(g.board[8][9],2);assert.equal(g.board[8][10],1);assert.equal(g.board[8][8],0);
});
test('a hop needs an empty landing hole and an adjacent piece, and cannot leave the star',()=>{
  const blocked=Tiaoqi.fromPieces([[8,8,1],[8,9,2],[8,10,2]]);assert.equal(moveTo(blocked,8,8,8,10),undefined);assert.equal(moveTo(blocked,8,8,8,11),undefined,'cannot hop two pieces');
  const far=Tiaoqi.fromPieces([[8,8,1],[8,10,2]]);assert.equal(moveTo(far,8,8,8,12),undefined,'no long jumps');
  const edge=Tiaoqi.fromPieces([[1,11,1],[0,12,2]]);assert.equal(edge.legalMoves().some(m=>m.r<0),false);
});
test('hops chain, stopping at any point, but steps do not mix with hops',()=>{
  const g=Tiaoqi.fromPieces([[8,8,1],[8,9,2],[8,11,2]]);
  const once=moveTo(g,8,8,8,10),twice=moveTo(g,8,8,8,12);assert.equal(once.hops,1);assert.equal(twice.hops,2);assert.deepEqual(twice.path,[[8,8],[8,10],[8,12]]);
  assert.equal(moveTo(g,8,8,8,13),undefined,'no step after a hop');
  const m=g.move(8,8,8,12);assert.match(m.label,/2 连跳/);assert.equal(g.turn,2);
});
test('a chain cannot use the mover as its own bridge or end where it began',()=>{
  // Four pieces in a ring let the mover hop round; the start must never be offered as a landing.
  const g=Tiaoqi.fromPieces([[8,8,1],[8,9,2],[7,10,2],[6,10,2],[6,9,2],[7,8,2]]);assert.equal(g.legalMoves(1).some(m=>m.r===8&&m.c===8),false);
  // The start hole counts as empty once the piece has left, so it is not a piece to hop back over.
  const bridge=Tiaoqi.fromPieces([[8,8,1],[8,9,2]]);assert.deepEqual(bridge.destinations(8,8).filter(m=>m.hops).map(m=>[m.r,m.c]),[[8,10]]);
});
test('only the side to move may move, and the board is unchanged by a rejected move',()=>{const g=new Tiaoqi(),before=g.key();assert.equal(g.move(0,12,1,11),false);assert.equal(g.move(16,4,16,5),false);assert.equal(g.move(0,0,1,0),false);assert.equal(g.key(),before);assert.equal(g.history.length,0);});
const nearlyHome=[[1,11,1],[1,12,1],[2,10,1],[2,11,1],[2,12,1],[3,9,1],[3,10,1],[3,11,1],[3,12,1],[4,12,1],[8,4,2],[8,5,2],[8,6,2],[8,7,2],[8,8,2],[8,9,2],[8,10,2],[8,11,2],[8,12,2],[9,8,2]];
test('filling the far point wins, and shows the winning pieces',()=>{
  const open=Tiaoqi.fromPieces(nearlyHome);assert.ok(open.move(1,12,0,12));assert.equal(open.winner,null,'the hole at C4 is still open');
  const win=Tiaoqi.fromPieces([[4,9,1],[0,12,1],[1,12,1],[2,10,1],[2,11,1],[2,12,1],[3,10,1],[3,11,1],[3,12,1],[1,11,1],...nearlyHome.slice(10)]);assert.ok(win.move(4,9,3,9));assert.equal(win.winner,1);assert.match(win.reason,/全部棋子/);assert.equal(win.winning.length,10);assert.deepEqual(win.legalMoves(),[]);assert.equal(win.move(0,12,4,9),false);});
test('an opposing piece cannot spoil the win by staying in its home corner',()=>{
  // White never left the tip; black fills the nine other holes and wins with the corner full.
  const g=Tiaoqi.fromPieces([[0,12,2],[4,9,1],[1,11,1],[1,12,1],[2,10,1],[2,11,1],[2,12,1],[3,10,1],[3,11,1],[3,12,1],[16,4,1],[8,8,2]]);assert.ok(g.move(4,9,3,9));assert.equal(g.winner,1);assert.match(g.reason,/占满/);
});
test('moving a piece back to fill your own home hands the win to the opponent',()=>{
  const g=Tiaoqi.fromPieces([[4,9,2],[0,12,2],[1,11,1],[1,12,1],[2,10,1],[2,11,1],[2,12,1],[3,10,1],[3,11,1],[3,12,1]],2);assert.ok(g.move(4,9,3,9));assert.equal(g.winner,1);
});
test('the start position does not count as arrived for anyone',()=>{const g=new Tiaoqi();assert.equal(g.arrived(1),false);assert.equal(g.arrived(2),false);assert.equal(g.progress(1),0);});
test('threefold repetition is a draw',()=>{const g=new Tiaoqi();for(let i=0;i<2;i++){assert.ok(g.move(13,4,12,4));assert.ok(g.move(3,12,4,12));assert.ok(g.move(12,4,13,4));assert.ok(g.move(4,12,3,12));}assert.equal(g.winner,0);assert.match(g.reason,/重复/);});
test('undo restores board, turn and result, and save replay reaches the same position',()=>{
  const g=new Tiaoqi(),start=g.key();assert.equal(g.undo(),false);const moves=[];for(const [a,b,c,d] of [[13,4,12,4],[3,12,4,12],[14,4,12,4]]){const legal=g.move(a,b,c,d);if(legal)moves.push({fr:a,fc:b,r:c,c:d});}
  const restored=restoreTiaoqi(JSON.parse(JSON.stringify(moves)));assert.deepEqual(restored.board,g.board);assert.equal(restored.turn,g.turn);assert.equal(restored.history.at(-1)?.label,g.history.at(-1)?.label);
  while(g.undo());assert.equal(g.key(),start);assert.equal(g.positions.length,1);assert.equal(g.turn,1);
  assert.throws(()=>restoreTiaoqi([{fr:0,fc:0,r:0,c:0}]));
  const won=Tiaoqi.fromPieces([[4,9,1],[0,12,1],[1,12,1],[2,10,1],[2,11,1],[2,12,1],[3,10,1],[3,11,1],[3,12,1],[1,11,1],...nearlyHome.slice(10)]);won.move(4,9,3,9);assert.equal(won.winner,1);won.undo();assert.equal(won.winner,null);assert.deepEqual(won.winning,[]);assert.equal(won.reason,'');assert.equal(won.turn,1);
});
test('homes sit opposite each other and each player targets the other home',()=>{for(const [r,c] of TIAOQI_HOLES){const owner=homeOwner(r,c);if(owner===1)assert.ok(r>=13);if(owner===2)assert.ok(r<=3);if(r>3&&r<13)assert.equal(owner,0);}});
test('AI takes the winning move and leaves the position untouched',()=>{
  const g=Tiaoqi.fromPieces([[4,9,1],[0,12,1],[1,12,1],[2,10,1],[2,11,1],[2,12,1],[3,10,1],[3,11,1],[3,12,1],[1,11,1],...nearlyHome.slice(10)]),before=g.key();const m=chooseTiaoqiMove(g);assert.deepEqual([m.fr,m.fc,m.r,m.c],[4,9,3,9]);assert.equal(g.key(),before);assert.equal(g.history.length,0);
});
test('AI prefers the longest forward chain at the start of a race',()=>{const g=Tiaoqi.fromPieces([[12,4,2],[12,6,1],[11,6,2],[9,6,2],[7,6,2]],1);const m=chooseTiaoqiMove(g,1);assert.equal(m.hops,3);assert.deepEqual([m.r,m.c],[6,6]);});
test('AI beats a random player quickly as either colour',()=>{
  for(const seed of [1,2,3,4])for(const side of [1,2]){const random=rng(seed*17+side),g=new Tiaoqi();while(g.winner===null){let m;if(g.turn===side)m=chooseTiaoqiMove(g);else{const moves=g.legalMoves();m=moves[Math.floor(random()*moves.length)];}assert.ok(g.move(m.fr,m.fc,m.r,m.c));}assert.equal(g.winner,side,`seed ${seed} side ${side}: ${g.reason} after ${g.history.length}`);assert.ok(g.history.length<200,'plies '+g.history.length);}
});
test('AI self-play finishes with a winner and every piece legal',()=>{const g=new Tiaoqi();while(g.winner===null){const m=chooseTiaoqiMove(g);assert.ok(m);assert.ok(g.move(m.fr,m.fc,m.r,m.c));}assert.ok(g.winner===1||g.winner===2,`${g.reason} after ${g.history.length}`);assert.ok(g.history.length<200,'plies '+g.history.length);assert.equal(targetRows[g.winner].some(r=>g.winning.some(([a])=>a===r)),true);});
test('AI finishes when the opponent only shuffles a piece far away',()=>{
  // White keeps one piece outside its home while black must bring all ten across.
  const g=new Tiaoqi();let plies=0;for(const [r,c] of [[3,12],[3,9],[3,10],[3,11],[2,10],[2,11],[2,12],[1,11],[1,12],[0,12]])g.board[r][c]=0;g.board[8][4]=2;g.positions=[g.key()];
  let flip=0;while(g.winner===null&&plies<300){if(g.turn===1){const m=chooseTiaoqiMove(g);assert.ok(g.move(m.fr,m.fc,m.r,m.c));}else{const m=g.legalMoves().sort((a,b)=>a.r-b.r)[flip++%2];assert.ok(g.move(m.fr,m.fc,m.r,m.c));}plies++;}
  assert.equal(g.winner,1,`${g.reason} after ${plies}`);
});
