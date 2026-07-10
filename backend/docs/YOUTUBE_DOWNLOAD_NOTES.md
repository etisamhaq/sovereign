# YouTube Download - Important Notes

## Current Status
The video downloader is implemented but may encounter HTTP 403 errors due to YouTube's anti-bot protection measures.

## Why 403 Errors Occur
1. **YouTube Protection**: YouTube actively blocks automated downloads to protect content
2. **IP Rate Limiting**: Too many requests from the same IP address
3. **Geographic Restrictions**: Some videos are region-locked
4. **Age Restrictions**: Videos requiring sign-in won't work without authentication

## Solutions Implemented
1. **User-Agent Spoofing**: Mimics real browser requests
2. **Headers Enhancement**: Added full browser headers
3. **Retry Logic**: Automatic retry with delays
4. **Latest yt-dlp**: Using the most recent version

## Alternative Solutions If 403 Persists

### Option 1: Use Cookies (Recommended)
```python
# Export cookies from your browser
# 1. Install browser extension: "Get cookies.txt"
# 2. Login to YouTube
# 3. Export cookies to cookies.txt
# 4. Place in backend directory
# 5. Update video_download_service.py:
self.yt_dlp_opts = {
    ...
    'cookiefile': '/app/cookies.txt',
    ...
}
```

### Option 2: Use YouTube API (Legal Alternative)
Instead of downloading, use YouTube's official API to:
- Get video metadata
- Embed videos in your application
- Create playlists
- Requires API key from Google Cloud Console

### Option 3: Proxy/VPN
Configure yt-dlp to use a proxy:
```python
opts['proxy'] = 'http://proxy-server:port'
```

### Option 4: Self-Hosted yt-dlp API
Deploy yt-dlp as a separate service on different IPs:
- https://github.com/yt-dlp/yt-dlp-api-server

## Legal Considerations
⚠️ **IMPORTANT**: 
- Only download videos you have permission to download
- Respect copyright laws and YouTube's Terms of Service
- Consider using YouTube's official API for commercial applications
- This tool is for educational/personal use only

## Testing
For testing, use videos that are:
- Public domain (e.g., Big Buck Bunny)
- Creative Commons licensed
- Your own uploads
- Explicitly downloadable

## Troubleshooting Commands
```bash
# Test yt-dlp directly in container
docker compose -f docker-compose.dev.yml exec backend yt-dlp --version
docker compose -f docker-compose.dev.yml exec backend yt-dlp --list-extractors | grep youtube

# Test with simple download
docker compose -f docker-compose.dev.yml exec backend yt-dlp -F "https://www.youtube.com/watch?v=aqz-KE-bpKQ"

# Update yt-dlp
docker compose -f docker-compose.dev.yml exec backend pip install --upgrade yt-dlp
```

## Alternative Implementation
For production use, consider:
1. **YouTube Data API v3**: Official, legal, but no download capability
2. **Embed Only**: Use YouTube's iframe player instead of downloading
3. **Partner Program**: Apply for YouTube's partner program for official access
4. **Content ID API**: For content owners and partners

## Current Workaround
The tool works best with:
- Short videos
- Public domain content
- Videos without restrictions
- Using fresh IP addresses
- Spacing out requests