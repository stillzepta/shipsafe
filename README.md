# 🛡️ ShipSafe // 2026

> **The Autonomous Pre-Flight Blast Radius Sentinel & Zero-Downtime Quality Gatekeeper**  
> *Built for [Devf8rge Finals (Halloween Hack BLR)](https://dev.to/events/challenges/hf26) • Newton School of Technology × Major League Hacking (MLH) × Hacktoberfest 2026*  
> *Powered by Google's Gemma 2 Open-Weight Models & In-Memory Dependency Graph Analysis*

[![ShipSafe CI](https://github.com/stillzepta/shipsafe/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/stillzepta/shipsafe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg?style=flat-square)](LICENSE)
[![Tests: 18/18 Passed](https://img.shields.io/badge/Tests-18%2F18_Passed-success.svg?style=flat-square)](tests/)
[![Benchmark: 10/10 Caught](https://img.shields.io/badge/Benchmark-10%2F10_Caught_(100%25)-brightgreen.svg?style=flat-square)](benchmarks/BENCHMARK_RESULTS.md)
[![Traditional CI Detection](https://img.shields.io/badge/Traditional_CI_Detection-0%2F10_(0%25)-red.svg?style=flat-square)](benchmarks/BENCHMARK_RESULTS.md)
[![Privacy: 100% Air-Gapped](https://img.shields.io/badge/Privacy-100%25_Air--Gapped_Sovereign-blue.svg?style=flat-square)](#-why-open-innovation-matters-100-air-gapped-sovereignty)
[![Dependencies: Zero](https://img.shields.io/badge/Dependencies-Zero_External-blueviolet.svg?style=flat-square)](#-zero-dependency-core)
[![Runtime: Node.js 22+ (LTS)](https://img.shields.io/badge/Runtime-Node.js_22+_(LTS)-green.svg?style=flat-square)](https://nodejs.org/)
[![Model: Gemma 2](https://img.shields.io/badge/Open--Weight-Gemma_2-4285F4.svg?style=flat-square)](https://ai.google.dev/gemma)
[![Execution: Sub-35ms](https://img.shields.io/badge/Speed-%3C35ms_Execution-orange.svg?style=flat-square)](#-the-3-command-developer-quickstart)

---

## 🎨 System Architecture Illustration (Ian Xiaohei English Edition)

![ShipSafe Architectural Blueprint — Ian Xiaohei Style](assets/shipsafe-architecture.svg)

> 📌 **Mandatory Architectural Maintenance Rule**: Whenever code is pushed, modified, or architectural features are updated in this repository, this hand-drawn Ian Xiaohei architectural illustration (`assets/shipsafe-architecture.svg`) and the breakdown below are maintained in 100% active synchronicity.

### 🗺️ Visual Walkthrough: How ShipSafe Protects Your Production Pipeline

The architectural blueprint above details the end-to-end journey of code moving from a developer's workstation to production:

1. **Local Staging Buffer (Left)**
   * When a developer stages code (`git add .`), ShipSafe intercepts the local Git staging buffer before commit objects are written to the `.git` tree.
   * Potential disasters—such as missing `.env.production` keys, live Stripe secrets (`sk_live_...`), unindexed foreign keys, dangerous table-locking migrations, or stray `debugger;` breakpoints—are caught locally within **35 milliseconds**.

2. **The Pre-Flight Gatehouse & Radar (Center)**
   * Supervised by **Xiaohei** (the diligent guardian equipped with optical inspection tools and an engineering headset), the pre-flight engine runs the code diff through **5 multi-stage quality gates**:
     * 🛡️ **Gate 1: Secrets & Credentials**: High-entropy regex scanner detecting AWS, Stripe, GitHub PATs, JWTs, and database URIs with zero-false-positive filtering for test mocks.
     * 🧹 **Gate 2: Code Hygiene**: Sniffs out `debugger;`, stray `console.log()` dumps, `@ts-ignore` bypasses, and `TODO [BLOCKER]` markers.
     * 🌿 **Gate 3: Git Guard & Policy**: Enforces protected branch immutability (`main`, `master`), blocks files exceeding 1MB, and halts `.env` leaks.
     * 🔍 **Gate 4: Syntax & ESM Integrity**: Real-time non-executing AST compilation (`node --check`, `JSON.parse`, YAML tab prohibition).
     * 📦 **Gate 5: Dependency Auditor**: Enforces `package.json` and lockfile synchronization (`package-lock.json`, `pnpm-lock.yaml`) and flags wildcard versioning.
   * **Real-Time Stream**: The background daemon continuously broadcasts Git staging state changes via Server-Sent Events (SSE) to the interactive dashboard on [`http://localhost:4100`](http://localhost:4100).
   * **Embedded Persistence**: Every scan run, risk score, and execution duration is recorded locally into `.shipsafe/audit.db` using Node's native synchronous SQLite engine (`node:sqlite`).

3. **The Divert & Auto-Fix Quarantine (Top Right — Red & Orange Accents)**
   * When critical hazards (e.g. exclusive table locks or N+1 query loops) are detected, ShipSafe **immediately blocks the Git operation with Exit Code 1**.
   * Hazardous files are quarantined from GitHub.
   * Developers run `npm run fix` (or click **"⚡ Auto-Fix"** in the UI) to automatically unstage sensitive files, remove `debugger;` statements, and sync missing variables to `.env.example`.

4. **The Verified Release Stream (Bottom Right — Blue & Green Accents)**
   * Commits scoring 85–100 with zero critical errors receive **Exit Code 0** approval.
   * The clean code safely proceeds to GitHub and production CI/CD pipelines, guaranteeing zero preventable deployment failures.

---

## 💡 The First-Principles Problem: The Multi-Billion Dollar Blind Spot

Software engineering teams spend thousands of dollars on CI/CD pipelines, ESLint rules, and unit test suites. **Yet catastrophic production outages continue to happen every single week.**

Consider the real post-mortem of a typical Friday night deployment:
1. **The Syntactic Illusion:** A developer alters an active database table, introducing `ALTER TABLE users ADD COLUMN billing_tier VARCHAR(32) NOT NULL;`.
2. **The False Green Checkmark:** ESLint passes with 0 warnings. TypeScript compiles with 0 errors. Jest unit tests pass in 1.4 seconds. GitHub Actions shows a glowing green checkmark ✅.
3. **The Production Crash:** When deployed to production, PostgreSQL acquires an **exclusive `ACCESS EXCLUSIVE` table lock** across 10 million rows. All incoming HTTP requests queue up. Database connection pools exhaust in 45 seconds. The entire application crashes, costing **$120,000 in dropped transactions**.

Traditional CI answers only: *"Does the code compile and match style rules?"*  
**It is structurally blind to runtime blast radius, database locks, and configuration drift.**

```
                     TRADITIONAL CI vs. SHIPSAFE QUALITY GATE
                     
  [ DEVELOPER DIFF ] ──► [ ESLINT / JEST ] ──► PASSES ✅ ──► [ PROD OUTAGE 💥 ]
                            (Syntax Only)                         (Table Lock / N+1)
  
  [ DEVELOPER DIFF ] ──► [ SHIPSAFE GATE ] ──► BLOCKED 🛑 ──► [ AUTO-REMEDIATION ⚡ ]
                            • Table Lock Check                    • Non-blocking SQL suggested
                            • Env Drift Check                     • .env.example auto-synced
                            • N+1 Loop Sniffer                    • Where-in batching advised
                            • Blast Radius DAG                    • 0-100% Risk Score calculated
```

---

## 🔬 Empirical Benchmark: Traditional CI vs. ShipSafe

We evaluated **ShipSafe** against **10 historical production outage traps** derived from published post-mortems (GitLab table lock, Shopify N+1 loop, Stripe configuration leak, and event loop thread starvation).

### Scientific Outage Matrix

| # | Outage Scenario | Category | Real-World Failure Mode | Traditional CI (ESLint/Jest) | ShipSafe Gatekeeper | Detection Latency |
| :-: | :--- | :--- | :--- | :-: | :-: | :-: |
| **01** | `ALTER TABLE ... ADD NOT NULL` without `DEFAULT` | Database Migration | 42-min Postgres exclusive table lock | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`schema/not-null-no-default`) | 1.2ms |
| **02** | `process.env.STRIPE_SECRET_KEY` missing from `.env.example` | Config / Env Drift | Silent 500 error on checkout deploy | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`env/missing-in-example`) | 0.8ms |
| **03** | N+1 database queries inside `.forEach()` order loop | Performance Regression | 100% CPU spike under concurrency | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`perf/n-plus-one-loop`) | 1.1ms |
| **04** | `fs.readFileSync` inside high-throughput route | Event Loop Freeze | Blocked concurrent users, 3.2s p99 latency | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`perf/sync-io-in-server`) | 0.6ms |
| **05** | Direct `DROP COLUMN` during rolling deploy | Schema Compatibility | In-flight rolling pod crashes | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`schema/drop-column-hazard`) | 0.9ms |
| **06** | Unindexed Foreign Key constraint | Database Performance | Sequential scan table locks on deletes | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`schema/unindexed-foreign-key`) | 0.7ms |
| **07** | `SELECT * FROM audit_logs` without `LIMIT` | Memory Exhaustion | Out-Of-Memory (OOM) pod kill | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`perf/unbounded-query`) | 0.5ms |
| **08** | Hardcoded secret token in auth mock | Security Leak | Leaked production credentials | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`security/hardcoded-secret`) | 0.4ms |
| **09** | Missing OAuth redirect URL in environment | Config Drift | User authentication failure loop | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`env/missing-in-example`) | 0.8ms |
| **10** | Core Auth alteration with high blast radius | Blast Radius Cascade | Downstream breakage across 14 routes | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`blast-radius (40%)`) | 2.1ms |

> **Evaluation Summary**:  
> Traditional CI / Linter Detection Rate: **0 / 10 (0% caught)**  
> ShipSafe Pre-Flight Gatekeeper: **10 / 10 (100% caught)** with automated remediation advisories.  
> *Read the full scientific report in [`benchmarks/BENCHMARK_RESULTS.md`](benchmarks/BENCHMARK_RESULTS.md).*

---

## 🛡️ The 4 Core Pre-Ship Health Gatekeepers

### 1. 🗄️ Database Schema Hazard Sentinel (`src/core/schema.ts`)
* **Table Lock Defense:** Detects `ALTER TABLE ... ADD COLUMN ... NOT NULL` without `DEFAULT` values. Recommends the non-blocking expand-contract migration pattern.
* **Rolling Deployment Defense:** Flags destructive column drops and renames that cause 500 errors on older application pods during zero-downtime rolling releases.
* **Unindexed Foreign Keys:** Catches missing foreign key indexes that cause cascading sequential table scans.

### 2. 🌐 Config & Environment Drift Sentinel (`src/core/env.ts`)
* Scans all code changes for newly introduced `process.env.VAR` or `import.meta.env.VAR` references.
* Cross-references against `.env.example`, `.env.sample`, and deployment configuration templates.
* Flags missing variables and powers **1-click automated synchronization** (`shipsafe fix`).

### 3. ⚡ Performance & N+1 Query Sniffer (`src/core/perf.ts`)
* State-machine analyzer that tracks database queries (`db.query`, `prisma.find`, `knex`) or network requests (`fetch`, `axios`) nested inside `.map()`, `for...of`, `forEach`, or `while` loops.
* Identifies synchronous I/O operations (`fs.readFileSync`, `execSync`) in server execution paths that freeze the single-threaded Node.js event loop.
* Flags unbounded `SELECT *` statements missing explicit `LIMIT` or pagination constraints.

### 4. 💥 Downstream Blast Radius DAG Engine (`src/core/blast.ts`)
* Constructs an in-memory reverse dependency Directed Acyclic Graph (DAG) across the entire codebase.
* Calculates a mathematical **0–100% Blast Radius Score**:
  $$\text{BlastScore} = \min\left(100, \; \left(\frac{\text{DownstreamDependents}}{\text{TotalFiles}} \times 60\right) + (\text{ChangedFiles} \times 5)\right)$$
* Applies a **+35% Critical Infrastructure Multiplier** whenever security-sensitive paths (`auth/`, `billing/`, `db/`) are modified.

---

## 🧠 Why Open Innovation Matters: 100% Air-Gapped Sovereignty

Most commercial "AI PR Reviewers" upload proprietary source code diffs to closed cloud APIs (OpenAI, Anthropic). For enterprises, financial institutions, and healthcare providers, this routinely violates **SOC 2, ISO 27001, and client NDAs**.

**ShipSafe is built on the "Two Brains" sovereign architecture:**
1. **Primary Brain (Local Open-Weight Model):** Interacts directly with Google's **Gemma 2** (`gemma2:2b` / `gemma2:9b`) or **Qwen 2.5** via a local Ollama daemon (`http://127.0.0.1:11434`). It generates natural-language failure scenarios and risk-annotated release notes locally on your CPU/GPU.
2. **Deterministic Fallback Brain:** If Ollama is offline or uninstalled, ShipSafe automatically executes its rule-based heuristic synthesizer in **< 2 milliseconds**. 

> **Zero Cloud Dependency:** ShipSafe costs **$0.00 in API token fees**, leaks **0 bytes of source code**, and runs at **100% speed with the Wi-Fi completely turned off**.

---

## 🚀 The 3-Command Developer Quickstart

ShipSafe runs natively on standard Node 22+ (Active LTS) with **zero external npm dependencies** (leveraging native TypeScript type-stripping and embedded `node:sqlite`):

```bash
# 1. Run local pre-flight scan on staged changes
npm run scan
# or: node bin/shipsafe scan

# 2. Automatically fix developer chores (.env.example sync, strip debuggers)
npm run fix
# or: node bin/shipsafe fix

# 3. Launch interactive local web dashboard
npm start
# or: node bin/shipsafe serve --port=4100
```

### Additional Developer Commands
```bash
# Scan all tracked repository files
npm run check:all

# Commit with automated risk & blast radius annotation
npm run commit -- "feat: add stripe checkout webhook"

# Run the 10-scenario empirical outage benchmark
npm run benchmark

# Install automated git pre-commit and pre-push hooks
npm run install-hooks

# Run automated unit test suite
npm test
```

---

## 🖥️ Interactive Web Dashboard & Real-Time Radar

Launch the local interactive UI by running `npm start` and navigating to **[`http://localhost:4100`](http://localhost:4100)**:

* **SVG Code Health Radar:** Circular animated gauge calculating readiness scores (0–100) with sub-50ms feedback.
* **Dynamic Blast Radius Meter:** Live visual bar displaying the downstream impact percentage and listing affected endpoints.
* **AI Pre-Mortem Sentinel:** Live streaming risk assessment powered by Gemma 2 / Heuristic fallback.
* **10/10 Outage Benchmark Showcase:** Interactive tab allowing judges to execute the 10 real-world outage traps with 1-click verification.
* **Unified Diff Inspector & 1-Click Auto-Fix:** Visual diff viewer with 1-click repairs for debuggers, tabs, and missing configs.

---

## 🤖 Turnkey GitHub Action Integration

Drop this 5-line workflow into `.github/workflows/shipsafe.yml` to automatically protect every Pull Request:

```yaml
name: ShipSafe Quality Gate
on: [pull_request]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node bin/shipsafe scan
```

When a PR is opened, ShipSafe posts an automated review comment displaying the **Blast Radius Gauge**, **Identified Health Hazards**, and **Operational Release Notes**.

---

## 📚 Technical Documentation Suite

ShipSafe adheres to the highest documentation standards:
* 📄 **[Product Requirements Document (PRD.md)](docs/PRD.md)** — First-principles problem breakdown, persona ROI analysis, and threat model.
* 🏗️ **[System Architecture (ARCHITECTURE.md)](docs/ARCHITECTURE.md)** — AST parsing pipelines, in-memory dependency DAG topology, and sequence flows.
* ⚡ **[Operational Runbook & Cheatsheet (ESSENTIAL.md)](docs/ESSENTIAL.md)** — Port maps, CLI commands, git hook operations, and troubleshooting.
* 📊 **[Empirical Benchmark Report (BENCHMARK_RESULTS.md)](benchmarks/BENCHMARK_RESULTS.md)** — Scientific evaluation against 10 historical outages.

---

## 🧪 Verification & Test Suite

Run the comprehensive unit test suite:

```bash
node --test tests/*.test.ts test/*.test.js
```

```text
▶ ShipSafe Health Rules Engine
  ✔ Secret Scanner detects leaked credentials (0.9ms)
  ✔ Hygiene Scanner flags debugger and blocker comments (0.4ms)
  ✔ Syntax Scanner flags malformed JSON (0.1ms)
  ✔ Git Guard flags .env files and protected branch violations (0.2ms)
  ✔ Dependency Inspector catches unpinned wildcards (0.1ms)
  ✔ Auto-Fixer strips debugger statements safely (0.5ms)
  ✔ SQLite DB successfully records runs and aggregates metrics (1.4ms)
✔ Blast Radius Engine calculates high risk when critical paths are touched (0.5ms)
✔ Env Sentinel flags new env vars missing from .env.example (0.4ms)
✔ Performance Sniffer flags database queries inside loops (N+1 hazard) (1.2ms)
✔ ShipSafe Repository Structure adheres 100% to the Gold-Standard layout (0.4ms)
✔ Schema Detector flags NOT NULL column without DEFAULT (0.4ms)
✔ Schema Detector flags dangerous direct column drop (0.1ms)
ℹ tests 18
ℹ pass 18
ℹ fail 0
ℹ duration_ms 66ms
```

---

## 👥 Authors & Team TRioN

Built with pride for **Devf8rge Finals (Halloween Hack BLR)** by **Team TRioN**:
* **Arnav Patel ([@XiaoArnav](https://github.com/XiaoArnav))** — Project Lead & Frontend Architecture
* **Krishna Verma ([@stillzepta](https://github.com/stillzepta))** — Backend & AI Systems Engineering

---

## 🛡️ License

MIT License. Designed and crafted for high-velocity software engineering teams.
