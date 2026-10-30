/**
 * ShipSafe CLI: Master Command Router
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { scanSchemaHazards, type Finding } from '../core/schema.ts';
import { scanEnvDrift } from '../core/env.ts';
import { scanPerformanceHazards } from '../core/perf.ts';
import { calculateBlastRadius } from '../core/blast.ts';
import { runAIPreMortem } from '../ai/engine.ts';
import { renderBanner, renderBlastGauge, renderFindings, renderPreMortem } from './formatter.ts';
import { syncEnvExample, stripDebuggers } from './chore_automator.ts';

export async function runCli(args: string[] = process.argv.slice(2), cwd: string = process.cwd()) {
  const command = args[0] || 'scan';

  console.log(renderBanner());

  if (command === 'help' || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (command === 'fix') {
    await handleFix(cwd);
    return;
  }

  if (command === 'commit') {
    await handleCommit(args.slice(1), cwd);
    return;
  }

  if (command === 'scan' || command === 'check') {
    await handleScan(args, cwd);
    return;
  }

  console.log(`\n  Unknown command: "${command}". Run "shipsafe --help" for usage.\n`);
}

async function handleScan(args: string[], cwd: string) {
  const startTime = Date.now();
  const isAll = args.includes('--all');
  const explicitPaths = args.filter(a => !a.startsWith('-') && a !== 'scan' && a !== 'check');

  let files: { path: string; content: string }[] = [];
  if (explicitPaths.length > 0) {
    for (const rel of explicitPaths) {
      const full = path.resolve(cwd, rel);
      if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) {
        files.push({ path: path.relative(cwd, full), content: fs.readFileSync(full, 'utf-8') });
      }
    }
  } else {
    files = getFilesToInspect(cwd, isAll);
  }

  if (files.length === 0) {
    console.log(`\n  \x1b[33mNo modified or staged files found.\x1b[0m Stage files with "git add" or use "--all".\n`);
    return;
  }

  const allRepoFiles = getAllRepoFiles(cwd);

  // 1. Core Health Gatekeepers
  const schemaFindings = scanSchemaHazards(files);
  const envResult = scanEnvDrift(files, cwd);
  const perfFindings = scanPerformanceHazards(files);

  const allFindings: Finding[] = [
    ...schemaFindings,
    ...envResult.findings,
    ...perfFindings
  ];

  // 2. Blast Radius Calculation
  const blast = calculateBlastRadius(files.map(f => f.path), allRepoFiles);

  // 3. AI Pre-Mortem
  const { analysis, source } = await runAIPreMortem(allFindings, blast, files.map(f => f.path));

  // 4. Output Display
  console.log(renderBlastGauge(blast));
  console.log(renderFindings(allFindings));
  console.log(renderPreMortem(analysis, source));

  const duration = Date.now() - startTime;
  console.log(`  \x1b[2mCompleted in ${duration}ms across ${files.length} file(s).\x1b[0m\n`);

  if (allFindings.some(f => f.severity === 'CRITICAL')) {
    process.exitCode = 1;
  }
}

async function handleFix(cwd: string) {
  console.log(`\n  \x1b[1m⚡ Running Automated Chores...\x1b[0m\n`);

  const files = getFilesToInspect(cwd, false);
  const envResult = scanEnvDrift(files, cwd);

  const envChore = syncEnvExample(envResult.missingVars, cwd);
  console.log(`  • ${envChore.message}`);

  const debugChores = stripDebuggers(files.map(f => f.path), cwd);
  for (const c of debugChores) {
    console.log(`  • ${c.message}`);
  }

  console.log(`\n  \x1b[32m✔ Chores completed successfully!\x1b[0m\n`);
}

async function handleCommit(extraArgs: string[], cwd: string) {
  const files = getFilesToInspect(cwd, false);
  if (files.length === 0) {
    console.log(`\n  \x1b[33mNo staged files to commit. Run "git add" first.\x1b[0m\n`);
    return;
  }

  const allRepoFiles = getAllRepoFiles(cwd);
  const blast = calculateBlastRadius(files.map(f => f.path), allRepoFiles);

  const riskTag = blast.riskLevel === 'CRITICAL' ? 'CRITICAL' : blast.riskLevel === 'HIGH' ? 'HIGH-RISK' : 'SAFE';
  const defaultMsg = `feat: update ${files.map(f => f.path.split('/').pop()).join(', ')} [BLAST: ${blast.score}% ${riskTag}]`;
  const commitMsg = extraArgs.length > 0 ? `${extraArgs.join(' ')} [BLAST: ${blast.score}%]` : defaultMsg;

  console.log(`  Committing with risk annotation:\n  \x1b[36m"${commitMsg}"\x1b[0m\n`);
  try {
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit', cwd });
  } catch {
    // git will print error
  }
}

function getFilesToInspect(cwd: string, all: boolean): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  try {
    const cmd = all
      ? 'git ls-files'
      : 'git diff --cached --name-only';

    const output = execSync(cmd, { encoding: 'utf-8', cwd }).trim();
    if (!output) {
      if (!all) {
        // Fallback to unstaged modified files if nothing is staged
        const unstaged = execSync('git diff --name-only', { encoding: 'utf-8', cwd }).trim();
        if (!unstaged) return [];
        for (const rel of unstaged.split('\n').filter(Boolean)) {
          const full = path.join(cwd, rel);
          if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) {
            results.push({ path: rel, content: fs.readFileSync(full, 'utf-8') });
          }
        }
        return results;
      }
      return [];
    }

    for (const rel of output.split('\n').filter(Boolean)) {
      const full = path.join(cwd, rel);
      if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) {
        try {
          results.push({ path: rel, content: fs.readFileSync(full, 'utf-8') });
        } catch {
          // ignore binary
        }
      }
    }
  } catch {
    // fallback
  }
  return results;
}

function getAllRepoFiles(cwd: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  try {
    const list = execSync('git ls-files', { encoding: 'utf-8', cwd }).trim();
    for (const rel of list.split('\n').filter(Boolean)) {
      if (rel.endsWith('.ts') || rel.endsWith('.js') || rel.endsWith('.sql') || rel.endsWith('.json')) {
        const full = path.join(cwd, rel);
        if (fs.existsSync(full)) {
          results.push({ path: rel, content: fs.readFileSync(full, 'utf-8') });
        }
      }
    }
  } catch {
    // fallback
  }
  return results;
}

function printHelp() {
  console.log(`
  \x1b[1mUSAGE:\x1b[0m
    shipsafe [command] [options]

  \x1b[1mCOMMANDS:\x1b[0m
    scan, check        Run full pre-flight health gate on staged changes (default)
    fix                Auto-sync .env.example and clean debug code
    commit [msg]       Generate risk-weighted atomic commit message
    help               Show this manual

  \x1b[1mOPTIONS:\x1b[0m
    --all              Scan all tracked repository files instead of just diff
    --help, -h         Show help
`);
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  runCli();
}
