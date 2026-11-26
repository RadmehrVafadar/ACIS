#!/usr/bin/env bash
set -euo pipefail
exec python backend/manage.py runserver 0.0.0.0:8080
