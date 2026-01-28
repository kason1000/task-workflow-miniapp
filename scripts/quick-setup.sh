#!/bin/bash
# Quick setup script for Task Workflow MiniApp

echo "========================================="
echo "Task Workflow MiniApp Quick Setup"
echo "========================================="

# Install dependencies
echo "Installing dependencies..."
npm install

# Create initial version file if it doesn't exist
if [ ! -f "./VERSION" ]; then
    echo "Creating initial VERSION file..."
    echo "1.1.0001" > ./VERSION
fi

# Create version.json if it doesn't exist
if [ ! -f "./public/version.json" ]; then
    echo "Creating initial version.json..."
    mkdir -p ./public
    echo "{" > ./public/version.json
    echo "  \"version\": \"$(cat ./VERSION)\"," >> ./public/version.json
    echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" >> ./public/version.json
    echo "}" >> ./public/version.json
fi

echo "Setup completed!"
echo "Current version: $(cat ./VERSION)"
echo ""
echo "Available commands:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build for production"
echo "  npm run deploy       - Deploy to hosting"
echo "  npm run version:major - Increment major version"
echo "  npm run version:minor - Increment minor version"
echo "  npm run version:patch - Increment patch/build version"