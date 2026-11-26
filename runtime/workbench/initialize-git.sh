#!/bin/sh
set -eu

if [ -e .git ]; then
    exit 0
fi

git init --quiet --initial-branch=practice
printf '%s\n' node_modules __pycache__ .pytest_cache .venv output >> .git/info/exclude
git config core.filemode false
git add --all
git -c user.name=ACIS -c user.email=practice@localhost commit --quiet --allow-empty -m "Practice starter"
