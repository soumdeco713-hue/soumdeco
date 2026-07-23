#!/usr/bin/env python3
"""Convert hardcoded neon colors in site components to the elegant ivory palette."""
import os
import re

# Mapping of old neon values -> new elegant values
REPLACEMENTS = [
    # Emerald (was neon emerald #00F0B5)
    (r'rgba\(0,\s*240,\s*181,', 'rgba(42, 125, 91,'),
    (r'rgba\(0,\s*240,\s*181\)', 'rgba(42, 125, 91, 0.30)'),
    (r'#00F0B5', '#2A7D5B'),
    (r'#5CFFD9', '#3DA177'),
    # Cyan (was electric cyan #00E5FF)
    (r'rgba\(0,\s*229,\s*255,', 'rgba(74, 157, 161,'),
    (r'rgba\(0,\s*229,\s*255\)', 'rgba(74, 157, 161, 0.30)'),
    (r'#00E5FF', '#4A9DA1'),
    # Magenta (was neon magenta #FF2FB8)
    (r'rgba\(255,\s*47,\s*184,', 'rgba(194, 91, 126,'),
    (r'rgba\(255,\s*47,\s*184\)', 'rgba(194, 91, 126, 0.30)'),
    (r'#FF2FB8', '#C25B7E'),
    # Gold/brass (was #FFB938 bright)
    (r'rgba\(255,\s*185,\s*56,', 'rgba(184, 144, 47,'),
    (r'rgba\(255,\s*185,\s*56\)', 'rgba(184, 144, 47, 0.30)'),
    (r'#FFB938', '#B8902F'),
    (r'#FFD16A', '#D4A93F'),
    # Violet (was neon violet)
    (r'rgba\(139,\s*92,\s*255,', 'rgba(126, 107, 168,'),
    (r'rgba\(139,\s*92,\s*255\)', 'rgba(126, 107, 168, 0.30)'),
    (r'#8B5CFF', '#7E6BA8'),
    # Dark shadow on cards → softer warm shadow
    (r'rgba\(0,\s*0,\s*0,\s*0\.7\)', 'rgba(107, 100, 87, 0.18)'),
    (r'rgba\(0,\s*0,\s*0,\s*0\.6\)', 'rgba(107, 100, 87, 0.15)'),
    (r'rgba\(0,\s*0,\s*0,\s*0\.5\)', 'rgba(107, 100, 87, 0.12)'),
    (r'rgba\(0,\s*0,\s*0,\s*0\.4\)', 'rgba(107, 100, 87, 0.10)'),
]

# Glow shadow intensity — reduce neon-like glow alpha values
GLOW_REPLACEMENTS = [
    # Strong glows (0.5-0.7 alpha) → softer (0.25-0.35)
    (r'rgba\(42, 125, 91, 0\.5\)', 'rgba(42, 125, 91, 0.30)'),
    (r'rgba\(42, 125, 91, 0\.6\)', 'rgba(42, 125, 91, 0.35)'),
    (r'rgba\(42, 125, 91, 0\.7\)', 'rgba(42, 125, 91, 0.40)'),
    (r'rgba\(184, 144, 47, 0\.5\)', 'rgba(184, 144, 47, 0.30)'),
    (r'rgba\(184, 144, 47, 0\.6\)', 'rgba(184, 144, 47, 0.35)'),
    (r'rgba\(194, 91, 126, 0\.4\)', 'rgba(194, 91, 126, 0.25)'),
    (r'rgba\(194, 91, 126, 0\.5\)', 'rgba(194, 91, 126, 0.28)'),
    (r'rgba\(194, 91, 126, 0\.6\)', 'rgba(194, 91, 126, 0.30)'),
    (r'rgba\(194, 91, 126, 0\.65\)', 'rgba(194, 91, 126, 0.30)'),
]

SITE_DIR = '/home/z/my-project/src/components/site'

changed_files = []
for fname in os.listdir(SITE_DIR):
    if not fname.endswith('.tsx'):
        continue
    fpath = os.path.join(SITE_DIR, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        original = f.read()
    content = original
    for pattern, replacement in REPLACEMENTS + GLOW_REPLACEMENTS:
        content = re.sub(pattern, replacement, content)
    if content != original:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        changed_files.append(fname)

print(f"Updated {len(changed_files)} files:")
for f in changed_files:
    print(f"  - {f}")
