/**
 * ShipSafe Frontend Controller
 * Reactive client with Server-Sent Events, real-time gauge, diff viewer & auto-fix
 */

const state = {
  status: null,
  checkResult: null,
  activeFilter: 'all',
  activeDiffFile: null,
  activeTab: 'findings',
  rulesConfig: null
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
  stagedFilesList: document.getElementById('stagedFilesList'),
  diffActiveFileName: document.getElementById('diffActiveFileName'),
  diffCodeBlock: document.getElementById('diffCodeBlock'),
  btnUnstageActive: document.getElementById('btnUnstageActive'),
  btnAutoFixAll: document.getElementById('btnAutoFixAll'),
  historyTableBody: document.getElementById('historyTableBody'),
  rulesForm: document.getElementById('rulesForm'),
  toast: document.getElementById('toast')
};

// Show Toast
function showToast(msg, type = 'info') {
  els.toast.textContent = msg;
  els.toast.style.display = 'block';
  els.toast.style.borderColor = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#38bdf8';
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

    els.branchName.textContent = data.branch;
    els.stagedCount.textContent = data.stagedFiles.length;

    // Hooks button state
    if (data.hooks && data.hooks.installed) {
      els.hookBtnText.textContent = 'Git Hooks Active ✔';
      els.btnHooks.classList.add('btn-success');
      els.btnHooks.classList.remove('btn-secondary');
    } else {
      els.hookBtnText.textContent = 'Install Git Hooks';
      els.btnHooks.classList.remove('btn-success');
      els.btnHooks.classList.add('btn-secondary');
    }

    renderStagedFiles(data.stagedFiles);
  } catch (err) {
    console.error('Failed to load status:', err);
  }
}

// Render Staged Files in Diff Tab
function renderStagedFiles(files) {
  els.stagedFilesList.innerHTML = '';
  if (!files || files.length === 0) {
    els.stagedFilesList.innerHTML = `<li class="file-list-item" style="color:var(--text-dim);">No files currently staged</li>`;
    els.diffCodeBlock.innerHTML = `<code>Stage files using "git add &lt;file&gt;" in your terminal to inspect diffs and run pre-flight gates.</code>`;
    return;
  }

  files.forEach((f, idx) => {
    const li = document.createElement('li');
    li.className = `file-list-item ${state.activeDiffFile === f.path ? 'active' : ''}`;
    li.innerHTML = `
      <span>${f.path}</span>
      <span class="badge-tag" style="background:#1e293b; color:#94a3b8;">${f.status}</span>
    `;
    li.onclick = () => loadDiff(f.path);
    els.stagedFilesList.appendChild(li);

    // Auto-select first file if none selected
    if (idx === 0 && !state.activeDiffFile) {
      loadDiff(f.path);
    }
  });
}

