# Task Workflow MiniApp Deployment Guide

## Overview
This document describes the deployment process for the Task Workflow MiniApp, including version management and deployment procedures.

## Version Management

The miniapp uses a versioning scheme in the format `x.x.xxxx` where:
- First number: Major version
- Second number: Minor version  
- Third number: Build/incremental version (padded to 4 digits)

### Version Management Scripts

#### Increment Build Version
```bash
# Increment only the build number (e.g., 1.1.0001 -> 1.1.0002)
node scripts/version-manager.js build
```

#### Increment Minor Version
```bash
# Increment minor version (e.g., 1.1.0001 -> 1.2.0001)
node scripts/version-manager.js minor
```

#### Increment Major Version
```bash
# Increment major version (e.g., 1.1.0001 -> 2.0.0001)
node scripts/version-manager.js major
```

## Deployment Scripts

### Production Deployment
Use the production deployment script to build and deploy the application:

**Windows:**
```bash
./deploy-production.bat
```

**Linux/Mac:**
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

The deployment script will:
1. Update the version number
2. Build the application using `npm run build`
3. Deploy to the hosting platform using `npm run deploy`

## Manual Deployment Process

If you need to manually deploy:

1. Update version: `node scripts/version-manager.js build`
2. Build: `npm run build`
3. Deploy: `npm run deploy`

## Configuration

The deployment process updates the version in both:
- `VERSION` file - contains just the version string
- `package.json` - updates the version field for NPM tracking

## Troubleshooting

If deployment fails:
1. Verify you have proper authentication for the deployment platform
2. Check that all dependencies are installed (`npm install`)
3. Ensure the build completes successfully (`npm run build`)