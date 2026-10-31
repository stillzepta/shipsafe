/**
 * ShipSafe Unified API Handler
 * Powers both local Node HTTP server and Vercel Serverless Functions
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHealthCheck } from './engine.js';
import { loadConfig, saveConfig } from './config.js';
import { 
  getCurrentBranch, 
  getStagedFiles, 
  getLatestCommit, 
  getHookStatus, 
  installGitHooks, 
  uninstallGitHooks, 
  getStagedDiff,
  isGitRepo
} from './git.js';
import { getRecentRuns, getRunById, getStats } from './db.js';
import { executeFix } from './fixers.js';
import { runBenchmark } from '../benchmarks/suite.ts';

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
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

export function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

export async function handleApiRequest(req, res, options = {}) {
  const cwd = options.cwd || process.cwd();

  const parsedUrl = new URL(req.url, 'http://api.local');
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
    // 1. Current System & Git Status
    if (pathname === '/api/status' && method === 'GET') {
      const gitOk = isGitRepo(cwd);
      const branch = gitOk ? getCurrentBranch(cwd) : 'cloud';
      const commit = gitOk ? getLatestCommit(cwd) : { hash: 'cloud', message: 'Vercel Serverless Ready' };
      const staged = gitOk ? getStagedFiles(cwd) : [];
      const hooks = gitOk ? getHookStatus(cwd) : { preCommit: false, prePush: false, installed: false };
      const stats = getStats(cwd);

      return sendJson(res, 200, {
        isGitRepo: gitOk,
        isServerless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
        branch,
        commit,
        stagedFiles: staged,
        hooks,
        stats
      });
    }

    // 2. Trigger Health Check
    if (pathname === '/api/check' && (method === 'GET' || method === 'POST')) {
      let body = {};
      if (method === 'POST') {
        try { body = await parseJsonBody(req); } catch {}
      }
      const checkAll = parsedUrl.searchParams.get('all') === 'true' || body.all === true;
      const targetPath = parsedUrl.searchParams.get('path') || parsedUrl.searchParams.get('targetPath') || body.targetPath || body.path || null;
      const virtualFiles = Array.isArray(body.files) ? body.files : null;
      const currentConf = loadConfig(cwd);

      const result = await runHealthCheck(cwd, {
        config: currentConf,
        all: checkAll,
        targetPath,
        files: virtualFiles,
        branch: body.branch,
        commitMessage: body.commitMessage
      });

      if (options.sseClients) {
        for (const client of options.sseClients) {
          try {
            client.write(`event: check-complete\ndata: ${JSON.stringify({ score: result.score, status: result.status })}\n\n`);
          } catch {}
        }
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

    // 3C. Benchmark Reset Endpoint (restores original outage traps for live demo)
    if (pathname === '/api/benchmark/reset' && method === 'POST') {
      const { CANONICAL_TRAPS } = await import('../benchmarks/suite.ts');
      for (const [scenario, payloads] of Object.entries(CANONICAL_TRAPS)) {
        const sDir = path.join(cwd, 'benchmarks', 'fixtures', scenario);
        if (fs.existsSync(sDir)) {
          for (const p of payloads) {
            const fname = path.basename(p.path);
            try {
              await fs.promises.writeFile(path.join(sDir, fname), p.content, 'utf8');
            } catch {}
          }
        }
      }
      return sendJson(res, 200, { success: true, message: 'All 10 benchmark traps restored to pristine outage states!' });
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
      if (options.sseClients) {
        options.sseClients.add(res);
        req.on('close', () => {
          options.sseClients.delete(res);
        });
      } else {
        setTimeout(() => res.end(), 1000);
      }
      return;
    }

    // If static file requested
    if (options.serveStatic) {
      return options.serveStatic(req, res, pathname);
    }

    return sendJson(res, 404, { error: `Endpoint not found: ${pathname}` });
  } catch (err) {
    console.error('[ShipSafe API Error]:', err);
    return sendJson(res, 500, { error: err.message });
  }
}
