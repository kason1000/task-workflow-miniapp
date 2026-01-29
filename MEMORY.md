# MEMORY.md - Long Term Memory

## Task Workflow Bot Features

### Group Selection Feature (Implemented)
- `g` command shows popup with groups to select from
- `g:GroupName` goes directly to specified group without popup
- `g:UnknownGroup` shows popup if group name isn't recognized
- No `g` tag defaults to "Test Group" (backward compatible)

### Version Tracking System (Implemented)
- Automated versioning with VERSION file
- Version manager script that auto-increments versions
- Integration with /start and /version commands showing version info
- Automated deployment script that updates version during deploy
- CHANGELOG.md maintained for deployment history

### Deployment Process
- Code implementation complete and ready
- Deployment requires Cloudflare API token
- Use `npm run deploy` to deploy with automatic versioning
- Version info includes timestamp and "deployed X hours/days ago"

### Files Created/Modified
- Backend: media.ts, groupCallbacks.ts, commands.ts
- Scripts: version-manager.js, deploy-with-version.js, update-wrangler-config.js
- Config: Updated wrangler.jsonc to include version vars
- Docs: VERSION and CHANGELOG.md files

## Investment Tracker System (Implemented)

### Investment Monitoring Feature (Implemented)
- Moved `investment_tracker_simple.py` and related files to `trading_system/` directory
- Monitors specified subreddits and Twitter accounts/hashtags for investment opportunities
- Tracks keywords related to stocks, trading, and market movements
- Performs sentiment analysis on posts and tweets
- Generates alerts for trending topics and potential opportunities
- Saves results to timestamped JSON files

### Configuration
- Uses `trading_system/investment_config.json` to specify monitoring parameters
- Configurable subreddits, Twitter accounts, hashtags, and keywords
- Adjustable alert thresholds

### Results
- Successfully ran investment tracker detecting 6 opportunities and generating 8 alerts
- Sample opportunities include undervalued tech stocks, earnings beats, and analyst upgrades
- All results saved to timestamped JSON files for review