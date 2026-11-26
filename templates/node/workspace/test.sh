#!/bin/bash
set -eu
exec node --test --test-reporter=junit --test-reporter-destination="${ACIS_REPORT:-/tmp/acis-tests.xml}" queue.test.mjs
