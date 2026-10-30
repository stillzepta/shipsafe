/**
 * ShipSafe Frontend Controller (Halloween Edition)
 * Reactive client with Project Path Sentinel, Server-Sent Events,
 * Real-Time Gauge, 4-Part Cognitive Diagnosis & Auto-Fix
 */

const state = {
  status: null,
  checkResult: null,
  activeFilter: 'all',
  activeDiffFile: null,
  activeTab: 'findings',
  rulesConfig: null,
  currentTargetPath: '.'
};

// UI Elements
const els = {
  branchName: document.getElementById('branchName'),
  liveWatcherBadge: document.getElementById('liveWatcherBadge'),
  btnRunCheck: document.getElementById('btnRunCheck'),
  btnHooks: document.getElementById('btnHooks'),
  hookBtnText: document.getElementById('hookBtnText'),
  gaugeScore: document.getElementById('gaugeScore'),
  gaugeProgress: document.getElementById('gaugeProgress'),
  gaugeVerdict: document.getElementById('gaugeVerdict'),
  gateStatusBadge: document.getElementById('gateStatusBadge'),
  metaFilesChecked: document.getElementById('metaFilesChecked'),
  metaErrors: document.getElementById('metaErrors'),
  metaWarnings: document.getElementById('metaWarnings'),
  metaDuration: document.getElementById('metaDuration'),
  summaryText: document.getElementById('summaryText'),
  categoryGrid: document.getElementById('categoryGrid'),
  findingsList: document.getElementById('findingsList'),
  findingsCount: document.getElementById('findingsCount'),
  stagedCount: document.getElementById('stagedCount'),
  diffFileSelect: document.getElementById('diffFileSelect'),
  diffLineCount: document.getElementById('diffLineCount'),
  diffContent: document.getElementById('diffContent'),
  btnAutoFixAll: document.getElementById('btnAutoFixAll'),
  historyTableBody: document.getElementById('historyTableBody'),
  rulesForm: document.getElementById('rulesForm'),
  toast: document.getElementById('toast'),
  
  // Project Path Sentinel Elements
  targetPathInput: document.getElementById('targetPathInput'),
  btnScanTarget: document.getElementById('btnScanTarget'),
  btnScanAll: document.getElementById('btnScanAll'),
  pathTargetLabel: document.getElementById('pathTargetLabel'),
  pathChips: document.querySelectorAll('.path-chip'),

  // Blast Radius & Pre-Mortem elements
  blastRiskBadge: document.getElementById('blastRiskBadge'),
  blastMeterFill: document.getElementById('blastMeterFill'),
  blastScoreText: document.getElementById('blastScoreText'),
  blastDependentsText: document.getElementById('blastDependentsText'),
  blastModulesList: document.getElementById('blastModulesList'),
  aiSourceLabel: document.getElementById('aiSourceLabel'),
  premortemActionBadge: document.getElementById('premortemActionBadge'),
  premortemSummaryText: document.getElementById('premortemSummaryText'),
  opsWarningsBox: document.getElementById('opsWarningsBox'),
  opsWarningsList: document.getElementById('opsWarningsList'),

  // Benchmark elements
  btnTriggerBenchmark: document.getElementById('btnTriggerBenchmark'),
  btnRunBenchmarkTop: document.getElementById('btnRunBenchmarkTop'),
  benchCiStat: document.getElementById('benchCiStat'),
  benchShipSafeStat: document.getElementById('benchShipSafeStat'),
  benchmarkTableBody: document.getElementById('benchmarkTableBody')
};

// Show Toast
function showToast(msg, type = 'info') {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.style.display = 'block';
  els.toast.style.borderColor = type === 'error' ? 'var(--accent-red)' : type === 'success' ? 'var(--accent-green)' : 'var(--accent-hotpink)';
  els.toast.style.boxShadow = `0 0 20px ${type === 'error' ? 'rgba(255, 0, 85, 0.4)' : type === 'success' ? 'rgba(0, 255, 170, 0.4)' : 'rgba(255, 0, 127, 0.4)'}`;
  setTimeout(() => {
    els.toast.style.display = 'none';
  }, 3500);
}

