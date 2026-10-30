/**
 * ShipSafe CLI: Terminal UI Formatter
 * Beautiful ANSI terminal cards, ASCII blast radius gauges, and health badges.
 */

import type { Finding } from '../core/schema.ts';
import type { BlastRadiusReport } from '../core/blast.ts';
import type { PreMortemAnalysis } from '../ai/heuristic.ts';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

export function renderBanner(): string {
  return `
${c.cyan}${c.bold}  ⚓ ShipSafe${c.reset} ${c.dim}v1.0.0 — Pre-Flight Blast Radius & Quality Gatekeeper${c.reset}
${c.dim}  ────────────────────────────────────────────────────────────────────────${c.reset}`;
}

export function renderBlastGauge(blast: BlastRadiusReport): string {
  const totalBars = 20;
  const filledBars = Math.round((blast.score / 100) * totalBars);
  const emptyBars = totalBars - filledBars;

  let color = c.green;
  if (blast.score >= 70) color = c.red;
  else if (blast.score >= 40) color = c.yellow;

  const bar = `${color}${'█'.repeat(filledBars)}${c.dim}${'░'.repeat(emptyBars)}${c.reset}`;

  return `
  ${c.bold}💥 Blast Radius Risk: [${bar}] ${color}${blast.score}% (${blast.riskLevel})${c.reset}
  ${c.dim}Impacts ${blast.downstreamCount} downstream module(s) across ${blast.changedCount} changed file(s).${c.reset}
  ${blast.criticalPathsTouched.length > 0 ? `  ${c.yellow}⚠️  Critical path touched: ${blast.criticalPathsTouched.join(', ')}${c.reset}\n` : ''}`;
}

export function renderFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return `\n  ${c.green}${c.bold}✔ ALL HEALTH CHECKS PASSED${c.reset} ${c.dim}— No table locks, env leaks, or N+1 hazards detected.${c.reset}\n`;
  }

  let out = `\n  ${c.bold}🚨 Health Check Findings (${findings.length}):${c.reset}\n`;

  for (const f of findings) {
    let badge = `${c.bgYellow}${c.white} WARN ${c.reset}`;
    if (f.severity === 'CRITICAL' || f.severity === 'ERROR') {
      badge = `${c.bgRed}${c.white} ${f.severity} ${c.reset}`;
    }

    out += `\n  ${badge} ${c.bold}${f.title}${c.reset} ${c.dim}(${f.ruleId})${c.reset}\n`;
    out += `    ${c.dim}Location:${c.reset} ${f.filePath}:${f.line}\n`;
    if (f.snippet) {
      out += `    ${c.dim}Code:${c.reset}     ${c.cyan}${f.snippet}${c.reset}\n`;
    }
    out += `    ${c.yellow}Fix:${c.reset}      ${f.recommendation}\n`;
  }

  return out;
}

export function renderPreMortem(analysis: PreMortemAnalysis, aiSource: string): string {
  let out = `\n  ${c.bold}🧠 Pre-Mortem Intelligence ${c.dim}(via ${aiSource})${c.reset}:\n`;
  out += `  ${c.cyan}"${analysis.summary}"${c.reset}\n\n`;

  out += `  ${c.bold}Action Required:${c.reset} ${analysis.recommendedAction.includes('BLOCK') ? c.red : c.green}${analysis.recommendedAction}${c.reset}\n`;

  if (analysis.releaseNotes.opsWarnings.length > 0) {
    out += `\n  ${c.yellow}${c.bold}Operational Release Notes:${c.reset}\n`;
    for (const w of analysis.releaseNotes.opsWarnings) {
      out += `   • ${w}\n`;
    }
  }

  return out;
}
