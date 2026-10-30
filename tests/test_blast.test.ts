import test from 'node:test';
import assert from 'node:assert';
import { calculateBlastRadius } from '../src/core/blast.ts';

test('Blast Radius Engine calculates high risk when critical paths are touched', () => {
  const allFiles = [
    { path: 'src/auth/jwt.ts', content: 'export function sign() {}' },
    { path: 'src/routes/login.ts', content: "import { sign } from '../auth/jwt';" },
    { path: 'src/routes/api.ts', content: "import { sign } from '../auth/jwt';" },
    { path: 'src/app.ts', content: "import './routes/login'; import './routes/api';" }
  ];

  const changed = ['src/auth/jwt.ts'];
  const blast = calculateBlastRadius(changed, allFiles);

  assert.strictEqual(blast.criticalPathsTouched.length > 0, true);
  assert.strictEqual(blast.score >= 50, true);
  assert.strictEqual(blast.downstreamCount >= 3, true);
});

test('Blast Radius Engine assigns low score for isolated leaf files', () => {
  const allFiles = [
    { path: 'src/utils/date.ts', content: 'export function formatDate() {}' },
    { path: 'src/app.ts', content: 'console.log("hello");' }
  ];

  const changed = ['src/utils/date.ts'];
  const blast = calculateBlastRadius(changed, allFiles);

  assert.strictEqual(blast.riskLevel, 'LOW');
  assert.strictEqual(blast.downstreamCount, 0);
});
