# ⚓ ShipSafe: Product Requirements Document (PRD.md)

> **Document Version:** 1.0.0  
> **Status:** Approved / Active Production Candidate  
> **Target Audience:** Engineering Leads, DevOps Architects, CEO Judges, Enterprise Developers  

---

## 1. 🎯 Executive Overview & The Problem

Modern software development has a multi-billion dollar blind spot. Engineering teams invest thousands of dollars in CI/CD pipelines, ESLint, TypeScript compilation, and unit test runners. **Yet catastrophic production outages continue to happen weekly.**

Why? Because traditional CI answers only one question:  
> *"Does the code compile and match syntax conventions?"*

It **never** answers the critical questions that cause P0 outages:
1. **Will this database migration acquire an exclusive table lock and crash high-throughput queries?**
2. **Did a newly added environment variable get missed in deployment configs, crashing the server upon restart?**
3. **Does this innocent-looking `.map()` introduce an N+1 query loop that melts our Postgres pool?**
4. **What is the downstream blast radius across our 50 microservices if this shared utility changes?**

### The Core Mission
**ShipSafe** is the **automated pre-flight quality gatekeeper** that calculates blast radius, sniffs production-destroying hazards before code ships, automates developer chores, and generates risk-annotated pre-mortems.

### 🎃 Visual Product Requirements Matrix: Outage Graveyard vs Zero-Downtime Highway

![ShipSafe Product Requirements Specification — Outage Graveyard vs The 4 Guardians](../assets/prd-spec.svg)

> 💡 **Product Vision & Market Problem**:
> 1. **The 3 AM Outage Graveyard**: Traditional CI answers only *"Does it compile?"* while servers melt from exclusive table locks, missing deployment `.env` keys, and N+1 loop memory exhaustion ($-\$120,000$ loss per incident).
> 2. **The 4 Pre-Ship Guardians**: Schema Sentinel, Config Drift, Perf Sniffer, and Blast Radius DAG intercept risks locally in $<50\text{ms}$.
> 3. **The 3-Persona Enterprise ROI**: CEO/VP gets deployment insurance; Tech Lead cuts morning reviews to 15s; Developers ship with zero 3 AM emergency pages.

### 📖 The Companion Storyboard (ELI5 Edition)

![Bablu and the Spooky Code Monsters — ELI5 Storyboard](../assets/explain-like-im-5.svg)

> 💡 **Product Vision**: Every stakeholder—from a 5-year-old child to the VP of Engineering—immediately grasps why ShipSafe exists. Code looks innocent like LEGO bricks, but hides spooky runtime monsters (table locks, missing secrets, zombie loops) that trigger 3 AM pages and cost \$120,000. Bablu traps the hazards in quarantine and grants the Golden Ticket to clean code.

---

## 2. 👥 Personas & Value Proposition

### 1. The CEO & VP of Engineering
* **Pain Point:** Outages cost \$5,000 to \$15,000 per minute in lost GMV, customer churn, and reputational destruction.
* **Value:** ShipSafe acts as deployment insurance. Catching 1 incident pays for an entire year of engineering tooling.

### 2. The Senior Tech Lead
* **Pain Point:** Spending 2 hours every morning reviewing 400-line PR diffs trying to mentally trace database locks and downstream dependencies.
* **Value:** Instant Blast Radius Score (0-100%) and automated pre-mortem breakdown in every PR review comment.

### 3. The Busy Developer
* **Pain Point:** Getting pinged on Friday evening because a missing `.env` variable broke the staging deploy.
* **Value:** `shipsafe scan` catches it in 20ms locally; `shipsafe fix` automatically updates `.env.example` in 1 click.

---

## 3. 🛡️ The 4 Core Pre-Ship Health Gatekeepers

### 🎨 System Architecture Blueprint (Ian Bablu English Edition)

![ShipSafe Architectural Blueprint — Ian Bablu Style](../assets/shipsafe-architecture.svg)

> 📌 **Architectural Quality Gate**: The multi-stage checks inspect staged code, feed findings into the dual-inference pre-mortem synthesizer, and present clear visual decisions (Quarantine vs Golden Ticket) before any commit leaves the workstation.

| Gatekeeper | Threat Mitigated | Severity | Detection Mechanism | Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **1. Schema Hazard Sentinel** | Exclusive table locks, column drop race conditions, unindexed foreign keys | `CRITICAL` | Pattern-based regex and line-level scan of SQL and migration files | Suggests expand-contract patterns and non-blocking constraints |
| **2. Config Drift Sentinel** | Missing environment variables in deployment configs | `ERROR` | Cross-references `process.env.*` references with `.env.example` | Auto-syncs `.env.example` with 1 command |
| **3. Performance Hazard Sniffer** | N+1 database queries in loops, event loop blocking I/O (`readFileSync`) | `CRITICAL` | Loop state machine tracking query calls inside iterations | Suggests batching via `WHERE IN` or DataLoader |
| **4. Blast Radius Engine** | Unintended cascading breakage across downstream modules | `VARIABLE (0-100%)` | In-memory Dependency DAG (Directed Acyclic Graph) | Visual blast gauge and list of affected endpoints |

---

## 4. 🧠 Open-Weight Intelligence & Privacy Architecture

* **100% Air-Gapped & Sovereign:** Source code diffs contain trade secrets, proprietary business logic, and security configurations. Sending code diffs to third-party cloud APIs violates enterprise security compliance (SOC 2, ISO 27001).
* **Dual-Inference Engine ("Two Brains"):**
  1. **Local Open-Weight Model:** Calls Google Gemma 2 (`gemma2:2b` / `gemma2:9b`) or Qwen 2.5 via local Ollama daemon for natural language pre-mortems.
  2. **Deterministic Heuristic Fallback:** If Ollama is offline or uninstalled, ShipSafe executes rule-based deterministic synthesis in `< 5ms`. **The application never fails or crashes.**

---

## 5. 📊 Non-Functional Requirements (NFRs)

* **Zero Heavy Dependencies:** Core scanner runs on Node 22+ (Active LTS) built-ins (native TS type-stripping & `node:sqlite`) with zero bulky external npm packages.
* **Sub-50ms Execution Time:** Fast enough to run on every `git commit` without irritating developers.
* **Cross-Platform:** Runs on macOS, Linux, and Windows terminals.
* **Drop-In CI Integration:** 3 lines of YAML in `.github/workflows/` turns any repo into a ShipSafe-protected codebase.
