#!/usr/bin/env python3
"""Inline the DizArch site into one self-contained HTML file.

The multi-file version in this directory is the source you edit. This produces
dist/index.html with the CSS, JS, libraries and font folded in, for hosts that
take a single file (or for opening straight off a USB stick).

    python3 build.py
"""

import base64
import re
from pathlib import Path

ROOT = Path(__file__).parent
DIST = ROOT / "dist"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def font_data_uri() -> str:
    raw = (ROOT / "fonts/Vazirmatn-Variable.woff2").read_bytes()
    return "data:font/woff2;base64," + base64.b64encode(raw).decode("ascii")


def main() -> None:
    html = read("index.html")
    css = read("css/style.css")

    # font first: the @font-face url is relative to css/, which stops existing
    # once the stylesheet is inlined
    css = re.sub(
        r"src:\s*url\('\.\./fonts/Vazirmatn-Variable\.woff2'\)[^;]*;",
        f"src: url('{font_data_uri()}') format('woff2');",
        css,
        count=1,
    )

    html = html.replace(
        '<link rel="preload" href="fonts/Vazirmatn-Variable.woff2" as="font" type="font/woff2" crossorigin>\n',
        "",
    )
    html = html.replace(
        '<link rel="stylesheet" href="css/style.css">',
        f"<style>\n{css}\n</style>",
    )

    scripts = "\n".join(
        f"<script>\n{read(src)}\n</script>"
        for src in (
            "vendor/lenis.min.js",
            "vendor/gsap.min.js",
            "vendor/ScrollTrigger.min.js",
            "js/app.js",
        )
    )
    html = re.sub(
        r'<script src="vendor/lenis\.min\.js"></script>.*?<script src="js/app\.js"></script>',
        lambda _: scripts,
        html,
        flags=re.S,
    )

    DIST.mkdir(exist_ok=True)
    out = DIST / "index.html"
    out.write_text(html, encoding="utf-8")

    # the commented-out hero <img>/<video> are meant to stay unresolved
    live = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    leftovers = re.findall(r'(?:src|href)="(?!data:|#|https?:|mailto:|tel:)([^"]+)"', live)
    if leftovers:
        print("warning — still referencing local files:", sorted(set(leftovers)))

    print(f"built {out}  ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
