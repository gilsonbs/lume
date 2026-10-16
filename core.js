import { validateCaptions } from './captions-core.js';
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const uid = () => globalThis.crypto.randomUUID();
export const clipDuration = clip => Math.max(0, clip.out - clip.in);
export function layout(clips) {
  let cursor = 0;
  return clips.map(clip => { const start = cursor; cursor += clipDuration(clip); return { ...clip, start, end: cursor }; });
}
export const totalDuration = clips => clips.reduce((sum, clip) => sum + clipDuration(clip), 0);
export function clipAt(clips, time) { return layout(clips).find(c => time >= c.start && time < c.end) || null; }
export function splitClip(clips, id, localTime, newId = uid()) {
  const index = clips.findIndex(c => c.id === id);
  if (index < 0) return clips;
  const c = clips[index], cut = c.in + localTime;
  if (cut - c.in < 0.1 || c.out - cut < 0.1) return clips;
  const result = structuredClone(clips);
  result.splice(index, 1, { ...structuredClone(c), out: cut }, { ...structuredClone(c), id: newId, in: cut });
  return result;
}
export function validatePlugin(plugin) {
  if (!plugin || !/^[a-z0-9][a-z0-9.-]{1,63}$/.test(plugin.id || '')) throw new Error('Plugin precisa de um id válido.');
  if (plugin.apiVersion !== 1) throw new Error('Versão de API incompatível. Use apiVersion: 1.');
  if (typeof plugin.name !== 'string' || !plugin.name.trim()) throw new Error('Plugin precisa de um nome.');
  if (typeof plugin.render !== 'function') throw new Error('Plugin precisa implementar render(ctx, frame, params).');
  for (const p of plugin.parameters || []) {
    if (!p.key || !['range', 'text', 'color'].includes(p.type)) throw new Error('Parâmetro de plugin inválido.');
    if (p.type === 'range' && (!Number.isFinite(p.min) || !Number.isFinite(p.max) || p.max <= p.min || !Number.isFinite(p.default) || p.default < p.min || p.default > p.max)) throw new Error('Intervalo do parâmetro inválido.');
  }
  return plugin;
}
export function pluginDefaults(plugin) { return Object.fromEntries((plugin.parameters || []).map(p => [p.key, p.default ?? ''])); }
export function validateProject(data) {
  if(data?.captions!==undefined)validateCaptions(data.captions);
  if (data?.format !== 'lume-project' || data.version !== 1 || !Array.isArray(data.clips) || !Array.isArray(data.assets)) throw new Error('Arquivo de projeto incompatível.');
  const ids = new Set();
  for (const asset of data.assets) {
    if (!asset.id || ids.has(asset.id) || !['video', 'image', 'audio', 'scene'].includes(asset.type) || !Number.isFinite(asset.duration) || asset.duration <= 0) throw new Error('Mídia inválida no projeto.');
    ids.add(asset.id);
  }
  const clipIds = new Set();
  for (const c of data.clips) {
    if (!c.id || !ids.has(c.assetId) || !Number.isFinite(c.in) || !Number.isFinite(c.out) || c.in < 0 || c.out <= c.in || c.out > data.assets.find(a => a.id === c.assetId).duration + 0.01 || !Array.isArray(c.effects)) throw new Error('Clipe inválido no projeto.');
    if (!Number.isFinite(c.volume) || c.volume < 0 || c.volume > 2) throw new Error('Volume inválido no projeto.');
    if (clipIds.has(c.id)) throw new Error('Identificador de clipe duplicado.');
    clipIds.add(c.id);
    for (const effect of c.effects) if (!effect || typeof effect.id !== 'string' || typeof effect.pluginId !== 'string' || !effect.params || typeof effect.params !== 'object' || Array.isArray(effect.params)) throw new Error('Efeito inválido no projeto.');
  }
  return data;
}
export function timecode(seconds, fps = 30) {
  const frames = Math.floor(Math.max(0, seconds) * fps + 0.0001);
  return [Math.floor(frames / (fps * 3600)), Math.floor(frames / (fps * 60)) % 60, Math.floor(frames / fps) % 60, frames % fps].map(n => String(n).padStart(2, '0')).join(':');
}
