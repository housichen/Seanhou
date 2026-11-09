#!/bin/sh
# Rebuild the Photo Walk bundle (same trick as build-drive.sh:
# inline three.js into a classic script so file:// works).
set -e
cd "$(dirname "$0")"
npx --yes esbuild js/photo.js --bundle --format=iife --minify \
  --target=safari15 --outfile=js/photo.bundle.js
echo "built js/photo.bundle.js"
