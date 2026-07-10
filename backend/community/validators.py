"""Validate uploaded community media by magic bytes (not only Content-Type)."""
from django.conf import settings
from rest_framework.exceptions import ValidationError

IMAGE_MAGIC = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG\r\n\x1a\n': 'image/png',
    b'GIF87a': 'image/gif',
    b'GIF89a': 'image/gif',
}
WEBP_PREFIX = b'RIFF'
WEBP_MIDDLE = b'WEBP'

VIDEO_MAGIC_MP4 = [
    b'ftyp',  # appears at offset 4 in many MP4/MOV
]
VIDEO_MAGIC_WEBM = b'\x1a\x45\xdf\xa3'  # EBML (matroska / webm)


def _read_head(f, n=32):
    pos = f.tell()
    try:
        return f.read(n)
    finally:
        f.seek(pos)


def detect_image_or_video(file_obj):
    head = _read_head(file_obj, 32)
    if len(head) < 12:
        raise ValidationError('File is too small or empty.')

    for prefix, mime in IMAGE_MAGIC.items():
        if head.startswith(prefix):
            return 'image', mime

    if head.startswith(WEBP_PREFIX) and WEBP_MIDDLE in head[:16]:
        return 'image', 'image/webp'

    if head.startswith(VIDEO_MAGIC_WEBM):
        return 'video', 'video/webm'

    # MP4 / MOV: bytes 4-8 often "ftyp"
    if len(head) >= 12 and head[4:8] == b'ftyp':
        return 'video', 'video/mp4'

    raise ValidationError(
        'Unsupported or invalid file. Use JPEG, PNG, GIF, WebP for images, or MP4/WebM for video.'
    )


def assert_kind_matches_file(kind: str, file_obj):
    detected_kind, _mime = detect_image_or_video(file_obj)
    if detected_kind != kind:
        raise ValidationError(
            f'File content does not match declared type ({kind}).'
        )


def assert_file_size(kind: str, size: int):
    max_img = getattr(settings, 'COMMUNITY_MAX_IMAGE_BYTES', 10 * 1024 * 1024)
    max_vid = getattr(settings, 'COMMUNITY_MAX_VIDEO_BYTES', 100 * 1024 * 1024)
    limit = max_vid if kind == 'video' else max_img
    if size > limit:
        mb = limit // (1024 * 1024)
        raise ValidationError(f'File too large. Maximum size for this type is {mb}MB.')
