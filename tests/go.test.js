import test from 'node:test';import assert from 'node:assert/strict';
import { Go, GO_KOMI, goCoordinate, chooseGoMove, estimateDead, restoreGo } from '../dist/go.js';

// Rows use . X O for empty, black, white; turn defaults to black.
function setup(rows,turn=1){const g=new Go();rows.forEach((row,r)=>[...row].forEach((v,c)=>{g.board[r][c]=v==='X'?1:v==='O'?2:0;}));g.turn=turn;g.positions=[g.key()];return g;}
function rng(seed){return ()=>(seed=(seed*1664525+1013904223)>>>0)/2**32;}
const opts=seed=>({ms:Infinity,playouts:800,random:rng(seed)});

test('board starts empty with 81 legal points, black to move, and skips I in coordinates',()=>{const g=new Go();assert.equal(g.legalMoves().length,81);assert.equal(g.turn,1);assert.equal(goCoordinate(0,8),'J9');assert.equal(goCoordinate(8,0),'A1');});
test('occupied and out-of-range points are rejected without changing the turn',()=>{const g=new Go();assert.ok(g.move(4,4));assert.equal(g.move(4,4),false);assert.equal(g.move(-1,0),false);assert.equal(g.move(9,9),false);assert.equal(g.turn,2);assert.equal(g.history.length,1);});
test('a stone with no liberties is captured, and captures are counted',()=>{const g=setup(['.........','.........','.........','...X.....','..XO.....','...X.....','.........','.........','.........']);const m=g.move(4,4);assert.ok(m);assert.deepEqual(m.captured,[{r:4,c:3}]);assert.equal(g.board[4][3],0);assert.equal(g.captures[1],1);});
test('a whole group is captured together, including at the corner',()=>{const g=setup(['OOX......','.XX......','.........','.........','.........','.........','.........','.........','.........']);const m=g.move(1,0);assert.equal(m.captured.length,2);assert.equal(g.board[0][0],0);assert.equal(g.board[0][1],0);});
test('suicide is forbidden, but filling the last liberty is fine when it captures',()=>{
  const g=setup(['.O.......','O........','.........','.........','.........','.........','.........','.........','.........']);assert.equal(g.move(0,0),false);assert.match(g.illegalText(0,0),/禁着点/);assert.equal(g.turn,1);
  const capture=setup(['.OX......','OX.......','X........','.........','.........','.........','.........','.........','.........']);assert.ok(capture.move(0,0),'takes O at B9 and A8');assert.equal(capture.board[0][1],0);assert.equal(capture.board[1][0],0);
});
test('a ko cannot be retaken at once, but can after a move elsewhere',()=>{const g=setup(['.........','...XO....','..X.XO...','...XO....','.........','.........','.........','.........','.........'],2);
  assert.ok(g.move(2,3),'white takes the ko');assert.equal(g.board[2][4],0);
  assert.equal(g.move(2,4),false);assert.match(g.illegalText(2,4),/打劫/);assert.equal(g.turn,1);
  assert.ok(g.move(8,8));assert.ok(g.move(8,0));assert.ok(g.move(2,4),'black retakes after a ko threat');assert.equal(g.board[2][3],0);});
test('whole-board repetition is forbidden beyond the simple ko',()=>{const g=setup(['.O.......']);const repeat=setup(['XO.......']);g.positions.push(repeat.key());assert.equal(g.attempt(0,0,1).error,'ko');assert.equal(g.move(0,0),false);});
test('two passes in a row start scoring; a move in between resets the count',()=>{const g=new Go();g.pass();g.move(4,4);g.pass();assert.equal(g.phase,'play');g.pass();assert.equal(g.phase,'scoring');assert.equal(g.move(0,0),false);assert.equal(g.pass(),false);assert.deepEqual(g.legalMoves(),[]);});
test('area scoring counts stones and surrounded points, and ignores shared points',()=>{const g=setup(Array(9).fill('...X.O...'));const s=g.score();assert.deepEqual([s.black,s.white,s.margin],[36,36,-GO_KOMI]);assert.deepEqual([s.territory[0][0],s.territory[0][4],s.territory[0][8]],[1,0,2]);});
test('marked dead stones are removed and their area changes hands',()=>{const g=setup(['XXXXXXXXX','XO.......','XXXXXXXXX','.........','.........','.........','.........','.........','.........'].map((x,i)=>x));const alive=g.score(),dead=g.score([[1,1]]);assert.ok(dead.black>alive.black);assert.equal(dead.white,0);});
test('finishing records the result and the komi decides a close game',()=>{const g=new Go();g.move(4,4);g.pass();g.pass();assert.ok(g.finish([]));assert.equal(g.winner,1);assert.match(g.reason,/黑胜 73.5 目/);assert.equal(g.phase,'over');assert.equal(g.pass(),false);assert.equal(g.move(0,0),false);
  const empty=new Go();empty.pass();empty.pass();empty.finish([]);assert.equal(empty.winner,2,'an empty board goes to white on komi');});
