"""
Video Embed Service - Alternative to downloading
Provides embed codes and video information without downloading
"""
import re
from typing import Dict, Optional
from urllib.parse import urlparse, parse_qs

class VideoEmbedService:
    """Service for generating embed codes instead of downloading"""
    
    @staticmethod
    def extract_youtube_id(url: str) -> Optional[str]:
        """Extract YouTube video ID from URL"""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    @staticmethod
    def extract_instagram_id(url: str) -> Optional[str]:
        """Extract Instagram post ID from URL"""
        pattern = r'instagram\.com\/(?:p|reel|tv)\/([^\/\?]+)'
        match = re.search(pattern, url)
        return match.group(1) if match else None
    
    def generate_youtube_embed(self, url: str) -> Dict:
        """Generate YouTube embed code and preview URL"""
        video_id = self.extract_youtube_id(url)
        if not video_id:
            return {'success': False, 'error': 'Invalid YouTube URL'}
        
        return {
            'success': True,
            'platform': 'youtube',
            'video_id': video_id,
            'embed_url': f'https://www.youtube.com/embed/{video_id}',
            'embed_code': f'<iframe width="560" height="315" src="https://www.youtube.com/embed/{video_id}" frameborder="0" allowfullscreen></iframe>',
            'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
            'watch_url': f'https://www.youtube.com/watch?v={video_id}',
            'alternative_action': 'embed',
            'message': 'Due to YouTube\'s terms of service, we provide embed functionality instead of downloads.'
        }
    
    def generate_instagram_embed(self, url: str) -> Dict:
        """Generate Instagram embed information"""
        post_id = self.extract_instagram_id(url)
        if not post_id:
            return {'success': False, 'error': 'Invalid Instagram URL'}
        
        return {
            'success': True,
            'platform': 'instagram',
            'post_id': post_id,
            'embed_url': f'https://www.instagram.com/p/{post_id}/embed',
            'embed_code': f'<iframe src="https://www.instagram.com/p/{post_id}/embed" width="400" height="480" frameborder="0" scrolling="no" allowtransparency="true"></iframe>',
            'watch_url': f'https://www.instagram.com/p/{post_id}/',
            'alternative_action': 'embed',
            'message': 'Due to Instagram\'s terms of service, we provide embed functionality instead of downloads.'
        }
    
    def get_embed_info(self, url: str) -> Dict:
        """Get embed information for any supported platform"""
        if 'youtube.com' in url or 'youtu.be' in url:
            return self.generate_youtube_embed(url)
        elif 'instagram.com' in url:
            return self.generate_instagram_embed(url)
        else:
            return {
                'success': False,
                'error': 'Unsupported platform. Only YouTube and Instagram are supported.'
            }