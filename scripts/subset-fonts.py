"""Regenerate the self-hosted, subset web fonts in app/fonts/.

Why this exists: next/font/google ships each family's whole "latin" subset
(Fraunces alone is 121 kB with its four axes), and every byte of it is in
the critical path of the first paint. Mobile Lighthouse models the load as
bytes over a 1.6 Mbps link, so the three preloaded fonts (184 kB) were the
largest single contributor to a ~3.0 s LCP. The pages render ~90 distinct
characters per family, so the files are cut to app/fonts/core-chars.txt.

What changes and what does not:
  - Glyph outlines, kerning/ligature features and every variable axis range
    are untouched, with ONE exception: Fraunces' SOFT axis is limited to
    0..SOFT_MAX. The site only ever sets SOFT to 0 or 12 (app/hero.css,
    app/case-study.css); the other 88% of the axis range is dead weight.
  - Characters outside core-chars.txt fall through to the metric-matched
    fallback font, exactly as characters outside Google's "latin" subset
    (arrows, Greek, rupee) already did. e2e/font-coverage.spec.ts fails if
    any page renders a character that was in the old latin subset but is
    missing here, so adding copy with, say, an accented capital cannot ship
    a silent fallback.

Run (needs fonttools + brotli; use a throwaway venv, never a global env):
    python -m venv .venv-fonts && .venv-fonts/Scripts/pip install fonttools==4.66.1 brotli
    .venv-fonts/Scripts/python scripts/subset-fonts.py

Sources are fetched from the Google Fonts CSS2 API (OFL-licensed families)
with the same axis ranges next/font/google requested.
"""
from __future__ import annotations

import io
import re
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONTS_DIR = Path(__file__).resolve().parent.parent / "app" / "fonts"
CHARSET = (FONTS_DIR / "core-chars.txt").read_text(encoding="utf-8").replace("\n", "")

# Highest SOFT value used anywhere: font-variation-settings in app/case-study.css (12).
SOFT_MAX = 12

# Weights used anywhere: 400 (default), 500 (font-medium), 600 (font-semibold), 700 (UA bold).
# Nothing sets 100-300 or 800-900, so those ends of the wght axis are dead weight.
WGHT = (400, 700)

# (css2 family query, output file, axis limits applied after subsetting)
FAMILIES: list[tuple[str, str, dict[str, tuple[float, float]]]] = [
    ("Space+Grotesk:wght@300..700", "space-grotesk-latin-core.woff2", {"wght": WGHT}),
    (
        "Fraunces:opsz,wght,SOFT,WONK@9..144,100..900,0..100,0..1",
        "fraunces-latin-core.woff2",
        {"wght": WGHT, "SOFT": (0, SOFT_MAX)},
    ),
    ("JetBrains+Mono:wght@100..800", "jetbrains-mono-latin-core.woff2", {"wght": WGHT}),
]

# A modern UA so the API answers with woff2 and per-unicode-range blocks.
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"


def fetch(url: str) -> bytes:
    """GET a URL with the modern-browser UA the Fonts API keys its response on."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310 - fixed https URLs
        return response.read()


def latin_woff2_url(family_query: str) -> str:
    """Return the woff2 URL of the `/* latin */` block of a CSS2 response."""
    css = fetch(f"https://fonts.googleapis.com/css2?family={family_query}&display=swap").decode()
    match = re.search(r"/\* latin \*/\s*@font-face\s*\{[^}]*?url\((https://[^)]+\.woff2)\)", css)
    if match is None:
        raise RuntimeError(f"no latin block in CSS2 response for {family_query}")
    return match.group(1)


def build(family_query: str, limits: dict[str, tuple[float, float]]) -> bytes:
    """Download a family's latin woff2, subset it to CHARSET and limit axes; return woff2 bytes."""
    font = TTFont(io.BytesIO(fetch(latin_woff2_url(family_query))))
    options = subset.Options()
    options.layout_features = ["*"]
    options.flavor = "woff2"
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=CHARSET)
    subsetter.subset(font)
    if limits:
        font = instancer.instantiateVariableFont(font, limits)
    font.flavor = "woff2"
    out = io.BytesIO()
    font.save(out)
    return out.getvalue()


def main() -> None:
    """Write every family into app/fonts/ and print the resulting sizes."""
    for family_query, filename, limits in FAMILIES:
        data = build(family_query, limits)
        (FONTS_DIR / filename).write_bytes(data)
        print(f"{filename}: {len(data)} bytes")


if __name__ == "__main__":
    main()
