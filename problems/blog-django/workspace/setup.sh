#!/usr/bin/env bash
set -euo pipefail
python -m pip install --disable-pip-version-check -r requirements.txt
npm --prefix frontend ci --no-audit --no-fund
