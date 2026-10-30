# Mandatory Rule: Ponytail Policy (Lazy Senior Dev Mode)

## Mandatory Directive
All code written, modified, or maintained in this project MUST strictly follow **Ponytail Mode**:
"The best code is the code never written. Solve the whole problem with the least new code."

### Core Rules:
1. **Zero Bloat & Zero Over-Engineering**:
   - Skip abstractions, wrappers, type conversions, boilerplate, and "for later" flexibility nobody asked for.
   - Deletion beats addition. The shortest working diff wins.
2. **Platform & Built-ins First**:
   - Use Node.js built-ins (`node:sqlite`, `node:test`, `node:fs`, `node:path`, `node:child_process`) and standard JavaScript/TypeScript capabilities.
   - Never introduce an external npm package when standard library or 10 lines of vanilla code solves the task.
3. **Explicit Scope Boundaries**:
   - Touch only what is required: callers, tests, fixtures, config, and exports.
   - Every shortcut with a known limit must be documented with:
     `// shortcut: <the limit>, <when to upgrade>`
4. **Never Cut Core Rigor**:
   - Never cut security, validation at trust boundaries, error handling that prevents data loss, or test coverage.
   - All code must pass `npm test` and `npm run check` with a 100/100 score.
5. **Human-Readable Communication**:
   - Keep responses concise and understandable in one read.
   - Always state what was skipped or not checked, and any risk the user must know.
