#!/usr/bin/env bash
# Publier une version :  scripts/release.sh 61 "Message du commit"
# 1) met le même numéro dans service-worker.js et js/community-cloud.js  2) lance les tests
# 3) fabrique la version autonome  4) commit + push
set -euo pipefail
cd "$(dirname "$0")/.."
V="${1:?numéro de version, ex. 61}"; MSG="${2:?message du commit}"
sed -i -E "s/scoremaster-app-v[0-9]+/scoremaster-app-v$V/; s/scoremaster-cdn-v[0-9]+/scoremaster-cdn-v$V/; s/Service Worker v[0-9]+/Service Worker v$V/" service-worker.js
sed -i -E "s/APP_VERSION: '[0-9]+'/APP_VERSION: '$V'/" js/community-cloud.js
for f in js/*.js; do node --check "$f"; done
(cd tests && node run.js)
python3 scripts/inline.py "${SM_OUT:-/mnt/user-data/outputs/scoremaster.html}"
git add -A
git commit -m "$MSG (v$V)" ${SM_TRAILERS:+-m "$SM_TRAILERS"}
git push
