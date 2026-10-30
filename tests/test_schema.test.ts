import test from 'node:test';
import assert from 'node:assert';
import { scanSchemaHazards } from '../src/core/schema.ts';

test('Schema Detector flags NOT NULL column without DEFAULT', () => {
  const file = {
    path: 'migrations/001_add_billing.sql',
    content: 'ALTER TABLE users ADD COLUMN billing_plan VARCHAR(32) NOT NULL;'
  };

  const findings = scanSchemaHazards([file]);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'schema/not-null-no-default');
  assert.strictEqual(findings[0].severity, 'CRITICAL');
});

test('Schema Detector allows NOT NULL when DEFAULT is provided', () => {
  const file = {
    path: 'migrations/002_safe_migration.sql',
    content: "ALTER TABLE users ADD COLUMN billing_plan VARCHAR(32) DEFAULT 'free' NOT NULL;"
  };

  const findings = scanSchemaHazards([file]);
  assert.strictEqual(findings.length, 0);
});

test('Schema Detector flags dangerous direct column drop', () => {
  const file = {
    path: 'migrations/003_drop_column.sql',
    content: 'ALTER TABLE accounts DROP COLUMN legacy_pin;'
  };

  const findings = scanSchemaHazards([file]);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'schema/drop-column-hazard');
  assert.strictEqual(findings[0].severity, 'CRITICAL');
});
