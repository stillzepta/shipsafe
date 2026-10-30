/**
 * Rule: Syntax & File Integrity
 * Validates JSON, YAML, and JavaScript files without executing untrusted code.
 */

import { spawnSync } from 'node:child_process';

export function checkSyntax(filePath, content, config = {}) {
  const findings = [];
  const rules = config.rules || {};
  const ext = filePath.includes('.') ? '.' + filePath.split('.').pop().toLowerCase() : '';

  // 1. JSON Syntax Check
  if (ext === '.json' && rules['syntax/json-validity']?.enabled !== false) {
    try {
      JSON.parse(content);
    } catch (err) {
      let line = 1;
      let column = 1;
      const match = /line (\d+) column (\d+)/i.exec(err.message) || /position (\d+)/i.exec(err.message);

      if (match && match[1] && match[2]) {
        line = parseInt(match[1], 10);
        column = parseInt(match[2], 10);
      } else if (match && match[1]) {
        const pos = parseInt(match[1], 10);
        const upToPos = content.slice(0, pos);
        line = upToPos.split('\n').length;
        column = upToPos.split('\n').pop().length + 1;
      }

      findings.push({
        ruleId: 'syntax/json-validity',
        category: 'Syntax Integrity',
        severity: rules['syntax/json-validity']?.severity || 'ERROR',
        title: 'Malformed JSON Syntax',
        filePath,
        line,
        column,
        snippet: err.message,
        highlight: 'JSON.parse failure',
        recommendation: 'Fix JSON syntax error (missing comma, trailing comma, unquoted key, or unclosed brace).',
        autoFixable: false
      });
    }
  }

  // 2. JavaScript / ESM Syntax Check
  if (['.js', '.mjs', '.cjs'].includes(ext) && rules['syntax/js-validity']?.enabled !== false) {
    try {
      const inputType = ext === '.cjs' ? '--input-type=commonjs' : '--input-type=module';
      const checkRes = spawnSync(process.execPath, [inputType, '--check'], {
        input: content,
        encoding: 'utf8'
      });

      if (checkRes.status !== 0) {
        const stderr = checkRes.stderr || '';
        let line = 1;
        let column = 1;
        const lineMatch = /:(\d+)(?::(\d+))?/.exec(stderr);
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10);
          column = lineMatch[2] ? parseInt(lineMatch[2], 10) : 1;
        }

        findings.push({
          ruleId: 'syntax/js-validity',
          category: 'Syntax Integrity',
          severity: rules['syntax/js-validity']?.severity || 'ERROR',
          title: 'JavaScript Syntax Error',
          filePath,
          line,
          column,
          snippet: stderr.split('\n').slice(0, 3).join(' ').trim(),
          highlight: 'SyntaxError',
          recommendation: 'Fix JavaScript syntax error before committing.',
          autoFixable: false
        });
      }
    } catch {
      // Fallback if spawnSync fails
    }
  }

  // 3. YAML basic syntax check
  if (['.yaml', '.yml'].includes(ext) && rules['syntax/yaml-validity']?.enabled !== false) {
    const lines = content.split('\n');
    let tabLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('\t')) {
        tabLine = i + 1;
        break;
      }
    }
    if (tabLine > 0) {
      findings.push({
        ruleId: 'syntax/yaml-validity',
        category: 'Syntax Integrity',
        severity: rules['syntax/yaml-validity']?.severity || 'ERROR',
        title: 'YAML Contains Disallowed Tab Indentation',
        filePath,
        line: tabLine,
        column: 1,
        snippet: lines[tabLine - 1],
        highlight: 'Tab (\\t) character',
        recommendation: 'YAML specification forbids tabs for indentation; use spaces.',
        autoFixable: true,
        fixerType: 'yaml-tabs-to-spaces'
      });
    }
  }

  return findings;
}
