#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000}"
WEB_BASE="${WEB_BASE:-http://localhost:5173}"
IOS_PROJECT="${IOS_PROJECT:-apps/ios/DenimFit/DenimFit.xcodeproj}"
IOS_SCHEME="${IOS_SCHEME:-DenimFit}"
IOS_DESTINATION="${IOS_DESTINATION:-platform=iOS Simulator,name=iPhone 17 Pro}"
RUN_IOS_BUILD="${RUN_IOS_BUILD:-1}"

fail() {
	printf "FAIL: %s\n" "$1" >&2
	exit 1
}

pass() {
	printf "PASS: %s\n" "$1"
}

need_cmd() {
	command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

json_check() {
	local description="$1"
	local script="$2"
	node -e "$script" || fail "$description"
	pass "$description"
}

need_cmd curl
need_cmd node
need_cmd docker
need_cmd xcodebuild
need_cmd xcrun

printf "Demo preflight\n"
printf "API: %s\n" "$API_BASE"
printf "Web: %s\n" "$WEB_BASE"
printf "iOS: %s / %s / %s\n\n" "$IOS_PROJECT" "$IOS_SCHEME" "$IOS_DESTINATION"

docker compose ps >/dev/null || fail "docker compose is not available from this repo"
pass "docker compose responds"

health="$(curl -fsS "$API_BASE/health")"
printf "%s" "$health" | json_check "API health reports ok" '
let body = "";
process.stdin.on("data", chunk => body += chunk);
process.stdin.on("end", () => {
	const json = JSON.parse(body);
	if (json.ok !== true) process.exit(1);
});
'

curl -fsSI "$WEB_BASE" >/dev/null || fail "Web app is not reachable"
pass "Web app is reachable"

appointments="$(curl -fsS "$API_BASE/api/appointments")"
printf "%s" "$appointments" | json_check "Appointment data is available" '
let body = "";
process.stdin.on("data", chunk => body += chunk);
process.stdin.on("end", () => {
	const json = JSON.parse(body);
	if (!Array.isArray(json.appointments) || json.appointments.length === 0) {
		process.exit(1);
	}
	const statuses = new Set(json.appointments.map(item => item.status));
	for (const required of ["completed", "cancelled", "no_show"]) {
		if (!statuses.has(required)) process.exit(1);
	}
});
'

stores="$(curl -fsS "$API_BASE/api/stores")"
printf "%s" "$stores" | json_check "Mock stores are available" '
let body = "";
process.stdin.on("data", chunk => body += chunk);
process.stdin.on("end", () => {
	const json = JSON.parse(body);
	if (!Array.isArray(json.stores) || json.stores.length < 3) process.exit(1);
});
'

slots="$(curl -fsS "$API_BASE/api/appointments/slots?storeId=anf_soho_001")"
printf "%s" "$slots" | json_check "SoHo appointment slots are available" '
let body = "";
process.stdin.on("data", chunk => body += chunk);
process.stdin.on("end", () => {
	const json = JSON.parse(body);
	if (!Array.isArray(json.slots) || json.slots.length === 0) process.exit(1);
});
'

xcrun simctl list devices available | grep -F "iPhone 17 Pro" >/dev/null ||
	fail "Expected iPhone 17 Pro simulator is not available; override IOS_DESTINATION"
pass "iPhone 17 Pro simulator is available"

if [[ "$RUN_IOS_BUILD" == "1" ]]; then
	xcodebuild \
		-project "$IOS_PROJECT" \
		-scheme "$IOS_SCHEME" \
		-destination "$IOS_DESTINATION" \
		CODE_SIGNING_ALLOWED=NO \
		build >/tmp/denim-fit-ios-build.log
	pass "iOS app builds for simulator"
else
	pass "iOS build skipped because RUN_IOS_BUILD=$RUN_IOS_BUILD"
fi

printf "\nPreflight complete. The local stack and iOS simulator target are ready for demo capture.\n"
