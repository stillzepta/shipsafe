import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runGit(args, cwd = process.cwd()) {
  try {
    return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return null;
  }
}

export function isGitRepo(cwd = process.cwd()) {
  const res = runGit('rev-parse --is-inside-work-tree', cwd);
  return res === 'true';
}

export function getCurrentBranch(cwd = process.cwd()) {
  return runGit('branch --show-current', cwd) || runGit('rev-parse --abbrev-ref HEAD', cwd) || 'detached';
}

export function getLatestCommit(cwd = process.cwd()) {
  const hash = runGit('rev-parse --short HEAD', cwd);
  const msg = runGit('log -1 --pretty=%B', cwd);
  return { hash: hash || 'none', message: msg || 'No commits yet' };
}

export function getStagedFiles(cwd = process.cwd()) {
  const output = runGit('diff --cached --name-status', cwd);
  if (!output) return [];

  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\s+/);
      const status = parts[0];
      const filePath = parts.slice(1).join(' ');
      return {
        path: filePath,
        status: status.startsWith('A') ? 'added' : status.startsWith('M') ? 'modified' : status.startsWith('D') ? 'deleted' : 'changed'
      };
    });
}

export function getModifiedFiles(cwd = process.cwd()) {
  const output = runGit('status --porcelain', cwd);
  if (!output) return [];

  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const status = line.slice(0, 2);
      const filePath = line.slice(3).trim();
      const isStaged = status[0] !== ' ' && status[0] !== '?';
      return { path: filePath, status, isStaged };
    });
}

export function getAllTrackedFiles(cwd = process.cwd()) {
  const output = runGit('ls-files', cwd);
  if (!output) return [];
  return output.split('\n').map(l => l.trim()).filter(Boolean);
}

export function getStagedDiff(cwd = process.cwd(), filePath = null) {
  if (filePath) {
    const cachedDiff = runGit(`diff --cached -U3 -- "${filePath}"`, cwd);
    if (cachedDiff && cachedDiff.trim()) return cachedDiff;

    const workingDiff = runGit(`diff -U3 -- "${filePath}"`, cwd);
    if (workingDiff && workingDiff.trim()) return workingDiff;

    const headDiff = runGit(`diff HEAD -- "${filePath}"`, cwd);
    if (headDiff && headDiff.trim()) return headDiff;

    // Fallback: If clean or untracked file, format full content with unified headers for inspection
    const fullPath = path.join(cwd, filePath);
    if (fs.existsSync(fullPath)) {
      try {
        if (!fs.statSync(fullPath).isDirectory()) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          return `--- a/${filePath} (File Inspection View)\n+++ b/${filePath}\n@@ -1,${lines.length} +1,${lines.length} @@\n` +
            lines.map(line => ` ${line}`).join('\n');
        }
      } catch (err) {}
    }
  }
  return runGit('diff --cached -U3', cwd) || '';
}

export function getStagedFileContent(cwd = process.cwd(), filePath) {
  // Read file as it exists in git index
  const content = runGit(`show :${filePath}`, cwd);
  if (content !== null) return content;

  // Fallback to disk if not yet committed
  const fullPath = path.join(cwd, filePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  return '';
}

export function getFileSize(cwd = process.cwd(), filePath) {
  const fullPath = path.join(cwd, filePath);
  try {
    const stat = fs.statSync(fullPath);
    return stat.size;
  } catch {
    return 0;
  }
}

export function unstageFile(cwd = process.cwd(), filePath) {
  try {
    execSync(`git reset HEAD -- "${filePath}"`, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getHookStatus(cwd = process.cwd()) {
  const hooksDir = path.join(cwd, '.git', 'hooks');
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const prePushPath = path.join(hooksDir, 'pre-push');

  const preCommitInstalled = fs.existsSync(preCommitPath) && fs.readFileSync(preCommitPath, 'utf8').includes('shipsafe');
  const prePushInstalled = fs.existsSync(prePushPath) && fs.readFileSync(prePushPath, 'utf8').includes('shipsafe');

  return {
    preCommit: preCommitInstalled,
    prePush: prePushInstalled,
    installed: preCommitInstalled && prePushInstalled
  };
}

export function installGitHooks(cwd = process.cwd()) {
  const hooksDir = path.join(cwd, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const preCommitScript = `#!/bin/sh
# ShipSafe Pre-Commit Guardrail
# Automatically catches secrets, syntax errors, and dangerous code before commit.

if command -v node >/dev/null 2>&1; then
  node bin/shipsafe check --hook=pre-commit
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "\\033[1;31m✖ [ShipSafe] Commit blocked by local quality gate!\\033[0m"
    echo "\\033[0;33m  Fix the reported issues above or visit the dashboard: npm run serve\\033[0m"
    echo "\\033[0;90m  (Emergency bypass: git commit --no-verify)\\033[0m"
    echo ""
    exit 1
  fi
fi
exit 0
`;

  const prePushScript = `#!/bin/sh
# ShipSafe Pre-Push Guardrail
# Prevents unreviewed, broken, or branch-violating pushes to remote.

if command -v node >/dev/null 2>&1; then
  node bin/shipsafe check --hook=pre-push
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "\\033[1;31m✖ [ShipSafe] Push blocked by branch & quality protection rules!\\033[0m"
    echo "\\033[0;33m  Visit local dashboard for remediation: npm run serve\\033[0m"
    echo "\\033[0;90m  (Emergency bypass: git push --no-verify)\\033[0m"
    echo ""
    exit 1
  fi
fi
exit 0
`;

  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const prePushPath = path.join(hooksDir, 'pre-push');

  fs.writeFileSync(preCommitPath, preCommitScript, { mode: 0o755 });
  fs.writeFileSync(prePushPath, prePushScript, { mode: 0o755 });

  return { success: true, hooks: ['pre-commit', 'pre-push'] };
}

export function uninstallGitHooks(cwd = process.cwd()) {
  const hooksDir = path.join(cwd, '.git', 'hooks');
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const prePushPath = path.join(hooksDir, 'pre-push');

  if (fs.existsSync(preCommitPath)) fs.unlinkSync(preCommitPath);
  if (fs.existsSync(prePushPath)) fs.unlinkSync(prePushPath);

  return { success: true };
}
