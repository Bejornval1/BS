#!/usr/bin/env python3
"""Build ASS/SRT captions + speaker-gating expressions from an ElevenLabs Scribe
diarization JSON (word-level timestamps + speaker IDs)."""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DIAR = os.path.join(HERE, "diar.json")

W, H = 1920, 1080

# --- speaker identity -------------------------------------------------------
# Roles are inferred from the conversation itself:
#   speaker_0 -- the family researcher ("it's been weird in our family"), who the
#                other speaker says is "out there in Utah".
#   speaker_1 -- the one physically holding the Claiborne Parish succession file,
#                reading it aloud, who invites the other to "come here and search".
SPEAKERS = {
    "speaker_0": {
        "label": "RESEARCHER",
        "long": "RESEARCHER  ·  calling from Utah",
        "rgb": (255, 184, 77),  # amber
    },
    "speaker_1": {
        "label": "CLERK",
        "long": "CLERK  ·  reading the Claiborne Parish file",
        "rgb": (82, 209, 240),  # cyan
    },
}
NEUTRAL = (108, 122, 137)
TEXT_RGB = (233, 239, 245)

CAP_MARGIN_V = 132      # main caption block, anchored from the bottom
CHIP_MARGIN_V = 330     # float lane for overlapping speech, above the main block
TC_X, TC_Y = 160, 1002  # running timecode, clear of the CC badge

# --- caption grouping knobs -------------------------------------------------
MAX_LINE_CHARS = 46
MAX_LINES = 2
MAX_CHARS = MAX_LINE_CHARS * MAX_LINES
MAX_DUR = 6.0
GAP_BREAK = 0.8
MIN_DUR = 1.15          # preferred minimum time on screen
HARD_MIN_DUR = 0.55     # never shrink below this, even to avoid an overlap
LEAD_IN = 0.10          # show a caption slightly before the first word
ORPHAN_WORDS = 3        # tail fragments this short get merged back
BACKCHANNEL_WORDS = 4   # "Right." / "Mm-hmm" -- candidates for the float lane
BACKCHANNEL_MAX_DUR = 1.30  # brief enough that it would flash in the main lane
WORD_MIN_SPAN = 0.45    # shortest span a single word is allowed to claim
WORD_MAX_SPAN = 2.20    # longest, before length-scaling caps it lower
EVENT_MAX_SPAN = 3.00   # "[paper rustling]" can run for 35s -- don't caption that long


def ass_colour(rgb, alpha=0):
    r, g, b = rgb
    return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"


def plausible_end(text, start, end, is_event):
    """Scribe pads a token's end out to the next token, so a word spoken before a
    long pause can claim a 75-second span. Left alone that pins a caption on
    screen for over a minute and tints the waveform through dead air, so cap each
    token at a duration its own text could actually occupy."""
    if is_event:
        cap = EVENT_MAX_SPAN
    else:
        cap = min(WORD_MAX_SPAN, max(WORD_MIN_SPAN, 0.20 + 0.085 * len(text)))
    return min(end, start + cap)


def load_tokens():
    d = json.load(open(DIAR))
    toks = []
    for x in d["words"]:
        t = (x.get("text") or "").strip()
        if not t:
            continue
        is_event = x.get("type") == "audio_event"
        start = float(x["start"])
        toks.append({
            "text": t,
            "start": start,
            "end": plausible_end(t, start, float(x["end"]), is_event),
            "speaker": x.get("speaker") or "speaker_0",
            "event": is_event,
        })
    toks.sort(key=lambda x: x["start"])
    return d, toks


def _split_at_clause(toks):
    """When a cue must be broken for length, prefer the last clause boundary in
    the back third of the buffer so chunks end on a natural pause."""
    n = len(toks)
    if n < 6:
        return None
    for i in range(n - 1, max(1, int(n * 0.55)) - 1, -1):
        if toks[i - 1]["text"].endswith((",", ";", ":", "--")):
            return i
    return None


