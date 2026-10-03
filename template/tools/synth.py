"""Sound kit for a poem film: every instrument is computed here with numpy — no samples, no services.

A film's own film/score.py imports this, places notes and effects on four buses at the times in
build/timing.json, and calls finish(). The recitation (audio/voice/*.wav, cut by film.py voice)
is placed and mixed here: under the voice the music drops and the flute nearly leaves.

    from synth import *
    music.add(pluck('D4'), T['bloom'])        # times are on the film's own clock
    finish([('A', 0, T['bloom']), ...])       # → assets/score.wav, plus a printed self-check
"""
import json, re, subprocess, wave
from pathlib import Path
import numpy as np

SR = 48000
ROOT = Path(__file__).resolve().parent.parent
T = json.loads((ROOT / 'build' / 'timing.json').read_text())
POEM = json.loads((ROOT / 'poem.json').read_text())
OFF = T.get('intro', 0.0)          # the cover: everything is timed on the film's clock and shifted by this
FD = T['dur']                      # the film's own length
DUR = T.get('total', OFF + FD)     # the composition's length
VOICE = T.get('hasVoice', False)   # False for a dry run: no recitation is mixed
N = int((DUR + 4) * SR)
rng = np.random.default_rng(701)

NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def hz(n):
    return 440.0 * 2 ** ((NOTE[n[:-1]] + 12 * (int(n[-1]) + 1) - 69) / 12)


# D 宫 pentatonic, low to high
SCALE = [n + str(o) for o in (2, 3, 4, 5, 6) for n in ('D', 'E', 'F#', 'A', 'B')]


class Bus:
    def __init__(self):
        self.l = np.zeros(N)
        self.r = np.zeros(N)

    def add(self, sig, t, gain=1.0, pan=0.0):
        i = int(round((t + OFF) * SR))
        if i < 0:
            sig = sig[-i:]
            i = 0
        n = min(len(sig), N - i)
        if n <= 0:
            return
        a = (pan + 1) * np.pi / 4          # equal-power pan, -1 left … +1 right
        self.l[i:i + n] += sig[:n] * gain * np.cos(a)
        self.r[i:i + n] += sig[:n] * gain * np.sin(a)


music, lead, fx, voice = Bus(), Bus(), Bus(), Bus()   # lead = the flute, which steps aside for the voice


# ── building blocks ──
def env(n, a, r, hold=1.0):
    e = np.full(n, hold)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 1.4 * hold
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.3
    return e


def noise(n, lo=None, hi=None):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    y = np.fft.irfft(X * m, n)
    return y / (np.abs(y).max() + 1e-9)


def pluck(note, dur=1.8, bright=0.6):
    """A plucked silk/steel string (guzheng-like): fast attack, upper partials die first."""
    f = hz(note) if isinstance(note, str) else note
    n = int(dur * SR)
    t = np.arange(n) / SR
    bend = 1 + 0.006 * np.exp(-t * 26)                    # the pitch settles after the pluck
    ph = 2 * np.pi * f * np.cumsum(bend) / SR
    out = np.zeros(n)
    for h in range(1, 16):
        if f * h > 9500:
            break
        amp = (1 / h ** (1.55 - 0.6 * bright)) * (0.55 + 0.45 * np.cos(h * 1.7) ** 2)
        dec = 1.7 + h * (1.5 - bright) * 1.1
        out += amp * np.sin(h * ph * (1 + 0.00035 * h * h)) * np.exp(-t * dec)
    out *= 1 - np.exp(-t * 1400)
    out += noise(n, 1500, 7000) * np.exp(-t * 260) * 0.22  # the nail on the string
    out *= env(n, 0.0, min(0.12, dur * 0.3))
    return out * 0.5


