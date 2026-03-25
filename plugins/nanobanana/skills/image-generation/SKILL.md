---
name: image-generation
description: >-
  This skill should be used when the user asks to "generate an image", "create a
  picture", "make an illustration", "edit this image", "upscale", or any request
  involving AI image generation, nanobanana, nano banana, visual grounding,
  prompt engineering, or image editing. Provides model selection guidance
  (Flash/NB2/Pro), prompt engineering techniques, visual grounding best
  practices, resolution and cost optimization, and multi-image editing workflows
  for the Nano Banana MCP server (Gemini image models).
version: 1.0.0
tags: [image-generation, nanobanana, gemini, prompt-engineering, visual-grounding]
allowed-tools: [Read]
---

# Image Generation Prompting Skill

This skill teaches you to be an effective art director when calling the Nano Banana MCP server (`mcp__nanobanana__generate_image`). It covers model selection, prompt engineering, visual grounding, cost optimization, and editing workflows. The MCP tools are session-available — this skill provides the expertise to use them well.

**When this activates:** Any request involving image generation, editing, upscaling, visual grounding, or prompt crafting for Nano Banana / Gemini image models.

---

## Model Selection

Use `model_tier` to choose the right engine. **Default to `nb2` explicitly** — avoid `auto` which may escalate to Pro unnecessarily, increasing cost.

### Decision Tree

```
Is this a new project or prompt?
├── YES → Use nb2 (Nano Banana 2 / Gemini 3.1 Flash Image)
│         95% of Pro quality at a fraction of the cost
│
└── NO, maintaining existing NB1 pipeline?
    └── Use flash (Nano Banana 1 / legacy)
        Cheapest, fastest, no thinking mode

Is nb2 producing poor results after prompt refinement?
├── Try enabling thinking (if on Pro) or refining the prompt first
└── Still failing? → Use pro (Nano Banana Pro)
    Best for: extreme logical constraints, multi-layered compositions,
    complex spatial reasoning, visual grounding

Do you need visual grounding (Google Search image lookup)?
└── Use pro — the MCP tool marks enable_grounding as "Pro model only"
    (See Visual Grounding section for details)
```

### Quick Reference

| Tier | `model_tier` value | Best for | Thinking | Grounding | Max resolution |
|------|--------------------|----------|----------|-----------|----------------|
| NB1 | `flash` | Legacy pipelines, cheapest option | No | No | 1024px |
| NB2 | `nb2` | **Default for all new work** | See note | See note — set `enable_grounding: false` explicitly | 4K |
| Pro | `pro` | Edge cases, grounding, complex reasoning | Yes | Yes (default) | 4K |

---

## Golden Workflow

For any non-trivial image request, follow this cost-optimized workflow:

1. **Generate 2-4 variations at low resolution** — use `n: 4` with `resolution: "1k"` to produce quick, cheap drafts
2. **Review with the user** — present the options, discuss what works
3. **Upscale the winner** — take the best result and re-generate at `resolution: "high"` or higher

> **Cost tip:** The Batch API provides a **50% discount**. For bulk workflows (brand assets, content calendars), generate dozens of low-res variations via batch, pick the best, then upscale only the winners.

> **Cost tip:** The official guide notes that NB2 at 512px costs roughly the same as NB1 at standard resolution. The MCP tool's lowest `resolution` value is `"1k"` — the 512px option may be available via the direct API or a future MCP update. Use `"1k"` as the current cost-optimized draft resolution.

Always use this workflow by default unless the user explicitly asks for a single high-res image or time is more important than cost.

---

## Prompt Writing Principles

### Be Specific About the Medium

Don't just describe the subject — describe how it should look as if it were a real piece of art or photography:

- **Photography:** "cinematic golden-hour photograph", "macro lens close-up with shallow depth of field"
- **Illustration:** "Franco-Belgian comic book style with ink outlines", "watercolor botanical illustration"
- **3D:** "Pixar-style 3D render with subsurface scattering", "isometric low-poly game asset"
- **Traditional:** "chunky wax-crayon strokes on lined notebook paper", "oil painting with visible brushwork"

### Composition and Scene

Include explicit compositional direction:
- Camera angle: "shot from below", "bird's eye view", "Dutch angle"
- Lighting: "dramatic rim lighting", "soft diffused overcast", "neon-lit cyberpunk alley"
- Background: "clean gray-blue studio background", "blurred bokeh city lights"
- Spatial relationships: "standing next to", "reflected in a puddle", "silhouetted against"

