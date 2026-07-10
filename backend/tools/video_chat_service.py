"""
Video Chat Service - Interactive AI conversations about video content
Uses Groq's Whisper API for transcription (no local whisper installation needed)
"""
import os
import tempfile
import logging
import json
import hashlib
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
import re
import subprocess

import yt_dlp
from groq import Groq
from django.conf import settings
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from tools.ytdlp_config import get_info_opts, get_caption_opts, get_audio_opts

logger = logging.getLogger(__name__)


class VideoChatService:
    """
    Service for processing videos and enabling AI chat about video content
    Uses Groq's Whisper API for transcription
    """

    def __init__(self):
        self.groq_client = Groq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None
        self.max_video_duration = 3600  # 1 hour max
        self.max_audio_size = 25 * 1024 * 1024  # 25MB limit for Groq Whisper API
        self.cache_ttl = 86400 * 7  # 7 days cache

    def process_video_url(self, url: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Process a video from URL (YouTube, Vimeo, etc.)
        """
        try:
            # Check cache first
            cache_key = self._get_cache_key('video_info', url)
            cached_data = cache.get(cache_key)
            if cached_data:
                logger.info(f"Returning cached video info for {url}")
                return cached_data

            # Extract video info
            ydl_opts = get_info_opts(format='bestaudio/best')

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

                # Check video duration
                duration = info.get('duration', 0)
                if duration > self.max_video_duration:
                    return {
                        'error': f'Video is too long. Maximum duration is {self.max_video_duration/60} minutes.'
                    }

                video_data = {
                    'video_id': info.get('id', ''),
                    'title': info.get('title', 'Untitled'),
                    'description': info.get('description', ''),
                    'duration': duration,
                    'thumbnail': info.get('thumbnail', ''),
                    'uploader': info.get('uploader', 'Unknown'),
                    'view_count': info.get('view_count', 0),
                    'url': url,
                    'platform': info.get('extractor', 'unknown').lower(),
                }

                # Cache the result
                cache.set(cache_key, video_data, self.cache_ttl)

                return video_data

        except Exception as e:
            logger.error(f"Error processing video URL {url}: {e}")
            return {'error': str(e)}

    def generate_transcript(self, video_url: str) -> Dict[str, Any]:
        """
        Generate transcript from video using Whisper or YouTube captions
        """
        try:
            # Check cache
            cache_key = self._get_cache_key('transcript', video_url)
            cached_transcript = cache.get(cache_key)
            if cached_transcript:
                logger.info("Returning cached transcript")
                return cached_transcript

            # First try to get YouTube automatic captions
            transcript = self._extract_youtube_captions(video_url)

            # If no captions, download audio and transcribe
            if not transcript:
                transcript = self._transcribe_audio(video_url)

            if transcript:
                # Process transcript into segments
                segments = self._process_transcript(transcript)

                result = {
                    'success': True,
                    'transcript': transcript,
                    'segments': segments,
                    'word_count': len(transcript.split()),
                    'language': self._detect_language(transcript[:500])
                }

                # Cache the transcript
                cache.set(cache_key, result, self.cache_ttl)
                return result

            return {
                'success': False,
                'error': 'Could not generate transcript'
            }

        except Exception as e:
            logger.error(f"Error generating transcript: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _extract_youtube_captions(self, url: str) -> Optional[str]:
        """
        Try to extract automatic captions from YouTube
        """
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                ydl_opts = get_caption_opts(temp_dir)

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    video_id = info.get('id', '')

                    # Look for subtitle files
                    for lang in ['en', 'en-US', 'a.en']:
                        vtt_file = os.path.join(temp_dir, f"{video_id}.{lang}.vtt")
                        if os.path.exists(vtt_file):
                            with open(vtt_file, 'r', encoding='utf-8') as f:
                                content = f.read()
                                # Parse VTT to plain text
                                return self._parse_vtt(content)

            return None

        except Exception as e:
            logger.warning(f"Could not extract YouTube captions: {e}")
            return None

    def _parse_vtt(self, vtt_content: str) -> str:
        """
        Parse VTT subtitle format to plain text
        """
        lines = vtt_content.split('\n')
        transcript = []

        for line in lines:
            # Skip timecodes and metadata
            if '-->' in line or line.startswith('WEBVTT') or line.strip() == '':
                continue
            # Remove HTML tags
            line = re.sub('<[^>]+>', '', line)
            transcript.append(line.strip())

        return ' '.join(transcript)

    def _transcribe_audio(self, video_url: str) -> Optional[str]:
        """
        Download audio and transcribe using Groq's Whisper API
        """
        try:
            if not self.groq_client:
                logger.error("Groq client not configured for transcription")
                return None

            with tempfile.TemporaryDirectory() as temp_dir:
                audio_file = os.path.join(temp_dir, 'audio.mp3')

                # Download audio only with lower bitrate to stay under 25MB limit
                ydl_opts = get_audio_opts(audio_file, quality='64')

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([video_url])

                # Check if file exists with .mp3 extension
                if not os.path.exists(audio_file):
                    audio_file = audio_file.replace('.mp3', '.mp3.mp3')

                # Also check without double extension
                if not os.path.exists(audio_file):
                    for f in os.listdir(temp_dir):
                        if f.endswith('.mp3'):
                            audio_file = os.path.join(temp_dir, f)
                            break

                if os.path.exists(audio_file):
                    # Check file size - Groq has 25MB limit
                    file_size = os.path.getsize(audio_file)
                    if file_size > self.max_audio_size:
                        logger.warning(f"Audio file too large ({file_size / 1024 / 1024:.1f}MB), truncating...")
                        # For very long videos, we may need to truncate or use YouTube captions
                        return None

                    # Use Groq's Whisper API for transcription
                    logger.info(f"Transcribing audio file: {audio_file} ({file_size / 1024 / 1024:.1f}MB)")

                    with open(audio_file, 'rb') as f:
                        transcription = self.groq_client.audio.transcriptions.create(
                            file=(os.path.basename(audio_file), f),
                            model="whisper-large-v3",
                            response_format="text",
                            language="en"
                        )

                    return transcription if isinstance(transcription, str) else transcription.text

                logger.warning("Audio file not found after download")
                return None

        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            return None

    def _process_transcript(self, transcript: str) -> List[Dict[str, Any]]:
        """
        Process transcript into segments for better navigation
        """
        # Split into sentences
        sentences = re.split(r'[.!?]+', transcript)
        segments = []

        # Group sentences into segments (roughly 3-4 sentences each)
        current_segment = []
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence:
                current_segment.append(sentence)
                if len(current_segment) >= 3:
                    segments.append({
                        'text': '. '.join(current_segment) + '.',
                        'index': len(segments)
                    })
                    current_segment = []

        # Add remaining sentences
        if current_segment:
            segments.append({
                'text': '. '.join(current_segment) + '.',
                'index': len(segments)
            })

        return segments

    def _detect_language(self, text: str) -> str:
        """
        Detect the language of the text
        """
        try:
            from langdetect import detect
            return detect(text)
        except:
            return 'en'

    def chat_about_video(self, video_url: str, question: str,
                        context: Optional[str] = None) -> Dict[str, Any]:
        """
        Have an AI conversation about the video content
        """
        try:
            if not self.groq_client:
                return {
                    'success': False,
                    'error': 'AI service not configured'
                }

            # Get video info and transcript
            video_info = self.process_video_url(video_url)
            if 'error' in video_info:
                return {
                    'success': False,
                    'error': video_info['error']
                }

            # Get or generate transcript
            transcript_data = self.generate_transcript(video_url)
            if not transcript_data.get('success'):
                # Try to answer based on video metadata only
                context = f"""
                Video Title: {video_info.get('title', 'Unknown')}
                Description: {video_info.get('description', 'No description')[:500]}
                Duration: {video_info.get('duration', 0)} seconds
                Uploader: {video_info.get('uploader', 'Unknown')}
                """
            else:
                # Use transcript as context
                transcript = transcript_data.get('transcript', '')
                # Limit context to avoid token limits
                context = f"""
                Video Title: {video_info.get('title', 'Unknown')}
                Video Transcript (excerpt): {transcript[:3000]}...

                Full transcript available with {transcript_data.get('word_count', 0)} words.
                """

            # Generate AI response
            messages = [
                {
                    "role": "system",
                    "content": """You are an AI assistant helping users understand video content.
                    Answer questions based on the provided video information and transcript.
                    Be helpful, accurate, and cite specific parts of the video when relevant.
                    If you don't have enough information to answer, say so clearly."""
                },
                {
                    "role": "user",
                    "content": f"""Based on this video context:

                    {context}

                    Please answer this question: {question}"""
                }
            ]

            response = self.groq_client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )

            answer = response.choices[0].message.content

            return {
                'success': True,
                'answer': answer,
                'video_info': video_info,
                'has_transcript': transcript_data.get('success', False)
            }

        except Exception as e:
            logger.error(f"Error in video chat: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def generate_summary(self, video_url: str, summary_type: str = 'brief') -> Dict[str, Any]:
        """
        Generate a summary of the video content
        """
        try:
            if not self.groq_client:
                return {
                    'success': False,
                    'error': 'AI service not configured'
                }

            # Check cache
            cache_key = self._get_cache_key(f'summary_{summary_type}', video_url)
            cached_summary = cache.get(cache_key)
            if cached_summary:
                return cached_summary

            # Get transcript
            transcript_data = self.generate_transcript(video_url)
            if not transcript_data.get('success'):
                return {
                    'success': False,
                    'error': 'Could not generate transcript for summary'
                }

            transcript = transcript_data.get('transcript', '')

            # Define summary prompts
            prompts = {
                'brief': "Provide a brief 2-3 sentence summary of this video transcript:",
                'detailed': "Provide a detailed summary with key points and takeaways from this video:",
                'bullet': "Provide a bullet-point summary of the main topics covered in this video:",
                'academic': "Provide an academic-style abstract summarizing the content, methodology, and conclusions:"
            }

            prompt = prompts.get(summary_type, prompts['brief'])

            # Limit transcript length for API
            max_length = 4000
            if len(transcript) > max_length:
                transcript = transcript[:max_length] + "... [truncated]"

            messages = [
                {
                    "role": "system",
                    "content": "You are an expert at summarizing video content clearly and concisely."
                },
                {
                    "role": "user",
                    "content": f"{prompt}\n\n{transcript}"
                }
            ]

            response = self.groq_client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=messages,
                temperature=0.5,
                max_tokens=500
            )

            summary = response.choices[0].message.content

            result = {
                'success': True,
                'summary': summary,
                'summary_type': summary_type,
                'word_count': len(summary.split())
            }

            # Cache the summary
            cache.set(cache_key, result, self.cache_ttl)

            return result

        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def extract_key_moments(self, video_url: str) -> Dict[str, Any]:
        """
        Extract key moments and timestamps from the video
        """
        try:
            # Get transcript with segments
            transcript_data = self.generate_transcript(video_url)
            if not transcript_data.get('success'):
                return {
                    'success': False,
                    'error': 'Could not generate transcript'
                }

            segments = transcript_data.get('segments', [])

            if not segments:
                return {
                    'success': True,
                    'key_moments': [],
                    'message': 'No segments found'
                }

            # Use AI to identify key moments
            if self.groq_client:
                # Select a sample of segments for analysis
                sample_segments = segments[::max(1, len(segments)//10)]  # Sample every 10th segment
                segments_text = '\n'.join([f"Segment {s['index']}: {s['text'][:200]}" for s in sample_segments])

                messages = [
                    {
                        "role": "system",
                        "content": "Identify the most important or interesting moments from these video segments."
                    },
                    {
                        "role": "user",
                        "content": f"Identify 3-5 key moments from these segments:\n\n{segments_text}"
                    }
                ]

                response = self.groq_client.chat.completions.create(
                    model=settings.GROQ_MODEL,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=500
                )

                key_moments_text = response.choices[0].message.content

                return {
                    'success': True,
                    'key_moments': key_moments_text,
                    'total_segments': len(segments)
                }

            return {
                'success': True,
                'segments': segments[:5],  # Return first 5 segments as key moments
                'total_segments': len(segments)
            }

        except Exception as e:
            logger.error(f"Error extracting key moments: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _get_cache_key(self, prefix: str, identifier: str) -> str:
        """
        Generate a cache key
        """
        hash_id = hashlib.md5(identifier.encode()).hexdigest()
        return f"video_chat:{prefix}:{hash_id}"