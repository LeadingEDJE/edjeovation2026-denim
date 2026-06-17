#!/usr/bin/env bash
set -euo pipefail

IOS_PROJECT="${IOS_PROJECT:-apps/ios/DenimFit/DenimFit.xcodeproj}"
IOS_SCHEME="${IOS_SCHEME:-DenimFit}"
IOS_DESTINATION="${IOS_DESTINATION:-platform=iOS Simulator,name=iPhone 17 Pro}"
BUNDLE_ID="${BUNDLE_ID:-com.edjeovation.denimfit}"
DERIVED_DATA="${DERIVED_DATA:-/tmp/denim-fit-demo-derived-data}"
BUILD_AND_LAUNCH="${BUILD_AND_LAUNCH:-1}"
AUTOPLAY="${AUTOPLAY:-}"
DEMO_APPOINTMENT_ID="${DEMO_APPOINTMENT_ID:-}"
DEMO_PAUSE_SECONDS="${DEMO_PAUSE_SECONDS:-}"
DEMO_INCLUDE_OUTFIT="${DEMO_INCLUDE_OUTFIT:-1}"
OUTPUT="${OUTPUT:-docs/submission/demo/captures/ios-customer-flow-$(date +%Y%m%d-%H%M%S).mp4}"

fail() {
	printf "FAIL: %s\n" "$1" >&2
	exit 1
}

need_cmd() {
	command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

need_cmd xcodebuild
need_cmd xcrun

mkdir -p "$(dirname "$OUTPUT")"

printf "iOS demo recording\n"
printf "Project: %s\n" "$IOS_PROJECT"
printf "Scheme: %s\n" "$IOS_SCHEME"
printf "Destination: %s\n" "$IOS_DESTINATION"
printf "Autoplay: %s\n" "${AUTOPLAY:-off}"
printf "Demo appointment: %s\n" "${DEMO_APPOINTMENT_ID:-auto}"
printf "Demo pause seconds: %s\n" "${DEMO_PAUSE_SECONDS:-default}"
printf "Demo outfit upload: %s\n" "$DEMO_INCLUDE_OUTFIT"
printf "Output: %s\n\n" "$OUTPUT"

if [[ "$BUILD_AND_LAUNCH" == "1" ]]; then
	xcodebuild \
		-project "$IOS_PROJECT" \
		-scheme "$IOS_SCHEME" \
		-destination "$IOS_DESTINATION" \
		-derivedDataPath "$DERIVED_DATA" \
		CODE_SIGNING_ALLOWED=NO \
		build >/tmp/denim-fit-ios-record-build.log

	app_path="$(
		find "$DERIVED_DATA/Build/Products/Debug-iphonesimulator" \
			-maxdepth 2 \
			-name "DenimFit.app" \
			-type d \
			-print \
			-quit
	)"
	[[ -n "$app_path" ]] || fail "Built app not found under $DERIVED_DATA"

	xcrun simctl install booted "$app_path"
	if [[ -n "$AUTOPLAY" ]]; then
		SIMCTL_CHILD_DENIM_FIT_DEMO_AUTOPLAY="$AUTOPLAY" \
		SIMCTL_CHILD_DENIM_FIT_DEMO_APPOINTMENT_ID="$DEMO_APPOINTMENT_ID" \
		SIMCTL_CHILD_DENIM_FIT_DEMO_PAUSE_SECONDS="$DEMO_PAUSE_SECONDS" \
		SIMCTL_CHILD_DENIM_FIT_DEMO_INCLUDE_OUTFIT="$DEMO_INCLUDE_OUTFIT" \
			xcrun simctl launch --terminate-running-process booted "$BUNDLE_ID" >/dev/null
	else
		xcrun simctl launch --terminate-running-process booted "$BUNDLE_ID" >/dev/null
	fi
	printf "Launched %s on the booted simulator.\n" "$BUNDLE_ID"
fi

printf "Recording booted simulator. Press Ctrl-C when the iOS customer flow is complete.\n"
trap 'printf "\nSaved iOS recording to %s\n" "$OUTPUT"' EXIT
xcrun simctl io booted recordVideo --codec=h264 "$OUTPUT"
