# Prompt Patterns for Image Generation

Worked examples organized by technique. Prompts marked **[Source]** are verbatim from the official Nano Banana guide. Prompts marked **[Supplementary]** are inferred patterns.

---

## 1. Cartoon / 3D Portraits [Source]

Transform personal photos into stylized 3D characters interacting with their real-world selves.

**Requires:** `input_image_path_1` (reference photo of the person)

```
Prompt: Based strictly on the uploaded reference image, create a photorealistic
scene featuring the real human standing next to a giant 3D animation-style
version of themselves. Both must have identical facial structures, clothing,
and poses. The real person is smiling naturally with their hand on the 3D
character's shoulder. The 3D version is proportionally larger, anatomically
identical but stylized, with expressive eyes and a playful smirk. Clean
gray-blue studio background, cinematic lighting, crisp textures.
```

**Key techniques:**
- Explicit instruction to match features between real and stylized versions
- Specific interaction described ("hand on the 3D character's shoulder")
- Background and lighting fully specified
- Style contrast clearly stated (photorealistic human vs. 3D stylized)

**Parameters:**
- `model_tier: "nb2"`
- `input_image_path_1: "/path/to/reference-photo.jpg"`

---

## 2. Animation to Photorealism [Source]

Convert animated stills into hyper-realistic photographic images.

**Requires:** `input_image_path_1` (animated still / drawing)

```
Prompt: Convert this uploaded animated still into an ultra-realistic, cinematic,
and fully photorealistic scene. Transform the animated characters into real
humans while perfectly preserving their original identities, facial structures,
outfits, expressions, and overall likeness.
```

**Key techniques:**
- Strong emphasis on identity preservation across style transfer
- Multiple reinforcing terms for realism ("ultra-realistic, cinematic, fully photorealistic")
- Explicit list of what to preserve (identities, facial structures, outfits, expressions, likeness)

**Parameters:**
- `model_tier: "nb2"`
- `input_image_path_1: "/path/to/animated-still.png"`

---

## 3. Location Grounding [Source]

Generate accurate depictions of real-world locations using visual grounding.

**Requires:** `model_tier: "pro"` for grounding, `enable_grounding: true`

```
Prompt: Generate a cinematic, golden-hour photograph of the main historical
church in Voiron, France. Ensure the architectural details, the spire, the
surrounding square, and the landscape (mountains) are accurate to reality.
```

**Key techniques:**
- Specific location named (not just "a church" but "the main historical church in Voiron, France")
- Explicit request for accuracy ("accurate to reality")
- Environmental context included (surrounding square, mountains)
- Photography style specified (cinematic, golden-hour)

**Parameters:**
- `model_tier: "pro"`
- `enable_grounding: true`

**Adaptation tip:** Replace the city with any specific location. Works well for hometown landmarks, travel destinations, or architectural references.

---

## 4. Species / Nature Grounding [Source]

Accurate depiction of specific biological species with comparison.

**Requires:** `model_tier: "pro"` for grounding, `enable_grounding: true`

```
Prompt: Create a realistic picture of a machaon butterfly and a flambé one,
and highlight their differences to show how to differentiate them.
```

**Key techniques:**
- Specific species named (not just "butterfly" but "machaon" and "flambé")
- Comparative framing — showing two subjects side by side
- Educational intent communicated ("highlight their differences")
- Grounding ensures accurate species representation

**Parameters:**
- `model_tier: "pro"`
- `enable_grounding: true`

---

## 5. Historical Scene Reimagining [Source]

Hyper-realistic historical scenes with modern interface overlays.

```
Prompt: Generate a hyper-realistic image of the crowning of Charlemagne on
December 25, 800 AD, perfectly replicating a Google Maps Street View capture.
Show Pope Leo III placing the imperial crown on a kneeling Charlemagne inside
Old St. Peter's Basilica. Include a 123-degree wide-angle barrel distortion,
a semi-transparent Google Maps UI overlay (navigation compass, 2D map
thumbnail, white directional chevron arrows floating over the stone floor),
and a '© Google 800' watermark. Automatically blur the faces of Charlemagne,
the Pope, and surrounding medieval nobles for privacy. Use warm, dim torchlight
and candlelight filtering through the basilica, dramatic shadows, and high-ISO
digital noise typical of a 360-degree camera struggling in a low-light interior.
```

**Key techniques:**
- Extremely detailed composition with specific visual elements
- Creative anachronism (historical event + modern technology)
- Technical photography terms (barrel distortion, high-ISO noise, 360-degree camera)
- UI overlay elements precisely described
- Humor through anachronistic details ("© Google 800", privacy blur on historical figures)

**Parameters:**
- `model_tier: "nb2"` (or `"pro"` if results need refinement)
- This is a complex multi-layered prompt — if NB2 struggles, try Pro with `thinking_level: "high"`

---

## 6. Kindergarten Filter [Source]

Intentionally naive, childlike art style with specific medium description.

