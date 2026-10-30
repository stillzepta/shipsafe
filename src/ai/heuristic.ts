/**
 * ShipSafe AI: Deterministic Heuristic Engine
 * Fast, offline, zero-latency fallback for risk pre-mortems and release notes.
 */

import type { Finding } from '../core/schema.ts';
import type { BlastRadiusReport } from '../core/blast.ts';

export interface PreMortemAnalysis {
  summary: string;
  failureScenarios: string[];
  recommendedAction: string;
  releaseNotes: {
    breakingChanges: string[];
    opsWarnings: string[];
    features: string[];
  };
}

export function generateHeuristicPreMortem(
  findings: Finding[],
  blast: BlastRadiusReport,
  changedFiles: string[]
): PreMortemAnalysis {
  const failureScenarios: string[] = [];
  const breakingChanges: string[] = [];
  const opsWarnings: string[] = [];
  const features: string[] = [];

  for (const f of findings) {
    if (f.severity === 'CRITICAL' || f.severity === 'ERROR') {
      failureScenarios.push(`[${f.category}] ${f.title} (at ${f.filePath}:${f.line})`);
    }

    if (f.ruleId.startsWith('schema/')) {
      breakingChanges.push(`Database alteration in ${f.filePath}: ${f.title}`);
      opsWarnings.push(`Ops Alert: Run pre-deployment schema validation for ${f.filePath}`);
    } else if (f.ruleId.startsWith('env/')) {
      opsWarnings.push(`Config Drift: Ensure newly introduced environment variables are deployed before merge.`);
    } else if (f.ruleId.startsWith('perf/')) {
      failureScenarios.push(`Latency Spike: ${f.title} will degrade under high concurrency.`);
    }
  }

  if (blast.criticalPathsTouched.length > 0) {
    opsWarnings.push(`Critical Infrastructure: Modifies sensitive module (${blast.criticalPathsTouched.join(', ')}) with ${blast.score}% blast radius.`);
  }

  if (failureScenarios.length === 0) {
    failureScenarios.push('Low probability of runtime crash. Blast radius is contained.');
  }

  // Feature detection from changed filenames
  for (const f of changedFiles) {
    const base = f.split('/').pop() || f;
    features.push(`Updated ${base}`);
  }

  const summary = findings.length > 0
    ? `Pre-Mortem Alert: Identified ${findings.length} release risk(s) across ${changedFiles.length} file(s) with ${blast.score}% estimated blast radius.`
    : `All pre-flight health checks passed. Blast radius is safe (${blast.score}%) for deployment.`;

  const recommendedAction = findings.some(f => f.severity === 'CRITICAL')
    ? 'BLOCK MERGE: Critical hazards detected. Resolve database table locks and N+1 queries before promotion.'
    : findings.length > 0
    ? 'WARN: Review flagged items before production deployment.'
    : 'PASS: Safe to ship.';

  return {
    summary,
    failureScenarios,
    recommendedAction,
    releaseNotes: {
      breakingChanges,
      opsWarnings,
      features: features.slice(0, 5)
    }
  };
}
