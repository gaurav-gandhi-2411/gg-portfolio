"""Regenerate the self-hosted, subset web fonts in app/fonts/.

Why this exists: next/font/google ships each family's whole "latin" subset
(Fraunces alone is 121 kB with its four axes), and every byte of it is in
the critical path of the first paint. Mobile Lighthouse models the load as
bytes over a 1.6 Mbps link, so the three preloaded fonts (184 kB) were the
largest single contributor to a ~3.0 s LCP. The pages render ~90 distinct
characters per family, so the files are cut to app/fonts/core-chars.txt.

What changes and what does not:
  - Glyph outlines, kerning/ligature features and every variable axis range
    are untouched. Only the character set shrinks. Verified width-identical
    to the files next/font/google shipped across wght 400-700 and the
    opsz/SOFT/WONK settings the site uses; limiting any axis (tried: SOFT
    0..12, wght 400..700 for a further 13 kB) shifts advance widths by up
    to 0.4% and reflows text, so it is deliberately not done.
  - Characters outside core-chars.txt fall through to the metric-matched
    fallback font, exactly as characters outside Google's "latin" subset
    (arrows, Greek, rupee) already did. e2e/font-coverage.spec.ts fails if
    any page renders a character that was in the old latin subset but is
    missing here, so adding copy with, say, an accented capital cannot ship
    a silent fallback.

Run (needs fonttools + brotli; use a throwaway venv, never a global env):
    python -m venv .venv-fonts && .venv-fonts/Scripts/pip install fonttools==4.66.1 brotli
    .venv-fonts/Scripts/python scripts/subset-fonts.py

Licences: all three families are SIL OFL 1.1. Licence texts:
app/fonts/JetBrainsMono-OFL.txt (upstream JetBrains/JetBrainsMono OFL.txt) and the
existing assets/fonts/Fraunces-OFL.txt and SpaceGrotesk-OFL.txt (not duplicated, to keep the
diff small); keep them with the files if the fonts move.

Output is byte-deterministic for a given upstream file (check with sha256sum).

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

# (css2 family query, output file, axis limits applied after subsetting)
# Limits stay empty on purpose: instancer re-normalises the axes, which moved advance widths by
# 0.1-0.4% (measured against the files next/font/google shipped), enough to reflow text and
# shift every visual-regression baseline. Charset subsetting alone is width-identical.
FAMILIES: list[tuple[str, str, dict[str, tuple[float, float]]]] = [
    ("Space+Grotesk:wght@300..700", "space-grotesk-latin-core.woff2", {}),
    (
        "Fraunces:opsz,wght,SOFT,WONK@9..144,100..900,0..100,0..1",
        "fraunces-latin-core.woff2",
        {},
    ),
    ("JetBrains+Mono:wght@100..800", "jetbrains-mono-latin-core.woff2", {}),
]

# The exact UA next/font/google sends (node_modules/next/dist/compiled/@next/font/dist/google/
# fetch-resource.js). The Fonts API keys the FILE it serves on the UA, not just the format: a
# Chrome/130 UA got a build whose advance widths differ from the one the site shipped
# (Space Grotesk 600: 179 px vs 189 px for the same string), which would silently reflow text.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
)


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
    # recalcTimestamp=False: fontTools otherwise stamps head.modified with the current time on
    # save, making every run's bytes differ. checkSumAdjustment is recomputed on save regardless.
    font = TTFont(io.BytesIO(fetch(latin_woff2_url(family_query))), recalcTimestamp=False)
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
