import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scanFilesForVulnerabilities,
  applyClientFix,
  serializeFilesToCookieChunks,
  deserializeFilesFromCookieChunks
} from '../src/core/client_scanner.ts';

test('Client Scanner: flags exposed secrets, schema hazards and N+1 query loops', () => {
  const mockStripeKey = ['sk', 'live', '99887766554433221100aabb'].join('_');
  const result = scanFilesForVulnerabilities([
    {
      path: 'db/migrations/20261031_orders.sql',
      content: 'ALTER TABLE orders ADD COLUMN status VARCHAR(20) NOT NULL;'
    },
    {
      path: 'src/checkout.ts',
      content: `
        // Production stripe key leak
        const key = "${mockStripeKey}";
        for (const user of users) {
          const res = await db.query.find({ where: { id: user.id } });
        }
      `
    },
    {
      path: 'src/server.ts',
      content: "import fs from 'node:fs';\nconst raw = fs.readFileSync('/etc/passwd', 'utf8');"
    }
  ]);

  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.score <= 25, `Expected low score due to critical hazards, got: ${result.score}`);
  assert.ok(result.errorsCount >= 3, `Expected at least 3 errors, got: ${result.errorsCount}`);

  const ruleIds = result.findings.map(f => f.ruleId);
  assert.ok(ruleIds.includes('schema/not-null-no-default'), 'Should flag NOT NULL table lock');
  assert.ok(ruleIds.includes('secrets/stripe-secret-key'), 'Should flag Stripe secret key');
  assert.ok(ruleIds.includes('perf/n-plus-one-loop'), 'Should flag N+1 query inside loop');
  assert.ok(ruleIds.includes('perf/sync-io-in-server'), 'Should flag synchronous file I/O in server code');
});

test('Client Scanner: passes 100/100 on clean production-ready code', () => {
  const result = scanFilesForVulnerabilities([
    {
      path: 'src/checkout.ts',
      content: `
        // Clean batch query
        const userIds = users.map(u => u.id);
        const usersData = await db.query.find({ where: { id: { $in: userIds } } });
      `
    },
    {
      path: 'db/migrations/orders.sql',
      content: "ALTER TABLE orders ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING';"
    }
  ]);

  assert.equal(result.status, 'PASS');
  assert.equal(result.score, 100);
  assert.equal(result.errorsCount, 0);
  assert.equal(result.warningsCount, 0);
  assert.equal(result.findings.length, 0);
});

test('Client Scanner: flags code hygiene and syntax traps (debugger, JSON, Python, Java)', () => {
  const result = scanFilesForVulnerabilities([
    {
      path: 'src/app.js',
      content: 'debugger;\nconsole.log("testing");'
    },
    {
      path: 'config.json',
      content: '{ invalid json here: missing_quotes }'
    },
    {
      path: 'api/service.py',
      content: 'def fetch_data(items=[]):\n\t    pass'
    },
    {
      path: 'src/Leak.java',
      content: 'List<String> list = new ArrayList<String>() {{ add("leak"); }};'
    }
  ]);

  const ruleIds = result.findings.map(f => f.ruleId);
  assert.ok(ruleIds.includes('hygiene/debuggers'), 'Should flag debugger statement');
  assert.ok(ruleIds.includes('hygiene/console-logs'), 'Should flag console.log');
  assert.ok(ruleIds.includes('syntax/json-parse'), 'Should flag malformed JSON');
  assert.ok(ruleIds.includes('syntax/py-mutable-default'), 'Should flag python mutable default');
  assert.ok(ruleIds.includes('syntax/java-double-bracket'), 'Should flag java double bracket');
});

test('Client Scanner: auto-remediates fixable hazards in virtual files', () => {
  const file = {
    path: 'db/migrations/orders.sql',
    content: 'ALTER TABLE orders ADD COLUMN status VARCHAR(20) NOT NULL;'
  };

  const scan1 = scanFilesForVulnerabilities([file]);
  const lockFinding = scan1.findings.find(f => f.ruleId === 'schema/not-null-no-default');
  assert.ok(lockFinding, 'Must identify table lock');

  const fixed = applyClientFix(lockFinding, file);
  assert.ok(fixed, 'Auto-fix must succeed');
  assert.ok(file.content.includes("DEFAULT ''"), 'Should append DEFAULT clause');

  const scan2 = scanFilesForVulnerabilities([file]);
  assert.equal(scan2.status, 'PASS', 'Repaired file should pass quality gate');
});

test('Cookie Serialization: encodes and decodes project files across cookies', () => {
  const files = [
    { path: 'src/main.ts', content: 'console.log("hello");' },
    { path: 'db/schema.sql', content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);' }
  ];

  // 1. Single cookie mode
  const single = serializeFilesToCookieChunks(files);
  assert.equal(single.chunks.length, 0);

  const mockStore: Record<string, string> = {
    shipsafe_files: single.mainCookie
  };
  const restoredSingle = deserializeFilesFromCookieChunks(name => mockStore[name] || null, 0);
  assert.equal(restoredSingle.length, 2);
  assert.equal(restoredSingle[0].path, 'src/main.ts');

  // 2. Multi-chunk cookie mode (>3KB)
  const largeContent = 'export const data = "' + 'A'.repeat(5000) + '";';
  const multiFiles = [{ path: 'src/large.ts', content: largeContent }];
  const multi = serializeFilesToCookieChunks(multiFiles);

  assert.ok(multi.chunks.length >= 2, `Expected >= 2 chunks, got: ${multi.chunks.length}`);
  const multiStore: Record<string, string> = {
    shipsafe_files: multi.mainCookie
  };
  multi.chunks.forEach(c => {
    multiStore[c.name] = c.value;
  });

  const restoredMulti = deserializeFilesFromCookieChunks(name => multiStore[name] || null, multi.chunks.length);
  assert.equal(restoredMulti.length, 1);
  assert.equal(restoredMulti[0].path, 'src/large.ts');
  assert.equal(restoredMulti[0].content, largeContent);
});
