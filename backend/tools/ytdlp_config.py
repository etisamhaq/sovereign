"""
Centralized yt-dlp configuration with anti-bot measures and cookie support.

All services that use yt-dlp should import helpers from here
instead of configuring yt-dlp independently.
"""
import os
import logging
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)

# Cookie file path — configurable via env var or Django settings
# Users should export cookies.txt from a browser logged into YouTube
# and place it at this path (or mount it in Docker).
COOKIES_FILE = getattr(
    settings,
    'YTDLP_COOKIES_FILE',
    os.environ.get('YTDLP_COOKIES_FILE', '/app/cookies.txt'),
)

# Latest Chrome UA — keep this current
_USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/131.0.0.0 Safari/537.36'
)

_HTTP_HEADERS = {
    'User-Agent': _USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Referer': 'https://www.youtube.com/',
}


def _resolve_cookies_file():
    """
    Return the cookie file path if it exists, else None.
    Logs a warning if not found — this is the #1 fix for
    "Sign in to confirm you're not a bot" errors.
    """
    path = Path(COOKIES_FILE)
    if path.is_file():
        logger.info(f"yt-dlp: using cookies from {path}")
        return str(path)
    # Also check relative to BASE_DIR
    alt = Path(settings.BASE_DIR) / 'cookies.txt'
    if alt.is_file():
        logger.info(f"yt-dlp: using cookies from {alt}")
        return str(alt)
    logger.warning(
        "yt-dlp: No cookies.txt found. YouTube may block requests. "
        "Export cookies from a logged-in browser session and place at "
        f"{COOKIES_FILE} or {alt}"
    )
    return None


def get_base_opts(**overrides):
    """
    Return base yt-dlp options with anti-bot measures and optional cookie auth.

    Usage::

        opts = get_base_opts(skip_download=True, format='bestaudio/best')
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    """
    cookies = _resolve_cookies_file()

    opts = {
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'geo_bypass': True,
        'geo_bypass_country': 'US',
        'noplaylist': True,
        'socket_timeout': 30,
        'retries': 5,
        'fragment_retries': 5,
        'extractor_retries': 5,
        'ignoreerrors': False,
        'noprogress': True,
        'no_color': True,
        # Anti-bot: browser-like headers
        'user_agent': _USER_AGENT,
        'referer': 'https://www.youtube.com/',
        'http_headers': _HTTP_HEADERS,
        # Anti-bot: extractor args for YouTube
        # 'player_client': tells yt-dlp which innertube client to use
        # 'web' is the most reliable for avoiding bot detection
        'extractor_args': {
            'youtube': {
                'player_client': ['web'],
            },
        },
    }

    # Cookie auth — the key fix for "Sign in to confirm you're not a bot"
    if cookies:
        opts['cookiefile'] = cookies

    # Apply caller overrides last so they win
    opts.update(overrides)
    return opts


def get_info_opts(**overrides):
    """yt-dlp opts for metadata-only extraction (no download)."""
    return get_base_opts(
        skip_download=True,
        extract_flat=False,
        **overrides,
    )


def get_download_opts(**overrides):
    """yt-dlp opts for actual file downloads."""
    return get_base_opts(
        extract_flat=False,
        prefer_ffmpeg=True,
        **overrides,
    )


def get_caption_opts(output_dir: str, **overrides):
    """yt-dlp opts for extracting subtitles/captions."""
    return get_base_opts(
        writeautomaticsub=True,
        writesubtitles=True,
        subtitlesformat='vtt',
        subtitleslangs=['en'],
        skip_download=True,
        outtmpl=os.path.join(output_dir, '%(id)s.%(ext)s'),
        **overrides,
    )


def get_audio_opts(output_path: str, quality: str = '64', **overrides):
    """yt-dlp opts for downloading audio only (for Whisper transcription)."""
    return get_base_opts(
        format='bestaudio/best',
        outtmpl=output_path,
        postprocessors=[{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': quality,
        }],
        **overrides,
    )
