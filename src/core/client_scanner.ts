/**
 * ShipSafe Core: Client-Side Vulnerability Scanner & Cookie Serialization
 * Sovereign in-browser quality gate for GitHub Pages and air-gapped environments.
 */

// shortcut: Cookie sizes limited to ~4KB per cookie. We chunk payloads across cookies up to 8 chunks (~24KB) and sync to localStorage. When projects exceed 50KB, upgrade to IndexedDB.

export interface VirtualFile {
  path: string;
  content: string;
}

export interface ClientFinding {
  ruleId: string;
  category: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARN' | 'INFO';
  title: string;
  filePath: string;
  line: number;
  column?: number;
  snippet?: string;
  highlight?: string;
  recommendation: string;
  autoFixable?: boolean;
  fixerType?: string;
  extraData?: any;
}

export interface ClientScanResult {
  status: 'PASS' | 'WARN' | 'BLOCKED';
  score: number;
  errorsCount: number;
  warningsCount: number;
  infoCount: number;
  filesChecked: number;
  durationMs: number;
  summary: string;
  categories: Record<string, { errors: number; warnings: number; clean: boolean }>;
  findings: ClientFinding[];
  blast: {
    score: number;
    riskLevel: string;
    changedCount: number;
    downstreamCount: number;
    explanation: string;
  };
  preMortem: {
    summary: string;
    failureScenarios: string[];
    recommendedAction: string;
    source: string;
  };
}

