import test from 'node:test';import assert from 'node:assert/strict';
import { Jungle, chooseJungleMove, restoreJungle, isWater, denOwner, trapOwner, jungleCoordinate } from '../dist/jungle.js';

const at=(pieces,turn=1)=>Jungle.fromPieces([...pieces,[0,0,'rat',2],[8,6,'rat',1]].filter((p,i,all)=>all.findIndex(q=>q[0]===p[0]&&q[1]===p[1])===i),turn);
const targets=(game,r,c)=>game.legalMoves().filter(m=>m.fr===r&&m.fc===c).map(m=>jungleCoordinate(m.r,m.c)).sort();
function rng(seed){return ()=>(seed=(seed*1664525+1013904223)>>>0)/2**32;}

test('initial layout is the standard mirrored setup with 24 first moves',()=>{const g=new Jungle();assert.equal(g.board.flat().filter(Boolean).length,16);assert.equal(g.legalMoves().length,24);
  assert.deepEqual(g.board[8][6],{type:'lion',color:1});assert.deepEqual(g.board[8][0],{type:'tiger',color:1});assert.deepEqual(g.board[6][0],{type:'elephant',color:1});assert.deepEqual(g.board[6][6],{type:'rat',color:1});
  assert.deepEqual(g.board[0][0],{type:'lion',color:2});assert.deepEqual(g.board[0][6],{type:'tiger',color:2});assert.deepEqual(g.board[2][0],{type:'rat',color:2});assert.deepEqual(g.board[2][6],{type:'elephant',color:2});});
test('board map has two 3x2 lakes, two dens and six traps',()=>{let water=0,dens=0,traps=0;for(let r=0;r<9;r++)for(let c=0;c<7;c++){water+=isWater(r,c);dens+=!!denOwner(r,c);traps+=!!trapOwner(r,c);}assert.deepEqual([water,dens,traps],[12,2,6]);assert.equal(denOwner(8,3),1);assert.equal(denOwner(0,3),2);assert.equal(trapOwner(7,3),1);assert.equal(trapOwner(1,3),2);});
test('animals move one step orthogonally and stay out of water and their own den',()=>{
  assert.deepEqual(targets(at([[6,3,'wolf',1]]),6,3),['C3','D2','E3','D4'].sort());
  assert.deepEqual(targets(at([[4,3,'dog',1]]),4,3),['D4','D6']);
  assert.deepEqual(targets(at([[7,3,'dog',1]]),7,3),['C2','D3','E2'].sort());
  assert.deepEqual(targets(at([[8,2,'cat',1]]),8,2),['B1','C2']);
});
test('only the rat swims',()=>{const g=at([[4,3,'rat',1]]);assert.deepEqual(targets(g,4,3),['C5','D4','D6','E5'].sort());});
test('lion and tiger jump straight across the water; other animals cannot',()=>{
  for(const type of ['lion','tiger']){assert.ok(targets(at([[4,0,type,1]]),4,0).includes('D5'));assert.ok(targets(at([[6,1,type,1]]),6,1).includes('B7'));assert.ok(targets(at([[2,4,type,1]]),2,4).includes('E3'));}
  for(const type of ['elephant','leopard','wolf','dog','cat'])assert.deepEqual(targets(at([[4,0,type,1]]),4,0),['A4','A6']);
});
test('a rat of either color in the water blocks the jump',()=>{for(const color of [1,2]){assert.ok(!targets(at([[4,0,'lion',1],[4,2,'rat',color]]),4,0).includes('D5'));assert.ok(!targets(at([[6,1,'tiger',1],[3,1,'rat',color]]),6,1).includes('B7'));}assert.ok(targets(at([[4,0,'lion',1],[5,2,'rat',2]]),4,0).includes('D5'));});
test('a jump can capture on landing only if rank allows',()=>{assert.ok(targets(at([[4,0,'lion',1],[4,3,'tiger',2]]),4,0).includes('D5'));assert.ok(!targets(at([[4,0,'tiger',1],[4,3,'lion',2]]),4,0).includes('D5'));});
test('higher or equal rank captures; lower rank cannot',()=>{assert.ok(targets(at([[4,3,'wolf',1],[3,3,'dog',2]]),4,3).includes('D6'));assert.ok(targets(at([[4,3,'wolf',1],[3,3,'wolf',2]]),4,3).includes('D6'));assert.ok(!targets(at([[4,3,'wolf',1],[3,3,'leopard',2]]),4,3).includes('D6'));});
test('rat captures elephant, elephant cannot capture rat',()=>{assert.ok(targets(at([[4,3,'rat',1],[3,3,'elephant',2]]),4,3).includes('D6'));assert.ok(!targets(at([[4,3,'elephant',1],[3,3,'rat',2]]),4,3).includes('D6'));});
test('no capture crosses the shoreline, but rats fight inside the water',()=>{
  assert.ok(!targets(at([[4,1,'rat',1],[4,0,'elephant',2]]),4,1).includes('A5'),'water rat must not take land elephant');
  assert.ok(!targets(at([[4,0,'rat',1],[4,1,'rat',2]]),4,0).includes('B5'),'land rat must not take water rat');
  assert.ok(!targets(at([[4,0,'elephant',1],[4,1,'rat',2]]),4,0).includes('B5'));
  assert.ok(targets(at([[4,1,'rat',1],[4,2,'rat',2]]),4,1).includes('C5'));
});
test('an animal in the enemy trap can be taken by anything, in your own trap it keeps rank',()=>{
  const trapped=at([[7,2,'cat',1],[8,2,'elephant',2]]);assert.ok(targets(trapped,7,2).includes('C1'),'cat takes elephant in red trap');
  assert.ok(targets(at([[7,2,'elephant',1],[8,2,'rat',2]]),7,2).includes('C1'),'trap beats the elephant-rat exception');
  assert.ok(!targets(at([[7,3,'lion',2],[7,4,'cat',1]],2),7,3).includes('E2'),'a trapped lion has rank 0 and takes nothing');
  assert.ok(!targets(at([[7,2,'cat',2],[8,2,'elephant',1]],2),7,2).includes('C1'),'elephant on its own trap keeps its rank');
});
test('entering the enemy den wins at once and is recorded',()=>{const g=at([[1,3,'dog',1],[6,3,'dog',2]]);const m=g.move(1,3,0,3);assert.ok(m);assert.equal(g.winner,1);assert.equal(g.reason,'攻入兽穴');assert.deepEqual(g.legalMoves(),[]);assert.equal(g.move(8,6,8,5),false);});
test('capturing the last animal wins; having no legal move loses',()=>{
  const last=Jungle.fromPieces([[4,3,'lion',1],[3,3,'cat',2]]);last.move(4,3,3,3);assert.equal(last.winner,1);assert.equal(last.reason,'吃光对方动物');
  const stuck=Jungle.fromPieces([[0,1,'dog',1],[1,0,'dog',1],[2,2,'wolf',1],[0,0,'cat',2]]);stuck.move(2,2,1,2);assert.equal(stuck.winner,1);assert.equal(stuck.reason,'对方无子可动');
});
test('three-fold repetition and 100 quiet moves are draws',()=>{
  const g=at([[4,3,'dog',1],[2,3,'dog',2]]);for(let i=0;i<2;i++){g.move(8,6,8,5);g.move(0,0,0,1);g.move(8,5,8,6);g.move(0,1,0,0);}assert.equal(g.winner,0);assert.equal(g.reason,'同局面三次重复');
  const q=at([[4,3,'dog',1],[2,3,'dog',2]]);q.halfMoves=99;q.move(4,3,5,3);assert.equal(q.winner,0);assert.equal(q.reason,'连续 100 手未吃子');
});
test('illegal input is rejected and undo restores everything',()=>{const g=new Jungle(),before=JSON.stringify(g.board);assert.equal(g.move(8,0,0,0),false);assert.equal(g.move(-1,0,0,0),false);assert.equal(g.move(4,3,4,4),false);assert.equal(g.turn,1);const m=g.legalMoves()[0];assert.ok(g.move(m.fr,m.fc,m.r,m.c));assert.ok(g.undo());assert.equal(JSON.stringify(g.board),before);assert.equal(g.turn,1);assert.equal(g.history.length,0);assert.equal(g.positions.length,1);
  const end=at([[1,3,'dog',1]]);end.move(1,3,0,3);end.undo();assert.equal(end.winner,null);assert.equal(end.reason,'');});