### Consistency Across Multiple Generations

When generating a series (e.g., comic panels, product shots), anchor consistency:
- Describe the character/subject identically each time
- Reference the same style and lighting conditions
- Use `system_instruction` to set a persistent style (max 512 chars)

### Text Rendering

NB2 handles text well. When you need text in the image:
- Put the exact text in quotes within the prompt
- Specify font style, size relative to the image, and placement
- Keep text short — single words or short phrases work best

### Negative Prompts

Use `negative_prompt` (max 1024 chars) to steer away from unwanted elements:
- Style avoidance: "photorealistic" when you want illustration
- Artifact prevention: "blurry, low quality, watermark, text artifacts"
- Content exclusion: specific objects or styles to avoid

### System Instructions

Use `system_instruction` (max 512 chars) for persistent style guidance across a session:
- "Professional product photography with clean white background"
- "Dark fantasy illustration style with muted earth tones"
- "Minimalist line art, black ink on white, no shading"

---

## Visual Grounding

Visual grounding uses Google Search to look up real-world imagery before generating — ensuring accuracy for specific locations, species, monuments, and other real subjects.

### Discrepancy Note

The official Nano Banana guide attributes Image Grounding to NB2. However, the MCP tool schema marks `enable_grounding` as **"Pro model only"**. Until this is clarified:

- **Operational guidance:** Use `model_tier: "pro"` when grounding is needed for accuracy
- **The parameter defaults to `true`** in the tool, so when using Pro it's enabled automatically
- **When using NB2**, explicitly set `enable_grounding: false` to avoid ambiguity — the tool accepts the parameter but the schema says it only applies to Pro
- If you're already on `nb2` and results look factually accurate, the model may be using internal knowledge — but for guaranteed grounding, use Pro

### When to Use Grounding

- **Specific locations:** Churches, bridges, city squares, niche buildings — "the main historical church in Voiron, France"
- **Nature/species:** Exact animal species, breeds, insects — "a machaon butterfly"
- **Monuments and landmarks:** Accurate architectural details

### Limitations

- **Cannot search for people** — grounding will not retrieve images of specific individuals
- **Adds latency and cost** — only enable when factual accuracy matters
- **Requires Pro tier** in the current MCP server configuration

---

## Thinking Mode

The `thinking_level` parameter controls reasoning depth.

### Discrepancy Note

The official Nano Banana guide states that NB2 has a thinking mode that can be toggled on/off. However, the MCP tool schema restricts `thinking_level` to **Pro model only**. Until this is clarified:

- **Operational guidance:** Only set `thinking_level` when using `model_tier: "pro"`
- If a future MCP server update enables thinking on NB2, this section will apply to both tiers

### Default: OFF (don't set it)

For most generation tasks, thinking adds latency without improving results. Leave it unset.

### When to Enable (Pro tier in current MCP server)

Set `thinking_level` to `"low"` or `"high"` when using Pro and:

- The model generates **nonsensical results** despite clear prompts
- You're creating **complex infographics** with spatial layout requirements
- You're combining **grounding with spatial reasoning** (e.g., "accurate church with specific foreground elements")

| Value | Use case |
|-------|----------|
| `"low"` | Faster Pro generation with light reasoning |
| `"high"` | Maximum quality, complex multi-element compositions |

---

## Aspect Ratios and Resolution

### Available Aspect Ratios

Only these values are accepted by the MCP tool:

| Ratio | Orientation | Good for |
|-------|-------------|----------|
| `1:1` | Square | Profile pics, icons, social media |
| `2:3` | Portrait | Phone wallpapers, book covers |
| `3:2` | Landscape | Photography, web hero images |
| `3:4` | Portrait | Instagram, product shots |
| `4:3` | Landscape | Presentations, traditional photo |
| `4:5` | Portrait | Instagram portrait |
| `5:4` | Landscape | Print photos |
| `9:16` | Tall portrait | Stories, mobile full-screen |
| `16:9` | Wide landscape | Desktop wallpaper, video thumbnail |
| `21:9` | Ultra-wide | Cinematic, web banners |

> **Note:** The official Nano Banana guide mentions extreme ratios (1:8, 1:4) for comic strips and banners. These are **not currently in the MCP server's accepted values** and will be rejected. Use `21:9` as the widest available option, or compose multiple images side-by-side. These extreme ratios may be added in a future MCP server update.

### Resolution Options

