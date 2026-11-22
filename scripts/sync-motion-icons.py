#!/usr/bin/env python3
"""Inline the canonical SVGs so their parts can respond to hover and focus."""
import argparse
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = root / 'index.html'
before = page.read_text()
after = before
icons = {'portfolio': 'jrb', 'studio': 'toolbox', 'github': 'github',
         'photos': 'photos', 'instagram': 'instagram', 'strava': 'strava', 'wings': 'wings'}
for disc, name in icons.items():
    svg = (root / 'assets' / 'motion' / f'{name}.svg').read_text().strip()
    svg = re.sub(r'<metadata>.*?</metadata>\s*', '', svg, flags=re.S)
    pattern = rf'(<span class="icon-disc [^"]*\b{disc}-disc\b[^"]*" aria-hidden="true">).*?(</span>)'
    after, count = re.subn(pattern, lambda m: m[1] + '\n' + svg + '\n            ' + m[2], after, flags=re.S)
    if count != 1:
        raise SystemExit(f'Expected one {disc} disc; found {count}')

check = argparse.ArgumentParser()
check.add_argument('--check', action='store_true')
if check.parse_args().check:
    if before != after:
        raise SystemExit('Run python3 scripts/sync-motion-icons.py to refresh inline artwork')
else:
    page.write_text(after)
