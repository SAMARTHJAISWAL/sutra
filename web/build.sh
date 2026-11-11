#!/bin/sh
# Build the browser demo into _site/: the Gleam engine compiled to
# JavaScript (plain ES modules, no bundler) plus the page itself.
set -eu
cd "$(dirname "$0")/.."

gleam build --target javascript

out=_site
rm -rf "$out"
mkdir -p "$out/lib"

js=build/dev/javascript
cp "$js/prelude.mjs" "$out/lib/"
# the engine and the parts of the standard library it imports
mkdir -p "$out/lib/sutra/sutra" "$out/lib/gleam_stdlib/gleam"
cp "$js/sutra/gleam.mjs" "$out/lib/sutra/"
for f in "$js"/sutra/sutra/*.mjs; do cp "$f" "$out/lib/sutra/sutra/"; done
cp "$js"/gleam_stdlib/*.mjs "$out/lib/gleam_stdlib/"
cp "$js"/gleam_stdlib/gleam/*.mjs "$out/lib/gleam_stdlib/gleam/"
if [ -d "$js/gleam_stdlib/gleam/dynamic" ]; then
  cp -R "$js/gleam_stdlib/gleam/dynamic" "$out/lib/gleam_stdlib/gleam/"
fi

cp web/index.html web/style.css web/app.js web/vercel.json "$out/"
[ -f web/og.png ] && cp web/og.png "$out/"
python3 web/gen_samples.py "$out/samples.js"

echo "built $out/ ($(du -sh "$out" | cut -f1))"
