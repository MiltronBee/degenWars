#!/usr/bin/env python3
"""Prepare the game sounds: audio/src/<name>.(mp3|wav|ogg) -> audio/<name>.mp3 (the files the game loads).

For each sound in CUTS:
  1. cut the silence before the onset (a hit that starts 80 ms late feels like lag),
  2. keep at most `length` seconds and fade out the last `fade` seconds (long tails pile up when sounds repeat),
  3. level it toward one loudness (RMS of the cut sound = TARGET_RMS) without pushing its peak past PEAK_CEIL.
     Whatever a file still lacks after that is printed as a JS `trim` map for SFX.trim in game.src.html,
     so quiet files are lifted in the mix instead of having their transients squashed by a limiter.

Sounds not listed in CUTS are skipped. Needs ffmpeg. Run from anywhere: python3 tools/prep-audio.py
"""
import pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'audio' / 'src', ROOT / 'audio'
TARGET_RMS, PEAK_CEIL = -18.0, -1.0  # dBFS

# name: (max length after the onset in s, fade-out in s). roll keeps only its steady part (the game loops it).
CUTS = {
    'hit': (0.55, 0.15),
    'crit': (0.8, 0.2),
    'coin': (0.9, 0.2),
    'explode': (1.8, 0.8),
    'win': (3.0, 0.8),
    'lose': (1.45, 0.1),
    'roll': (5.0, 0.3),
    'lever': (1.0, 0.2),
    'click': (0.3, 0.05),   # menus
    'button': (0.3, 0.05),  # in-game buttons
}


def ff(*args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostats', *args], capture_output=True, text=True).stderr


def onset(f):
    """Start of the sound: end of the leading silence (-45 dB), minus 4 ms of headroom."""
    s = ff('-i', str(f), '-af', 'silencedetect=n=-45dB:d=0.01', '-f', 'null', '-')
    m = re.search(r'silence_start: (\S+)\n.*?silence_end: (\S+)', s, re.S)
    return max(0.0, float(m.group(2)) - 0.004) if m and float(m.group(1)) <= 0.001 else 0.0


def levels(f):
    s = ff('-i', str(f), '-af', 'astats=measure_perchannel=none', '-f', 'null', '-')
    return float(re.search(r'RMS level dB: (\S+)', s).group(1)), float(re.search(r'Peak level dB: (\S+)', s).group(1))


trims = {}
for name, (length, fade) in CUTS.items():
    src = next((SRC / f'{name}.{ext}' for ext in ('mp3', 'wav', 'ogg') if (SRC / f'{name}.{ext}').exists()), None)
    if not src:
        continue
    on = onset(src)
    cut = f'atrim=start={on:.3f}:duration={length},asetpts=PTS-STARTPTS,afade=t=out:st={max(0, length - fade):.3f}:d={fade}'
    tmp = OUT / f'.{name}.wav'
    ff('-y', '-i', str(src), '-af', cut, '-c:a', 'pcm_s16le', str(tmp))
    rms, peak = levels(tmp)
    gain = min(TARGET_RMS - rms, PEAK_CEIL - peak)
    ff('-y', '-i', str(tmp), '-af', f'volume={gain:.2f}dB', '-c:a', 'libmp3lame', '-q:a', '2', str(OUT / f'{name}.mp3'))
    tmp.unlink()
    short = TARGET_RMS - (rms + gain)  # dB still missing after the peak cap
    if short > 0.5:
        trims[name] = round(10 ** (short / 20), 2)
    print(f'{name:8s} onset {on * 1000:4.0f} ms  kept {length}s  rms {rms:6.1f} -> {rms + gain:6.1f}  peak {peak:5.1f} -> {peak + gain:5.1f}  gain {gain:+5.1f} dB')

print('SFX.trim =', '{' + ','.join(f'{k}:{v}' for k, v in trims.items()) + '}')
