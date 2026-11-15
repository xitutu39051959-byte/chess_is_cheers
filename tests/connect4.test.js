import test from 'node:test';import assert from 'node:assert/strict';
import { ConnectFour, chooseConnect4Move, restoreConnect4, connect4Coordinate } from '../dist/connect4.js';

const play=(columns,game=new ConnectFour())=>{for(const c of columns)assert.ok(game.move(0,c));return game;};
function count(game,depth){if(!depth)return 1;let total=0;for(const {r,c} of game.legalMoves()){game.move(r,c);total+=count(game,depth-1);game.undo();}return total;}
function rng(seed){return ()=>(seed=(seed*1664525+1013904223)>>>0)/2**32;}

test('connect four starts with seven drops and matches known move-tree counts',()=>{const g=new ConnectFour();assert.equal(g.legalMoves().length,7);assert.equal(count(g,5),16807);assert.equal(count(g,7),823536);});
test('a drop lands on the lowest free cell whichever row was clicked',()=>{const g=new ConnectFour();assert.deepEqual([g.move(0,3).r,g.move(5,3).r,g.move(2,3).r],[5,4,3]);assert.equal(g.history[0].label,'D1');assert.equal(connect4Coordinate(0,6),'G6');});
test('a full column and bad columns are rejected without changing the turn',()=>{const g=play([0,0,0,0,0,0]);assert.equal(g.turn,1);assert.equal(g.move(0,0),false);assert.equal(g.move(0,7),false);assert.equal(g.move(0,-1),false);assert.equal(g.turn,1);assert.equal(g.legalMoves().length,6);});
test('recognizes horizontal, vertical and both diagonal wins with the winning cells',()=>{
  const horizontal=play([0,0,1,1,2,2,3]);assert.equal(horizontal.winner,1);assert.equal(horizontal.winning.length,4);
  const vertical=play([0,1,0,1,0,1,0]);assert.equal(vertical.winner,1);assert.equal(vertical.winning.length,4);
  const rising=play([0,1,1,2,2,3,2,3,3,6,3]);assert.equal(rising.winner,1);assert.ok(rising.winning.some(([r,c])=>r===5&&c===0));
  const falling=play([6,5,5,4,4,3,4,3,3,0,3]);assert.equal(falling.winner,1);assert.ok(falling.winning.some(([r,c])=>r===5&&c===6));
});
test('no moves are accepted after a win',()=>{const g=play([0,1,0,1,0,1,0]);assert.equal(g.move(0,5),false);assert.deepEqual(g.legalMoves(),[]);});
test('a full board with no line is a draw',()=>{const g=new ConnectFour();
  // Columns alternate in blocks so no four ever line up; every drop must be accepted.
  for(const c of [0,1,0,1,0,1,1,0,1,0,1,0,2,3,2,3,2,3,3,2,3,2,3,2,4,5,4,5,4,5,5,4,5,4,5,4,6,6,6,6,6,6]){assert.ok(g.move(0,c));assert.equal(g.winner===1||g.winner===2,false);}
  assert.equal(g.winner,0);assert.deepEqual(g.legalMoves(),[]);});
test('undo restores board, turn, heights and terminal state',()=>{const g=play([0,1,0,1,0,1,0]);assert.equal(g.winner,1);g.undo();assert.equal(g.winner,null);assert.deepEqual(g.winning,[]);assert.equal(g.turn,1);assert.equal(g.board[2][0],0);assert.equal(g.heights[0],3);assert.ok(g.move(0,0));assert.equal(g.winner,1);});
test('save replay restores the same position',()=>{const g=play([3,3,2,4,1]);const restored=restoreConnect4(g.history.map(({r,c})=>({r,c})));assert.deepEqual(restored.board,g.board);assert.equal(restored.turn,g.turn);assert.throws(()=>restoreConnect4(Array(7).fill({r:0,c:0})));});
test('AI takes a win, blocks an immediate loss and leaves the position untouched',()=>{
  const win=play([0,1,0,1,0,6]);const before=JSON.stringify(win.board);assert.equal(chooseConnect4Move(win).c,0);assert.equal(JSON.stringify(win.board),before);assert.equal(win.history.length,6);
  const block=play([6,0,6,1,5,2]);assert.equal(chooseConnect4Move(block).c,3);
});
test('AI does not hand over the cell above that lets the opponent win',()=>{
  // Red holds A2-B2-C2 and needs D2. Yellow playing D1 would lift Red onto it.
  const g=play([1,0,0,2,1,6,2]);assert.equal(g.winner,null);assert.equal(g.heights[3],0);assert.notEqual(chooseConnect4Move(g).c,3);
});
test('AI plays a best first move in the centre and never loses to random play',()=>{
  assert.equal(chooseConnect4Move(new ConnectFour()).c,3);
  for(let seed=1;seed<=20;seed++){const random=rng(seed),g=new ConnectFour();while(g.winner===null){if(g.turn===1){const moves=g.legalMoves(),m=moves[Math.floor(random()*moves.length)];g.move(m.r,m.c);}else{const m=chooseConnect4Move(g,5);assert.ok(g.move(m.r,m.c));}}assert.notEqual(g.winner,1,'seed '+seed);}
});
