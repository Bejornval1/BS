#!/usr/bin/env python3
"""Readable speaker-attributed transcript (Markdown) from the diarization JSON."""

import json
import os

from build_captions import SPEAKERS, load_tokens

HERE = os.path.dirname(os.path.abspath(__file__))
TURN_GAP = 1.2   # a same-speaker pause longer than this starts a new paragraph


def ts(t):
    return f"{int(t // 60):02d}:{int(t % 60):02d}"


def main():
    d, toks = load_tokens()
    duration = float(d["duration"])

    turns = []
    for tk in toks:
        if turns and turns[-1]["speaker"] == tk["speaker"] \
                and tk["start"] - turns[-1]["end"] <= TURN_GAP:
            turns[-1]["toks"].append(tk)
            turns[-1]["end"] = tk["end"]
        else:
            turns.append({"speaker": tk["speaker"], "toks": [tk],
                          "start": tk["start"], "end": tk["end"]})

    out = [
        "# The Bert–Jim Connection — call transcript",
        "",
        "Source: `BertJim_connection.m4a` · "
        f"{int(duration // 60)}:{int(duration % 60):02d} · mono",
        "",
        "Transcribed and diarized with ElevenLabs Scribe v2 (word-level timestamps, "
        "2 speakers detected).",
        "",
        "**Speaker roles are inferred from the conversation, not stated in it:**",
        "",
        "| Label | Who | Talk time |",
        "|---|---|---|",
    ]

    talk = {}
    for t in turns:
        talk[t["speaker"]] = talk.get(t["speaker"], 0.0) + (t["end"] - t["start"])

    notes = {
        "speaker_0": "The family researcher. Says *\"it's been weird in our family "
                     "the whole entire time\"*; the other speaker places him "
                     "*\"out there in Utah\"*.",
        "speaker_1": "Has the physical succession file and reads it aloud. Invites "
                     "the other to *\"come here and search these little records\"* "
                     "somewhere ~99°F and humid — Claiborne Parish, Louisiana.",
    }
    for sp in ("speaker_0", "speaker_1"):
        out.append(f"| **{SPEAKERS[sp]['label']}** | {notes[sp]} | "
                   f"{talk.get(sp, 0) / 60:.1f} min |")

    out += ["", "---", ""]

    for t in turns:
        label = SPEAKERS[t["speaker"]]["label"]
        text = " ".join(x["text"] for x in t["toks"]).strip()
        if not text:
            continue
        out.append(f"**`{ts(t['start'])}`  {label}**  \n{text}")
        out.append("")

    path = os.path.join(HERE, "TRANSCRIPT.md")
    open(path, "w").write("\n".join(out))
    print(f"wrote {path}: {len(turns)} turns")


if __name__ == "__main__":
    main()
