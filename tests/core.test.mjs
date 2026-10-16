import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, clipAt, splitClip, totalDuration, validatePlugin, validateProject, timecode } from '../core.js';
import { builtins } from '../plugins/builtins.js';
import example from '../plugins/example.js';
import { createServer } from '../server.mjs';
import { unlink } from 'node:fs/promises';
const clips=[{id:'a',assetId:'asset',in:2,out:7,volume:1,effects:[]},{id:'b',assetId:'asset',in:0,out:3,volume:1,effects:[]}];
test('cortes preservam duração, efeitos independentes e limites da sequência',()=>{
  const split=splitClip(clips,'a',2,'new');assert.equal(totalDuration(split),8);assert.deepEqual(split.slice(0,2).map(c=>[c.in,c.out]),[[2,4],[4,7]]);
  split[0].effects.push('effect');assert.deepEqual(split[1].effects,[]);assert.deepEqual(clips[0].effects,[]);
  assert.equal(clipAt(clips,5).id,'b');assert.equal(clipAt(clips,8),null);assert.equal(layout(split)[2].start,5);assert.equal(splitClip(clips,'a',0),clips);
});
test('projetos inválidos e plugins incompatíveis são recusados',()=>{
  const data={format:'lume-project',version:1,assets:[{id:'asset',type:'video',duration:10}],clips};assert.equal(validateProject(data),data);
  assert.throws(()=>validateProject({...data,clips:[{...clips[0],out:11}]}));assert.throws(()=>validateProject({...data,clips:[{...clips[0],volume:NaN}]}));
  for(const p of [...builtins,example])assert.equal(validatePlugin(p),p);assert.throws(()=>validatePlugin({...example,apiVersion:2}));
});
test('timecode usa quadros e troca de minuto',()=>{assert.equal(timecode(61.5),'00:01:01:15');assert.equal(timecode(-1),'00:00:00:00');});
test('servidor entrega a aplicação e bloqueia caminhos fora da raiz',async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Lume/);const js=await fetch(base+'/app.js');assert.match(js.headers.get('content-type'),/javascript/);assert.equal((await fetch(base+'/%2e%2e%5cpackage.json')).status,403);assert.equal((await fetch(base+'/server.mjs')).status,404);}finally{await new Promise(r=>server.close(r));}
});
test('exportação local preserva bytes e recusa gravação de outra origem',async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;let saved;
  try{
    const blocked=await fetch(base+'/api/exports',{method:'POST',headers:{Origin:'https://example.com'},body:'not allowed'});assert.equal(blocked.status,403);
    const bytes=new Uint8Array([0x1a,0x45,0xdf,0xa3,1,2,3]);const response=await fetch(base+'/api/exports?name=teste-automatico',{method:'POST',headers:{Origin:base},body:bytes});assert.equal(response.status,201);saved=await response.json();assert.equal(saved.bytes,bytes.length);assert.deepEqual(new Uint8Array(await (await fetch(base+saved.url)).arrayBuffer()),bytes);
  }finally{if(saved)await unlink(new URL('../'+decodeURIComponent(saved.url.slice(1)),import.meta.url));await new Promise(r=>server.close(r));}
});
