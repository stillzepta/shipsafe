# Agent Guidelines & Mandatory Policies for ShipSafe

## 1. Mandatory Ian Bablu Illustration Maintenance
Whenever pushing new code, refactoring features, or modifying repository architecture, you **must** update the Ian Bablu architectural illustration (`assets/shipsafe-architecture.svg`) and the corresponding explanatory breakdown in `README.md`.
The illustration must precisely reflect:
- Incoming developer commits and staged files
- ShipSafe pre-flight quality gatekeeper with Bablu actively inspecting code
- The multi-stage checks (Secrets, Hygiene, Git Guard, Syntax, Dependencies)
- Auto-remediation quarantine path for rejected items (red) vs verified clean code path to GitHub/Production (blue)
- The embedded SQLite audit log and real-time dashboard

Refer to the skill: `.agents/skills/ian-xiaohei-illustrations-en/SKILL.md`.

## 2. Code Quality & Pre-Flight Standards
All code must pass `npm test` and `npm run check` with a 100/100 score before committing.
No debuggers, no unpinned wildcards, no exposed secrets, and no untested code.

## 3. Mandatory Ponytail Policy (Lazy Senior Dev Mode)
All agents working on this repository must strictly operate in **Ponytail Mode**:
- The best code is the code never written. Solve the whole problem with the least new code.
- Zero extra dependencies, zero unnecessary wrappers, zero bloated boilerplate.
- Leverage Node.js platform built-ins (`node:sqlite`, `node:test`, native ESM/TS) before adding any dependencies.
- Mark shortcuts with `// shortcut: <the limit>, <when to upgrade>`.
- Keep replies concise, single-read, and report what was skipped or unverified.
