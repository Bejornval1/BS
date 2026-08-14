#!/usr/bin/env python3
"""Emit the ffmpeg filter_complex script.

The waveform is drawn once in white, then tinted per frame by whichever speaker
is on air -- the gates are disjoint in time, so exactly one colorchannelmixer
applies at a time. That costs one showwaves pass instead of three.
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
META = json.load(open(os.path.join(HERE, "render_meta.json")))

W, H = 1920, 1080
FPS = 25
WAVE_H = 360
WAVE_TOP = 210
MARGIN = 96
WAVE_W = 1920 - 2 * 96   # keep the wave on the same margin grid as the chrome
BAR_Y = 1046
BG = "0x0A0E14"
DUR = META["duration"]


def mixer(rgb, gate, gain=1.0):
    r, g, b = [min(1.0, c / 255.0 * gain) for c in rgb]
    return (f"colorchannelmixer=rr={r:.4f}:gg={g:.4f}:bb={b:.4f}"
            f":enable='{gate}'")


def main():
    gates = META["gates"]
    chain = ",".join([
        mixer(META["colors"]["speaker_0"], gates["speaker_0"]),
        mixer(META["colors"]["speaker_1"], gates["speaker_1"]),
        mixer(META["neutral"], gates["_silence"], gain=0.85),
    ])

    prog_w = W - 2 * MARGIN

    parts = [
        # live waveform, white, then speaker-tinted
        f"[0:a]showwaves=s={WAVE_W}x{WAVE_H}:mode=cline:rate={FPS}:"
        f"colors=0xFFFFFF:scale=sqrt,format=rgba[wraw]",
        f"[wraw]{chain}[wtint]",
        f"[wtint]pad={W}:{H}:{MARGIN}:{WAVE_TOP}:color=black,format=rgba[wpad]",

        # dark ground; additive blend keeps the wave's anti-aliasing clean
        f"color=c={BG}:s={W}x{H}:r={FPS},format=rgba[bg]",
        f"[bg][wpad]blend=all_mode=addition:shortest=1,format=rgba[v1]",

        # static chrome
        f"[v1][1:v]overlay=0:0:shortest=1[v2]",

        # playhead sweeping the baked-in speaker timeline. A fill bar would
        # cover the colour-coding, so this is a marker instead. (The running
        # timecode rides in captions.ass -- no drawtext in this build.)
        f"[v2]drawbox=x='{MARGIN}+{prog_w}*min(1\\,t/{DUR:.3f})-1':y={BAR_Y - 12}:"
        f"w=3:h=20:color=0xFFFFFF@0.95:t=fill[v3]",

        # burned-in captions
        f"[v3]subtitles=captions.ass:fontsdir=fonts:alpha=1[vout]",
    ]

    out = os.path.join(HERE, "filter.txt")
    open(out, "w").write(";\n".join(parts) + "\n")
    print(f"wrote {out} ({os.path.getsize(out)} bytes)")


if __name__ == "__main__":
    main()
