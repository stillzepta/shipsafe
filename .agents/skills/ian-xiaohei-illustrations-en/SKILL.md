---
name: ian-xiaohei-illustrations-en
description: Generates Ian-style quirky, hand-drawn English technical and editorial illustrations. Used when users request 16:9 landscape white-background hand-drawn illustrations featuring the Xiaohei IP, minimalist black line art, sparse red/orange/blue annotations, structural explanations, system metaphors, or technical shot lists.
---

# Ian Xiaohei Technical & Editorial Illustrations (English Edition)

## Core Purpose

Design and generate 16:9 landscape technical and editorial illustrations for articles, README documentation, workflows, and developer tools. The objective is not to produce generic corporate stock vectors, PowerPoint infographics, or cute anime cartoons, but to translate architectural judgments, pipelines, states, filters, and metaphors into clean, quirky, creative, readable, and non-instructional hand-drawn explanatory visuals.

The default visual IP is **"Xiaohei" (Little Black)**:
A solid black silhouette character with white dot eyes, thin limbs, and a deadpan expression, earnestly performing an absurd yet conceptually coherent physical action. Xiaohei must actively participate in the core action of the frame rather than serving as a passive corner decoration.

## Modular Reference Files

Load these references incrementally as required:
- `references/style-dna.md`: Visual style rules, color palette, typography constraints, and taboos.
- `references/xiaohei-ip.md`: Xiaohei visual anatomy, personality traits, action library, and behavioral limits.
- `references/composition-patterns.md`: Composition layouts, system metaphor generation, and mechanical metaphors.
- `references/prompt-template.md`: Image generation prompt assembly structure.
- `references/qa-checklist.md`: Post-generation visual checklist and validation rules.

## Standard Workflow

### 1. Ingest Text & Architecture
Read the project documentation, workflow, commit diff, or architecture specification:
- Identify the core judgment, quality gate, or system transition.
- Pinpoint cognitive anchor points: input vs output, filter barriers, state branches, failure traps.
- Select the physical metaphor that best represents the technical reality (e.g., scanner, conveyor, centrifuge, checkpoint gate, sieve).

### 2. Formulate Illustration Strategy (Shot List)
For each required illustration, define:
- **Placement**: Where in the document or README it belongs.
- **Theme**: High-level conceptual title.
- **Core Insight**: The single technical concept being explained.
- **Structural Pattern**: Filter, pipeline, before/after, inspect-and-reroute, or dual-path.
- **Xiaohei's Active Role**: What specific physical task Xiaohei is performing.
- **Accents & Annotations**: Concise English keyword callouts in red, orange, or blue.

### 3. Generate & Refine
- Ensure 16:9 landscape ratio with generous negative space (subject takes 40%–60% of canvas).
- Pure white background (`#FFFFFF`) with hand-drawn, slightly irregular black ink lines.
- Save assets under `assets/` and link cleanly within documentation.

## Mandatory Maintenance Rule
Whenever repository code is updated, refactored, or pushed, review and update the visual illustration in `README.md` to reflect the latest architecture and state.
