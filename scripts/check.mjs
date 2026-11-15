import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const file of ['index.html','styles.css','experience.css','app.js','engines.js','art.js','board3d.js','effects.js','move-events.js','xiangqi.js','go.js','connect4.js','jungle.js','tiaoqi.js','game-rules.js','xiangqi-endgame.js','xiangqi-endgame-table.js','rubik-engine.js','rubik-3d.js','luban-3d.js','assets/xiangqi-board.svg','assets/favicon.svg','assets/terrain.svg','assets/world.svg','vendor/chess.js','vendor/CHESS-LICENSE.txt','vendor/three.module.js','vendor/three.core.js','vendor/OrbitControls.js','vendor/THREE-LICENSE.txt']) {
  if (!existsSync('dist/'+file)) throw new Error('Missing asset: '+file);
}
for(const file of ['app.js','engines.js','art.js','board3d.js','effects.js','move-events.js','xiangqi.js','go.js','connect4.js','jungle.js','tiaoqi.js','game-rules.js','xiangqi-endgame.js','xiangqi-endgame-table.js','rubik-engine.js','rubik-3d.js','luban-3d.js']){const r=spawnSync(process.execPath,['--check','dist/'+file],{stdio:'inherit'});if(r.status!==0)process.exit(r.status);}
const html=readFileSync('dist/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(!match[1].startsWith('http')&&!existsSync('dist/'+match[1]))throw new Error('Broken asset '+match[1]);}
console.log('Static build validated: all modules and local assets are ready.');