def flute(notes, legato=0.045, vib=0.006, breath=0.05):
    """Bamboo flute phrase. notes: [(start, dur, name)], times relative to the phrase start."""
    end = max(s + d for s, d, _ in notes) + 0.25
    n = int(end * SR)
    t = np.arange(n) / SR
    freq = np.zeros(n)
    amp = np.zeros(n)
    last = None
    for s, d, name in notes:
        a, b = int(s * SR), min(n, int((s + d) * SR))
        f = hz(name)
        freq[a:b] = f
        k = min(int(legato * SR), b - a)
        if last is not None and k > 0:                    # slide in from the previous pitch
            freq[a:a + k] = np.geomspace(last, f, k)
        amp[a:b] = env(b - a, 0.05, 0.09)
        last = f
    # hold frequency through the gaps so the phase stays continuous
    idx = np.where(freq > 0, np.arange(n), 0)
    np.maximum.accumulate(idx, out=idx)
    freq = np.where(freq > 0, freq, freq[idx])
    freq[freq == 0] = hz(notes[0][2])
    v = np.zeros(n)                                        # vibrato comes in after each note has settled
    for s, d, _ in notes:
        a, b = int(s * SR), min(n, int((s + d) * SR))
        v[a:b] = np.clip((np.arange(b - a) / SR - 0.12) / 0.25, 0, 1)
    f2 = freq * (1 + vib * v * np.sin(2 * np.pi * 5.6 * t))
    ph = 2 * np.pi * np.cumsum(f2) / SR
    out = np.sin(ph) + 0.42 * np.sin(2 * ph + 0.4) + 0.2 * np.sin(3 * ph + 1.1) + 0.09 * np.sin(4 * ph) + 0.05 * np.sin(5 * ph)
    out *= amp
    out += noise(n, 1800, 7000) * amp * breath * 3.0
    return out * 0.22


def tanggu(level=1.0, pitch=1.0):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum((88 + 84 * np.exp(-t * 26)) * pitch) / SR) * np.exp(-t * 7.5)
    skin = np.sin(2 * np.pi * 212 * pitch * t) * np.exp(-t * 16) * 0.45
    return (body * 0.62 + skin + noise(n, 300, 3500) * np.exp(-t * 70) * 0.4) * level * 0.7


def woodblock(level=1.0, pitch=1.0):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 980 * pitch * t) + 0.5 * np.sin(2 * np.pi * 1570 * pitch * t)) * np.exp(-t * 55) * level * 0.5


def gong(f=73.4, dur=5.0, level=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, a, d in ((1, 1.0, 0.9), (1.48, 0.55, 1.2), (2.02, 0.5, 1.5), (2.74, 0.32, 2.0), (3.01, 0.28, 2.4), (4.1, 0.2, 3.2), (5.43, 0.12, 4.0)):
        out += a * np.sin(2 * np.pi * f * ratio * (1 - 0.012 * (1 - np.exp(-t * 3))) * t + ratio) * np.exp(-t * d)
    out *= 1 - np.exp(-t * 60)
    return out * level * 0.3


def glide(f0, f1, dur, harmonics=(1.0,), vib=0.0, shape=1.0):
    """A sine that slides from f0 to f1 — whistles, whoops, the falling dot."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (f1 / f0) ** ((t / dur) ** shape)
    f *= 1 + vib * np.sin(2 * np.pi * 7 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return sum(a * np.sin((k + 1) * ph) for k, a in enumerate(harmonics)) * env(n, 0.02, dur * 0.35)


def hoot(base=520.0):
    """A gibbon's rising whoop: three calls, each sliding up, the last the highest."""
    out = np.zeros(int(0.9 * SR))
    for k, (d, lift) in enumerate(((0.0, 1.0), (0.2, 1.12), (0.4, 1.3))):
        n = int(0.21 * SR)
        t = np.arange(n) / SR
        f = base * lift * (1 + 0.55 * (t / 0.21) ** 0.7) * (1 + 0.012 * np.sin(2 * np.pi * 11 * t))
        ph = 2 * np.pi * np.cumsum(f) / SR
        call = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.22 * np.sin(3 * ph) + 0.08 * np.sin(4 * ph)) * env(n, 0.035, 0.07)
        i = int(d * SR)
        out[i:i + n] += call * (0.8 + 0.1 * k)
    return out * 0.2


