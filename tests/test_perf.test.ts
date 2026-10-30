import test from 'node:test';
import assert from 'node:assert';
import { scanPerformanceHazards } from '../src/core/perf.ts';

test('Performance Sniffer flags database queries inside loops (N+1 hazard)', () => {
  const file = {
    path: 'src/controllers/orders.ts',
    content: `
      export async function getOrders(orderIds: string[]) {
        for (const id of orderIds) {
          const order = await db.query.find({ where: { id } });
        }
      }
    `
  };

  const findings = scanPerformanceHazards([file]);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'perf/n-plus-one-loop');
  assert.strictEqual(findings[0].severity, 'CRITICAL');
});

test('Performance Sniffer flags synchronous blocking file operations', () => {
  const file = {
    path: 'src/api/report.ts',
    content: `
      import fs from 'node:fs';
      export function generate() {
        const raw = fs.readFileSync('/tmp/data.json', 'utf-8');
      }
    `
  };

  const findings = scanPerformanceHazards([file]);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].ruleId, 'perf/sync-io-in-server');
  assert.strictEqual(findings[0].severity, 'ERROR');
});
