#!/usr/bin/env bash
# Deploy degenWars to https://sol-pkmn.fun/degenwars/
#
#   tools/deploy-sol-pkmn.sh            # deploys the COMMITTED state of HEAD (not the working tree)
#
# What lives on the droplet (root@sol-pkmn.fun, key auth):
#   /var/www/degenwars/       the game's static files, served by nginx (Range requests for music seeking are built in)
#   /opt/degenwars-feed/      server.mjs, run by systemd unit degenwars-feed on 127.0.0.1:8811; nginx proxies ONLY
#                             /degenwars/api/market to it (never /api/ground, which writes files)
#   nginx                     location blocks inside the 443 server of sites-enabled/sol-pkmn.fun.pulse-grid
#
# The root of sol-pkmn.fun is the private memecoins desk; /inca, /solzero, /memehunter and /solWars are other
# projects. This script only touches the two degenwars directories and restarts degenwars-feed.
set -euo pipefail
HOST="${HOST:-root@sol-pkmn.fun}"
cd "$(dirname "$0")/.."
[[ -z "$(git status --porcelain index.html)" ]] || { echo "!! index.html has uncommitted changes: build, commit, then deploy" >&2; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# only what the page loads; audio/src (masters) stays home
git archive HEAD index.html codex-v2.css codex.js ground.js gamepad.js art assets audio data | tar -x -C "$TMP"
rm -rf "$TMP/audio/src"
echo "==> $(git rev-parse --short HEAD): $(du -sh "$TMP" | cut -f1) -> $HOST:/var/www/degenwars/"

rsync -az --delete --chmod=D755,F644 "$TMP/" "$HOST:/var/www/degenwars/"
rsync -az --chmod=F644 server.mjs "$HOST:/opt/degenwars-feed/server.mjs"
ssh "$HOST" 'systemctl restart degenwars-feed && sleep 2 && systemctl is-active degenwars-feed'
echo "==> https://sol-pkmn.fun/degenwars/  (feed: $(curl -s -m 10 https://sol-pkmn.fun/degenwars/api/market | head -c 60)...)"
