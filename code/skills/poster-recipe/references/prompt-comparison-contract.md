# Poster Prompt comparison contract

Use the same source brief for all groups:

- A: ordinary short Prompt;
- B: manually structured Prompt;
- C: `gpt-image-2-style-library` using `poster-layout-system`;
- D: `visual-memory-translator` using the text-only `editorial_text_card` path.

The compiler writes `prompt-comparison.json`, `prompt-comparison.md`, and four verbatim `.txt` Prompt files. The JSON must keep these boundaries explicit:

- `prompt_assessment` measures brief-field coverage and task fit only;
- `provider_execution.status` remains `not-run` until a real provider call returns;
- `output_evaluation.status` remains `not-available` without images;
- `claims.images_generated` remains `false` without provider evidence.

For a valid image comparison, keep provider, model, size, quality, and output count identical across groups. Save each original output, request ID, response timestamp, parameter set, and SHA-256. Do not retouch an image before scoring.

Score image output only after the evidence set is complete:

| Metric | Weight | Gate |
|---|---:|---|
| Verbatim required text | 20 | Both required strings and the headline are exact |
| Brief constraints | 20 | Required subjects appear and forbidden items do not |
| Information hierarchy | 15 | Headline, event details, and brand read in order |
| Composition and whitespace | 15 | Stable 3:4 layout and readable thumbnail |
| Style consistency | 10 | Palette, material, and type direction agree |
| Theme communication | 10 | Rain, old bookstore, and slowing down are legible |
| Reproducibility | 10 | Full Prompt, parameters, outputs, hashes, and receipts exist |

Do not average missing output scores as zero. Report the experiment as blocked or incomplete instead.