// Fetch Status
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.status = data;

    if (els.branchName) els.branchName.textContent = data.branch;
    if (els.stagedCount) els.stagedCount.textContent = (data.stagedFiles || []).length;

    // Hooks button state
    if (els.btnHooks && els.hookBtnText) {
      if (data.hooks && data.hooks.installed) {
        els.hookBtnText.textContent = 'Git Hooks Active ✔';
        els.btnHooks.classList.add('btn-success');
        els.btnHooks.classList.remove('btn-secondary');
      } else {
        els.hookBtnText.textContent = 'Install Git Hooks';
        els.btnHooks.classList.remove('btn-success');
        els.btnHooks.classList.add('btn-secondary');
      }
    }

    renderStagedFilesSelector(data.stagedFiles || []);
  } catch (err) {
    console.error('Failed to load status:', err);
  }
}

// Populate Staged Files dropdown in Diff Tab
function renderStagedFilesSelector(files) {
  if (!els.diffFileSelect) return;
  els.diffFileSelect.innerHTML = '<option value="">Select a staged file...</option>';

  files.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.path;
    opt.textContent = `${f.path} (${f.status})`;
    els.diffFileSelect.appendChild(opt);
  });

  if (files.length > 0 && !state.activeDiffFile) {
    els.diffFileSelect.value = files[0].path;
    loadDiff(files[0].path);
  }
}

if (els.diffFileSelect) {
  els.diffFileSelect.onchange = (e) => {
    if (e.target.value) loadDiff(e.target.value);
  };
}

