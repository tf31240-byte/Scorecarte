#!/usr/bin/env python3
"""Fabrique un index.html autonome (CSS + JS intégrés) : python3 scripts/inline.py [sortie.html]"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
              lambda m: '<style>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</style>', html)
html = re.sub(r'<script src="(js/[^"]+)"></script>\n?',
              lambda m: '<script>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '</script>\n', html)
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'scoremaster-single.html'
out.write_text(html, encoding='utf-8')
print(f'{out} ({len(html)//1024} Ko)')
