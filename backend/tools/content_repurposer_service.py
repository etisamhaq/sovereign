"""
Content Repurposer Service
Takes a YouTube URL or uploaded audio file, transcribes it with Groq Whisper,
extracts structured insights, and generates platform-specific content
(LinkedIn post, Twitter/X thread, newsletter draft).
"""
import os
import re
import json
import tempfile
import hashlib
import logging
from typing import Dict, Any, Optional, List

import yt_dlp
from groq import Groq
from django.conf import settings
from django.core.cache import cache
from django.core.files.uploadedfile import UploadedFile
from tools.ytdlp_config import get_info_opts, get_caption_opts, get_audio_opts

logger = logging.getLogger(__name__)


class ContentRepurposerService:
    """
    End-to-end pipeline:
      1. process()   – accept URL or audio file → transcribe → extract insights
      2. generate()  – insights/transcript → platform-specific content
      3. regenerate_section() – re-roll a single platform block
    """

    def __init__(self):
        self.groq_client = (
            Groq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None
        )
        self.model = getattr(settings, "GROQ_MODEL", "mixtral-8x7b-32768")
        self.max_audio_size = 25 * 1024 * 1024  # Groq Whisper 25 MB limit
        self.max_video_duration = 3600           # 1 hour
        self.cache_ttl = 86400 * 3               # 3 days

    # ------------------------------------------------------------------
    # 1. PROCESS — transcribe + extract insights
    # ------------------------------------------------------------------
    def process(
        self,
        youtube_url: Optional[str] = None,
        audio_file: Optional[UploadedFile] = None,
    ) -> Dict[str, Any]:
        """
        Accepts either a YouTube URL **or** an uploaded audio file.
        Returns transcript text + structured insights JSON.
        """
        if not self.groq_client:
            return {"success": False, "error": "AI service (Groq) is not configured."}

        try:
            # ---- Transcribe ---------------------------------------------------
            if youtube_url:
                video_info = self._get_video_info(youtube_url)
                if "error" in video_info:
                    return {"success": False, "error": video_info["error"]}
                transcript = self._transcribe_youtube(youtube_url)
                source_title = video_info.get("title", "Untitled")
                source_meta = video_info
            elif audio_file:
                transcript = self._transcribe_uploaded_audio(audio_file)
                source_title = audio_file.name
                source_meta = {
                    "title": audio_file.name,
                    "file_size": audio_file.size,
                }
            else:
                return {
                    "success": False,
                    "error": "Provide either a YouTube URL or an audio file.",
                }

            if not transcript:
                return {
                    "success": False,
                    "error": "Could not transcribe the audio. The file may be too large, corrupted, or in an unsupported format.",
                }

            # ---- Clean transcript --------------------------------------------
            cleaned = self._clean_transcript(transcript)

            # ---- Extract structured insights ----------------------------------
            insights = self._extract_insights(cleaned, source_title)

            return {
                "success": True,
                "source_title": source_title,
                "source_meta": source_meta,
                "transcript": cleaned,
                "word_count": len(cleaned.split()),
                "insights": insights,
            }

        except Exception as e:
            logger.error(f"ContentRepurposer.process error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # 2. GENERATE — produce platform-specific content
    # ------------------------------------------------------------------
    SUPPORTED_PLATFORMS = ["linkedin", "twitter", "newsletter"]

    def generate(
        self,
        transcript: str,
        insights: Dict[str, Any],
        source_title: str = "",
        platforms: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Given a transcript + insights, generate content for each platform.
        """
        if not self.groq_client:
            return {"success": False, "error": "AI service is not configured."}

        platforms = platforms or self.SUPPORTED_PLATFORMS

        try:
            results: Dict[str, str] = {}
            for platform in platforms:
                if platform not in self.SUPPORTED_PLATFORMS:
                    continue
                content = self._generate_for_platform(
                    platform, transcript, insights, source_title
                )
                results[platform] = content

            return {"success": True, "content": results}

        except Exception as e:
            logger.error(f"ContentRepurposer.generate error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    # ------------------------------------------------------------------
    # 3. REGENERATE — re-roll a single section
    # ------------------------------------------------------------------
    def regenerate_section(
        self,
        platform: str,
        transcript: str,
        insights: Dict[str, Any],
        source_title: str = "",
        instructions: str = "",
    ) -> Dict[str, Any]:
        """
        Re-generate content for a single platform, optionally with extra
        user instructions (e.g. "make it shorter", "more casual tone").
        """
        if not self.groq_client:
            return {"success": False, "error": "AI service is not configured."}

        if platform not in self.SUPPORTED_PLATFORMS:
            return {"success": False, "error": f"Unsupported platform: {platform}"}

        try:
            content = self._generate_for_platform(
                platform, transcript, insights, source_title, instructions
            )
            return {"success": True, "platform": platform, "content": content}
        except Exception as e:
            logger.error(f"ContentRepurposer.regenerate error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    # ==================================================================
    #  PRIVATE HELPERS
    # ==================================================================

    # ---- YouTube info ------------------------------------------------
    def _get_video_info(self, url: str) -> Dict[str, Any]:
        cache_key = self._cache_key("repurpose_info", url)
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            ydl_opts = get_info_opts(format='bestaudio/best')
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                duration = info.get("duration", 0)
                if duration > self.max_video_duration:
                    return {
                        "error": f"Video is too long ({duration // 60} min). Max is {self.max_video_duration // 60} min."
                    }

                data = {
                    "video_id": info.get("id", ""),
                    "title": info.get("title", "Untitled"),
                    "description": (info.get("description") or "")[:500],
                    "duration": duration,
                    "thumbnail": info.get("thumbnail", ""),
                    "uploader": info.get("uploader", "Unknown"),
                    "url": url,
                }
                cache.set(cache_key, data, self.cache_ttl)
                return data

        except Exception as e:
            logger.error(f"yt_dlp info error: {e}")
            return {"error": f"Could not retrieve video info: {e}"}

    # ---- YouTube transcription (captions → Whisper fallback) ---------
    def _transcribe_youtube(self, url: str) -> Optional[str]:
        cache_key = self._cache_key("repurpose_transcript", url)
        cached = cache.get(cache_key)
        if cached:
            return cached

        # Try captions first
        transcript = self._extract_youtube_captions(url)

        # Fallback: download audio → Whisper
        if not transcript:
            transcript = self._download_and_whisper(url)

        if transcript:
            cache.set(cache_key, transcript, self.cache_ttl)

        return transcript

    def _extract_youtube_captions(self, url: str) -> Optional[str]:
        """Try VTT automatic/manual captions from YouTube."""
        try:
            with tempfile.TemporaryDirectory() as td:
                ydl_opts = get_caption_opts(td)
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    vid = info.get("id", "")
                    for lang in ["en", "en-US", "a.en"]:
                        vtt = os.path.join(td, f"{vid}.{lang}.vtt")
                        if os.path.exists(vtt):
                            with open(vtt, "r", encoding="utf-8") as f:
                                return self._parse_vtt(f.read())
            return None
        except Exception as e:
            logger.warning(f"Caption extraction failed: {e}")
            return None

    def _download_and_whisper(self, url: str) -> Optional[str]:
        """Download audio from URL and send to Groq Whisper API."""
        try:
            with tempfile.TemporaryDirectory() as td:
                audio_path = os.path.join(td, "audio.mp3")
                ydl_opts = get_audio_opts(audio_path, quality='64')
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])

                # Resolve actual file (yt_dlp sometimes doubles extension)
                actual = self._find_audio_file(td, "mp3")
                if not actual:
                    return None

                return self._whisper_transcribe(actual)

        except Exception as e:
            logger.error(f"Download+Whisper error: {e}")
            return None

    # ---- Uploaded audio transcription --------------------------------
    def _transcribe_uploaded_audio(self, audio_file: UploadedFile) -> Optional[str]:
        """Save upload to tmp, send to Whisper."""
        try:
            ext = os.path.splitext(audio_file.name)[1] or ".mp3"
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                for chunk in audio_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            try:
                if os.path.getsize(tmp_path) > self.max_audio_size:
                    return None
                return self._whisper_transcribe(tmp_path)
            finally:
                os.unlink(tmp_path)

        except Exception as e:
            logger.error(f"Uploaded audio transcription error: {e}")
            return None

    # ---- Whisper API call --------------------------------------------
    def _whisper_transcribe(self, file_path: str) -> Optional[str]:
        fsize = os.path.getsize(file_path)
        if fsize > self.max_audio_size:
            logger.warning(f"Audio too large ({fsize / 1024 / 1024:.1f} MB)")
            return None

        logger.info(f"Whisper transcribing {file_path} ({fsize / 1024 / 1024:.1f} MB)")
        with open(file_path, "rb") as f:
            result = self.groq_client.audio.transcriptions.create(
                file=(os.path.basename(file_path), f),
                model="whisper-large-v3",
                response_format="text",
                language="en",
            )
        return result if isinstance(result, str) else result.text

    # ---- Transcript utilities ----------------------------------------
    @staticmethod
    def _parse_vtt(vtt: str) -> str:
        lines = []
        for line in vtt.split("\n"):
            if "-->" in line or line.startswith("WEBVTT") or line.strip() == "":
                continue
            line = re.sub(r"<[^>]+>", "", line)
            lines.append(line.strip())
        return " ".join(lines)

    @staticmethod
    def _clean_transcript(raw: str) -> str:
        """Remove filler words, normalise whitespace, fix basic punctuation."""
        text = re.sub(r"\s+", " ", raw).strip()
        # Remove repeated filler words
        fillers = r"\b(um|uh|ah|like|you know|I mean|basically|actually|right)\b"
        text = re.sub(fillers, "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s{2,}", " ", text).strip()
        return text

    @staticmethod
    def _find_audio_file(directory: str, ext: str) -> Optional[str]:
        for f in os.listdir(directory):
            if f.endswith(f".{ext}"):
                return os.path.join(directory, f)
        return None

    # ---- Insight extraction via LLM ----------------------------------
    def _extract_insights(self, transcript: str, title: str) -> Dict[str, Any]:
        """Ask the LLM to extract structured insights from the transcript."""
        # Truncate if very long
        max_chars = 6000
        excerpt = transcript[:max_chars] + ("..." if len(transcript) > max_chars else "")

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert content strategist. Analyze the following transcript "
                    "and extract structured insights. Return ONLY valid JSON with no extra text."
                ),
            },
            {
                "role": "user",
                "content": f"""Transcript title: "{title}"

Transcript:
{excerpt}

Return a JSON object with exactly these keys:
{{
  "main_topics": ["topic1", "topic2", ...],
  "strong_hooks": ["hook1", "hook2", ...],
  "actionable_insights": ["insight1", "insight2", ...],
  "story_segments": ["story1", "story2", ...],
  "key_quotes": ["quote1", "quote2", ...],
  "target_audience": "description of the ideal audience"
}}

Provide 3-5 items per array. Be specific and concise.""",
            },
        ]

        resp = self.groq_client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.4,
            max_tokens=1500,
        )

        raw = resp.choices[0].message.content.strip()
        return self._parse_json_response(raw)

    # ---- Platform content generation ---------------------------------
    _PLATFORM_PROMPTS = {
        "linkedin": {
            "system": (
                "You are a LinkedIn content expert who writes viral, professional posts. "
                "You create engaging posts with strong hooks, clear structure with line breaks, "
                "and a compelling call-to-action. Use emojis sparingly for emphasis."
            ),
            "user_template": (
                "Write a LinkedIn post (150-300 words) based on this content.\n\n"
                "Title: {title}\n\n"
                "Key Insights:\n{insights_text}\n\n"
                "Transcript excerpt:\n{transcript_excerpt}\n\n"
                "Requirements:\n"
                "- Start with a bold hook (first line people see before 'see more')\n"
                "- Use short paragraphs with line breaks\n"
                "- Include 2-3 actionable takeaways\n"
                "- End with a question or CTA to drive engagement\n"
                "- Add 3-5 relevant hashtags at the end\n"
                "{extra_instructions}"
            ),
        },
        "twitter": {
            "system": (
                "You are a Twitter/X thread expert. You write engaging, punchy threads "
                "that break complex ideas into digestible tweets. Each tweet should be "
                "self-contained yet flow as part of the narrative."
            ),
            "user_template": (
                "Write a Twitter/X thread (6-10 tweets) based on this content.\n\n"
                "Title: {title}\n\n"
                "Key Insights:\n{insights_text}\n\n"
                "Transcript excerpt:\n{transcript_excerpt}\n\n"
                "Requirements:\n"
                "- First tweet must be an irresistible hook\n"
                "- Number each tweet (1/, 2/, etc.)\n"
                "- Each tweet ≤ 280 characters\n"
                "- Include 1 actionable takeaway per tweet\n"
                "- Last tweet should be a CTA + summary\n"
                "- Use line breaks between tweets for clarity\n"
                "{extra_instructions}"
            ),
        },
        "newsletter": {
            "system": (
                "You are a newsletter copywriter who creates engaging, value-packed email "
                "content. You structure newsletters with clear sections, compelling subject "
                "lines, and reader-friendly formatting."
            ),
            "user_template": (
                "Write a newsletter draft (300-500 words) based on this content.\n\n"
                "Title: {title}\n\n"
                "Key Insights:\n{insights_text}\n\n"
                "Transcript excerpt:\n{transcript_excerpt}\n\n"
                "Requirements:\n"
                "- Include a catchy subject line\n"
                "- Start with a personal/relatable intro (2-3 sentences)\n"
                "- Break into 3-4 clear sections with headers\n"
                "- Each section should deliver one key insight\n"
                "- Include a TL;DR section at the end\n"
                "- End with a clear CTA\n"
                "{extra_instructions}"
            ),
        },
    }

    def _generate_for_platform(
        self,
        platform: str,
        transcript: str,
        insights: Dict[str, Any],
        title: str = "",
        extra_instructions: str = "",
    ) -> str:
        cfg = self._PLATFORM_PROMPTS[platform]

        insights_text = self._insights_to_text(insights)
        transcript_excerpt = transcript[:3000]

        user_msg = cfg["user_template"].format(
            title=title,
            insights_text=insights_text,
            transcript_excerpt=transcript_excerpt,
            extra_instructions=(
                f"\nAdditional instructions: {extra_instructions}"
                if extra_instructions
                else ""
            ),
        )

        messages = [
            {"role": "system", "content": cfg["system"]},
            {"role": "user", "content": user_msg},
        ]

        resp = self.groq_client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
        )

        return resp.choices[0].message.content.strip()

    # ---- Utilities ---------------------------------------------------
    @staticmethod
    def _insights_to_text(insights: Dict[str, Any]) -> str:
        """Format insights dict into readable text for prompt context."""
        parts = []
        for key in ["main_topics", "strong_hooks", "actionable_insights", "key_quotes"]:
            items = insights.get(key, [])
            if items:
                label = key.replace("_", " ").title()
                parts.append(f"{label}:")
                for item in items:
                    parts.append(f"  • {item}")
        audience = insights.get("target_audience", "")
        if audience:
            parts.append(f"Target Audience: {audience}")
        return "\n".join(parts)

    @staticmethod
    def _parse_json_response(text: str) -> Dict[str, Any]:
        """Best-effort JSON parse from LLM output (may contain markdown fences)."""
        # Strip markdown code fences
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            match = re.search(r"\{[\s\S]*\}", text)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        # Return a safe fallback
        return {
            "main_topics": [],
            "strong_hooks": [],
            "actionable_insights": [],
            "story_segments": [],
            "key_quotes": [],
            "target_audience": "",
            "raw_text": text,
        }

    @staticmethod
    def _cache_key(prefix: str, identifier: str) -> str:
        h = hashlib.md5(identifier.encode()).hexdigest()
        return f"content_repurposer:{prefix}:{h}"
