#!/bin/sh
# Rebuild the F1 playground bundle.
#
# js/drive.js is an ES module that imports three.js, so it only runs when the
# page is served over http(s). The bundle below inlines three.js into one
# classic script, which also runs when drive.html is opened straight from disk
# (file://) — browsers block module imports from file:// origins.
#
# Run this after every edit to js/drive.js:
#   sh build-drive.sh
set -e
cd "$(dirname "$0")"
npx --yes esbuild js/drive.js --bundle --format=iife --minify \
  --target=safari15 --outfile=js/drive.bundle.js
echo "built js/drive.bundle.js"
