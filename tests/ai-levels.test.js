import test from 'node:test';
import assert from 'node:assert/strict';
import { GridGame, chooseGridMove, createChess, chooseChessMove } from '../dist/engines.js';
import { Xiangqi, chooseXiangqiMove } from '../dist/xiangqi.js';
import { boardRules, AI_LEVELS, AI_LEVEL_KINDS } from '../dist/game-rules.js';

const gridSnapshot=g=>JSON.stringify({board:g.board,turn:g.turn,history:g.history,winner:g.winner});
const xqSnapshot=g=>JSON.stringify({key:g.key(),history:g.history,positions:g.positions,turn:g.turn});
const chessSnapshot=c=>c.fen()+'|'+JSON.stringify(c.history());
const gridLegal=(g,move)=>g.legalMoves().some(m=>m.r===move.r&&m.c===move.c);
const xqLegal=(g,move)=>g.legalMoves().some(m=>m.fr===move.fr&&m.fc===move.fc&&m.r===move.r&&m.c===move.c);
const chessLegal=(c,move)=>c.moves({verbose:true}).some(m=>m.from===move.from&&m.to===move.to&&(m.promotion||'')===(move.promotion||''));

function gomokuPosition(playerStones,opponentStones=[]){
  const g=new GridGame('gomoku');
  for(const [r,c] of playerStones)g.board[r][c]=2;
  for(const [r,c] of opponentStones)g.board[r][c]=1;
  g.turn=2;g.history=[{r:7,c:4}];
  return g;
}

function chessMateInTwoKeys(fen){
  const c=createChess();c.load(fen);
  const mateNow=()=>{for(const move of c.moves({verbose:true})){c.move(move);const mate=c.isCheckmate();c.undo();if(mate)return move;}return null;};
  const keys=new Set();
  for(const move of c.moves({verbose:true})){
    c.move(move);
    if(c.isCheckmate()){c.undo();continue;}
    const replies=c.moves({verbose:true});
    let all=replies.length>0;
    for(const reply of replies){c.move(reply);const mate=mateNow();c.undo();if(!mate){all=false;break;}}
    c.undo();
    if(all)keys.add(move.san);
  }
  return keys;
}

function xiangqiMateInTwoKeys(){
  const g=Xiangqi.fromPieces([[9,4,'k',1],[0,4,'k',2],[1,0,'r',1],[2,0,'r',1]],1);
  const mateNow=()=>{for(const move of g.legalMoves()){if(g.temporary(move,()=>g.legalMoves().length===0))return move;}return null;};
  const keys=[];
  for(const move of g.legalMoves()){
    const replies=g.temporary(move,()=>g.legalMoves());
    if(!replies.length)continue;
    let all=true;
    for(const reply of replies){
      const mate=g.temporary(move,()=>g.temporary(reply,()=>mateNow()));
      if(!mate){all=false;break;}
    }
    if(all)keys.push([move.fr,move.fc,move.r,move.c]);
  }
  return keys;
}

test('gomoku all levels take an immediate five',()=>{
  for(const level of AI_LEVELS){
    const g=gomokuPosition([[7,4],[7,5],[7,6],[7,7]]);
    const before=gridSnapshot(g);
    const move=chooseGridMove(g,{level,random:()=>0.99});
    assert.ok(gridLegal(g,move));
    assert.equal(move.r,7);
    assert.ok([3,8].includes(move.c));
    assert.equal(gridSnapshot(g),before);
  }
});

test('gomoku casual, advanced and serious block an immediate four',()=>{
  for(const level of ['casual','advanced','serious']){
    const g=gomokuPosition([],[ [7,4],[7,5],[7,6],[7,7] ]);
    const before=gridSnapshot(g);
    const move=chooseGridMove(g,{level,random:()=>0.99});
    assert.ok(gridLegal(g,move));
    assert.equal(move.r,7);
    assert.ok([3,8].includes(move.c));
    assert.equal(gridSnapshot(g),before);
  }
});

