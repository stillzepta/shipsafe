# 🏗️ ShipSafe System Architecture (ARCHITECTURE.md)

> **Technical Architecture & Data Flow Specification for ShipSafe**  
> *Pre-Flight Blast Radius & Production Health Gatekeeper*

---

## 🎨 Visual Architecture Specification: The AST Sieve & DAG Lab

![ShipSafe Deep Architecture Specification — AST Sieve & DAG Lab](../assets/architecture-spec.svg)

> 📌 **Mandatory Architectural Maintenance Rule**: Whenever code is pushed, modified, or architectural features are updated in this repository, this hand-drawn Ian Bablu architectural illustration (`assets/architecture-spec.svg`) and the breakdown below are maintained in 100% active synchronicity.

### Deep Architectural Breakdown: 3 Sovereign Pillars
1. **Pillar 1: Syntax Tree Autopsy (AST Sieve)**
   * **Mechanism**: Operates in `<15ms` across hundreds of files with zero external runtime dependencies using native TypeScript type-stripping.
   * **Node Inspections**:
     * `ForOfStatement ➔ CallExpression`: Dissects async query calls nested within loop iterations (N+1 hazard).
     * `MemberExpression: process.env.*`: Cross-checks referenced keys against `.env.example` to halt config drift.
     * `SQL AlterTableStmt`: Flags dangerous `ADD COLUMN NOT NULL` without `DEFAULT` to prevent Postgres table locks.
2. **Pillar 2: Blast Radius Topology (AST DAG)**
   * **Mechanism**: Traverses in-memory reverse import adjacency list ($O(V + E)$) in `<5ms`.
   * **Mathematical Scoring Formula**:
     $$\text{Score} = \min\left(100, \; \left(\frac{\text{DownstreamDependents}}{\text{TotalFiles}} \times 60\right) + (\text{ChangedFiles} \times 5)\right)$$
     *Adds a $+35\%$ critical weight whenever `auth/`, `db/`, or `billing/` paths are touched.*
3. **Pillar 3: Sovereign Dual Brains (100% Air-Gapped)**
   * **Primary Brain (Local Gemma 2)**: Calls local Ollama daemon (`localhost:11434`) to synthesize natural language pre-mortems and mitigation playbooks with zero cloud API leakage.
   * **Fallback Brain (Deterministic Heuristic Engine)**: Executes in `<2ms` if Ollama is offline or uninstalled.
   * **Embedded SQLite Vault (`.shipsafe/audit.db`)**: Native `node:sqlite` stores historical runs, scores, and findings for the real-time SSE dashboard (`:4100`).

---

## 1. System Topology Overview

ShipSafe operates across three primary developer execution contexts:
1. **Local CLI (`bin/shipsafe`):** Runs locally during development and as automated git `pre-commit` and `pre-push` hooks.
2. **Interactive Local Dashboard (`server.js`):** Embedded zero-dependency HTTP server with real-time SSE updates and SQLite audit logging.
3. **CI/CD Quality Gate (`action.yml`):** GitHub Actions runner inspecting PR diffs and posting visual blast radius review comments.

```
                                  SHIPSAFE ARCHITECTURE TOPOLOGY
                                  
  ┌───────────────────────┐          ┌───────────────────────┐          ┌───────────────────────┐
  │      LOCAL CLI        │          │   INTERACTIVE WEB     │          │     GITHUB ACTION     │
  │   `shipsafe scan`     │          │    DASHBOARD :4040    │          │  (PR Review Comment)  │
  └───────────┬───────────┘          └───────────┬───────────┘          └───────────┬───────────┘
              │                                  │                                  │
              └──────────────────────────────────┼──────────────────────────────────┘
                                                 ▼
                              ┌──────────────────────────────────────┐
                              │       CORE SHIPSAFE GATE ENGINE      │
                              └──────────────────┬───────────────────┘
                                                 │
          ┌──────────────────────┬───────────────┴──────────────┬──────────────────────┐
          ▼                      ▼                              ▼                      ▼
  [SCHEMA SENTINEL]      [CONFIG DRIFT]                 [PERF SNIFFER]         [BLAST RADIUS DAG]
  • Table Lock Alarms    • process.env vs .env.example  • N+1 Query in Loops   • Reverse Import Graph
  • Direct Column Drops  • Auto-Sync Engine             • Sync I/O Blockers    • 0-100% Risk Gauge
          │                      │                              │                      │
          └──────────────────────┴───────────────┬──────────────┴──────────────────────┘
                                                 ▼
                              ┌──────────────────────────────────────┐
                              │       AI PRE-MORTEM SYNTHESIZER      │
                              │  • Primary: Local Gemma 2 (Ollama)   │
                              │  • Fallback: Deterministic Heuristic │
                              └──────────────────┬───────────────────┘
                                                 │
                                                 ▼
                              ┌──────────────────────────────────────┐
                              │           OUTPUT ADAPTERS            │
                              │ • Rich ANSI Terminal Cards           │
                              │ • GitHub PR Markdown Comment         │
                              │ • SQLite Audit Ledger (`runs.db`)    │
                              └──────────────────────────────────────┘
```

---

## 2. Blast Radius Graph Engine (AST DAG)

The Blast Radius Engine builds an in-memory directed dependency graph across all tracked repository files:

```
  Modified File: [src/auth/jwt.ts] (Touches Critical Keyword "auth")
           │
           ├────────────────────────────┐
           ▼                            ▼
  [src/routes/login.ts]        [src/routes/api.ts]
           │                            │
           └──────────────┬─────────────┘
                          ▼
                   [src/app.ts]
                          ▼
                   [server.js]
```

### Mathematical Scoring Function:
$$\text{RawScore} = \min\left(100, \; \left(\frac{\text{DownstreamDependents}}{\text{TotalFiles}} \times 60\right) + (\text{ChangedFiles} \times 5)\right)$$
If $\text{CriticalPathTouched} = \text{true}$ (e.g. `auth/`, `billing/`, `db/`), a **+35% Critical Infrastructure Weight** is added.

---

## 3. Data Flow & Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / GitHub PR
    participant CLI as ShipSafe Engine
    participant Gate as 4 Health Gatekeepers
    participant Blast as Blast Radius DAG
    participant AI as Local Gemma 2 / Fallback
    participant Out as Output Adapter

    Dev->>CLI: Trigger `shipsafe scan`
    CLI->>Gate: Evaluate diff (Schema, Env, Perf, Secrets)
    Gate-->>CLI: Return array of categorized Findings
    CLI->>Blast: Traverse import dependency tree
    Blast-->>CLI: Return Blast Radius Report (0-100%)
    CLI->>AI: Request Pre-Mortem synthesis
    alt Ollama running locally
        AI->>AI: Local Gemma 2 generates natural language pre-mortem
    else Ollama offline
        AI->>AI: Deterministic heuristic synthesizer executes in <2ms
    end
    AI-->>CLI: Return Pre-Mortem & Release Notes
    CLI->>Out: Render Terminal Dashboard / PR Comment
```
