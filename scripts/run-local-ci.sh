#!/usr/bin/env bash

set -euo pipefail

export PULSE_API_BASE_URL="${PULSE_API_BASE_URL:-https://api.venoplatform.com}"

echo "==> lint"
npm run lint

echo "==> theme tokens"
npm run theme:check

echo "==> typecheck"
npm run typecheck

echo "==> unit tests"
npm run test

echo "==> contract validation"
npm run contracts:validate

echo "==> link checks"
npm run test:links

echo "==> build"
npm run build

echo "==> e2e smoke tests"
npm run test:e2e
