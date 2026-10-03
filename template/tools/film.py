#!/usr/bin/env python3
"""One entry for a poem film. Run it from the project directory.

  python3 tools/film.py glyphs          stroke data for every character the film writes → assets/glyphs.js
  python3 tools/film.py voice --dry     no synthesis: estimate how long each line takes, so scenes can be timed for free
  python3 tools/film.py voice           recite the poem (cached), cut it into title / poet / lines → assets/voice.js
  python3 tools/film.py voice --plan    list what a real run would synthesize (how many paid calls), without doing it
  python3 tools/film.py voice --spec    also draw spectrograms of every line, to mark where each character starts
  python3 tools/film.py timing          poem.json + film/timing.js → build/timing.json, and the length in index.html
  python3 tools/film.py score           run film/score.py → assets/score.wav, with a printed self-check
  python3 tools/film.py build           glyphs + timing + score (after any change to the poem, the timing or the voice)
  python3 tools/film.py qa              project check, frames at every event, contact sheets, automatic frame checks
  python3 tools/film.py render          check → render → verify → upload copy, cover, contact sheet, numbers
  python3 tools/film.py log "note"      a timestamped line in logs/PRODUCTION_LOG.md
  python3 tools/film.py stats           minutes worked and tokens used, read from the agent's session record

poem.json is the single source for the words; film/timing.js for when things happen; film/scenes.js for the picture;
film/score.py for the music. Everything under assets/ and build/ is generated.
"""
import argparse, datetime, hashlib, importlib.util, json, os, re, shutil, subprocess, sys, wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
CJK = re.compile(r'[\u3400-\u9fff]')


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def out(cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def poem():
    p = json.loads((ROOT / 'poem.json').read_text())
    for key in ('title', 'author', 'lines'):
        if not p.get(key):
            sys.exit(f'poem.json: "{key}" is missing')
    p.setdefault('prefix', '')                          # 词牌名：念奴娇 · 赤壁怀古 → prefix 念奴娇, title 赤壁怀古
    p.setdefault('seal', p['author'][:2])
    p.setdefault('credit', ['全片代码绘制', '配乐代码合成'])
    p.setdefault('voice', {})
    p.setdefault('fps', 30)
    n = len(p['lines'])
    if 'punct' not in p:
        p['punct'] = ['。' if i % 2 or i == n - 1 else '，' for i in range(n)]
    return p


def timing():
    f = ROOT / 'build' / 'timing.json'
    if not f.exists():
        sys.exit('no build/timing.json yet — run: python3 tools/film.py timing')
    return json.loads(f.read_text())


def chars(text):
    return CJK.findall(text)


# ── glyphs ───────────────────────────────────────────────────────────────────
def cmd_glyphs(args):
    p = poem()
    src = ROOT / 'node_modules' / 'hanzi-writer-data'
    if not src.exists():
        sys.exit('stroke data is not installed — run in the project:  npm i hanzi-writer-data')
    text = p['prefix'] + p['title'] + p['author'] + ''.join(p['lines']) + p['seal'] + ''.join(p['credit']) + p.get('creditVoice', '') + (p.get('tagline') or '') + p.get('glyphs', '')
    need = sorted(set(chars(text)))
    data, missing = {}, []
    for ch in need:
        f = src / f'{ch}.json'
        if not f.exists():
            missing.append(ch)
            continue
        j = json.loads(f.read_text())
        data[ch] = {'s': j['strokes'], 'm': j['medians']}
    if missing:
        sys.exit(f'no stroke data for: {"".join(missing)} — the film cannot write these characters; reword, or draw them yourself')
    (ROOT / 'assets').mkdir(exist_ok=True)
    (ROOT / 'assets' / 'glyphs.js').write_text('// stroke outlines and medians from hanzi-writer-data (Make Me a Hanzi; Arphic Public License)\nwindow.GLYPHS = ' + json.dumps(data, ensure_ascii=False) + ';\n')
    lic = src / 'ARPHICPL.TXT'
    if lic.exists():
        shutil.copy(lic, ROOT / 'assets' / 'GLYPHS-LICENSE-ARPHICPL.txt')
    print(f'{len(data)} glyphs → assets/glyphs.js')


# ── voice ────────────────────────────────────────────────────────────────────
# Built in:  dry      nothing is synthesized; line lengths are estimated (use --dry)
#            say      macOS system voice (free, offline, robotic — fine for checking the pipeline)
#            edge     the edge-tts command line tool, if installed
#            command  any CLI: voice.command is a shell template with {text} and {out}
#            auto     edge if edge-tts is on PATH, else say on macOS
# Your own:  put  tts_<name>.py  in ~/.config/code-poem-film/ (or $CODE_POEM_FILM_HOME) with a function
#            synth(text, voice, out_path)  that writes an audio file; then "provider": "<name>" in poem.json.
#            A paid cloud voice and its credentials belong there — never in the project.
#            (Plug-ins written for code-doc-film in ~/.config/code-doc-film/ are found too.)
CONFIG_HOMES = [Path(os.environ.get('CODE_POEM_FILM_HOME', Path.home() / '.config' / 'code-poem-film')), Path.home() / '.config' / 'code-doc-film']


def tts_say(text, voice, out_mp3):
    if sys.platform != 'darwin' or not shutil.which('say'):
        sys.exit('voice provider "say" needs macOS. Use "edge", "command" or your own plug-in (see references/audio.md).')
    aiff = Path(str(out_mp3) + '.aiff')
    sh(['say', '-v', voice.get('id') or 'Tingting', '-r', str(round(175 * float(voice.get('speed', 1.0)))), '-o', str(aiff), text])
    sh(['ffmpeg', '-v', 'error', '-y', '-i', str(aiff), str(out_mp3)])
    aiff.unlink()


def tts_edge(text, voice, out_mp3):
    if not shutil.which('edge-tts'):
        sys.exit('voice provider "edge" needs the edge-tts command (pip install edge-tts).')
    pct = round((float(voice.get('speed', 1.0)) - 1) * 100)
    sh(['edge-tts', '--voice', voice.get('id') or 'zh-CN-YunxiNeural', f'--rate={pct:+d}%', '--text', text, '--write-media', str(out_mp3)])


def tts_command(text, voice, out_mp3):
    sh(voice['command'].format(text=text.replace('"', '\\"'), out=str(out_mp3)), shell=True)


def tts_auto(text, voice, out_mp3):
    return (tts_edge if shutil.which('edge-tts') else tts_say)(text, voice, out_mp3)


BUILTIN_TTS = {'auto': tts_auto, 'say': tts_say, 'edge': tts_edge, 'command': tts_command}


def tts_provider(name):
    if name in BUILTIN_TTS:
        return BUILTIN_TTS[name]
    for home in CONFIG_HOMES:
        plug = home / f'tts_{name}.py'
        if plug.exists():
            spec = importlib.util.spec_from_file_location(f'tts_{name}', plug)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod.synth
    sys.exit(f'unknown voice provider "{name}": no built-in of that name and no tts_{name}.py in {CONFIG_HOMES[0]}')


def voice_groups(p):
    """What is synthesized together, as [(text, [(piece, syllables), …]), …].

    A short poem goes in one call, so the reading flows from the title to the last line (and costs one call).
    A long one goes sentence by sentence: cutting twenty short clauses out of one long recording by their pauses
    is unreliable, and a wrong cut cannot be heard by whoever is building the film.

    Characters with two readings are swapped for unambiguous homophones (poem.json "say", or a whole line in
    "sayLines"), so the reading is right by construction; the picture always shows the original characters."""
    say = p.get('say') or {}
    over = p.get('sayLines') or []

    def fix(s):
        return ''.join(say.get(ch, ch) for ch in s)

    lines = [over[i] if i < len(over) and over[i] else fix(line) for i, line in enumerate(p['lines'])]
    head = (fix(p['prefix']) + '，' if p['prefix'] else '') + fix(p['title']) + '。' + fix(p['author']) + '。'
    head_parts = [('title', len(chars(p['prefix'] + p['title']))), ('author', len(chars(p['author'])))]
    line_parts = [(f'l{i + 1}', len(chars(l))) for i, l in enumerate(p['lines'])]
    mode = p['voice'].get('split') or 'auto'
    if mode == 'auto':
        mode = 'sentence' if len(lines) > 8 else 'whole'
    if mode == 'whole':
        return [(head + ''.join(l + pu for l, pu in zip(lines, p['punct'])), head_parts + line_parts)]
    groups, text, parts = [(head, head_parts)], '', []
    for l, pu, part in zip(lines, p['punct'], line_parts):
        text += l + pu
        parts.append(part)
        if pu in '。！？；':
            groups.append((text, parts))
            text, parts = '', []
    if parts:
        groups.append((text, parts))
    return groups


def parts_of(p):
    return [('title', len(chars(p['prefix'] + p['title']))), ('author', len(chars(p['author'])))] + [(f'l{i + 1}', len(chars(l))) for i, l in enumerate(p['lines'])]


def load_wav(path):
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768


def envelope(x, hop=480, win=1200):
    n = max(1, (len(x) - win) // hop)
    return np.array([np.sqrt((x[i * hop:i * hop + win] ** 2).mean()) for i in range(n)])


def segment(x, parts):
    """Cut at the dips that best match where the punctuation falls, by share of voiced time.
    A comma between two lines can be read with almost no pause, so this looks for the deepest dip
    near each expected boundary rather than for outright silence."""
    hop = 480 / SR
    e = envelope(x)
    db = 20 * np.log10(e / e.max() + 1e-9)
    db = np.convolve(db, np.ones(3) / 3, mode='same')
    voiced = db > -26
    first = int(np.argmax(voiced))
    last = len(voiced) - int(np.argmax(voiced[::-1]))
    cum = np.cumsum(voiced) / max(1, voiced[first:last].sum())
    cand = [i for i in range(first + 5, last - 5) if db[i] < -9 and db[i] == db[max(first, i - 12):i + 13].min()]
    total = sum(s for _, s in parts)
    want = np.cumsum([s for _, s in parts])[:-1] / total
    cuts = []
    for k, w in enumerate(want):
        near = [i for i in cand if abs(cum[i] - w) < 0.06 and i not in cuts]
        if not near:
            sys.exit(f'could not find the break after "{parts[k][0]}" in the recording (expected near {w:.0%} of the speech). '
                     'Try a slower speed, or stronger punctuation: set "punct" to all "。" in poem.json.')
        cuts.append(min(near, key=lambda i: db[i] + 400 * abs(cum[i] - w)))
    cuts.sort()
    bounds = [first]
    for c in cuts:
        floor = max(db[c] + 8, -26) if db[c] > -34 else -26     # the dip's own walls, or true silence
        a = c
        while a > first and db[a - 1] < floor:
            a -= 1
        b = c
        while b < last and db[b + 1] < floor:
            b += 1
        bounds += [a, b + 1]
    bounds.append(last)
    segs = []
    for k, (name, syl) in enumerate(parts):
        a, b = bounds[2 * k], bounds[2 * k + 1]
        segs.append({'name': name, 'syl': syl, 't0': round(a * hop, 3), 't1': round(b * hop + 0.025, 3)})
    return segs, db


def inner_pauses(db, seg, floor=-27, min_len=0.06):
    a, b = int(seg['t0'] * 100), int(seg['t1'] * 100)
    low = db[a:b] < floor
    res, i = [], 0
    while i < len(low):
        if low[i]:
            j = i
            while j < len(low) and low[j]:
                j += 1
            if (j - i) * 0.01 >= min_len and i > 5 and j < len(low) - 5:
                res.append([round(i * 0.01, 2), round(j * 0.01, 2)])
            i = j
        else:
            i += 1
    return res


def spectrogram(x, path, label=''):
    """A picture of one line: time left to right (a tick every 0.1 s, a number every 0.5 s), pitch bottom to top
    (0–7 kHz). Vowels are stacks of bright bands, q / zh / ch / sh / s / x are tall columns of noise, a stop or a
    pause is a dark gap. Read it to find where each character starts."""
    from PIL import Image, ImageDraw
    win, hopn = 1024, 96                                   # 2 ms per column
    cols = max(1, (len(x) - win) // hopn)
    f_hi = int(7000 / (SR / win))
    S = np.empty((f_hi, cols))
    w = np.hanning(win)
    for i in range(cols):
        S[:, i] = np.abs(np.fft.rfft(x[i * hopn:i * hopn + win] * w))[:f_hi]
    S = 20 * np.log10(S / S.max() + 1e-6)
    S = np.clip((S + 72) / 72, 0, 1)[::-1]
    h = 420
    idx = (np.arange(h) / h * f_hi).astype(int)
    img = np.stack([np.clip(S[idx] * 3 - 1.2, 0, 1), np.clip(S[idx] * 3 - 0.2, 0, 1) * 0.8, np.clip(1.2 - S[idx] * 2.2, 0, 1) * (S[idx] > 0.12)], axis=-1)
    zoom = 2 if cols * 2 <= 3200 else 1                   # 0.1 s ≈ 96 px: wide enough to place a character to ±20 ms
    im = Image.fromarray((img * 255).astype(np.uint8)).resize((cols * zoom, h))
    cols *= zoom
    canvas = Image.new('RGB', (cols, h + 46), (18, 18, 22))
    canvas.paste(im, (0, 0))
    d = ImageDraw.Draw(canvas)
    px_per_s = SR / hopn * zoom
    t = 0.0
    while t * px_per_s < cols:
        xx = int(t * px_per_s)
        big = abs(t * 2 - round(t * 2)) < 1e-6
        d.line([(xx, h), (xx, h + (14 if big else 7))], fill=(230, 230, 230))
        if big:
            d.text((xx + 3, h + 16), f'{t:.1f}', fill=(230, 230, 230))
        t = round(t + 0.1, 1)
    if label:
        d.text((6, h + 30), label, fill=(160, 200, 255))
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path)


def cmd_voice(args):
    p = poem()
    voice = dict(p['voice'])
    for k in ('provider', 'id', 'speed'):
        if getattr(args, k, None) is not None:
            voice[k] = getattr(args, k)
    voice.setdefault('provider', 'auto')
    voice['speed'] = float(voice.get('speed', 0.85))
    parts = parts_of(p)
    n = len(p['lines'])
    p['voice'] = voice
    groups = voice_groups(p)
    if args.plan:                                         # what a real run would send out, without sending anything
        new = 0
        for k, (text, gparts) in enumerate(groups):
            key = hashlib.sha1(f"{voice['provider']}|{voice.get('id')}|{voice['speed']}|{text}".encode()).hexdigest()[:16]
            cached = (ROOT / 'audio' / 'tts' / f'{key}.mp3').exists()
            new += not cached
            print(f"  {k + 1:2d}. {'cached' if cached else 'NEW   '}  {len(chars(text)):3d} 字  {text}")
        print(f'{len(groups)} recording(s) with {voice["provider"]} / {voice.get("id") or "default"}: {new} to synthesize, {len(groups) - new} cached')
        return
    desc = {'id': voice.get('id') or voice['provider'], 'provider': voice['provider'], 'speed': voice['speed']}
    (ROOT / 'assets').mkdir(exist_ok=True)
    (ROOT / 'build').mkdir(exist_ok=True)

    if args.dry or voice['provider'] == 'dry':
        # a recitation runs at about 2.6 characters a second, the title a little quicker
        desc['dry'] = True
        desc['title'] = {'d': round(parts[0][1] / 3.2, 2)}
        desc['author'] = {'d': round(parts[1][1] / 2.7, 2)}
        desc['lines'] = []
        for name, syl in parts[2:]:
            d = round(syl / 2.6, 2)
            line = {'d': d, 'pauses': []}
            if syl >= 5:
                cut = 4 if syl >= 7 else 2
                line['gap'] = [round(d * cut / syl, 2), round(d * cut / syl + 0.3, 2)]
                line['d'] = round(d + 0.3, 2)
            desc['lines'].append(line)
        last = desc['lines'][-1]
        last['syl'] = [round(last['d'] * k / parts[-1][1], 2) for k in range(parts[-1][1])]
        print('dry run: line lengths are estimates (2.6 字/秒); nothing was synthesized, the film will be mixed without a voice')
    else:
        tts = ROOT / 'audio' / 'tts'
        tts.mkdir(parents=True, exist_ok=True)
        vdir = ROOT / 'audio' / 'voice'
        vdir.mkdir(parents=True, exist_ok=True)
        for f in vdir.glob('*.wav'):
            f.unlink()
        todo = [(text, gparts, tts / (hashlib.sha1(f"{voice['provider']}|{voice.get('id')}|{voice['speed']}|{text}".encode()).hexdigest()[:16] + '.mp3')) for text, gparts in groups]
        new = [t for t in todo if not t[2].exists()]
        if new:
            print(f'synthesizing {len(new)} recording(s), {sum(len(chars(t[0])) for t in new)} characters, with {voice["provider"]} / {voice.get("id") or "default"} (speed {voice["speed"]}); {len(todo) - len(new)} cached')
        else:
            print(f'all {len(todo)} recording(s) cached (no new call)')
        info, whole = {}, []
        print(f'{"piece":8s} {"from":>6s} {"to":>6s}  {"len":>5s}  {"字/秒":>5s}  pauses inside')
        for text, gparts, mp3 in todo:
            if not mp3.exists():
                tts_provider(voice['provider'])(text, voice, mp3)
                mp3.with_suffix('.txt').write_text(json.dumps({'voice': voice, 'text': text}, ensure_ascii=False, indent=1))
            wav = mp3.with_suffix('.wav')
            sh(['ffmpeg', '-v', 'error', '-y', '-i', str(mp3), '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_s16le', str(wav)])
            x = load_wav(wav)
            whole.append(x)
            segs, db = segment(x, gparts)
            for seg in segs:
                a = max(0, int((seg['t0'] - 0.02) * SR))
                b = min(len(x), int((seg['t1'] + 0.06) * SR))
                y = x[a:b].copy()
                fi, fo = int(0.008 * SR), int(0.05 * SR)
                y[:fi] *= np.linspace(0, 1, fi)
                y[-fo:] *= np.linspace(1, 0, fo)
                with wave.open(str(vdir / f"{seg['name']}.wav"), 'wb') as w:
                    w.setnchannels(1)
                    w.setsampwidth(2)
                    w.setframerate(SR)
                    w.writeframes((y * 32767).astype('<i2').tobytes())
                d = round(seg['t1'] - seg['t0'], 3)
                pauses = inner_pauses(db, seg)
                tmap = voice.get('tempo') or {}             # {"l4": 0.85, "*": 0.92}: "*" is every line (not the title or the poet)
                tempo = float(tmap.get(seg['name'], tmap.get('*', 1.0) if seg['name'].startswith('l') else 1.0))
                if tempo != 1.0:
                    # slower (or faster) without a new recording: stretch this piece locally, pitch unchanged
                    piece = vdir / f"{seg['name']}.wav"
                    tmp = piece.with_suffix('.tmp.wav')
                    sh(['ffmpeg', '-v', 'error', '-y', '-i', str(piece), '-af', f'atempo={tempo}', '-ar', str(SR), '-ac', '1', '-c:a', 'pcm_s16le', str(tmp)])
                    tmp.replace(piece)
                    d = round(d / tempo, 3)
                    pauses = [[round(a0 / tempo, 2), round(b0 / tempo, 2)] for a0, b0 in pauses]
                print(f"{seg['name']:8s} {seg['t0']:6.2f} {seg['t1']:6.2f}  {d:5.2f}  {seg['syl'] / d:5.2f}  {pauses}" + (f'   (tempo {tempo})' if tempo != 1.0 else ''))
                line = {'d': d, 'pauses': pauses}
                mid = [g for g in pauses if 0.35 * d < g[0] < 0.75 * d]
                if mid:                               # the breath in the middle of the line — an event can land in it
                    line['gap'] = max(mid, key=lambda g: g[1] - g[0])
                info[seg['name']] = line
                if args.spec and seg['name'].startswith('l'):
                    a, b = int((seg['t0'] - 0.05) * SR), int((seg['t1'] + 0.05) * SR)
                    spectrogram(x[max(0, a):b], ROOT / 'build' / 'spec' / f"{seg['name']}.png", f"{seg['name']}  (times are seconds from the start of the line, minus 0.05)")
        desc['dry'] = False
        desc['title'] = {'d': info['title']['d']}
        desc['author'] = {'d': info['author']['d']}
        desc['lines'] = [info[f'l{i + 1}'] for i in range(n)]
        last = desc['lines'][-1]
        m = parts[-1][1]
        marked = (p.get('onsets') or {}).get(voice.get('id') or voice['provider'])
        if marked and len(marked) == m:
            tmap = voice.get('tempo') or {}
            k = float(tmap.get(f'l{n}', tmap.get('*', 1.0)))            # onsets are read off the unstretched spectrogram
            last['syl'] = [round(v / k, 3) for v in marked]
        else:
            last['syl'] = [round(last['d'] * k / m, 2) for k in range(m)]
            print(f'\n⚠ the last line\'s characters are spread evenly over its {last["d"]:.2f} s — the brush will only roughly follow the voice.\n'
                  f'  Run  python3 tools/film.py voice --spec , read build/spec/l{n}.png, and put the {m} start times in poem.json:\n'
                  f'  "onsets": {{ "{voice.get("id") or voice["provider"]}": [0.0, …] }}')
        x = np.concatenate(whole)
        e = envelope(x)
        ev = 20 * np.log10(e[e > e.max() * 0.045])
        print(f"\nall readings {len(x) / SR:.2f} s; loud-to-soft spread {np.percentile(ev, 90) - np.percentile(ev, 10):.1f} dB "
              '(a flat reading is ~12, a declaimed one 16+). Nobody has listened to it yet.')
        if args.spec:
            print(f'spectrograms → build/spec/l1…l{n}.png  (the ruler starts 0.05 s before the line)')
    (ROOT / 'build' / 'voice.json').write_text(json.dumps(desc, ensure_ascii=False, indent=1))
    (ROOT / 'assets' / 'voice.js').write_text('// written by tools/film.py voice — how long each recited piece is\nwindow.VOICE = ' + json.dumps(desc, ensure_ascii=False) + ';\n')
    print('voice → assets/voice.js' + ('' if desc['dry'] else ', audio/voice/*.wav'))
    cmd_timing(args)


# ── timing ───────────────────────────────────────────────────────────────────
def cmd_timing(args):
    p = poem()
    if not (ROOT / 'assets' / 'voice.js').exists():
        sys.exit('no assets/voice.js yet — run: python3 tools/film.py voice --dry')
    if not (ROOT / 'assets' / 'glyphs.js').exists():
        cmd_glyphs(args)
    keep = {k: p[k] for k in ('prefix', 'title', 'author', 'lines', 'seal', 'credit', 'creditVoice', 'tagline', 'taglinePool') if k in p}
    (ROOT / 'assets' / 'poem.js').write_text('// written by tools/film.py timing from poem.json\nwindow.POEM = ' + json.dumps(keep, ensure_ascii=False) + ';\n')
    sh(['node', 'tools/dump_timing.mjs'], cwd=ROOT)


def cmd_score(args):
    timing()
    sh([sys.executable, 'film/score.py'], cwd=ROOT)


def cmd_build(args):
    cmd_glyphs(args)
    cmd_timing(args)
    cmd_score(args)


# ── qa ───────────────────────────────────────────────────────────────────────
def hf(*a, capture=False):
    cmd = ['npx', '--yes', 'hyperframes', *a]
    if capture:
        return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return subprocess.run(cmd, cwd=ROOT)


def check_project():
    r = hf('check', capture=True)
    text = re.sub(r'\x1b\[[0-9;]*m', '', r.stdout + r.stderr)
    lines = [l for l in text.splitlines() if l.strip() and 'browserGpuMode' not in l]
    ok = 'Check passed' in text
    print('\n'.join(lines[-16:]))
    return ok


def event_times(T):
    """Composition times worth looking at: the cover, every named event, the middle of every line, the end."""
    intro, dur = T['intro'], T['dur']
    marks = [(0.0, 'cover')]
    skip = {'fps', 'intro', 'dur', 'total', 'hasVoice', 'lineEnd'} | set((T.get('notEvents') or '').split())   # lengths and rates are not moments
    for k, v in T.items():
        if k in skip or isinstance(v, bool) or not isinstance(v, (int, float)):
            continue
        if 0 <= v <= dur:
            marks.append((v + intro, k))
    for i, v in enumerate(T.get('v', [])):
        marks.append((v + intro + 0.9, f'line {i + 1}'))
    for i, v in enumerate(T.get('charOn', [])):
        if i % 2 == 1:
            marks.append((v + intro + 0.1, f'char {i + 1}'))
    marks.append((T['total'] - 0.1, 'end'))
    marks.sort()
    keep = []
    for t, name in marks:
        if keep and t - keep[-1][0] < 0.3:
            keep[-1] = (keep[-1][0], keep[-1][1] + '·' + name)
        else:
            keep.append((round(t, 2), name))
    return keep


def grab(times, tag):
    """Still frames at these composition times, as PNGs under build/qa/<tag>/."""
    dest = ROOT / 'build' / 'qa' / tag
    shutil.rmtree(dest, ignore_errors=True)
    dest.mkdir(parents=True)
    files = []
    for i in range(0, len(times), 16):
        chunk = times[i:i + 16]
        snap = ROOT / 'snapshots'
        shutil.rmtree(snap, ignore_errors=True)
        r = hf('snapshot', '--no-end', '--describe', 'false', '--at', ','.join(f'{t:g}' for t in chunk), capture=True)
        got = sorted(snap.glob('frame-*.png'))
        if len(got) != len(chunk):
            sys.exit(f'snapshot failed:\n{r.stdout[-800:]}{r.stderr[-800:]}')
        for t, f in zip(chunk, got):
            g = dest / f'{t:07.2f}.png'
            shutil.move(str(f), g)
            files.append(g)
    return files


def contact_sheets(files, labels, name, cols=4, cell=(640, 360)):
    from PIL import Image, ImageDraw, ImageFont
    try:
        font = ImageFont.load_default(size=20)
    except TypeError:                                     # older Pillow: the small built-in face
        font = ImageFont.load_default()
    sheets = []
    per = cols * 4
    for s in range(0, len(files), per):
        part = files[s:s + per]
        rows = (len(part) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * (cell[0] + 6) + 6, rows * (cell[1] + 30) + 6), (30, 30, 30))
        d = ImageDraw.Draw(sheet)
        for i, f in enumerate(part):
            im = Image.open(f).convert('RGB').resize(cell)
            x = 6 + (i % cols) * (cell[0] + 6)
            y = 6 + (i // cols) * (cell[1] + 30)
            sheet.paste(im, (x, y + 24))
            d.text((x + 4, y + 1), labels[s + i], fill=(255, 235, 120), font=font)
        path = ROOT / 'build' / 'qa' / f'{name}-{len(sheets) + 1}.jpg'
        sheet.save(path, quality=88)
        sheets.append(path)
    return sheets


def frame_checks(files, marks, T):
    """What a script can see: an empty sheet where there should be a scene, the red dot missing, nothing moving."""
    from PIL import Image
    intro = T['intro']
    problems = []
    prev = None
    for f, (t, name) in zip(files, marks):
        im = np.asarray(Image.open(f).convert('RGB').resize((320, 180))).astype(np.int16)
        lum = im.mean(axis=2)
        red = ((im[..., 0] > 170) & (im[..., 1] < 120) & (im[..., 2] < 100)).mean()
        ft = t - intro                                    # film time
        top = im[:24]
        if ((top[..., 0] > 160) & (top[..., 1] < 60) & (top[..., 2] < 50)).mean() > 0.6:
            problems.append(f'{t:6.2f}s ({name}): this frame threw an error — the message is written across the top of the frame')
            continue
        if lum.std() < 6 and ft > T.get('bloom', 3.0) + 1.4 and name != 'end':
            problems.append(f'{t:6.2f}s ({name}): the frame is almost empty paper')
        if T.get('drop', 0) + 0.3 < ft < T['dur'] - 0.2 and red < 0.0004 and not (T.get('gate', 1e9) - 0.1 < ft < T.get('cut', -1e9) + 0.5):
            problems.append(f'{t:6.2f}s ({name}): the red dot is not in the frame (or hidden) — the film is about it')
        if red > 0.08 and t > intro:
            problems.append(f'{t:6.2f}s ({name}): a lot of red on screen ({red:.0%}) — the dot should be the only vermilion')
        if prev is not None and np.abs(im - prev[0]).mean() < 0.05 and t - prev[1] > 0.5 and t < T['total'] - 1.4 and ft > T.get('bloom', 3.0) + 1.4:
            problems.append(f'{prev[1]:6.2f}s → {t:6.2f}s: nothing changed between these frames')
        prev = (im, t)
    return problems


def timing_checks(T, p):
    problems = []
    V = json.loads((ROOT / 'build' / 'voice.json').read_text())
    ends = [v + V['lines'][i]['d'] for i, v in enumerate(T.get('v', []))]
    for i in range(1, len(ends)):
        if T['v'][i] < ends[i - 1]:
            problems.append(f'line {i + 1} starts before line {i} has finished')
    if ends and ends[-1] > T['write0'] - 0.2:
        problems.append(f'the last captioned line ends at {ends[-1]:.2f}s, on top of the final line (write0 = {T["write0"]}) — move write0 later')
    if ends and T.get('capEnd', 1e9) < ends[-1] - 0.3:
        problems.append(f'the caption slip leaves at {T["capEnd"]:.2f}s while a line is still being spoken (until {ends[-1]:.2f}s)')
    on = T.get('charOn', [])
    if any(b <= a for a, b in zip(on, on[1:])):
        problems.append('charOn is not increasing — check "onsets" in poem.json')
    if on and on[-1] > T['write1']:
        problems.append('the last character starts after the line ends — check "onsets" in poem.json')
    if T['hop'] > T['write0'] - 0.4:
        problems.append('the dot has under 0.4 s to get from the scene to the first stroke (hop → write0)')
    return problems


def cmd_qa(args):
    T = timing()
    p = poem()
    print('— project check —')
    ok = check_project()
    print('\n— timing —')
    tp = timing_checks(T, p)
    print('\n'.join('  ✗ ' + x for x in tp) or '  ok')
    print('\n— frames —')
    marks = event_times(T)
    files = grab([t for t, _ in marks], 'events')
    fp = frame_checks(files, marks, T)
    print('\n'.join('  ✗ ' + x for x in fp) or f'  {len(files)} frames, nothing flagged')
    sheets = contact_sheets(files, [f'{t:.2f}s  {name}' for t, name in marks], 'contact')
    print('\ncontact sheets (open and LOOK at them — a script cannot see a bad composition):')
    for s in sheets:
        print('  ', s.relative_to(ROOT))
    if not ok or tp or fp:
        sys.exit(1)


# ── render + package ─────────────────────────────────────────────────────────
def ffprobe(path, entries, stream=None):
    cmd = ['ffprobe', '-v', 'error', '-show_entries', entries, '-of', 'csv=p=0']
    if stream:
        cmd += ['-select_streams', stream]
    return out(cmd + [str(path)]).strip()


def loudness(path):
    log = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-vn', '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', log)
    return float(m[-1]) if m else None


def still_ranges(path, fps):
    w, h = 160, 90
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
    d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    rng, cur = [], None
    for i, v in enumerate(d):
        if v < 0.02:
            cur = [i, i] if cur is None else [cur[0], i]
        elif cur is not None:
            rng.append(cur)
            cur = None
    if cur is not None:
        rng.append(cur)
    return len(f), [(round(a / fps, 2), round((b + 1) / fps, 2)) for a, b in rng if b - a >= fps * 0.5]


def voice_offsets(path, T):
    """Where each recited piece actually sits in the rendered file, against where it was planned."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    mix = np.frombuffer(raw, '<i2').astype(np.float64) / 32768
    n = len(poem()['lines'])
    plan = [('title', T['vTitle']), ('author', T['vAuthor'])] + [(f'l{i + 1}', v) for i, v in enumerate(T['v'])] + [(f'l{n}', T['vFinal'])]
    worst = 0.0
    for name, v in plan:
        x = load_wav(ROOT / 'audio' / 'voice' / f'{name}.wav')
        want = v + T['intro'] - 0.02
        a = max(0, int((want - 0.4) * SR))
        seg = mix[a:a + len(x) + int(0.8 * SR)]
        m = 1 << (len(seg) + len(x)).bit_length()
        c = np.fft.irfft(np.fft.rfft(seg, m) * np.conj(np.fft.rfft(x, m)), m)[:max(1, len(seg) - len(x) + 1)]
        worst = max(worst, abs((a + int(np.argmax(c))) / SR - want))
    return worst


def count_lines():
    def n(paths):
        return sum(len(f.read_text().splitlines()) for f in paths if f.exists())
    return {'film': n(list((ROOT / 'film').glob('*'))), 'engine': n(list((ROOT / 'engine').glob('*.js')) + list((ROOT / 'tools').glob('*')))}


def cmd_render(args):
    T = timing()
    p = poem()
    slug = args.out or p.get('slug') or ROOT.name
    renders = ROOT / 'renders'
    renders.mkdir(exist_ok=True)
    master = renders / f'{slug}.mp4'
    if not args.package_only:
        print('— project check —')
        if not check_project():
            sys.exit('the project check failed — fix it before rendering')
        t0 = datetime.datetime.now()
        r = hf('render', '-o', str(master), '--fps', str(p['fps']), '--quality', 'delivery')
        if r.returncode or not master.exists():
            sys.exit('render failed')
        render_s = (datetime.datetime.now() - t0).total_seconds()
    else:
        render_s = None
        if not master.exists():
            sys.exit(f'{master} does not exist')

    print('\n— verify —')
    problems = []
    frames_want = round(T['total'] * p['fps'])
    frames, stills = still_ranges(master, p['fps'])
    dur = float(ffprobe(master, 'format=duration'))
    if frames != frames_want:
        problems.append(f'{frames} frames, expected {frames_want}')
    has_audio = bool(ffprobe(master, 'stream=codec_name', 'a:0'))
    lu = loudness(master) if has_audio else None
    if not has_audio:
        problems.append('no audio stream')
    elif lu is None or abs(lu + 16) > 1.5:
        problems.append(f'loudness {lu} LUFS, expected about -16')
    mid = [s for s in stills if s[0] > T['intro'] + T.get('bloom', 3.0) and s[1] < T['total'] - 1.6]
    if mid:
        problems.append(f'the picture stands still at {mid} — is that meant?')
    off = None
    if T.get('hasVoice'):
        off = voice_offsets(master, T)
        if off > 0.03:
            problems.append(f'a recited piece is {off * 1000:.0f} ms away from where it was planned')
    print(f'  {frames} frames, {dur:.2f}s, {lu} LUFS' + (f', voice placed within {off * 1000:.0f} ms' if off is not None else ''))
    print('\n'.join('  ✗ ' + x for x in problems) or '  ok')

    print('\n— package —')
    upload = renders / f'{slug}-upload.mp4'
    small = renders / f'{slug}-small.mp4'
    small.unlink(missing_ok=True)

    def encode(dst, crf, scale=None):
        vf = ['-vf', f'scale={scale}:flags=lanczos'] if scale else []
        sh(['ffmpeg', '-v', 'error', '-y', '-i', str(master), *vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', str(dst)])

    # A browser-driven upload takes at most 10 MB. A short film fits at full size; a long one does not without
    # looking bad, so it gets a good 1080p copy to upload by hand and a 720p copy for the automated route.
    encode(upload, 23)
    crf, small_crf = 23, None
    if upload.stat().st_size > 9.5e6:
        fitted = False
        if upload.stat().st_size <= 9.5e6 * 1.7:          # close enough that a slightly lower quality will fit
            trial = renders / f'{slug}-trial.mp4'
            for c in (25, 27):
                encode(trial, c)
                if trial.stat().st_size <= 9.5e6:
                    trial.replace(upload)
                    crf, fitted = c, True
                    break
            trial.unlink(missing_ok=True)
        if not fitted:
            for small_crf in (26, 28, 30, 32, 34):
                encode(small, small_crf, '1280:720')
                if small.stat().st_size <= 9.5e6:
                    break
    cover = renders / 'cover.png'
    first = grab([0], 'cover')[0]
    shutil.copy(first, cover)
    from PIL import Image
    lum = np.asarray(Image.open(cover).convert('L').resize((160, 90))).astype(float)
    if lum.std() < 8:
        problems.append('the first frame is almost blank — platforms use it as the thumbnail; give the film a cover (film.cover in film/scenes.js)')
    sheet = renders / 'contact.jpg'
    n_tiles = int(np.ceil(dur))
    cols = 6
    rows = int(np.ceil(n_tiles / cols))
    sh(['ffmpeg', '-v', 'error', '-y', '-i', str(master), '-vf', f"select='not(mod(n-{p['fps'] // 2}\\,{p['fps']}))',scale=480:270,tile={cols}x{rows}:padding=4:margin=4:color=0x222222", '-frames:v', '1', '-q:v', '3', str(sheet)])
    tts_calls = len(list((ROOT / 'audio' / 'tts').glob('*.mp3'))) if (ROOT / 'audio' / 'tts').exists() else 0
    V = json.loads((ROOT / 'build' / 'voice.json').read_text())
    pkg = {
        'slug': slug, 'title': p['title'], 'author': p['author'],
        'seconds': round(dur, 2), 'frames': frames, 'fps': p['fps'], 'size': p.get('size', [1920, 1080]),
        'cover_seconds': T['intro'], 'lufs': lu,
        'voice': None if V.get('dry') else {'provider': V.get('provider'), 'id': V['id'], 'speed': V['speed'], 'placed_within_ms': None if off is None else round(off * 1000, 1)},
        'tts_recordings_cached': tts_calls,
        'master': f'{master.name} ({master.stat().st_size / 1e6:.1f} MB)',
        'upload': f'{upload.name} ({upload.stat().st_size / 1e6:.1f} MB, crf {crf})',
        'small': None if small_crf is None else f'{small.name} ({small.stat().st_size / 1e6:.1f} MB, 720p, crf {small_crf})',
        'code_lines': count_lines(),
        'render_seconds': None if render_s is None else round(render_s, 1),
        'rendered_at': datetime.datetime.now().isoformat(timespec='seconds'),
        'problems': problems,
    }
    (ROOT / 'build' / 'package.json').write_text(json.dumps(pkg, ensure_ascii=False, indent=1))
    for k in ('master', 'upload', 'small'):
        if pkg[k]:
            print(f'  {pkg[k]}')
    if pkg['small']:
        print('  (the 1080p upload copy is over 10 MB: upload it by hand, or use the 720p copy for a browser-driven upload)')
    print(f'  cover.png, contact.jpg, build/package.json')
    if not T.get('hasVoice'):
        print('  (dry run: no recitation in this render)')
    if problems:
        print('\nlook into:\n' + '\n'.join('  ✗ ' + x for x in problems))
        sys.exit(1)


# ── log + stats ──────────────────────────────────────────────────────────────
def cmd_log(args):
    f = ROOT / 'logs' / 'PRODUCTION_LOG.md'
    f.parent.mkdir(exist_ok=True)
    line = f"- {datetime.datetime.now():%Y-%m-%d %H:%M:%S}  {args.note}\n"
    with f.open('a') as fh:
        fh.write(line)
    print(line.strip())


def cmd_stats(args):
    """Minutes worked and tokens used, from a Claude Code session record (the .jsonl under ~/.claude/projects).
    Counts only the stretches from each thing the user said to the agent's last action before the next one —
    time the user was away is not work. Other agents keep no such record; use the production log there."""
    if args.session:
        files = [Path(args.session)]
    else:
        base = Path.home() / '.claude' / 'projects'
        cand = [f for f in base.glob('*/*.jsonl')] if base.exists() else []
        needle = str(ROOT)
        files = []
        for f in sorted(cand, key=lambda f: f.stat().st_mtime, reverse=True)[:40]:
            try:
                if needle in f.read_text(errors='ignore'):
                    files.append(f)
            except OSError:
                pass
        if not files:
            sys.exit('no session record mentions this project. Pass one with --session <file.jsonl>, or use logs/PRODUCTION_LOG.md.')
    since = datetime.datetime.fromisoformat(args.since).astimezone() if args.since else None
    for f in files[:1 if not args.all else None]:
        users, acts, msgs = [], [], {}
        for line in f.read_text(errors='ignore').splitlines():
            try:
                d = json.loads(line)
            except ValueError:
                continue
            ts = d.get('timestamp')
            if not ts or d.get('isSidechain'):
                continue
            t = datetime.datetime.fromisoformat(ts.replace('Z', '+00:00')).astimezone()
            if since and t < since:
                continue
            if d.get('type') == 'assistant':
                acts.append(t)
                m = d.get('message', {})
                u = m.get('usage') or {}
                if m.get('id'):
                    cur = msgs.setdefault(m['id'], {})
                    for k in ('output_tokens', 'input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'):
                        cur[k] = max(cur.get(k, 0), u.get(k, 0) or 0)
            elif d.get('type') == 'user' and not d.get('isMeta'):
                c = d.get('message', {}).get('content')
                text = c if isinstance(c, str) else None
                if isinstance(c, list) and not any(isinstance(x, dict) and x.get('type') == 'tool_result' for x in c):
                    text = ' '.join(x.get('text', '') for x in c if isinstance(x, dict) and x.get('type') == 'text')
                if text and text.strip() and not text.lstrip().startswith('<'):
                    users.append((t, text.strip().replace('\n', ' ')))
        print(f'session record: {f}')
        total = datetime.timedelta()
        for i, (t, text) in enumerate(users):
            nxt = users[i + 1][0] if i + 1 < len(users) else None
            mine = [a for a in acts if a >= t and (nxt is None or a < nxt)]
            if not mine:
                continue
            span = max(mine) - t
            total += span
            print(f'  {t:%m-%d %H:%M:%S}  {span.total_seconds() / 60:5.1f} min  「{text[:36]}」')
        tok = {k: sum(m.get(k, 0) for m in msgs.values()) for k in ('output_tokens', 'cache_read_input_tokens')}
        print(f'  said by the user: {len(users)} messages (choices clicked in a question card are not counted here — count them yourself)')
        print(f'  worked: {total.total_seconds() / 60:.0f} min   calls: {len(msgs)}   output tokens: {tok["output_tokens"]:,}   cache reads: {tok["cache_read_input_tokens"]:,}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('glyphs')
    v = sub.add_parser('voice')
    v.add_argument('--dry', action='store_true')
    v.add_argument('--spec', action='store_true')
    v.add_argument('--plan', action='store_true', help='list the recordings a real run would synthesize, and which are cached')
    v.add_argument('--provider')
    v.add_argument('--id')
    v.add_argument('--speed', type=float)
    sub.add_parser('timing')
    sub.add_parser('score')
    sub.add_parser('build')
    sub.add_parser('qa')
    r = sub.add_parser('render')
    r.add_argument('--out', help='file name without extension (default: the slug)')
    r.add_argument('--package-only', action='store_true', help='re-verify and re-package an existing render')
    lg = sub.add_parser('log')
    lg.add_argument('note')
    st = sub.add_parser('stats')
    st.add_argument('--session')
    st.add_argument('--since', help='ISO time; ignore everything before it (a session that also did other work)')
    st.add_argument('--all', action='store_true')
    a = ap.parse_args()
    os.chdir(ROOT)
    {'glyphs': cmd_glyphs, 'voice': cmd_voice, 'timing': cmd_timing, 'score': cmd_score, 'build': cmd_build, 'qa': cmd_qa, 'render': cmd_render, 'log': cmd_log, 'stats': cmd_stats}[a.cmd](a)


if __name__ == '__main__':
    main()