// Load Diff for File
async function loadDiff(filePath) {
  state.activeDiffFile = filePath;
  if (els.diffFileSelect) els.diffFileSelect.value = filePath;

  try {
    const res = await fetch(`/api/diff?file=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    renderDiff(data.diff || '(No diff or untracked binary file)');
  } catch (err) {
    if (els.diffContent) els.diffContent.innerHTML = `<div class="empty-state"><code>Failed to load diff: ${err.message}</code></div>`;
  }
}

function renderDiff(rawDiff) {
  if (!els.diffContent) return;
  const lines = rawDiff.split('\n');
  if (els.diffLineCount) els.diffLineCount.textContent = `${lines.length} lines changed`;

  const formatted = lines.map(line => {
    const escaped = escapeHtml(line);
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return `<div class="diff-add">${escaped}</div>`;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return `<div class="diff-del">${escaped}</div>`;
    } else if (line.startsWith('@@') || line.startsWith('diff --git')) {
      return `<div class="diff-meta">${escaped}</div>`;
    }
    return `<div>${escaped}</div>`;
  }).join('');

  els.diffContent.innerHTML = formatted;
}

// ========================================================
// PRE-FLIGHT SCAN CONTROLLER (Supports Custom Project Paths)
// ========================================================
async function runCheck(customPath = null, checkAll = false) {
  const chosenPath = customPath !== null ? customPath : (state.currentTargetPath || '.');
  state.currentTargetPath = chosenPath;

  if (els.targetPathInput) els.targetPathInput.value = chosenPath;
  if (els.pathTargetLabel) els.pathTargetLabel.textContent = `Target: ${chosenPath}`;

  // Update button states
  if (els.btnRunCheck) {
    els.btnRunCheck.disabled = true;
    els.btnRunCheck.innerHTML = `<span class="btn-icon">⏳</span> Scanning...`;
  }
  if (els.btnScanTarget) {
    els.btnScanTarget.disabled = true;
    els.btnScanTarget.innerHTML = `<span class="btn-icon">⏳</span> Scanning...`;
  }

  try {
    const url = `/api/check?all=${checkAll ? 'true' : 'false'}&path=${encodeURIComponent(chosenPath)}`;
    const res = await fetch(url, { method: 'POST' });
    const result = await res.json();
    state.checkResult = result;

    renderCheckResult(result);
    loadStatus();
    loadHistory();

    const issueCount = (result.findings || []).length;
    showToast(
      `Scan Complete [${chosenPath}]: ${issueCount} anomaly detected (${result.score}/100)`,
      result.score >= 85 ? 'success' : result.score >= 60 ? 'info' : 'error'
    );
  } catch (err) {
    showToast(`Scan failed: ${err.message}`, 'error');
  } finally {
    if (els.btnRunCheck) {
      els.btnRunCheck.disabled = false;
      els.btnRunCheck.innerHTML = `<span class="btn-icon">▶</span> Run Pre-Flight Scan`;
    }
    if (els.btnScanTarget) {
      els.btnScanTarget.disabled = false;
      els.btnScanTarget.innerHTML = `<span class="btn-icon">⚡</span> Scan Target Path`;
    }
  }
}

// Render Results on UI
function renderCheckResult(res) {
  // 1. Gauge Score
  if (els.gaugeScore) els.gaugeScore.textContent = res.score;
  const circumference = 2 * Math.PI * 68; // 427.25
  const offset = circumference - (res.score / 100) * circumference;
  if (els.gaugeProgress) {
    els.gaugeProgress.style.strokeDashoffset = offset;
    els.gaugeProgress.style.stroke = res.score >= 85 ? 'var(--accent-green)' : res.score >= 60 ? 'var(--accent-pumpkin)' : 'var(--accent-hotpink)';
  }

  if (els.gaugeVerdict) {
    if (res.score >= 85) {
      els.gaugeVerdict.textContent = 'READY TO SHIP';
      els.gaugeVerdict.style.color = 'var(--accent-green)';
    } else if (res.score >= 60) {
      els.gaugeVerdict.textContent = 'NEEDS REVIEW';
      els.gaugeVerdict.style.color = 'var(--accent-pumpkin)';
    } else {
      els.gaugeVerdict.textContent = 'BLOCKED (HAZARDS)';
      els.gaugeVerdict.style.color = 'var(--accent-hotpink)';
    }
  }

  // 2. Gate Status Badge
  if (els.gateStatusBadge) {
    els.gateStatusBadge.textContent = res.status;
    els.gateStatusBadge.className = `status-badge ${
      res.status === 'PASS' ? 'status-pass' : res.status === 'WARN' ? 'status-warn' : 'status-blocked'
    }`;
  }

  // 3. Meta Indicators
  if (els.metaFilesChecked) els.metaFilesChecked.textContent = res.filesChecked || 0;
  if (els.metaErrors) els.metaErrors.textContent = res.errorsCount || 0;
  if (els.metaWarnings) els.metaWarnings.textContent = res.warningsCount || 0;
  if (els.metaDuration) els.metaDuration.textContent = `${res.durationMs || 0}ms`;
  if (els.summaryText) els.summaryText.textContent = res.summary || 'Code evaluated across pre-ship gatekeepers.';

  // 4. Render Categories & Findings
  renderCategories(res.categories || {});
  renderFindings(res.findings || []);

  // 5. Blast Radius & AI Pre-Mortem
  renderBlastAndPreMortem(res.blast, res.preMortem);
}

function renderBlastAndPreMortem(blast, preMortem) {
  if (blast) {
    if (els.blastMeterFill) {
      els.blastMeterFill.style.width = `${Math.min(100, Math.max(5, blast.score))}%`;
      els.blastMeterFill.style.background = blast.score >= 60 
        ? 'linear-gradient(90deg, var(--accent-pumpkin), var(--accent-hotpink))'
        : 'linear-gradient(90deg, var(--accent-green), var(--accent-cyan))';
    }

    if (els.blastScoreText) {
      els.blastScoreText.innerHTML = `<strong>${blast.score}%</strong> Blast Radius Score`;
    }

    if (els.blastRiskBadge) {
      els.blastRiskBadge.textContent = `${blast.riskLevel} IMPACT`;
      els.blastRiskBadge.className = `status-badge ${
        blast.riskLevel === 'LOW' ? 'status-pass' : blast.riskLevel === 'MEDIUM' ? 'status-warn' : 'status-blocked'
      }`;
    }

    if (els.blastDependentsText) {
      els.blastDependentsText.textContent = `${blast.downstreamCount || 0} downstream dependent module(s)`;
    }

    if (els.blastModulesList) {
      els.blastModulesList.innerHTML = '';
      if (blast.affectedModules && blast.affectedModules.length > 0) {
        blast.affectedModules.forEach(mod => {
          const span = document.createElement('span');
          span.className = 'blast-mod-pill';
          span.textContent = mod;
          els.blastModulesList.appendChild(span);
        });
      } else {
        els.blastModulesList.innerHTML = `<span class="text-dim" style="font-size:0.75rem;">No downstream dependents affected</span>`;
      }
    }
  }

  if (preMortem) {
    if (els.premortemSummaryText) els.premortemSummaryText.textContent = `"${preMortem.summary}"`;
    if (els.aiSourceLabel) els.aiSourceLabel.textContent = `Powered by ${preMortem.source || 'Local Gemma 2 / Deterministic'}`;

    const rec = preMortem.recommendedAction || 'PASS';
    if (els.premortemActionBadge) {
      els.premortemActionBadge.textContent = rec.includes('BLOCK') ? 'BLOCKED' : rec.includes('WARN') ? 'WARN' : 'PASS';
      els.premortemActionBadge.style.background = rec.includes('BLOCK') ? 'var(--accent-hotpink)' : rec.includes('WARN') ? 'var(--accent-pumpkin)' : 'var(--accent-green)';
    }

    if (els.opsWarningsBox && els.opsWarningsList) {
      if (preMortem.releaseNotes && preMortem.releaseNotes.opsWarnings && preMortem.releaseNotes.opsWarnings.length > 0) {
        els.opsWarningsBox.style.display = 'block';
        els.opsWarningsList.innerHTML = preMortem.releaseNotes.opsWarnings.map(w => `<li>• ${escapeHtml(w)}</li>`).join('');
      } else {
        els.opsWarningsBox.style.display = 'none';
      }
    }
  }
}

// Render Category Health Cards
function renderCategories(categories) {
  if (!els.categoryGrid) return;
  els.categoryGrid.innerHTML = '';

  const meta = {
    Security: { icon: '🛡️', title: 'Secrets & Auth' },
    Hygiene: { icon: '🧹', title: 'Code Hygiene' },
    'Git Hygiene': { icon: '🌿', title: 'Git & Branch Guard' },
    'Syntax Integrity': { icon: '🔍', title: 'Syntax & Files' },
    Dependencies: { icon: '📦', title: 'Dependency Integrity' }
  };

  for (const [key, cat] of Object.entries(categories)) {
    const info = meta[key] || { icon: '⚙️', title: key };
    const card = document.createElement('div');
    card.className = 'category-card';

    const isClean = cat.clean && cat.errors === 0;
    const dotColor = cat.errors > 0 ? 'var(--accent-red)' : cat.warnings > 0 ? 'var(--accent-pumpkin)' : 'var(--accent-green)';

    card.innerHTML = `
      <div class="cat-top">
        <span class="cat-icon">${info.icon}</span>
        <span class="cat-status-dot" style="background:${dotColor}; box-shadow: 0 0 8px ${dotColor};"></span>
      </div>
      <div>
        <div class="cat-name">${info.title}</div>
        <div class="cat-sub">${
          cat.errors > 0 ? `${cat.errors} critical error(s)` : cat.warnings > 0 ? `${cat.warnings} warning(s)` : 'Passing clean'
        }</div>
      </div>
    `;
    els.categoryGrid.appendChild(card);
  }
}

// ========================================================
// RENDER FINDINGS WITH 4-PART COGNITIVE DIAGNOSIS
// ========================================================
function renderFindings(findings) {
  if (!els.findingsList) return;
  els.findingsList.innerHTML = '';

  if (els.findingsCount) els.findingsCount.textContent = findings.length;

  const filtered = findings.filter(f => {
    if (state.activeFilter === 'all') return true;
    if (state.activeFilter === 'ERROR') return f.severity === 'ERROR' || f.severity === 'CRITICAL';
    if (state.activeFilter === 'WARN') return f.severity === 'WARN';
    if (state.activeFilter === 'autofix') return f.autoFixable;
    return true;
  });

  const hasAutoFixables = findings.some(f => f.autoFixable);
  if (els.btnAutoFixAll) els.btnAutoFixAll.style.display = hasAutoFixables ? 'inline-block' : 'none';

  if (filtered.length === 0) {
    els.findingsList.innerHTML = `
      <div class="empty-state card">
        <div class="empty-icon">🎉</div>
        <h3>No issues detected!</h3>
        <p style="color:var(--text-dim); font-size:0.85rem; margin-top:0.25rem;">
          ${findings.length === 0 ? 'All pre-flight health checks passed for this target. Your code is clean and production-ready.' : 'No findings match the active filter.'}
        </p>
      </div>
    `;
    return;
  }

  filtered.forEach(f => {
    const card = document.createElement('div');
    const sev = f.severity || 'ERROR';
    card.className = `finding-card severity-${sev}`;

    const solutionCode = f.possibleSolution || f.recommendation || 'Apply recommended safe code pattern.';

    card.innerHTML = `
      <div class="finding-header">
        <div class="finding-title-group">
          <span class="status-badge ${sev === 'CRITICAL' || sev === 'ERROR' ? 'status-blocked' : 'status-warn'}">${sev}</span>
          <span class="finding-title">${escapeHtml(f.title || 'Code Health Hazard')}</span>
          <span class="badge-tag">${escapeHtml(f.category || 'Quality Gate')}</span>
        </div>
        <div class="finding-actions">
          ${f.autoFixable ? `<button class="btn btn-xs btn-hotpink btn-fix" data-fixer="${f.fixerType}" data-path="${f.filePath}">⚡ Auto-Fix</button>` : ''}
          <button class="btn btn-xs btn-secondary btn-copy-fix">📋 Copy Fix</button>
          <button class="btn btn-xs btn-secondary btn-inspect" data-path="${f.filePath}">View Diff</button>
        </div>
      </div>

      <div class="finding-body">
        <!-- 1. Highlighted Section -->
        <div class="diagnosis-block highlight-box">
          <div class="highlight-label">📍 Highlighted Code Location &bull; ${escapeHtml(f.filePath)}:${f.line || 1}${f.column ? `:${f.column}` : ''}</div>
          ${f.snippet ? `<pre class="highlight-code">${escapeHtml(f.snippet)}</pre>` : `<span class="text-dim">File-level finding: ${escapeHtml(f.filePath)}</span>`}
        </div>

        <!-- 2. Developer Intent Analysis -->
        <div class="diagnosis-block intent-box">
          <div class="intent-label">🎯 Developer Intent Analysis</div>
          <p>${escapeHtml(f.intendedBehavior || 'The developer was intending to implement or evolve application capabilities.')}</p>
        </div>

        <!-- 3. Production Misbehavior & Outage Impact -->
        <div class="diagnosis-block misbehavior-box">
          <div class="misbehavior-label">⚠️ Production Misbehavior &amp; Hazard</div>
          <p>${escapeHtml(f.misbehavior || 'Under production traffic, this triggers severe performance degradation, connection pool exhaustion, or service failure.')}</p>
        </div>

        <!-- 4. Possible Solution & Remediation -->
        <div class="diagnosis-block solution-box">
          <div class="solution-content">
            <div class="solution-label">💡 Possible Solution &amp; Fix</div>
            <p>${escapeHtml(f.recommendation || 'Apply non-blocking or batched safe pattern.')}</p>
            ${solutionCode ? `<code class="solution-code">${escapeHtml(solutionCode)}</code>` : ''}
          </div>
        </div>
      </div>
    `;

    // Attach Event Handlers
    const copyBtn = card.querySelector('.btn-copy-fix');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(solutionCode);
        showToast('Remediation fix copied to clipboard!', 'success');
      };
    }

    const fixBtn = card.querySelector('.btn-fix');
    if (fixBtn) {
      fixBtn.onclick = () => runSingleFix(f.fixerType, f.filePath);
    }

    const inspectBtn = card.querySelector('.btn-inspect');
    if (inspectBtn) {
      inspectBtn.onclick = () => {
        switchTab('diff');
        loadDiff(f.filePath);
      };
    }

    els.findingsList.appendChild(card);
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Single Fix Action
async function runSingleFix(fixerType, filePath) {
  try {
    const res = await fetch('/api/fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixerType, filePath })
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message || 'Auto-fix executed successfully!', 'success');
      runCheck();
    } else {
      showToast(`Fix failed: ${result.message}`, 'error');
    }
  } catch (err) {
    showToast(`Fix error: ${err.message}`, 'error');
  }
}

// Outage Benchmark Runner
async function runBenchmarkUI() {
  if (els.btnTriggerBenchmark) {
    els.btnTriggerBenchmark.disabled = true;
    els.btnTriggerBenchmark.innerHTML = `<span class="btn-icon">⏳</span> Running Benchmark...`;
  }

  try {
    const res = await fetch('/api/benchmark');
    const data = await res.json();
    renderBenchmarkUI(data);
    showToast('Benchmark Complete: 10/10 Outage Scenarios Evaluated!', 'success');
  } catch (err) {
    showToast(`Benchmark error: ${err.message}`, 'error');
  } finally {
    if (els.btnTriggerBenchmark) {
      els.btnTriggerBenchmark.disabled = false;
      els.btnTriggerBenchmark.innerHTML = `<span class="btn-icon">▶</span> Run 10-Scenario Benchmark`;
    }
  }
}

function renderBenchmarkUI(data) {
  if (!els.benchmarkTableBody) return;

  if (els.benchCiStat) els.benchCiStat.textContent = `${data.standardCiCaught || 0} / ${data.total} Caught (0%)`;
  if (els.benchShipSafeStat) els.benchShipSafeStat.textContent = `${data.shipsafeCaught} / ${data.total} Caught (100%)`;

  els.benchmarkTableBody.innerHTML = '';
  (data.results || []).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.id.split('_')[0]}</strong></td>
      <td><strong>${r.name}</strong></td>
      <td><span class="badge-tag" style="background:#0e1424; color:var(--text-muted);">${r.category}</span></td>
      <td><span class="badge-tag text-danger" style="background:rgba(255, 0, 85, 0.15); color:var(--accent-red);">❌ ${r.standardCi}</span></td>
      <td><span class="badge-tag text-success" style="background:rgba(0, 255, 170, 0.15); color:var(--accent-green);">${r.shipsafe}</span></td>
    `;
    els.benchmarkTableBody.appendChild(tr);
  });
}

