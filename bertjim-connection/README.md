# Bert–Jim connection call — captioned waveform video

Turns `BertJim_connection.m4a` (11:23, mono phone call, two speakers) into a
1920×1080 MP4: a live audio waveform that changes colour with whoever is
speaking, burned-in closed captions labelled by speaker, and a timeline strip
showing the turn-taking across the whole call.

## Speakers

Scribe reports two speakers. The labels below are **inferred from what is said**,
not stated in the recording:

| Track | Label | Evidence | Talk time |
|---|---|---|---|
| `speaker_0` | **RESEARCHER** (amber) | "it's been weird in our family the whole entire time"; the other speaker places him "out there in Utah" | 1.5 min |
| `speaker_1` | **CLERK** (cyan) | holds the physical succession file and reads it aloud; invites the other to "come here and search these little records" where it is ~99°F and humid | 5.0 min |

Rename them in `SPEAKERS` at the top of `build_captions.py` and re-run.

## Pipeline

```
m4a ──> ElevenLabs Scribe v2 ──> diar.json      (word timestamps + speaker IDs)
                                    │
        build_captions.py ──────────┼──> captions.ass   (burn-in, 2 colours + timecode)
                                    │    captions.srt / .vtt  (portable sidecars)
                                    │    render_meta.json
        build_overlay.py  ──────────┼──> overlay.png    (title, legend, speaker timeline)
        build_filter.py   ──────────┴──> filter.txt     (ffmpeg filter graph)
        build_transcript.py ───────────> TRANSCRIPT.md

  Creative Claw (HyperFrames, HTML/CSS -> MP4)
        bg_loop.html      ─────────────> bg_loop.mp4    (12s seamless motion loop)
        intro (see below) ─────────────> intro.mp4      (7.5s title sequence)
                                    │
                        ffmpeg ──> body_mg.mp4 ──> assemble.sh ──> final MP4
```

The layers are separate because `render_html_video` caps at 300s and this call
runs 683s. Splitting them also keeps each layer cheap to iterate: the intro is
one 5-credit render, the background is another, and neither forces a re-render
of the 11-minute body.

| Layer | Built by | Why there |
|---|---|---|
| Animated ground | Creative Claw, 12s seamless loop, `-stream_loop` | constant slow motion under everything |
| Waveform | ffmpeg `showwaves`, tinted per frame by speaker gates | must stay sample-accurate to the audio |
| Static chrome | Pillow → `overlay.png` | crisp text, rendered once |
| Active-speaker accents | ffmpeg `drawbox`, same gates | top bar + legend underline follow the voice |
| Captions | libass, kinetic fade + scale per cue | burned in, two speaker colours |
| Intro | Creative Claw, 7.5s | assembles the interface the body opens with |

Reproduce (needs `diar.json`, the source audio as `source.m4a`, `bg_loop.mp4`,
and fonts in `fonts/`):

```sh
python3 build_captions.py && python3 build_overlay.py && python3 build_filter.py
ffmpeg -i source.m4a -loop 1 -i overlay.png -stream_loop -1 -i bg_loop.mp4 \
  -/filter_complex filter.txt -map "[vout]" -map 0:a \
  -c:v libx264 -preset fast -crf 26 -pix_fmt yuv420p -profile:v high -level 4.1 \
  -c:a aac -b:a 128k -movflags +faststart -shortest body_mg.mp4
./assemble.sh intro.mp4 body_mg.mp4 final.mp4
```

### Matching the intro to the body

The intro ends holding the exact layout the body opens with, so the cut reads as
the animation completing rather than as a transition. Two things had to line up:

- **Title tracking.** Pillow puts 3px *between* glyphs (569.56px of ink); CSS
  `letter-spacing` adds a gap after every glyph, and Chromium's advances differ
  slightly. Assuming 3px drifted the title ~20px across 23 characters, which
  popped at the cut. The intro now measures itself at `letter-spacing:0` and
  solves for the value that reproduces the exact ink width.
- **Background phase.** The intro uses the same bloom/grid elements as the
  looping background and animates them so that at t=7.5s they land precisely on
  the loop's t=0 state.

## Notes on the transcript data

Two artefacts of Scribe's output are corrected in `build_captions.py`:

- **Stretched token spans.** A token's `end` is padded out to the next token, so
  a word before a long pause can claim a 75-second span (here, "You" at 00:58).
  Uncorrected, that pins one caption on screen for over a minute and tints the
  waveform through dead air. `plausible_end()` caps each token at a duration its
  own text could plausibly occupy.
- **Back-channels.** "Right." / "Mm-hmm" dropped into the middle of the other
  speaker's run are too short to hold the main caption line without flashing.
  They are floated on a second line above it instead, so both voices stay
  readable during rapid exchanges.

Caption text is left verbatim, including disfluencies and Scribe's own
mishearings of proper names (the surnames in the 1930s–40s succession filings
are read aloud from a document and are unreliable — treat names in the captions
as a pointer back to the audio, not as a citation).
