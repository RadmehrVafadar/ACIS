#!/usr/bin/env bash
set -euo pipefail
export MOCHA_FILE="${ACIS_REPORT:-/tmp/acis-tests.xml}"
exec npm --prefix backend test
