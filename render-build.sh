#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Installing Puppeteer dependencies..."

# Store the path where Puppeteer downloads Chromium
export PUPPETEER_CACHE_DIR=/opt/render/project/puppeteer

# Install the npm dependencies
npm install

# Force Puppeteer to download the browser locally to the cache directory
npx puppeteer browsers install chrome

echo "Puppeteer dependencies installed successfully."
