import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.join(process.cwd(), 'dist');
const port = Number.parseInt(process.argv[2] || '4173', 10);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.kml': 'application/vnd.google-earth.kml+xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.normalize(path.join(root, relativePath));
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

const server = http.createServer(async (req, res) => {
  const filePath = safePath(req.url || '/');
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(filePath).catch(() => null);
    const finalPath = stat?.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const data = await fs.readFile(finalPath);
    const ext = path.extname(finalPath).toLowerCase();
    res.writeHead(200, {
      'content-type': mimeTypes[ext] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/`);
});
