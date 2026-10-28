import { GridGame, chooseGridMove, createChess, chooseChessMove, restoreGrid, coordinate, PUZZLE_FEN } from './engines.js';
import { icon, hydrateIcons, pieceSVG, cardArt, heroArt } from './art.js';

const $=selector=>document.querySelector(selector);
const games={
  gomoku:{name:'五子棋',english:'GOMOKU',description:'黑白之间，连成你的五子一线。',time:'5–15 分钟',tag:'经典',category:'strategy',rules:'黑方先行，双方轮流在交叉点落子。任意横、竖或斜线上，率先连成五子或更多的一方获胜。本版本采用自由五子棋规则，不设禁手。',instruction:'点击棋盘交叉点落子'},
  chess:{name:'国际象棋',english:'CHESS',description:'六十四格，装得下无限可能。',time:'10–30 分钟',tag:'策略',category:'strategy',rules:'白方先行。先点击己方棋子，再点击标记的合法位置。将死对方国王即获胜；无合法走法但未被将军时为逼和。支持王车易位、吃过路兵及三次重复等和棋判定，兵升变时可选择后、车、象或马。电脑为适合休闲的两层搜索对手。',instruction:'点击棋子，查看可走的位置'},
  reversi:{name:'黑白棋',english:'REVERSI',description:'一次翻转，让局势悄然改变。',time:'5–15 分钟',tag:'巧思',category:'strategy',rules:'黑方先行。落子后，沿横、竖或斜线夹住对方棋子，即可将它们翻为己方颜色；每手至少翻转一子。没有合法落点时自动跳过，双方均无法落子时结束，棋子更多者获胜。',instruction:'小圆点标记了你的合法落点'},
  tictactoe:{name:'井字棋',english:'TIC-TAC-TOE',description:'三横三竖，也有小小的博弈。',time:'1–3 分钟',tag:'轻松',category:'quick',rules:'叉号先行，双方轮流在空格内落子。横、竖或斜线上率先连成三个相同符号即获胜。棋盘填满而无人连线时为平局。电脑会认真应对，试着与它打成平手吧。',instruction:'点击空格，连成三个相同符号'}
};
const STORAGE_KEY='chess-cheers-v1';
let store={saves:{},archives:[],sound:false,puzzleSolved:false,appearance:{view:'2d',theme:'classic',angle:28,rotation:-5}};
let storageAvailable=true;
try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(saved&&typeof saved==='object'){store={...store,...saved,saves:saved.saves&&typeof saved.saves==='object'?saved.saves:{},archives:Array.isArray(saved.archives)?saved.archives.slice(0,30):[]};}}catch{storageAvailable=false;}
let current=null,botTimer=null,session=0,toastTimer=null,dialogAction=null,promotionResolve=null;
let audioContext=null;
store.appearance={view:'2d',theme:'classic',angle:28,rotation:-5,...store.appearance};
if(!['2d','3d'].includes(store.appearance.view))store.appearance.view='2d';
if(!['classic','terrain','world'].includes(store.appearance.theme))store.appearance.theme='classic';
store.appearance.angle=Math.max(10,Math.min(42,Number(store.appearance.angle)||28));
store.appearance.rotation=Number.isFinite(Number(store.appearance.rotation))?Number(store.appearance.rotation):-5;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));return true;}catch{if(storageAvailable){toast('当前浏览器无法保存进度，请及时导出棋谱。');storageAvailable=false;}return false;}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function showDialog(title,body,action='知道了',callback=null){$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog-action').textContent=action;dialogAction=callback;if(!$('#info-dialog').open)$('#info-dialog').showModal();}
function closeDialog(){if(promotionResolve){promotionResolve(null);promotionResolve=null;}$('#info-dialog').close();dialogAction=null;}
$('#dialog-close').addEventListener('click',closeDialog);
$('#info-dialog').addEventListener('cancel',()=>{if(promotionResolve){promotionResolve(null);promotionResolve=null;}dialogAction=null;});
$('#dialog-action').addEventListener('click',()=>{const callback=dialogAction;closeDialog();callback?.();});
$('#info-dialog').addEventListener('click',e=>{if(e.target===$('#info-dialog')){const rect=e.target.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)closeDialog();}});
function playSound(){if(!store.sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(540,audioContext.currentTime);oscillator.frequency.exponentialRampToValueAtTime(180,audioContext.currentTime+.08);gain.gain.setValueAtTime(.08,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.1);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.11);}catch{/* Audio is optional. */}}
function updateSound(){const button=$('#sound-button');button.querySelector('span:last-child').textContent=`落子音效已${store.sound?'开':'关'}`;button.setAttribute('aria-pressed',String(store.sound));}
$('#sound-button').addEventListener('click',()=>{store.sound=!store.sound;persist();updateSound();playSound();toast(`落子音效已${store.sound?'开启':'关闭'}`);});
$('#about-button').addEventListener('click',()=>showDialog('给好棋，留一点时间。','<p>弈间 · Chess & Cheers，是一个安静、轻盈的棋类空间。我们相信，好的对弈从好奇开始，也可以在一杯茶的时间里发生。</p><p>四种棋类，支持本地双人与休闲人机对弈。棋谱只保存在当前浏览器；清除浏览器数据会移除记录，可提前导出留存。</p><p>当前版本无需登录，不提供远程联机。国际象棋规则由 chess.js 1.4.0 驱动。</p>'));