| Value | Notes |
|-------|-------|
| `"high"` | Default. Standard high resolution |
| `"1k"` | Good for drafts and the golden workflow |
| `"2k"` | Pro model only |
| `"4k"` | Pro model only. Maximum detail |

---

## Editing and Multi-Image Workflows

### Single Image Editing

Provide an existing image and describe the edit:

- Use `input_image_path_1` with a local file path
- Or use `file_id` with a Files API ID (for large or reused images)
- Set `mode: "edit"` explicitly, or leave as `"auto"` to auto-detect
- The prompt describes what to change: "Change the sky to sunset colors" or "Remove the person in the background"

### Multi-Image Conditioning

Provide up to 3 input images to guide composition:

- `input_image_path_1`: Primary subject/reference
- `input_image_path_2`: Style reference or secondary subject
- `input_image_path_3`: Additional context

The prompt should describe how to combine them: "Place the person from image 1 in the setting from image 2, using the color palette from image 3."

### File ID for Efficiency

When working with the same image repeatedly (iterative edits):
1. Upload once via `mcp__nanobanana__upload_file` — returns a URI and metadata
2. Use the returned URI as the `file_id` value in subsequent `generate_image` calls (e.g., `files/abc123`)
3. Avoids re-reading the file from disk each time

---

## Parameter Quick Reference

| Parameter | Type | Default | Guidance |
|-----------|------|---------|----------|
| `prompt` | string (1–8192 chars) | *required* | Be specific: subject, composition, style, lighting, medium |
| `model_tier` | `flash` / `nb2` / `pro` / `auto` | `auto` | Use `nb2` explicitly for new work |
| `n` | integer 1–4 | 1 | Use 2–4 for the golden workflow |
| `aspect_ratio` | enum (see table) | null (1:1) | Match to output use case |
| `resolution` | `high` / `4k` / `2k` / `1k` | `high` | Use `1k` for drafts; `2k`/`4k` Pro only |
| `negative_prompt` | string (max 1024) | null | Style/artifact avoidance |
| `system_instruction` | string (max 512) | null | Persistent style across generations |
| `enable_grounding` | boolean | true | Pro only. For real-world accuracy |
| `thinking_level` | `low` / `high` / null | null | Pro only. For complex compositions |
| `mode` | `generate` / `edit` / `auto` | `auto` | Explicit when intent is clear |
| `input_image_path_1/2/3` | file path | null | Up to 3 input images |
| `file_id` | string | null | Files API ID for reused images |
| `output_path` | file path | null | Custom save location |
| `return_full_image` | boolean | null | Return full-res in MCP response (large!) |

---

## References

For worked prompt examples organized by technique, read:
`references/prompt-patterns.md`

For deep model comparison, cost optimization, and troubleshooting, read:
`references/model-selection.md`

---

## Behavioral Guidance

When the user asks you to generate an image:

1. **Use the golden workflow by default** — generate multiple low-res drafts, then upscale the best one. Skip this only if the user explicitly wants a single image or speed matters.

2. **Ask clarifying questions for vague requests.** "Make me a cool picture" needs refinement. Ask about:
   - Subject and scene
   - Style/medium (photo, illustration, 3D, etc.)
   - Mood and lighting
   - Intended use (determines aspect ratio and resolution)

3. **Set `model_tier: "nb2"` explicitly** rather than relying on `auto`. Only escalate to `pro` when NB2 consistently fails or grounding is needed.

4. **Write detailed prompts** even if the user gives a short description. Transform "a cat on a roof" into a full art-directed prompt with medium, lighting, composition, and style.

5. **Offer refinement after generation.** After showing results, suggest specific adjustments: "I can adjust the lighting, change the style, or try a different composition."

6. **Use `system_instruction`** when generating multiple related images to maintain visual consistency.

7. **Match aspect ratio to use case.** Don't generate 1:1 when the user needs a desktop wallpaper (16:9) or phone background (9:16).

8. **For editing requests,** confirm which image to edit and what changes are needed before calling the tool. Describe edits precisely in the prompt.

9. **When using NB2**, set `enable_grounding: false` explicitly since the parameter defaults to `true` but is documented as Pro-only.

10. **Other available tools:** `mcp__nanobanana__show_output_stats` shows recent generation history and disk usage. `mcp__nanobanana__maintenance` handles cleanup of expired files and local storage (use `dry_run: true` first). `mcp__nanobanana__upload_file` uploads large or reused images to the Files API.
