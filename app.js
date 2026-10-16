import { createCaptionEditor } from './captions.js';
import { clamp, uid, clipDuration, layout, totalDuration, clipAt, splitClip, validatePlugin, pluginDefaults, validateProject, timecode } from './core.js';
import { builtins } from './plugins/builtins.js';

const $ = id => document.getElementById(id);
const canvas = $('preview'), ctx = canvas.getContext('2d', { alpha: false });
const plugins = new Map(builtins.map(p => [p.id, validatePlugin(p)]));
const assets = new Map(), history = [];
let clips = [], selectedId = null, time = 0, playing = false, muted = false, zoom = 58;
let audioContext, audioDestination, speakerGain, activeAsset, activeClipId, lastFrame = 0, toastTimer, exporting = false, recorder, exportCancelled = false;
const assetColors = ['#7a6694', '#6d8b91', '#a78563', '#557969'];
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected = () => clips.find(c => c.id === selectedId);
const duration = () => totalDuration(clips);
const assetOf = clip => clip ? assets.get(clip.assetId) : null;

const captionEditor=createCaptionEditor({time:()=>time,duration,seek,checkpoint,toast,download,locked:()=>exporting,showPanel:()=>showPanel('captions'),changed:()=>{renderTimeline();draw();renderTransport();autosave();}});
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500); }
function checkpoint() { history.push({ clips: structuredClone(clips), selectedId, time, ...captionEditor.snapshot() }); if (history.length > 60) history.shift(); }
function serialize() {
  return { ...captionEditor.snapshot(), format: 'lume-project', version: 1, name: $('projectName').value, clips: structuredClone(clips), assets: [...assets.values()].map(({ id, name, type, duration, size, palette, seed }) => ({ id, name, type, duration, size, palette, seed })) };
}
function autosave() { try { localStorage.setItem('lume-project-v1', JSON.stringify(serialize())); $('saveStatus').textContent = 'Rascunho salvo'; } catch { $('saveStatus').textContent = 'Salvar projeto disponível'; } }
function refresh() { time = clamp(time, 0, duration()); renderAssets(); captionEditor.renderList(); renderTimeline(); renderInspector(); renderTransport(); draw(); autosave(); }
function addScene(addToTimeline = true) {
  const index = [...assets.values()].filter(a => a.type === 'scene').length;
  const names = ['Além do horizonte', 'O ritmo da cidade', 'Uma nova perspectiva'];
  const a = { id: uid(), name: names[index % 3], type: 'scene', duration: 5, size: 0, palette: index % 3, seed: index };
  assets.set(a.id, a); if (addToTimeline) addClip(a.id); else renderAssets(); return a;
}
function makeClip(assetId) { const a = assets.get(assetId); return { id: uid(), assetId, in: 0, out: a.duration, volume: 1, brightness: 100, saturation: 100, fit: 'contain', effects: [] }; }
function addClip(assetId) { if (exporting) return; checkpoint(); const c = makeClip(assetId); clips.push(c); selectedId = c.id; time = duration() - clipDuration(c); stop(); refresh(); }