```
Prompt: A child's crayon drawing on white lined notebook paper of maple taffy
on snow. Use chunky wax-crayon strokes, wobbly outlines, and bright bold colors
that messily overflow the lines. Include visible heavy pressure marks, waxy
smudges, and uneven scribble shading. Draw important elements disproportionately
large with simple flat shapes, round friendly faces, dot eyes, and big curved
smiles. Add a classic large yellow sun in the corner, puffy clouds, and zero
realistic perspective. Joyful, naive art style.
```

**Key techniques:**
- Medium described in extreme detail (wax-crayon, lined notebook paper)
- Imperfection is the feature: "wobbly outlines", "messily overflow", "uneven scribble"
- Physical material qualities: "heavy pressure marks", "waxy smudges"
- Compositional rules of child art: "disproportionately large", "zero realistic perspective"
- Emotional tone: "joyful, naive art style"

**Parameters:**
- `model_tier: "nb2"`
- `negative_prompt: "realistic, detailed, professional, clean lines"`

---

## 7. Comic Strip Generation [Source-Adapted]

Multi-panel comic layouts. The source guide used a 4:1 ratio, but the MCP server's widest available ratio is 21:9.

```
Prompt: Create a 4-panel horizontal comic strip. The story follows a mischievous
cat trying to steal a fish from a kitchen counter that ends with a twist. Use
a vibrant, Franco-Belgian comic book style. Keep the cat's design consistent
across all panels.
```

**Key techniques:**
- Panel count and layout specified
- Narrative arc described (setup through twist)
- Style anchored to a specific tradition (Franco-Belgian)
- Consistency instruction for recurring character

**Parameters:**
- `model_tier: "nb2"`
- `aspect_ratio: "21:9"` (widest available — the guide used 4:1 which is not in the MCP enum)

> **Note:** For true extreme-wide layouts, you may need to generate panels individually and compose them externally.

---

## 8. Art Style Transfer [Supplementary]

Apply a specific artistic medium to any subject.

```
Prompt: A coastal Mediterranean village at sunset, rendered as a Post-Impressionist
oil painting in the style of thick impasto brushwork. Warm ochre and terracotta
buildings with cobalt blue shadows. Visible palette knife texture on the water
surface. Heavy paint application with ridges catching the golden light. Canvas
texture visible through thinner passages.
```

**Key techniques:**
- Subject and setting clearly described
- Specific art movement named (Post-Impressionist)
- Physical paint qualities: "thick impasto", "palette knife texture", "heavy paint application"
- Color palette explicitly called out (ochre, terracotta, cobalt blue)
- Material substrate mentioned (canvas texture)

**Parameters:**
- `model_tier: "nb2"`
- `system_instruction: "Fine art painting style with visible brushwork and texture"`

---

## 9. Product Photography [Supplementary]

Clean commercial product shots.

```
Prompt: Professional product photograph of a matte black ceramic coffee mug
on a polished white marble surface. Single dramatic side light from the left
creating a long shadow. Shallow depth of field with the handle in sharp focus.
Tiny wisps of steam rising from hot coffee inside. Neutral gray gradient
background. Shot with a 100mm macro lens, f/2.8, studio strobe lighting.
```

**Key techniques:**
- Product described precisely (material, color, form)
- Lighting setup specified (single side light, studio strobe)
- Camera settings add realism (100mm macro, f/2.8)
- Small detail adds life (steam wisps)
- Commercial-appropriate background (neutral gray gradient)

**Parameters:**
- `model_tier: "nb2"`
- `aspect_ratio: "4:3"` or `"1:1"` for product listing
- `system_instruction: "Clean commercial product photography, studio lighting"`

---

## 10. Iterative Refinement Workflow [Supplementary]

Demonstrates the edit loop: generate, then refine with input image.

### Step 1: Initial generation

```
Prompt: A cozy reading nook in a bay window during a rainstorm. Warm amber
lamplight illuminates an open book and a steaming cup of tea on the windowsill.
Rain streaks on the glass with blurred city lights beyond. Soft knitted blanket
draped over a cushioned bench seat. Photorealistic interior photography.
```

Parameters: `model_tier: "nb2"`, `n: 3`, `resolution: "1k"`

### Step 2: Pick the best, then edit

```
Prompt: Keep everything the same but change the rain to snow. Add frost
patterns on the edges of the window glass. Make the city lights warmer
and slightly more blurred to suggest heavier snowfall.
```

Parameters: `model_tier: "nb2"`, `input_image_path_1: "/path/to/best-draft.png"`, `mode: "edit"`

### Step 3: Final upscale

```
Prompt: Upscale this image to maximum resolution while preserving all details.
```

Parameters: `model_tier: "nb2"`, `input_image_path_1: "/path/to/edited.png"`, `resolution: "high"`

**Key techniques:**
- Start broad with multiple drafts at low resolution
- Edit specific elements while preserving what works
- Final pass for resolution — don't waste high-res on exploratory iterations
