#!/bin/bash
set -e
cd "$(dirname "$0")/imgs"

# Resize oversized images
# Hero/background images: max 1200px width
# Card/carousel images: max 800px width

resize_to() {
    local file="$1"
    local max_width="$2"
    local orig_w=$(python3 -c "from PIL import Image; print(Image.open('$file').size[0])" 2>/dev/null || echo "0")
    if [ "$orig_w" -gt "$max_width" ]; then
        echo "Resize $file: ${orig_w}px -> ${max_width}px"
        magick "$file" -resize "${max_width}x>" -quality 85 "$file.tmp"
        mv "$file.tmp" "$file"
    fi
}

# Background/hero photos (>1200px -> 1200px)
for f in photo_*.webp; do
    [ -f "$f" ] || continue
    resize_to "$f" 1200
done

# Advantage images (>1200px -> 1200px)
for f in advantage_*.webp; do
    [ -f "$f" ] || continue
    resize_to "$f" 1200
done

# Architecture/investments (>1200px -> 1200px)
for f in architecture.webp investments.webp glamping_*.webp; do
    [ -f "$f" ] || continue
    resize_to "$f" 1200
done

# Carousel card images (>800px -> 800px)
for f in construction_*.webp design_*.webp furniture_*.webp interior_*.webp land_*.webp supply_climate_*.webp; do
    [ -f "$f" ] || continue
    resize_to "$f" 800
done

echo "Done."
