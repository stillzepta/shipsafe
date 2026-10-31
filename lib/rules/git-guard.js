/**
 * Rule: Git Guard & Repository Hygiene
 * Checks branch protection, dangerous file staging (.env, keys), file bloat, and system junk.
 */

import path from 'node:path';

const DANGEROUS_FILE_PATTERNS = [
  {
    regex: /^\.env(?:\.(?!example$|sample$|template$|dist$)[a-zA-Z0-9_\-]+)?$/,
    title: 'Environment Config (.env) Staged',
    severity: 'ERROR',
    category: 'Git Hygiene',
    recommendation: 'Unstage .env immediately and add it to .gitignore. Use .env.example for templates.',
    autoFixable: true,
    fixerType: 'unstage'
  },
  {
    regex: /(?:\.pem|\.key|\.pfx|\.p12|id_rsa|id_ed25519)$/i,
    title: 'Cryptographic Key File Staged',
    severity: 'ERROR',
    category: 'Git Hygiene',
    recommendation: 'Remove cryptographic certificates and keys from version control.',
    autoFixable: true,
    fixerType: 'unstage'
  },
  {
    regex: /(?:\.DS_Store|Thumbs\.db|desktop\.ini)$/i,
    title: 'Operating System Clutter Staged',
    severity: 'WARN',
    category: 'Git Hygiene',
    recommendation: 'Unstage OS junk files and configure global ignore.',
    autoFixable: true,
    fixerType: 'unstage'
  },
  {
    regex: /(?:\.sqlite|\.sqlite3|\.db|\.dump|\.sql\.gz)$/i,
    title: 'Raw Database File Staged',
    severity: 'ERROR',
    category: 'Git Hygiene',
    recommendation: 'Do not commit local SQLite databases or raw dumps to git.',
    autoFixable: true,
    fixerType: 'unstage'
  }
];

export function checkGitGuard(stagedFiles, currentBranch, config = {}, fileSizes = {}) {
  const findings = [];
  const rules = config.rules || {};

  // 1. Branch Protection Check
  const branchRule = rules['git/branch-protection'];
  if (branchRule && branchRule.enabled !== false) {
    const protectedBranches = branchRule.protectedBranches || ['main', 'master', 'release', 'production'];
    if (protectedBranches.includes(currentBranch)) {
      findings.push({
        ruleId: 'git/branch-protection',
        category: 'Git Hygiene',
        severity: branchRule.severity || 'ERROR',
        title: `Direct Action on Protected Branch '${currentBranch}'`,
        filePath: '(git repository)',
        line: 1,
        column: 1,
        snippet: `Current branch: ${currentBranch}`,
        highlight: currentBranch,
        recommendation: `Create a feature branch (e.g. git checkout -b feat/my-change) instead of committing directly to ${currentBranch}.`,
        autoFixable: false
      });
    }
  }

  // 2. Dangerous Files & File Bloat Check
  const largeFileRule = rules['git/large-files'];
  const maxSizeBytes = largeFileRule?.maxSizeBytes || (1024 * 1024); // 1MB default

  for (const file of stagedFiles) {
    const fileName = path.basename(file.path);

    // Check for dangerous file patterns
    for (const dangerous of DANGEROUS_FILE_PATTERNS) {
      if (dangerous.regex.test(fileName)) {
        findings.push({
          ruleId: 'git/dangerous-file',
          category: dangerous.category,
          severity: dangerous.severity,
          title: dangerous.title,
          filePath: file.path,
          line: 1,
          column: 1,
          snippet: `Staged file: ${file.path}`,
          highlight: fileName,
          recommendation: dangerous.recommendation,
          autoFixable: dangerous.autoFixable,
          fixerType: dangerous.fixerType
        });
      }
    }

    // Check file size
    const size = fileSizes[file.path] || 0;
    if (largeFileRule && largeFileRule.enabled !== false && size > maxSizeBytes) {
      const sizeMB = (size / (1024 * 1024)).toFixed(2);
      const limitMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
      findings.push({
        ruleId: 'git/large-files',
        category: 'Git Hygiene',
        severity: largeFileRule.severity || 'ERROR',
        title: `Large File Exceeds Size Limit (${sizeMB} MB > ${limitMB} MB)`,
        filePath: file.path,
        line: 1,
        column: 1,
        snippet: `File size: ${sizeMB} MB`,
        highlight: `${sizeMB} MB`,
        recommendation: `Use Git LFS for large binaries or remove from commit history.`,
        autoFixable: true,
        fixerType: 'unstage'
      });
    }
  }

  return findings;
}
