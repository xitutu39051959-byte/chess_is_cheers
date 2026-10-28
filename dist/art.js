const icons={
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  book:'<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',
  volume:'<path d="M11 5L6 9H3v6h3l5 4zM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',back:'<path d="M20 12H5m6-6-6 6 6 6"/>',
  undo:'<path d="M3 9h10a7 7 0 0 1 0 14M3 9l5-5M3 9l5 5" transform="translate(1 -2)"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M5.5 7a8 8 0 0 1 13-2L20 7M4 17l1.5 2a8 8 0 0 0 13-2"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',check:'<path d="m5 12 4 4L19 6"/>'
};
export const icon=name=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.grid}</svg>`;
export function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
const shapes={
 p:'<circle cx="24" cy="13" r="6"/><path d="M19 20h10l-2 8 5 9H16l5-9z"/><path d="M14 38h20v4H14z"/>',
 r:'<path d="M12 8h6v6h4V8h4v6h4V8h6v12l-5 3 1 13H16l1-13-5-3z"/><path d="M13 37h22v5H13zM17 22h14"/>',
 n:'<path d="m14 31 5-11-8 4-2-5L20 8l9-2 7 12v18H15l4-5z"/><path d="m21 11 1-7 6 5M14 37h23v5H14z"/><circle cx="23" cy="15" r="1.2" fill="currentColor" stroke="none"/>',
 b:'<path d="M24 5c-3 4-10 8-10 14 0 5 5 8 10 8s10-3 10-8c0-6-7-10-10-14zM21 11l6 9M20 28h8l4 9H16zM13 38h22v4H13z"/>',
 q:'<path d="m11 16 5 17h16l5-17-8 8-5-13-5 13zM16 34h16v3H16zM13 38h22v4H13z"/><circle cx="10" cy="13" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="38" cy="13" r="3"/>',
 k:'<path d="M24 3v11m-5-7h10M24 16c-10-8-17 1-12 8l7 9h10l7-9c5-7-2-16-12-8zM17 34h14v3H17zM13 38h22v4H13z"/>'
};
export function pieceSVG(type,color='w',className='chess-piece'){
  return `<svg class="${className}" viewBox="0 0 48 48" aria-hidden="true" style="color:${color==='w'?'#71684e':'#d8d5bd'}" fill="${color==='w'?'#fff9e7':'#353f31'}" stroke="${color==='w'?'#8d8264':'#252f23'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${shapes[type]||shapes.p}</svg>`;
}
export function cardArt(kind){
  if(kind==='gomoku')return `<div class="mini-grid mini-gomoku">${[[2,2,1],[3,3,1],[4,4,1],[2,3,2],[3,2,2],[4,3,2],[5,3,1]].map(([r,c,p])=>`<i class="mini-stone ${p===1?'black':'white'}" style="left:${c/6*100}%;top:${r/6*100}%"></i>`).join('')}</div>`;
  if(kind==='chess')return `<div class="mini-grid mini-chess">${Array.from({length:16},(_,i)=>`<span class="${(Math.floor(i/4)+i%4)%2?'dark':''}">${({1:['k','b'],6:['p','b'],9:['p','w'],14:['n','w']})[i]?pieceSVG(...({1:['k','b'],6:['p','b'],9:['p','w'],14:['n','w']})[i]):''}</span>`).join('')}</div>`;
  if(kind==='reversi')return `<div class="mini-grid mini-reversi">${[[1,1,1],[2,2,1],[2,1,2],[1,2,2],[0,1,1],[2,3,2]].map(([r,c,p])=>`<i class="mini-stone ${p===1?'black':'white'}" style="left:${c*25+12.5}%;top:${r*25+12.5}%"></i>`).join('')}</div>`;
  return `<div class="mini-grid mini-ttt">${['×','','○','','×','○','','','×'].map(x=>`<span class="${x==='○'?'o':''}">${x}</span>`).join('')}</div>`;
}
export function heroArt(){const pieces={0:['r','b'],2:['b','b'],4:['k','b'],7:['r','b'],9:['p','b'],11:['p','b'],14:['p','b'],21:['n','b'],27:['p','w'],35:['p','b'],42:['n','w'],48:['p','w'],50:['p','w'],53:['p','w'],55:['p','w'],56:['r','w'],59:['q','w'],60:['k','w']};return Array.from({length:64},(_,i)=>`<span class="art-square ${(Math.floor(i/8)+i%8)%2?'dark':''}">${pieces[i]?pieceSVG(...pieces[i],'art-piece'):''}</span>`).join('');}
