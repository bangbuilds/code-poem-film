#!/usr/bin/env python3
"""Scaffold (or refresh) a code-poem-film project.

  python3 new_project.py videos/<slug>                      new project: HyperFrames init + engine + tools + a starter film
  python3 new_project.py videos/<slug> --example qingzhou   start from that example's poem.json and film/ instead
  python3 new_project.py videos/<slug> --sync               refresh engine/, tools/ and index.html from the skill
                                                            (keeps poem.json, film/, assets/, audio/, renders/)
"""
import argparse, json, os, shutil, subprocess, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
TEMPLATE = SKILL / 'template'
ENGINE_DIRS = ('engine', 'tools')
GLYPH_DATA = 'hanzi-writer-data@2.0.1'


def run(cmd, cwd=None):
    print('$', ' '.join(str(c) for c in cmd))
    subprocess.run(cmd, check=True, cwd=cwd)


def copy_engine(dest):
    for d in ENGINE_DIRS:
        shutil.copytree(TEMPLATE / d, dest / d, dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__'))
    shutil.copy(TEMPLATE / 'index.html', dest / 'index.html')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('dir')
    ap.add_argument('--example')
    ap.add_argument('--sync', action='store_true')
    a = ap.parse_args()
    dest = Path(a.dir).resolve()
    if a.sync:
        if not (dest / 'poem.json').exists():
            sys.exit(f'{dest} is not a code-poem-film project (no poem.json)')
        copy_engine(dest)
        print(f'engine refreshed in {dest} — poem.json, film/, assets/ and audio/ untouched\nnext: cd {dest} && python3 tools/film.py timing')
        return
    if (dest / 'poem.json').exists():
        sys.exit(f'{dest} already has a poem.json — use --sync to refresh the engine')
    if not (dest / 'hyperframes.json').exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        run(['npx', '--yes', 'hyperframes', 'init', str(dest), '--non-interactive', '--example=blank'])
    copy_engine(dest)
    src = TEMPLATE
    if a.example:
        src = SKILL / 'examples' / a.example
        if not src.exists():
            sys.exit(f'no such example: {a.example} (have: {[p.name for p in (SKILL / "examples").iterdir() if p.is_dir()]})')
    # the starter film first; an example then replaces the files it brings (it may bring only some)
    shutil.copytree(TEMPLATE / 'film', dest / 'film', dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__'))
    if a.example:
        shutil.copytree(src / 'film', dest / 'film', dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__'))
    poem = json.loads((src / ('poem.json' if a.example else 'poem.example.json')).read_text())
    if not a.example:
        poem['slug'] = dest.name
    # an example's settings that stay on the author's machine (a paid voice and what was tuned for it)
    local = src / 'poem.local.json'
    if a.example and local.exists():
        for k, v in json.loads(local.read_text()).items():
            if isinstance(v, dict) and isinstance(poem.get(k), dict):
                poem[k].update(v)
            else:
                poem[k] = v
        print(f'merged {local.name}')
    # this machine's usual voice, if the user keeps one (never part of the skill: it may name a paid service)
    defaults = Path(os.environ.get('CODE_POEM_FILM_HOME', Path.home() / '.config' / 'code-poem-film')) / 'defaults.json'
    if defaults.exists() and not (a.example and local.exists()):
        poem.setdefault('voice', {}).update(json.loads(defaults.read_text()).get('voice', {}))
        print(f'voice defaults from {defaults}')
    (dest / 'poem.json').write_text(json.dumps(poem, ensure_ascii=False, indent=2) + '\n')
    # stroke data for the characters the film writes (Make Me a Hanzi, Arphic Public License)
    if not (dest / 'node_modules' / 'hanzi-writer-data').exists():
        run(['npm', 'i', '--no-audit', '--no-fund', GLYPH_DATA], cwd=dest)
    for d in ('assets', 'audio', 'build', 'logs', 'renders'):
        (dest / d).mkdir(exist_ok=True)
    print(f'\nproject ready: {dest}\nnext:  cd {dest}\n       python3 tools/film.py voice --dry     # free: estimates line lengths\n       python3 tools/film.py build\n       python3 tools/film.py qa')


if __name__ == '__main__':
    main()