function scene(ctx, a, t, w, h) {
  const palettes = [['#192b3c','#cc9b6b','#7f6976'], ['#252342','#6d73a6','#d6a87c'], ['#173b3f','#779d8e','#dfbb83']];
  const p = palettes[(a.palette || 0) % 3];
  const g = ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,p[0]); g.addColorStop(.57,p[2]); g.addColorStop(1,p[1]); ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  const sun = ctx.createRadialGradient(w*.72,h*.31,0,w*.72,h*.31,w*.36); sun.addColorStop(0,'#fbe6bdcc');sun.addColorStop(.16,'#edc99d66');sun.addColorStop(1,'#edc99d00');ctx.fillStyle=sun;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#f3d8b9';ctx.beginPath();ctx.arc(w*.72,h*.31,h*.068,0,Math.PI*2);ctx.fill();
  for(let layer=0;layer<5;layer++) {ctx.beginPath();ctx.moveTo(0,h);for(let x=0;x<=w+10;x+=8){const y=h*(.52+layer*.09)+Math.sin(x/w*5+layer*1.4+t*.015)*h*(.10-layer*.009)+Math.sin(x/w*12+layer)*h*.023;ctx.lineTo(x,y);}ctx.lineTo(w,h);ctx.closePath();ctx.fillStyle=['#58636b','#424f59','#303f49','#23333c','#182a33'][layer];ctx.fill();}
  ctx.strokeStyle='#ffffff0b';ctx.lineWidth=1;for(let i=0;i<48;i++){const y=((i*137.31)%h);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.fillStyle='#ffffffb0';ctx.font=`500 ${w*.009}px system-ui`;ctx.textAlign='left';ctx.fillText('EXPERIMENTE. CRIE. TRANSFORME.',w*.065,h*.77);
  ctx.fillStyle='#fff2e4';ctx.font=`500 ${w*.046}px Georgia, serif`;ctx.fillText(a.name,w*.065,h*.865);
  ctx.font=`400 ${w*.010}px system-ui`;ctx.fillStyle='#ffffff70';ctx.fillText('UM ESTUDO DE LUZ E MOVIMENTO',w*.065,h*.916);
}
function draw() {
  const w = canvas.width, h = canvas.height;
  ctx.save();ctx.fillStyle='#090b10';ctx.fillRect(0,0,w,h);
  const c=clipAt(clips, Math.min(time, Math.max(0,duration()-.00001))), a=assetOf(c);
  if (!c || !a) { ctx.fillStyle='#e8bd85';ctx.font='500 70px Georgia';ctx.textAlign='center';ctx.fillText('Toda história começa com um olhar.',w/2,h/2);ctx.fillStyle='#707887';ctx.font='22px system-ui';ctx.fillText('Importe sua mídia para começar.',w/2,h/2+55);ctx.restore();return; }
  const localTime=time-c.start;
  ctx.filter=`brightness(${c.brightness ?? 100}%) saturate(${c.saturation ?? 100}%)`;
  if(a.type==='scene') scene(ctx,a,c.in+localTime,w,h);
  else if(a.type==='audio' && a.element) { const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#152e2b');g.addColorStop(1,'#293d51');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.fillStyle='#9bc6b9';for(let i=0;i<80;i++){const amplitude=15+Math.abs(Math.sin(i*.53+localTime*3)*Math.cos(i*.17))*105;ctx.fillRect(125+i*13,h/2-amplitude/2,5,amplitude);}ctx.font='28px system-ui';ctx.textAlign='center';ctx.fillText(a.name,w/2,h*.76); }
  else if(a.element && (a.type==='image' || a.element.readyState>=2)) {
    const el=a.element, sw=el.videoWidth||el.naturalWidth, sh=el.videoHeight||el.naturalHeight;
    if(sw&&sh){const scale=c.fit==='cover'?Math.max(w/sw,h/sh):Math.min(w/sw,h/sh);ctx.drawImage(el,(w-sw*scale)/2,(h-sh*scale)/2,sw*scale,sh*scale);}
  } else {ctx.fillStyle='#6b7485';ctx.textAlign='center';ctx.font='28px system-ui';ctx.fillText(a.element?'Carregando…':'Mídia para reconectar',w/2,h/2);ctx.font='18px system-ui';ctx.fillText(a.name,w/2,h/2+38);}
  ctx.filter='none';
  const frame={width:w,height:h,time,localTime,duration:clipDuration(c),sourceTime:c.in+localTime,clipId:c.id};
  for(const effect of c.effects) {if(effect.enabled===false)continue;const p=plugins.get(effect.pluginId);if(!p)continue;ctx.save();try {p.render(ctx,frame,effect.params);}catch(e){effect.enabled=false;toast(`Plugin ${p.name} desativado: ${e.message}`);}finally{ctx.restore();}}
  captionEditor.render(ctx,time,w,h);
  ctx.restore();
}

async function setupAudio() {
  if(!audioContext) { audioContext = new AudioContext();audioDestination=audioContext.createMediaStreamDestination();speakerGain=audioContext.createGain();speakerGain.gain.value=muted?0:1;speakerGain.connect(audioContext.destination);const silence=audioContext.createConstantSource();silence.offset.value=0;silence.connect(audioDestination);silence.start(); }
  if(audioContext.state==='suspended') await audioContext.resume();
}
function connectAudio(a) {
  if(!audioContext || a.audioNode || !['video','audio'].includes(a.type)) return;
  a.audioNode=audioContext.createMediaElementSource(a.element);a.gain=audioContext.createGain();a.audioNode.connect(a.gain);a.gain.connect(speakerGain);a.gain.connect(audioDestination);
}
function stop() { playing=false;for(const a of assets.values()) if(['video','audio'].includes(a.type)&&a.element)a.element.pause();renderTransport(); }
function syncMedia(force=false) {
  const c=clipAt(clips,Math.min(time,Math.max(0,duration()-.00001))),a=assetOf(c);
  if(activeClipId!==c?.id || force) {
    if(activeAsset?.element && ['video','audio'].includes(activeAsset.type))activeAsset.element.pause();
    activeAsset=a;activeClipId=c?.id;
    if(a?.element && ['video','audio'].includes(a.type)) {connectAudio(a);const target=clamp(c.in+time-c.start,0,Math.max(0,a.duration-.001));if(Math.abs(a.element.currentTime-target)>.025)a.element.currentTime=target;if(a.gain)a.gain.gain.value=c.volume;if(playing)a.element.play().catch(e=>{if(e.name!=='AbortError'){stop();toast('Não foi possível reproduzir esta mídia.');}});}
  }
  if(a?.gain && c) a.gain.gain.value=c.volume;
}
async function play() {
  if(!clips.length || playing) return;
  try{await setupAudio();}catch(e){toast(`Áudio indisponível: ${e.message}`);return;}
  if(time>=duration()-.02)time=0;
  playing=true;lastFrame=performance.now();syncMedia(true);renderTransport();
}
function seek(value) {if(exporting)return;time=clamp(value,0,duration());syncMedia(true);draw();renderTransport();}
function frame(now) {
  const delta=Math.min((now-lastFrame)/1000,.1);lastFrame=now;
  if(playing){syncMedia();const loading=activeAsset?.element&&['video','audio'].includes(activeAsset.type)&&(activeAsset.element.seeking||activeAsset.element.readyState<2);if(!loading){time+=Math.max(0,delta);if(time>=duration()){time=duration();stop();if(exporting)finishExport();}else syncMedia();}draw();renderTransport();if(exporting){$('exportProgress').value=duration()?time/duration():0;$('exportStatus').textContent=`Exportando · ${Math.floor(time/duration()*100)} %`;}}
  requestAnimationFrame(frame);
}

function renderTransport() {
  $('currentTime').textContent=timecode(time);$('totalTime').textContent='/ '+timecode(duration());$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Pausar':'Reproduzir');$('playhead').style.left=`${time*zoom+12}px`;
  $('clipCount').textContent=`${clips.length} ${clips.length===1?'clipe':'clipes'}`;
  for(const id of ['split','delete','moveLeft','moveRight'])$(id).disabled=!selected()||exporting;
  $('undo').disabled=!history.length||exporting;
  $('projectSummary').textContent=`1280 × 720 · 30 fps · ${duration().toFixed(1)} s`;
}
function renderAssets() {
  $('assetCount').textContent=assets.size;const list=$('assetList');list.replaceChildren();
  for(const a of assets.values()){
    const el=document.createElement('div');el.className='asset-card';el.draggable=true;
    el.innerHTML=`<div class="asset-thumb" style="background:${assetColors[(a.palette??0)%4]}">${a.thumbnail?`<img src="${a.thumbnail}" alt="">`:a.type==='audio'?'♫':a.type==='scene'?'◒':'▧'}<span class="duration">${a.duration.toFixed(1)}s</span></div><button class="asset-add" title="Adicionar à timeline" aria-label="Adicionar ${safe(a.name)} à timeline">＋</button><div class="asset-title">${safe(a.name)}</div><div class="asset-type">${a.type==='scene'?'CENA ORIGINAL':a.element?a.type.toUpperCase():'RECONECTAR MÍDIA'}</div>`;
    el.addEventListener('dragstart',e=>e.dataTransfer.setData('application/lume-asset',a.id));el.querySelector('button').onclick=()=>addClip(a.id);el.ondblclick=()=>a.element||a.type==='scene'?addClip(a.id):$('mediaInput').click();list.append(el);
  }
}
function renderTimeline() {
  const width=Math.max($('timelineScroll').clientWidth,duration()*zoom+100);$('timelineInner').style.width=`${width}px`;
  const step=zoom<35?5:zoom<75?2:1;const ruler=$('ruler');ruler.replaceChildren();
  for(let s=0;s<width/zoom;s+=step){const mark=document.createElement('span');mark.className='tick';mark.style.left=`${s*zoom+12}px`;mark.textContent=timecode(s).slice(3,8);ruler.append(mark);}
  captionEditor.renderTrack(zoom);
  const track=$('videoTrack');track.replaceChildren();
  for(const c of layout(clips)){const a=assetOf(c);if(!a)continue;const el=document.createElement('div');el.className=`timeline-clip ${c.id===selectedId?'selected':''} ${a.type==='audio'?'audio':''} ${!a.element&&a.type!=='scene'?'offline':''}`;el.style.left=`${c.start*zoom+12}px`;el.style.width=`${Math.max(8,clipDuration(c)*zoom-3)}px`;el.title=`${a.name} · ${clipDuration(c).toFixed(2)} s`;el.innerHTML=`<div class="clip-top">${a.type==='audio'?'♫':'▧'} ${safe(a.name)}${c.effects.length?' ✧':''}</div>${a.thumbnail?`<img src="${a.thumbnail}" alt="">`:'<div class="clip-strip"></div>'}<span class="clip-time">${clipDuration(c).toFixed(1)}s</span>`;el.onclick=e=>{if(exporting)return;e.stopPropagation();selectedId=c.id;captionEditor.setActive(false);seek(c.start);renderTimeline();renderInspector();};track.append(el);}
}
function renderInspector() {
  if(captionEditor.renderInspector())return;
  const panel=$('inspectorContent'),c=selected(),a=assetOf(c);panel.replaceChildren();
  if(!c||!a){panel.innerHTML='<div class="empty-inspector"><span>▧</span>Selecione um clipe na timeline<br>para dar forma à sua história.</div>';return;}
  panel.innerHTML=`<div class="clip-heading"><span class="clip-mini">${a.type==='audio'?'♫':'▧'}</span><div><strong>${safe(a.name)}</strong><small>${clipDuration(c).toFixed(2)} s · ${a.type==='scene'?'Cena original':a.type}</small></div></div><div class="section-label">Duração <span>SEGUNDOS</span></div><div class="trim-fields"><div class="property"><label for="trimIn">Entrada</label><input id="trimIn" type="number" min="0" max="${c.out-.1}" step="0.1" value="${c.in.toFixed(2)}"></div><div class="property"><label for="trimOut">Saída</label><input id="trimOut" type="number" min="${c.in+.1}" max="${a.duration}" step="0.1" value="${c.out.toFixed(2)}"></div></div><div class="section-label">Imagem</div>`;
  for(const [id,key] of [['trimIn','in'],['trimOut','out']])$(id).onchange=e=>{if(exporting)return;const n=Number(e.target.value);if(!Number.isFinite(n))return;checkpoint();c[key]=key==='in'?clamp(n,0,c.out-.1):clamp(n,c.in+.1,a.duration);stop();time=layout(clips).find(x=>x.id===c.id).start;syncMedia(true);refresh();};
  addSlider(panel,'Exposição',c.brightness??100,30,180,1,'%',value=>c.brightness=value);
  addSlider(panel,'Saturação',c.saturation??100,0,200,1,'%',value=>c.saturation=value);
  const fit=document.createElement('button');fit.className='import-button';fit.textContent=c.fit==='cover'?'Enquadramento: preencher ↔':'Enquadramento: ajustar ↔';fit.onclick=()=>{if(exporting)return;checkpoint();c.fit=c.fit==='cover'?'contain':'cover';refresh();};panel.append(fit);
  const audioLabel=document.createElement('div');audioLabel.className='section-label';audioLabel.textContent='Áudio original';panel.append(audioLabel);addSlider(panel,'Volume',Math.round(c.volume*100),0,200,1,'%',value=>{c.volume=value/100;syncMedia();});
  const label=document.createElement('div');label.className='section-label';label.innerHTML=`Efeitos <span>${c.effects.length}</span>`;panel.append(label);
  if(!c.effects.length){const empty=document.createElement('button');empty.className='import-button';empty.textContent='✧ Adicionar efeito';empty.onclick=()=>showPanel('plugins');panel.append(empty);}
  for(const effect of c.effects){const p=plugins.get(effect.pluginId);const card=document.createElement('div');card.className='effect-chip';card.innerHTML=`<div class="effect-chip-header"><span>${safe(p?.name??'Plugin ausente: '+effect.pluginId)}</span><button aria-label="Remover efeito" title="Remover efeito">×</button></div>`;card.querySelector('button').onclick=()=>{if(exporting)return;checkpoint();c.effects=c.effects.filter(e=>e.id!==effect.id);refresh();};
    if(p) for(const param of p.parameters||[]){if(param.type==='range')addSlider(card,param.label,effect.params[param.key],param.min,param.max,param.step||.01,'',v=>effect.params[param.key]=v);else{const wrap=document.createElement('div');wrap.className='property';const label=document.createElement('label');label.textContent=param.label;const input=document.createElement('input');input.type=param.type;input.value=effect.params[param.key];input.setAttribute('aria-label',param.label);input.onfocus=checkpoint;input.oninput=()=>{if(exporting)return;effect.params[param.key]=input.value;draw();autosave();};wrap.append(label,input);card.append(wrap);}}panel.append(card);}
}
function addSlider(parent,label,value,min,max,step,unit,onInput){const wrap=document.createElement('div');wrap.className='property';const id=uid();wrap.innerHTML=`<label for="${id}">${safe(label)}<output>${Number(value).toFixed(step<1?2:0)}${unit}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${safe(label)}">`;const input=wrap.querySelector('input');input.onpointerdown=()=>{if(!exporting)checkpoint();};input.onkeydown=e=>{if(e.key.startsWith('Arrow')&&!exporting)checkpoint();};input.oninput=()=>{if(exporting)return;onInput(Number(input.value));wrap.querySelector('output').textContent=Number(input.value).toFixed(step<1?2:0)+unit;draw();autosave();};parent.append(wrap);}
function renderPlugins(){const list=$('pluginList');list.replaceChildren();for(const p of plugins.values()){const b=document.createElement('button');b.className='plugin-card';b.innerHTML=`<span class="plugin-symbol">${safe(p.icon||'✧')}</span><div><small>${safe(p.category||'PLUGIN')}</small><br><strong>${safe(p.name)}</strong><p>${safe(p.description||'Adicione este efeito ao clipe selecionado.')}</p></div>`;b.onclick=()=>{if(exporting)return;const c=selected();if(!c){toast('Selecione um clipe na timeline primeiro.');return;}checkpoint();c.effects.push({id:uid(),pluginId:p.id,params:pluginDefaults(p),enabled:true});refresh();toast(`${p.name} adicionado ao clipe.`);};list.append(b);}}
function showPanel(name){captionEditor.setActive(name==='captions');for(const key of ['media','captions','plugins','help'])$(key+'Panel').hidden=key!==name;$('panelTitle').textContent={media:'Sua biblioteca',captions:'Legendas',plugins:'Explore os plugins',help:'No seu ritmo'}[name];$('assetCount').hidden=name!=='media';document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));captionEditor.renderList();renderInspector();}

