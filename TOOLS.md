# TOOLS.md - Local Notes

Skills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases  
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH
- home-server → 192.168.1.100, user: admin

### TTS
- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Critical Deployment Rule

For task manager project deployment (both backend and miniapp):

- **ALWAYS** run the deployment-production batch file
- **NEVER** run individual commands for deployment
- If the batch file is broken, **FIX** the batch file first, then run it
- Do not attempt to work around broken batch files with individual commands

## Deployment File Locations

- **Backend**: `task-manager\task-workflow-backend\deploy-production.bat`
- **Miniapp**: `task-manager\task-workflow-miniapp\deploy-production.bat`

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
