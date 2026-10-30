/**
 * ShipSafe Core: Performance & N+1 Query Loop Sniffer
 * Catches event loop blocking, query explosions in loops, and unbounded memory sinks.
 */

import type { Finding } from './schema.ts';

export function scanPerformanceHazards(files: { path: string; content: string }[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (file.path.includes('.test.') || file.path.includes('.spec.')) continue;

    const lines = file.content.split('\n');

    // State machine to track loop boundaries
    let inLoop = false;
    let loopStartLine = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      // 1. Detect loop starts
      if (
        /\bfor\s*\(|\bwhile\s*\(|\.forEach\s*\(|\.map\s*\(\s*(?:async\s*)?\(?/i.test(trimmed)
      ) {
        inLoop = true;
        loopStartLine = lineNum;
        braceDepth = 0;
      }

      if (inLoop) {
        braceDepth += (line.match(/{/g) || []).length;
        braceDepth -= (line.match(/}/g) || []).length;

        // Check for queries or fetches inside loop
        if (
          /\b(?:await\s+)?(?:db|prisma|sequelize|knex|mongoose|repository|\$query|fetch|axios)\.(?:find|query|select|insert|update|delete|get|post)\b/i.test(
            trimmed
          ) ||
          /\bawait\s+fetch\(/i.test(trimmed)
        ) {
          findings.push({
            ruleId: 'perf/n-plus-one-loop',
            category: 'Performance Hazard',
            severity: 'CRITICAL',
            title: 'N+1 query or network request detected inside loop',
            filePath: file.path,
            line: lineNum,
            snippet: trimmed,
            recommendation:
              'Batch this query using WHERE IN (...) or DataLoader pattern outside the loop to avoid explosive latency under production load.',
            autoFixable: false
          });
        }

        if (braceDepth <= 0 && i > loopStartLine) {
          inLoop = false;
        }
      }

      // 2. Synchronous blocking I/O in server context
      if (
        /\b(?:fs\.readFileSync|fs\.writeFileSync|child_process\.execSync|execSync)\b/i.test(
          trimmed
        )
      ) {
        findings.push({
          ruleId: 'perf/sync-io-in-server',
          category: 'Event Loop Block Hazard',
          severity: 'ERROR',
          title: 'Synchronous blocking I/O in server execution path',
          filePath: file.path,
          line: lineNum,
          snippet: trimmed,
          recommendation:
            'Use non-blocking asynchronous fs.promises or worker threads. Synchronous calls freeze the entire Node.js event loop for all concurrent users.',
          autoFixable: false
        });
      }

      // 3. Unbounded SELECT queries
      if (
        /select\s+\*\s+from\s+[a-zA-Z0-9_]+/i.test(trimmed) &&
        !/limit\s+\d+/i.test(file.content)
      ) {
        findings.push({
          ruleId: 'perf/unbounded-query',
          category: 'Memory & Query Safety',
          severity: 'WARN',
          title: 'Unbounded SELECT query without LIMIT clause',
          filePath: file.path,
          line: lineNum,
          snippet: trimmed,
          recommendation:
            'Always specify a LIMIT or pagination boundary to prevent table-scan memory exhaustion as data scales.',
          autoFixable: false
        });
      }
    }
  }

  return findings;
}
