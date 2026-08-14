#!/bin/sh
# Conform the motion-graphics intro to the body's exact encode parameters, then
# join them without re-encoding the 11-minute body.
set -e
cd "$(dirname "$0")"
FF=/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2

INTRO=${1:-intro_v2.mp4}
BODY=${2:-body_mg.mp4}
OUT=${3:-BertJim_connection_motion.mp4}

# The intro is silent; give it a matching mono 48k AAC track so the concat
# demuxer sees identical stream layouts on both sides.
"$FF" -hide_banner -loglevel error -i "$INTRO" \
  -f lavfi -i anullsrc=channel_layout=mono:sample_rate=48000 \
  -vf "fps=25,format=yuv420p" \
  -c:v libx264 -preset fast -crf 26 -profile:v high -level 4.1 \
  -c:a aac -b:a 128k -ac 1 -ar 48000 \
  -shortest -y intro_conformed.mp4

printf "file '%s'\nfile '%s'\n" intro_conformed.mp4 "$BODY" > concat.txt
"$FF" -hide_banner -loglevel error -f concat -safe 0 -i concat.txt \
  -c copy -movflags +faststart -y "$OUT"

echo "--- $OUT ---"
"$FF" -hide_banner -i "$OUT" 2>&1 | grep -E "Duration|Stream #0:"
