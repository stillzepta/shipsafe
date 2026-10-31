/**
 * Rule: Code Hygiene & Smells
 * Detects debuggers, leftover print dumps, blocker markers, bypass flags, etc.
 */

const HYGIENE_CHECKS = [
  {
    id: 'debuggers',
    name: 'Debugger Statement Found',
    // Exact word boundary for standalone debugger statement
    regex: /(?:^|[^a-zA-Z0-9_\-$])\b(debugger)\b\s*;?/g,
    severity: 'ERROR',
    category: 'Hygiene',
    applicableExtensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.vue', '.svelte'],
    recommendation: 'Remove debugger breakpoint before shipping to production.',
    autoFixable: true,
    fixerType: 'strip-debugger'
  },
  {
    id: 'console-logs',
    name: 'Console Debug Statement',
    regex: /(?:^|[^a-zA-Z0-9_\-$])\b(console\.(?:log|debug|trace|dir))\s*\(/g,
    severity: 'WARN',
    category: 'Hygiene',
    applicableExtensions: ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'],
    recommendation: 'Use a structured logging library or remove debug logs before deployment.',
    autoFixable: true,
    fixerType: 'comment-console'
  },
  {
    id: 'blocker-comments',
    name: 'Unresolved BLOCKER / FIXME Marker',
    regex: /(?:\/\/|#|\/\*)\s*(?:TODO\s*\[BLOCKER\]|FIXME\s*\[CRITICAL\]|DO\s+NOT\s+COMMIT|NO_COMMIT|DO_NOT_SHIP)/gi,
    severity: 'ERROR',
    category: 'Hygiene',
    applicableExtensions: null, // all files
    recommendation: 'Resolve blocker tag before pushing code.',
    autoFixable: false
  },
  {
    id: 'linter-bypasses',
    name: 'Linter Suppression Comment',
    regex: /(?:\/\/|\/\*|#)\s*(?:@ts-ignore|eslint-disable|pylint:\s*disable|#\s*noqa)/gi,
    severity: 'WARN',
    category: 'Hygiene',
    applicableExtensions: ['.js', '.jsx', '.ts', '.tsx', '.py'],
    recommendation: 'Fix the underlying type or lint issue instead of suppressing warnings.',
    autoFixable: false
  },
  {
    id: 'hardcoded-localhost',
    name: 'Hardcoded Localhost Endpoint',
    regex: /(?:https?:\/\/localhost:[0-9]+|https?:\/\/127\.0\.0\.1:[0-9]+)/gi,
    severity: 'WARN',
    category: 'Hygiene',
    applicableExtensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.json'],
    recommendation: 'Use environment variables (e.g. process.env.API_BASE_URL) instead of static localhost URLs.',
    autoFixable: false
  }
];

export function scanForHygiene(filePath, content, config = {}) {
  const findings = [];
  const ext = filePath.includes('.') ? '.' + filePath.split('.').pop().toLowerCase() : '';
  const lines = content.split('\n');

  // Skip test fixtures if they are testing linters/rules
  const isTestFile = filePath.startsWith('test/') || filePath.startsWith('tests/') || filePath.includes('.test.') || filePath.includes('.spec.');

  for (const check of HYGIENE_CHECKS) {
    // Check if rule is enabled
    const ruleConfig = config.rules?.[`hygiene/${check.id}`];
    if (ruleConfig && ruleConfig.enabled === false) continue;
    const severity = ruleConfig?.severity || check.severity;

    // Skip console-log checks for CLI formatters, benchmark runners, and server startup banners
    if (check.id === 'console-logs' && (filePath.startsWith('src/cli/') || filePath.startsWith('bin/') || filePath.startsWith('benchmarks/') || filePath === 'server.js')) {
      continue;
    }

    // Check extension filter
    if (check.applicableExtensions && !check.applicableExtensions.includes(ext)) {
      continue;
    }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmed = line.trim();

      // Skip comment lines for debugger and console-log checks
      if ((check.id === 'debuggers' || check.id === 'console-logs') && (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#'))) {
        continue;
      }

      // If test file, skip synthetic tests of rules
      if (isTestFile && (line.includes('test(') || line.includes('assert.') || line.includes('describe(') || line.includes('fs.writeFileSync'))) {
        continue;
      }

      check.regex.lastIndex = 0;
      let match;

      while ((match = check.regex.exec(line)) !== null) {
        // Distinguish actual debugger statement from string literals mentioning 'debugger'
        if (check.id === 'debuggers') {
          const isStatement = /^(?:.*\s+)?debugger\s*;?\s*(?:\/\/.*)?$/.test(trimmed) && !/['"`]/.test(line);
          if (!isStatement) continue;
        }

        findings.push({
          ruleId: `hygiene/${check.id}`,
          category: 'Hygiene',
          severity,
          title: check.name,
          filePath,
          line: lineIndex + 1,
          column: match.index + 1,
          snippet: line.trim(),
          highlight: match[1] || match[0],
          recommendation: check.recommendation,
          autoFixable: check.autoFixable,
          fixerType: check.fixerType
        });
      }
    }
  }

  return findings;
}
