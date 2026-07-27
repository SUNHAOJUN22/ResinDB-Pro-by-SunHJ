#!/usr/bin/env python3
from pathlib import Path
import re

root = Path.cwd()
generator = root / 'scripts/generate-readme-visuals.py'
text = generator.read_text(encoding='utf-8')
if 'height="204" rx="18"' not in text:
    flow = '''def render_flow(visual: Visual) -> str:
    body = header(visual)
    count = len(visual.items)
    gap = 22
    width = (1072 - gap * (count - 1)) / count
    y = 204
    for index, item in enumerate(visual.items):
        x = 64 + index * (width + gap)
        accent = ACCENTS[index % len(ACCENTS)]
        body += (
            f'<g filter="url(#shadow-sm)">'
            f'<rect x="{x}" y="{y}" width="{width}" height="204" rx="18" fill="{TOKENS["surface"]}" stroke="{TOKENS["border_soft"]}"/>'
            f'<rect x="{x}" y="{y}" width="{width}" height="5" rx="2.5" fill="{accent}"/>'
            f'</g>'
            + icon_badge(x + width / 2 - 24, y + 26, item.icon, accent, 48)
            + text(x + width - 24, y + 31, f"{index + 1:02d}", 11, TOKENS["muted"], 700, "middle", MONO)
            + text(x + width / 2, y + 105, item.title, 14, TOKENS["ink"], 720, "middle")
        )
        subtitle_parts = item.subtitle.split(" • ")
        if len(subtitle_parts) > 1:
            body += text(x + width / 2, y + 132, subtitle_parts[0], 11, TOKENS["muted"], 500, "middle")
            body += text(x + width / 2, y + 151, " • ".join(subtitle_parts[1:]), 11, TOKENS["muted"], 500, "middle")
        else:
            body += text(x + width / 2, y + 139, item.subtitle, 11, TOKENS["muted"], 500, "middle")
        body += f'<circle cx="{x + width / 2}" cy="{y + 178}" r="4" fill="{accent}"/>'
        if index < count - 1:
            body += line(x + width + 4, y + 102, x + width + gap - 5, y + 102,
                         TOKENS["primary"], 2, False, "arrow")
    body += (
        f'<rect x="64" y="442" width="1072" height="92" rx="18" fill="{TOKENS["surface_alt"]}" stroke="{TOKENS["border_soft"]}"/>'
        + text(88, 473, "DESIGN INTENT", 11, TOKENS["primary"], 750, family=MONO, letter_spacing=1.0)
        + text(88, 503, visual.description, 14, TOKENS["body"], 500)
    )
    return body + footer(visual)
'''
    text, count = re.subn(r'def render_flow\(visual: Visual\) -> str:\n.*?\n\ndef render_grid', flow + '\n\ndef render_grid', text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit('render_flow replacement failed')
text = text.replace(
    '''        if width > 400:\n            body += text(x + 26, y + height - 27, visual.description, 12, TOKENS["muted"], 500)\n''',
    '',
)
generator.write_text(text, encoding='utf-8')

validator = root / 'scripts/validate-repository-docs.py'
vtext = validator.read_text(encoding='utf-8')
anchor = '    "docs/MIGRATION_v3.1.0.md",\n'
entries = (
    '    ".github/uiux-visual-final-proof-20260727.trigger",\n'
    '    ".github/workflows/uiux-visual-final-proof-20260727.yml",\n'
    '    "scripts/refine-uiux-visual-layout.py",\n'
    '    "scripts/uiux-visual-final-proof.sh",\n'
    '    "scripts/write-uiux-visual-evidence.py",\n'
)
if '"scripts/refine-uiux-visual-layout.py"' not in vtext:
    if anchor not in vtext:
        raise SystemExit('validator forbidden-path anchor missing')
    vtext = vtext.replace(anchor, entries + anchor, 1)
validator.write_text(vtext, encoding='utf-8')
print('refined narrow flow layout and final-proof hygiene contract')
