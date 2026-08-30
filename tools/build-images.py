#!/usr/bin/env python3
"""Rebuild every image the site ships from source equirectangular panoramas.

    python3 tools/build-images.py <source-dir>

The source directory must hold one 2:1 equirectangular image per room, named
<room>.jpg / .jpeg / .png / .webp, for the room ids in ROOMS below.

Produces, under site/assets/:
    panos/<room>.webp        full frame (WebGL sphere, desktop)
    panos/<room>-sm.webp     1440 px wide (phones)
    panos/<room>-lqip.webp   64 px placeholder, loaded before anything else
    projects/<room>.webp     rectilinear card crop (gnomonic reprojection)
    og-cover.jpg             1200x630 social share image

Requires: Pillow, numpy.
"""
import math
import os
import sys

import numpy as np
from PIL import Image

ROOMS = ['entry', 'living', 'kitchen', 'dining', 'corridor', 'bedroom']

# Heading, in degrees, that frames each room's card. Picked by eye from a
# contact sheet of the six panoramas; re-pick if the panoramas change.
CARD_YAW = {'entry': 228, 'living': 2, 'kitchen': 272,
            'dining': 358, 'corridor': 6, 'bedroom': 2}

CARD_W, CARD_H, CARD_FOV = 800, 600, 96.0
SM_W = 1440
LQIP_W = 64

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PANOS = os.path.join(HERE, 'site', 'assets', 'panos')
CARDS = os.path.join(HERE, 'site', 'assets', 'projects')


def find_source(src_dir, room):
    for ext in ('.jpg', '.jpeg', '.png', '.webp'):
        p = os.path.join(src_dir, room + ext)
        if os.path.exists(p):
            return p
    raise SystemExit('missing source panorama for %r in %s' % (room, src_dir))


def rectilinear(eq, yaw, w, h, fov):
    """Gnomonic reprojection: an equirectangular slice as a real perspective
    photo, so the card crops do not show the panorama's barrel curvature."""
    eh, ew, _ = eq.shape
    f = (w / 2) / math.tan(math.radians(fov) / 2)
    xs = (np.arange(w) - w / 2)[None, :].repeat(h, 0)
    ys = (np.arange(h) - h / 2)[:, None].repeat(w, 1)
    zs = np.full_like(xs, f)

    a = math.radians(yaw)
    x = xs * math.cos(a) + zs * math.sin(a)
    z = -xs * math.sin(a) + zs * math.cos(a)
    y = ys

    r = np.sqrt(x * x + y * y + z * z)
    lon = np.arctan2(x, z)
    lat = np.arcsin(y / r)

    u = (lon / (2 * math.pi) + 0.5) * ew
    v = (lat / math.pi + 0.5) * eh
    u0 = np.floor(u).astype(int) % ew
    v0 = np.clip(np.floor(v).astype(int), 0, eh - 1)
    u1 = (u0 + 1) % ew
    v1 = np.clip(v0 + 1, 0, eh - 1)
    du = (u - np.floor(u))[..., None]
    dv = (v - np.floor(v))[..., None]

    out = (eq[v0, u0] * (1 - du) * (1 - dv) + eq[v0, u1] * du * (1 - dv) +
           eq[v1, u0] * (1 - du) * dv + eq[v1, u1] * du * dv)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def main(src_dir):
    os.makedirs(PANOS, exist_ok=True)
    os.makedirs(CARDS, exist_ok=True)

    for room in ROOMS:
        im = Image.open(find_source(src_dir, room)).convert('RGB')
        w, h = im.size

        im.save(os.path.join(PANOS, room + '.webp'), 'WEBP', quality=80, method=6)
        im.resize((SM_W, SM_W * h // w), Image.LANCZOS).save(
            os.path.join(PANOS, room + '-sm.webp'), 'WEBP', quality=76, method=6)
        im.resize((LQIP_W, max(1, LQIP_W * h // w)), Image.LANCZOS).save(
            os.path.join(PANOS, room + '-lqip.webp'), 'WEBP', quality=48, method=6)

        eq = np.asarray(im).astype(np.float32)
        rectilinear(eq, CARD_YAW[room], CARD_W, CARD_H, CARD_FOV).save(
            os.path.join(CARDS, room + '.webp'), 'WEBP', quality=80, method=6)

        print('built', room)

    cover = Image.open(find_source(src_dir, ROOMS[0])).convert('RGB')
    w, h = cover.size
    ch = int(w * 630 / 1200)
    cover.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch)).resize(
        (1200, 630), Image.LANCZOS).save(
        os.path.join(HERE, 'site', 'assets', 'og-cover.jpg'),
        'JPEG', quality=82, optimize=True)
    print('built og-cover.jpg')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
