# Composition Patterns — Ian Xiaohei Illustrations

## Established Architectural Patterns

### 1. The Quality Gate / Sentry Checkpoint (Inspection & Divert)
- **Best For**: Pre-commit hooks, CI/CD quality gates, security scanners, linters.
- **Visual Setup**:
  - Left side: Incoming stream of raw code blocks, packages, and commits moving along a conveyor belt or pipeline.
  - Center: An automated inspection gate or toll booth operated by Xiaohei with high-precision optical scanners and stampers.
  - Divert Path (Red): Bad code (with exposed API keys or debuggers) rejected into an auto-remediation quarantine bin labeled with red callouts (`REJECTED`, `FIXING`).
  - Approved Path (Blue/Green): Clean, verified code stamped with a green seal proceeding cleanly to GitHub/Production.

### 2. The Multi-Layer Filter Funnel (Centrifuge / Sieve)
- **Best For**: Multi-stage rule engines (Secrets -> Hygiene -> Git Rules -> Syntax -> Dependencies).
- **Visual Setup**: A vertical or diagonal sequence of specialized sieve layers. Xiaohei stands atop or beside the apparatus with a clipboard, monitoring each stage's efficiency gauge.

### 3. Before vs After Split
- **Best For**: Demonstrating the problem vs solution.
- **Visual Setup**: Left half shows chaotic, frantic firefighting in production with sirens and broken CI; right half shows serene, automated local pre-flight checks catching bugs in 50ms before push.

### 4. The Cockpit / Radar Dashboard
- **Best For**: Real-time monitoring, score gauges, Server-Sent Events (SSE).
- **Visual Setup**: Xiaohei wearing a technician headset, sitting in front of a giant minimalist circular health radar gauge showing a 100% score dial and status switches.
