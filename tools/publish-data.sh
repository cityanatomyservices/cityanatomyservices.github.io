#!/usr/bin/env bash
# Publish an already committed data refresh while other bots may update main.
set -euo pipefail
for attempt in 1 2 3; do
  # Stop on a real content conflict; never force-push over somebody else's work.
  git pull --rebase origin main
  if git push origin HEAD:main; then exit 0; fi
  if [ "$attempt" -lt 3 ]; then
    echo "Publish attempt $attempt failed; fetching main before retrying."
    sleep 2
  fi
done
echo 'Data publication failed after three attempts.' >&2
exit 1