def group_cues(toks):
    """Group words into caption cues, breaking on speaker change, long gaps,
    sentence ends, length and duration limits."""
    cues = []
    cur = None

    def flush(keep_from=None):
        """Emit the current cue. If keep_from is set, split there and carry the
        remainder into a new cue instead of emitting the whole buffer."""
        nonlocal cur
        if not (cur and cur["toks"]):
            cur = None
            return
        if keep_from is not None and 0 < keep_from < len(cur["toks"]):
            head, tail = cur["toks"][:keep_from], cur["toks"][keep_from:]
            cues.append({"speaker": cur["speaker"], "toks": head,
                         "start": head[0]["start"], "end": head[-1]["end"]})
            cur = {"speaker": cur["speaker"], "toks": tail,
                   "start": tail[0]["start"], "end": tail[-1]["end"]}
            return
        cues.append(cur)
        cur = None

    for tk in toks:
        # a bare ellipsis token only marks resumed speech -- drop it at a boundary
        if cur is None and tk["text"].strip(".") == "":
            continue
        if cur is None:
            cur = {"speaker": tk["speaker"], "toks": [tk],
                   "start": tk["start"], "end": tk["end"]}
            continue

        prev = cur["toks"][-1]
        text_len = len(" ".join(t["text"] for t in cur["toks"]))
        gap = tk["start"] - prev["end"]
        ends_sentence = prev["text"].endswith((".", "?", "!"))
        too_long = text_len + 1 + len(tk["text"]) > MAX_CHARS

        hard_brk = (
            tk["speaker"] != cur["speaker"]
            or tk["event"] or prev["event"]
            or gap > GAP_BREAK
            or tk["end"] - cur["start"] > MAX_DUR
            or (ends_sentence and text_len >= 28)
        )
        if hard_brk:
            flush()
            cur = {"speaker": tk["speaker"], "toks": [tk],
                   "start": tk["start"], "end": tk["end"]}
        elif too_long:
            # break for length, preferring a clause boundary
            flush(keep_from=_split_at_clause(cur["toks"]))
            if cur is None:
                cur = {"speaker": tk["speaker"], "toks": [tk],
                       "start": tk["start"], "end": tk["end"]}
            else:
                cur["toks"].append(tk)
                cur["end"] = tk["end"]
        else:
            cur["toks"].append(tk)
            cur["end"] = tk["end"]
    flush()

    # merge orphan tail fragments back into the previous cue of the same speaker
    merged = []
    for c in cues:
        if merged:
            p = merged[-1]
            same = p["speaker"] == c["speaker"]
            gap = c["start"] - p["end"]
            short = len(c["toks"]) <= ORPHAN_WORDS
            fits = len(" ".join(t["text"] for t in p["toks"] + c["toks"])) <= MAX_CHARS + 12
            events = any(t["event"] for t in p["toks"] + c["toks"])
            if same and short and fits and not events and gap < 0.45:
                p["toks"] += c["toks"]
                p["end"] = c["end"]
                continue
        merged.append(c)
    cues = merged

    # timing hygiene -- apply lead-in to every cue first
    for c in cues:
        c["start"] = max(0.0, c["start"] - LEAD_IN)
        c["chip"] = False

    # Classify back-channels: a brief "Right." / "Mm-hmm" dropped into the middle
    # of the other speaker's run. Scribe timestamps words sequentially, so these
    # never literally overlap -- but they are far too short to hold the main
    # caption line without flashing, and padding them there would collide with
    # the speech around them. Float them on their own line instead, where they
    # can sit long enough to read while the main caption keeps flowing.
    for i, c in enumerate(cues):
        if len(c["toks"]) > BACKCHANNEL_WORDS:
            continue
        if (c["end"] - c["start"]) >= BACKCHANNEL_MAX_DUR:
            continue
        prev_sp = cues[i - 1]["speaker"] if i > 0 else None
        next_sp = cues[i + 1]["speaker"] if i + 1 < len(cues) else None
        neighbours = [s for s in (prev_sp, next_sp) if s is not None]
        if neighbours and all(s != c["speaker"] for s in neighbours):
            c["chip"] = True

    # de-overlap each lane independently (main captions, floating chips)
    for lane in (False, True):
        lane_cues = [c for c in cues if c["chip"] == lane]
        for i, c in enumerate(lane_cues):
            if c["end"] - c["start"] < MIN_DUR:
                c["end"] = c["start"] + MIN_DUR
            if i + 1 < len(lane_cues):
                limit = lane_cues[i + 1]["start"] - 0.04
                if c["end"] > limit:
                    c["end"] = max(c["start"] + HARD_MIN_DUR, limit)
    return cues


