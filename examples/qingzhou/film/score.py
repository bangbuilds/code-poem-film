"""《早发白帝城》的配乐和音效编排：什么乐器在什么时刻响。乐器本身在 tools/synth.py。

    python3 tools/film.py score        → assets/score.wav + 自检数字
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import numpy as np
from synth import *  # noqa: F401,F403  (T, SR, OFF, FD, VOICE, SCALE, music, lead, fx, the instruments, finish)

# ───────────────────────── the cover (only with a recitation) ─────────────────────────
if OFF > 0:
    music.add(pad(['D3', 'A3', 'D4'], OFF + 0.9, 0.5, 1.3, 0.3), -OFF, 0.5)
    for k, name in enumerate(['D4', 'A4', 'D5', 'F#5', 'A5']):
        music.add(pluck(name, 2.4, 0.6), -OFF + 0.04 + k * 0.11, 0.42, -0.5 + 0.25 * k)
    n_i = int((OFF + 0.4) * SR)
    fx.add(noise(n_i, 300, 2400) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.4 * np.arange(n_i) / SR)) * env(n_i, 0.2, 0.9) * 0.05, -OFF, 1.0)

# ───────────────────────── A · a dot on paper ─────────────────────────
fx.add(glide(1500, 420, T['land1'] - T['drop'], (1.0, 0.25), vib=0.004, shape=1.4) * 0.16, T['drop'], pan=0)
for t0, lvl, note in ((T['land1'], 1.0, 'D3'), (T['land2'], 0.6, 'A3'), (T['land3'], 0.35, 'D4')):
    fx.add(tanggu(lvl * 0.9, 1.0 + (1 - lvl) * 0.5), t0, 0.8)
    music.add(pluck(note, 1.6, 0.5), t0 + 0.005, 0.9 * (0.5 + lvl * 0.5))
music.add(pluck('B5', 1.0, 0.7), T['eyes'], 0.55, 0.15)
music.add(pluck('D6', 1.2, 0.7), T['eyes'] + 0.11, 0.6, -0.15)
fx.add(woodblock(0.45, 1.3), T['blink'], 0.6)
music.add(pluck('E5', 0.9, 0.6), 2.72, 0.4, -0.5)
music.add(pluck('A5', 0.9, 0.6), 3.0 - 0.06, 0.4, 0.5)

# ───────────────────────── B · 朝辞白帝彩云间 ─────────────────────────
run = SCALE[5:21]                                     # D3 … D6
for k, name in enumerate(run):                        # the world soaks in: one long upward gliss
    music.add(pluck(name, 2.2, 0.62), T['bloom'] + 0.02 + k * 0.058, 0.42 + k * 0.012, -0.7 + 1.4 * k / (len(run) - 1))
music.add(pad(['D3', 'A3', 'D4', 'F#4'], 4.2, 1.0, 1.4, 0.3), T['bloom'] + 0.1, 0.55)
if not VOICE:
    lead.add(flute([(0.0, 0.45, 'A4'), (0.45, 0.2, 'B4'), (0.65, 0.58, 'D5'), (1.25, 0.2, 'E5'), (1.47, 0.26, 'D5'), (1.75, 0.2, 'B4'), (1.95, 0.2, 'D5'), (2.15, 0.2, 'E5')]), 3.53, 0.9, 0.1)
for t0 in (T['bow1'], T['bow2']):
    fx.add(woodblock(0.5, 1.0), t0 + 0.24, 0.6)
    music.add(pluck('A4', 0.8, 0.6), t0, 0.35, -0.2)
for k, t0 in enumerate((T['roll'], T['roll'] + 0.2)):
    fx.add(woodblock(0.5, 1.15 + 0.15 * k), t0 + 0.2, 0.6)
for k in range(6):                                    # the crouch winds up
    music.add(pluck(SCALE[12 + k], 0.5, 0.7), T['crouch'] + k * 0.028, 0.3 + k * 0.05)
fx.add(glide(380, 1500, 0.3, (1.0, 0.2)) * 0.2, T['leap'], pan=0.2)
music.add(pluck('A5', 1.5, 0.7), T['leap'], 0.6, 0.2)
# the fall: a whistle down, wind, and the gliss answered downward
fall0 = T['leap'] + 0.32
fall = T['boatLand'] - fall0
fx.add(glide(1700, 300, fall, (1.0, 0.2), vib=0.006, shape=1.6) * 0.15, fall0)
fx.add(whoosh(fall + 0.1, 500, 2500, 0.55), fall0)
for k, name in enumerate(reversed(run)):
    music.add(pluck(name, 1.2, 0.6), fall0 + 0.04 + k * (fall - 0.1) / len(run), 0.3, 0.7 - 1.4 * k / (len(run) - 1))

# ───────────────────────── C · 千里江陵一日还 ─────────────────────────
fx.add(splash(1.0), T['boatLand'], 0.9, -0.1)
fx.add(tanggu(0.9, 0.9), T['boatLand'], 0.8)
music.add(pluck('D3', 2.0, 0.5), T['boatLand'] + 0.01, 0.7)
music.add(pad(['D3', 'A3', 'E4'], 1.7, 0.4, 0.5, 0.3), T['boatLand'] + 0.1, 0.45)
fx.add(woodblock(0.7, 0.8), T['sail'], 0.7)
fx.add(noise(int(0.2 * SR), 800, 5000) * np.exp(-np.arange(int(0.2 * SR)) / SR * 30) * 0.3, T['sail'], 0.7)   # canvas snapping open
music.add(pluck('A4', 1.2, 0.65), T['sail'], 0.5, -0.2)
music.add(pluck('D5', 1.2, 0.65), T['sail'] + 0.09, 0.5, 0.2)
# drawing the bow: a roll that tightens and rises
k = 0
t0 = T['pull']
while t0 < T['launch'] - 0.02:
    u = (t0 - T['pull']) / (T['launch'] - T['pull'])
    fx.add(tanggu(0.2 + 0.5 * u, 1.3), t0, 0.6)
    music.add(pluck(SCALE[8 + min(6, int(u * 7))], 0.4, 0.7), t0, 0.25 + 0.3 * u, -0.3 + 0.6 * u)
    t0 += 0.085 - 0.04 * u
    k += 1

# ───────────────────────── D · 两岸猿声啼不住 ─────────────────────────
B = T['beat']
L0 = T['launch']
bt = lambda b: L0 + b * B
fx.add(tanggu(1.3, 0.85), L0, 1.0)
fx.add(whoosh(0.7, 400, 5000, 1.0), L0 - 0.05, 0.9)
fx.add(gong(146.8, 2.5, 0.5), L0, 0.5)
# rushing water under the whole run, opening up at the gate
n_w = int((T['cut'] - L0 + 0.3) * SR)
tw = np.arange(n_w) / SR
water = noise(n_w, 250, 4200) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.9 * tw)) * env(n_w, 0.5, 0.25)
fx.add(water * 0.14, L0, 1.0, -0.2)
fx.add(noise(n_w, 90, 260) * env(n_w, 0.6, 0.25) * 0.05, L0, 1.0, 0.2)
ost = ['D4', 'A4', 'D5', 'A4', 'B4', 'A4', 'F#4', 'A4']
bass = ['D3', 'A2', 'B2', 'A2']
air = (10, 12)                                         # the boat is off the water
b = 0.0
while b < 14:
    i = int(round(b * 2))
    if not (air[0] <= b < air[1]):
        music.add(pluck(ost[i % 8], 0.5, 0.72), bt(b), 0.36 if i % 2 else 0.46, -0.35 if i % 2 else 0.35)
        if i % 4 == 0:
            music.add(pluck(bass[(i // 4) % 4], 0.9, 0.45), bt(b), 0.7)
        beat_in_bar = b % 4
        if beat_in_bar in (0.0, 2.0):
            fx.add(tanggu(0.85 if beat_in_bar == 0 else 0.6, 1.0), bt(b), 0.75)
        elif beat_in_bar in (1.5, 3.5):
            fx.add(tanggu(0.4, 1.25), bt(b), 0.6)
        if i % 2 == 1:
            fx.add(woodblock(0.42, 1.0 + 0.12 * ((i // 2) % 2)), bt(b), 0.5, 0.3)
    b += 0.5
melody = [
    (0, 1, 'D5'), (1, .5, 'E5'), (1.5, .5, 'F#5'), (2, 1, 'A5'), (3, .5, 'F#5'), (3.5, .5, 'A5'),
    (4, 1.5, 'B5'), (5.5, .5, 'A5'), (6, .5, 'F#5'), (6.5, .5, 'E5'), (7, .5, 'F#5'), (7.5, .5, 'A5'),
    (8, .5, 'B5'), (8.5, 1, 'D6'), (9.5, .5, 'B5'),
]
lead.add(flute([(s * B, d * B * 0.96, nm) for s, d, nm in melody], legato=0.03, vib=0.005), L0, 0.95, 0.1)
# airborne: everything drops away but a shimmer and a rising whistle
for k in range(10):
    music.add(pluck('A5' if k % 2 else 'E6', 0.3, 0.8), bt(10) + k * B * 0.2, 0.2, (-1) ** k * 0.5)
fx.add(glide(500, 1900, B * 1.1, (1.0, 0.2)) * 0.16, T['jump'])
fx.add(glide(1900, 600, B * 0.9, (1.0, 0.2)) * 0.13, T['jump'] + B * 1.1)
fx.add(splash(1.1), T['splash2'], 0.9, 0.1)
fx.add(tanggu(1.2, 0.85), T['splash2'], 0.95)
lead.add(flute([(0, .5 * B * .96, 'D6'), (.5 * B, .5 * B * .96, 'B5'), (1 * B, .5 * B * .96, 'A5'), (1.5 * B, .5 * B * .96, 'F#5')], legato=0.03), bt(12), 0.95, 0.1)
# the gate: a roll and a rush into the dark
for k in range(8):
    fx.add(tanggu(0.4 + 0.1 * k, 1.1), bt(13) + k * B / 8, 0.7)
fx.add(whoosh(T['cut'] - T['gate'] + 0.25, 200, 3000, 1.3), T['gate'] - 0.05, 1.0)
# the gibbons
for t0, pan, base in ((T['hoot1'], 0.55, 540), (T['hoot2'], 0.4, 610), (T['hoot3'], 0.1, 470)):
    fx.add(hoot(base), t0, 1.0, pan)
    fx.add(hoot(base * 1.5) * 0.35, t0 + 0.75, 0.7, -pan)      # an answer from the other bank

# ───────────────────────── E · 轻舟已过万重山 ─────────────────────────
C0 = T['cut']
fx.add(gong(146.8, 6.0, 0.9), C0, 0.9)
fx.add(tanggu(1.2, 0.8), C0, 0.9)
music.add(pad(['D3', 'A3', 'D4', 'F#4', 'A4'], T['write0'] - C0 + 1.0, 0.5, 1.6, 0.42), C0, 0.95)
lead.add(flute([(0.05, 1.3, 'D6'), (1.42, 0.42, 'B5'), (1.9, 0.9, 'A5'), (2.86, 0.3, 'F#5')], legato=0.07, vib=0.008), C0, 1.0, 0.05)
arp = ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5', 'A4', 'F#4']
k = 0
t0 = C0 + 0.36
while t0 < T['hop'] - 0.1:
    music.add(pluck(arp[k % 8], 1.8, 0.55), t0, 0.36, -0.4 + 0.8 * ((k % 8) / 7))
    t0 += 0.357
    k += 1
n_c = int((FD - C0) * SR)
tc = np.arange(n_c) / SR
calm = noise(n_c, 300, 2200) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.23 * tc)) * env(n_c, 0.3, 3.0)
fx.add(calm * 0.05, C0, 1.0)
for t0, f in ((14.9, 3100), (15.02, 3500), (16.3, 2900), (16.42, 3300), (16.52, 3600)):     # birds
    fx.add(glide(f, f * 1.25, 0.07) * 0.05, t0, pan=0.6)
music.add(pluck('B4', 1.2, 0.6), T['lookBack'], 0.3, -0.4)
fx.add(glide(420, 1500, 0.34, (1.0, 0.2)) * 0.2, T['hop'], pan=0.2)
music.add(pluck('A5', 1.4, 0.7), T['hop'], 0.5)

# ───────────────────────── F · the line, written ─────────────────────────
music.add(pad(['D3', 'A3', 'D4'], FD - T['write0'] + 0.5, 0.4, 2.2, 0.3), T['write0'] - 0.3, 0.6)
chars = []
for s in T['strokes']:
    if s['ch'] not in chars:
        chars.append(s['ch'])
if VOICE:
    for ci, (t0, name) in enumerate(zip(T['charOn'], ['D4', 'F#4', 'A4', 'B4', 'D5', 'F#5', 'A5'])):
        music.add(pluck(name, 2.2, 0.62), t0, 0.5, -0.6 + 1.2 * ci / 6)
        music.add(pluck(SCALE[SCALE.index(name) - 5], 2.2, 0.5), t0, 0.3, 0.6 - 1.2 * ci / 6)      # the octave below
for s in T['strokes']:
    ci = chars.index(s['ch'])
    idx = min(len(SCALE) - 3, 7 + ci + (s['si'] % 5))    # each character climbs from a higher step
    if not VOICE:
        music.add(pluck(SCALE[idx], 0.9, 0.68), s['t0'], 0.34, -0.6 + 1.2 * ci / 6)
    m = int(max(0.03, s['t1'] - s['t0']) * SR)
    fx.add(noise(m, 1200, 6500) * np.sin(np.pi * np.arange(m) / m) * 0.06, s['t0'], 1.0, -0.6 + 1.2 * ci / 6)   # brush on paper
music.add(pluck('D6', 1.8, 0.7), T['write1'], 0.5, 0.5)
fx.add(glide(500, 1500, 0.28, (1.0, 0.2)) * 0.18, T['sealJump'], pan=0.5)
# the stamp
S0 = T['stamp']
fx.add(tanggu(1.5, 0.7), S0, 1.0, 0.3)
fx.add(gong(146.8, 5.0, 0.85), S0, 0.8, 0.2)
for k, name in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']):
    music.add(pluck(name, 3.4, 0.6), S0 + 0.02 + k * 0.03, 0.55, -0.5 + k * 0.2)
music.add(pluck('A5', 1.6, 0.7), T['credit'], 0.3, -0.3)
music.add(pluck('D6', 2.2, 0.7), T['credit'] + 0.16, 0.34, 0.3)
lead.add(flute([(0.0, 0.34, 'A5'), (0.36, 1.1, 'D6')], legato=0.08, vib=0.008), T['credit'] + 0.25, 0.5, 0.0)

finish([('A', 0, T['bloom']), ('B', T['bloom'], T['boatLand']), ('C', T['boatLand'], T['launch']), ('D', T['launch'], T['cut']), ('E', T['cut'], T['write0']), ('F', T['write0'], FD)])
