# Watermark fonts

Noto Sans Regular and Bold are bundled for Sharp/Pango server-side watermark text.
They are distributed under the SIL Open Font License 1.1; see OFL.txt.

Source: https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans
Files: NotoSans-Regular.ttf and NotoSans-Bold.ttf, downloaded 2026-09-30.
License source: https://github.com/notofonts/noto-fonts/blob/main/LICENSE

These fonts cover Latin text, Indonesian addresses, accented Latin letters, digits,
punctuation, plus/minus, middle dot, and ellipsis. Emoji and arbitrary non-Latin
scripts are not guaranteed by these two font files.

Keep this directory in the application root when deploying with npm install and
next start. next.config.ts explicitly includes the TTF files and license in output
file tracing, so standalone output also contains assets/fonts relative to its
server.js. Start standalone Node with that standalone directory as the working
directory. Font paths resolve from process.cwd(), without an OS font installation
or a network download at runtime. Missing files fail photo processing rather than
silently falling back to a system font.

The existing layout supplies each line's position and font size. Sharp's text
input receives an absolute fontfile path, the matching Noto Sans family/weight,
and 72 DPI (one point per pixel). Each line is rasterized independently; only the
background panel uses SVG. The final authoritative overlay remains server-side.