// Load Diff for File
async function loadDiff(filePath) {
  state.activeDiffFile = filePath;
  els.diffActiveFileName.textContent = filePath;
  els.btnUnstageActive.style.display = 'inline-block';
  els.btnUnstageActive.onclick = () => executeUnstage(filePath);

  // Update active file class
  document.querySelectorAll('.file-list-item').forEach(el => {
    if (el.textContent.includes(filePath)) el.classList.add('active');
    else el.classList.remove('active');
  });

  try {
    const res = await fetch(`/api/diff?file=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    renderDiff(data.diff || '(No diff or untracked binary file)');
  } catch (err) {
    els.diffCodeBlock.innerHTML = `<code>Failed to load diff: ${err.message}</code>`;
  }
}

function renderDiff(rawDiff) {
  const lines = rawDiff.split('\n');
  const formatted = lines.map(line => {
    const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return `<div class="diff-add">${escaped}</div>`;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return `<div class="diff-del">${escaped}</div>`;
    } else if (line.startsWith('@@') || line.startsWith('diff --git')) {
      return `<div class="diff-meta">${escaped}</div>`;
    }
    return `<div>${escaped}</div>`;
  }).join('');

  els.diffCodeBlock.innerHTML = formatted;
}

// Run Pre-Flight Health Check
async function runCheck() {
  els.btnRunCheck.disabled = true;
  els.btnRunCheck.innerHTML = `<span class="btn-icon">⏳</span> Checking...`;

  try {
    const res = await fetch('/api/check?all=false', { method: 'POST' });
    const result = await res.json();
    state.checkResult = result;
    renderCheckResult(result);
    loadStatus();
    loadHistory();
  } catch (err) {
    showToast(`Check failed: ${err.message}`, 'error');
  } finally {
    els.btnRunCheck.disabled = false;
    els.btnRunCheck.innerHTML = `<span class="btn-icon">▶</span> Run Pre-Flight Check`;
  }
}

// Render Results on UI
function renderCheckResult(res) {
  // 1. Gauge Score
  els.gaugeScore.textContent = res.score;
  const circumference = 2 * Math.PI * 68; // 427.25
  const offset = circumference - (res.score / 100) * circumference;
  els.gaugeProgress.style.strokeDashoffset = offset;

  if (res.score >= 85) {
    els.gaugeProgress.style.stroke = 'var(--accent-green)';
    els.gaugeVerdict.textContent = 'READY TO SHIP';
    els.gaugeVerdict.style.color = 'var(--accent-green)';
  } else if (res.score >= 60) {
    els.gaugeProgress.style.stroke = 'var(--accent-yellow)';
    els.gaugeVerdict.textContent = 'NEEDS REVIEW';
    els.gaugeVerdict.style.color = 'var(--accent-yellow)';
  } else {
    els.gaugeProgress.style.stroke = 'var(--accent-red)';
    els.gaugeVerdict.textContent = 'CRITICAL BLOCKS';
    els.gaugeVerdict.style.color = 'var(--accent-red)';
  }

  // Gate Status Badge
  els.gateStatusBadge.className = `status-badge ${
    res.status === 'PASS' ? 'status-pass' : res.status === 'WARN' ? 'status-warn' : 'status-blocked'
  }`;
  els.gateStatusBadge.textContent = res.status === 'PASS' ? 'GATE: PASSED' : res.status === 'WARN' ? 'GATE: REVIEW' : 'GATE: BLOCKED';

  // Meta items
  els.metaFilesChecked.textContent = res.filesChecked;
  els.metaErrors.textContent = res.errorsCount;
  els.metaWarnings.textContent = res.warningsCount;
  els.metaDuration.textContent = `${res.durationMs}ms`;
  els.summaryText.textContent = res.summary;
  els.findingsCount.textContent = res.findings.length;

  // 2. Render Categories
  renderCategories(res.categories);

  // 3. Render Findings
  renderFindings(res.findings);
}

// Render Category Health Cards
function renderCategories(categories) {
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
    const dotColor = cat.errors > 0 ? 'var(--accent-red)' : cat.warnings > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)';

    card.innerHTML = `
      <div class="cat-top">
        <span class="cat-icon">${info.icon}</span>
        <span class="cat-status-dot" style="background:${dotColor}; box-shadow: 0 0 6px ${dotColor};"></span>
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

// Render Findings List with Filtering
function renderFindings(findings) {
  els.findingsList.innerHTML = '';

  const filtered = findings.filter(f => {
    if (state.activeFilter === 'all') return true;
    if (state.activeFilter === 'ERROR') return f.severity === 'ERROR';
    if (state.activeFilter === 'WARN') return f.severity === 'WARN';
    if (state.activeFilter === 'autofix') return f.autoFixable;
    return true;
  });

  const hasAutoFixables = findings.some(f => f.autoFixable);
  els.btnAutoFixAll.style.display = hasAutoFixables ? 'inline-block' : 'none';

  if (filtered.length === 0) {
    els.findingsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <h3>No issues found!</h3>
        <p style="color:var(--text-dim); font-size:0.85rem; margin-top:0.25rem;">
          ${findings.length === 0 ? 'All health checks passed. Your staged changes are production-ready.' : 'No findings match this filter.'}
        </p>
      </div>
    `;
    return;
  }

  filtered.forEach(f => {
    const card = document.createElement('div');
    card.className = `finding-card severity-${f.severity}`;

    card.innerHTML = `
      <div class="finding-header">
        <div class="finding-title-group">
          <span class="status-badge ${f.severity === 'ERROR' ? 'status-blocked' : 'status-warn'}">${f.severity}</span>
          <span class="finding-title">${f.title}</span>
          <span class="badge-tag" style="background:#1e293b; color:#94a3b8;">${f.category}</span>
        </div>
        <div class="finding-actions">
          ${f.autoFixable ? `<button class="btn btn-xs btn-success btn-fix" data-fixer="${f.fixerType}" data-path="${f.filePath}">⚡ Auto-Fix</button>` : ''}
          <button class="btn btn-xs btn-secondary btn-inspect" data-path="${f.filePath}">View Diff</button>
        </div>
      </div>

      <div class="finding-body">
        <div style="margin-bottom:0.4rem;">
          <span class="finding-loc">${f.filePath}:${f.line}:${f.column}</span>
        </div>
        ${f.snippet ? `<div class="finding-code-preview">${escapeHtml(f.snippet)}</div>` : ''}
        <div class="finding-remediation"><strong>Fix:</strong> ${f.recommendation}</div>
      </div>
    `;

    // Attach Event Handlers
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
      showToast(result.message, 'success');
      runCheck();
    } else {
      showToast(`Fix failed: ${result.message}`, 'error');
    }
  } catch (err) {
    showToast(`Fix error: ${err.message}`, 'error');
  }
}

// Execute Unstage
async function executeUnstage(filePath) {
  await runSingleFix('unstage', filePath);
}

// Auto-Fix All Available
els.btnAutoFixAll.onclick = async () => {
  if (!state.checkResult) return;
  const fixables = state.checkResult.findings.filter(f => f.autoFixable);
  for (const item of fixables) {
    await fetch('/api/fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixerType: item.fixerType, filePath: item.filePath })
    });
  }
  showToast(`Auto-fixed ${fixables.length} item(s)!`, 'success');
  runCheck();
};

// Toggle Hooks Installation
els.btnHooks.onclick = async () => {
  const isInstalled = state.status?.hooks?.installed;
  const endpoint = isInstalled ? '/api/hooks/uninstall' : '/api/hooks/install';

  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isInstalled ? 'Git hooks uninstalled.' : 'Git pre-commit & pre-push hooks installed!', 'success');
      loadStatus();
    }
  } catch (err) {
    showToast(`Hook setup failed: ${err.message}`, 'error');
  }
};

// History Loader
async function loadHistory() {
  try {
    const res = await fetch('/api/history?limit=15');
    const data = await res.json();
    renderHistory(data.history || []);
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function renderHistory(runs) {
  els.historyTableBody.innerHTML = '';
  if (runs.length === 0) {
    els.historyTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-dim); padding:1.5rem;">No checks recorded yet in SQLite database.</td></tr>`;
    return;
  }

  runs.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${r.id}</td>
      <td style="color:var(--text-dim);">${new Date(r.timestamp).toLocaleTimeString()}</td>
      <td><span class="badge-tag" style="background:#1e293b;">${r.branch}</span></td>
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

// Rules Config Studio
async function loadRulesConfig() {
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
  els.rulesForm.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'rules-grid';

  for (const [ruleId, ruleDef] of Object.entries(conf.rules)) {
    const card = document.createElement('div');
    card.className = 'rule-toggle-card';
    card.innerHTML = `
      <div class="rule-info">
        <strong>${ruleId}</strong>
        <span>Severity: ${ruleDef.severity || 'DEFAULT'}</span>
      </div>
      <div>
        <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
          <input type="checkbox" ${ruleDef.enabled !== false ? 'checked' : ''} data-rule="${ruleId}">
          <span style="font-size:0.8rem; font-weight:600;">Enabled</span>
        </label>
      </div>
    `;

    const checkbox = card.querySelector('input');
    checkbox.onchange = async () => {
      conf.rules[ruleId].enabled = checkbox.checked;
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conf)
      });
      showToast(`Rule ${ruleId} ${checkbox.checked ? 'enabled' : 'disabled'}.`, 'info');
      runCheck();
    };

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
      renderFindings(state.checkResult.findings);
    }
  };
});

// Setup Real-Time Server-Sent Events (SSE)
function setupSSE() {
  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('git-change', (e) => {
    els.liveWatcherBadge.style.borderColor = 'var(--accent-cyan)';
    els.liveWatcherBadge.querySelector('.live-text').textContent = 'GIT UPDATE DETECTED';
    setTimeout(() => {
      els.liveWatcherBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      els.liveWatcherBadge.querySelector('.live-text').textContent = 'WATCHING REPO';
    }, 1500);

    // Auto-trigger health check when git staging changes!
    loadStatus();
    runCheck();
  });

  evtSource.addEventListener('error', () => {
    // SSE will automatically reconnect
  });
}

// Initial Boot
window.addEventListener('DOMContentLoaded', async () => {
  els.btnRunCheck.onclick = runCheck;
  await loadStatus();
  await runCheck();
  await loadRulesConfig();
  setupSSE();
});
