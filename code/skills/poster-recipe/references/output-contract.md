# Poster recipe output contract

`poster-recipes.json` contains exactly three recipes. Each recipe includes audience, headline, information hierarchy, palette, fonts, layout, material gaps, provider prompt, and a deterministic selection score. The root records the selected recipe and selection rationale.

Provider truth is explicit:

- `image_provider_called` remains `false` for local generation;
- `image_provider_receipt` remains `null` without a real provider response;
- `render.kind` is `editable-svg`, not a generated bitmap.

The selected SVG contains editable `<text>`, `<rect>`, `<line>`, `<path>`, and `<g>` elements and no `<image>` element.
