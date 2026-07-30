---
name: pixijs-game-contract
description: Generate a runnable PixiJS v8 mini-game project from a Chinese JSON brief, including keyboard controls, score, countdown, restart, provenance, and static contract tests. Use for lightweight educational games that need a real browser loop rather than a mock card or slide.
---

# PixiJS game contract

1. Put the Chinese game rules, source provenance, scoring, and safety boundary in a request JSON.
2. Run `scripts/generate_game.py` into an approved output root.
3. Run the Node contract audit and tests before opening the game.
4. Build or serve the generated project, then verify keyboard movement, score, countdown, and restart in a real browser.

```powershell
python -B scripts/generate_game.py --input examples/beijing-clean-dispatch.request.json --output examples/beijing-clean-dispatch --allowed-output-root examples
node scripts/audit_game_contract.mjs examples/beijing-clean-dispatch
node --test tests/game-contract.test.mjs
```

Keep educational data labels separate from health or safety advice. Stop if the brief lacks provenance, controls, a time limit, or a restart rule.
