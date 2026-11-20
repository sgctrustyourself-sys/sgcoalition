#!/usr/bin/env bash
# Polls the published Ghost Riders IG carousel post for like/comment counts.
# Instagram only serves og-metadata to known crawler UAs; facebookexternalhit works.
# Appends timestamped samples to the log; run in background, stop by killing the process.
LOG="docs/instagram-ghost-riders-engagement.log"
URL="https://www.instagram.com/p/DeIJ9CLH-sc/"
UA="facebookexternalhit/1.1"
INTERVAL=900 # 15 minutes

while true; do
  sample=$(curl -s --max-time 30 -A "$UA" "$URL" | grep -oE '[0-9,.]+ likes?, [0-9,.]+ comments?' | head -1)
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  if [ -n "$sample" ]; then
    printf '%s | %s\n' "$ts" "$sample" >> "$LOG"
  else
    printf '%s | FETCH_FAILED\n' "$ts" >> "$LOG"
  fi
  sleep "$INTERVAL"
done