function renderCards(filter='all'){$('#game-grid').innerHTML=Object.entries(games).filter(([,g])=>filter==='all'||g.category===filter).map(([kind,g],index)=>`<button class="game-card" data-play="${kind}" aria-label="开始${g.name}"><div class="card-art ${kind}" aria-hidden="true"><span class="game-number">0${Object.keys(games).indexOf(kind)+1} /</span>${cardArt(kind)}</div><div class="card-body"><h3>${g.name}</h3><span class="english">${g.english}</span><p>${g.description}</p><div class="card-bottom"><span><span class="card-tag">${g.tag}</span>${g.time}</span>${icon('arrow')}</div></div></button>`).join('');}
function cancelBot(){clearTimeout(botTimer);botTimer=null;session++;if(current)current.thinking=false;}
function showView(view){for(const key of ['home','records','play'])$(`#${key}-view`).hidden=key!==view;document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===view));$('#breadcrumb-current').textContent=view==='home'?'游戏大厅':view==='records'?'我的棋谱':current?.puzzle?'每日棋题':games[current.kind].name;window.scrollTo({top:0,behavior:'instant'});}
function navigate(view){cancelBot();if(current)saveCurrent();if(view==='puzzle'){openGame('chess',true);return;}showView(view);if(view==='records')renderRecords();}
document.querySelectorAll('[data-nav]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.nav)));
$('.brand').addEventListener('click',event=>{event.preventDefault();navigate('home');});
$('#back-home').addEventListener('click',()=>navigate('home'));
document.addEventListener('click',event=>{const play=event.target.closest('[data-play]');if(play)openGame(play.dataset.play);const filter=event.target.closest('[data-filter]');if(filter){document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===filter));renderCards(filter.dataset.filter);}});

