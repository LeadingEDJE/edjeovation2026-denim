#!/usr/bin/env bash
set -euo pipefail

IOS_BOOKING="${IOS_BOOKING:-docs/submission/demo/captures/ios-booking-autoplay-test.mp4}"
WEB_FLOW="${WEB_FLOW:-docs/submission/demo/captures/web-associate-flow-for-ios-booking.webm}"
IOS_RECAP="${IOS_RECAP:-docs/submission/demo/captures/ios-recap-autoplay-targeted.mp4}"
OUTPUT="${OUTPUT:-docs/submission/demo/captures/denim-fit-demo-draft.mp4}"
WIDTH="${WIDTH:-1920}"
HEIGHT="${HEIGHT:-1080}"

fail() {
	printf "FAIL: %s\n" "$1" >&2
	exit 1
}

command -v ffmpeg >/dev/null 2>&1 || fail "ffmpeg is required"

for input in "$IOS_BOOKING" "$WEB_FLOW" "$IOS_RECAP"; do
	[[ -f "$input" ]] || fail "Missing input: $input"
done

mkdir -p "$(dirname "$OUTPUT")"

ffmpeg -y \
	-i "$IOS_BOOKING" \
	-i "$WEB_FLOW" \
	-i "$IOS_RECAP" \
	-filter_complex "\
[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0xF6F3EF,setsar=1,fps=30,format=yuv420p[v0];\
[1:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0xF6F3EF,setsar=1,fps=30,format=yuv420p[v1];\
[2:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0xF6F3EF,setsar=1,fps=30,format=yuv420p[v2];\
[v0][v1][v2]concat=n=3:v=1:a=0[v]" \
	-map "[v]" \
	-c:v libx264 \
	-preset medium \
	-crf 20 \
	-movflags +faststart \
	"$OUTPUT"

printf "Saved assembled demo draft to %s\n" "$OUTPUT"
