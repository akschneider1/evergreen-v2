#!/usr/bin/env bash
# Post-create setup: install deps and build

set -e

echo "Installing dependencies..."
npm install

echo "Building TypeScript..."
npm run build

echo ""
echo "Setup complete. To run the eval:"
echo "  1. Set your API key: export OPENAI_API_KEY=sk-..."
echo "  2. Edit evergreen.yaml with your sheet ID"
echo "  3. npx evergreen run"
echo ""
echo "To run the pipeline tests: npm test"
