#!/bin/bash
set -e
cd "$(dirname "$0")/imgs"

for f in *.jpg *.jpeg *.png; do
    [ -f "$f" ] || continue
    base="${f%.*}"
    webp="$base.webp"
    if [ -f "$webp" ]; then
        echo "SKIP (already exists): $f -> $webp"
        continue
    fi
    echo "CONVERT: $f -> $webp"
    cwebp -q 85 "$f" -o "$webp" || echo "FAIL: $f"
done

echo "Done."
