#!/usr/bin/env python3
# builds the live game from game.src.html (2026-11-26: style v2 is live; edit game.src.html, never index.html):
#   python3 tools/style-v2/build.py   -> writes index.html + style-v2.html + codex-v2.css in the project root
# builds style-v2.html from the source: new font link, font-family tokens, then the v2 override layer (v2.css + art.css) at the end of <style>;
# also builds codex-v2.css (copy both outputs to the project root)
import re, sys, pathlib
D = pathlib.Path(__file__).parent
ROOT = D.parent.parent
src = (ROOT / 'game.src.html').read_text()
css = (D / 'v2.css').read_text() + '\n' + (D / 'art.css').read_text()

FONT_LINK = ('<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700'
             '&family=IBM+Plex+Mono:wght@400;500;600&family=Saira+Stencil+One&family=Limelight&display=swap" rel="stylesheet">')
s = re.sub(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]*" rel="stylesheet">', FONT_LINK, src, count=1)
s = s.replace('<title>degenWars · Layout A</title>', '<title>degenWars · Style v2</title>', 1)
s = s.replace('<link rel="stylesheet" href="codex.css">', '<link rel="stylesheet" href="codex-v2.css">', 1)

R = [
 (r"'Limelight','Russo One',serif", "var(--f-brand)"),
 (r"'Saira Stencil One','Special Elite',Impact,sans-serif", "var(--f-disp)"),
 (r"'Saira Stencil One','Russo One',sans-serif", "var(--f-disp)"),
 (r"'Special Elite','Courier New',monospace", "var(--f-mono)"),
 (r"'Russo One','Chakra Petch',sans-serif", "var(--f-disp)"),
 (r"'Chakra Petch',system-ui,sans-serif", "var(--f-ui)"),
 (r"'Chakra Petch',monospace", "var(--f-mono)"),
 (r"'Chakra Petch',sans-serif", "var(--f-ui)"),
 (r"'Chakra Petch'", "var(--f-ui)"),
 # Russo One readouts become the condensed sans at bold weight
 (r"font:400 ([^;'\"{}]*?)'Russo One'(,sans-serif)?", r"font:700 \1var(--f-num)"),
 (r"font-family:'Russo One'(,sans-serif)?;font-weight:400", "font-family:var(--f-num);font-weight:700"),
 (r"font-family:'Russo One'(,sans-serif)?", "font-family:var(--f-disp)"),
]
for a, b in R:
    s, n = re.subn(a, b, s)
    print(f'{n:3d}  {a}', file=sys.stderr)
left = re.findall(r"Russo One|Chakra Petch|Special Elite", s)
print('leftover font names:', len(left), file=sys.stderr)

i = s.index('</style>')
s = s[:i] + '\n/* ================= STYLE v2 (see docs/style.md) ================= */\n' + css + '\n' + s[i:]
(D / 'style-v2.html').write_text(s)
(ROOT / 'style-v2.html').write_text(s)
(ROOT / 'index.html').write_text(s.replace('<title>degenWars · Style v2</title>', '<title>degenWars</title>', 1))

# codex-v2.css = codex.css with the same font swaps + codex-over.css (Codex v2 + its art)
c = (D.parent.parent / 'codex.css').read_text()
for a, b2 in R:
    if 'f-num' not in b2: c = re.sub(a, b2, c)  # Codex keeps Russo One headings on the stencil face
c = re.sub(r"'Russo One',sans-serif", 'var(--f-disp)', c)
out = c + (D / 'codex-over.css').read_text()
(D / 'codex-v2.css').write_text(out)
(ROOT / 'codex-v2.css').write_text(out)
print('ok', len(s), file=sys.stderr)
