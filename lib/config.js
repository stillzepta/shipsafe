import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = {
  version: '1.0.0',
  projectName: 'ShipSafe Pre-Flight Gate',
  port: 4100,
  host: '127.0.0.1',
  scoreThresholds: {
    pass: 85,
    warn: 70
  },
  rules: {
    // Security & Secrets
    'secrets/credentials': { enabled: true, severity: 'ERROR' },
    'secrets/env-files': { enabled: true, severity: 'ERROR' },
    'secrets/private-keys': { enabled: true, severity: 'ERROR' },

    // Git Hygiene & Repo Bloat
    'git/branch-protection': { 
      enabled: false, 
      severity: 'WARN', 
      protectedBranches: ['production', 'release'] 
    },
    'git/large-files': { 
      enabled: true, 
      severity: 'ERROR', 
      maxSizeBytes: 1024 * 1024 // 1 MB limit
    },
    'git/system-clutter': { enabled: true, severity: 'WARN' },

    // Code Hygiene & Smells
    'hygiene/debuggers': { enabled: true, severity: 'ERROR' },
    'hygiene/console-logs': { enabled: true, severity: 'WARN' },
    'hygiene/blocker-comments': { enabled: true, severity: 'ERROR' },
    'hygiene/linter-bypasses': { enabled: true, severity: 'WARN' },
    'hygiene/hardcoded-localhost': { enabled: true, severity: 'WARN' },

    // Syntax & File Integrity
    'syntax/json-validity': { enabled: true, severity: 'ERROR' },
    'syntax/yaml-validity': { enabled: true, severity: 'ERROR' },
    'syntax/js-validity': { enabled: true, severity: 'ERROR' },

    // Dependency Integrity
    'deps/lockfile-sync': { enabled: true, severity: 'ERROR' },
    'deps/wildcard-versions': { enabled: true, severity: 'WARN' }
  },
  ignoredPaths: [
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    '.next/',
    'out/',
    'coverage/'
  ],
  customSecretPatterns: []
};

export function loadConfig(cwd = process.cwd()) {
  const configPath = path.join(cwd, '.shipsafe', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        rules: { ...DEFAULT_CONFIG.rules, ...(parsed.rules || {}) }
      };
    } catch (err) {
      console.warn(`[ShipSafe] Could not parse .shipsafe/config.json, using defaults:`, err.message);
    }
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(cwd = process.cwd(), newConfig) {
  const dir = path.join(cwd, '.shipsafe');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const configPath = path.join(dir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
  return newConfig;
}