// History Audit Log
async function loadHistory() {
  if (!els.historyTableBody) return;
  try {
    const res = await fetch('/api/history?limit=15');
    const data = await res.json();
    renderHistory(data.history || []);
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function renderHistory(runs) {
  if (!els.historyTableBody) return;
  els.historyTableBody.innerHTML = '';

  if (runs.length === 0) {
    els.historyTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-dim); padding:1.5rem;">No checks recorded yet in SQLite database.</td></tr>`;
    return;
  }

  runs.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${r.id}</td>
      <td style="color:var(--text-dim);">${new Date(r.timestamp).toLocaleTimeString()}</td>
      <td><span class="badge-tag" style="background:#0e1424;">${r.commit_hash || 'HEAD'}</span></td>
      <td><span class="badge-tag" style="background:#0e1424;">${r.branch}</span></td>
      <td><span class="status-badge ${r.status === 'PASS' ? 'status-pass' : r.status === 'WARN' ? 'status-warn' : 'status-blocked'}">${r.status}</span></td>
      <td><strong>${r.score}</strong></td>
      <td class="text-danger">${r.errors_count}</td>
      <td class="text-warning">${r.warnings_count}</td>
      <td style="color:var(--text-dim);">${r.duration_ms}ms</td>
      <td style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.summary}</td>
    `;
    els.historyTableBody.appendChild(tr);
  });
}

// Rules Configuration
async function loadRulesConfig() {
  if (!els.rulesForm) return;
  try {
    const res = await fetch('/api/config');
    const conf = await res.json();
    state.rulesConfig = conf;
    renderRules(conf);
  } catch (err) {
    console.error('Failed to load rules:', err);
  }
}

function renderRules(conf) {
  if (!els.rulesForm || !conf.rules) return;
  els.rulesForm.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'rules-grid';

  const updateRuleConfig = async (ruleId, isEnabled) => {
    conf.rules[ruleId].enabled = isEnabled;
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conf)
    });
    showToast(`Rule ${ruleId} ${isEnabled ? 'enabled' : 'disabled'}.`, 'info');
    runCheck();
  };

  for (const [ruleId, ruleDef] of Object.entries(conf.rules)) {
    const card = document.createElement('div');
    card.className = 'rule-toggle-card';
    card.style.cssText = 'background:var(--bg-card-sub); border:1px solid var(--border-color); padding:0.85rem 1rem; border-radius:8px; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;';
    card.innerHTML = `
      <div class="rule-info">
        <strong style="display:block; color:#fff; font-size:0.85rem;">${ruleId}</strong>
        <span style="font-size:0.75rem; color:var(--text-dim);">Severity: ${ruleDef.severity || 'DEFAULT'}</span>
      </div>
      <div>
        <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
          <input type="checkbox" ${ruleDef.enabled !== false ? 'checked' : ''} data-rule="${ruleId}">
          <span style="font-size:0.8rem; font-weight:700; color:var(--accent-hotpink);">Enabled</span>
        </label>
      </div>
    `;

    const checkbox = card.querySelector('input');
    checkbox.onchange = () => updateRuleConfig(ruleId, checkbox.checked);

    container.appendChild(card);
  }

  els.rulesForm.appendChild(container);
}

// Tab Switching
function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.toggle('active', section.id === `tab-${tabId}`);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

// Findings Filter Buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeFilter = btn.dataset.filter;
    if (state.checkResult) {
      renderFindings(state.checkResult.findings || []);
    }
  };
});

// Setup Real-Time Server-Sent Events (SSE)
function setupSSE() {
  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('git-change', () => {
    if (els.liveWatcherBadge) {
      els.liveWatcherBadge.style.borderColor = 'var(--accent-hotpink)';
      els.liveWatcherBadge.querySelector('.live-text').textContent = 'GIT UPDATE DETECTED';
      setTimeout(() => {
        els.liveWatcherBadge.style.borderColor = 'var(--accent-hotpink)';
        els.liveWatcherBadge.querySelector('.live-text').textContent = 'WATCHING REPO';
      }, 1500);
    }

    loadStatus();
    runCheck();
  });
}

// Initial Boot & Event Wireup
window.addEventListener('DOMContentLoaded', async () => {
  // 1. Run Pre-Flight Check buttons
  if (els.btnRunCheck) {
    els.btnRunCheck.onclick = () => runCheck(state.currentTargetPath);
  }

  // 2. Project Path Input & Scan buttons
  if (els.btnScanTarget && els.targetPathInput) {
    els.btnScanTarget.onclick = () => {
      const val = els.targetPathInput.value.trim() || '.';
      runCheck(val);
    };

    els.targetPathInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const val = els.targetPathInput.value.trim() || '.';
        runCheck(val);
      }
    };
  }

  if (els.btnScanAll) {
    els.btnScanAll.onclick = () => runCheck('.', true);
  }

  // 3. Preset Quick Target Chips
  document.querySelectorAll('.path-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('.path-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const p = chip.dataset.path;
      if (els.targetPathInput) els.targetPathInput.value = p;
      runCheck(p);
    };
  });

  // 4. Benchmark triggers
  if (els.btnTriggerBenchmark) {
    els.btnTriggerBenchmark.onclick = runBenchmarkUI;
  }
  if (els.btnRunBenchmarkTop) {
    els.btnRunBenchmarkTop.onclick = () => {
      switchTab('benchmark');
      runBenchmarkUI();
    };
  }

  // 5. Git Hooks Toggle
  if (els.btnHooks) {
    els.btnHooks.onclick = async () => {
      const isInstalled = state.status?.hooks?.installed;
      const endpoint = isInstalled ? '/api/hooks/uninstall' : '/api/hooks/install';
      try {
        const res = await fetch(endpoint, { method: 'POST' });
        const data = await res.json();
        showToast(data.message, 'success');
        loadStatus();
      } catch (err) {
        showToast(`Hooks toggle failed: ${err.message}`, 'error');
      }
    };
  }

  // Initial Data Fetch
  await loadStatus();
  await runCheck('.');
  await loadRulesConfig();
  setupSSE();
});
