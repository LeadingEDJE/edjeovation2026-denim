#!/bin/sh
# Dev-only sidecar: watch the WireMock mappings/__files dirs and reload
# WireMock's stubs from disk whenever they change.
#
# WireMock reads its mappings only at startup, so after editing a mapping or
# fixture you would otherwise have to restart the container (or POST
# /__admin/mappings/reset by hand) before the change takes effect. This watcher
# does that reset automatically.
#
# It polls (stat mtimes) rather than using inotify on purpose: inotify events do
# not reliably cross Docker bind mounts on macOS/WSL2 (the same reason the dev
# override sets CHOKIDAR_USEPOLLING for the app watchers).
#
# Everything here is a BusyBox applet so it runs on a bare `alpine` image with
# no package install.

WIREMOCK_URL="${WIREMOCK_URL:-http://wiremock:8080}"
WATCH_DIR="${WATCH_DIR:-/watch}"
POLL_INTERVAL="${POLL_INTERVAL:-2}"

# A signature of every watched file's path + mtime + size. Changes when a file
# is added, removed, edited, or touched.
signature() {
	find "$WATCH_DIR" -type f 2>/dev/null | sort | while IFS= read -r f; do
		stat -c '%n %Y %s' "$f" 2>/dev/null
	done | md5sum
}

reload() {
	if wget -q -O /dev/null --post-data='' "$WIREMOCK_URL/__admin/mappings/reset"; then
		echo "[wiremock-reloader] reloaded mappings from disk"
	else
		echo "[wiremock-reloader] reload failed (is WireMock up?)"
	fi
}

# Wait for WireMock to be reachable before watching.
until wget -q -O /dev/null "$WIREMOCK_URL/__admin/mappings" 2>/dev/null; do
	echo "[wiremock-reloader] waiting for WireMock at $WIREMOCK_URL ..."
	sleep "$POLL_INTERVAL"
done

echo "[wiremock-reloader] watching $WATCH_DIR every ${POLL_INTERVAL}s"
last="$(signature)"
while true; do
	sleep "$POLL_INTERVAL"
	current="$(signature)"
	if [ "$current" != "$last" ]; then
		echo "[wiremock-reloader] change detected"
		reload
		last="$current"
	fi
done
