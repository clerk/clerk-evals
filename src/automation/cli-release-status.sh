#!/usr/bin/env bash
set -euo pipefail

expected="${1:?Expected CLI version}"
current="${2:?Current npm latest version}"

if [[ "$current" == "$expected" ]]; then
  echo current
elif [[ "$(printf '%s\n%s\n' "$expected" "$current" | sort -V | tail -n 1)" == "$current" ]]; then
  echo superseded
else
  echo mismatch
fi
