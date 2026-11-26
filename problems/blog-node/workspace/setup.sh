#!/usr/bin/env bash
set -euo pipefail
npm --prefix backend ci --no-audit --no-fund
npm --prefix frontend ci --no-audit --no-fund