def whoosh(dur, f0=300, f1=4000, level=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    # sweep upward by crossfading a low band into a high one
    lo = noise(n, f0, f0 * 3)
    hi = noise(n, f1 * 0.5, f1)
    k = (t / dur) ** 1.5
    return (lo * (1 - k) + hi * k) * np.sin(np.pi * t / dur) ** 1.5 * level * 0.5


def splash(level=1.0):
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    body = noise(n, 500, 6000) * (np.exp(-t * 7) * (1 - np.exp(-t * 180)))
    low = np.sin(2 * np.pi * np.cumsum(90 + 60 * np.exp(-t * 20)) / SR) * np.exp(-t * 11) * 0.8
    drops = np.zeros(n)
    for _ in range(14):
        i = int(rng.uniform(0.12, 0.8) * SR)
        m = int(0.05 * SR)
        tt = np.arange(m) / SR
        f = rng.uniform(900, 2600)
        drops[i:i + m] += np.sin(2 * np.pi * f * (1 + 2.5 * tt) * tt) * np.exp(-tt * 70) * 0.25
    return (body * 0.7 + low + drops) * level * 0.5


def pad(notes, dur, attack=0.8, release=1.5, bright=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for name in notes:
        f = hz(name)
        for det in (-0.08, 0.0, 0.07):
            ff = f * (1 + det / 100)
            vibr = 1 + 0.002 * np.sin(2 * np.pi * (4.6 + det) * t + det * 30)
            ph = 2 * np.pi * ff * np.cumsum(vibr) / SR
            for h in range(1, int(5 + bright * 8)):
                if ff * h > 6000:
                    break
                out += np.sin(h * ph + rng.random() * 6.28) / h ** (1.5 - 0.4 * bright)
    return out / (3 * len(notes)) * env(n, attack, release) * 0.5


def reverb(x, secs=1.9, mix=0.24):
    n = int(secs * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 3.6)
    ir[: int(0.014 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum())
    nfft = 1 << (len(x) + n - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return x * (1 - mix) + wet * mix * 2.6



def horn(notes, level=1.0):
    """A war horn heard across water (号角). notes: [(start, dur, name)]; each one swells in and scoops up to pitch."""
    end = max(s0 + d for s0, d, _ in notes) + 0.3
    n = int(end * SR)
    out = np.zeros(n)
    for s0, d, name in notes:
        m = int(d * SR)
        t = np.arange(m) / SR
        f = hz(name) * (1 - 0.03 * np.exp(-t * 9)) * (1 + 0.004 * np.sin(2 * np.pi * 5 * t))
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = sum(np.sin(h * ph) / h ** 0.9 for h in range(1, 9)) * env(m, min(0.25, d * 0.35), min(0.4, d * 0.4))
        i = int(s0 * SR)
        out[i:i + m] += x[: n - i]
    return out * 0.07 * level


def dagu(level=1.0):
    """A big war drum: lower and longer than the tanggu."""
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(74 + 64 * np.exp(-t * 22)) / SR) * np.exp(-t * 4.5)
    skin = np.sin(2 * np.pi * 156 * t) * np.exp(-t * 12) * 0.45
    return (body * 0.6 + skin + noise(n, 200, 2500) * np.exp(-t * 50) * 0.45) * level * 0.7


def roll(dur, level=1.0, start=7.0, end=18.0, pitch=1.0):
    """A drum roll that tightens and swells: from `start` to `end` strokes a second."""
    n = int((dur + 1.0) * SR)
    out = np.zeros(n)
    t = 0.0
    while t < dur:
        u = t / dur
        hit = tanggu(0.25 + 0.75 * u ** 1.5, pitch * (1.2 - 0.2 * u))
        i = int(t * SR)
        out[i:i + len(hit)] += hit[: n - i]
        t += 1.0 / (start + (end - start) * u)
    return out * level


def tremolo(note, dur, rate=14.0, bright=0.7, swell=True):
    """Fast repeated plucks on one string (轮指) — tension."""
    n = int((dur + 1.2) * SR)
    out = np.zeros(n)
    t = 0.0
    while t < dur:
        p = pluck(note, 0.5, bright) * ((0.35 + 0.65 * t / dur) if swell else 1.0)
        i = int(t * SR)
        out[i:i + len(p)] += p[: n - i]
        t += 1.0 / rate
    return out


def crackle(dur, level=1.0):
    """Fire: a low roar with sparks of noise."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    roar = noise(n, 90, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t + 1))
    pops = np.zeros(n)
    for _ in range(int(dur * 28)):
        i = int(rng.uniform(0, max(0.05, dur - 0.03)) * SR)
        m = min(int(rng.uniform(0.004, 0.02) * SR), n - i)
        if m > 0:
            pops[i:i + m] += rng.standard_normal(m) * np.exp(-np.arange(m) / m * 4) * rng.uniform(0.3, 1.0)
    return (roar * 0.5 + pops * 0.5) * level * 0.3


def water(dur, level=1.0, lo=250, hi=3200, rate=0.5):
    """A river going by: band noise that swells and falls slowly."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    return noise(n, lo, hi) * (0.7 + 0.3 * np.sin(2 * np.pi * rate * t)) * level * 0.1


def scale(root='D', octaves=(2, 3, 4, 5, 6)):
    """A 宫调 pentatonic scale (1 2 3 5 6) on `root`, low to high, as note names."""
    names = sorted(NOTE, key=NOTE.get)
    flat = [n for n in names if len(n) == 1 or n.endswith('#')]
    i = flat.index(root)
    steps = [flat[(i + k) % 12] for k in (0, 2, 4, 7, 9)]
    out = []
    for o in octaves:
        for k, name in zip((0, 2, 4, 7, 9), steps):
            out.append(name + str(o + (i + k) // 12))
    return out


# ───────────────────────── 朗诵 ─────────────────────────
def load_voice(name):
    with wave.open(str(ROOT / 'audio' / 'voice' / f'{name}.wav')) as w:
        return np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768


def smooth(x, secs):
    k = max(1, int(secs * SR))
    return np.convolve(x, np.ones(k) / k, mode='same')


def highpass(x, fc=55.0):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (fc / np.maximum(f, 1e-6)) ** 6), len(x))


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def voice_lines():
    """(piece name, start on the film's clock) for the title, the poet, and every line."""
    n = len(POEM['lines'])
    return [('title', T['vTitle']), ('author', T['vAuthor'])] + [(f'l{i + 1}', v) for i, v in enumerate(T['v'])] + [(f'l{n}', T['vFinal'])]


def place_voice():
    lines = voice_lines()
    parts = {name: load_voice(name) for name, _ in lines}
    # even out the performance a little (soft syllables up, loud ones down) without flattening it
    ref = np.sqrt(np.mean(np.concatenate(list(parts.values())) ** 2))
    lifts = (POEM.get('voice') or {}).get('lift')
    for name, t0 in lines:
        x = parts[name]
        level = np.sqrt(smooth(x ** 2, 0.12)) + 1e-5
        g = np.clip((ref / level) ** 0.4, 0.5, 2.4)
        g[level < ref * 0.06] = 1.0                      # leave breaths and room tone alone
        if lifts is not None:
            lift = lifts.get(name, 1.0)                  # set by ear in poem.json: voice.lift
        else:                                            # softly spoken pieces come forward a little
            lift = float(np.clip((ref / (np.sqrt(np.mean(x ** 2)) + 1e-9)) ** 0.5, 0.85, 1.5))
        voice.add(x * smooth(g, 0.05) * lift, t0 - 0.02, 1.0, 0.0)   # each piece carries 20 ms of pre-roll
    return lines, parts


# ───────────────────────── mix ─────────────────────────
OUT = ROOT / 'assets' / 'score.wav'


def _write(l, r):
    pcm = (np.stack([l, r], axis=1) * 32767).clip(-32768, 32767).astype('<i2')
    with wave.open(str(OUT), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def lufs(path=None):
    log = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path or OUT), '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', log)[-1])


def finish(sections=None, target_lufs=-16.0):
    """Place the recitation, mix the buses, write assets/score.wav, and print a self-check.

    sections: [(name, start, end)] on the film's clock, for the level report.
    The check stands in for ears: nobody has listened when this runs, so read the numbers.
    """
    n_out = int(round(DUR * SR))
    lines, parts = place_voice() if VOICE else ([], {})
    ml, mr = reverb(music.l, 2.0, 0.26), reverb(music.r, 2.0, 0.26)
    ll, lr = reverb(lead.l, 2.0, 0.26), reverb(lead.r, 2.0, 0.26)
    fl, fr = reverb(fx.l, 1.3, 0.12), reverb(fx.r, 1.3, 0.12)
    bed_l, bed_r = ml + fl * 0.9, mr + fr * 0.9
    if VOICE:
        v = reverb(voice.l + voice.r, 1.1, 0.09) / np.sqrt(2)          # a little of the same room
        v = highpass(v, 70.0)
        # how present the voice is at each moment, opened 0.12 s early and released slowly
        act = np.sqrt(smooth((voice.l + voice.r) ** 2, 0.06))
        act = np.clip(act / (act.max() * 0.12), 0, 1)
        look = int(0.12 * SR)
        act = np.maximum(act, np.concatenate([act[look:], np.zeros(look)]))
        hold = np.zeros_like(act)
        k = np.exp(-1 / (0.32 * SR))
        lvl = 0.0
        for i in range(len(act)):                                       # one-pole release
            lvl = act[i] if act[i] > lvl else lvl * k
            hold[i] = lvl
        duck = smooth(hold, 0.05)
        # the voice sits about 19 dB below full scale; under it the bed drops 9 dB and the flute nearly leaves
        spoken = duck[:n_out] > 0.5
        vgain = 10 ** ((-19.0 - rms_db(v[:n_out][spoken])) / 20)
        bed_gain = 10 ** ((-24.5 - rms_db(((bed_l + bed_r) / 2)[:n_out])) / 20)
        left = (bed_l * (1 - 0.66 * duck) + ll * (1 - 0.88 * duck)) * bed_gain + v * vgain
        right = (bed_r * (1 - 0.66 * duck) + lr * (1 - 0.88 * duck)) * bed_gain + v * vgain
    else:
        left, right = bed_l + ll, bed_r + lr
    left, right = highpass(left[:n_out]), highpass(right[:n_out])
    fade = int(0.9 * SR)
    ramp = np.linspace(1, 0, fade) ** 1.4
    left[-fade:] *= ramp
    right[-fade:] *= ramp
    peak = max(np.abs(left).max(), np.abs(right).max())
    gain = 0.92 / peak
    left = np.tanh(left * gain * 1.25) / np.tanh(1.25)
    right = np.tanh(right * gain * 1.25) / np.tanh(1.25)
    top = max(np.abs(left).max(), np.abs(right).max())
    left *= 0.73 / top
    right *= 0.73 / top

    # land the whole mix on the target loudness (what the platforms normalise to), keeping 1 dB of headroom
    _write(left, right)
    measured = lufs()
    fix = min(10 ** ((target_lufs - measured) / 20), 0.89 / max(np.abs(left).max(), np.abs(right).max()))
    left, right = left * fix, right * fix
    _write(left, right)

    mono = (left + right) / 2
    assert np.isfinite(mono).all()
    report = {'file': OUT.name, 'seconds': round(DUR, 3), 'lufs': lufs(), 'peak_dbfs': round(20 * np.log10(max(np.abs(left).max(), np.abs(right).max())), 1), 'sections': [], 'voice': []}
    print(f"{OUT.name}: {DUR:.2f}s, {report['lufs']:.1f} LUFS, peak {report['peak_dbfs']:.1f} dBFS")
    secs = ([('cover', -OFF, 0)] if OFF else []) + list(sections or [('film', 0, FD)])
    bands = [(60, 150), (150, 500), (500, 2000), (2000, 6000)]
    for name, a, b in secs:
        seg = mono[int((a + OFF) * SR):int((b + OFF) * SR)]
        if len(seg) < SR // 10:
            continue
        P = np.abs(np.fft.rfft(seg)) ** 2
        f = np.fft.rfftfreq(len(seg), 1 / SR)
        share = [round(100 * P[(f >= lo) & (f < hi)].sum() / P.sum()) for lo, hi in bands]
        report['sections'].append({'name': name, 'from': round(a + OFF, 2), 'to': round(b + OFF, 2), 'rms_db': round(rms_db(seg), 1), 'bands_pct': share})
        warn = '  ← 低频过重（鼓/锣太大，旋律会显得小）' if share[0] > 45 else ''
        print(f"  {name:6s} {a + OFF:5.2f}–{b + OFF:5.2f}s  rms {rms_db(seg):6.1f} dB   60–150Hz {share[0]:2d}%  150–500 {share[1]:2d}%  500–2k {share[2]:2d}%  2k–6k {share[3]:2d}%{warn}")
    if VOICE:
        # how far the voice stands above everything else while it is speaking
        vv = (v * vgain * fix)[:n_out]
        rest = mono - vv
        print('  voice over bed while speaking (aim for 9 dB or more):')
        for name, t0 in lines:
            a = int((t0 + OFF) * SR)
            b = a + len(parts[name])
            on = np.sqrt(smooth(vv[a:b] ** 2, 0.03)) > 10 ** (-38 / 20)      # only the moments with speech in them
            margin = rms_db(vv[a:b][on]) - rms_db(rest[a:b][on])
            report['voice'].append({'piece': name, 'at': round(t0 + OFF, 2), 'voice_db': round(rms_db(vv[a:b][on]), 1), 'bed_db': round(rms_db(rest[a:b][on]), 1), 'margin_db': round(margin, 1)})
            print(f"    {name:6s} at {t0 + OFF:5.2f}s  voice {rms_db(vv[a:b][on]):6.1f} dB   bed {rms_db(rest[a:b][on]):6.1f} dB   margin {margin:5.1f} dB{'  ← 人声被盖住' if margin < 7 else ''}")
    (ROOT / 'build' / 'score_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
    return report
