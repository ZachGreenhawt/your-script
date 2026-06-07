import json
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


def glyph_paths(font_path, text, font_size, letter_spacing):
    font = TTFont(font_path)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"].metrics
    upem = font["head"].unitsPerEm
    scale = font_size / upem
    space_advance = hmtx.get("space", (upem * 0.25, 0))[0]

    x = 0
    paths = []

    for i, ch in enumerate(text):
        name = cmap.get(ord(ch))
        advance = hmtx.get(name, (space_advance, 0))[0] if name else space_advance

        if name:
            pen = SVGPathPen(glyphs)
            glyphs[name].draw(pen)
            d = pen.getCommands()
            if d:
                paths.append(
                    f'<path d="{d}" transform="translate({x * scale:.3f} 0) scale({scale:.6f} {-scale:.6f})"/>'
                )

        x += advance
        if i < len(text) - 1:
            x += letter_spacing / scale

    return {"width": x * scale, "paths": "".join(paths)}


if __name__ == "__main__":
    font_path, text, font_size, letter_spacing = sys.argv[1:5]
    print(json.dumps(glyph_paths(font_path, text, float(font_size), float(letter_spacing))))