function waitFor(element,event,timeout=15000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(new Error('Tempo de leitura excedido.')),timeout);const ok=()=>done();const error=()=>done(new Error('Formato não suportado pelo navegador.'));function done(err){clearTimeout(timer);element.removeEventListener(event,ok);element.removeEventListener('error',error);err?reject(err):resolve();}element.addEventListener(event,ok,{once:true});element.addEventListener('error',error,{once:true});});}
async function importFiles(files){if(exporting)return;for(const file of files){const type=file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':file.type.startsWith('image/')?'image':null;if(!type){toast(`Formato não reconhecido: ${file.name}`);continue;}const url=URL.createObjectURL(file);try{
    let element, length, thumbnail;
    if(type==='image'){element=new Image();const ready=waitFor(element,'load');element.src=url;await ready;length=5;}else{element=document.createElement(type);element.preload='auto';element.playsInline=true;const ready=waitFor(element,'loadeddata');element.src=url;await ready;length=element.duration;if(!Number.isFinite(length)){const endSeek=waitFor(element,'seeked');element.currentTime=1e10;await endSeek;length=Number.isFinite(element.duration)?element.duration:element.currentTime;const startSeek=waitFor(element,'seeked');element.currentTime=0;await startSeek;}if(!Number.isFinite(length)||length<=0)throw new Error('Duração de mídia inválida.');element.onseeked=()=>{if(!playing)draw();};}
    if(type!=='audio'){const thumb=document.createElement('canvas');thumb.width=200;thumb.height=112;thumb.getContext('2d').drawImage(element,0,0,200,112);thumbnail=thumb.toDataURL('image/jpeg',.7);}
    const old=[...assets.values()].find(a=>a.type!=='scene'&&!a.element&&a.name===file.name&&(a.size===undefined||a.size===file.size));
    if(old&&clips.some(c=>c.assetId===old.id&&c.out>length+.01))throw new Error('A mídia reconectada é mais curta que os cortes salvos.');
    const a={id:old?.id||uid(),name:file.name,type,duration:old?.duration??length,size:file.size,url,element,thumbnail,palette:assets.size%4};assets.set(a.id,a);toast(old?`${file.name} reconectado.`:`${file.name} importado.`);
  }catch(e){URL.revokeObjectURL(url);toast(`Não foi possível importar ${file.name}: ${e.message}`);}}
  refresh();}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function safeFilename(){return ($('projectName').value||'projeto-lume').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,100);}
