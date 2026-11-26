#!/usr/bin/env bash
set -euo pipefail
exec python -m pytest -q --tb=short --junitxml="${ACIS_REPORT:-/tmp/acis-tests.xml}" backend/billing/tests/test_statements.py
