#!/bin/bash
# Drop the full-size cover art in ./incoming, run this, and it writes
# web-sized JPEGs into assets/covers/ with the filenames the site expects.
#
#   incoming/ai-agents-small-business.(jpg|png)  -> assets/covers/ai-agents-small-business.jpg
#   incoming/ai-credit-repair.(jpg|png)          -> assets/covers/ai-credit-repair.jpg
#   incoming/grok-money.(jpg|png)                -> assets/covers/grok-money.jpg
#
# Two target sizes, because the cards are two different sizes:
#   the featured book renders up to 260px wide (520px on a retina screen), so 900px tall
#   the other two render at 96px wide (192px retina), so 400px tall is already generous
#
# Uses only macOS built-ins (sips). Never upscales, and keeps the original file
# if re-encoding would make it bigger.
set -e
cd "$(dirname "$0")"
mkdir -p assets/covers

shrink () {
  name=$1
  maxh=$2

  src=""
  for ext in jpg jpeg png JPG JPEG PNG; do
    [ -f "incoming/$name.$ext" ] && src="incoming/$name.$ext" && break
  done
  if [ -z "$src" ]; then
    echo "skip: no incoming/$name.(jpg|png)"
    return
  fi

  out="assets/covers/$name.jpg"
  h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')

  if [ "$h" -gt "$maxh" ]; then
    sips -s format jpeg -s formatOptions 72 -Z "$maxh" "$src" --out "$out" >/dev/null
  else
    sips -s format jpeg -s formatOptions 72 "$src" --out "$out" >/dev/null
  fi

  # Amazon's own JPEGs are already well compressed. If our version came out heavier
  # than the source, the source wins — same picture, fewer bytes, often larger too.
  case "$src" in
    *.jpg|*.jpeg|*.JPG|*.JPEG)
      if [ "$(stat -f%z "$src")" -lt "$(stat -f%z "$out")" ]; then cp "$src" "$out"; fi
      ;;
  esac

  printf '%-30s %sx%s  %s\n' "$name" \
    "$(sips -g pixelWidth  "$out" | awk '/pixelWidth/{print $2}')" \
    "$(sips -g pixelHeight "$out" | awk '/pixelHeight/{print $2}')" \
    "$(du -h "$out" | cut -f1 | tr -d ' ')"
}

shrink ai-agents-small-business 900   # featured card
shrink ai-credit-repair         400
shrink grok-money               400

echo "Done. Covers are in assets/covers/."