const SECRET_PATTERNS = [
  {
    id: 'secrets/aws-access-key',
    title: 'Hardcoded AWS Access Key ID',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    severity: 'ERROR' as const,
    category: 'Security',
    recommendation: 'Rotate key immediately and extract to environment variables or AWS Secrets Manager.'
  },
  {
    id: 'secrets/aws-secret-key',
    title: 'Hardcoded AWS Secret Access Key',
    regex: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[:=]\s*["']([A-Za-z0-9\/+=]{40})["']/gi,
    severity: 'ERROR' as const,
    category: 'Security',
    recommendation: 'Remove AWS secret key and use AWS IAM Roles or Vault.'
  },
  {
    id: 'secrets/github-token',
    title: 'Hardcoded GitHub Personal Access Token',
    regex: /(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}|gho_[a-zA-Z0-9]{20,40}|ghs_[a-zA-Z0-9]{20,40})/g,
    severity: 'ERROR' as const,
    category: 'Security',
    recommendation: 'Revoke token on GitHub and store in secret manager.'
  },
  {
    id: 'secrets/stripe-secret-key',
    title: 'Stripe Live Secret Key Exposed',
    regex: /(?:sk_live_[0-9a-zA-Z]{24,}|rk_live_[0-9a-zA-Z]{24,})/g,
    severity: 'ERROR' as const,
    category: 'Security',
    recommendation: 'Invalidate live Stripe API key and set in runtime environment.'
  },
  {
    id: 'secrets/slack-token',
    title: 'Slack Token or Webhook URL Exposed',
    regex: /(?:xox[baprs]-[0-9a-zA-Z]{10,48}|https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+)/g,
    severity: 'ERROR' as const,
    category: 'Security',
    recommendation: 'Regenerate Slack webhook or bot token.'
  },
  {
    id: 'secrets/private-key',
    title: 'Private Encryption Key Committed',
    regex: /-----BEGIN (?:RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY[^-]*-----/g,
    severity: 'ERROR' as const,
    category: 'Security',
    recommendation: 'Never commit private keys to version control. Add to .gitignore.'
  },
  {
    id: 'secrets/jwt-token',
    title: 'Hardcoded JSON Web Token (JWT)',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'WARN' as const,
    category: 'Security',
    recommendation: 'Ensure this is not a production or long-lived authentication token.'
  },
  {
    id: 'secrets/db-connection-string',
    title: 'Database URI with Cleartext Password',
    regex: /(?:postgres|mysql|mongodb|redis|mariadb):\/\/[^:]+:[^@\s]+@[a-zA-Z0-9\.-]+(?::[0-9]+)?\/[^\s"']+/gi,
    severity: 'ERROR' as const,
    category: 'Security',
    recommendation: 'Use DATABASE_URL environment variable without embedding cleartext passwords.'
  },
  {
    id: 'secrets/google-api-key',
    title: 'Hardcoded Google API Key',
    regex: /AIza[0-9A-Za-z\\-_]{35}/g,
    severity: 'ERROR' as const,
    category: 'Security',
    recommendation: 'Restrict key in Google Cloud Console and load dynamically.'
  },
  {
    id: 'secrets/generic-api-key',
    title: 'Hardcoded API Secret or Credential Variable',
    regex: /(?:api_key|apikey|secret_key|client_secret|auth_token|access_token|private_key)\s*[:=]\s*["']([a-zA-Z0-9_\-\.]{18,})["']/gi,
    severity: 'ERROR' as const,
    category: 'Security',
    recommendation: 'Extract credential into environment variable.'
  }
];

const SAFE_PLACEHOLDERS = [
  'example', 'placeholder', 'dummy', 'xxxx', 'your_', 'test_', 'my_secret',
  'fake', 'replace_me', 'changeme', '0000000', '12345678', 'user:pass', 'user:password'
];

function isSafeMatch(str: string): boolean {
  const lower = str.toLowerCase();
  return SAFE_PLACEHOLDERS.some(p => lower.includes(p));
}

/**
 * Scan virtual or uploaded files for security vulnerabilities and production traps.
 */
export function scanFilesForVulnerabilities(files: VirtualFile[], config: any = {}): ClientScanResult {
  const startTime = Date.now();
  const findings: ClientFinding[] = [];
  const targetFiles = (files || []).filter(f => f && typeof f.path === 'string');

  // Track env variables in code vs .env.example
  const codeEnvVars = new Set<string>();
  let envExampleContent = '';
  const WHITELIST_ENV = new Set(['NODE_ENV', 'PATH', 'PORT', 'HOME', 'PWD', 'HOSTNAME', 'USER', 'SHELL', 'TERM']);

  for (const file of targetFiles) {
    const rawPath = file.path.replace(/^[./]+/, '');
    const content = typeof file.content === 'string' ? file.content : '';
    const lowerPath = rawPath.toLowerCase();

    if (lowerPath.endsWith('.env.example')) {
      envExampleContent += '\n' + content;
      continue;
    }

    if (lowerPath === '.env' || lowerPath.endsWith('/.env') || lowerPath === '.env.local') {
      findings.push({
        ruleId: 'git/env-file',
        category: 'Git Hygiene',
        severity: 'ERROR',
        title: 'Sensitive .env File Detected in Upload',
        filePath: rawPath,
        line: 1,
        snippet: rawPath,
        recommendation: 'Do not commit or upload real .env files with credentials. Use .env.example with placeholders.',
        autoFixable: false
      });
      continue;
    }

    const lines = content.split('\n');

    // 1. Secret scanning
    for (const rule of SECRET_PATTERNS) {
      const rx = new RegExp(rule.regex.source, rule.regex.flags);
      let match: RegExpExecArray | null;
      while ((match = rx.exec(content)) !== null) {
        const matchedText = match[0];
        if (isSafeMatch(matchedText)) continue;

        const lineIndex = content.slice(0, match.index).split('\n').length;
        findings.push({
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          title: rule.title,
          filePath: rawPath,
          line: lineIndex,
          snippet: lines[lineIndex - 1]?.trim() || matchedText,
          highlight: matchedText.slice(0, 16) + '...',
          recommendation: rule.recommendation,
          autoFixable: false
        });
      }
    }

    // 2. Hygiene checks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      // Debugger statement
      if (/(?:^|[^a-zA-Z0-9_\-$])\bdebugger\b\s*;?/i.test(trimmed)) {
        findings.push({
          ruleId: 'hygiene/debuggers',
          category: 'Hygiene',
          severity: 'ERROR',
          title: 'Debugger Statement Found',
          filePath: rawPath,
          line: lineNum,
          snippet: trimmed,
          highlight: 'debugger',
          recommendation: 'Remove debugger breakpoint before shipping to production.',
          autoFixable: true,
          fixerType: 'strip-debugger'
        });
      }

      // Console log
      if (/(?:^|[^a-zA-Z0-9_\-$])\bconsole\.(?:log|debug|trace|dir)\s*\(/i.test(trimmed)) {
        findings.push({
          ruleId: 'hygiene/console-logs',
          category: 'Hygiene',
          severity: 'WARN',
          title: 'Console Debug Statement',
          filePath: rawPath,
          line: lineNum,
          snippet: trimmed,
          recommendation: 'Use a structured logging library or remove debug logs before deployment.',
          autoFixable: true,
          fixerType: 'comment-console'
        });
      }

      // Blocker comments
      if (/(?:\/\/|#|\/\*)\s*(?:TODO\s*\[BLOCKER\]|FIXME\s*\[CRITICAL\]|DO\s+NOT\s+COMMIT|NO_COMMIT|DO_NOT_SHIP)/i.test(trimmed)) {
        findings.push({
          ruleId: 'hygiene/blocker-comments',
          category: 'Hygiene',
          severity: 'ERROR',
          title: 'Unresolved BLOCKER / FIXME Marker',
          filePath: rawPath,
          line: lineNum,
          snippet: trimmed,
          recommendation: 'Resolve blocker tag before pushing code.',
          autoFixable: false
        });
      }

      // Linter suppression
      if (/(?:\/\/|\/\*|#)\s*(?:@ts-ignore|eslint-disable|pylint:\s*disable|#\s*noqa)/i.test(trimmed)) {
        findings.push({
          ruleId: 'hygiene/linter-bypasses',
          category: 'Hygiene',
          severity: 'WARN',
          title: 'Linter Suppression Comment',
          filePath: rawPath,
          line: lineNum,
          snippet: trimmed,
          recommendation: 'Fix the underlying type or lint issue instead of suppressing warnings.',
          autoFixable: false
        });
      }

      // Hardcoded localhost
      if (/(?:https?:\/\/localhost:[0-9]+|https?:\/\/127\.0\.0\.1:[0-9]+)/i.test(trimmed)) {
        findings.push({
          ruleId: 'hygiene/hardcoded-localhost',
          category: 'Hygiene',
          severity: 'WARN',
          title: 'Hardcoded Localhost Endpoint',
          filePath: rawPath,
          line: lineNum,
          snippet: trimmed,
          recommendation: 'Use environment variables instead of hardcoded localhost URLs.',
          autoFixable: false
        });
      }

      // Collect env references
      const envRx = /process\.env\.([A-Z0-9_]{3,})|os\.environ\[['"]([A-Z0-9_]{3,})['"]\]/g;
      let em: RegExpExecArray | null;
      while ((em = envRx.exec(line)) !== null) {
        const v = em[1] || em[2];
        if (v && !WHITELIST_ENV.has(v)) {
          codeEnvVars.add(v);
        }
      }
    }

    // 3. Schema & Migrations checks
    const isMigration = lowerPath.includes('migration') || lowerPath.endsWith('.sql') || lowerPath.includes('schema');
    if (isMigration || content.toLowerCase().includes('alter table')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;

        if (trimmed.startsWith('--') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

        // NOT NULL without DEFAULT
        if (/alter\s+table\s+.*add\s+(?:column\s+)?.*not\s+null/i.test(trimmed) && !/default/i.test(trimmed)) {
          findings.push({
            ruleId: 'schema/not-null-no-default',
            category: 'Schema & Migrations',
            severity: 'CRITICAL',
            title: 'Adding NOT NULL column without DEFAULT (Table Lock Hazard)',
            filePath: rawPath,
            line: lineNum,
            snippet: trimmed,
            highlight: trimmed,
            recommendation: "Add a DEFAULT clause (e.g., DEFAULT '') or perform zero-downtime 3-phase migration.",
            autoFixable: true,
            fixerType: 'schema-add-default'
          });
        }

        // Direct DROP COLUMN
        if (/alter\s+table\s+.*drop\s+(?:column\s+)?/i.test(trimmed)) {
          findings.push({
            ruleId: 'schema/dangerous-drop-column',
            category: 'Schema & Migrations',
            severity: 'CRITICAL',
            title: 'Dangerous direct DROP COLUMN (Irreversible Data Loss)',
            filePath: rawPath,
            line: lineNum,
            snippet: trimmed,
            recommendation: 'Deprecate column in application code before dropping in database maintenance window.',
            autoFixable: false
          });
        }
      }
    }

    // 4. Performance & Concurrency checks
    let inLoop = false;
    let loopStartLine = 0;
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('#')) continue;

      // Loop start (for, while, forEach, or async map with body)
      if (
        (/\bfor\s*\(|\bwhile\s*\(|\.forEach\s*\(/i.test(trimmed) ||
        /\.map\s*\(\s*(?:async\s*)?[({]/i.test(trimmed)) &&
        !line.includes('Promise.all') &&
        !(i > 0 && lines[i - 1].includes('Promise.all'))
      ) {
        inLoop = true;
        loopStartLine = lineNum;
        braceDepth = 0;
      }

      if (inLoop) {
        braceDepth += (line.match(/{/g) || []).length;
        braceDepth -= (line.match(/}/g) || []).length;

        // Only flag queries if genuinely inside loop body
        if (
          /\b(?:await\s+)?(?:db|prisma|sequelize|knex|mongoose|repository|\$query)\.(?:find|query|select|insert|update|delete)\b/i.test(trimmed) ||
          /\bawait\s+fetch\(/i.test(trimmed)
        ) {
          findings.push({
            ruleId: 'perf/n-plus-one-loop',
            category: 'Performance',
            severity: 'CRITICAL',
            title: 'N+1 query or network request detected inside loop',
            filePath: rawPath,
            line: lineNum,
            snippet: trimmed,
            recommendation: 'Batch this query using WHERE IN (...) or DataLoader pattern outside the loop.',
            autoFixable: false
          });
        }

        // Single line loop without braces or loop closing
        if ((!trimmed.includes('{') && (trimmed.endsWith(');') || trimmed.endsWith(')'))) || (braceDepth <= 0 && trimmed.includes('}'))) {
          inLoop = false;
        }
      }

      // Synchronous blocking file I/O
      if (/\bfs\.(?:readFileSync|writeFileSync|existsSync)\s*\(/i.test(trimmed) && (lowerPath.endsWith('.ts') || lowerPath.endsWith('.js'))) {
        findings.push({
          ruleId: 'perf/sync-io-in-server',
          category: 'Performance',
          severity: 'ERROR',
          title: 'Synchronous file I/O blocks Node.js event loop',
          filePath: rawPath,
          line: lineNum,
          snippet: trimmed,
          recommendation: 'Replace with asynchronous fs.promises.readFile to avoid stalling request handlers.',
          autoFixable: true,
          fixerType: 'perf-async-fs'
        });
      }
    }

    // 5. Language specific syntax checks
    if (lowerPath.endsWith('.json')) {
      try {
        JSON.parse(content);
      } catch (err: any) {
        findings.push({
          ruleId: 'syntax/json-parse',
          category: 'Syntax Integrity',
          severity: 'ERROR',
          title: 'Malformed JSON Syntax Error',
          filePath: rawPath,
          line: 1,
          snippet: err.message,
          recommendation: 'Fix JSON syntax formatting error before promotion.',
          autoFixable: false
        });
      }
    }

    if (lowerPath.endsWith('.py')) {
      // TabError / mixed indentation
      let hasTab = false;
      let hasSpace = false;
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^([ \t]+)/);
        if (match) {
          if (match[1].includes('\t')) hasTab = true;
          if (match[1].includes(' ')) hasSpace = true;
          if (hasTab && hasSpace) {
            findings.push({
              ruleId: 'syntax/py-tab-error',
              category: 'Syntax Integrity',
              severity: 'ERROR',
              title: 'Python Indentation TabError (Mixed Tabs and Spaces)',
              filePath: rawPath,
              line: i + 1,
              snippet: lines[i].trim(),
              recommendation: 'Convert tabs to standard 4-space indentation to prevent runtime TabError.',
              autoFixable: false
            });
            break;
          }
        }
      }
      // Mutable default argument
      for (let i = 0; i < lines.length; i++) {
        if (/def\s+\w+\s*\([^)]*=\s*(?:\[\]|\{\})/i.test(lines[i])) {
          findings.push({
            ruleId: 'syntax/py-mutable-default',
            category: 'Syntax Integrity',
            severity: 'WARN',
            title: 'Python Mutable Default Argument Trap',
            filePath: rawPath,
            line: i + 1,
            snippet: lines[i].trim(),
            recommendation: 'Use None as default argument and assign empty container inside function.',
            autoFixable: false
          });
        }
      }
    }

    if (lowerPath.endsWith('.java')) {
      // Double bracket initialization heap leak
      for (let i = 0; i < lines.length; i++) {
        if (/new\s+\w+(?:<[^>]*>)?\s*\([^)]*\)\s*\{\{/i.test(lines[i])) {
          findings.push({
            ruleId: 'syntax/java-double-bracket',
            category: 'Syntax Integrity',
            severity: 'ERROR',
            title: 'Java Double-Bracket Initialization (JVM Memory Leak)',
            filePath: rawPath,
            line: i + 1,
            snippet: lines[i].trim(),
            recommendation: 'Replace with List.of() or standard collection initialization to prevent memory leak.',
            autoFixable: false
          });
        }
      }
    }

    // Dependencies check in package.json
    if (lowerPath === 'package.json' || lowerPath.endsWith('/package.json')) {
      try {
        const pkg = JSON.parse(content);
        const allDeps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
        for (const [dep, ver] of Object.entries(allDeps)) {
          if (typeof ver === 'string' && (ver === '*' || ver === 'latest' || ver.startsWith('>='))) {
            findings.push({
              ruleId: 'dependencies/unpinned-wildcard',
              category: 'Dependencies',
              severity: 'WARN',
              title: `Unpinned Dependency Wildcard: ${dep}@${ver}`,
              filePath: rawPath,
              line: 1,
              snippet: `"${dep}": "${ver}"`,
              recommendation: 'Pin dependency to exact or tilde/caret range to avoid unexpected breaking updates.',
              autoFixable: false
            });
          }
        }
      } catch {
        // Ignored, syntax error caught above
      }
    }
  }

  // 6. Environment Drift check
  if (codeEnvVars.size > 0 && envExampleContent) {
    for (const v of codeEnvVars) {
      if (!envExampleContent.includes(v)) {
        findings.push({
          ruleId: 'env/missing-example-var',
          category: 'Environment Drift',
          severity: 'WARN',
          title: `Environment Drift: ${v} missing in .env.example`,
          filePath: '.env.example',
          line: 1,
          snippet: `${v}=`,
          highlight: v,
          recommendation: `Add ${v} with a dummy placeholder to .env.example so production setups know it is required.`,
          autoFixable: true,
          fixerType: 'env-sync',
          extraData: { varName: v }
        });
      }
    }
  }

  // Calculate scores
  let errorsCount = 0;
  let warningsCount = 0;
  let infoCount = 0;

  for (const f of findings) {
    if (f.severity === 'ERROR' || f.severity === 'CRITICAL') errorsCount++;
    else if (f.severity === 'WARN') warningsCount++;
    else infoCount++;
  }

  const deduction = (errorsCount * 25) + (warningsCount * 5) + (infoCount * 1);
  const score = Math.max(0, 100 - deduction);

  const status = errorsCount > 0 ? 'BLOCKED' : (warningsCount > 0 || score < 85 ? 'WARN' : 'PASS');

  const summary = status === 'BLOCKED'
    ? `Quality gate BLOCKED: Found ${errorsCount} critical hazard(s) that must be resolved before shipping.`
    : status === 'WARN'
    ? `Quality gate passed with ${warningsCount} warning(s). Review recommendations before shipping.`
    : `Quality gate PASSED (100% Ready). All ${targetFiles.length} inspected file(s) are clean.`;

  const categories: Record<string, { errors: number; warnings: number; clean: boolean }> = {
    Security: { errors: 0, warnings: 0, clean: true },
    Hygiene: { errors: 0, warnings: 0, clean: true },
    'Schema & Migrations': { errors: 0, warnings: 0, clean: true },
    Performance: { errors: 0, warnings: 0, clean: true },
    'Syntax Integrity': { errors: 0, warnings: 0, clean: true },
    'Git Hygiene': { errors: 0, warnings: 0, clean: true },
    Dependencies: { errors: 0, warnings: 0, clean: true },
    'Environment Drift': { errors: 0, warnings: 0, clean: true }
  };

  for (const f of findings) {
    const cat = categories[f.category] || { errors: 0, warnings: 0, clean: true };
    if (f.severity === 'ERROR' || f.severity === 'CRITICAL') {
      cat.errors++;
      cat.clean = false;
    } else if (f.severity === 'WARN') {
      cat.warnings++;
      cat.clean = false;
    }
    categories[f.category] = cat;
  }

  // Blast radius calculation
  const hasSchema = findings.some(f => f.category === 'Schema & Migrations');
  const hasPerf = findings.some(f => f.category === 'Performance');
  const blastScore = hasSchema ? 75 : hasPerf ? 45 : targetFiles.length > 5 ? 30 : 5;
  const riskLevel = blastScore >= 60 ? 'HIGH' : blastScore >= 25 ? 'MEDIUM' : 'LOW';

  const durationMs = Date.now() - startTime;

  return {
    status,
    score,
    errorsCount,
    warningsCount,
    infoCount,
    filesChecked: targetFiles.length,
    durationMs,
    summary,
    categories,
    findings,
    blast: {
      score: blastScore,
      riskLevel,
      changedCount: targetFiles.length,
      downstreamCount: hasSchema ? 4 : hasPerf ? 2 : 0,
      explanation: hasSchema
        ? 'High blast radius (75%): Database migrations lock core tables and risk cascade timeouts.'
        : `Contained blast radius (${blastScore}%): Changes are localized.`
    },
    preMortem: {
      summary: errorsCount > 0
        ? `Identified ${errorsCount} critical release blocker(s) across ${targetFiles.length} file(s).`
        : 'All pre-flight health checks clean. Code is verified ready to deploy.',
      failureScenarios: findings.slice(0, 3).map(f => `${f.title} in ${f.filePath} (Line ${f.line})`),
      recommendedAction: status === 'BLOCKED'
        ? 'BLOCK MERGE: Critical hazards detected. Resolve issues before promotion.'
        : 'PASS: Safe to ship.',
      source: 'shipsafe-browser-engine'
    }
  };
}

/**
 * Apply auto-fix repair to a virtual file in memory.
 */
export function applyClientFix(finding: ClientFinding, file: VirtualFile): boolean {
  if (!file || typeof file.content !== 'string') return false;

  if (finding.fixerType === 'strip-debugger') {
    file.content = file.content.replace(/(?:^|\n)\s*debugger\s*;?\s*(?=\n|$)/g, '\n');
    return true;
  }

  if (finding.fixerType === 'comment-console') {
    file.content = file.content.replace(/(^|\n)(\s*)(console\.(?:log|debug|trace|dir)\s*\([^)]*\)\s*;?)/g, '$1$2// $3');
    return true;
  }

  if (finding.fixerType === 'schema-add-default') {
    file.content = file.content.replace(/(\badd\s+(?:column\s+)?[\w_]+\s+[\w_]+(?:\([^)]*\))?\s+not\s+null)(?!\s+default)/gi, "$1 DEFAULT ''");
    return true;
  }

  if (finding.fixerType === 'perf-async-fs') {
    file.content = file.content.replace(/\bfs\.readFileSync\s*\(/g, 'await fs.promises.readFile(');
    return true;
  }

  return false;
}

/**
 * Serialize files array into browser cookie chunks (~3KB per chunk).
 */
export function serializeFilesToCookieChunks(files: VirtualFile[]): {
  mainCookie: string;
  chunks: { name: string; value: string }[];
} {
  const compact = (files || []).map(f => ({
    path: (f.path || '').replace(/^[./]+/, ''),
    content: typeof f.content === 'string' ? f.content : ''
  }));

  const json = JSON.stringify(compact);
  const CHUNK_SIZE = 3000;

  if (json.length <= CHUNK_SIZE) {
    return {
      mainCookie: json,
      chunks: []
    };
  }

  const chunks: { name: string; value: string }[] = [];
  for (let i = 0; i < json.length; i += CHUNK_SIZE) {
    chunks.push({
      name: `shipsafe_chunk_${chunks.length}`,
      value: json.slice(i, i + CHUNK_SIZE)
    });
  }

  const manifest = compact.map(f => ({ path: f.path, size: f.content.length }));
  return {
    mainCookie: JSON.stringify({ manifest, chunked: true, count: chunks.length }),
    chunks
  };
}

/**
 * Deserialize files array from browser cookie chunks.
 */
export function deserializeFilesFromCookieChunks(
  getCookie: (name: string) => string | null,
  chunksCount: number
): VirtualFile[] {
  if (chunksCount > 0) {
    let fullJson = '';
    for (let i = 0; i < chunksCount; i++) {
      const chunk = getCookie(`shipsafe_chunk_${i}`);
      if (chunk !== null) fullJson += chunk;
    }
    if (fullJson) {
      try {
        const parsed = JSON.parse(fullJson);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fall through
      }
    }
  }

  const main = getCookie('shipsafe_files');
  if (main) {
    try {
      const parsed = JSON.parse(main);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through
    }
  }

  return [];
}
