/**
 * ShipSafe GitHub Action: PR Bot Review Commenter
 * Formats rich Markdown comments for pull request reviews.
 */

import type { Finding } from '../core/schema.ts';
import type { BlastRadiusReport } from '../core/blast.ts';
import type { PreMortemAnalysis } from '../ai/heuristic.ts';

export function formatGitHubPRComment(
  findings: Finding[],
  blast: BlastRadiusReport,
  analysis: PreMortemAnalysis,
  aiSource: string = 'local-open-model'
): string {
  const isBlocked = findings.some(f => f.severity === 'CRITICAL');
  const hasWarnings = findings.length > 0;

  let statusBadge = '🟢 **SHIP APPROVED**';
  if (isBlocked) {
    statusBadge = '🔴 **SHIP BLOCKED: CRITICAL HAZARDS**';
  } else if (hasWarnings) {
    statusBadge = '🟡 **SHIP WARNING: REVIEW REQUIRED**';
  }

  const totalBars = 20;
  const filledBars = Math.round((blast.score / 100) * totalBars);
  const bar = '█'.repeat(filledBars) + '░'.repeat(totalBars - filledBars);

  let md = `## ⚓ ShipSafe Pre-Flight Gatekeeper Report\n\n`;
  md += `### ${statusBadge}\n\n`;
  md += `> **Pre-Mortem Intelligence (${aiSource}):**  \n`;
  md += `> _"${analysis.summary}"_\n\n`;

  md += `| Metric | Measurement | Assessment |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **💥 Blast Radius** | \`${bar}\` **${blast.score}%** | **${blast.riskLevel}** (${blast.downstreamCount} downstream dependents) |\n`;
  md += `| **🛡️ Health Findings** | **${findings.length} issue(s)** | ${isBlocked ? '❌ P0 Hazards' : hasWarnings ? '⚠️ Non-blocking warnings' : '✅ 100% Clean'} |\n`;
  md += `| **🚦 Release Gate** | **${analysis.recommendedAction}** | Pre-deployment sign-off |\n\n`;

  if (findings.length > 0) {
    md += `### 🚨 Identified Health Findings\n\n`;
    for (const f of findings) {
      const icon = f.severity === 'CRITICAL' ? '🛑' : f.severity === 'ERROR' ? '❌' : '⚠️';
      md += `<details ${f.severity === 'CRITICAL' ? 'open' : ''}>\n`;
      md += `<summary>${icon} <b>[${f.severity}] ${f.title}</b> (<code>${f.ruleId}</code>)</summary>\n\n`;
      md += `- **Location:** \`${f.filePath}:${f.line}\`\n`;
      if (f.snippet) {
        md += `- **Code:** \`${f.snippet}\`\n`;
      }
      md += `- **Remediation:** ${f.recommendation}\n\n`;
      md += `</details>\n\n`;
    }
  }

  if (analysis.releaseNotes.opsWarnings.length > 0 || analysis.releaseNotes.breakingChanges.length > 0) {
    md += `### 📋 Automated Operational Release Notes\n\n`;
    if (analysis.releaseNotes.breakingChanges.length > 0) {
      md += `**⚠️ Breaking Changes:**\n`;
      for (const bc of analysis.releaseNotes.breakingChanges) {
        md += `- ${bc}\n`;
      }
      md += `\n`;
    }
    if (analysis.releaseNotes.opsWarnings.length > 0) {
      md += `**🔧 Ops Deployment Checklist:**\n`;
      for (const ow of analysis.releaseNotes.opsWarnings) {
        md += `- [ ] ${ow}\n`;
      }
      md += `\n`;
    }
  }

  md += `---\n*Generated automatically by [ShipSafe](https://github.com/stillzepta/shipsafe) • Developer Velocity & Production Health Gatekeeper*`;

  return md;
}
