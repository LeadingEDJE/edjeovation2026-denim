#!/usr/bin/env bash
set -euo pipefail

IOS_BOOKING="${IOS_BOOKING:-docs/submission/demo/captures/ios-booking-autoplay-final.mp4}"
WEB_FLOW="${WEB_FLOW:-docs/submission/demo/captures/web-associate-flow-final.webm}"
IOS_RECAP="${IOS_RECAP:-docs/submission/demo/captures/ios-recap-autoplay-final.mp4}"
VOICEOVER_TEXT="${VOICEOVER_TEXT:-docs/submission/demo/polished_voiceover.txt}"
OUTPUT="${OUTPUT:-docs/submission/demo/captures/denim-fit-demo-polished.mp4}"
WIDTH="${WIDTH:-1920}"
HEIGHT="${HEIGHT:-1080}"
TTS_ENGINE="${TTS_ENGINE:-edge}"
EDGE_TTS_VOICE="${EDGE_TTS_VOICE:-en-US-AvaNeural}"
EDGE_TTS_RATE="${EDGE_TTS_RATE:-+0%}"
VOICE="${VOICE:-Sandy (English (US))}"
VOICE_RATE="${VOICE_RATE:-155}"
WITH_VOICEOVER="${WITH_VOICEOVER:-1}"

fail() {
	printf "FAIL: %s\n" "$1" >&2
	exit 1
}

command -v ffmpeg >/dev/null 2>&1 || fail "ffmpeg is required"
command -v npx >/dev/null 2>&1 || fail "npx is required to render title cards"

for input in "$IOS_BOOKING" "$WEB_FLOW" "$IOS_RECAP"; do
	[[ -f "$input" ]] || fail "Missing input: $input"
done

mkdir -p "$(dirname "$OUTPUT")"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

render_card_image() {
	local output="$1"
	local main="$2"
	local sub="$3"
	local eyebrow="${4:-Denim Fit - Guided Fitting}"
	local html="$tmpdir/card.html"
	cat >"$html" <<HTML
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
html, body {
	margin: 0;
	width: ${WIDTH}px;
	height: ${HEIGHT}px;
	background: #203344;
	color: #ffffff;
	font-family: Arial, Helvetica, sans-serif;
}
.frame {
	box-sizing: border-box;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 96px;
	text-align: center;
}
.rule {
	width: 118px;
	height: 3px;
	background: #9fb6c6;
	margin-bottom: 34px;
}
.eyebrow {
	color: #9fb6c6;
	font-size: 24px;
	font-weight: 700;
	letter-spacing: 0.16em;
	text-transform: uppercase;
	margin-top: 50px;
}
h1 {
	font-size: 72px;
	line-height: 1.05;
	margin: 0;
	max-width: 1250px;
}
p {
	color: #d9e2e8;
	font-size: 34px;
	line-height: 1.3;
	margin: 24px 0 0;
	max-width: 1160px;
}
</style>
</head>
<body>
	<div class="frame">
		<div class="rule"></div>
		<h1>${main}</h1>
		<p>${sub}</p>
		<div class="eyebrow">${eyebrow}</div>
	</div>
</body>
</html>
HTML
	npx playwright screenshot --viewport-size="${WIDTH},${HEIGHT}" "file://${html}" "$output" >/dev/null
}

make_card() {
	local output="$1"
	local main="$2"
	local sub="$3"
	local image="$tmpdir/$(basename "$output" .mp4).png"
	render_card_image "$image" "$main" "$sub"
	ffmpeg -y -loop 1 -t 4 -i "$image" -vf "fps=30,format=yuv420p" \
		-c:v libx264 -preset medium -crf 20 "$output" >/dev/null 2>&1
}

make_clip() {
	local input="$1"
	local output="$2"
	ffmpeg -y -i "$input" \
		-vf "scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0xF6F3EF,setsar=1,fps=30,format=yuv420p" \
		-c:v libx264 -preset medium -crf 20 -an "$output" >/dev/null 2>&1
}

make_edge_voiceover() {
	local output="$1"
	local python_bin="python3"

	command -v python3 >/dev/null 2>&1 || fail "python3 is required for TTS_ENGINE=edge"
	if ! python3 -m edge_tts --version >/dev/null 2>&1; then
		python3 -m venv "$tmpdir/edge-tts-venv"
		python_bin="$tmpdir/edge-tts-venv/bin/python"
		PIP_DISABLE_PIP_VERSION_CHECK=1 "$python_bin" -m pip install --quiet edge-tts
	fi

	"$python_bin" -m edge_tts \
		--voice "$EDGE_TTS_VOICE" \
		--rate "$EDGE_TTS_RATE" \
		--file "$VOICEOVER_TEXT" \
		--write-media "$output" >/dev/null
}

make_card "$tmpdir/00-title.mp4" "Personalized Denim Fitting Experience" "Customer app + associate dashboard demo"
make_card "$tmpdir/01-booking-title.mp4" "Customer iOS App" "Book a guided fitting and share fit intent before arrival"
make_clip "$IOS_BOOKING" "$tmpdir/02-booking.mp4"
make_card "$tmpdir/03-web-title.mp4" "Associate Dashboard" "Review AI-assisted suggestions, prep products, message, and complete"
make_clip "$WEB_FLOW" "$tmpdir/04-web.mp4"
make_card "$tmpdir/05-recap-title.mp4" "Customer Recap" "Review the fitting recap and submit feedback in the app"
make_clip "$IOS_RECAP" "$tmpdir/06-recap.mp4"
make_card "$tmpdir/07-close.mp4" "Connected Guided Fitting" "Intent, prep, session recap, and feedback in one workflow"

cat >"$tmpdir/concat.txt" <<EOF
file '$tmpdir/00-title.mp4'
file '$tmpdir/01-booking-title.mp4'
file '$tmpdir/02-booking.mp4'
file '$tmpdir/03-web-title.mp4'
file '$tmpdir/04-web.mp4'
file '$tmpdir/05-recap-title.mp4'
file '$tmpdir/06-recap.mp4'
file '$tmpdir/07-close.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i "$tmpdir/concat.txt" \
	-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart \
	"$tmpdir/video.mp4" >/dev/null 2>&1

if [[ "$WITH_VOICEOVER" == "1" ]]; then
	[[ -f "$VOICEOVER_TEXT" ]] || fail "Missing voiceover text: $VOICEOVER_TEXT"

	case "$TTS_ENGINE" in
		edge)
			make_edge_voiceover "$tmpdir/voice.mp3"
			voice_input="$tmpdir/voice.mp3"
			;;
		say)
			command -v say >/dev/null 2>&1 || fail "say is required for TTS_ENGINE=say"
			say -v "$VOICE" -r "$VOICE_RATE" -f "$VOICEOVER_TEXT" -o "$tmpdir/voice.aiff"
			voice_input="$tmpdir/voice.aiff"
			;;
		*)
			fail "Unsupported TTS_ENGINE: $TTS_ENGINE"
			;;
	esac

	ffmpeg -y -i "$tmpdir/video.mp4" -i "$voice_input" \
		-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 160k -movflags +faststart \
		"$OUTPUT" >/dev/null 2>&1
else
	cp "$tmpdir/video.mp4" "$OUTPUT"
fi

printf "Saved polished demo video to %s\n" "$OUTPUT"
