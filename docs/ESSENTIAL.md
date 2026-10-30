# ⚡ ShipSafe: The Essential Runbook & Cheatsheet (ESSENTIAL.md)

Quick-reference operational runbook, command cheatsheet, port map, test verification, and troubleshooting guide for **ShipSafe**.

---

## 1. 🚀 Quickstart Commands

### 1.1 Local Scan & Health Check
```bash
# Scan staged changes (default)
node bin/shipsafe scan

# Scan entire repository
node bin/shipsafe scan --all

# Auto-fix chores (sync .env.example, strip debuggers)
node bin/shipsafe fix

# Atomic risk-annotated commit
node bin/shipsafe commit "feat: add stripe checkout webhook"
```

### 1.2 Interactive Local Dashboard
```bash
# Launch interactive web portal on http://localhost:4040
node bin/shipsafe serve
```

### 1.3 Automated Git Hooks
```bash
# Install automated pre-commit and pre-push hooks
node bin/shipsafe install-hooks

# Uninstall hooks
node bin/shipsafe uninstall-hooks
```

---

## 2. 🧪 Test Suite & Empirical Benchmark

```bash
# Run 17 automated unit tests
npm test

# Run the 10-scenario empirical outage benchmark
npm run benchmark
```

---

## 3. 🔌 Network & Port Topology

| Port / Address | Service | Protocol | Function |
| :--- | :--- | :--- | :--- |
| `localhost:4040` | ShipSafe Web Portal | HTTP/1.1 | Live interactive dashboard, rule manager & audit history |
| `localhost:11434` | Local Ollama Engine | HTTP / JSON | Hosts local open models (`gemma2:2b`, `qwen2.5:3b`) |

> **Offline Fallback Guarantee:** If Ollama daemon is offline, ShipSafe automatically executes its deterministic heuristic synthesizer with zero latency impact.

---

## 4. 🛠️ Troubleshooting Runbook

### Issue A: Port `4040` already in use
```bash
# Launch server on an alternative port
node bin/shipsafe serve --port=5050
```

### Issue B: Git hook blocking commit due to intentional demo trap
```bash
# Bypass git hook when creating test fixtures
git commit --no-verify -m "test commit"
```
