/**
 * ShipSafe Core: Environment & Configuration Drift Sentinel
 * Catches missing environment variables and syncs .env.example
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from './schema.ts';

export interface EnvScanResult {
  findings: Finding[];
  missingVars: string[];
  referencedVars: string[];
}

export function scanEnvDrift(
  files: { path: string; content: string }[],
  cwd: string = process.cwd()
): EnvScanResult {
  const findings: Finding[] = [];
  const referencedVars = new Set<string>();

  // Regex patterns to discover referenced env vars in code
  const envPatterns = [
    /process\.env\.([A-Z0-9_]{3,})/g,
    /process\.env\[['"]([A-Z0-9_]{3,})['"]\]/g,
    /import\.meta\.env\.([A-Z0-9_]{3,})/g,
    /os\.environ(?:\.get)?\(['"]([A-Z0-9_]{3,})['"]\)/g
  ];

  // Whitelisted system variables
  const systemWhitelist = new Set([
    'NODE_ENV',
    'PORT',
    'PATH',
    'PWD',
    'HOME',
    'USER',
    'SHELL',
    'DEBUG',
    'CI'
  ]);

  for (const file of files) {
    if (
      file.path.startsWith('.env') ||
      file.path.includes('node_modules') ||
      /\.(svg|png|jpg|jpeg|gif|ico|webp|md)$/i.test(file.path)
    ) {
      continue;
    }

    for (const pattern of envPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(file.content)) !== null) {
        const varName = match[1];
        if (!systemWhitelist.has(varName)) {
          referencedVars.add(varName);
        }
      }
    }
  }

  // Load existing .env.example / .env.sample if available
  const exampleFileCandidates = [
    '.env.example',
    '.env.sample',
    '.env.template',
    'env.example',
    'sample.env'
  ];

  let exampleContent = '';
  let examplePath = '';

  for (const candidate of exampleFileCandidates) {
    const full = path.join(cwd, candidate);
    if (fs.existsSync(full)) {
      exampleContent = fs.readFileSync(full, 'utf-8');
      examplePath = candidate;
      break;
    }
  }

  const documentedVars = new Set<string>();
  if (exampleContent) {
    const lines = exampleContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z0-9_]+)=/i);
      if (match) {
        documentedVars.add(match[1]);
      }
    }
  }

  const missingVars: string[] = [];

  for (const varName of referencedVars) {
    if (!documentedVars.has(varName)) {
      missingVars.push(varName);

      // Locate where it was introduced
      for (const file of files) {
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(varName)) {
            findings.push({
              ruleId: 'env/missing-in-example',
              category: 'Environment Drift',
              severity: 'ERROR',
              title: `Environment variable "${varName}" missing in ${examplePath || '.env.example'}`,
              filePath: file.path,
              line: i + 1,
              snippet: lines[i].trim(),
              recommendation: `Add "${varName}=" to ${examplePath || '.env.example'} to prevent missing configuration crashes in staging/production. Run "shipsafe fix" to sync automatically.`,
              autoFixable: true
            });
            break;
          }
        }
      }
    }
  }

  return { findings, missingVars, referencedVars: Array.from(referencedVars) };
}
