# Prompt Template — Ian Xiaohei Illustrations

## Single-Image Prompt Assembly Structure

When invoking an image generation tool or subagent (`image-generator`), assemble the prompt using this exact structural template:

```markdown
[CORE STYLE DEFINITION]
A witty, minimalist 16:9 editorial illustration in the graphic-novel hand-drawn style of Ian Xiaohei.
Pure solid white background (#FFFFFF) with ample negative space (subject takes only 45% of the frame).
Crisp black ink line art with subtle organic hand-drawn wobble, no gradients, no paper textures, no 3D shading.

[PROTAGONIST ACTION]
Features "Xiaohei", a solid pitch-black silhouette character with two tiny white circular dot eyes and slender limbs.
Xiaohei is earnestly [SPECIFIC ACTION: operating a mechanical gate / inspecting code files with a magnifying glass / diverting an exposed secret key].

[METAPHORICAL ENVIRONMENT & PROPS]
A technical physical metaphor for [TOPIC]:
- Left: [Incoming elements, e.g., conveyor of code files with commits]
- Center: [Mechanical inspection device, e.g., ShipSafe pre-flight scanner gate, gears, levers, score meter]
- Right / Branch: [Clean approved stream flowing to GitHub, versus quarantined reject bin]

[COLOR ACCENTS & ANNOTATIONS]
Strictly black and white line art with sparse functional accents:
- Red accents (#EF4444) for [BLOCKED / LEAKED SECRET / DEBUGGER]
- Orange accents (#F97316) for [WARNING / GEARS / LATENCY]
- Blue accents (#3B82F6) for [CLEAN PATH / GITHUB / PROD READY]
Includes minimal hand-drawn English keyword labels with indicator arrows: "[LABEL 1]", "[LABEL 2]".

[QUALITY & CONSTRAINTS]
Clean composition, generous whitespace, quirky editorial tone, high legibility.
No corporate vector stock clipart, no 3D glossy spheres, no crowded margins.
```
