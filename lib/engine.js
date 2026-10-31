/**
 * ShipSafe Core Health & Gate Engine
 * Evaluates rules across staged changes or whole repo and calculates readiness scores.
 */

import path from 'node:path';
import fs from 'node:fs';
import { 
  getCurrentBranch, 
  getStagedFiles, 
  getAllTrackedFiles, 
  getStagedFileContent, 
  getFileSize,
  getLatestCommit,
  isGitRepo
} from './git.js';
import { scanForSecrets } from './rules/secrets.js';
import { scanForHygiene } from './rules/hygiene.js';
import { checkGitGuard } from './rules/git-guard.js';
import { checkSyntax } from './rules/syntax.js';
import { checkDependencies } from './rules/dependencies.js';
import { recordRun } from './db.js';
import { scanSchemaHazards } from '../src/core/schema.ts';
import { scanEnvDrift } from '../src/core/env.ts';
import { scanPerformanceHazards } from '../src/core/perf.ts';
import { calculateBlastRadius } from '../src/core/blast.ts';
import { runAIPreMortem, enrichFindingsWithAI } from '../src/ai/engine.ts';

export async function runHealthCheck(cwd = process.cwd(), options = {}) {
  const startTime = Date.now();
  const config = options.config || {};
  const checkAll = options.all || false;
  const skipDb = options.skipDb || false;

  if (!isGitRepo(cwd)) {
    return {
      status: 'BLOCKED',
      score: 0,
      summary: 'Not a git repository. Run "git init" first.',
      findings: [
        {
          ruleId: 'git/not-initialized',
          category: 'Git Hygiene',
          severity: 'ERROR',
          title: 'Directory is not a Git repository',
          filePath: '.',
          line: 1,
          column: 1,
          snippet: 'git rev-parse failed',
          highlight: 'git init required',
          recommendation: 'Initialize repository with git init to use ShipSafe.',
          autoFixable: false
        }
      ],
      categories: {},
      filesChecked: 0,
      durationMs: Date.now() - startTime
    };
  }

  const branch = getCurrentBranch(cwd);
  const commit = getLatestCommit(cwd);

  // 1. Gather files to inspect
  let targetFiles = [];
  if (options.targetPath) {
    const rawTarget = options.targetPath.trim();
    if (rawTarget === '.' || rawTarget === './') {
      const tracked = getAllTrackedFiles(cwd);
      targetFiles = tracked.map(p => ({ path: p, status: 'tracked' }));
    } else {
      const fullTarget = path.resolve(cwd, rawTarget);
      if (fs.existsSync(fullTarget)) {
        if (fs.statSync(fullTarget).isDirectory()) {
          const tracked = getAllTrackedFiles(cwd);
          targetFiles = tracked
            .filter(p => p.startsWith(rawTarget) || path.resolve(cwd, p).startsWith(fullTarget))
            .map(p => ({ path: p, status: 'targeted' }));
          
          if (targetFiles.length === 0) {
            const scanDir = (dir, base = '') => {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const e of entries) {
                if (e.name.startsWith('.') || ['node_modules', 'dist', 'build', '.git'].includes(e.name)) continue;
                const rel = path.join(base, e.name);
                if (e.isDirectory()) scanDir(path.join(dir, e.name), rel);
                else targetFiles.push({ path: path.relative(cwd, path.join(dir, e.name)), status: 'targeted' });
              }
            };
            scanDir(fullTarget, rawTarget);
          }
        } else {
          targetFiles = [{ path: path.relative(cwd, fullTarget), status: 'targeted' }];
        }
      }
    }
  } else if (checkAll) {
    const tracked = getAllTrackedFiles(cwd);
    targetFiles = tracked.map(p => ({ path: p, status: 'tracked' }));
  } else {
    targetFiles = getStagedFiles(cwd);
  }

  // Filter out ignored paths
  const ignoredPrefixes = config.ignoredPaths || [
    'node_modules/', '.git/', 'dist/', 'build/', '.next/', 'coverage/'
  ];

  targetFiles = targetFiles.filter(f => {
    return !ignoredPrefixes.some(pref => f.path.startsWith(pref) || f.path.includes('/' + pref));
  });

  const fileContents = {};
  const fileSizes = {};

  for (const file of targetFiles) {
    if (file.status === 'deleted') continue;
    const fullPath = path.join(cwd, file.path);
    if (fs.existsSync(fullPath)) {
      fileSizes[file.path] = getFileSize(cwd, file.path);
      // Read content if not binary or very large
      if (fileSizes[file.path] < 2 * 1024 * 1024) {
        fileContents[file.path] = (file.status === 'staged' || file.status === 'M')
          ? (getStagedFileContent(cwd, file.path) || fs.readFileSync(fullPath, 'utf-8'))
          : fs.readFileSync(fullPath, 'utf-8');
      }
    }
  }

  const findings = [];

  // 2. Git Guard (branch protection, dangerous files, size limits)
  findings.push(...checkGitGuard(targetFiles, branch, config, fileSizes));

  // 3. Dependencies check
  findings.push(...checkDependencies(targetFiles, config, fileContents));

  // 4. File-by-file checks (secrets, hygiene, syntax, schema, env, perf)
  const isLockfile = (p) => ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(path.basename(p));

  const validFiles = targetFiles
    .filter(f => f.status !== 'deleted' && !isLockfile(f.path) && typeof fileContents[f.path] === 'string')
    .map(f => ({ path: f.path, content: fileContents[f.path] }));

  // Skip self-flagging test files & fixtures unless explicitly targeted
  const isRepoScan = !options.targetPath || options.targetPath === '.' || options.targetPath === './';
  const nonTestFiles = isRepoScan
    ? validFiles.filter(f => !f.path.startsWith('test/') && !f.path.startsWith('tests/') && f.path !== 'benchmarks/suite.ts')
    : validFiles;

  findings.push(...scanSchemaHazards(nonTestFiles));
  const envResult = scanEnvDrift(nonTestFiles, cwd);
  findings.push(...envResult.findings);
  findings.push(...scanPerformanceHazards(nonTestFiles));

  for (const file of targetFiles) {
    if (file.status === 'deleted' || isLockfile(file.path)) continue;
    const content = fileContents[file.path];
    if (typeof content !== 'string') continue;

    // A. Secret scanning (skip test suites testing the scanner unless explicitly targeted)
    const isTestFile = isRepoScan && (file.path.startsWith('test/') || file.path.startsWith('tests/') || file.path === 'benchmarks/suite.ts');
    if (!isTestFile && config.rules?.['secrets/credentials']?.enabled !== false) {
      findings.push(...scanForSecrets(file.path, content, config.customSecretPatterns));
    }

    // B. Code Hygiene (skip test fixtures unless explicitly targeted)
    if (!isTestFile) {
      findings.push(...scanForHygiene(file.path, content, config));
    }

    // C. Syntax checks
    findings.push(...checkSyntax(file.path, content, config));
  }

  // Enrich findings with Open-Weight Gemma 2 AI Analysis & Parameter Diagnostics
  try {
    await enrichFindingsWithAI(findings, fileContents);
  } catch (err) {
    // Keep deterministic defaults if AI enrichment errors
  }

  // 5. Calculate Score & Status
  let errorsCount = 0;
  let warningsCount = 0;
  let infoCount = 0;

  for (const f of findings) {
    if (f.severity === 'ERROR' || f.severity === 'CRITICAL') errorsCount++;
    else if (f.severity === 'WARN') warningsCount++;
    else infoCount++;
  }

  let deduction = (errorsCount * 25) + (warningsCount * 5) + (infoCount * 1);
  let score = Math.max(0, 100 - deduction);

  let status = 'PASS';
  if (errorsCount > 0) {
    status = 'BLOCKED';
  } else if (warningsCount > 0 || score < 85) {
    status = 'WARN';
  }

  let summary = '';
  if (status === 'BLOCKED') {
    summary = `Quality gate BLOCKED: Found ${errorsCount} critical issue(s) that must be resolved before shipping.`;
  } else if (status === 'WARN') {
    summary = `Quality gate passed with ${warningsCount} warning(s). Review recommendations before shipping.`;
  } else {
    summary = `Quality gate PASSED (100% Ready). All ${targetFiles.length} inspected file(s) are clean.`;
  }

  // Category breakdown
  const categories = {
    Security: { errors: 0, warnings: 0, clean: true },
    Hygiene: { errors: 0, warnings: 0, clean: true },
    'Git Hygiene': { errors: 0, warnings: 0, clean: true },
    'Syntax Integrity': { errors: 0, warnings: 0, clean: true },
    Dependencies: { errors: 0, warnings: 0, clean: true }
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

  const durationMs = Date.now() - startTime;

  // 6. Blast Radius & AI Pre-Mortem Intelligence
  let blast = { score: 10, riskLevel: 'LOW', changedCount: targetFiles.length, downstreamCount: 0, affectedModules: [], criticalPathsTouched: [], explanation: 'Contained change.' };
  let preMortem = { summary: 'Code is clean and verified.', failureScenarios: [], recommendedAction: 'PASS: Safe to ship.', releaseNotes: { breakingChanges: [], opsWarnings: [], features: [] } };

  try {
    const allTracked = getAllTrackedFiles(cwd);
    const allRepoPayloads = allTracked
      .filter(p => !p.startsWith('node_modules') && !p.startsWith('.git'))
      .map(p => {
        const full = path.join(cwd, p);
        return {
          path: p,
          content: fileContents[p] || (fs.existsSync(full) && fs.statSync(full).size < 250000 ? fs.readFileSync(full, 'utf-8') : '')
        };
      });

    blast = calculateBlastRadius(targetFiles.map(f => f.path), allRepoPayloads);
    const aiRes = await runAIPreMortem(findings, blast, targetFiles.map(f => f.path));
    preMortem = { ...aiRes.analysis, source: aiRes.source };
  } catch {
    // Keep deterministic defaults
  }

  const result = {
    status,
    score,
    branch,
    commitHash: commit.hash,
    commitMessage: commit.message,
    errorsCount,
    warningsCount,
    infoCount,
    filesChecked: targetFiles.length,
    durationMs,
    summary,
    categories,
    findings,
    blast,
    preMortem,
    checkedFiles: targetFiles.map(f => f.path)
  };

  // Record to SQLite database
  if (!skipDb) {
    try {
      const runId = recordRun(cwd, result);
      result.id = runId;
    } catch (err) {
      // Don't crash check if DB write fails
      console.error('[ShipSafe DB Error]:', err.message);
    }
  }

  return result;
}
