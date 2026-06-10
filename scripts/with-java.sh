#!/usr/bin/env bash
set -euo pipefail

if command -v brew >/dev/null 2>&1; then
  if HOMEBREW_OPENJDK_PREFIX="$(brew --prefix openjdk@21 2>/dev/null)"; then
    export PATH="${HOMEBREW_OPENJDK_PREFIX}/bin:${PATH}"
    if [ -d "${HOMEBREW_OPENJDK_PREFIX}/libexec/openjdk.jdk/Contents/Home" ]; then
      export JAVA_HOME="${HOMEBREW_OPENJDK_PREFIX}/libexec/openjdk.jdk/Contents/Home"
    fi
  fi
fi

exec "$@"
