import logging
import os
import subprocess
import tempfile
from io import BytesIO

from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)


def _local_copy_for_processing(att):
    """Return (path, is_temp) for Pillow/ffmpeg; supports S3-backed storage."""
    try:
        p = att.file.path
        if p and os.path.isfile(p):
            return p, False
    except (NotImplementedError, ValueError, AttributeError):
        pass
    if not att.file:
        return None, False
    suffix = '.mp4' if att.kind == 'video' else '.jpg'
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        with att.file.open('rb') as src, open(tmp_path, 'wb') as dest:
            for chunk in iter(lambda: src.read(1024 * 1024), b''):
                dest.write(chunk)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
    return tmp_path, True


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def process_community_attachment(self, attachment_id: str):
    """Generate thumbnails for images; poster + metadata for video (best-effort)."""
    from .models import PostAttachment

    try:
        att = PostAttachment.objects.select_related('post').get(pk=attachment_id)
    except PostAttachment.DoesNotExist:
        return

    path, is_temp = _local_copy_for_processing(att)
    if not path:
        PostAttachment.objects.filter(pk=attachment_id).update(
            processing_status=PostAttachment.ProcessingStatus.FAILED
        )
        return

    try:
        if att.kind == PostAttachment.Kind.IMAGE:
            _process_image_attachment(att, path)
        elif att.kind == PostAttachment.Kind.VIDEO:
            _process_video_attachment(att, path)
        else:
            PostAttachment.objects.filter(pk=attachment_id).update(
                processing_status=PostAttachment.ProcessingStatus.FAILED
            )
    except Exception as exc:
        logger.exception('process_community_attachment failed: %s', attachment_id)
        PostAttachment.objects.filter(pk=attachment_id).update(
            processing_status=PostAttachment.ProcessingStatus.FAILED
        )
        if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
            return
        raise self.retry(exc=exc)
    finally:
        if is_temp and path:
            try:
                os.unlink(path)
            except OSError:
                pass


def _process_image_attachment(att, path):
    from PIL import Image
    from .models import PostAttachment

    with Image.open(path) as im:
        if im.mode in ('RGBA', 'LA') or (
            im.mode == 'P' and 'transparency' in im.info
        ):
            base = Image.new('RGB', im.size, (255, 255, 255))
            rgba = im.convert('RGBA')
            base.paste(rgba, mask=rgba.split()[3])
            im = base
        else:
            im = im.convert('RGB')
        w, h = im.size
        att.width = w
        att.height = h
        thumb_size = getattr(settings, 'COMMUNITY_THUMBNAIL_MAX', 640)
        im_thumb = im.copy()
        im_thumb.thumbnail((thumb_size, thumb_size), Image.Resampling.LANCZOS)
        buf = BytesIO()
        im_thumb.save(buf, format='JPEG', quality=85)
        buf.seek(0)
        att.thumbnail.save('thumb.jpg', ContentFile(buf.read()), save=False)
        att.processing_status = PostAttachment.ProcessingStatus.READY
        att.save(
            update_fields=['width', 'height', 'thumbnail', 'processing_status']
        )


def _process_video_attachment(att, path):
    from .models import PostAttachment

    duration = _ffprobe_duration(path)
    if duration is not None:
        att.duration_seconds = int(min(duration, 86400))

    poster_path = _ffmpeg_poster(path)
    if poster_path and os.path.isfile(poster_path):
        try:
            with open(poster_path, 'rb') as f:
                att.thumbnail.save(
                    f'poster_{att.id}.jpg',
                    ContentFile(f.read()),
                    save=False,
                )
            from PIL import Image

            with Image.open(poster_path) as im:
                att.width, att.height = im.size
        except Exception:
            logger.warning('Video poster/thumbnail failed for %s', att.pk)
        finally:
            try:
                os.unlink(poster_path)
            except OSError:
                pass

    att.processing_status = PostAttachment.ProcessingStatus.READY
    fields = ['processing_status']
    if att.duration_seconds is not None:
        fields.append('duration_seconds')
    if att.thumbnail:
        fields.extend(['thumbnail', 'width', 'height'])
    att.save(update_fields=fields)


def _ffprobe_duration(path):
    try:
        out = subprocess.run(
            [
                'ffprobe',
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=noprint_wrappers=1:nokey=1',
                path,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if out.returncode != 0:
            return None
        return float(out.stdout.strip())
    except (FileNotFoundError, subprocess.TimeoutExpired, ValueError):
        return None


def _ffmpeg_poster(video_path):
    try:
        fd, out = tempfile.mkstemp(suffix='.jpg')
        os.close(fd)
        r = subprocess.run(
            [
                'ffmpeg',
                '-y',
                '-ss',
                '1',
                '-i',
                video_path,
                '-vframes',
                '1',
                '-q:v',
                '2',
                out,
            ],
            capture_output=True,
            timeout=120,
        )
        if r.returncode != 0:
            try:
                os.unlink(out)
            except OSError:
                pass
            return None
        return out
    except FileNotFoundError:
        return None
