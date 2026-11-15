import test from 'node:test';import assert from 'node:assert/strict';
import { boardRules, savedMoves } from '../dist/game-rules.js';

const position=engine=>JSON.stringify(typeof engine.board==='function'?engine.board():engine.board);
for(const [kind,rules] of Object.entries(boardRules)){
  test(kind+' follows the shared rules interface through play, save, restore and undo',()=>{
    const engine=rules.create(false);assert.equal(rules.turn(engine),1);assert.equal(rules.winner(engine),null);assert.equal(rules.sides.length,2);assert.ok(rules.symbol);
    for(let i=0;i<4;i++){const move=rules.choose(engine);assert.ok(move);assert.ok(rules.apply(engine,move));}
    assert.equal(rules.moves(engine).length,4);assert.equal(typeof rules.moves(engine)[0].label,'string');
    const saved=JSON.parse(JSON.stringify(savedMoves(kind,engine))),restored=rules.restore(saved,false);assert.equal(position(restored),position(engine));assert.equal(rules.turn(restored),rules.turn(engine));
    assert.ok(restored.undo());assert.equal(rules.moves(restored).length,3);
  });
}
