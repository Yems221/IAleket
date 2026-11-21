// Outil de dessin du logo (développement seulement, jamais déployé).
// Sert la scène three.js du logo et enregistre les images rendues dans public/icons/ et public/brand/.
//   node tools/logo/server.mjs   puis ouvrir http://localhost:8799
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const TYPES = { '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    const save = url.pathname.match(/^\/save\/(icons|brand)\/([a-z0-9-]+\.png)$/);
    if (req.method === 'POST' && save) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      await writeFile(join(root, 'public', save[1], save[2]), Buffer.concat(chunks));
      res.writeHead(200).end('ok');
      return;
    }
    const base = url.pathname.startsWith('/three/') ? join(root, 'node_modules') : here;
    const file = normalize(join(base, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(base)) throw new Error('hors dossier');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('introuvable');
  }
}).listen(8799, () => console.log('Logo : http://localhost:8799'));
