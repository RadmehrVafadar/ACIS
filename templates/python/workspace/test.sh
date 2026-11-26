#!/bin/bash
set -eu
exec python -m pytest -q --junitxml="${ACIS_REPORT:-/tmp/acis-tests.xml}" test_queue.py
