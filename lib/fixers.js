/**
 * Auto-Remediation Engine for ShipSafe
 * Safely repairs issues, schema hazards, performance traps, and unstages dangerous files.
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
      else if (/alter\s+table\s+.*add\s+(?:column\s+)?.*not\s+null/i.test(code) && !/default/i.test(code)) fixerType = 'schema-add-default';
      else if (/alter\s+table\s+.*drop\s+(?:column\s+)?[a-zA-Z0-9_]+/i.test(code)) fixerType = 'schema-safe-drop';
      else if (/foreign\s+key/i.test(code) && !code.toLowerCase().includes('create index')) fixerType = 'schema-index-fk';
      else if (/\bfs\.(?:readFileSync|writeFileSync)\b/.test(code)) fixerType = 'perf-sync-io';
      else if (/select\s+\*\s+from\s+[a-zA-Z0-9_]+/i.test(code) && !/limit\s+\d+/i.test(code)) fixerType = 'perf-unbounded-query';
      else if (extraData.cleanCode && extraData.snippet) fixerType = 'apply-clean-code';
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

    // ── DATABASE SCHEMA HAZARD FIXERS ──────────────────────────────────────
    case 'schema-add-default': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');

      // Use AI clean code if exact snippet matches
      if (extraData.cleanCode && extraData.snippet && code.includes(extraData.snippet)) {
        code = code.replace(extraData.snippet, extraData.cleanCode);
        fs.writeFileSync(fullPath, code, 'utf8');
        return { success: true, message: `Applied safe DEFAULT constraint migration in ${filePath}` };
      }

      // Regex replacement: find ADD [COLUMN] ... NOT NULL without DEFAULT
      const updated = code.replace(
        /(alter\s+table\s+.*add\s+(?:column\s+)?.*?)(\s+not\s+null)(.*)/i,
        (match, prefix, notNull, suffix) => {
          if (/default/i.test(prefix)) return match;
          let defaultVal = "'standard'";
          if (/int|serial|bigint|numeric/i.test(prefix)) defaultVal = '0';
          else if (/bool/i.test(prefix)) defaultVal = 'false';
          else if (/json/i.test(prefix)) defaultVal = "'{}'";
          return `${prefix} DEFAULT ${defaultVal}${notNull}${suffix}`;
        }
      );

      if (updated !== code) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        return { success: true, message: `Added DEFAULT value to NOT NULL column in ${filePath}` };
      }
      return { success: false, message: `Could not locate NOT NULL column without DEFAULT in ${filePath}` };
    }

    case 'schema-safe-drop': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');

      const updated = code.replace(
        /^[ \t]*(alter\s+table\s+.*drop\s+(?:column\s+)?[a-zA-Z0-9_]+.*)$/gmi,
        '-- [ShipSafe Migration Safety] Phase 1: Column marked deprecated. Stop reads/writes before dropping:\n-- $1'
      );

      if (updated !== code) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        return { success: true, message: `Converted destructive column drop to safe deprecation phase in ${filePath}` };
      }
      return { success: false, message: `Could not locate DROP COLUMN statement in ${filePath}` };
    }

    case 'schema-index-fk': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');

      if (code.toLowerCase().includes('create index')) {
        return { success: true, message: `Index already exists in ${filePath}` };
      }

      let table = 'orders';
      let col = 'user_id';
      const snippet = extraData.snippet || code;
      const tableMatch = /alter\s+table\s+([a-zA-Z0-9_]+)/i.exec(snippet);
      if (tableMatch) table = tableMatch[1];
      const colMatch = /foreign\s+key\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i.exec(snippet);
      if (colMatch) col = colMatch[1];

      const indexSql = `\n-- [ShipSafe] Index on Foreign Key to prevent table scan locks\nCREATE INDEX IF NOT EXISTS idx_${table}_${col} ON ${table}(${col});\n`;
      fs.writeFileSync(fullPath, code.trimEnd() + indexSql, 'utf8');
      return { success: true, message: `Added index idx_${table}_${col} to foreign key in ${filePath}` };
    }

    case 'schema-expand-contract': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');
      const updated = code.replace(
        /^[ \t]*(alter\s+table\s+.*rename\s+(?:column\s+)?.*|rename\s+table.*)$/gmi,
        '-- [ShipSafe Safe Migration] Renaming requires Expand-Contract pattern (add new column, sync data, deprecate old):\n-- $1'
      );
      if (updated !== code) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        return { success: true, message: `Wrapped rename with safe expand-contract advisory in ${filePath}` };
      }
      return { success: false, message: `Could not locate rename column in ${filePath}` };
    }

    // ── PERFORMANCE & RUNTIME HAZARD FIXERS ────────────────────────────────
    case 'perf-sync-io': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');

      let updated = code
        .replace(/\bfs\.readFileSync\b/g, 'await fs.promises.readFile')
        .replace(/\bfs\.writeFileSync\b/g, 'await fs.promises.writeFile')
        .replace(/\breadFileSync\b/g, 'await readFile')
        .replace(/\bwriteFileSync\b/g, 'await writeFile');

      if (updated !== code) {
        // Ensure enclosing function is marked async if not already
        updated = updated.replace(/(\bfunction\s+[a-zA-Z0-9_]+\s*\([^)]*\))/g, (match, fn) => {
          if (!match.startsWith('async')) return 'async ' + fn;
          return match;
        });

        fs.writeFileSync(fullPath, updated, 'utf8');
        return { success: true, message: `Converted blocking sync I/O to non-blocking async in ${filePath}` };
      }
      return { success: false, message: `No sync I/O operations found in ${filePath}` };
    }

    case 'perf-unbounded-query': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');

      const updated = code.replace(
        /(select\s+\*\s+from\s+[a-zA-Z0-9_]+)(\s*;\s*|\s*["'`])/i,
        (match, q, ending) => {
          if (/limit\s+\d+/i.test(match)) return match;
          return `${q} LIMIT 100${ending}`;
        }
      );

      if (updated !== code) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        return { success: true, message: `Added LIMIT 100 constraint to unbounded query in ${filePath}` };
      }
      return { success: false, message: `No unbounded SELECT query found in ${filePath}` };
    }

    case 'perf-batch-loop': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');

      // 1. If extraData.cleanCode is provided
      if (extraData.cleanCode && extraData.snippet && code.includes(extraData.snippet)) {
        code = code.replace(extraData.snippet, extraData.cleanCode);
        fs.writeFileSync(fullPath, code, 'utf8');
        return { success: true, message: `Applied batched query pattern in ${filePath}` };
      }

      // 2. Loop refactoring pattern
      const loopPattern = /for\s*\(\s*const\s+([a-zA-Z0-9_]+)\s+of\s+([a-zA-Z0-9_]+)\s*\)\s*\{[\s\S]*?(?:await\s+)?([a-zA-Z0-9_$.]+(?:\.find|\.query|\.select|\.get|\.fetch)\([^)]*\));?[\s\S]*?\}/i;
      if (loopPattern.test(code)) {
        const updated = code.replace(
          loopPattern,
          `// [ShipSafe Remediated: Batched to eliminate N+1 latency explosion]\n  const batchResults = await Promise.all(\n    $2.map($1 => $3)\n  );\n  results.push(...batchResults);`
        );
        fs.writeFileSync(fullPath, updated, 'utf8');
        return { success: true, message: `Refactored N+1 query loop to batched Promise.all in ${filePath}` };
      }

      // 3. Fallback: replace snippet with cached lookup
      if (extraData.snippet && code.includes(extraData.snippet)) {
        const updated = code.replace(
          extraData.snippet,
          `// [ShipSafe N+1 Remediated] Cached lookup outside loop\n    const record = cache.get(user?.id || item?.id);`
        );
        fs.writeFileSync(fullPath, updated, 'utf8');
        return { success: true, message: `Replaced in-loop query with cached lookup in ${filePath}` };
      }

      return { success: false, message: `Could not safely refactor loop in ${filePath}` };
    }

    // ── GENERAL CLEAN CODE FIXER ───────────────────────────────────────────
    case 'apply-clean-code': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      if (!extraData.cleanCode || !extraData.snippet) {
        return { success: false, message: 'Missing snippet or cleanCode in extraData' };
      }
      let code = fs.readFileSync(fullPath, 'utf8');
      if (!code.includes(extraData.snippet)) {
        return { success: false, message: 'Snippet not found in file' };
      }
      code = code.replace(extraData.snippet, extraData.cleanCode);
      fs.writeFileSync(fullPath, code, 'utf8');
      return { success: true, message: `Applied clean code replacement in ${filePath}` };
    }

    case 'deps-pin-wildcard': {
      if (!fs.existsSync(fullPath)) return { success: false, message: 'File not found' };
      let code = fs.readFileSync(fullPath, 'utf8');
      const updated = code
        .replace(/"\s*:\s*"\*"/g, '": "^1.0.0"')
        .replace(/"\s*:\s*"latest"/g, '": "^1.0.0"');
      if (updated !== code) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        return { success: true, message: `Pinned wildcard dependencies in ${filePath}` };
      }
      return { success: false, message: `No wildcard dependencies found in ${filePath}` };
    }

    default:
      return { success: false, message: `Unknown fixer: ${fixerType}` };
  }
}
