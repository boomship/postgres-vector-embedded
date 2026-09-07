#!/bin/bash
# Test the actual archive with the build installation unavailable.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
PLATFORM=${PLATFORM:-$(uname -s | tr '[:upper:]' '[:lower:]')}
ARCH=${ARCH:-$(uname -m)}
if [ "$ARCH" = x86_64 ]; then ARCH=x64; fi
VARIANT=${VARIANT:-lite}
NAME="postgres-${VARIANT}-${PLATFORM}-${ARCH}"
ORIGINAL="$ROOT/postgres-dist/$NAME"
HIDDEN="${ORIGINAL}.relocation-test-$$"
RELOCATED=$(mktemp -d /tmp/pg-relocated.XXXXXX)
cleanup() {
    if [ -d "$HIDDEN" ]; then mv "$HIDDEN" "$ORIGINAL"; fi
    rm -rf "$RELOCATED"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

tar -xzf "$ROOT/postgres-dist/$NAME.tar.gz" -C "$RELOCATED"
mv "$ORIGINAL" "$HIDDEN"
unset DYLD_LIBRARY_PATH DYLD_FALLBACK_LIBRARY_PATH DYLD_INSERT_LIBRARIES LD_LIBRARY_PATH
if [ "$PLATFORM" = darwin ]; then
    python3 scripts/bundle-macos.py --check "$RELOCATED/$NAME"
elif [ "$PLATFORM" = linux ]; then
    resolved=$(ldd "$RELOCATED/$NAME/bin/pg_upgrade")
    libpq=$(echo "$resolved" | awk '/libpq.so.5 =>/ { print $3 }')
    if [ "$(readlink -f "$libpq")" != "$(readlink -f "$RELOCATED/$NAME/lib/libpq.so.5")" ]; then
        echo "pg_upgrade did not resolve bundled libpq" >&2
        exit 1
    fi
elif [ "$PLATFORM" = win32 ]; then
    python3 scripts/bundle-windows.py --check "$RELOCATED/$NAME"
    # Exclude MinGW and compiler DLL directories from runtime resolution.
    export PATH="/usr/bin:/bin:/c/Windows/System32:/c/Windows"
fi
export PLATFORM ARCH VARIANT
export TEST_BINARIES_DIR="$RELOCATED/$NAME"
./test-binaries.sh
if command -v node >/dev/null 2>&1 && [ "$PLATFORM" != win32 ]; then
    node --test tests/native.test.js
fi
