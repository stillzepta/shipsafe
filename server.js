/**
 * ShipSafe Local Server & REST API
 * Provides HTTP Dashboard & Real-Time SSE Git Watcher
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.js';
import { getCurrentBranch, getStagedFiles } from './lib/git.js';
import { handleApiRequest } from './lib/api-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

function serveStatic(req, res, filePath) {
  let targetPath = path.join(PUBLIC_DIR, filePath === '/' ? 'index.html' : filePath);

  // Prevent path traversal
  if (!targetPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    targetPath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(targetPath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(targetPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

export async function startServer(options = {}) {
  const cwd = options.cwd || process.cwd();
  const config = loadConfig(cwd);
  const port = options.port || config.port || 4100;
  const host = config.host || '127.0.0.1';

  // SSE Subscribers
  const sseClients = new Set();

  // Watch git repository changes to push live updates
  let lastGitState = '';
  setInterval(() => {
    if (sseClients.size === 0) return;
    try {
      const staged = getStagedFiles(cwd);
      const branch = getCurrentBranch(cwd);
      const currentState = JSON.stringify({ branch, stagedCount: staged.length, files: staged.map(f => f.path) });

      if (currentState !== lastGitState) {
        lastGitState = currentState;
        for (const client of sseClients) {
          client.write(`event: git-change\ndata: ${currentState}\n\n`);
        }
      }
    } catch {
      // Ignore errors in background watch poll
    }
  }, 1200);

  const server = http.createServer(async (req, res) => {
    return handleApiRequest(req, res, {
      cwd,
      host,
      port,
      sseClients,
      serveStatic
    });
  });

  server.listen(port, host, () => {
    console.log(`
\x1b[1;36m  🛡️  ShipSafe Local Quality Gate is Live!\x1b[0m
  ───────────────────────────────────────────────────────────
  Dashboard:  \x1b[1;32mhttp://${host}:${port}\x1b[0m
  REST API:   \x1b[0;34mhttp://${host}:${port}/api/status\x1b[0m
  Live Watch: \x1b[0;33mServer-Sent Events active (SSE)\x1b[0m
  ───────────────────────────────────────────────────────────
  Press Ctrl+C to stop.
    `);
  });

  return server;
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}
