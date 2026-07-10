def absolute_media_url(request, file_field):
    if not file_field or not file_field.name:
        return None
    try:
        url = file_field.url
    except ValueError:
        return None
    if url.startswith('http://') or url.startswith('https://'):
        return url
    if request:
        return request.build_absolute_uri(url)
    return url
