import http from 'node:http';
import { readFile, mkdir, stat, unlink } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === '/api/exports' && req.method === 'POST') {
        if (req.headers.origin !== `http://${req.headers.host}`) { res.writeHead(403).end(); return; }
        await mkdir(path.join(root, 'exports'), { recursive: true });
        const name = (requestUrl.searchParams.get('name') || 'lume').replace(/[^\p{L}\p{N} _-]/gu, '-').slice(0,80);
        const filename = `${name}-${randomUUID().slice(0,8)}.webm`;
        const destination = path.join(root,'exports',filename);
        let bytes = 0;
        const limiter = new Transform({ transform(chunk, encoding, callback) { bytes += chunk.length; callback(bytes > 2_000_000_000 ? new Error('Exportação excede 2 GB.') : null, chunk); } });
        try { await pipeline(req, limiter, createWriteStream(destination, { flags: 'wx' })); if (!bytes) throw new Error('Vídeo vazio.'); }
        catch (err) { await unlink(destination).catch(()=>{}); throw err; }
        res.writeHead(201, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ url: `/exports/${encodeURIComponent(filename)}`, bytes })); return;
      }
      if (pathname.startsWith('/exports/') && req.method === 'GET') {
        const filename = pathname.slice('/exports/'.length);
        if (path.basename(filename) !== filename || !filename.endsWith('.webm') || filename.includes('\\')) { res.writeHead(403).end(); return; }
        const target = path.join(root,'exports',filename), info = await stat(target);
        res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': info.size, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` }); createReadStream(target).pipe(res); return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
      const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!target.startsWith(root + path.sep) || pathname.includes('\\')) { res.writeHead(403).end(); return; }
      if (!['.html', '.css', '.js', '.json', '.svg'].includes(path.extname(target))) { res.writeHead(404).end(); return; }
      const body = await readFile(target);
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(body);
    } catch { res.writeHead(404).end('Não encontrado'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4318);
  createServer().listen(port, '127.0.0.1', () => console.log(`Lume aberto em http://127.0.0.1:${port}`));
}
