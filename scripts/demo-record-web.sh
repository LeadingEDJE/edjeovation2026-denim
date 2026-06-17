#!/usr/bin/env bash
set -euo pipefail

CAPTURE_DIR="${CAPTURE_DIR:-docs/submission/demo/captures}"
timestamp="$(date +%Y%m%d-%H%M%S)"
output="${OUTPUT:-$CAPTURE_DIR/web-associate-flow-$timestamp.webm}"

mkdir -p "$CAPTURE_DIR"

npx playwright test e2e/demo-recording.spec.ts --project=chromium

video_path="$(find test-results -name video.webm -type f -print -quit)"
[[ -n "$video_path" ]] || {
	printf "FAIL: Playwright completed but no video.webm was found under test-results\n" >&2
	exit 1
}

cp "$video_path" "$output"
printf "Saved web recording to %s\n" "$output"
