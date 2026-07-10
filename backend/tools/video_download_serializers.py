"""
Serializers for Video Download functionality
"""
from rest_framework import serializers
from typing import List, Dict


class VideoInfoRequestSerializer(serializers.Serializer):
    """Serializer for video information requests"""
    url = serializers.URLField(required=True, help_text="YouTube or Instagram video URL")


class VideoFormatSerializer(serializers.Serializer):
    """Serializer for video format information"""
    format_id = serializers.CharField(read_only=True)
    quality = serializers.CharField(read_only=True)
    ext = serializers.CharField(read_only=True)
    filesize = serializers.IntegerField(read_only=True, required=False)
    filesize_approx = serializers.IntegerField(read_only=True, required=False)


class VideoInfoResponseSerializer(serializers.Serializer):
    """Serializer for video information response"""
    success = serializers.BooleanField(read_only=True)
    platform = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    duration = serializers.IntegerField(read_only=True)
    thumbnail = serializers.URLField(read_only=True)
    uploader = serializers.CharField(read_only=True)
    view_count = serializers.IntegerField(read_only=True)
    description = serializers.CharField(read_only=True)
    formats = VideoFormatSerializer(many=True, read_only=True)
    url = serializers.URLField(read_only=True)
    video_id = serializers.CharField(read_only=True)
    is_video = serializers.BooleanField(read_only=True, required=False)
    error = serializers.CharField(read_only=True, required=False)


class VideoDownloadRequestSerializer(serializers.Serializer):
    """Serializer for video download requests"""
    url = serializers.URLField(required=True, help_text="YouTube or Instagram video URL")
    quality = serializers.ChoiceField(
        choices=['best', '1080p', '720p', '480p', '360p'],
        default='best',
        help_text="Video quality to download"
    )
    format = serializers.ChoiceField(
        choices=['mp4', 'webm', 'mp3'],
        default='mp4',
        help_text="Output format (mp3 for audio only)"
    )


class VideoDownloadResponseSerializer(serializers.Serializer):
    """Serializer for video download response"""
    success = serializers.BooleanField(read_only=True)
    file_id = serializers.CharField(read_only=True)
    file_name = serializers.CharField(read_only=True)
    file_size = serializers.IntegerField(read_only=True)
    title = serializers.CharField(read_only=True)
    duration = serializers.IntegerField(read_only=True)
    format = serializers.CharField(read_only=True)
    quality = serializers.CharField(read_only=True)
    download_url = serializers.URLField(read_only=True, required=False)
    error = serializers.CharField(read_only=True, required=False)


class VideoDownloadStatusSerializer(serializers.Serializer):
    """Serializer for download status"""
    file_id = serializers.CharField(required=True)
    status = serializers.ChoiceField(
        choices=['pending', 'downloading', 'completed', 'failed'],
        read_only=True
    )
    progress = serializers.IntegerField(read_only=True, min_value=0, max_value=100)
    error = serializers.CharField(read_only=True, required=False)