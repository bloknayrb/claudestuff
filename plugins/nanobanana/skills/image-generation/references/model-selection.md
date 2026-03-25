# Model Selection Deep Dive

Detailed comparison of Nano Banana model tiers, cost optimization strategies, and troubleshooting.

---

## Model Comparison

| Capability | `flash` (NB1) | `nb2` (NB2) | `pro` |
|------------|---------------|-------------|-------|
| **Underlying model** | Gemini Flash (legacy) | Gemini 3.1 Flash Image | Gemini 3 Pro Image |
| **Max resolution** | 1024px | 4K | 4K |
| **Thinking mode** | No | See note below | Yes (`thinking_level`) |
| **Visual grounding** | No | See note below | Yes (`enable_grounding`) |
| **Text rendering** | Basic | Good | Best |
| **Speed** | Fastest | Fast | Slower |
| **Relative cost** | Lowest | Low (slightly more than NB1) | Highest |
| **512px generation** | No | Yes | Yes |
| **Best for** | Legacy pipelines | All new work | Edge cases, grounding |

### When to Use Each

**`flash` (NB1):** Only if you have an existing pipeline that works and migration isn't worth the effort. No new features, no thinking, no grounding. Still the absolute cheapest option.

**`nb2` (NB2):** Default for everything new. Roughly 95% of Pro's capabilities at a fraction of the cost. Handles text rendering, complex styles, and most compositions well.

**`pro`:** Step up only when NB2 consistently fails. The heavy lifter for:
- Visual grounding with Google Search
- Extremely complex multi-layered prompts
- Spatial reasoning with grounding
- Maximum text rendering quality
- When `thinking_level` is needed

---

## When NB2 Fails — Escalation Triggers

Before switching to Pro, try these fixes on NB2 first:

1. **Rewrite the prompt** — more specific, better structured
2. **Add negative prompts** — explicitly exclude unwanted elements
3. **Use system_instruction** — set a clearer style baseline
4. **Generate more variations** — `n: 4` gives more chances at a good result

Switch to Pro when NB2 **consistently** produces:
- Anatomically incorrect results despite detailed prompts
- Wrong spatial relationships (objects in wrong positions)
- Failed text rendering after multiple attempts
- Inaccurate real-world subjects (need grounding)
- Nonsensical compositions that don't match the prompt

---

## Resolution and Cost Optimization

### Resolution Options by Tier

| Resolution | `flash` | `nb2` | `pro` | Notes |
|------------|---------|-------|-------|-------|
| `"1k"` | Not accepted | Yes | Yes | Great for drafts; flash max is 1024px via `"high"` only |
| `"high"` | Default | Default | Default | Standard output |
| `"2k"` | — | — | Yes | Pro only |
| `"4k"` | — | — | Yes | Pro only, maximum detail |

### The Low-Resolution Draft Sweet Spot

The official guide notes that NB2 at 512px costs roughly the same as NB1 at standard resolution. The MCP tool's lowest `resolution` value is `"1k"` — the 512px option may be available via the direct API or a future MCP server update.

Use `"1k"` as the current cost-optimized draft resolution:

1. Generate 4 images at `"1k"` → low cost, fast iteration
2. Pick the best composition
3. Upscale to `"high"` or higher → one high-cost generation instead of four

### Batch API Discount

The Batch API provides a **50% discount** on generation costs. For workflows that aren't time-sensitive:
- Generate dozens of low-res variations via batch
- Review the full grid
- Upscale only the winners

This is ideal for brand asset generation, social media content calendars, or any bulk creative workflow.

---

## Visual Grounding — Discrepancy Note

There is a discrepancy between the official guide and the MCP tool:

- **Official Nano Banana guide (2026-03-11):** States that NB2 introduces Image Grounding as a key new feature. Describes it as a major capability of Gemini 3.1 Flash Image.
- **MCP tool schema:** Marks `enable_grounding` as "Pro model only" in the parameter description.

**Practical recommendation:** Use `model_tier: "pro"` when grounding is needed. The `enable_grounding` parameter defaults to `true`, so on Pro it's active automatically. If you're on NB2 and get accurate real-world results, the model may be using internal knowledge — but for guaranteed Google Search grounding, use Pro.

This discrepancy may be resolved in a future MCP server update.

---

## Thinking Mode — Discrepancy Note

Similar to grounding, there is a discrepancy between the guide and the MCP tool:

- **Official Nano Banana guide (2026-03-11):** States "Nano Banana 2 has a 'Thinking' mode where it reasons about the prompt before generating. However, you can now toggle this feature ON or OFF."
- **MCP tool schema:** Marks `thinking_level` as "Only applies to Pro model" in the parameter description.

**Practical recommendation:** Only set `thinking_level` when using `model_tier: "pro"`. The guide is clear that NB2 supports thinking, but the MCP tool currently restricts the parameter to Pro. If a future update enables it for NB2, the same guidance applies: keep it off by default, enable for nonsensical results, complex infographics, or grounding + spatial reasoning.

---

## System Instruction Patterns

The `system_instruction` parameter (max 512 chars) sets persistent style guidance. Useful examples:

| Use case | Example value |
|----------|---------------|
| Product photography | `"Clean commercial product photography, studio lighting, white background"` |
| Fantasy illustration | `"Dark fantasy illustration, muted earth tones, detailed ink linework"` |
| Children's book | `"Warm, friendly watercolor illustration style for ages 4-8"` |
| Technical diagram | `"Clean technical illustration, labeled components, white background"` |
| Social media | `"Bright, eye-catching social media content with bold colors"` |
| Vintage photography | `"1970s film photography aesthetic, warm grain, slightly faded colors"` |

---

## App Inspiration

The official Nano Banana guide highlights three demo apps as use-case patterns:

1. **Window Seat** — Generate photorealistic window views based on live weather and specific locations. Demonstrates grounding + environmental context.

2. **Pet Passport Adventure** — Send your pet on a global adventure. Demonstrates input image conditioning + location prompting.

3. **Global Kit Generator** — Developer tool for scaling localized marketing assets. Demonstrates batch generation + brand consistency.

These are available at [AI Studio](https://aistudio.google.com) and serve as architectural inspiration for image generation pipelines.

---

## Troubleshooting

### Images Look Wrong or Nonsensical

1. **Check your prompt specificity** — vague prompts produce vague results
2. **Try Pro with thinking** — set `model_tier: "pro"` and `thinking_level: "high"`
3. **Add negative prompts** — explicitly exclude the unwanted elements
4. **Reduce complexity** — break a complex scene into simpler components

### Text Rendering Issues

1. Keep text short — single words or short phrases
2. Put exact text in quotes within the prompt
3. Specify placement and style
4. Try Pro if NB2 consistently fails

### Grounding Not Working

1. Ensure `model_tier: "pro"` — grounding is Pro-only in the MCP tool
2. Name subjects specifically — "machaon butterfly" not "a butterfly"
3. Remember: cannot ground on people
4. Include "accurate to reality" or similar phrasing

### Aspect Ratio Rejected

The MCP tool accepts only: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`. Extreme ratios like 1:8 or 1:4 mentioned in the official guide are not yet supported by the MCP server.

### Resolution Rejected

`"2k"` and `"4k"` are Pro-only. Use `"high"` or `"1k"` with NB2.

### Editing Produces Unexpected Results

1. Use `mode: "edit"` explicitly instead of `"auto"`
2. Be specific about what to change and what to preserve
3. Reference specific elements: "keep the background, change only the sky"
4. For iterative edits, use `file_id` to maintain consistency
