"""《念奴娇·赤壁怀古》的配乐和音效：什么乐器在什么时刻响。乐器在 tools/synth.py。

    python3 tools/film.py score        → assets/score.wav + 自检数字

全片用 E 羽调五声（E G A B D）：比上一条的宫调苍凉。每个声音都挂在时间表的一个时刻上。
写这份编曲的人听不到它：看自检数字，交付时请人听。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import numpy as np
from synth import *  # noqa: F401,F403  (T, SR, OFF, FD, VOICE, scale, music, lead, fx, the instruments, finish)

S, E = T['v'], T['vEnd']                              # when each line starts and ends
G = scale('G')                                         # G A B D E, from G2 up — the notes of E 羽
RUN = G[4:20]                                          # E3 … E6


def run_up(t0, names, step=0.055, level=0.42, bright=0.62, dur=2.0):
    for k, name in enumerate(names):
        music.add(pluck(name, dur, bright), t0 + k * step, level + k * 0.01, -0.7 + 1.4 * k / max(1, len(names) - 1))


def chord(t0, names, level=0.55, spread=0.03, dur=3.2):
    for k, name in enumerate(names):
        music.add(pluck(name, dur, 0.6), t0 + k * spread, level, -0.5 + k / max(1, len(names) - 1))


# ───────────────────────── 封面：念奴娇，赤壁怀古。苏轼。 ─────────────────────────
if OFF > 0:
    fx.add(dagu(0.8), -OFF + 0.04, 0.8)
    fx.add(gong(164.8, 4.0, 0.5), -OFF + 0.04, 0.6)
    music.add(pad(['E3', 'B3', 'E4'], OFF + 0.9, 0.5, 1.3, 0.3), -OFF, 0.5)
    run_up(-OFF + 0.1, list(reversed(RUN[4:])), 0.05, 0.3, 0.6, 2.4)       # a long sweep down the strings
    fx.add(water(OFF + 0.4, 0.5) * env(int((OFF + 0.4) * SR), 0.2, 0.9), -OFF, 1.0)

# ───────────────────────── 红点落在纸上 ─────────────────────────
fx.add(glide(1500, 420, T['land1'] - T['drop'], (1.0, 0.25), vib=0.004, shape=1.4) * 0.16, T['drop'])
for t0, lvl, note in ((T['land1'], 1.0, 'E3'), (T['land2'], 0.6, 'B3'), (T['land3'], 0.35, 'E4')):
    fx.add(tanggu(lvl * 0.9, 1.0 + (1 - lvl) * 0.5), t0, 0.8)
    music.add(pluck(note, 1.6, 0.5), t0 + 0.005, 0.9 * (0.5 + lvl * 0.5))
music.add(pluck('B5', 1.0, 0.7), T['eyes'], 0.55, 0.15)
music.add(pluck('E6', 1.2, 0.7), T['eyes'] + 0.11, 0.6, -0.15)
fx.add(woodblock(0.45, 1.3), T['blink'], 0.6)

# ───────────────────────── 大江东去，浪淘尽，千古风流人物 ─────────────────────────
fx.add(dagu(0.9), T['bloom'] + 0.02, 0.8)
run_up(T['bloom'] + 0.04, RUN)                                              # the river soaks in
music.add(pad(['E3', 'B3', 'E4', 'G4'], S[2] - T['bloom'] + 0.4, 1.0, 1.4, 0.3), T['bloom'] + 0.1, 0.5)
music.add(horn([(0, 0.8, 'E4'), (0.8, 1.5, 'B4')], 0.9), T['pull0'] + 0.1, 0.8, -0.2)   # 大江东去
n_day = int((T['frame0'] - T['bloom']) * SR)
fx.add(water(T['frame0'] - T['bloom'], 0.6) * env(n_day, 0.8, 1.2), T['bloom'], 1.0)   # the river, all through the day
fx.add(whoosh(S[2] - T['waveIn'] + 0.4, 200, 2600, 0.8), T['waveIn'], 0.9, -0.5)       # the wave comes across
music.add(pad(['E3', 'G3', 'B3', 'D4'], T['heroesOut'] - S[2] + 1.8, 0.5, 1.4, 0.3), S[2] - 0.2, 0.5)
for k, name in enumerate(['B4', 'A4', 'G4', 'E4', 'D4', 'B3']):                        # 千古风流人物: a line going down, and out
    music.add(pluck(name, 2.0, 0.55), S[2] + 0.05 + k * (E[2] - S[2]) / 6, 0.4, 0.5 - 0.2 * k)
fx.add(splash(0.5), T['heroesOut'] + 0.3, 0.6, 0.4)
fx.add(gong(246.9, 3.0, 0.35), T['heroesOut'] + 0.25, 0.5)
# the skiff knocks against the rock; the dot drops in
for k in range(2):
    fx.add(woodblock(0.5, 0.8 + 0.1 * k), T['boatLand'] - 0.75 + k * 0.16, 0.6, -0.2)
fx.add(glide(380, 1300, 0.26, (1.0, 0.2)) * 0.18, T['boatLand'] - 0.45)
fx.add(splash(0.8), T['boatLand'], 0.8)
fx.add(tanggu(0.9, 0.9), T['boatLand'], 0.8)
music.add(pluck('E3', 2.0, 0.5), T['boatLand'] + 0.01, 0.7)

# ───────────────────────── 故垒西边，人道是，三国周郎赤壁 ─────────────────────────
B = 0.42                                                # the current's beat, from the moment the skiff is carried off
ost = ['E4', 'B4', 'E5', 'B4', 'G4', 'B4', 'A4', 'B4']
bass = ['E3', 'B2', 'D3', 'B2']
k = 0
t0 = T['boatGo']
while t0 < T['tiltUp'] + 0.2:
    music.add(pluck(ost[k % 8], 0.5, 0.72), t0, 0.34 if k % 2 else 0.44, -0.35 if k % 2 else 0.35)
    if k % 4 == 0:
        music.add(pluck(bass[(k // 4) % 4], 0.9, 0.45), t0, 0.6)
        fx.add(tanggu(0.7 if k % 8 == 0 else 0.5, 1.0), t0, 0.6)
    if k % 2 == 1:
        fx.add(woodblock(0.36, 1.0 + 0.12 * ((k // 2) % 2)), t0, 0.45, 0.3)
    t0 += B / 2
    k += 1
fx.add(gong(196.0, 3.5, 0.4), S[3] + 0.1, 0.5, 0.4)                                    # 故垒: a bell from long ago
for j, f in enumerate((3000, 3400, 3200, 3600)):                                       # the birds go up
    fx.add(glide(f, f * 1.25, 0.07) * 0.05, T['birds'] + 0.1 + j * 0.13, pan=0.5)
# the cliff: a roll into the two characters, a great drum on each
fx.add(roll(T['carve1'] - S[5] + 0.1, 0.6, 7, 16), S[5] - 0.1, 0.7)
music.add(pad(['E2', 'B2', 'E3', 'B3'], 5.0, 0.4, 1.6, 0.35), T['carve1'] - 0.1, 0.7)
for t1, n_str, step in ((T['carve1'], 7, 0.06), (T['carve2'], 16, 0.032)):
    fx.add(dagu(1.2), t1, 0.9)
    for si in range(0, n_str, 2 if n_str > 8 else 1):                                  # the chisel
        fx.add(woodblock(0.3, 1.5 + 0.03 * si), t1 + si * step, 0.5, 0.3)
fx.add(gong(164.8, 5.0, 0.8), T['carve1'], 0.7)
chord(T['carve2'] + 0.5, ['E3', 'B3', 'E4', 'G4', 'B4', 'E5'], 0.5)

# ───────────────────────── 乱石穿空，惊涛拍岸，卷起千堆雪 ─────────────────────────
for i, name in enumerate(['E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5']):                  # one string for each rock as it thrusts up
    music.add(pluck(name, 1.4, 0.7), T['spires'] + i * 0.07, 0.42, -0.6 + 0.2 * i)
    fx.add(tanggu(0.35 + 0.05 * i, 1.3), T['spires'] + i * 0.07, 0.5)
music.add(tremolo('B4', T['slam'] - S[6] - 0.3, 13, 0.7), S[6] + 0.3, 0.2, 0.3)
music.add(tremolo('E4', T['slam'] - T['waveRise'], 13, 0.7), T['waveRise'], 0.18, -0.3)
fx.add(roll(T['slam'] - T['waveRise'], 0.6, 6, 20), T['waveRise'], 0.7)
fx.add(whoosh(T['slam'] - T['waveRise'] + 0.15, 180, 3600, 0.9), T['waveRise'], 1.0, -0.3)
# 拍
fx.add(dagu(1.2), T['slam'], 1.0)
fx.add(tanggu(0.9, 0.8), T['slam'], 0.9)
fx.add(gong(164.8, 6.0, 0.75), T['slam'], 0.85)
fx.add(splash(1.0), T['slam'], 1.0, 0.3)
m_c = int(1.4 * SR)
fx.add(noise(m_c, 400, 6000) * np.exp(-np.arange(m_c) / SR * 3.2) * 0.2, T['slam'], 1.0)   # white water
fx.add(glide(420, 1700, 0.5, (1.0, 0.2)) * 0.16, T['slam'] + 0.05)                          # the skiff goes up …
fx.add(glide(1700, 500, T['tossLand'] - T['slam'] - 0.6, (1.0, 0.2), vib=0.006) * 0.12, T['slam'] + 0.55)   # … and comes down
shimmer = ['E6', 'D6', 'B5', 'A5', 'G5', 'E5', 'D5', 'B4']
for k in range(20):                                                                     # 千堆雪: foam hanging in the air
    music.add(pluck(shimmer[k % 8] if (k // 8) % 2 == 0 else shimmer[7 - k % 8], 0.9, 0.8), T['slam'] + 0.2 + k * 0.14, 0.22, (-1) ** k * 0.6)
fx.add(splash(1.0), T['tossLand'], 0.9)
fx.add(tanggu(1.0, 0.85), T['tossLand'], 0.8)

# ───────────────────────── 江山如画，一时多少豪杰 ─────────────────────────
music.add(pad(['G3', 'D4', 'G4', 'B4'], T['pushIn0'] - T['frame0'] + 1.0, 0.7, 1.6, 0.4), T['frame0'], 0.6)   # it opens out, in the major
for k, name in enumerate(['G3', 'D4', 'G4', 'B4', 'D5', 'G5']):
    music.add(pluck(name, 2.6, 0.6), T['frame0'] + 0.1 + k * 0.16, 0.42, -0.5 + 0.2 * k)
span = max(0.8, E[10] - T['flags']) * 0.9
for i in range(34):                                                                     # a note for every flag that goes up
    music.add(pluck(G[8 + (i * 3) % 14], 0.35, 0.8), T['flags'] + (i / 34) * span, 0.2, -0.8 + 1.6 * i / 33)
# 入暮，起雾：the flute alone
music.add(pad(['E3', 'B3', 'E4'], T['ship'] - T['pushIn0'] + 1.5, 1.0, 1.5, 0.3), T['pushIn0'], 0.5)
lead.add(flute([(0.0, 0.7, 'E5'), (0.7, 0.35, 'D5'), (1.05, 0.9, 'B4'), (1.95, 0.45, 'A4'), (2.4, 0.6, 'B4')], legato=0.07, vib=0.008), E[10] + 0.3, 0.9, 0.1)
n_w = int((T['ship'] - T['pushIn0'] + 1.0) * SR)
fx.add(noise(n_w, 300, 1300) * env(n_w, 0.8, 0.8) * 0.06, T['pushIn0'], 1.0)            # the mist rising
for k in range(2):
    fx.add(dagu(0.45), T['eyesShut'] + 0.3 + k * 0.9, 0.6)                              # a heartbeat, far off

# ───────────────────────── 遥想公瑾当年，小乔初嫁了，雄姿英发 ─────────────────────────
music.add(horn([(0, 0.7, 'B3'), (0.7, 1.4, 'E4')], 1.0), T['ship'], 0.9, 0.4)           # a horn across the water
music.add(pad(['E3', 'B3', 'E4', 'G4'], T['fan'] - T['ship'] + 1.0, 0.8, 1.2, 0.35), T['ship'], 0.5)
k = 0
t0 = T['ship'] + 0.4
while t0 < T['flick'] - 0.5:                                                            # an army's drum, steady under the vision
    fx.add(tanggu(0.55 if k % 4 == 0 else 0.3, 0.9), t0, 0.55, 0.2)
    t0 += 0.5
    k += 1
for k, name in enumerate(['G5', 'B5', 'D6', 'B5']):                                     # 小乔
    music.add(pluck(name, 1.4, 0.75), T['qiao'] + 0.1 + k * 0.2, 0.3, -0.3 + 0.2 * k)
fx.add(dagu(1.1), T['proud'], 0.9)                                                      # 雄姿英发
run_up(T['proud'] + 0.02, RUN[2:14], 0.03, 0.36, 0.7, 1.6)
fx.add(gong(329.6, 3.0, 0.4), T['proud'], 0.5)
music.add(horn([(0, 0.5, 'E4'), (0.5, 0.9, 'G4')], 1.0), E[13] + 0.25, 0.9, 0.4)

# ───────────────────────── 羽扇纶巾，谈笑间，樯橹灰飞烟灭 ─────────────────────────
music.add(pluck('E5', 1.4, 0.7), T['fan'], 0.4, 0.3)
music.add(pluck('B5', 1.6, 0.7), T['fan'] + 0.18, 0.4, 0.4)
fx.add(woodblock(0.5, 1.2), T['flick'], 0.6, 0.4)                                       # one flick of the fan
fx.add(whoosh(0.3, 900, 4000, 0.5), T['flick'], 0.7, 0.4)
fx.add(glide(1300, 2500, T['ignite'] - T['flick'] - 0.1, (1.0, 0.3), vib=0.02) * 0.07, T['flick'] + 0.1, pan=0.0)   # the spark crossing
burn = T['collapse'] - T['ignite']
fx.add(whoosh(0.7, 150, 2600, 1.2), T['ignite'] - 0.1, 1.0, -0.3)                       # it catches
fx.add(dagu(1.0), T['ignite'], 0.9)
n_b = int((burn + 1.4) * SR)
fx.add(crackle(burn + 1.4, 1.0) * env(n_b, 0.3, 1.0), T['ignite'], 1.0, -0.2)
music.add(tremolo('E4', burn, 14, 0.7), T['ignite'] + 0.1, 0.2, -0.4)
music.add(tremolo('B4', burn, 15, 0.7), T['ignite'] + 0.1, 0.18, 0.4)
fx.add(roll(burn, 0.65, 6, 20), T['ignite'], 0.75)
# 灰飞烟灭
fx.add(dagu(1.6), T['collapse'], 1.0)
fx.add(gong(164.8, 7.0, 1.1), T['collapse'], 0.9)
m_c = int(0.9 * SR)
fx.add(noise(m_c, 120, 1800) * np.exp(-np.arange(m_c) / SR * 4) * 0.4, T['collapse'], 1.0, -0.3)      # masts coming down
fx.add(glide(900, 130, 1.8, (1.0, 0.3), shape=0.6) * 0.1, T['collapse'] + 0.05)
n_a = int((T['wake'] - T['collapse']) * SR)
fx.add(noise(n_a, 300, 1500) * env(n_a, 0.5, 1.2) * 0.07, T['collapse'] + 0.3, 1.0)     # only wind, and ash
lead.add(flute([(0.0, 0.9, 'B4'), (0.9, 0.4, 'A4'), (1.3, 1.3, 'E4')], legato=0.08, vib=0.008), T['night'] - 0.1, 0.8, 0.0)

# ───────────────────────── 故国神游，多情应笑我，早生华发 ─────────────────────────
n_n = int((FD - T['night']) * SR)
fx.add(water(FD - T['night'], 0.35, 300, 2000, 0.23) * env(n_n, 1.0, 3.0), T['night'], 1.0)       # a quiet river at night
music.add(pad(['E3', 'B3', 'E4', 'G4'], T['wide'] - T['wake'] + 1.0, 1.0, 1.6, 0.3), T['wake'], 0.5)
music.add(pluck('E4', 2.4, 0.55), S[17] - 0.3, 0.4, -0.3)
music.add(pluck('B4', 2.4, 0.55), E[17] + 0.15, 0.4, 0.3)
for k, name in enumerate(['G5', 'A5', 'B5']):                                           # it laughs at itself
    music.add(pluck(name, 0.4, 0.8), T['laugh'] + k * 0.2, 0.34, 0.2)
for k in range(3):                                                                      # three white hairs
    fx.add(glide(600 + k * 160, 1400 + k * 260, 0.13, (1.0, 0.2)) * 0.16, T['hair'] + k * 0.13, pan=0.1)
    fx.add(woodblock(0.4, 1.3 + 0.15 * k), T['hair'] + k * 0.13 + 0.1, 0.5, 0.1)

# ───────────────────────── 人生如梦，一尊还酹江月 ─────────────────────────
music.add(pad(['E3', 'B3', 'E4', 'G4', 'B4'], T['write0'] - T['wide'] + 0.6, 1.0, 1.8, 0.4), T['wide'], 0.6)
for k, name in enumerate(['E3', 'B3', 'E4', 'G4', 'B4', 'E5']):                         # the moon
    music.add(pluck(name, 3.0, 0.6), T['wide'] + 0.1 + k * 0.15, 0.4, -0.5 + 0.2 * k)
music.add(tremolo('B5', E[20] - S[20] + 0.3, 11, 0.8, swell=False), S[20], 0.08, 0.5)   # 如梦
music.add(pluck('B4', 2.0, 0.6), T['cup'], 0.4, 0.2)
music.add(pluck('E5', 2.4, 0.6), T['cup'] + 0.3, 0.4, 0.3)
n_p = int((T['pourEnd'] - T['pour'] + 0.3) * SR)                                        # the wine, into the river
tp = np.arange(n_p) / SR
fx.add(noise(n_p, 1500, 6000) * (0.5 + 0.5 * np.sin(2 * np.pi * 17 * tp)) * env(n_p, 0.08, 0.25) * 0.09, T['pour'] + 0.2, 1.0, 0.3)
for k, f in enumerate((1500, 1900, 1300, 2100, 1700)):
    fx.add(glide(f, f * 1.9, 0.05) * 0.06, T['pour'] + 0.45 + k * 0.13, pan=0.3)
for k, name in enumerate(['E5', 'B4', 'G4']):                                           # rings going out
    music.add(pluck(name, 3.0, 0.55), T['pour'] + 0.6 + k * 0.32, 0.36, 0.3 - 0.3 * k)
lead.add(flute([(0.0, 0.5, 'B4'), (0.5, 1.1, 'E5')], legato=0.08, vib=0.008), T['pourEnd'] - 0.1, 0.6, 0.0)
fx.add(glide(420, 1500, 0.34, (1.0, 0.2)) * 0.2, T['hop'], pan=0.2)
music.add(pluck('B5', 1.4, 0.7), T['hop'], 0.5)

# the last line: a string, and its octave, on each character as it is spoken
music.add(pad(['E3', 'B3', 'E4'], FD - T['write0'] + 0.5, 0.4, 2.2, 0.3), T['write0'] - 0.3, 0.45)
on = T['charOn']
for ci, (t0, name) in enumerate(zip(on, ['E4', 'G4', 'B4', 'D5', 'E5', 'G5'])):
    pan = -0.6 + 1.2 * ci / max(1, len(on) - 1)
    music.add(pluck(name, 2.2, 0.62), t0, 0.4, pan)
    music.add(pluck(G[G.index(name) - 5], 2.2, 0.5), t0, 0.22, -pan)
for s in T['strokes']:                                                                  # the brush on paper
    m = int(max(0.03, s['t1'] - s['t0']) * SR)
    fx.add(noise(m, 1200, 6500) * np.sin(np.pi * np.arange(m) / m) * 0.06, s['t0'], 1.0, -0.6 + 1.2 * s['ci'] / max(1, len(on) - 1))
music.add(pluck('E6', 1.8, 0.7), T['write1'], 0.5, 0.5)
fx.add(glide(500, 1500, 0.28, (1.0, 0.2)) * 0.18, T['sealJump'], pan=0.5)

# the seal
fx.add(dagu(1.5), T['stamp'], 1.0, 0.3)
fx.add(gong(164.8, 5.0, 0.85), T['stamp'], 0.8, 0.2)
chord(T['stamp'] + 0.02, ['E3', 'B3', 'E4', 'G4', 'B4', 'E5'], 0.55)
music.add(pluck('B5', 1.6, 0.7), T['credit'], 0.3, -0.3)
music.add(pluck('E6', 2.2, 0.7), T['credit'] + 0.16, 0.34, 0.3)
lead.add(flute([(0.0, 0.34, 'B5'), (0.36, 1.1, 'E6')], legato=0.08, vib=0.008), T['credit'] + 0.25, 0.5, 0.0)

finish([
    ('落纸', 0, T['bloom']),
    ('大江', T['bloom'], T['boatGo']),
    ('赤壁', T['boatGo'], S[6]),
    ('惊涛', S[6], T['frame0']),
    ('如画', T['frame0'], T['ship']),
    ('公瑾', T['ship'], T['fan']),
    ('烟灭', T['fan'], T['night']),
    ('华发', T['night'], T['wide']),
    ('江月', T['wide'], T['write0']),
    ('落款', T['write0'], FD),
])