test('save replay restores the same position and bad saves throw',()=>{const g=new Jungle();for(let i=0;i<6;i++){const m=g.legalMoves()[i];g.move(m.fr,m.fc,m.r,m.c);}const restored=restoreJungle(g.history.map(({fr,fc,r,c})=>({fr,fc,r,c})));assert.deepEqual(restored.board,g.board);assert.equal(restored.turn,g.turn);assert.throws(()=>restoreJungle([{fr:0,fc:0,r:8,c:8}]));});
test('AI enters the den, stops a den threat and takes a free piece without touching state',()=>{
  const den=at([[1,3,'cat',2],[7,3,'dog',2]],2);const pick=chooseJungleMove(den);assert.deepEqual([pick.r,pick.c],[8,3]);
  const before=JSON.stringify(den.board);chooseJungleMove(den);assert.equal(JSON.stringify(den.board),before);assert.equal(den.turn,2);assert.equal(den.history.length,0);
  const guard=Jungle.fromPieces([[1,3,'dog',1],[1,4,'wolf',2],[8,0,'rat',2],[8,6,'rat',1]],2);const stop=chooseJungleMove(guard);assert.deepEqual([stop.fr,stop.fc,stop.r,stop.c],[1,4,1,3]);
  const free=Jungle.fromPieces([[4,3,'lion',2],[3,3,'cat',1],[8,6,'rat',1],[0,0,'rat',2]],2);const take=chooseJungleMove(free);assert.deepEqual([take.r,take.c],[3,3]);
});
test('whole games finish with only legal moves, and the AI does not lose to random play',()=>{
  for(let seed=1;seed<=4;seed++){const random=rng(seed),g=new Jungle();let plies=0;while(g.winner===null&&plies<400){if(g.turn===1){const moves=g.legalMoves(),m=moves[Math.floor(random()*moves.length)];assert.ok(g.move(m.fr,m.fc,m.r,m.c));}else{const m=chooseJungleMove(g,3);assert.ok(g.move(m.fr,m.fc,m.r,m.c));}plies++;}assert.notEqual(g.winner,null);assert.notEqual(g.winner,1,'seed '+seed);}
  const g=new Jungle();let plies=0;while(g.winner===null&&plies<400){const m=chooseJungleMove(g,2);assert.ok(g.move(m.fr,m.fc,m.r,m.c));plies++;}assert.notEqual(g.winner,null,'self-play must end by a rule');
});
