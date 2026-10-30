import test from 'node:test';
import assert from 'node:assert';
import { scanEnvDrift } from '../src/core/env.ts';

test('Env Sentinel flags new env vars missing from .env.example', () => {
  const file = {
    path: 'src/services/billing.ts',
    content: 'const key = process.env.STRIPE_LIVE_KEY;'
  };

  const result = scanEnvDrift([file], '/nonexistent_dir_for_test');
  assert.strictEqual(result.missingVars.includes('STRIPE_LIVE_KEY'), true);
  assert.strictEqual(result.findings.length, 1);
  assert.strictEqual(result.findings[0].ruleId, 'env/missing-in-example');
});

test('Env Sentinel ignores standard whitelisted system vars', () => {
  const file = {
    path: 'src/server.ts',
    content: 'const port = process.env.PORT || 3000; const nodeEnv = process.env.NODE_ENV;'
  };

  const result = scanEnvDrift([file], '/nonexistent_dir_for_test');
  assert.strictEqual(result.missingVars.length, 0);
  assert.strictEqual(result.findings.length, 0);
});
