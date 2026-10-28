// Use actual move records, including en passant, rather than visual occupancy.
export function moveEvent(kind,move){
  if(!move)return null;
  if(kind==='xiangqi')return {r:move.r,c:move.c,fromCell:{r:move.fr,c:move.fc},capture:!!move.captured,captured:move.captured,player:move.player,flips:0,check:move.check};
  if(kind==='chess')return {r:8-Number(move.to[1]),c:move.to.charCodeAt(0)-97,from:move.from,to:move.to,capture:!!move.captured,captured:move.captured,player:move.color==='w'?1:2,enPassant:move.flags?.includes('e')||false,castle:!!move.flags?.match(/[kq]/),promotion:move.promotion,flips:0};
  return {r:move.r,c:move.c,player:move.player,capture:false,flips:move.flips||0,flipped:move.flipped||[]};
}
