# degenWars

A slot-machine auto battler. Spin a 3×3 slot machine to summon a tiny army of bots, merge them into something scary, and hold the line against zombies, aliens and rogue machines across 10, 20 or 30-wave incursions.

## Run it

```
node server.mjs        # serves the game on http://127.0.0.1:8811
```

Then open http://127.0.0.1:8811/.

## Layout

| Path | What |
|---|---|
| `game.src.html` | The game source (single file). **Edit this one.** |
| `index.html` | Built output: `python3 tools/style-v2/build.py` writes `index.html`, `style-v2.html` and `codex-v2.css` from `game.src.html`. |
| `ground.js`, `data/ground.json` | The 2.5D ground plane, calibrated in `lab/ground.html`. |
| `codex.js`, `codex.css` | The in-game Codex. |
| `assets/units/<id>/sheet-v2.*` | Baked unit sprite sheets. |
| `art/` | Painted art: slot symbols, cores, UI and backgrounds. |
| `lab/` | Test benches: roster, battle, slot feel, ground calibration, map. |
| `tools/` | Art generation, the 3D bake pipeline (Meshy → Blender → sprite sheets) and the balance sim (`tools/sim-run.mjs`, `?sim=1`). |
| `docs/` | Design doc, art brief, slot feel, style guide. |

The art scripts read their API keys from the environment or a local `.env`. No keys are in this repo.
