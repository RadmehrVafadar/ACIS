#!/usr/bin/env bash
set -euo pipefail
python backend/manage.py runserver 0.0.0.0:8080 &
api=$!
web=
trap 'kill "$api" ${web:+"$web"} 2>/dev/null || true' EXIT
# A connected preview reloads as soon as Vite returns, including its first API request.
curl --fail --silent --retry 12 --retry-connrefused --retry-delay 1 --max-time 2 \
  --output /dev/null http://127.0.0.1:8080/ || { echo "The blog API did not become ready." >&2; exit 1; }
npm --prefix frontend run dev &
web=$!
wait -n "$api" "$web"
