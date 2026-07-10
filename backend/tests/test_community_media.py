"""Community rich media, moderation, and API surface."""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from community.models import ContentReport, Post, PostAttachment


def _jpeg_bytes():
    buf = io.BytesIO()
    Image.new('RGB', (60, 40), color='red').save(buf, format='JPEG')
    buf.seek(0)
    return buf.read()


@pytest.fixture
def community_category(db):
    from community.models import Category

    return Category.objects.create(
        name='AI Discussion',
        slug='ai-discussion',
        description='',
        order=0,
    )


@pytest.fixture
def published_post(db, user, community_category):
    return Post.objects.create(
        author=user,
        category=community_category,
        title='Hello world post title here',
        content='This is enough content for the post body minimum.',
        tags=['ai'],
        moderation_state=Post.ModerationState.PUBLISHED,
    )


@pytest.mark.django_db
def test_create_post_response_includes_slug_and_id(auth_client, community_category):
    res = auth_client.post(
        '/api/community/posts/create/',
        {
            'title': 'A valid title for the post',
            'content': 'Enough body text here for validation.',
            'category_id': str(community_category.id),
            'tags': [],
        },
        format='json',
    )
    assert res.status_code == 201
    assert isinstance(res.data.get('slug'), str) and len(res.data['slug']) >= 3
    assert res.data.get('id')


@pytest.mark.django_db
def test_post_list_includes_media_fields(api_client, published_post):
    res = api_client.get('/api/community/posts/')
    assert res.status_code == 200
    row = res.data['results'][0]
    assert 'cover_thumbnail_url' in row
    assert 'media_count' in row
    assert row['media_count'] == 0
    assert row['moderation_state'] == Post.ModerationState.PUBLISHED


@pytest.mark.django_db
def test_pending_post_hidden_from_public_list(api_client, user, community_category):
    Post.objects.create(
        author=user,
        category=community_category,
        title='Pending post title long',
        content='Pending body with enough chars.',
        moderation_state=Post.ModerationState.PENDING,
    )
    res = api_client.get('/api/community/posts/')
    assert res.status_code == 200
    assert res.data['count'] == 0


@pytest.mark.django_db
def test_attachment_upload_image(auth_client, published_post):
    img = SimpleUploadedFile(
        'test.jpg',
        _jpeg_bytes(),
        content_type='image/jpeg',
    )
    url = f'/api/community/posts/{published_post.slug}/attachments/'
    res = auth_client.post(
        url,
        {'file': img, 'kind': PostAttachment.Kind.IMAGE},
        format='multipart',
    )
    assert res.status_code == 201, res.data
    assert res.data['kind'] == PostAttachment.Kind.IMAGE
    assert res.data['url']
    published_post.refresh_from_db()
    assert published_post.attachments.count() == 1
    att = published_post.attachments.first()
    assert att.processing_status == PostAttachment.ProcessingStatus.READY


@pytest.mark.django_db
def test_moderation_approve_staff(admin_auth_client, user, community_category):
    post = Post.objects.create(
        author=user,
        category=community_category,
        title='Needs approval title ok',
        content='Enough content here for validation rules.',
        moderation_state=Post.ModerationState.PENDING,
    )
    url = f'/api/community/moderation/posts/{post.slug}/approve/'
    res = admin_auth_client.post(url)
    assert res.status_code == 200
    post.refresh_from_db()
    assert post.moderation_state == Post.ModerationState.PUBLISHED


@pytest.mark.django_db
def test_content_report_post(auth_client, published_post):
    res = auth_client.post(
        '/api/community/reports/',
        {'reason': 'spam', 'post_slug': published_post.slug},
        format='json',
    )
    assert res.status_code == 201
    assert ContentReport.objects.filter(post=published_post).exists()


@pytest.mark.django_db
def test_pin_requires_staff_not_only_superuser(auth_client, published_post):
    """Staff (is_staff) can pin; plain authenticated user cannot."""
    res = auth_client.post(
        f'/api/community/posts/{published_post.slug}/pin/',
    )
    assert res.status_code == 403
