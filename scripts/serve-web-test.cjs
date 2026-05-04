const { execFile } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const host = process.env.TING_WEB_HOST || 'localhost';
const startPort = Number(process.env.TING_WEB_PORT || 5173);
const shouldOpen = process.argv.includes('--open');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveStaticFile(requestUrl) {
  const url = new URL(requestUrl, `http://${host}`);
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(appRoot, relativePath);

  if (!filePath.startsWith(appRoot)) return null;
  return filePath;
}

function createServer() {
  return http.createServer((req, res) => {
    const filePath = resolveStaticFile(req.url || '/');
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url], { windowsHide: true });
  } else if (process.platform === 'darwin') {
    execFile('open', [url]);
  } else {
    execFile('xdg-open', [url]);
  }
}

function listen(port) {
  const server = createServer();

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < startPort + 20) {
      listen(port + 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });

  server.listen(port, host, () => {
    const url = `http://${host}:${port}/`;
    console.log(`Ting! web test: ${url}`);
    console.log('Nhan Ctrl+C de dung server.');
    if (shouldOpen) openBrowser(url);
  });
}

listen(startPort);