test('finish rejects dead marks on empty points and only works while scoring',()=>{const g=new Go();assert.equal(g.finish([]),false);g.pass();g.pass();assert.equal(g.finish([[0,0]]),false);assert.equal(g.phase,'scoring');});
test('undo restores board, captures, passes and result step by step',()=>{const g=setup(['.........','.........','.........','...X.....','..XO.....','...X.....','.........','.........','.........']);const key=g.key();g.move(4,4);g.pass();g.pass();g.finish([]);assert.notEqual(g.winner,null);g.undo();assert.equal(g.winner,null);assert.equal(g.phase,'scoring');assert.equal(g.reason,'');g.undo();assert.equal(g.phase,'play');assert.equal(g.passes,1);g.undo();g.undo();assert.equal(g.key(),key);assert.equal(g.captures[1],0);assert.equal(g.turn,1);assert.equal(g.positions.length,1);assert.equal(g.undo(),false);});
test('save replay reaches the same final result, and bad saves throw',()=>{const g=new Go();g.move(4,4);g.move(0,0);g.pass();g.pass();g.finish([[0,0]]);const restored=restoreGo(JSON.parse(JSON.stringify(g.history.map(m=>m.finish?{finish:true,dead:m.dead}:m.pass?{pass:true}:{r:m.r,c:m.c}))));assert.deepEqual(restored.board,g.board);assert.equal(restored.winner,g.winner);assert.equal(restored.reason,g.reason);assert.deepEqual(restored.finalDead,[[0,0]]);assert.throws(()=>restoreGo([{r:0,c:0},{r:0,c:0}]));});
test('dead-stone estimate takes a lone invader but keeps a group with two eyes',()=>{
  const g=setup(['.X....O..','XXXXXXXXX','OOOOOOOOO','OOOOOOOOO','O.OOOOOOO','OOOOOOOOO','OOOOOOOOO','OOOO.OOOO','OOOOOOOOO']);const dead=estimateDead(g,{random:rng(3)});assert.deepEqual(dead,[[0,6]]);
});
test('AI finds the one point that decides a close game, for either side, without touching state',()=>{
  // The chain on row 5 has one liberty at E5: black wins by taking it, white wins by connecting there.
  const rows=['....XO...','....XO...','....XO...','XXXXXO...','OOOO.O...','XXXXXO...','....XO...','....XO...','....XO...'];
  const black=setup(rows),before=JSON.stringify(black.board),take=chooseGoMove(black,opts(1));assert.deepEqual([take.r,take.c],[4,4]);assert.equal(JSON.stringify(black.board),before);assert.equal(black.history.length,0);
  const save=chooseGoMove(setup(rows,2),opts(2));assert.deepEqual([save.r,save.c],[4,4]);
});
test('AI answers a pass by passing when it is already winning the count',()=>{const g=setup(['.XO......','XXO......','OOO......','.........','.........','.........','.........','.........','.........'],1);g.history.push({pass:true});g.turn=2;assert.deepEqual(chooseGoMove(g,opts(5)),{pass:true});});
test('AI never fills its own eye and passes when no useful point is left',()=>{const g=setup(['X.XXXXXXX','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX','XXXX.XXXX','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX','XXXXXXXXX']);assert.deepEqual(chooseGoMove(g,opts(6)),{pass:true});});
test('a whole AI self-play game stays legal and ends by two passes',()=>{const g=new Go(),random=rng(7);let plies=0;while(g.phase==='play'&&plies<300){const m=chooseGoMove(g,{ms:Infinity,playouts:40,random});assert.ok(m.pass?g.pass():g.move(m.r,m.c),'legal move '+JSON.stringify(m));plies++;}assert.equal(g.phase,'scoring','ended after '+plies);assert.ok(g.finish(estimateDead(g,{random,playouts:60})));assert.ok(g.winner===1||g.winner===2);});
test('AI beats a random player',()=>{let wins=0;for(let seed=1;seed<=4;seed++){const ai=rng(seed*11),foe=rng(seed*13),g=new Go();let plies=0;while(g.phase==='play'&&plies<300){let m;if(g.turn===1){const moves=g.legalMoves();m=moves.length&&(foe()<.98)?moves[Math.floor(foe()*moves.length)]:{pass:true};}else m=chooseGoMove(g,{ms:Infinity,playouts:150,random:ai});assert.ok(m.pass?g.pass():g.move(m.r,m.c));plies++;}if(g.phase==='play')continue;g.finish(estimateDead(g,{random:ai,playouts:80}));if(g.winner===2)wins++;}assert.ok(wins>=4,'wins '+wins);});
