import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_PATHS = [
  '.github/workflows/ci.yml',
  '.github/workflows/shipsafe.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  'docs/post',
  'docs/PRD.md',
  'docs/ARCHITECTURE.md',
  'docs/ESSENTIAL.md',
  'src/core/schema.ts',
  'src/core/env.ts',
  'src/core/perf.ts',
  'src/core/blast.ts',
  'src/ai/engine.ts',
  'src/ai/heuristic.ts',
  'src/cli/index.ts',
  'src/cli/formatter.ts',
  'src/cli/chore_automator.ts',
  'src/action/pr_commenter.ts',
  'benchmarks/suite.ts',
  'benchmarks/fixtures/01_table_lock_migration',
  'benchmarks/fixtures/02_missing_stripe_secret_env',
  'benchmarks/fixtures/03_n_plus_one_checkout_query',
  'benchmarks/BENCHMARK_RESULTS.md',
  'demo/sample_app.ts',
  'demo/.env.example',
  'tests/test_schema.test.ts',
  'tests/test_env.test.ts',
  'tests/test_perf.test.ts',
  'tests/test_blast.test.ts',
  '.gitignore',
  'LICENSE',
  'package.json',
  'tsconfig.json',
  'action.yml',
  'README.md'
];

test('ShipSafe Repository Structure adheres 100% to the Gold-Standard layout', () => {
  const root = process.cwd();
  const missing: string[] = [];

  for (const rel of REQUIRED_PATHS) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      missing.push(rel);
    }
  }

  assert.strictEqual(
    missing.length,
    0,
    `Repository format drift detected! Missing required gold-standard files: ${missing.join(', ')}`
  );
});
