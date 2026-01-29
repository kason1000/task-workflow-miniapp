# Task Manager Deployment Procedures

## Critical Deployment Rule

For task manager project deployment (both backend and miniapp):

- **ALWAYS** run the deployment-production batch file
- **NEVER** run individual commands for deployment
- If the batch file is broken, **FIX** the batch file first, then run it
- Do not attempt to work around broken batch files with individual commands

## Deployment File Locations

- **Backend**: `task-manager\task-workflow-backend\deploy-production.bat`
- **Miniapp**: `task-manager\task-workflow-miniapp\deploy-production.bat`

## Deployment Process

Both deployment batch files now follow the same process:
1. Execute the primary deployment tasks
2. After successful deployment, automatically commit changes with a summary message
3. Push changes to the remote repository

## Purpose

This ensures:
- Consistent deployment procedures across both projects
- Proper handling of dependencies and sequence
- Automatic version control after successful deployment
- Reduced risk of deployment errors
- Standardized deployment process

## Reference

This procedure was documented on 2026-01-28 to ensure it is remembered and followed consistently.