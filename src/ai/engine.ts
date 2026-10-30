/**
 * ShipSafe AI: Local Open-Weight Intelligence Driver
 * Connects to Gemma 2 / Qwen 2.5 via Ollama with automatic heuristic fallback.
 */

import http from 'node:http';
import { generateHeuristicPreMortem, type PreMortemAnalysis } from './heuristic.ts';
import type { Finding } from '../core/schema.ts';
import type { BlastRadiusReport } from '../core/blast.ts';

export async function runAIPreMortem(
  findings: Finding[],
  blast: BlastRadiusReport,
  changedFiles: string[],
  model: string = 'gemma2:2b'
): Promise<{ analysis: PreMortemAnalysis; source: 'local-open-model' | 'deterministic-fallback' }> {
  // If no findings and low blast, heuristic is instant and perfect
  if (findings.length === 0 && blast.score < 25) {
    return {
      analysis: generateHeuristicPreMortem(findings, blast, changedFiles),
      source: 'deterministic-fallback'
    };
  }

  // Attempt local Ollama inference
  try {
    const prompt = `You are ShipSafe AI, an expert site reliability and production safety engineer.
Analyze these code changes and pre-flight health check findings:
Changed files: ${changedFiles.join(', ')}
Blast Radius Score: ${blast.score}% (${blast.riskLevel})
Findings:
${findings.map(f => `- [${f.severity}] ${f.category}: ${f.title} at ${f.filePath}:${f.line}`).join('\n')}

Provide a concise 2-sentence pre-mortem summary and 1 key operational hazard.`;

    const aiResponse = await callOllama(prompt, model, 1500); // 1.5s timeout
    if (aiResponse) {
      const baseAnalysis = generateHeuristicPreMortem(findings, blast, changedFiles);
      baseAnalysis.summary = aiResponse.trim();
      return {
        analysis: baseAnalysis,
        source: 'local-open-model'
      };
    }
  } catch {
    // Graceful fallback
  }

  return {
    analysis: generateHeuristicPreMortem(findings, blast, changedFiles),
    source: 'deterministic-fallback'
  };
}

function callOllama(prompt: string, model: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model,
      prompt,
      stream: false
    });

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: timeoutMs
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data.response || null);
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}
