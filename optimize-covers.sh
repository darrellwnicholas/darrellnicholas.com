#!/bin/bash
# Drop the full-size cover art in ./incoming, run this, and it writes
# web-sized JPEGs into assets/covers/ with the filenames the site expects.
#
#   incoming/ai-agents-small-business.(jpg|png)  -> assets/covers/ai-agents-small-business.jpg
#   incoming/ai-credit-repair.(jpg|png)          -> assets/covers/ai-credit-repair.jpg
#   incoming/grok-money.(jpg|png)                -> assets/covers/grok-money.jpg
#
# Uses only macOS built-ins (sips). Longest side 900px, quality ~72.
set -e
cd "$(dirname "$0")"
mkdir -p assets/covers

for name in ai-agents-small-business ai-credit-repair grok-money; do
  src=""
  for ext in jpg jpeg png JPG JPEG PNG; do
    [ -f "incoming/$name.$ext" ] && src="incoming/$name.$ext" && break
  done
  if [ -z "$src" ]; then
    echo "skip: no incoming/$name.(jpg|png)"
    continue
  fi
  out="assets/covers/$name.jpg"
  sips -s format jpeg -s formatOptions 72 -Z 900 "$src" --out "$out" >/dev/null
  printf '%-34s %s\n' "$name" "$(du -h "$out" | cut -f1)"
done

echo "Done. Covers are in assets/covers/."
