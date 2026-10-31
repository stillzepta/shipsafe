import test from 'node:test';
import assert from 'node:assert/strict';
import { runHealthCheck } from '../lib/engine.js';
import { handleApiRequest } from '../lib/api-handler.js';

test('Virtual Project Scan: evaluates in-memory uploaded project files', async () => {
  const result = await runHealthCheck('.', {
    files: [
      {
        path: 'db/migrations/orders.sql',
        content: 'ALTER TABLE orders ADD COLUMN status VARCHAR(20) NOT NULL;'
      },
      {
        path: 'src/server.ts',
        content: "import fs from 'node:fs';\nconst config = fs.readFileSync('conf.json', 'utf8');"
      }
    ],
    skipDb: true,
    skipAI: true
  });

  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.score < 80);
  assert.ok(result.findings.length >= 2);

  const ruleIds = result.findings.map(f => f.ruleId);
  assert.ok(ruleIds.includes('schema/not-null-no-default'));
  assert.ok(ruleIds.includes('perf/sync-io-in-server'));
});

test('Serverless API: handleApiRequest handles virtual project inspection', async () => {
  const req = {
    method: 'POST',
    url: '/api/check',
    body: {
      files: [
        {
          path: 'src/checkout.ts',
          content: 'for (const u of users) { await db.query.find({ where: { userId: u.id } }); }'
        }
      ],
      skipAI: true
    }
  };

  let statusCode = 0;
  let headers = {};
  let responseData = '';

  const res = {
    writeHead(code, h) {
      statusCode = code;
      headers = h;
    },
    end(data) {
      responseData = data;
    }
  };

  await handleApiRequest(req, res, { cwd: '.' });

  assert.equal(statusCode, 200);
  const parsed = JSON.parse(responseData);
  assert.equal(parsed.status, 'BLOCKED');
  assert.ok(parsed.findings.some(f => f.ruleId === 'perf/n-plus-one-loop'));
});
