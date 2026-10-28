import test from 'node:test';
import assert from 'node:assert/strict';
import { createChess, GridGame } from '../dist/engines.js';
import { moveEvent } from '../dist/move-events.js';

test('quiet chess moves produce landing effects, without capture feedback',()=>{const game=createChess();const event=moveEvent('chess',game.move('e4'));assert.equal(event.capture,false);assert.equal(event.from,'e2');assert.deepEqual([event.r,event.c],[4,4]);});
test('ordinary captures and en passant both produce capture feedback',()=>{const game=createChess();['e4','d5'].forEach(m=>game.move(m));assert.equal(moveEvent('chess',game.move('exd5')).capture,true);const ep=createChess();['e4','a6','e5','d5'].forEach(m=>ep.move(m));const event=moveEvent('chess',ep.move('exd6'));assert.equal(event.capture,true);assert.equal(event.enPassant,true);assert.equal(event.captured,'p');assert.deepEqual([event.r,event.c],[2,3]);});
test('castling is animated as two pieces without capture feedback',()=>{const game=createChess();game.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');const event=moveEvent('chess',game.move('O-O'));assert.equal(event.castle,true);assert.equal(event.capture,false);});
test('reversi exposes exactly the flipped cells for the animation',()=>{const game=new GridGame('reversi');const event=moveEvent('reversi',game.move(2,3));assert.equal(event.flips,1);assert.deepEqual(event.flipped,[{r:3,c:3}]);assert.equal(event.capture,false);const history=game.history.length;game.undo();assert.equal(game.history.length,history-1);});
test('no move produces no event, and gomoku drops never look like captures',()=>{assert.equal(moveEvent('chess',null),null);const g=new GridGame('gomoku');const event=moveEvent('gomoku',g.move(7,7));assert.equal(event.capture,false);assert.equal(event.flips,0);});
