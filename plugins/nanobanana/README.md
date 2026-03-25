# nanobanana

Image generation prompting skill for the Nano Banana MCP server. Teaches Claude to be a better art director — model selection, prompt engineering, visual grounding, and cost optimization.

## Prerequisites

The Nano Banana MCP server must be configured and running. This plugin doesn't provide the MCP tools — it provides the expertise to use them well.

Your `.mcp.json` should already include a `nanobanana` server entry. If `mcp__nanobanana__generate_image` works in your session, you're set.

## What's Included

### image-generation skill

A prompting expertise skill that activates when you ask Claude to generate, edit, or upscale images. Covers:

- **Model selection** — when to use NB2 (default) vs Pro vs Flash
- **Golden workflow** — generate drafts cheap, upscale the winner
- **Prompt writing** — medium descriptions, composition, consistency, text rendering
- **Visual grounding** — Google Search image lookup for real-world accuracy
- **Aspect ratios** — matching output to use case
- **Editing workflows** — single edits, multi-image conditioning, iterative refinement
- **Cost optimization** — low-res drafts, Batch API discounts

### Reference files

- `prompt-patterns.md` — 10 worked examples including verbatim prompts from the official Nano Banana guide
- `model-selection.md` — deep model comparison, cost matrix, troubleshooting

## Example

**Without the skill:**
> "Generate an image of a cat"

**With the skill**, Claude transforms that into:

```
model_tier: "nb2"
n: 3
resolution: "1k"
prompt: "A ginger tabby cat lounging on a sun-drenched windowsill, shot with
a 50mm lens at f/1.8. Warm afternoon light casting long shadows across wooden
floorboards. Shallow depth of field with the cat's face in sharp focus and a
blurred garden visible through the window. Photorealistic interior photography."
```

Then presents the drafts and offers to upscale or refine.

## Installation

```bash
# Via marketplace
/plugin marketplace add bloknayrb/claudestuff
# Then install the nanobanana plugin

# Or directly
/plugin install bloknayrb/claudestuff/plugins/nanobanana
```
