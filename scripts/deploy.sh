#!/bin/bash

echo "========================================="
echo "Deploying to GitHub Pages"
echo "========================================="
echo ""

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  You have uncommitted changes. Commit them first:"
  git status --short
  exit 1
fi

echo "Building..."
npm run build

echo ""
echo "Deploying to gh-pages branch..."
npx gh-pages -d dist

echo ""
echo "========================================="
echo "✅ Deployed successfully!"
echo ""
echo "Your Mini App is available at:"
echo "https://YOUR_USERNAME.github.io/task-workflow-miniapp/"
echo "========================================="