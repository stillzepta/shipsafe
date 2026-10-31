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

  // 4. Python Language Checks (.py) — Indentation & Mutable Default Parameters
  if (ext === '.py') {
    const lines = content.split('\n');

    // 4a. Check for tab characters used in indentation
    if (rules['syntax/python-indentation']?.enabled !== false) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().length > 0 && /^\s*\t/.test(line)) {
          findings.push({
            ruleId: 'syntax/python-indentation',
            category: 'Syntax Integrity',
            severity: rules['syntax/python-indentation']?.severity || 'ERROR',
            title: 'Python Tab Indentation Hazard (TabError Risk)',
            filePath,
            line: i + 1,
            column: 1,
            snippet: line,
            highlight: 'Tab (\\t) indentation',
            recommendation: 'PEP 8 mandates 4 spaces for indentation. Mixing tabs and spaces triggers fatal TabError in production.',
            autoFixable: true,
            fixerType: 'yaml-tabs-to-spaces'
          });
          break;
        }
      }

      // 4b. Parse with python3 compiler if available to detect precise IndentationError
      try {
        const pyRes = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], {
          input: content,
          encoding: 'utf8',
          timeout: 1000
        });

        if (pyRes.status !== 0) {
          const stderr = pyRes.stderr || '';
          let errLine = 1;
          const lineMatch = /line (\d+)/i.exec(stderr);
          if (lineMatch && lineMatch[1]) errLine = parseInt(lineMatch[1], 10);

          const isIndentErr = /IndentationError|TabError/i.test(stderr);
          findings.push({
            ruleId: isIndentErr ? 'syntax/python-indentation' : 'syntax/python-syntax',
            category: 'Syntax Integrity',
            severity: 'ERROR',
            title: isIndentErr ? 'Python Indentation Syntax Error' : 'Python Syntax Error',
            filePath,
            line: errLine,
            column: 1,
            snippet: lines[errLine - 1] || stderr.split('\n')[0],
            highlight: isIndentErr ? 'IndentationError' : 'SyntaxError',
            recommendation: isIndentErr
              ? 'Fix Python indentation block. Ensure consistent 4-space indentation without mixed tabs or dangling blocks.'
              : 'Fix Python syntax error before merging.',
            autoFixable: false
          });
        }
      } catch {
        // Fallback if python3 is not available in environment
      }
    }

    // 4c. Check for Mutable Default Argument (classic Python production bug)
    if (rules['syntax/python-mutable-default']?.enabled !== false) {
      const mutableDefaultRegex = /def\s+([A-Za-z0-9_]+)\s*\([^)]*=\s*(\[\]|\{\}|\bset\(\))/;
      for (let i = 0; i < lines.length; i++) {
        const match = mutableDefaultRegex.exec(lines[i]);
        if (match) {
          findings.push({
            ruleId: 'syntax/python-mutable-default',
            category: 'Syntax Integrity',
            severity: 'ERROR',
            title: `Python Mutable Default Argument in '${match[1]}()'`,
            filePath,
            line: i + 1,
            column: lines[i].indexOf(match[2]) + 1,
            snippet: lines[i].trim(),
            highlight: match[2],
            recommendation: `Default arguments are evaluated once at module load time. Mutating '${match[2]}' leaks state across concurrent requests. Use 'param=None' and assign inside the function body.`,
            autoFixable: false
          });
        }
      }
    }
  }

  // 5. Java Language Checks (.java) — Double-Bracket Initialization & Bracket Imbalance
  if (ext === '.java') {
    const lines = content.split('\n');

    // 5a. Double-Bracket Initialization Anti-Pattern
    if (rules['syntax/java-double-bracket-init']?.enabled !== false) {
      const dbiRegex = /\bnew\s+([A-Za-z0-9_]+(?:<[^>]*>)?\s*\([^)]*\))\s*\{\s*\{/;
      for (let i = 0; i < lines.length; i++) {
        const match = dbiRegex.exec(lines[i]);
        if (match) {
          findings.push({
            ruleId: 'syntax/java-double-bracket-init',
            category: 'Syntax Integrity',
            severity: 'ERROR',
            title: `Java Double-Bracket Initialization Anti-Pattern (${match[1]})`,
            filePath,
            line: i + 1,
            column: lines[i].indexOf('{{') + 1,
            snippet: lines[i].trim(),
            highlight: '{{',
            recommendation: 'Double bracket initialization creates an anonymous inner class holding a hidden reference to the outer class. Replace with List.of(), Set.of(), Map.of(), or standard builder to avoid JVM memory leaks and serialization crashes.',
            autoFixable: false
          });
        }
      }
    }

    // 5b. Unbalanced Curly Braces / Brackets
    if (rules['syntax/java-unbalanced-brackets']?.enabled !== false) {
      let openBraces = 0;
      let closeBraces = 0;
      let inBlockComment = false;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (inBlockComment) {
          const endIdx = line.indexOf('*/');
          if (endIdx !== -1) {
            inBlockComment = false;
            line = line.substring(endIdx + 2);
          } else {
            continue;
          }
        }

        // Strip single line comments and string literals
        line = line.replace(/\/\*.*?\*\//g, '');
        const startBlock = line.indexOf('/*');
        if (startBlock !== -1) {
          inBlockComment = true;
          line = line.substring(0, startBlock);
        }
        line = line.replace(/\/\/.*$/, '');
        line = line.replace(/"(?:[^"\\]|\\.)*"/g, '');

        for (const char of line) {
          if (char === '{') openBraces++;
          if (char === '}') closeBraces++;
        }
      }

      if (openBraces !== closeBraces) {
        findings.push({
          ruleId: 'syntax/java-unbalanced-brackets',
          category: 'Syntax Integrity',
          severity: 'ERROR',
          title: `Java Unbalanced Brackets (${openBraces} '{' vs ${closeBraces} '}')`,
          filePath,
          line: lines.length,
          column: 1,
          snippet: lines[lines.length - 1] || `Unmatched braces in ${filePath}`,
          highlight: openBraces > closeBraces ? 'Missing closing brace }' : 'Unexpected extra closing brace }',
          recommendation: 'Ensure all class and method code blocks have properly matched opening and closing braces before compiling.',
          autoFixable: false
        });
      }
    }
  }

  return findings;
}
