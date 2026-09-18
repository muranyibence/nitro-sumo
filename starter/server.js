// Nulla fuggosegu statikus kiszolgalo. Csak azert kell, mert a bongeszo a
// JavaScript modulokat nem tolti be file:// cimrol.
//
//   node server.js        ->  http://localhost:8080
//
// Ha a 8080 foglalt:  PORT=8081 node server.js

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

const app = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' || path.endsWith('/')) path += 'index.html';
    const file = join(ROOT, normalize(path));
    // Ne lehessen kilepni a mappabol egy ../../ segitsegevel.
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('tiltott'); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      // Fejlesztes kozben a gyorsitotar csak zavar: minden ujratoltes friss.
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('nincs ilyen fajl');
  }
});

/** Megnyitja az alapertelmezett bongeszot. NO_OPEN=1 kikapcsolja. */
function nyit(url) {
  if (process.env.NO_OPEN) return;
  const cmd = process.platform === 'win32' ? 'start "" "' + url + '"'
    : process.platform === 'darwin' ? 'open "' + url + '"'
      : 'xdg-open "' + url + '"';
  exec(cmd, () => { /* ha nem sikerul, a cim ott van a kepernyon */ });
}

/**
 * Ha a port foglalt, lepunk a kovetkezore. Egy esemenyen sok gepen fut ez
 * egyszerre, es nem az a dolgunk, hogy portszamokat magyarazzunk.
 */
function indul(port, marad) {
  app.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && marad > 0) { indul(port + 1, marad - 1); return; }
    console.error('  Nem sikerult elindulni: ' + e.message);
    process.exit(1);
  });
  app.listen(port, () => {
    const url = 'http://localhost:' + port;
    console.log('');
    console.log('  Fut:  ' + url);
    console.log('  Leallitas: Ctrl+C, vagy csukd be ezt az ablakot.');
    console.log('');
    nyit(url);
  });
}

indul(PORT, 20);
