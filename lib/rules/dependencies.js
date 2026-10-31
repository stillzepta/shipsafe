/**
 * Rule: Dependency & Lockfile Integrity
 * Verifies lockfile synchronization and guards against unpinned wildcards.
 */

import path from 'node:path';

export function checkDependencies(stagedFiles, config = {}, fileContents = {}) {
  const findings = [];
  const rules = config.rules || {};

  const stagedPaths = stagedFiles.map(f => f.path);
  const pkgStaged = stagedPaths.find(p => path.basename(p) === 'package.json');
  const lockfileStaged = stagedPaths.some(p =>
    ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'].includes(path.basename(p))
  );

  // 1. Lockfile Sync Check
  if (pkgStaged && !lockfileStaged && rules['deps/lockfile-sync']?.enabled !== false) {
    findings.push({
      ruleId: 'deps/lockfile-sync',
      category: 'Dependencies',
      severity: rules['deps/lockfile-sync']?.severity || 'WARN',
      title: 'package.json Modified Without Staged Lockfile',
      filePath: pkgStaged,
      line: 1,
      column: 1,
      snippet: 'package.json was staged but package-lock.json/yarn.lock was not',
      highlight: 'Missing lockfile update',
      recommendation: 'Run your package manager install command and stage the updated lockfile to prevent CI desync.',
      autoFixable: false
    });
  }

  // 2. Wildcard version audit in staged package.json
  if (pkgStaged && rules['deps/wildcard-versions']?.enabled !== false) {
    const rawContent = fileContents[pkgStaged];
    if (rawContent) {
      try {
        const pkg = JSON.parse(rawContent);
        const depSections = ['dependencies', 'devDependencies', 'peerDependencies'];

        for (const sec of depSections) {
          const deps = pkg[sec] || {};
          for (const [depName, version] of Object.entries(deps)) {
            if (version === '*' || version === 'latest' || version.startsWith('>=')) {
              findings.push({
                ruleId: 'deps/wildcard-versions',
                category: 'Dependencies',
                severity: rules['deps/wildcard-versions']?.severity || 'WARN',
                title: `Unpinned Dependency Version '${depName}': '${version}'`,
                filePath: pkgStaged,
                line: 1,
                column: 1,
                snippet: `"${depName}": "${version}"`,
                highlight: version,
                recommendation: 'Pin dependency to a specific version or semver range (^ or ~) to avoid unexpected breaking builds.',
                autoFixable: true,
                fixerType: 'deps-pin-wildcard'
              });
            }
          }
        }
      } catch {
        // Syntax check will flag if invalid JSON
      }
    }
  }

  return findings;
}