test('gomoku easy, advanced and serious all return legal moves without touching the position',()=>{
  for(const level of AI_LEVELS){
    const g=gomokuPosition([[7,7],[8,8]],[[7,8],[6,6]]);
    const before=gridSnapshot(g);
    const move=chooseGridMove(g,{level,random:()=>0.5});
    assert.ok(gridLegal(g,move));
    assert.equal(gridSnapshot(g),before);
  }
});

test('chess all levels find a one-move mate and leave the position untouched',()=>{
  for(const level of AI_LEVELS){
    const c=createChess(true);
    const before=chessSnapshot(c);
    const move=chooseChessMove(c,{level,random:()=>0.5});
    assert.ok(move);
    assert.ok(chessLegal(c,move));
    assert.equal(chessSnapshot(c),before);
    c.move(move);
    assert.equal(c.isCheckmate(),true);
    c.undo();
  }
});

test('chess serious finds a verified mate in two',()=>{
  const fen='7k/8/6K1/8/8/8/8/6R1 w - - 0 1';
  const keys=chessMateInTwoKeys(fen);
  assert.ok(keys.size>0);
  const c=createChess();c.load(fen);
  const before=chessSnapshot(c);
  const move=chooseChessMove(c,{level:'serious'});
  assert.ok(chessLegal(c,move));
  assert.ok(keys.has(move.san));
  assert.equal(chessSnapshot(c),before);
});

test('xiangqi all levels take a verified mate in one',()=>{
  for(const level of AI_LEVELS){
    const g=Xiangqi.fromPieces([[9,4,'k',1],[0,4,'k',2],[0,0,'r',1],[1,0,'r',1]],1);
    const before=xqSnapshot(g);
    const move=chooseXiangqiMove(g,{level,random:()=>0.5});
    assert.ok(xqLegal(g,move));
    assert.equal(g.temporary(move,()=>g.legalMoves().length===0),true);
    assert.equal(xqSnapshot(g),before);
  }
});

test('xiangqi all levels return legal moves without touching the position',()=>{
  for(const level of AI_LEVELS){
    const g=new Xiangqi();g.move(7,1,7,4);g.move(0,1,2,2);
    const before=xqSnapshot(g);
    const move=chooseXiangqiMove(g,{level,random:()=>0.5});
    assert.ok(move);
    assert.ok(xqLegal(g,move));
    assert.equal(xqSnapshot(g),before);
  }
});

test('xiangqi serious finds a verified mate in two',()=>{
  const keys=xiangqiMateInTwoKeys();
  assert.ok(keys.length>0);
  const g=Xiangqi.fromPieces([[9,4,'k',1],[0,4,'k',2],[1,0,'r',1],[2,0,'r',1]],1);
  const before=xqSnapshot(g);
  const move=chooseXiangqiMove(g,{level:'serious'});
  assert.ok(xqLegal(g,move));
  assert.ok(keys.some(([fr,fc,r,c])=>move.fr===fr&&move.fc===fc&&move.r===r&&move.c===c));
  assert.equal(xqSnapshot(g),before);
});

test('explicit casual matches the default chooser for all three games',()=>{
  const gA=gomokuPosition([[7,7]],[[7,8]]),gB=gomokuPosition([[7,7]],[[7,8]]);
  assert.deepEqual(chooseGridMove(gA),chooseGridMove(gB,{level:'casual'}));
  const cA=createChess(),cB=createChess();
  assert.deepEqual(chooseChessMove(cA),chooseChessMove(cB,{level:'casual'}));
  const xA=new Xiangqi(),xB=new Xiangqi();
  assert.deepEqual(chooseXiangqiMove(xA),chooseXiangqiMove(xB,{level:'casual'}));
});

test('boardRules passes every level through and applies a legal move',()=>{
  for(const kind of AI_LEVEL_KINDS){
    const rules=boardRules[kind];
    for(const level of AI_LEVELS){
      const engine=rules.create(false);
      const move=rules.choose(engine,{level,timeMs:50,random:()=>0.5});
      assert.ok(move);
      assert.ok(rules.apply(engine,move));
      assert.equal(rules.moves(engine).length,1);
    }
  }
});
