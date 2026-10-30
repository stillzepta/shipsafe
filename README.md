# 🛡️ ShipSafe — Autonomous Pre-Flight Blast Radius & Production Health Gatekeeper

> **Catch database table locks, environment config drifts, N+1 query loops, and high blast-radius hazards on your local machine *before* they ever reach GitHub or break production.**

[![Tests: 17/17 Passed](https://img.shields.io/badge/Tests-17%2F17_Passed-success.svg?style=flat-square)](tests/)
[![Benchmark: 10/10 Caught](https://img.shields.io/badge/Benchmark-10%2F10_Caught_(100%25)-brightgreen.svg?style=flat-square)](benchmarks/BENCHMARK_RESULTS.md)
[![Dependencies: Zero](https://img.shields.io/badge/Dependencies-Zero_External-blueviolet.svg?style=flat-square)](#-zero-dependency-architecture)
[![Runtime: Node.js 20+](https://img.shields.io/badge/Runtime-Node.js_20+-green.svg?style=flat-square)](https://nodejs.org/)
[![AI: Local Gemma 2 / Offline](https://img.shields.io/badge/AI-Gemma_2_%2B_Offline_Fallback-blue.svg?style=flat-square)](src/ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg?style=flat-square)](LICENSE)
[![Devf8rge 2026](https://img.shields.io/badge/Hacktoberfest-Devf8rge_Finals_BLR-FF7518.svg?style=flat-square)](https://dev.to/events/challenges/hf26)

---

## 🎨 System Architecture Illustration (Ian Xiaohei English Edition)

![ShipSafe Architectural Blueprint — Ian Xiaohei Style](assets/shipsafe-architecture.svg)

> 📌 **System Synchronicity**: Operated by **Xiaohei** (the diligent guardian with optical inspection tools and engineer headset), the pre-flight engine evaluates staged files against multi-stage quality gates in under **50ms**.

---

## 📚 Technical Documentation Suite

ShipSafe adheres to the highest open-source engineering standards:
* 📄 **[Product Requirements Document (PRD.md)](docs/PRD.md)** — First-principles problem breakdown, persona ROI analysis, and threat model.
* 🏗️ **[System Architecture (ARCHITECTURE.md)](docs/ARCHITECTURE.md)** — AST parsing pipelines, in-memory dependency DAG topology, and sequence flows.
* ⚡ **[Operational Runbook & Cheatsheet (ESSENTIAL.md)](docs/ESSENTIAL.md)** — Port maps, CLI commands, git hook operations, and troubleshooting.
* 📊 **[Empirical Benchmark Report (BENCHMARK_RESULTS.md)](benchmarks/BENCHMARK_RESULTS.md)** — Scientific evaluation against 10 historical outages.

---

## 🔬 Empirical Benchmark: Traditional CI vs. ShipSafe

Traditional CI pipelines (ESLint, Jest, Prettier) check formatting and syntax, but are **structurally blind to production hazards**. In our scientific evaluation against 10 real-world outage scenarios:

| ID | Outage Scenario | Real-World Failure Mode | Traditional CI (ESLint/Jest) | ShipSafe Gatekeeper |
| :-: | :--- | :--- | :-: | :-: |
| **01** | `ALTER TABLE ... ADD NOT NULL` without `DEFAULT` | 42-min Postgres exclusive table lock | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`schema/not-null-no-default`) |
| **02** | `process.env.STRIPE_SECRET_KEY` missing from `.env.example` | Checkout 500 error on deployment | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`env/missing-in-example`) |
| **03** | N+1 database queries inside order loop | CPU spike to 100% under concurrency | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`perf/n-plus-one-loop`) |
| **04** | `fs.readFileSync` inside server route | Event loop freeze, 3.2s p99 latency | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`perf/sync-io-in-server`) |
| **05** | Direct `DROP COLUMN` during rolling deploy | In-flight rolling pod crashes | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`schema/drop-column-hazard`) |
| **06** | Unindexed Foreign Key constraint | Full table lock during cascade delete | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`schema/unindexed-foreign-key`) |
| **07** | `SELECT * FROM audit_logs` without `LIMIT` | Out-Of-Memory (OOM) pod kill | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`perf/unbounded-query`) |
| **08** | Hardcoded secret token in code | Leaked corporate credentials | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`security/hardcoded-secret`) |
| **09** | Missing OAuth redirect URL in environment | User login failure loop | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`env/missing-in-example`) |
| **10** | Core Auth modification with high blast radius | Cascade breaking 14 routes | `PASSED (Missed Bug)` ❌ | **✅ CAUGHT** (`blast-radius (40%)`) |

**Detection Rate: Traditional CI: 0/10 (0%) | ShipSafe: 10/10 (100%)**

---

## 🛡️ The 4 Core Pre-Ship Health Gatekeepers

### 1. 🗄️ Database Schema Hazard Sentinel (`src/core/schema.ts`)
* **Table Lock Hazards**: Flags `ALTER TABLE ... ADD COLUMN ... NOT NULL` without `DEFAULT` to prevent catastrophic table locks on millions of rows.
* **Rolling Deployment Hazards**: Flags direct `DROP COLUMN` and column renames that break in-flight application pods during zero-downtime deploys.
* **Missing Foreign Key Indexes**: Catches unindexed foreign keys before they trigger sequential table scans.

### 2. 🌐 Config & Environment Drift Sentinel (`src/core/env.ts`)
* Scans all code for newly introduced `process.env.VAR` or `import.meta.env.VAR`.
* Cross-references against `.env.example`.
* Flags missing deployment configurations and **auto-syncs `.env.example`** with 1 command (`shipsafe fix`).

### 3. ⚡ Performance & N+1 Query Sniffer (`src/core/perf.ts`)
* Detects database queries and network fetches nested inside `.map()`, `for...of`, and `forEach` loops.
* Catches synchronous blocking I/O (`fs.readFileSync`, `execSync`) in server execution paths that freeze the Node.js event loop.
* Flags unbounded `SELECT *` queries missing `LIMIT` boundaries.

### 4. 💥 Blast Radius Engine (`src/core/blast.ts`)
* Constructs an in-memory reverse dependency DAG (Directed Acyclic Graph) of the entire codebase.
* Calculates a **0–100% Blast Radius Score** based on downstream import cascades.
* Adds a **+35% Critical Infrastructure Weight** when security-sensitive paths (`auth/`, `billing/`, `db/`) are touched.

---

## 🧠 Local Open-Weight AI Intelligence (`src/ai/`)

* **Dual-Inference Engine ("Two Brains"):**
  * **Primary Brain:** Calls open-weight **Gemma 2** (`gemma2:2b` / `gemma2:9b`) or **Qwen 2.5** via local Ollama for natural language pre-mortem analysis and operational release notes.
  * **Deterministic Fallback:** If Ollama is offline or uninstalled, ShipSafe automatically executes its rule-based heuristic synthesizer in `< 2ms`.
* **Zero-Leak Guarantee:** 100% of code parsing and AI inference runs locally on your machine. Zero bytes leave your laptop.

---

## 🚀 Quickstart Guide

ShipSafe runs natively on standard Node 20+ with **zero external dependencies**:

```bash
# 1. Run local pre-flight scan on staged changes
npm run scan
# or: node bin/shipsafe scan

# 2. Automatically fix developer chores (.env.example sync, strip debuggers)
npm run fix
# or: node bin/shipsafe fix

# 3. Commit with automated risk & blast radius tags
npm run commit -- "feat: add stripe checkout webhook"

# 4. Run the 10-outage empirical benchmark
npm run benchmark

# 5. Launch interactive web dashboard (:4040)
npm run serve

# 6. Run automated test suite
npm test
```

---

## 🤖 Turnkey GitHub Action Integration

Drop this 5-line workflow into `.github/workflows/shipsafe.yml` to protect every Pull Request:

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

---

## 🧪 Verification & Test Suite

Run the comprehensive unit test suite:

```bash
node --test tests/*.test.ts test/*.test.js
```

All 17 tests execute in **< 75ms** with zero flaky external dependencies.

---

## 👥 Authors & Team TRioN

Built with pride for **Devf8rge Finals (Halloween Hack BLR)** by **Team TRioN**:
* **Arnav Patel (`XiaoArnav`)** — Project Lead & Frontend Architecture
* **Krishna Verma (`stillzepta`)** — Backend & AI Systems Engineering

---

## 🛡️ License

MIT License. Crafted for zero-downtime, high-velocity engineering teams.
