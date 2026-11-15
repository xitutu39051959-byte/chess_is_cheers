import test from 'node:test';
import assert from 'node:assert/strict';
import { Xiangqi } from '../dist/xiangqi.js';
import { ENDGAME, createEndgame, analyze, chooseDefense, redDistance, blackDistance, positionDistance, stateIndex } from '../dist/xiangqi-endgame.js';

const play=(g,m)=>{const played=g.move(m.fr,m.fc,m.r,m.c);assert.ok(played,`illegal move ${JSON.stringify(m)}`);return played;};
const afterLine=n=>{const g=createEndgame();ENDGAME.line.slice(0,n).forEach(m=>play(g,m));return g;};
const same=(a,b)=>a.fr===b.fr&&a.fc===b.fc&&a.r===b.r&&a.c===b.c;

test('fromPieces builds the exact position without touching the normal opening',()=>{const g=createEndgame();assert.equal(g.board.flat().filter(Boolean).length,5);assert.equal(g.turn,1);assert.equal(g.positions.length,1);assert.equal(new Xiangqi().board.flat().filter(Boolean).length,32);});
test('the starting position is a forced win in exactly four red moves',()=>{assert.equal(redDistance(createEndgame()),4);});
test('every line move is legal and optimal, and the line ends in stalemate',()=>{const g=createEndgame();let distance=redDistance(g);for(const m of ENDGAME.line){const analysis=analyze(g),best=analysis.moves[0].remaining;assert.equal(analysis.moves.find(x=>same(x,m)).remaining,best);play(g,m);if(m!==ENDGAME.line.at(-1)&&g.turn===1){distance--;assert.equal(redDistance(g),distance);}}assert.equal(g.winner,1);assert.equal(g.reason,'困毙');});
test('commentary claims match the rules',()=>{
  const alt=analyze(afterLine(1)).moves;assert.ok(alt.find(m=>m.label==='士 D10→E9').remaining<alt.find(m=>m.label==='士 F10→E9').remaining,'the other advisor loses faster');
  assert.equal(afterLine(3).legalMoves().length,1,'the general has one legal move');
  const g=afterLine(5);play(g,{fr:1,fc:4,r:2,c:5});assert.equal(g.turn,1);play(g,{fr:5,fc:5,r:2,c:5});assert.equal(g.winner,1);assert.equal(g.reason,'将死');
});
test('the table agrees with one-ply search on every reachable position',()=>{const start=createEndgame(),seen=new Set(),pending=[[start.board.map(r=>[...r]),1]],g=createEndgame();let count=0;
  while(pending.length){const [board,turn]=pending.pop();g.board=board;g.turn=turn;const key=g.key();if(seen.has(key))continue;seen.add(key);count++;
    if(turn===1){const moves=g.legalMoves(),best=Math.min(...moves.map(m=>g.temporary(m,()=>blackDistance(g))??Infinity));assert.equal(redDistance(g),best+1,key);}
    for(const m of g.legalMoves())g.temporary(m,()=>{if(stateIndex(g.board)>=0)pending.push([g.board.map(r=>[...r]),g.turn]);});}
  assert.equal(count,125175);});
test('the defender always takes a hanging rook and search does not mutate the game',()=>{const g=Xiangqi.fromPieces([[9,3,'k',1],[1,4,'r',1],[0,4,'k',2],[0,3,'a',2]],2);const key=g.key();const m=chooseDefense(g);assert.equal(g.key(),key);assert.equal(g.history.length,0);assert.deepEqual([m.r,m.c],[1,4]);assert.equal(m.remaining,null);assert.equal(blackDistance(g),null);play(g,m);assert.equal(g.winner,0);assert.equal(positionDistance(g),null);});
test('a finished game has no moves to analyse',()=>{const g=afterLine(ENDGAME.line.length);assert.deepEqual(analyze(g).moves,[]);assert.equal(chooseDefense(g),null);});
