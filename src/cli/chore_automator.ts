/**
 * ShipSafe CLI: Chore Automator
 * Eliminates developer grunt work: syncs .env.example, strips debuggers, creates rollback stubs.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ChoreResult {
  action: string;
  target: string;
  success: boolean;
  message: string;
}

export function syncEnvExample(missingVars: string[], cwd: string = process.cwd()): ChoreResult {
  if (missingVars.length === 0) {
    return {
      action: 'sync-env',
      target: '.env.example',
      success: true,
      message: 'No missing environment variables. .env.example is up to date.'
    };
  }

  const examplePath = path.join(cwd, '.env.example');
  let currentContent = '';
  if (fs.existsSync(examplePath)) {
    currentContent = fs.readFileSync(examplePath, 'utf-8');
  }

  let additions = '\n# Automatically synced by ShipSafe\n';
  for (const v of missingVars) {
    if (!currentContent.includes(`${v}=`)) {
      additions += `${v}=\n`;
    }
  }

  fs.writeFileSync(examplePath, currentContent + additions, 'utf-8');

  return {
    action: 'sync-env',
    target: '.env.example',
    success: true,
    message: `Added ${missingVars.length} missing variable(s) to .env.example: ${missingVars.join(', ')}`
  };
}

export function stripDebuggers(filePaths: string[], cwd: string = process.cwd()): ChoreResult[] {
  const results: ChoreResult[] = [];

  for (const p of filePaths) {
    const full = path.join(cwd, p);
    if (!fs.existsSync(full)) continue;

    const content = fs.readFileSync(full, 'utf-8');
    if (content.includes('debugger;')) {
      const cleaned = content.replace(/^\s*debugger;\s*$/gm, '');
      fs.writeFileSync(full, cleaned, 'utf-8');
      results.push({
        action: 'strip-debugger',
        target: p,
        success: true,
        message: `Removed debugger statements from ${p}`
      });
    }
  }

  return results;
}
