import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let DatabaseSync = null;
try {
  const sqlite = await import('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
} catch {
  DatabaseSync = null;
}

let dbInstance = null;
const memoryStore = {
  runs: [],
  nextId: 1
};

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      branch TEXT,
      commit_hash TEXT,
      status TEXT,
      score INTEGER,
      errors_count INTEGER,
      warnings_count INTEGER,
      info_count INTEGER,
      files_checked INTEGER,
      duration_ms INTEGER,
      summary TEXT,
      findings_json TEXT
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp DESC);
  `);
}

export function getDatabase(cwd = process.cwd()) {
  if (dbInstance) return dbInstance;
  if (!DatabaseSync) return null;

  try {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    let dbPath;

    if (isServerless) {
      try {
        const tmpDir = path.join(os.tmpdir(), '.shipsafe');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        dbPath = path.join(tmpDir, 'audit.db');
      } catch {
        dbPath = ':memory:';
      }
    } else {
      const shipsafeDir = path.join(cwd, '.shipsafe');
      if (!fs.existsSync(shipsafeDir)) {
        fs.mkdirSync(shipsafeDir, { recursive: true });
      }
      dbPath = path.join(shipsafeDir, 'audit.db');
    }

    dbInstance = new DatabaseSync(dbPath);
    initSchema(dbInstance);
    return dbInstance;
  } catch (err) {
    try {
      dbInstance = new DatabaseSync(':memory:');
      initSchema(dbInstance);
      return dbInstance;
    } catch {
      return null;
    }
  }
}

export function recordRun(cwd, runData) {
  const db = getDatabase(cwd);
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO runs (
          branch, commit_hash, status, score,
          errors_count, warnings_count, info_count,
          files_checked, duration_ms, summary, findings_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const info = stmt.run(
        runData.branch || 'unknown',
        runData.commitHash || 'uncommitted',
        runData.status,
        runData.score,
        runData.errorsCount,
        runData.warningsCount,
        runData.infoCount,
        runData.filesChecked,
        runData.durationMs,
        runData.summary,
        JSON.stringify(runData.findings || [])
      );

      return info.lastInsertRowid;
    } catch {
      // Fallback to in-memory store
    }
  }

  const id = memoryStore.nextId++;
  const run = {
    id,
    timestamp: new Date().toISOString(),
    branch: runData.branch || 'unknown',
    commit_hash: runData.commitHash || 'uncommitted',
    status: runData.status,
    score: runData.score,
    errors_count: runData.errorsCount,
    warnings_count: runData.warningsCount,
    info_count: runData.infoCount,
    files_checked: runData.filesChecked,
    duration_ms: runData.durationMs,
    summary: runData.summary,
    findings_json: JSON.stringify(runData.findings || [])
  };
  memoryStore.runs.unshift(run);
  if (memoryStore.runs.length > 100) memoryStore.runs.pop();
  return id;
}

export function getRecentRuns(cwd, limit = 20) {
  const db = getDatabase(cwd);
  if (db) {
    try {
      const stmt = db.prepare(`
        SELECT id, timestamp, branch, commit_hash, status, score,
               errors_count, warnings_count, info_count, files_checked,
               duration_ms, summary, findings_json
        FROM runs
        ORDER BY id DESC
        LIMIT ?
      `);
      return stmt.all(limit);
    } catch {}
  }
  return memoryStore.runs.slice(0, limit);
}

export function getRunById(cwd, id) {
  const db = getDatabase(cwd);
  let row = null;
  if (db) {
    try {
      const stmt = db.prepare(`SELECT * FROM runs WHERE id = ?`);
      row = stmt.get(id);
    } catch {}
  }
  if (!row) {
    row = memoryStore.runs.find(r => r.id === id);
  }
  if (row && row.findings_json) {
    try {
      row.findings = JSON.parse(row.findings_json);
    } catch {
      row.findings = [];
    }
  }
  return row || null;
}

export function getStats(cwd) {
  const db = getDatabase(cwd);
  if (db) {
    try {
      const totalStmt = db.prepare(`SELECT COUNT(*) as total_runs, AVG(score) as avg_score FROM runs`);
      const totals = totalStmt.get() || { total_runs: 0, avg_score: 100 };

      const passStmt = db.prepare(`SELECT COUNT(*) as count FROM runs WHERE status = 'PASS'`);
      const passCount = passStmt.get()?.count || 0;

      const blockedStmt = db.prepare(`SELECT COUNT(*) as count FROM runs WHERE status = 'BLOCKED'`);
      const blockedCount = blockedStmt.get()?.count || 0;

      return {
        totalRuns: totals.total_runs || 0,
        avgScore: Math.round(totals.avg_score || 100),
        passCount,
        blockedCount,
        passRate: totals.total_runs ? Math.round((passCount / totals.total_runs) * 100) : 100
      };
    } catch {}
  }

  const totalRuns = memoryStore.runs.length;
  if (totalRuns === 0) return { totalRuns: 0, avgScore: 100, passCount: 0, blockedCount: 0, passRate: 100 };
  const passCount = memoryStore.runs.filter(r => r.status === 'PASS').length;
  const blockedCount = memoryStore.runs.filter(r => r.status === 'BLOCKED').length;
  const avgScore = Math.round(memoryStore.runs.reduce((sum, r) => sum + (r.score || 0), 0) / totalRuns);
  return {
    totalRuns,
    avgScore,
    passCount,
    blockedCount,
    passRate: Math.round((passCount / totalRuns) * 100)
  };
}