function restore(data){validateProject(data);captionEditor.restore(data);stop();activeAsset=null;activeClipId=null;for(const a of assets.values())if(a.url)URL.revokeObjectURL(a.url);assets.clear();for(const {id,name,type,duration,size,palette,seed} of data.assets)assets.set(id,{id,name,type,duration,size,palette,seed});clips=data.clips;selectedId=clips[0]?.id;time=0;history.length=0;$('projectName').value=String(data.name||'Meu projeto');refresh();if([...assets.values()].some(a=>a.type!=='scene'))toast('Importe novamente os arquivos originais para reconectar as mídias.');}

async function startExport(){
  if(exporting||!clips.length)return;
  if(!window.MediaRecorder||!canvas.captureStream){toast('Este navegador não oferece exportação de vídeo. Use Chrome ou Edge.');return;}
  if(clips.some(c=>{const a=assetOf(c);return !a || (a.type!=='scene'&&!a.element);})){toast('Reconecte todas as mídias antes de exportar.');return;}
  if(clips.some(c=>c.effects.some(e=>!plugins.has(e.pluginId)))){toast('Instale os plugins ausentes antes de exportar.');return;}
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime){toast('Exportação WebM indisponível neste navegador.');return;}
  try{
    stop();await setupAudio();time=0;syncMedia(true);
    const a=assetOf(clipAt(clips,0));if(a?.element&&['video','audio'].includes(a.type)&&a.element.seeking)await waitFor(a.element,'seeked');
    draw();const stream=canvas.captureStream(30);for(const track of audioDestination.stream.getAudioTracks())stream.addTrack(track.clone());
    const chunks=[];exportCancelled=false;recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8_000_000,audioBitsPerSecond:192_000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=()=>{exportCancelled=true;finishExport();toast('Falha na gravação do vídeo.');};
    recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());try{if(!exportCancelled){const blob=new Blob(chunks,{type:mime});if(!blob.size)throw new Error('O navegador não produziu quadros.');$('exportStatus').textContent='Salvando vídeo no dispositivo…';const response=await fetch('/api/exports?name='+encodeURIComponent(safeFilename()),{method:'POST',headers:{'Content-Type':'video/webm'},body:blob});if(!response.ok)throw new Error('Não foi possível salvar no servidor local.');const result=await response.json();const link=document.createElement('a');link.href=result.url;link.download=safeFilename()+'.webm';link.click();$('exportStatus').textContent=`Vídeo exportado · ${(result.bytes/1024/1024).toFixed(2)} MB · salvo na pasta exports.`;$('exportProgress').value=1;}else $('exportStatus').textContent='Exportação cancelada.';}catch(error){$('exportStatus').textContent='Falha ao salvar: '+error.message;toast(error.message);}finally{exporting=false;$('startExport').hidden=false;$('startExport').disabled=false;$('cancelExport').hidden=true;$('closeExport').disabled=false;renderTransport();}};
    exporting=true;$('startExport').hidden=true;$('cancelExport').hidden=false;$('closeExport').disabled=true;$('exportProgress').value=0;recorder.start(250);await play();
  }catch(e){exporting=false;stop();$('startExport').hidden=false;$('cancelExport').hidden=true;$('closeExport').disabled=false;toast(`Falha na exportação: ${e.message}`);}
}
function finishExport(){stop();if(recorder?.state!=='inactive')recorder?.stop();}

