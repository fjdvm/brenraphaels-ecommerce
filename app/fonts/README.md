# DM Sans

`dm-sans.woff2` is DM Sans 4.004, licensed under the included SIL Open Font
License (`DM-Sans-OFL.txt`). The Careers layout uses its existing 400–700 weights
and `--font-dm-sans` variable through `next/font/local`.

Source: [Google Fonts DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans),
`DMSans[opsz,wght].ttf`. The optical-size axis is fixed at 14, matching the
Google Fonts CSS previously used by `next/font/google`; the weight axis remains
variable. The full character set is retained. Checked glyph outlines and metrics
at weights 400, 500, 600 and 700 against Google's served WOFF2 (rounding differs by
at most one font unit).

To regenerate with FontTools and Brotli installed, download the source TTF and run:

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

font = instantiateVariableFont(TTFont("DMSans[opsz,wght].ttf"), {"opsz": 14})
font.flavor = "woff2"
font.save("dm-sans.woff2")
```

The local asset avoids the extensionless Google font URL parsing failure tracked
in [Next.js #99114](https://github.com/vercel/next.js/issues/99114). Builds no longer
fetch DM Sans CSS or font bytes from Google. Keep the license with the asset.
