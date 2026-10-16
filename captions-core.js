export const defaultCaptionStyle = { font:'sans-serif', size:48, color:'#ffffff', stroke:'#101115', strokeWidth:3, background:'#101115', backgroundOpacity:0, y:85, width:84, align:'center', bold:true, italic:false, uppercase:false, shadow:true };
export function normalizeCaptionStyle(input = {}) {
  const s={...defaultCaptionStyle};
  for(const key of ['font','align']) if((key==='font'?['sans-serif','serif','monospace']:['left','center','right']).includes(input[key]))s[key]=input[key];
  for(const key of ['color','stroke','background'])if(/^#[0-9a-f]{6}$/i.test(input[key]||''))s[key]=input[key];
  for(const [key,min,max] of [['size',18,100],['strokeWidth',0,10],['backgroundOpacity',0,1],['y',5,95],['width',40,95]])if(Number.isFinite(input[key]))s[key]=Math.min(max,Math.max(min,input[key]));
  for(const key of ['bold','italic','uppercase','shadow'])if(typeof input[key]==='boolean')s[key]=input[key];
  return s;
}
export function validateCaptions(captions) {
  if(!Array.isArray(captions)||captions.length>10000)throw new Error('Lista de legendas inválida.');
  const ids=new Set();
  for(const c of captions){if(!c||typeof c.id!=='string'||ids.has(c.id)||typeof c.text!=='string'||c.text.length>10000||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start)throw new Error('Legenda com texto ou intervalo inválido.');ids.add(c.id);}
  return captions;
}
function seconds(text) {const m=text.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})$/);if(!m||Number(m[2])>59||Number(m[3])>59)throw new Error('Tempo inválido na legenda: '+text);return Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000;}
export function parseSubtitles(text, makeId = ()=>crypto.randomUUID()) {
  const blocks=text.replace(/^\uFEFF/,'').replace(/\r/g,'').split(/\n\s*\n/);const result=[];
  for(const block of blocks){const lines=block.trim().split('\n');if(!lines[0]||/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(lines[0]))continue;const index=lines.findIndex(l=>l.includes('-->'));if(index<0)throw new Error('Bloco de legenda sem intervalo de tempo.');const [a,b]=lines[index].split('-->');const start=seconds(a),end=seconds(b.trim().split(/\s/)[0]);const value=lines.slice(index+1).join('\n').replace(/<[^>]*>/g,'');if(!value.trim())throw new Error('Legenda sem texto.');result.push({id:makeId(),start,end,text:value});}
  if(!result.length)throw new Error('Nenhuma legenda encontrada no arquivo.');return validateCaptions(result).sort((a,b)=>a.start-b.start);
}
export function subtitleTimestamp(value, separator=',') {let ms=Math.round(value*1000);const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);ms%=60000;const s=Math.floor(ms/1000);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${separator}${String(ms%1000).padStart(3,'0')}`;}
export function subtitlesToSrt(captions){validateCaptions(captions);return [...captions].sort((a,b)=>a.start-b.start).map((c,i)=>`${i+1}\n${subtitleTimestamp(c.start)} --> ${subtitleTimestamp(c.end)}\n${c.text}`).join('\n\n')+'\n';}
export function wrapCaption(text, maxWidth, measure) {
  const lines=[];
  for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(measure(word)>maxWidth){if(line){lines.push(line);line='';}for(const char of word){if(line&&measure(line+char)>maxWidth){lines.push(line);line='';}line+=char;}}else if(line&&measure(line+' '+word)>maxWidth){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);}
  return lines;
}
export function renderCaptions(ctx,captions,style,time,w,h) {
  const visible=captions.filter(c=>c.start<=time&&time<c.end);if(!visible.length)return;
  const s=normalizeCaptionStyle(style);ctx.save();ctx.filter='none';ctx.font=`${s.italic?'italic ':''}${s.bold?'700':'400'} ${s.size}px ${s.font}`;ctx.textBaseline='middle';ctx.textAlign=s.align;ctx.lineJoin='round';
  const maxWidth=w*s.width/100,lineHeight=s.size*1.25,margin=(w-maxWidth)/2;
  const blocks=visible.map(c=>wrapCaption(s.uppercase?c.text.toLocaleUpperCase('pt-BR'):c.text,maxWidth,t=>ctx.measureText(t).width));
  const total=blocks.reduce((sum,l)=>sum+l.length*lineHeight+12,0)-12;let y=Math.min(h-12-total,Math.max(12,h*s.y/100-total/2));
  for(const lines of blocks){for(const line of lines){const lineWidth=ctx.measureText(line).width;const x=s.align==='left'?margin:s.align==='right'?w-margin:w/2;const left=s.align==='left'?x:s.align==='right'?x-lineWidth:x-lineWidth/2;
    ctx.shadowBlur=0;if(s.backgroundOpacity>0&&line){ctx.fillStyle=s.background;ctx.globalAlpha=s.backgroundOpacity;ctx.fillRect(left-14,y-3,lineWidth+28,lineHeight+6);ctx.globalAlpha=1;}
    ctx.shadowColor=s.shadow?'#000000bb':'transparent';ctx.shadowBlur=s.shadow?8:0;ctx.shadowOffsetY=s.shadow?2:0;ctx.strokeStyle=s.stroke;ctx.lineWidth=s.strokeWidth*2;if(s.strokeWidth>0)ctx.strokeText(line,x,y+lineHeight/2);ctx.fillStyle=s.color;ctx.fillText(line,x,y+lineHeight/2);y+=lineHeight;}y+=12;}
  ctx.restore();
}
