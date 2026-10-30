/**
 * ShipSafe Core: Blast Radius & Dependency Impact Engine
 * Calculates 0-100% blast radius risk score and downstream affected modules.
 */

import path from 'node:path';
import fs from 'node:fs';

export interface BlastRadiusReport {
  score: number; // 0 - 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  changedCount: number;
  downstreamCount: number;
  affectedModules: string[];
  criticalPathsTouched: string[];
  explanation: string;
}

export function calculateBlastRadius(
  changedFiles: string[],
  allFiles: { path: string; content: string }[]
): BlastRadiusReport {
  const importGraph = new Map<string, Set<string>>(); // file -> files that import it
  const criticalPathKeywords = ['auth', 'payment', 'billing', 'db', 'database', 'crypto', 'session', 'security', 'token'];

  // Initialize graph
  for (const f of allFiles) {
    importGraph.set(normalizePath(f.path), new Set());
  }

  // Build reverse import graph
  for (const f of allFiles) {
    const fromPath = normalizePath(f.path);
    const importRegex = /(?:from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)|import\s+['"]([^'"]+)['"])/g;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(f.content)) !== null) {
      const target = match[1] || match[2] || match[3];
      if (target.startsWith('.')) {
        // Resolve relative path
        const resolved = normalizePath(path.join(path.dirname(fromPath), target));
        // Match with or without extensions
        for (const [candidate] of importGraph) {
          if (candidate === resolved || candidate.replace(/\.[^/.]+$/, '') === resolved) {
            importGraph.get(candidate)?.add(fromPath);
          }
        }
      }
    }
  }

  // Calculate transitive downstream dependents for changed files
  const downstreamFiles = new Set<string>();
  const criticalPathsTouched: string[] = [];

  for (const changed of changedFiles) {
    const norm = normalizePath(changed);

    // Check critical keywords
    for (const kw of criticalPathKeywords) {
      if (norm.toLowerCase().includes(kw)) {
        criticalPathsTouched.push(norm);
        break;
      }
    }

    // BFS for downstream dependents
    const queue = [norm];
    const visited = new Set<string>([norm]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = importGraph.get(current);
      if (dependents) {
        for (const dep of dependents) {
          if (!visited.has(dep)) {
            visited.add(dep);
            downstreamFiles.add(dep);
            queue.push(dep);
          }
        }
      }
    }
  }

  // Calculate score (0 to 100)
  const baseRatio = allFiles.length > 0 ? (downstreamFiles.size / allFiles.length) : 0;
  let rawScore = Math.min(100, Math.round(baseRatio * 60 + changedFiles.length * 5));

  // Critical path boost
  if (criticalPathsTouched.length > 0) {
    rawScore = Math.min(100, rawScore + 35);
  }

  const score = Math.max(5, rawScore);

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (score >= 80) riskLevel = 'CRITICAL';
  else if (score >= 50) riskLevel = 'HIGH';
  else if (score >= 25) riskLevel = 'MEDIUM';

  const affectedModules = Array.from(downstreamFiles).slice(0, 8);

  const explanation =
    score >= 50
      ? `High blast radius! ${changedFiles.length} file(s) modified impact ${downstreamFiles.size} downstream dependent modules.${criticalPathsTouched.length > 0 ? ` Touches critical path (${criticalPathsTouched.join(', ')}).` : ''}`
      : `Contained blast radius (${score}%). Changes are localized to ${changedFiles.length} file(s) with minimal downstream cascade.`;

  return {
    score,
    riskLevel,
    changedCount: changedFiles.length,
    downstreamCount: downstreamFiles.size,
    affectedModules,
    criticalPathsTouched,
    explanation
  };
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}
