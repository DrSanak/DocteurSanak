/* Serveur local pour tester le questionnaire pré-opératoire sans Netlify CLI.
   Sert site_final-3-6/ sur http://localhost:8765 et exécute la fonction
   netlify/functions/questionnaire.js. Sans BREVO_API_KEY, le mail n'est pas
   envoyé : le PDF est écrit dans scripts/out/ à la place.

   Usage : node scripts/questionnaire-dev-server.mjs
   (npm install doit avoir été lancé dans site_final-3-6/) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', 'site_final-3-6');
const OUT = path.join(HERE, 'out');
const PORT = Number(process.env.PORT || 8765);

process.env.RATE_LIMIT_SALT = process.env.RATE_LIMIT_SALT || 'dev';
if (!process.env.BREVO_API_KEY) {
  process.env.BREVO_API_KEY = 'dry-run';
  process.env.QUESTIONNAIRE_TO = process.env.QUESTIONNAIRE_TO || 'dev@example.com';
  process.env.QUESTIONNAIRE_FROM = process.env.QUESTIONNAIRE_FROM || 'dev@example.com';
  fs.mkdirSync(OUT, { recursive: true });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (!String(url).includes('api.brevo.com')) return realFetch(url, opts);
    const b = JSON.parse(opts.body);
    const file = path.join(OUT, b.attachment[0].name);
    fs.writeFileSync(file, Buffer.from(b.attachment[0].content, 'base64'));
    console.log('[dry-run] mail non envoyé, PDF écrit :', file);
    return new Response('{}', { status: 201 });
  };
}

const fn = (await import(path.join(ROOT, 'netlify/functions/questionnaire.js'))).default;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/.netlify/functions/questionnaire') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await fn(new Request('http://localhost:' + PORT + u.pathname, { method: req.method, headers: req.headers, body: Buffer.concat(chunks) }), { ip: req.socket.remoteAddress });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
    return;
  }
  let p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p) && fs.existsSync(p + '/index.html')) p += '/index.html';
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log('Questionnaire : http://localhost:' + PORT + '/bilan/questionnaire/'));
