import { test, describe } from 'node:test';
import assert from 'node:assert';
import { scanForSecrets } from '../lib/rules/secrets.js';
import { scanForHygiene } from '../lib/rules/hygiene.js';
import { checkSyntax } from '../lib/rules/syntax.js';
import { checkGitGuard } from '../lib/rules/git-guard.js';
import { checkDependencies } from '../lib/rules/dependencies.js';
import { executeFix } from '../lib/fixers.js';
import { getDatabase, recordRun, getRecentRuns, getStats } from '../lib/db.js';
import fs from 'node:fs';
import path from 'node:path';

describe('ShipSafe Health Rules Engine', () => {

  test('Secret Scanner detects leaked credentials', () => {
    // Construct test secrets dynamically so GitHub push protection doesn't reject test fixtures
    const mockAws = ['AKIA', 'IOSFODNN7BARQZ89'].join('');
    const mockGh = ['ghp', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij'].join('_');
    const mockStripe = ['sk', 'live', '51MKnH7DFl3kQx2mPz9Qw8R7t6Y5u4I3o2P1'].join('_');

    const maliciousCode = `
      const awsKey = "${mockAws}";
      const ghToken = "${mockGh}";
      const stripe = "${mockStripe}";
    `;

    const findings = scanForSecrets('src/auth.js', maliciousCode);
    assert.strictEqual(findings.length >= 2, true, 'Should find leaked credentials');
    assert.strictEqual(findings.some(f => f.title.includes('GitHub')), true);
    assert.strictEqual(findings.some(f => f.title.includes('Stripe')), true);
  });

  test('Secret Scanner ignores safe mock / placeholder tokens', () => {
    const safeCode = `
      const placeholder = "example_secret_placeholder";
      const dummyKey = "test_dummy_key_xxxx";
    `;

    const findings = scanForSecrets('test/mock.js', safeCode);
    assert.strictEqual(findings.length, 0, 'Safe placeholders should not trigger false positives');
  });

  test('Hygiene Scanner flags debugger and blocker comments', () => {
    const dirtyCode = `
      function compute() {
        console.log("debug message");
        debugger;
        // TODO [BLOCKER] fix memory leak before launch!
      }
    `;

    const findings = scanForHygiene('src/calc.js', dirtyCode, {
      rules: {
        'hygiene/debuggers': { enabled: true, severity: 'ERROR' },
        'hygiene/console-logs': { enabled: true, severity: 'WARN' },
        'hygiene/blocker-comments': { enabled: true, severity: 'ERROR' }
      }
    });

    assert.strictEqual(findings.length, 3);
    assert.strictEqual(findings.some(f => f.title.includes('Debugger')), true);
    assert.strictEqual(findings.some(f => f.title.includes('BLOCKER')), true);
    assert.strictEqual(findings.some(f => f.title.includes('Console')), true);
  });

  test('Syntax Scanner flags malformed JSON', () => {
    const badJson = '{\n  "name": "project",\n  "version": 1.0.0\n}'; // unquoted version
    const findings = checkSyntax('config.json', badJson, {
      rules: { 'syntax/json-validity': { enabled: true, severity: 'ERROR' } }
    });

    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].category, 'Syntax Integrity');
  });

  test('Git Guard flags .env files and protected branch violations', () => {
    const stagedFiles = [
      { path: '.env.production', status: 'added' },
      { path: 'src/main.js', status: 'modified' }
    ];

    const findings = checkGitGuard(stagedFiles, 'main', {
      rules: {
        'git/branch-protection': { enabled: true, protectedBranches: ['main'] },
        'git/large-files': { enabled: true, maxSizeBytes: 1024 }
      }
    });

    assert.strictEqual(findings.some(f => f.title.includes('Protected Branch')), true);
    assert.strictEqual(findings.some(f => f.title.includes('.env')), true);
  });

  test('Dependency Inspector catches unpinned wildcards and missing lockfiles', () => {
    const stagedFiles = [{ path: 'package.json', status: 'modified' }];
    const fileContents = {
      'package.json': JSON.stringify({
        dependencies: {
          'unpinned-pkg': '*'
        }
      })
    };

    const findings = checkDependencies(stagedFiles, {
      rules: {
        'deps/lockfile-sync': { enabled: true, severity: 'ERROR' },
        'deps/wildcard-versions': { enabled: true, severity: 'WARN' }
      }
    }, fileContents);

    assert.strictEqual(findings.length, 2);
    assert.strictEqual(findings.some(f => f.title.includes('Lockfile')), true);
    assert.strictEqual(findings.some(f => f.title.includes('Unpinned')), true);
  });

  test('Auto-Fixer strips debugger statements safely', () => {
    const tmpDir = path.join(process.cwd(), '.shipsafe', 'tmp-test');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const testFile = path.join(tmpDir, 'dirty.js');
    fs.writeFileSync(testFile, 'function foo() {\n  debugger;\n  return 42;\n}\n', 'utf8');

    const result = executeFix(process.cwd(), 'strip-debugger', path.relative(process.cwd(), testFile));
    assert.strictEqual(result.success, true);

    const cleaned = fs.readFileSync(testFile, 'utf8');
    assert.strictEqual(cleaned.includes('debugger'), false);

    fs.unlinkSync(testFile);
  });

  test('SQLite DB successfully records runs and aggregates metrics', () => {
    const db = getDatabase(process.cwd());
    assert.ok(db, 'SQLite database initialized');

    const mockRun = {
      branch: 'feature/test-branch',
      commitHash: 'a1b2c3d',
      status: 'PASS',
      score: 100,
      errorsCount: 0,
      warningsCount: 0,
      infoCount: 0,
      filesChecked: 5,
      durationMs: 42,
      summary: 'Clean run',
      findings: []
    };

    const runId = recordRun(process.cwd(), mockRun);
    assert.strictEqual(typeof runId === 'bigint' || typeof runId === 'number', true, 'runId should be integer or bigint');

    const recent = getRecentRuns(process.cwd(), 5);
    assert.strictEqual(recent.length > 0, true);

    const stats = getStats(process.cwd());
    assert.strictEqual(stats.totalRuns > 0, true);
  });

});
