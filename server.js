/**
 * ShipSafe Local Server & REST API
 * Provides HTTP Dashboard & Real-Time SSE Git Watcher
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHealthCheck } from './lib/engine.js';
import { loadConfig, saveConfig } from './lib/config.js';
import { 
  getCurrentBranch, 
  getStagedFiles, 
  getLatestCommit, 
  getHookStatus, 
  installGitHooks, 
  uninstallGitHooks, 
  getStagedDiff,
  isGitRepo
} from './lib/git.js';
import { getRecentRuns, getRunById, getStats } from './lib/db.js';
import { executeFix } from './lib/fixers.js';
import { runBenchmark } from './benchmarks/suite.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

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

export function startServer(options = {}) {
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
    const parsedUrl = new URL(req.url, `http://${host}:${port}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    try {
      // --- API ROUTES ---

      // 1. Current System & Git Status
      if (pathname === '/api/status' && method === 'GET') {
        const branch = getCurrentBranch(cwd);
        const commit = getLatestCommit(cwd);
        const staged = getStagedFiles(cwd);
        const hooks = getHookStatus(cwd);
        const stats = getStats(cwd);
        const gitOk = isGitRepo(cwd);

        return sendJson(res, 200, {
          isGitRepo: gitOk,
          branch,
          commit,
          stagedFiles: staged,
          hooks,
          stats
        });
      }

      // 2. Trigger Health Check
      if (pathname === '/api/check' && (method === 'GET' || method === 'POST')) {
        const checkAll = parsedUrl.searchParams.get('all') === 'true';
        const currentConf = loadConfig(cwd);
        const result = await runHealthCheck(cwd, { config: currentConf, all: checkAll });

        // Notify SSE clients of fresh check run
        for (const client of sseClients) {
          client.write(`event: check-complete\ndata: ${JSON.stringify({ score: result.score, status: result.status })}\n\n`);
        }

        return sendJson(res, 200, result);
      }

      // 3. Staged Diff Viewer
      if (pathname === '/api/diff' && method === 'GET') {
        const filePath = parsedUrl.searchParams.get('file') || null;
        const diff = getStagedDiff(cwd, filePath);
        return sendJson(res, 200, { file: filePath, diff });
      }

      // 3B. Outage Benchmark Runner
      if (pathname === '/api/benchmark' && (method === 'GET' || method === 'POST')) {
        const benchResult = runBenchmark();
        return sendJson(res, 200, benchResult);
      }

      // 4. Run Auto-Fixer
      if (pathname === '/api/fix' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { fixerType, filePath, extraData } = body;

        if (!fixerType || !filePath) {
          return sendJson(res, 400, { error: 'fixerType and filePath are required' });
        }

        const fixResult = executeFix(cwd, fixerType, filePath, extraData);
        return sendJson(res, 200, fixResult);
      }

      // 5. Git Hooks Management
      if (pathname === '/api/hooks/install' && method === 'POST') {
        const installResult = installGitHooks(cwd);
        return sendJson(res, 200, installResult);
      }

      if (pathname === '/api/hooks/uninstall' && method === 'POST') {
        const uninstallResult = uninstallGitHooks(cwd);
        return sendJson(res, 200, uninstallResult);
      }

      // 6. Audit Run History
      if (pathname === '/api/history' && method === 'GET') {
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
        const history = getRecentRuns(cwd, limit);
        return sendJson(res, 200, { history });
      }

      // 7. Single Run Details
      if (pathname.startsWith('/api/history/') && method === 'GET') {
        const id = parseInt(pathname.split('/').pop(), 10);
        const run = getRunById(cwd, id);
        if (!run) return sendJson(res, 404, { error: 'Run not found' });
        return sendJson(res, 200, run);
      }

      // 8. Configuration API
      if (pathname === '/api/config' && method === 'GET') {
        const currentConf = loadConfig(cwd);
        return sendJson(res, 200, currentConf);
      }

      if (pathname === '/api/config' && method === 'POST') {
        const body = await parseJsonBody(req);
        const updated = saveConfig(cwd, body);
        return sendJson(res, 200, updated);
      }

      // 9. Real-Time Server-Sent Events (SSE)
      if (pathname === '/api/events' && method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        res.write(`event: connected\ndata: {"status":"connected","timestamp":${Date.now()}}\n\n`);
        sseClients.add(res);

        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // --- STATIC FILES ROUTING ---
      return serveStatic(req, res, pathname);

    } catch (err) {
      console.error('[ShipSafe Server Error]:', err);
      return sendJson(res, 500, { error: err.message });
    }
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
