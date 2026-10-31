# ⚡ ShipSafe: The Essential Runbook & Cheatsheet (ESSENTIAL.md)

Quick-reference operational runbook, command cheatsheet, port map, test verification, and troubleshooting guide for **ShipSafe**.

---

## 🎨 Visual Operator's Runbook (Ian Bablu English Edition)

![ShipSafe Operational Runbook & Magic Terminal](../assets/essential-spec.svg)

### Operational Command & Terminal Mapping:
| Runbook Spell | Execution Command | Operational Action & Latency |
| :--- | :--- | :--- |
| **1. The Scrying Orb** | `node bin/shipsafe scan [--all]` | Inspects staged changes in `<35ms`; renders Pre-Flight Radar gauge ($100/100$) and ANSI findings. |
| **2. The Auto-Exorcist** | `node bin/shipsafe fix` | Autonomously synchronizes `.env.example` and removes stray `debugger;` statements. |
| **3. The Golden Seal** | `node bin/shipsafe commit "..."` | Atomic certified commit; verifies zero hazards exist before git tree write. |
| **4. The Crystal Portal** | `node bin/shipsafe serve` | Launches local dashboard on `http://127.0.0.1:4100` with live SSE and native SQLite ledger. |

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
# Launch interactive web portal on http://127.0.0.1:4100
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
# Run 29 automated unit tests
npm test

# Run the 10-scenario empirical outage benchmark
npm run benchmark
```

---

## 3. 🔌 Network & Port Topology

| Port / Address | Service | Protocol | Function |
| :--- | :--- | :--- | :--- |
| `localhost:4100` | ShipSafe Web Portal | HTTP/1.1 | Live interactive dashboard, rule manager & audit history (SSE) |
| `localhost:11434` | Local Ollama Engine | HTTP / JSON | Hosts local open models (`gemma2:2b`, `qwen2.5:3b`) |

> **Offline Fallback Guarantee:** If Ollama daemon is offline, ShipSafe automatically executes its deterministic heuristic synthesizer with zero latency impact.

---

## 4. 🛠️ Troubleshooting Runbook

### Issue A: Port `4100` already in use
```bash
# Launch server on an alternative port
node bin/shipsafe serve --port=5050
```

### Issue B: Git hook blocking commit due to intentional demo trap
```bash
# Bypass git hook when creating test fixtures
git commit --no-verify -m "test commit"
```

---

## 5. 🎃 Team Onboarding & ELI5 Storyboard Reference

![Bablu and the Spooky Code Monsters — ELI5 Storyboard](../assets/explain-like-im-5.svg)

> 💡 **Quick Onboarding Rule**: New engineers joining the repository should review the 4-act storyboard above to understand our zero-outage deployment philosophy and how Bablu guards production.
