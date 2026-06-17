#!/usr/bin/env bash
set -euo pipefail

IOS_BOOKING="${IOS_BOOKING:-docs/submission/demo/captures/ios-booking-autoplay-final.mp4}"
WEB_FLOW="${WEB_FLOW:-docs/submission/demo/captures/web-associate-flow-final.webm}"
IOS_RECAP="${IOS_RECAP:-docs/submission/demo/captures/ios-recap-autoplay-final.mp4}"
VOICEOVER_TEXT="${VOICEOVER_TEXT:-docs/submission/demo/polished_voiceover.txt}"
VOICEOVER_SEGMENTS_DIR="${VOICEOVER_SEGMENTS_DIR:-docs/submission/demo/polished_voiceover_segments}"
OUTPUT="${OUTPUT:-docs/submission/demo/captures/denim-fit-demo-polished.mp4}"
WIDTH="${WIDTH:-1920}"
HEIGHT="${HEIGHT:-1080}"
CARD_SECONDS="${CARD_SECONDS:-2}"
IOS_BOOKING_TRIM_START="${IOS_BOOKING_TRIM_START:-0}"
IOS_BOOKING_TRIM_END="${IOS_BOOKING_TRIM_END:-2}"
WEB_FLOW_TRIM_START="${WEB_FLOW_TRIM_START:-0}"
WEB_FLOW_TRIM_END="${WEB_FLOW_TRIM_END:-0}"
IOS_RECAP_TRIM_START="${IOS_RECAP_TRIM_START:-0}"
IOS_RECAP_TRIM_END="${IOS_RECAP_TRIM_END:-0}"
TTS_ENGINE="${TTS_ENGINE:-edge}"
EDGE_TTS_VOICE="${EDGE_TTS_VOICE:-en-US-AvaNeural}"
EDGE_TTS_RATE="${EDGE_TTS_RATE:-+0%}"
VOICE="${VOICE:-Sandy (English (US))}"
VOICE_RATE="${VOICE_RATE:-155}"
WITH_VOICEOVER="${WITH_VOICEOVER:-1}"
SEGMENT_AUDIO_PAD_SECONDS="${SEGMENT_AUDIO_PAD_SECONDS:-0.35}"
EDGE_TTS_PYTHON=""

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
	ffmpeg -y -loop 1 -t "$CARD_SECONDS" -i "$image" -vf "fps=30,format=yuv420p" \
		-c:v libx264 -preset medium -crf 20 "$output" >/dev/null 2>&1
}

media_duration() {
	ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1"
}

make_clip() {
	local input="$1"
	local output="$2"
	local trim_start="${3:-0}"
	local trim_end="${4:-0}"
	local ffmpeg_input_args=()

	if [[ "$trim_start" != "0" && "$trim_start" != "0.0" ]]; then
		ffmpeg_input_args+=("-ss" "$trim_start")
	fi
	if [[ "$trim_end" != "0" && "$trim_end" != "0.0" ]]; then
		local duration
		duration="$(awk -v total="$(media_duration "$input")" -v start="$trim_start" -v end="$trim_end" 'BEGIN {
			d = total - start - end
			if (d < 0.1) d = 0.1
			printf "%.3f", d
		}')"
		ffmpeg_input_args+=("-t" "$duration")
	fi

	ffmpeg -y "${ffmpeg_input_args[@]}" -i "$input" \
		-vf "scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0xF6F3EF,setsar=1,fps=30,format=yuv420p" \
		-c:v libx264 -preset medium -crf 20 -an "$output" >/dev/null 2>&1
}

ensure_edge_tts() {
	command -v python3 >/dev/null 2>&1 || fail "python3 is required for TTS_ENGINE=edge"
	if ! python3 -m edge_tts --version >/dev/null 2>&1; then
		python3 -m venv "$tmpdir/edge-tts-venv"
		EDGE_TTS_PYTHON="$tmpdir/edge-tts-venv/bin/python"
		PIP_DISABLE_PIP_VERSION_CHECK=1 "$EDGE_TTS_PYTHON" -m pip install --quiet edge-tts
	else
		EDGE_TTS_PYTHON="python3"
	fi
}

make_edge_voiceover() {
	local input="$1"
	local output="$2"

	ensure_edge_tts
	"$EDGE_TTS_PYTHON" -m edge_tts \
		--voice "$EDGE_TTS_VOICE" \
		--rate "$EDGE_TTS_RATE" \
		--file "$input" \
		--write-media "$output" >/dev/null
}

make_voiceover_media() {
	local input="$1"
	local output="$2"

	case "$TTS_ENGINE" in
		edge)
			make_edge_voiceover "$input" "$output"
			;;
		say)
			command -v say >/dev/null 2>&1 || fail "say is required for TTS_ENGINE=say"
			say -v "$VOICE" -r "$VOICE_RATE" -f "$input" -o "$output"
			;;
		*)
			fail "Unsupported TTS_ENGINE: $TTS_ENGINE"
			;;
	esac
}

