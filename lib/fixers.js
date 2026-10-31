/**
 * Auto-Remediation Engine for ShipSafe
 * Safely repairs issues or unstages dangerous files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { unstageFile } from './git.js';

export function executeFix(cwd, fixerType, filePath, extraData = {}) {
  const fullPath = path.join(cwd, filePath);

  // Auto-infer fixerType if omitted or generic
  if (!fixerType || fixerType === 'auto') {
    if (path.basename(filePath).startsWith('.env')) {
      fixerType = 'unstage';
    } else if (extraData.varName || extraData.missingVar) {
      fixerType = 'sync-env';
    } else if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      if (code.includes('debugger')) fixerType = 'strip-debugger';
      else if (code.includes('console.log')) fixerType = 'comment-console';
      else if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) fixerType = 'yaml-tabs-to-spaces';
    }
  }

  switch (fixerType) {
    case 'sync-env': {
      const varName = extraData.varName || extraData.missingVar;
      const exampleFile = extraData.exampleFile || '.env.example';
      const examplePath = path.join(cwd, exampleFile);
      let currentContent = '';
      if (fs.existsSync(examplePath)) {
        currentContent = fs.readFileSync(examplePath, 'utf8');
      }
      if (varName) {
        if (!currentContent.includes(`${varName}=`)) {
          const addition = `\n# Synced by ShipSafe\n${varName}=\n`;
          fs.writeFileSync(examplePath, (currentContent.trimEnd() + addition), 'utf8');
          return { success: true, message: `Added ${varName}= to ${exampleFile}` };
        }
        return { success: true, message: `${varName} already present in ${exampleFile}` };
      }
      return { success: false, message: 'No variable name provided to sync' };
    }

    case 'unstage': {
      const ok = unstageFile(cwd, filePath);
      return { success: ok, message: `Unstaged ${filePath} from git staging area.` };
    }

    case 'strip-debugger': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');
      const updated = code
        .replace(/^[ \t]*debugger\s*;?[ \t]*\r?\n?/gm, '')
        .replace(/debugger\s*;?/g, '');
      fs.writeFileSync(fullPath, updated, 'utf8');
      return { success: true, message: `Removed debugger statements from ${filePath}` };
    }

    case 'comment-console': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');
      const updated = code.replace(/^([ \t]*)(console\.(?:log|debug|trace|dir)\s*\([^)]*\)\s*;?)/gm, '$1// [ShipSafe Removed] $2');
      fs.writeFileSync(fullPath, updated, 'utf8');
      return { success: true, message: `Commented out debug console statements in ${filePath}` };
    }

    case 'yaml-tabs-to-spaces': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');
      const updated = code.replace(/\t/g, '  ');
      fs.writeFileSync(fullPath, updated, 'utf8');
      return { success: true, message: `Replaced tabs with 2 spaces in ${filePath}` };
    }

    case 'add-to-gitignore': {
      const gitignorePath = path.join(cwd, '.gitignore');
      const pattern = extraData.pattern || filePath;
      let existing = '';
      if (fs.existsSync(gitignorePath)) {
        existing = fs.readFileSync(gitignorePath, 'utf8');
      }
      if (!existing.split('\n').some(line => line.trim() === pattern.trim())) {
        fs.writeFileSync(gitignorePath, (existing.trim() + '\n' + pattern.trim() + '\n').trimStart(), 'utf8');
        return { success: true, message: `Added ${pattern} to .gitignore` };
      }
      return { success: true, message: `${pattern} already exists in .gitignore` };
    }

    default:
      return { success: false, message: `Unknown fixer: ${fixerType}` };
  }
}
