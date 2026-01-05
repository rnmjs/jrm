#!/usr/bin/env bash
set -e  # Exit on any error

pnpm esbuild src/main.cli.ts \
  --bundle \
  --platform=node \
  --target=esnext \
  --format=esm \
  --outfile=dist/jrm.js \
  --minify \
  --banner:js="const require = (await import('node:module')).createRequire(import.meta.url);"

mkdir -p assets

declare -A platforms=(
  # ["x86_64-apple-darwin"]="jrm-Darwin-x86_64"
  ["aarch64-apple-darwin"]="jrm-Darwin-arm64"
  ["x86_64-unknown-linux-gnu"]="jrm-Linux-x86_64"
  ["aarch64-unknown-linux-gnu"]="jrm-Linux-aarch64"
)

if [ -n "$CI" ]; then
  # In CI: install deno as before
  curl -fsSL https://deno.land/install.sh | sh # TODO: Not specify a version. Optimize it.
  DENO_CMD="$HOME/.deno/bin/deno"
else
  # Not in CI: check if deno command exists
  if ! command -v deno &> /dev/null; then
    echo "Error: deno command not found! You should install deno first!"
    exit 1
  fi
  DENO_CMD="deno"
fi

for target in "${!platforms[@]}"; do
  output_name="${platforms[$target]}"
  echo "Building for $target -> assets/$output_name"
  $DENO_CMD compile \
    --allow-net="nodejs.org,dl.deno.land,api.github.com" \
    --allow-write \
    --allow-read \
    --allow-env \
    --allow-sys \
    --no-npm \
    --target="$target" \
    --output="assets/$output_name" \
    dist/jrm.js
done

echo "Build completed! Generated binaries:"
ls -la assets/