extend_clip_to_duration() {
	local clip="$1"
	local duration="$2"
	local current_duration
	local extra

	current_duration="$(media_duration "$clip")"
	extra="$(awk -v target="$duration" -v current="$current_duration" 'BEGIN {
		d = target - current
		if (d < 0.05) d = 0
		printf "%.3f", d
	}')"
	if [[ "$extra" == "0.000" ]]; then
		return
	fi

	local extended="${clip%.mp4}-extended.mp4"
	ffmpeg -y -i "$clip" \
		-vf "tpad=stop_mode=clone:stop_duration=${extra}" \
		-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "$extended" >/dev/null 2>&1
	mv "$extended" "$clip"
}

make_segmented_voiceover() {
	local output="$1"
	local names=(
		"00-title"
		"01-booking-title"
		"02-booking"
		"03-web-title"
		"04-web"
		"05-recap-title"
		"06-recap"
		"07-close"
	)

	for name in "${names[@]}"; do
		[[ -f "$VOICEOVER_SEGMENTS_DIR/$name.txt" ]] || fail "Missing voiceover segment: $VOICEOVER_SEGMENTS_DIR/$name.txt"
	done

	: >"$tmpdir/audio-concat.txt"
	for name in "${names[@]}"; do
		local clip="$tmpdir/$name.mp4"
		local text="$VOICEOVER_SEGMENTS_DIR/$name.txt"
		local raw="$tmpdir/$name-voice"
		local padded="$tmpdir/$name-padded.wav"
		local clip_duration
		local raw_duration
		local segment_duration
		clip_duration="$(media_duration "$clip")"

		if [[ "$TTS_ENGINE" == "say" ]]; then
			make_voiceover_media "$text" "$raw.aiff"
			raw="$raw.aiff"
		else
			make_voiceover_media "$text" "$raw.mp3"
			raw="$raw.mp3"
		fi
		raw_duration="$(media_duration "$raw")"
		segment_duration="$(awk \
			-v clip="$clip_duration" \
			-v raw="$raw_duration" \
			-v pad="$SEGMENT_AUDIO_PAD_SECONDS" 'BEGIN {
				target = raw + pad
				if (clip > target) target = clip
				printf "%.3f", target
			}')"
		extend_clip_to_duration "$clip" "$segment_duration"

		ffmpeg -y -i "$raw" \
			-af "apad,atrim=0:${segment_duration},asetpts=N/SR/TB" \
			-ac 2 -ar 44100 -c:a pcm_s16le "$padded" >/dev/null 2>&1
		printf "file '%s'\n" "$padded" >>"$tmpdir/audio-concat.txt"
	done

	ffmpeg -y -f concat -safe 0 -i "$tmpdir/audio-concat.txt" \
		-c:a aac -b:a 160k "$output" >/dev/null 2>&1
}

make_card "$tmpdir/00-title.mp4" "Personalized Denim Fitting Experience" "Customer app + associate dashboard demo"
make_card "$tmpdir/01-booking-title.mp4" "Customer iOS App" "Book a guided fitting and share fit intent before arrival"
make_clip "$IOS_BOOKING" "$tmpdir/02-booking.mp4" "$IOS_BOOKING_TRIM_START" "$IOS_BOOKING_TRIM_END"
make_card "$tmpdir/03-web-title.mp4" "Associate Dashboard" "Review AI-assisted suggestions, prep products, message, and complete"
make_clip "$WEB_FLOW" "$tmpdir/04-web.mp4" "$WEB_FLOW_TRIM_START" "$WEB_FLOW_TRIM_END"
make_card "$tmpdir/05-recap-title.mp4" "Customer Recap" "Review the fitting recap and submit feedback in the app"
make_clip "$IOS_RECAP" "$tmpdir/06-recap.mp4" "$IOS_RECAP_TRIM_START" "$IOS_RECAP_TRIM_END"
make_card "$tmpdir/07-close.mp4" "Connected Guided Fitting" "Intent, prep, session recap, and feedback in one workflow"

voice_input=""
if [[ "$WITH_VOICEOVER" == "1" ]]; then
	if [[ -d "$VOICEOVER_SEGMENTS_DIR" ]]; then
		make_segmented_voiceover "$tmpdir/voice.m4a"
		voice_input="$tmpdir/voice.m4a"
	else
		[[ -f "$VOICEOVER_TEXT" ]] || fail "Missing voiceover text: $VOICEOVER_TEXT"
		if [[ "$TTS_ENGINE" == "say" ]]; then
			make_voiceover_media "$VOICEOVER_TEXT" "$tmpdir/voice.aiff"
			voice_input="$tmpdir/voice.aiff"
		else
			make_voiceover_media "$VOICEOVER_TEXT" "$tmpdir/voice.mp3"
			voice_input="$tmpdir/voice.mp3"
		fi
	fi
fi

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
	ffmpeg -y -i "$tmpdir/video.mp4" -i "$voice_input" \
		-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 160k -movflags +faststart \
		"$OUTPUT" >/dev/null 2>&1
else
	cp "$tmpdir/video.mp4" "$OUTPUT"
fi

printf "Saved polished demo video to %s\n" "$OUTPUT"