function newState(kind,mode='ai',puzzle=false){return {kind,mode,puzzle,engine:kind==='chess'?createChess(puzzle):new GridGame(kind),selected:null,thinking:false,startedAt:Date.now(),recordId:crypto.randomUUID(),archived:false};}
function loadState(saved){if(!games[saved.kind]||!['ai','local'].includes(saved.mode)||!Array.isArray(saved.moves)||saved.moves.length>1000)throw new Error('Invalid save');const state=newState(saved.kind,saved.mode,!!saved.puzzle);if(saved.kind==='chess'){for(const move of saved.moves)state.engine.move(move);}else state.engine=restoreGrid(saved.kind,saved.moves);state.startedAt=saved.startedAt||Date.now();state.recordId=saved.recordId||crypto.randomUUID();state.archived=!!saved.archived;return state;}
function openGame(kind,puzzle=false,savedOverride=null){cancelBot();if(current)saveCurrent();const saved=savedOverride||(!puzzle?store.saves[kind]:null);try{current=saved?loadState(saved):newState(kind,'ai',puzzle);}catch{current=newState(kind,'ai',puzzle);toast('存档无法读取，已为你开启新局。');}showView('play');renderGame();saveCurrent();scheduleBot();if(puzzle)toast(store.puzzleSolved?'你已经解出这道题，可以再挑战一次。':'白方先行，一步将杀。点击白后开始思考。');}
$('#daily-puzzle').addEventListener('click',()=>openGame('chess',true));
function getMoves(){return current.kind==='chess'?current.engine.history({verbose:true}).map(m=>({player:m.color==='w'?1:2,label:m.san,from:m.from,to:m.to,promotion:m.promotion})):current.engine.history;}
function getTurn(){return current.kind==='chess'?(current.engine.turn()==='w'?1:2):current.engine.turn;}
function winner(){if(current.kind!=='chess')return current.engine.winner;if(current.engine.isCheckmate())return getTurn()===1?2:1;if(current.engine.isGameOver())return 0;return null;}
function serialize(){return {kind:current.kind,mode:current.mode,puzzle:current.puzzle,moves:current.kind==='chess'?current.engine.history():current.engine.history.map(({r,c})=>({r,c})),startedAt:current.startedAt,updatedAt:Date.now(),recordId:current.recordId,archived:current.archived,result:winner()};}
function saveCurrent(){if(!current||current.puzzle)return;const finished=winner()!==null;if(finished&&!current.archived){current.archived=true;store.archives.unshift(serialize());store.archives=store.archives.slice(0,30);}store.saves[current.kind]=serialize();persist();}
function colorName(player){if(current.kind==='chess')return player===1?'白方':'黑方';if(current.kind==='tictactoe')return player===1?'叉号':'圆圈';return player===1?'黑方':'白方';}
function renderGame(){const g=games[current.kind],moves=getMoves(),turn=getTurn(),result=winner(),isAI=current.mode==='ai';
  $('#play-title').textContent=current.puzzle?'一步，将杀。':g.name;$('#play-eyebrow').textContent=current.puzzle?'THE DAILY MOVE · NO. 001':g.english+' / PLAY AT YOUR OWN PACE';$('#game-subtitle').textContent=g.english+' · CHESS & CHEERS';$('#play-description').textContent=current.puzzle?'白方先行，找到一步将死黑王的走法。':g.description;
  $('.mode-picker').hidden=current.puzzle;document.querySelectorAll('[data-mode]').forEach(el=>{el.classList.toggle('selected',el.dataset.mode===current.mode);el.disabled=current.thinking;});
  $('#opponent-name').textContent=current.puzzle?'黑方 · 待解的棋局':isAI?'弈间棋友':'棋友 · '+colorName(2);$('#opponent-desc').textContent=current.puzzle?'一步将杀挑战':isAI?'休闲电脑 · 陪你认真下一局':'本地双人 · 共用一块棋盘';$('#opponent-color').textContent=colorName(2);$('#player-color').textContent=colorName(1)+' · 先行';
  $('#player-name').textContent=result!==null?'这局，值得回味':current.thinking?'棋友正在思考…':turn===1?'你的回合':isAI?'等待棋友落子':colorName(2)+'的回合';$('#player-desc').textContent=current.puzzle?'点击白后，再选择目标格。':isAI?'你执'+colorName(1).replace('方','')+'，慢慢想，不着急。':'与你的朋友，轮流落子。';
  let status=result===null?(current.thinking?'棋友正在思考…':colorName(turn)+'落子'):result===0?'平局，也是一场好棋。':colorName(result)+'获胜';let hint=g.instruction;
  if(current.puzzle&&result!==null){status='漂亮，一步将杀！';hint='你找到了属于这局的好棋。';}
  else if(result!==null)hint='可以导出棋谱，或再开一局。';
  else if(current.kind==='reversi'){const [b,w]=current.engine.score();hint=`黑 ${b} : ${w} 白 · ${moves.at(-1)?.pass?'对方无合法落点，自动跳过。':'落在小圆点处，翻转对方棋子。'}`;}
  else if(current.kind==='chess'&&current.engine.isCheck())hint='将军！请保护你的国王。';
  else if(current.puzzle)hint='白方先行 · 找到一步将死黑王的走法';
  $('#game-status').textContent=status;$('#game-hint').textContent=hint;$('#move-count').textContent=moves.length+' 手';$('#undo-button').disabled=!moves.length||current.thinking;$('#export-button').disabled=!moves.length;
  $('.autosave-note').innerHTML=icon('check')+(current.puzzle?'每日棋题 · 完成状态保存在此浏览器':storageAvailable?'自动保存进度，随时回来接着下。':'当前无法自动保存，请导出棋谱。');
  $('#move-history').innerHTML=moves.length?Array.from({length:Math.ceil(moves.length/2)},(_,i)=>`<div class="move-row"><span>${i+1}.</span><span>${moves[2*i].label}</span><span>${moves[2*i+1]?.label||'—'}</span></div>`).join(''):'<div class="empty-moves">故事，从你的第一步开始。</div>';
  $('#move-history').scrollTop=$('#move-history').scrollHeight;renderBoard();applyAppearance();
}
function applyAppearance(){const {view,theme,angle,rotation}=store.appearance,frame=$('#board-frame');frame.dataset.view=view;frame.dataset.theme=theme;frame.style.setProperty('--board-angle',angle+'deg');frame.style.setProperty('--piece-angle',-angle+'deg');frame.style.setProperty('--board-rotation',rotation+'deg');document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));document.querySelectorAll('[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===theme)));$('.rotation-control').hidden=view!=='3d';$('#board-angle').value=angle;$('#angle-output').textContent=angle+'°';}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{store.appearance.view=button.dataset.view;applyAppearance();persist();}));
document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>{store.appearance.theme=button.dataset.theme;applyAppearance();persist();}));
$('#board-angle').addEventListener('input',event=>{store.appearance.angle=Number(event.target.value);applyAppearance();persist();});
$('#rotate-board').addEventListener('click',()=>{store.appearance.rotation=store.appearance.rotation===-5?5:-5;applyAppearance();persist();});
const pieceNames={p:'兵',r:'车',n:'马',b:'象',q:'后',k:'王'};
function renderBoard(){const board=$('#board'),kind=current.kind;$('#board-frame').className='board-frame '+kind;board.className='game-board '+(kind==='tictactoe'?'ttt':kind)+'-board';const last=getMoves().at(-1);const locked=current.thinking||winner()!==null||(current.mode==='ai'&&getTurn()===2&&!current.puzzle);
  if(kind==='chess'){
    const legal=current.selected?current.engine.moves({square:current.selected,verbose:true}).map(m=>m.to):[];
    board.innerHTML=current.engine.board().map((row,r)=>row.map((piece,c)=>{const square='abcdefgh'[c]+(8-r),dark=(r+c)%2;return `<button class="board-cell ${dark?'dark':''} ${current.selected===square?'selected':''} ${legal.includes(square)?'legal':''} ${last&&(last.to===square||last.from===square)?'last-move':''}" data-square="${square}" ${locked?'disabled':''} aria-label="${square}${piece?' '+(piece.color==='w'?'白':'黑')+pieceNames[piece.type]:''}${legal.includes(square)?' 可落子':''}" aria-pressed="${current.selected===square}">${piece?pieceSVG(piece.type,piece.color):''}${c===0||r===7?`<span class="square-label">${c===0?8-r:''}${r===7?'abcdefgh'[c]:''}</span>`:''}</button>`;}).join('')).join('');
  }else{
    const legal=kind==='reversi'?current.engine.legalMoves().map(m=>m.r+','+m.c):[];
    board.innerHTML=current.engine.board.map((row,r)=>row.map((value,c)=>{const isLast=last&&last.r===r&&last.c===c;const star=kind==='gomoku'&&[3,7,11].includes(r)&&[3,7,11].includes(c);const content=kind==='tictactoe'?(value===1?'×':value===2?'○':''):value?`<span class="stone ${value===1?'black':'white'}"></span>`:'';const winning=current.engine.winning.some(([wr,wc])=>wr===r&&wc===c);return `<button class="board-cell ${isLast?'last-move':''} ${star?'star':''} ${legal.includes(r+','+c)?'legal':''} ${value===2?'o':''} ${winning?'winning':''}" data-r="${r}" data-c="${c}" ${locked||value?'disabled':''} aria-label="${coordinate(r,c,current.engine.size)} ${value?colorName(value):'空位'}${legal.includes(r+','+c)?' 可落子':''}">${content}</button>`;}).join('')).join('');
  }
}
async function promotionChoice(){return new Promise(resolve=>{promotionResolve=resolve;showDialog('兵抵达彼岸，选择升变。','<p>选择你希望升变的棋子：</p><div style="display:flex;gap:10px">'+[['q','后'],['r','车'],['b','象'],['n','马']].map(([type,name])=>`<button class="button secondary" data-promotion="${type}">${name}</button>`).join('')+'</div>','取消');$('#dialog-body').querySelectorAll('[data-promotion]').forEach(button=>button.addEventListener('click',()=>{promotionResolve=null;resolve(button.dataset.promotion);closeDialog();}));});}
$('#board').addEventListener('click',async event=>{
  const cell=event.target.closest('.board-cell');if(!cell||cell.disabled||!current||current.thinking||winner()!==null)return;
  if(current.kind==='chess'){
    const square=cell.dataset.square,piece=current.engine.get(square),turn=current.engine.turn();
    const legal=current.selected?current.engine.moves({square:current.selected,verbose:true}).filter(m=>m.to===square):[];
    if(legal.length){let promotion;const activeSession=session;if(legal.some(m=>m.promotion)){promotion=await promotionChoice();if(!promotion||session!==activeSession)return;}current.engine.move({from:current.selected,to:square,...(promotion?{promotion}:{})});current.selected=null;
      if(current.puzzle&&!current.engine.isCheckmate()){current.engine.undo();renderGame();toast('这一步还没有将杀。再看看黑王能逃向哪里？');return;}
      if(current.puzzle){store.puzzleSolved=true;persist();toast('解题成功！将思考的乐趣，留给下一局。');}
      afterMove();
    }else if(piece&&piece.color===turn){current.selected=square;renderBoard();}else{current.selected=null;renderBoard();}
  }else{if(current.engine.move(Number(cell.dataset.r),Number(cell.dataset.c)))afterMove();else toast('这里不能落子，请选择标记的空位。');}
});
function afterMove(){playSound();saveCurrent();renderGame();scheduleBot();}
function scheduleBot(){if(!current||current.puzzle||current.mode!=='ai'||getTurn()!==2||winner()!==null)return;current.thinking=true;renderGame();const activeSession=session;botTimer=setTimeout(()=>{if(session!==activeSession||$('#play-view').hidden)return;const move=current.kind==='chess'?chooseChessMove(current.engine):chooseGridMove(current.engine);if(move){if(current.kind==='chess')current.engine.move(move);else current.engine.move(move.r,move.c);}current.thinking=false;afterMove();},450);}
$('#undo-button').addEventListener('click',()=>{if(!current||current.thinking)return;cancelBot();const engine=current.engine;if(current.kind==='chess')engine.undo();else engine.undo();if(current.mode==='ai'&&!current.puzzle)while(getMoves().length&&getTurn()===2)engine.undo();current.selected=null;current.archived=false;current.recordId=crypto.randomUUID();saveCurrent();renderGame();toast('已回到你落子之前。');});
function replaceGame(mode=current.mode){cancelBot();const {kind,puzzle}=current;current=newState(kind,mode,puzzle);saveCurrent();renderGame();}
$('#restart-button').addEventListener('click',()=>{if(!getMoves().length){toast('新棋局已经准备好了。');return;}showDialog('再开一局？','<p>本局进行中的落子记录会被新的棋局替换。你可以先取消并导出棋谱。</p>','重新开局',()=>replaceGame());});
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.mode;if(!current||current.mode===mode)return;const change=()=>replaceGame(mode);if(getMoves().length)showDialog('切换对弈模式？','<p>切换模式会开启新棋局。本局如需留存，请先取消并导出棋谱。</p>','切换并开局',change);else change();}));
$('#rules-button').addEventListener('click',()=>showDialog(current.puzzle?'每日棋题 · 一步将杀':games[current.kind].name+' · 玩法说明',`<p>${current.puzzle?'白方先行。点击白后，再点击目标格；找到一步将死黑王的走法，即可解题成功。':games[current.kind].rules}</p><p>点击「悔棋」可回到你落子之前。人机模式下，你始终执先手。</p>`));
$('#export-button').addEventListener('click',()=>{if(!current||!getMoves().length)return;const g=games[current.kind];const content=current.kind==='chess'?current.engine.pgn():JSON.stringify({title:g.name,version:1,...serialize()},null,2);const blob=new Blob([content],{type:current.kind==='chess'?'application/x-chess-pgn':'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`chess-cheers-${current.kind}-${new Date().toISOString().slice(0,10)}.${current.kind==='chess'?'pgn':'json'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('棋谱已导出，留住这一局的思考。');});
function renderRecords(){const records=[...Object.values(store.saves).filter(x=>x.moves?.length&&x.result===null),...store.archives].filter(x=>games[x.kind]);const list=$('#records-list');if(!records.length){list.innerHTML=`<div class="records-empty"><span class="eyebrow">THE FIRST MOVE IS YOURS</span><h2>这里，等待你的第一局。</h2><p>开一局棋，进度与完成的棋谱会出现在这里。</p><button class="button primary" data-play="gomoku">去下一局 ${icon('arrow')}</button></div>`;return;}list.innerHTML=records.map((record,index)=>{const date=new Date(record.updatedAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});const result=record.result===null?'进行中':record.result===0?'平局':record.kind==='chess'?(record.result===1?'白方获胜':'黑方获胜'):(record.result===1?'先手获胜':'后手获胜');return `<div class="record-card"><span class="record-symbol">${record.kind==='chess'?'♞':record.kind==='tictactoe'?'×':'◉'}</span><div><h3>${games[record.kind].name}</h3><p>${date} · ${record.mode==='ai'?'人机对弈':'本地双人'} · ${record.moves.length} 手</p></div><div class="record-right"><span>${result}</span><button class="button secondary" data-record="${index}">${record.result===null?'继续对弈':'查看终局'} ${icon('arrow')}</button></div></div>`;}).join('');list.querySelectorAll('[data-record]').forEach(button=>button.addEventListener('click',()=>{const record=records[Number(button.dataset.record)];openGame(record.kind,false,record);}));}
window.addEventListener('beforeunload',()=>{if(current)saveCurrent();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&current)saveCurrent();});
$('#today-date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
$('#hero-board').innerHTML=heroArt();$('#puzzle-mini').innerHTML=Array.from({length:16},(_,i)=>`<span class="${(Math.floor(i/4)+i%4)%2?'dark':''}">${({3:['k','b'],5:['q','w'],10:['k','w']})[i]?pieceSVG(...({3:['k','b'],5:['q','w'],10:['k','w']})[i]):''}</span>`).join('');
hydrateIcons();updateSound();renderCards();
