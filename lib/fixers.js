/**
 * Auto-Remediation Engine for ShipSafe
 * Safely repairs issues or unstages dangerous files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { unstageFile } from './git.js';

export function executeFix(cwd, fixerType, filePath, extraData = {}) {
  const fullPath = path.join(cwd, filePath);

  switch (fixerType) {
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
