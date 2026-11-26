#!/usr/bin/env bash
set -euo pipefail
exec python -m pytest -q --tb=short --junitxml="${ACIS_REPORT:-/tmp/acis-tests.xml}" backend/tracking/tests/test_scans.py
