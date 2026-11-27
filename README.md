# degenWars

A slot-machine auto battler. Spin a 3×3 slot machine to summon a tiny army of bots, merge them into something scary, and hold the line against zombies, aliens and rogue machines across 10, 20 or 30-wave incursions.

## Run it

```
node server.mjs        # serves the game on http://127.0.0.1:8811
```

Then open http://127.0.0.1:8811/.

## Controller

Plays with a gamepad (ROG Ally, Xbox, Steam Deck, DualSense) in Chrome or Edge over https or localhost; browsers only expose gamepads to secure pages. A gold highlight moves with the left stick or D-pad and **A** presses it. On the field, **A** grabs a unit, the stick carries it, and **A** drops it: on a matching unit it merges, on another unit they swap. In Absorb mode (the Absorb button under the field) dropping it on any unit absorbs it. Holding **A** on Hold to absorb keeps absorbing until you let go.

| Button | Does |
|---|---|
| A | press / grab and drop a unit |
| B | back: close, put the unit back, cancel Blast |
| X | spin (slam stop while the reels run) |
| Y | Blast (holding a unit: scrap it) |
| LB | Battle! |
| LT | Black Market |
| RT | battle speed |
| RB | Kit |
| Menu / View | Settings / Codex |
| Right stick | scroll |

Glyphs on the buttons show these while the pad is the last input; touching the screen or moving a mouse hides them. On a ROG Ally, set the controller to Gamepad mode in Armoury Crate (desktop mode turns the sticks into a mouse). Code: `gamepad.js`.

## Live build

https://sol-pkmn.fun/degenwars/ (public, noindex). To update it, build, commit, then run `tools/deploy-sol-pkmn.sh` from a machine with SSH key access to `root@sol-pkmn.fun`. It ships the committed HEAD, not the working tree. The script header says what lives on the droplet.

## Layout

| Path | What |
|---|---|
| `game.src.html` | The game source (single file). **Edit this one.** |
| `index.html` | Built output: `python3 tools/style-v2/build.py` writes `index.html`, `style-v2.html` and `codex-v2.css` from `game.src.html`. |
| `ground.js`, `data/ground.json` | The 2.5D ground plane, calibrated in `lab/ground.html`. |
| `codex.js`, `codex.css` | The in-game Codex. |
| `gamepad.js` | Controller support (see Controller above). Loaded after the game script; the game's code lives in a block, so it hands this file `window.dwGame` (live state and the actions the pad drives). |
| `assets/units/<id>/sheet-v2.*` | Baked unit sprite sheets. |
| `art/` | Painted art: slot symbols, cores, UI and backgrounds. |
| `lab/` | Test benches: roster, battle, slot feel, ground calibration, map. |
| `audio/` | Game sounds the page loads (`<name>.mp3`) and music (`audio/music/<slug>.mp3`). Originals go in `audio/src/` (music masters in `audio/src/music/`, git-ignored); `python3 tools/prep-audio.py` trims and levels them into `audio/`. |
| `tools/` | Art generation, the 3D bake pipeline (Meshy → Blender → sprite sheets) and the balance sim (`tools/sim-run.mjs`, `?sim=1`). |
| `docs/` | Design doc, art brief, slot feel, style guide. |

The art scripts read their API keys from the environment or a local `.env`. No keys are in this repo.
