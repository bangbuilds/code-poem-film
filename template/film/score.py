"""This film's music and sound effects: which instrument sounds when. The instruments are in tools/synth.py.

    python3 tools/film.py score        → assets/score.wav, plus a printed self-check

The starter follows the starter scenes: thuds and plucks for the dot's arrival, an upward run as the world
soaks in, a soft step on every hop, a string for each character of the last line, a drum and a gong for the
seal. Re-arrange it for the poem; keep every sound tied to a time in build/timing.json so picture and sound
cannot drift apart. Nobody can hear this while it is being written — read the self-check, and ask the user to listen.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import numpy as np
from synth import *  # noqa: F401,F403  (T, SR, OFF, FD, VOICE, scale, music, lead, fx, the instruments, finish)

S = scale('D')                                        # D 宫调五声: D E F# A B, D2 … B6
run = S[5:21]                                         # D3 … D6

# ── the cover: a pad and five strings under the title ──
if OFF > 0:
    music.add(pad(['D3', 'A3', 'D4'], OFF + 0.9, 0.5, 1.3, 0.3), -OFF, 0.5)
    for k, name in enumerate(['D4', 'A4', 'D5', 'F#5', 'A5']):
        music.add(pluck(name, 2.4, 0.6), -OFF + 0.04 + k * 0.11, 0.42, -0.5 + 0.25 * k)

# ── the dot arrives ──
fx.add(glide(1500, 420, T['land1'] - T['drop'], (1.0, 0.25), vib=0.004, shape=1.4) * 0.16, T['drop'])
for t0, lvl, note in ((T['land1'], 1.0, 'D3'), (T['land2'], 0.6, 'A3'), (T['land3'], 0.35, 'D4')):
    fx.add(tanggu(lvl * 0.9, 1.0 + (1 - lvl) * 0.5), t0, 0.8)
    music.add(pluck(note, 1.6, 0.5), t0 + 0.005, 0.9 * (0.5 + lvl * 0.5))
music.add(pluck('B5', 1.0, 0.7), T['eyes'], 0.55, 0.15)
music.add(pluck('D6', 1.2, 0.7), T['eyes'] + 0.11, 0.6, -0.15)
fx.add(woodblock(0.45, 1.3), T['blink'], 0.6)

# ── the world soaks in: one long upward run, and a pad that carries the walk ──
for k, name in enumerate(run):
    music.add(pluck(name, 2.2, 0.62), T['bloom'] + 0.02 + k * 0.058, 0.42 + k * 0.012, -0.7 + 1.4 * k / (len(run) - 1))
chords = [['D3', 'A3', 'D4', 'F#4'], ['B2', 'F#3', 'B3', 'D4'], ['E3', 'B3', 'E4'], ['A2', 'E3', 'A3', 'E4']]
bounds = [T['bloom']] + [v - 0.2 for v in T['v'][1:]] + [T['hop']]
for i in range(len(bounds) - 1):                      # one chord per captioned line
    music.add(pad(chords[i % len(chords)], bounds[i + 1] - bounds[i] + 1.2, 0.8, 1.4, 0.3), bounds[i], 0.4)

# ── the walk: a soft step on every landing, a string on every other one ──
walk = ['D4', 'A4', 'F#4', 'A4', 'B4', 'A4', 'F#4', 'E4']
for k, t0 in enumerate(T.get('steps', [])):
    fx.add(woodblock(0.3, 1.0 + 0.1 * (k % 2)), t0, 0.5, -0.2 + 0.4 * (k % 2))
    if k % 2 == 0:
        music.add(pluck(walk[(k // 2) % len(walk)], 1.0, 0.6), t0, 0.34, -0.3 + 0.6 * ((k // 2) % 2))
# a flute answers after each line (it ducks by itself if the voice is still speaking)
ends = T.get('v', [])[1:] + [T['hop'] - 0.2]
phrases = [[(0.0, 0.3, 'A5'), (0.32, 0.5, 'D6')], [(0.0, 0.25, 'B5'), (0.27, 0.25, 'A5'), (0.54, 0.5, 'F#5')], [(0.0, 0.3, 'E5'), (0.32, 0.55, 'A5')]]
for i, t1 in enumerate(ends):
    lead.add(flute(phrases[i % len(phrases)], legato=0.06, vib=0.007), t1 - 0.95, 0.7, 0.1)

# ── the leap, then the last line: a string (and its octave) on each character as it is spoken ──
fx.add(glide(420, 1500, 0.34, (1.0, 0.2)) * 0.2, T['hop'], pan=0.2)
music.add(pluck('A5', 1.4, 0.7), T['hop'], 0.5)
music.add(pad(['D3', 'A3', 'D4'], FD - T['write0'] + 0.5, 0.4, 2.2, 0.3), T['write0'] - 0.3, 0.45)
on = T['charOn']
climb = S[10:10 + len(on)] if len(on) <= 9 else S[8:8 + len(on)]
for ci, (t0, name) in enumerate(zip(on, climb)):
    pan = -0.6 + 1.2 * ci / max(1, len(on) - 1)
    music.add(pluck(name, 2.2, 0.62), t0, 0.4, pan)
    music.add(pluck(S[S.index(name) - 5], 2.2, 0.5), t0, 0.22, -pan)
for s in T['strokes']:                                # the brush on paper
    m = int(max(0.03, s['t1'] - s['t0']) * SR)
    fx.add(noise(m, 1200, 6500) * np.sin(np.pi * np.arange(m) / m) * 0.06, s['t0'], 1.0, -0.6 + 1.2 * s['ci'] / max(1, len(on) - 1))
music.add(pluck('D6', 1.8, 0.7), T['write1'], 0.5, 0.5)
fx.add(glide(500, 1500, 0.28, (1.0, 0.2)) * 0.18, T['sealJump'], pan=0.5)

# ── the seal ──
fx.add(tanggu(1.5, 0.7), T['stamp'], 1.0, 0.3)
fx.add(gong(146.8, 5.0, 0.85), T['stamp'], 0.8, 0.2)
for k, name in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']):
    music.add(pluck(name, 3.4, 0.6), T['stamp'] + 0.02 + k * 0.03, 0.55, -0.5 + k * 0.2)
music.add(pluck('A5', 1.6, 0.7), T['credit'], 0.3, -0.3)
music.add(pluck('D6', 2.2, 0.7), T['credit'] + 0.16, 0.34, 0.3)
lead.add(flute([(0.0, 0.34, 'A5'), (0.36, 1.1, 'D6')], legato=0.08, vib=0.008), T['credit'] + 0.25, 0.5, 0.0)

finish([('arrive', 0, T['bloom']), ('walk', T['bloom'], T['hop']), ('write', T['hop'], FD)])
