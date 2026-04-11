#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo "Task Workflow MiniApp Production Deployment"
echo "========================================="

echo "Current directory: $(pwd)"

OLD_VERSION="$(cat VERSION)"
echo "Updating version to new format (x.x.xxxx)..."
NEW_VERSION=$(node scripts/version-manager.js build)
echo "Version updated: $OLD_VERSION -> $NEW_VERSION"
echo "Timestamp: $(date -u)"
echo $NEW_VERSION

echo "Starting deployment..."

# Build the application
npm run build

# Deploy to GitHub Pages
npx gh-pages -d dist -b gh-pages

# Commit and push changes to main branch with deployment message
echo "Committing changes with deployment message..."
git add .
git status
TIMESTAMP=$(date -u)
git commit -m "Deployment: [$TIMESTAMP] Production build v$NEW_VERSION" -m "Built and deployed production version $NEW_VERSION" || echo "No changes to commit"
git push origin main

echo "========================================="
echo "Production deployment completed successfully!"
echo "========================================="
