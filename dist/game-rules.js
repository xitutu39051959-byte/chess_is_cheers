import { GridGame, chooseGridMove, createChess, chooseChessMove, restoreGrid } from './engines.js';
import { Xiangqi, chooseXiangqiMove, restoreXiangqi } from './xiangqi.js';
import { ConnectFour, chooseConnect4Move, restoreConnect4 } from './connect4.js';
import { Jungle, chooseJungleMove, restoreJungle } from './jungle.js';
import { Go, chooseGoMove, restoreGo } from './go.js';
import { Tiaoqi, chooseTiaoqiMove, restoreTiaoqi } from './tiaoqi.js';

// One shape for every board game, so the app's game lifecycle needs no per-game branches.
const common={moves:engine=>engine.history,turn:engine=>engine.turn,winner:engine=>engine.winner};
const placing={...common,apply:(engine,move)=>engine.move(move.r,move.c),moveData:({r,c})=>({r,c})};
const moving={...common,picksPiece:true,apply:(engine,move)=>engine.move(move.fr,move.fc,move.r,move.c),moveData:({fr,fc,r,c})=>({fr,fc,r,c})};
const grid=(kind,sides,symbol)=>({...placing,create:()=>new GridGame(kind),restore:moves=>restoreGrid(kind,moves),choose:chooseGridMove,sides,symbol});

export const boardRules={
  xiangqi:{...moving,create:()=>new Xiangqi(),restore:restoreXiangqi,choose:chooseXiangqiMove,sides:['红方','黑方'],symbol:'帅'},
  go:{...common,create:()=>new Go(),restore:restoreGo,choose:chooseGoMove,apply:(engine,move)=>move.finish?engine.finish(move.dead):move.pass?engine.pass():engine.move(move.r,move.c),moveData:({r,c,pass,finish,dead})=>finish?{finish:true,dead}:pass?{pass:true}:{r,c},sides:['黑方','白方'],symbol:'◎'},
  gomoku:grid('gomoku',['黑方','白方'],'◉'),
  chess:{
    create:puzzle=>createChess(puzzle),
    restore:(moves,puzzle)=>{const engine=createChess(puzzle);for(const move of moves)engine.move(move);return engine;},
    choose:chooseChessMove,apply:(engine,move)=>engine.move(move),moves:engine=>engine.history({verbose:true}).map(m=>({player:m.color==='w'?1:2,label:m.san,from:m.from,to:m.to,promotion:m.promotion})),
    saved:engine=>engine.history(),turn:engine=>engine.turn()==='w'?1:2,
    winner:engine=>engine.isCheckmate()?(engine.turn()==='w'?2:1):engine.isGameOver()?0:null,
    sides:['白方','黑方'],symbol:'♞',picksPiece:true
  },
  reversi:grid('reversi',['黑方','白方'],'◉'),
  tictactoe:grid('tictactoe',['叉号','圆圈'],'×'),
  connect4:{...placing,create:()=>new ConnectFour(),restore:restoreConnect4,choose:chooseConnect4Move,sides:['红方','黄方'],symbol:'●'},
  jungle:{...moving,create:()=>new Jungle(),restore:restoreJungle,choose:chooseJungleMove,sides:['红方','蓝方'],symbol:'狮'},
  tiaoqi:{...moving,create:()=>new Tiaoqi(),restore:restoreTiaoqi,choose:chooseTiaoqiMove,sides:['红方','蓝方'],symbol:'✶'}
};
export const savedMoves=(kind,engine)=>{const rules=boardRules[kind];return rules.saved?rules.saved(engine):rules.moves(engine).map(rules.moveData);};