def wrap(words, max_chars=MAX_LINE_CHARS, max_lines=MAX_LINES):
    """Greedy wrap, then rebalance two lines so they read evenly."""
    lines, cur = [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if cur and len(cand) > max_chars:
            lines.append(cur)
            cur = w
        else:
            cur = cand
    if cur:
        lines.append(cur)

    if len(lines) == 2:  # rebalance
        allw = (lines[0] + " " + lines[1]).split()
        best, bestcost = lines, 1e9
        for k in range(1, len(allw)):
            a, b = " ".join(allw[:k]), " ".join(allw[k:])
            if len(a) > max_chars or len(b) > max_chars:
                continue
            cost = abs(len(a) - len(b))
            if cost < bestcost:
                best, bestcost = [a, b], cost
        lines = best
    return lines[:max_lines]


def fmt_ass_time(t):
    t = max(0.0, t)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h:d}:{m:02d}:{s:05.2f}"


def fmt_srt_time(t):
    t = max(0.0, t)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    if ms == 1000:
        ms = 999
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_ass(cues, path, duration):
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Instrument Sans,54,{ass_colour(TEXT_RGB)},{ass_colour(TEXT_RGB)},&H96000000,&H78000000,-1,0,0,0,100,100,0.4,0,1,3.4,1.6,2,180,180,{CAP_MARGIN_V},1
Style: TC,JetBrains Mono,24,&H26F5EFE9,&H26F5EFE9,&H80000000,&H00000000,-1,0,0,0,100,100,0,0,1,2.0,0,7,0,0,0,1
Style: Chip,Instrument Sans,38,{ass_colour(TEXT_RGB)},{ass_colour(TEXT_RGB)},&H96000000,&H78000000,-1,0,0,0,100,100,0.4,0,1,3.0,1.4,2,180,180,{CHIP_MARGIN_V},1
"""
    lines = [head, "[Events]",
             "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]

    for c in cues:
        sp = SPEAKERS[c["speaker"]]
        col = ass_colour(sp["rgb"])
        words = [t["text"] for t in c["toks"]]
        is_event = all(t["event"] for t in c["toks"])
        chip = c.get("chip")
        body_lines = wrap(words, max_chars=54 if chip else MAX_LINE_CHARS)
        body = r"\N".join(body_lines)
        body = body.replace("{", "(").replace("}", ")")

        if chip:
            # simultaneous speech: one compact line floating above the main caption
            txt = (r"{\fs30\b1\c" + col + r"&\fsp2}" + sp["label"] + ":  "
                   + r"{\fsp0\fs38\c" + ass_colour(TEXT_RGB) + r"&}" + body)
            style = "Chip"
        elif is_event:
            # non-speech sound: italic, in the speaker's colour, no name tag
            txt = (r"{\fs42\i1\c" + col + r"&\b0}" + body)
            style = "Cap"
        else:
            txt = (r"{\fs34\b1\c" + col + r"&\fsp2}" + sp["label"] + r"{\fsp0}\N"
                   + r"{\fs54\b1\c" + ass_colour(TEXT_RGB) + r"&}" + body)
            style = "Cap"

        lines.append(
            f"Dialogue: {1 if chip else 0},{fmt_ass_time(c['start'])},"
            f"{fmt_ass_time(c['end'])},{style},{sp['label']},0,0,0,,{txt}"
        )

    # running timecode -- this ffmpeg build has no drawtext, so it rides along
    # as one subtitle event per second, pinned bottom-left over the progress bar
    for s in range(int(duration) + 1):
        lines.append(
            f"Dialogue: 0,{fmt_ass_time(s)},{fmt_ass_time(min(s + 1, duration))},"
            f"TC,,0,0,0,,{{\\pos({TC_X},{TC_Y})}}{s // 60:02d}:{s % 60:02d}"
        )

    open(path, "w").write("\n".join(lines) + "\n")


def build_srt(cues, path):
    out = []
    for i, c in enumerate(cues, 1):
        sp = SPEAKERS[c["speaker"]]
        words = [t["text"] for t in c["toks"]]
        is_event = all(t["event"] for t in c["toks"])
        body = "\n".join(wrap(words))
        text = body if is_event else f"[{sp['label']}]\n{body}"
        out.append(f"{i}\n{fmt_srt_time(c['start'])} --> {fmt_srt_time(c['end'])}\n{text}\n")
    open(path, "w").write("\n".join(out))


def build_vtt(cues, path):
    """WebVTT sidecar. Uses voice spans so web players can style each speaker."""
    out = ["WEBVTT", ""]
    for c in cues:
        sp = SPEAKERS[c["speaker"]]
        words = [t["text"] for t in c["toks"]]
        is_event = all(t["event"] for t in c["toks"])
        body = "\n".join(wrap(words))
        text = body if is_event else f"<v {sp['label']}>{body}"
        out.append(f"{fmt_srt_time(c['start']).replace(',', '.')} --> "
                   f"{fmt_srt_time(c['end']).replace(',', '.')}\n{text}\n")
    open(path, "w").write("\n".join(out))


def speaker_intervals(toks, merge_gap=0.45, pad=0.12, duration=None):
    """Merged on-air intervals per speaker, for gating the waveform tint."""
    per = {}
    for tk in toks:
        sp = tk["speaker"]
        iv = per.setdefault(sp, [])
        if iv and tk["start"] - iv[-1][1] <= merge_gap:
            iv[-1][1] = max(iv[-1][1], tk["end"])
        else:
            iv.append([tk["start"], tk["end"]])
    for sp, iv in per.items():
        for seg in iv:
            seg[0] = max(0.0, seg[0] - pad)
            if duration:
                seg[1] = min(duration, seg[1] + pad)
            else:
                seg[1] += pad
        # re-merge after padding
        merged = []
        for seg in iv:
            if merged and seg[0] <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], seg[1])
            else:
                merged.append(seg)
        per[sp] = merged
    return per


def enable_expr(intervals):
    terms = "+".join(f"between(t,{a:.2f},{b:.2f})" for a, b in intervals)
    return f"gt({terms},0)" if terms else "0"


def main():
    d, toks = load_tokens()
    duration = float(d["duration"])
    cues = group_cues(toks)

    build_ass(cues, os.path.join(HERE, "captions.ass"), duration)
    build_srt(cues, os.path.join(HERE, "captions.srt"))
    build_vtt(cues, os.path.join(HERE, "captions.vtt"))

    per = speaker_intervals(toks, duration=duration)
    gate = {sp: enable_expr(iv) for sp, iv in per.items()}
    # neutral = when nobody is on air
    both = "+".join(
        f"between(t,{a:.2f},{b:.2f})"
        for sp in per for a, b in per[sp]
    )
    gate["_silence"] = f"lt({both},1)" if both else "1"

    json.dump(
        {
            "duration": duration,
            "gates": gate,
            "colors": {sp: SPEAKERS[sp]["rgb"] for sp in SPEAKERS},
            "neutral": NEUTRAL,
            "cue_count": len(cues),
            "talk_time": {
                sp: round(sum(b - a for a, b in iv), 1) for sp, iv in per.items()
            },
            # raw on-air spans, so the chrome can draw the whole call as a
            # speaker-coloured timeline
            "intervals": {
                sp: [[round(a, 2), round(b, 2)] for a, b in iv]
                for sp, iv in per.items()
            },
        },
        open(os.path.join(HERE, "render_meta.json"), "w"),
        indent=1,
    )

    print(f"cues: {len(cues)}  duration: {duration:.2f}s")
    for sp, iv in per.items():
        print(f"  {sp} ({SPEAKERS[sp]['label']}): {len(iv)} on-air spans, "
              f"{sum(b - a for a, b in iv):.1f}s")
    longest = max(len(g) for g in gate.values())
    print(f"  longest gate expression: {longest} chars")


if __name__ == "__main__":
    main()
