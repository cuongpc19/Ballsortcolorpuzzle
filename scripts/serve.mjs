// Dev server. Zero dependencies on purpose: the game is plain HTML/CSS/JS with
// no build step, so `npm run dev` should work on a clean checkout without ever
// running `npm install`.
//
// Port 5180 (5173 is usually taken by a Vite game in the same folder). Bound to
// 0.0.0.0 so a phone on the same Wi-Fi can open the LAN address printed at
// start-up. On Windows that address is only reachable once the firewall lets
// the port through — see `mo-firewall.bat`.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 5180;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
};

/** Resolve a URL path to a file inside ROOT, or null if it escapes the tree. */
function toFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = normalize(clean).replace(/^([/\\])+/, '');
  const file = resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return null; // no ../ escapes
  return file;
}

async function send(res, status, body, type, extra = {}) {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    // Nothing is fingerprinted, so never let the browser hold a stale build.
    'Cache-Control': 'no-store',
    ...extra,
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  let file = toFile(req.url || '/');
  if (!file) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');

  try {
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) {
      return send(res, 404, 'Không tìm thấy: ' + req.url, 'text/plain; charset=utf-8');
    }
    const body = await readFile(file);
    return send(res, 200, body, TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
  } catch (err) {
    return send(res, 500, String(err), 'text/plain; charset=utf-8');
  }
});

/** Every non-internal IPv4 address, so the phone URL is easy to find. */
function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const nic of list || []) {
      if (nic.family === 'IPv4' && !nic.internal) out.push(nic.address);
    }
  }
  return out;
}

server.listen(PORT, '0.0.0.0', () => {
  const line = '─'.repeat(46);
  console.log('\n  Tube Tangle — dev server\n  ' + line);
  console.log(`  Máy này    http://localhost:${PORT}/`);
  for (const ip of lanAddresses()) console.log(`  Điện thoại http://${ip}:${PORT}/`);
  console.log('  ' + line);
  console.log('  Ctrl+C để dừng.\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Cổng ${PORT} đang bận. Chạy lại với cổng khác:\n` +
                  `  PORT=5181 npm run dev\n`);
    process.exit(1);
  }
  throw err;
});
