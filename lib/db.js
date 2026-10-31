import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

let dbInstance = null;

export function getDatabase(cwd = process.cwd()) {
  if (dbInstance) return dbInstance;

  const shipsafeDir = path.join(cwd, '.shipsafe');
  if (!fs.existsSync(shipsafeDir)) {
    fs.mkdirSync(shipsafeDir, { recursive: true });
  }

  const dbPath = path.join(shipsafeDir, 'audit.db');
  dbInstance = new DatabaseSync(dbPath);

  // Initialize schema
  dbInstance.exec(`
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

  return dbInstance;
}

export function recordRun(cwd, runData) {
  const db = getDatabase(cwd);
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
}

export function getRecentRuns(cwd, limit = 20) {
  const db = getDatabase(cwd);
  const stmt = db.prepare(`
    SELECT id, timestamp, branch, commit_hash, status, score,
           errors_count, warnings_count, info_count, files_checked,
           duration_ms, summary, findings_json
    FROM runs
    ORDER BY id DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function getRunById(cwd, id) {
  const db = getDatabase(cwd);
  const stmt = db.prepare(`SELECT * FROM runs WHERE id = ?`);
  const row = stmt.get(id);
  if (row && row.findings_json) {
    try {
      row.findings = JSON.parse(row.findings_json);
    } catch {
      row.findings = [];
    }
  }
  return row;
}

export function getStats(cwd) {
  const db = getDatabase(cwd);
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
}