$('import').onclick=()=>$('mediaInput').click();$('mediaInput').onchange=async e=>{await importFiles(e.target.files);e.target.value='';};$('demo').onclick=()=>addScene();
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
$('play').onclick=()=>{if(exporting)return;playing?stop():play();};$('previous').onclick=()=>seek(0);$('next').onclick=()=>seek(duration());
$('mute').onclick=()=>{muted=!muted;if(speakerGain)speakerGain.gain.value=muted?0:1;$('mute').style.color=muted?'#e7ba7d':'';$('mute').setAttribute('aria-label',muted?'Ativar som':'Silenciar');};
function split(){if(exporting)return;if(captionEditor.isActive()){captionEditor.split();return;}const c=selected();if(!c)return;const position=layout(clips).find(x=>x.id===c.id);const result=splitClip(clips,c.id,time-position.start);if(result===clips){toast('Posicione o cursor dentro do clipe para dividir.');return;}checkpoint();clips=result;stop();refresh();toast('Clipe dividido.');}
$('split').onclick=split;$('delete').onclick=()=>{if(!$('captionsPanel').hidden){captionEditor.remove();return;}if(exporting||!selected())return;checkpoint();clips=clips.filter(c=>c.id!==selectedId);selectedId=clips[0]?.id;stop();syncMedia(true);refresh();};
$('undo').onclick=()=>{if(exporting)return;const state=history.pop();if(!state)return;stop();({clips,selectedId,time}=state);captionEditor.restore(state);syncMedia(true);refresh();};
function move(direction){if(exporting)return;const i=clips.findIndex(c=>c.id===selectedId);if(i<0||i+direction<0||i+direction>=clips.length)return;checkpoint();[clips[i],clips[i+direction]]=[clips[i+direction],clips[i]];stop();time=layout(clips).find(c=>c.id===selectedId).start;syncMedia(true);refresh();}
$('moveLeft').onclick=()=>move(-1);$('moveRight').onclick=()=>move(1);
$('zoom').oninput=e=>{zoom=Number(e.target.value);renderTimeline();renderTransport();};$('fit').onclick=()=>{zoom=clamp(($('timelineScroll').clientWidth-80)/Math.max(1,duration()),20,150);$('zoom').value=zoom;renderTimeline();renderTransport();};
function timelineSeek(e){if(exporting||e.target.closest('.timeline-clip'))return;const r=$('timelineInner').getBoundingClientRect();seek((e.clientX-r.left-12)/zoom);}
$('ruler').onpointerdown=e=>{timelineSeek(e);$('ruler').setPointerCapture(e.pointerId);};$('ruler').onpointermove=e=>{if(e.buttons===1)timelineSeek(e);};$('videoTrack').onpointerdown=timelineSeek;
$('videoTrack').ondragover=e=>e.preventDefault();$('videoTrack').ondrop=e=>{e.preventDefault();const id=e.dataTransfer.getData('application/lume-asset');if(assets.has(id))addClip(id);};
let dragCounter=0;document.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){dragCounter++;document.body.classList.add('dragging');}});document.addEventListener('dragleave',()=>{if(--dragCounter<=0){dragCounter=0;document.body.classList.remove('dragging');}});document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>{e.preventDefault();dragCounter=0;document.body.classList.remove('dragging');if(e.dataTransfer.files.length)importFiles(e.dataTransfer.files);});
$('loadPlugin').onclick=()=>$('pluginInput').click();$('pluginInput').onchange=async e=>{if(exporting)return;const file=e.target.files[0];if(!file)return;const url=URL.createObjectURL(file);try{const module=await import(url);const p=validatePlugin(module.default);if(plugins.has(p.id))throw new Error('Já existe um plugin com este id.');plugins.set(p.id,p);renderPlugins();renderInspector();draw();toast(`${p.name} instalado nesta sessão.`);}catch(err){toast(`Plugin não instalado: ${err.message}`);}finally{URL.revokeObjectURL(url);e.target.value='';}};
$('saveProject').onclick=()=>{if(exporting)return;download(JSON.stringify(serialize(),null,2),safeFilename()+'.lume','application/json');toast('Projeto salvo. Guarde também os arquivos de mídia originais.');};$('openProject').onclick=()=>{if(!exporting)$('projectInput').click();};$('projectInput').onchange=async e=>{try{const file=e.target.files[0];if(file)restore(JSON.parse(await file.text()));}catch(err){toast(`Não foi possível abrir: ${err.message}`);}e.target.value='';};$('projectName').onchange=autosave;
$('export').onclick=()=>{if(!clips.length){toast('Adicione um clipe antes de exportar.');return;}$('exportDialog').showModal();};$('startExport').onclick=startExport;$('cancelExport').onclick=()=>{exportCancelled=true;finishExport();};$('exportDialog').addEventListener('cancel',e=>{if(exporting)e.preventDefault();});
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||$('exportDialog').open||exporting)return;if(e.code==='Space'){e.preventDefault();playing?stop():play();}if(e.key.toLowerCase()==='s'&&!e.ctrlKey&&!e.metaKey)split();if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('delete').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click();}if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();seek(time+(e.key==='ArrowRight'?1:-1)/30);}if(e.key==='Home'){e.preventDefault();seek(0);}});
document.addEventListener('visibilitychange',()=>{if(exporting&&document.hidden){exportCancelled=true;finishExport();toast('A exportação foi cancelada porque a aba ficou oculta. Mantenha-a visível e tente novamente.');}});
window.addEventListener('resize',()=>{renderTimeline();renderTransport();});
renderPlugins();
try{const saved=localStorage.getItem('lume-project-v1');if(saved)restore(JSON.parse(saved));else{for(let i=0;i<3;i++){const a=addScene(false);clips.push(makeClip(a.id));}selectedId=clips[0].id;clips[0].effects.push({id:uid(),pluginId:'lume.vignette',params:{amount:.35},enabled:true});refresh();}}catch{assets.clear();clips=[];const a=addScene(false);clips.push(makeClip(a.id));selectedId=clips[0].id;refresh();}
requestAnimationFrame(frame);
