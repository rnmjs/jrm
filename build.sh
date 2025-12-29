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
  # ["x86_64-apple-darwin"]="jrm-darwin-x64"
  ["aarch64-apple-darwin"]="jrm-darwin-arm64"
  ["x86_64-unknown-linux-gnu"]="jrm-linux-x64"
  ["aarch64-unknown-linux-gnu"]="jrm-linux-arm64"
)
curl -fsSL https://deno.land/install.sh | sh # TODO: Not specify a version. Optimize it.
for target in "${!platforms[@]}"; do
  output_name="${platforms[$target]}"
  echo "Building for $target -> assets/$output_name"
  ~/.deno/bin/deno compile \
    --allow-net="nodejs.org" \
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
