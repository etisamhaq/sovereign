"""
Video Download Service for YouTube and Instagram
"""
import os
import re
import uuid
import logging
import tempfile
import time
import shutil
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse
import yt_dlp
import instaloader
from django.conf import settings
from pathlib import Path
import json
from tools.ytdlp_config import get_base_opts, get_info_opts, get_download_opts

logger = logging.getLogger(__name__)


class VideoDownloadService:
    """Service for downloading videos from YouTube and Instagram"""

    YOUTUBE_REGEX = re.compile(
        r'(https?://)?(www\.)?(youtube\.com/(watch\?v=|embed/|v/|shorts/)|youtu\.be/)[\w-]+',
        re.IGNORECASE
    )

    INSTAGRAM_REGEX = re.compile(
        r'(https?://)?(www\.)?(instagram\.com|instagr\.am)/(p|reel|tv)/[\w-]+',
        re.IGNORECASE
    )

    MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
    ALLOWED_FORMATS = ['mp4', 'webm', 'mp3']

    def __init__(self):
        """Initialize the video download service"""
        # Create temp directory for downloads
        self.temp_dir = Path(tempfile.gettempdir()) / 'video_downloads'
        self.temp_dir.mkdir(exist_ok=True)

        # Base yt-dlp options from centralized config (includes cookie + anti-bot)
        self.yt_dlp_opts = get_download_opts(
            outtmpl=str(self.temp_dir / '%(title)s.%(ext)s'),
            max_filesize=self.MAX_FILE_SIZE,
            merge_output_format='mp4',
        )

        # Configure Instaloader
        self.insta_loader = instaloader.Instaloader(
            dirname_pattern=str(self.temp_dir),
            download_comments=False,
            download_geotags=False,
            save_metadata=False,
            compress_json=False,
            download_video_thumbnails=False,
            quiet=True
        )

    def validate_url(self, url: str) -> Tuple[bool, str, str]:
        """
        Validate if URL is from supported platform
        Returns: (is_valid, platform, error_message)
        """
        if not url:
            return False, '', 'URL is required'

        # Check YouTube
        if self.YOUTUBE_REGEX.match(url):
            return True, 'youtube', ''

        # Check Instagram
        if self.INSTAGRAM_REGEX.match(url):
            return True, 'instagram', ''

        return False, '', 'URL must be from YouTube or Instagram'

    def get_video_info(self, url: str) -> Dict:
        """Get video metadata without downloading"""
        is_valid, platform, error = self.validate_url(url)

        if not is_valid:
            return {'error': error}

        try:
            if platform == 'youtube':
                return self._get_youtube_info(url)
            elif platform == 'instagram':
                return self._get_instagram_info(url)
        except Exception as e:
            logger.error(f"Error getting video info: {e}")
            return {'error': str(e)}

    def _get_youtube_info(self, url: str) -> Dict:
        """Get YouTube video information"""
        opts = get_info_opts()

        with yt_dlp.YoutubeDL(opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)

                # Get available formats
                # YouTube now uses DASH - video and audio are separate streams
                # We need to look at video-only formats and yt-dlp will merge with best audio
                formats = []
                if 'formats' in info:
                    seen_heights = set()
                    for f in info['formats']:
                        height = f.get('height', 0)
                        vcodec = f.get('vcodec', 'none')

                        # Include video formats (even if audio is separate - yt-dlp will merge)
                        # YouTube DASH format: video and audio are separate
                        if vcodec not in ['none', None] and height and height > 0:
                            if height not in seen_heights:
                                seen_heights.add(height)
                                # Calculate approximate merged size (video + audio ~15% overhead)
                                filesize = f.get('filesize') or f.get('filesize_approx') or 0
                                formats.append({
                                    'format_id': f.get('format_id'),
                                    'quality': f'{height}p',
                                    'ext': 'mp4',  # Output will be merged to mp4
                                    'filesize': int(filesize * 1.15) if filesize else 0,
                                    'filesize_approx': int(filesize * 1.15) if filesize else 0
                                })

                # Always provide standard quality options as fallback
                if not formats:
                    formats = [
                        {'format_id': 'bestvideo+bestaudio', 'quality': 'Best Quality', 'ext': 'mp4'},
                        {'format_id': '137+140', 'quality': '1080p', 'ext': 'mp4'},
                        {'format_id': '136+140', 'quality': '720p', 'ext': 'mp4'},
                        {'format_id': '135+140', 'quality': '480p', 'ext': 'mp4'},
                        {'format_id': '134+140', 'quality': '360p', 'ext': 'mp4'},
                    ]
                else:
                    # Sort formats by quality (highest first)
                    formats.sort(key=lambda x: int(x['quality'].replace('p', '')) if x['quality'].endswith('p') else 9999, reverse=True)
                    # Add "Best Quality" option at the top
                    formats.insert(0, {'format_id': 'bestvideo+bestaudio', 'quality': 'Best Quality', 'ext': 'mp4'})

                return {
                    'platform': 'youtube',
                    'title': info.get('title', 'Unknown'),
                    'duration': info.get('duration', 0),
                    'thumbnail': info.get('thumbnail', ''),
                    'uploader': info.get('uploader', 'Unknown'),
                    'view_count': info.get('view_count', 0),
                    'description': info.get('description', '')[:500],
                    'formats': formats[:5],  # Limit to top 5 qualities
                    'url': url,
                    'video_id': info.get('id', ''),
                    'success': True
                }
            except Exception as e:
                raise Exception(f"Failed to get YouTube video info: {str(e)}")

    def _get_instagram_info(self, url: str) -> Dict:
        """Get Instagram post/reel information"""
        try:
            # Extract shortcode from URL
            shortcode_match = re.search(r'/(p|reel|tv)/([\w-]+)', url)
            if not shortcode_match:
                raise Exception("Invalid Instagram URL")

            shortcode = shortcode_match.group(2)

            # Get post info
            post = instaloader.Post.from_shortcode(self.insta_loader.context, shortcode)

            return {
                'platform': 'instagram',
                'title': post.caption[:100] if post.caption else 'Instagram Video',
                'duration': post.video_duration if post.is_video else 0,
                'thumbnail': post.url,
                'uploader': post.owner_username,
                'view_count': post.video_view_count if post.is_video else post.likes,
                'description': post.caption[:500] if post.caption else '',
                'formats': [
                    {'format_id': 'best', 'quality': 'Original', 'ext': 'mp4'}
                ],
                'url': url,
                'video_id': shortcode,
                'is_video': post.is_video,
                'success': True
            }
        except Exception as e:
            raise Exception(f"Failed to get Instagram info: {str(e)}")

    def download_video(self, url: str, quality: str = 'best', format: str = 'mp4') -> Dict:
        """
        Download video from URL
        Returns: Dict with download status and file path
        """
        is_valid, platform, error = self.validate_url(url)

        if not is_valid:
            return {'success': False, 'error': error}

        try:
            if platform == 'youtube':
                return self._download_youtube(url, quality, format)
            elif platform == 'instagram':
                return self._download_instagram(url)
        except Exception as e:
            logger.error(f"Download error: {e}")
            return {'success': False, 'error': str(e)}

    def _download_youtube(self, url: str, quality: str, format: str) -> Dict:
        """Download YouTube video"""
        try:
            # Generate unique filename
            file_id = str(uuid.uuid4())
            output_path = self.temp_dir / f'{file_id}.%(ext)s'

            opts = {**self.yt_dlp_opts}
            opts['outtmpl'] = str(output_path)

            # Remove duplicate format key that might conflict
            if 'format' in opts:
                del opts['format']

            # Handle audio-only first
            if format == 'mp3':
                # For audio, use simple format
                opts['format'] = 'bestaudio/best'
                opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }]
            else:
                # For video: use bestvideo+bestaudio with merge
                # YouTube uses DASH, so we need to merge video and audio streams

                # Map quality string to height
                quality_map = {
                    'Best Quality': 'bestvideo+bestaudio/best',
                    '2160p': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]/best',
                    '1440p': 'bestvideo[height<=1440]+bestaudio/best[height<=1440]/best',
                    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
                    '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
                    '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]/best',
                    '360p': 'bestvideo[height<=360]+bestaudio/best[height<=360]/best',
                    '240p': 'bestvideo[height<=240]+bestaudio/best[height<=240]/best',
                    '144p': 'bestvideo[height<=144]+bestaudio/best[height<=144]/best',
                }

                # Get format string based on quality
                format_string = quality_map.get(quality, 'bestvideo+bestaudio/best')
                opts['format'] = format_string

                # Merge output to mp4
                opts['merge_output_format'] = 'mp4'

                # Add postprocessor to ensure mp4 output
                opts['postprocessors'] = [{
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                }]

            # Check if ffmpeg is available
            import shutil
            ffmpeg_path = shutil.which('ffmpeg')
            if ffmpeg_path:
                opts['ffmpeg_location'] = os.path.dirname(ffmpeg_path)
            else:
                # If no ffmpeg, fall back to formats that don't require merging
                logger.warning("FFmpeg not found, using fallback format")
                opts['format'] = 'best[ext=mp4]/best'
                if 'postprocessors' in opts:
                    del opts['postprocessors']
                if 'merge_output_format' in opts:
                    del opts['merge_output_format']

            # Download with retry logic
            max_retries = 3
            info = None
            for attempt in range(max_retries):
                try:
                    with yt_dlp.YoutubeDL(opts) as ydl:
                        info = ydl.extract_info(url, download=True)
                        break
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise Exception(f"All download attempts failed: {str(e)}")
                    logger.warning(f"Download attempt {attempt + 1} failed: {e}")
                    time.sleep(2)  # Wait before retry

            # Check if download was successful
            if not info:
                raise Exception("Failed to download video: No information returned")

            # Find downloaded file
            downloaded_file = None
            for ext in ['mp4', 'webm', 'mp3', 'mkv']:
                potential_file = self.temp_dir / f'{file_id}.{ext}'
                if potential_file.exists():
                    downloaded_file = potential_file
                    break

            if not downloaded_file:
                raise Exception("Download completed but file not found")

            # Get file info
            file_size = downloaded_file.stat().st_size

            return {
                'success': True,
                'file_path': str(downloaded_file),
                'file_name': f"{info.get('title', 'video')}.{downloaded_file.suffix[1:]}",
                'file_size': file_size,
                'file_id': file_id,
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'format': downloaded_file.suffix[1:],
                'quality': quality
            }

        except Exception as e:
            raise Exception(f"YouTube download failed: {str(e)}")

    def _download_instagram(self, url: str) -> Dict:
        """Download Instagram video/reel"""
        try:
            # Extract shortcode
            shortcode_match = re.search(r'/(p|reel|tv)/([\w-]+)', url)
            if not shortcode_match:
                raise Exception("Invalid Instagram URL")

            shortcode = shortcode_match.group(2)
            file_id = str(uuid.uuid4())

            # Download post
            post = instaloader.Post.from_shortcode(self.insta_loader.context, shortcode)

            if not post.is_video:
                raise Exception("This Instagram post doesn't contain a video")

            # Download video
            target_file = self.temp_dir / f"{file_id}.mp4"
            self.insta_loader.download_post(post, target=self.temp_dir)

            # Find downloaded file (Instaloader creates its own naming)
            downloaded_files = list(self.temp_dir.glob(f"*{shortcode}*.mp4"))
            if not downloaded_files:
                raise Exception("Download completed but video file not found")

            # Rename to our file_id
            downloaded_file = downloaded_files[0]
            downloaded_file.rename(target_file)

            # Clean up other files created by instaloader
            for file in self.temp_dir.glob(f"*{shortcode}*"):
                if file != target_file:
                    file.unlink()

            file_size = target_file.stat().st_size

            return {
                'success': True,
                'file_path': str(target_file),
                'file_name': f"{post.owner_username}_{shortcode}.mp4",
                'file_size': file_size,
                'file_id': file_id,
                'title': post.caption[:100] if post.caption else 'Instagram Video',
                'duration': post.video_duration if hasattr(post, 'video_duration') else 0,
                'format': 'mp4',
                'quality': 'original'
            }

        except Exception as e:
            raise Exception(f"Instagram download failed: {str(e)}")

    def clean_old_files(self, max_age_hours: int = 1):
        """Clean up old temporary files"""
        import time
        current_time = time.time()

        for file_path in self.temp_dir.iterdir():
            if file_path.is_file():
                file_age_hours = (current_time - file_path.stat().st_mtime) / 3600
                if file_age_hours > max_age_hours:
                    try:
                        file_path.unlink()
                        logger.info(f"Deleted old file: {file_path.name}")
                    except Exception as e:
                        logger.error(f"Failed to delete {file_path.name}: {e}")

    def get_download_path(self, file_id: str) -> Optional[Path]:
        """Get the path of a downloaded file by ID"""
        for ext in self.ALLOWED_FORMATS + ['mkv', 'webm']:
            file_path = self.temp_dir / f"{file_id}.{ext}"
            if file_path.exists():
                return file_path
        return None