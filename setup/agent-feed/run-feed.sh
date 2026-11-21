#!/bin/bash
# Runs the shipped agent-feed writer via tsx so shared TypeScript imports resolve.
set -euo pipefail
cd "$(dirname "$0")"
exec npx --prefix ../.. tsx ./feed-writer.mjs "$@"
