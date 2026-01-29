# Investment Tracker

This tool monitors Reddit and Twitter/X for investment opportunities and urgent market alerts.

## Setup

1. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Obtain API credentials:
   - [Reddit API](https://www.reddit.com/dev/api) - Create a Reddit app to get client ID and secret
   - [Twitter API](https://developer.twitter.com/en/docs/twitter-api) - Get a Bearer Token

3. Update `config.py` with your actual API credentials

## Configuration

Edit `config.py` to customize:
- API credentials
- Subreddits to monitor
- Keywords to track
- Alert settings

## Usage

Run the tracker once:
```bash
python investment_tracker.py
```

For continuous monitoring, you can set up a cron job or scheduled task to run the script periodically.

## Features

- Scans popular investment subreddits (investing, stocks, wallstreetbets, etc.)
- Monitors Twitter for investment-related hashtags and keywords
- Identifies potential investment opportunities based on keywords
- Flags urgent alerts and warnings
- Displays results sorted by recency