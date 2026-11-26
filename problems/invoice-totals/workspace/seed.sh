#!/usr/bin/env bash
set -euo pipefail
python backend/manage.py migrate --noinput
python backend/manage.py seed
