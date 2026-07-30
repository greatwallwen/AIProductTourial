---
name: poster-recipe
description: Compile a Chinese creative brief into three clearly differentiated poster recipes, select one with an explicit rationale, and render a deterministic editable SVG without claiming an image-provider result. Use for poster concepts, campaign key visuals, visual-direction comparison, or local fallback artwork when no image provider is available.
---

# Poster recipe

1. Validate the Chinese brief and keep its audience, headline, required copy, visible subjects, and prohibitions intact.
2. Run the deterministic builder to create three distinct recipes and one editable SVG.
3. Compare hierarchy, palette, typography, composition, and material gaps before accepting the selected direction.
4. Keep `image_provider_called` false and `image_provider_receipt` null unless a real provider returns a receipt.

```powershell
python -B scripts/build_poster.py `
  --input <brief.json> `
  --allowed-root <brief-root> `
  --recipe-output <output>/poster-recipes.json `
  --svg-output <output>/poster.svg
```

Read [references/output-contract.md](references/output-contract.md) when validating or consuming the artifacts. SVG text and vector groups remain editable; the script embeds no raster image.
