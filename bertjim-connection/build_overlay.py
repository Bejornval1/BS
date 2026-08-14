#!/usr/bin/env python3
"""Render the static chrome (title, legend, scrim, footer rules) as one RGBA PNG
that gets composited over the live waveform."""

import json
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = "/mnt/skills/examples/canvas-design/canvas-fonts"
META = json.load(open(os.path.join(HERE, "render_meta.json")))

W, H = 1920, 1080
BG = (10, 14, 20)
AMBER = tuple(META["colors"]["speaker_0"])
CYAN = tuple(META["colors"]["speaker_1"])
DIM = (128, 142, 158)
FAINT = (46, 56, 68)
TEXT = (233, 239, 245)

WAVE_TOP, WAVE_H = 210, 360
BAR_Y = 1046

TITLE = "THE BERT–JIM CONNECTION"
SUBTITLE = "Hurd succession records · Claiborne Parish, Louisiana"


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


F_TITLE = font("InstrumentSans-Bold.ttf", 36)
F_SUB = font("InstrumentSans-Regular.ttf", 23)
F_LEG = font("InstrumentSans-Bold.ttf", 22)
F_LEGSUB = font("InstrumentSans-Regular.ttf", 19)
F_MONO = font("JetBrainsMono-Bold.ttf", 24)
F_TINY = font("InstrumentSans-Bold.ttf", 17)


def tracked(draw, xy, text, fnt, fill, spacing=0.0, anchor_right=False):
    """Draw text with manual letter-spacing; returns total width."""
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + spacing * max(0, len(text) - 1)
    x, y = xy
    if anchor_right:
        x -= total
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += w + spacing
    return total


def main():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # ---- caption scrim: keeps text legible no matter what the wave is doing
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    top, bottom = 600, H
    for y in range(top, bottom):
        f = (y - top) / (bottom - top)
        a = int(232 * (f ** 0.72))
        sd.line([(0, y), (W, y)], fill=(*BG, a))
    img = Image.alpha_composite(img, scrim)
    d = ImageDraw.Draw(img)

    # ---- header
    d.line([(96, 60), (96, 132)], fill=(*TEXT, 235), width=3)
    tracked(d, (124, 62), TITLE, F_TITLE, (*TEXT, 255), spacing=3.0)
    d.text((126, 110), SUBTITLE, font=F_SUB, fill=(*DIM, 255))

    # ---- legend (top right): the whole point of the piece, so give it room
    lx, ly = W - 96, 60
    rows = [
        (AMBER, "RESEARCHER", "calling from Utah"),
        (CYAN, "CLERK", "reading the file aloud"),
    ]
    talk = META["talk_time"]
    total_talk = sum(talk.values()) or 1
    keys = ["speaker_0", "speaker_1"]
    for i, ((col, name, role), key) in enumerate(zip(rows, keys)):
        y = ly + i * 40
        wname = d.textlength(name, font=F_LEG)
        wrole = d.textlength(role, font=F_LEGSUB)
        share = talk[key] / total_talk
        barw = 108
        # role, right-aligned
        d.text((lx - wrole, y + 4), role, font=F_LEGSUB, fill=(*DIM, 255))
        # share bar
        bx = lx - wrole - 22 - barw
        d.rounded_rectangle([bx, y + 11, bx + barw, y + 16], radius=3,
                            fill=(*FAINT, 255))
        d.rounded_rectangle([bx, y + 11, bx + max(6, int(barw * share)), y + 16],
                            radius=3, fill=(*col, 255))
        # name
        nx = bx - 22 - wname
        d.text((nx, y), name, font=F_LEG, fill=(*col, 255))
        # swatch
        d.ellipse([nx - 32, y + 6, nx - 16, y + 22], fill=(*col, 255))

    # ---- waveform guide: centre axis + end ticks
    cy = WAVE_TOP + WAVE_H // 2
    d.line([(96, cy), (W - 96, cy)], fill=(*FAINT, 190), width=1)
    for x in (96, W - 96):
        d.line([(x, cy - 16), (x, cy + 16)], fill=(*FAINT, 220), width=2)

    # ---- footer: CC badge, progress track, total runtime
    d.rounded_rectangle([96, BAR_Y - 46, 96 + 46, BAR_Y - 16], radius=6,
                        outline=(*DIM, 200), width=2)
    d.text((108, BAR_Y - 42), "CC", font=F_TINY, fill=(*DIM, 230))

    dur = META["duration"]
    total = f"{int(dur // 60):d}:{int(dur % 60):02d}"
    d.text((W - 96 - d.textlength(total, font=F_MONO), BAR_Y - 44),
           total, font=F_MONO, fill=(*DIM, 230))

    # ---- speaker timeline: the whole call at a glance, colour-coded by voice.
    # Silence stays faint, so the turn-taking structure reads on its own.
    x0, x1 = 96, W - 96
    span = x1 - x0
    d.rounded_rectangle([x0, BAR_Y - 4, x1, BAR_Y + 8], radius=6,
                        fill=(*FAINT, 255))
    for key, col in (("speaker_0", AMBER), ("speaker_1", CYAN)):
        for a, b in META["intervals"].get(key, []):
            xa = x0 + span * (a / dur)
            xb = x0 + span * (b / dur)
            if xb - xa < 2:          # keep single-word interjections visible
                xb = xa + 2
            d.rectangle([xa, BAR_Y - 4, min(xb, x1), BAR_Y + 8], fill=(*col, 255))

    out = os.path.join(HERE, "overlay.png")
    img.save(out)
    print("wrote", out, img.size)


if __name__ == "__main__":
    main()
