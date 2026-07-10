import django_filters
from django.db import models
from .models import Post


class PostFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(field_name='category__slug')
    tag = django_filters.CharFilter(method='filter_by_tag')
    search = django_filters.CharFilter(method='filter_by_search')
    sort = django_filters.CharFilter(method='filter_by_sort')

    class Meta:
        model = Post
        fields = ['category', 'tag', 'search', 'sort']

    def filter_by_tag(self, queryset, name, value):
        return queryset.filter(tags__contains=[value])

    def filter_by_search(self, queryset, name, value):
        return queryset.filter(
            models.Q(title__icontains=value) |
            models.Q(content__icontains=value)
        )

    def filter_by_sort(self, queryset, name, value):
        if value == 'popular':
            return queryset.order_by('-is_pinned', '-likes_count', '-created_at')
        elif value == 'unanswered':
            return queryset.filter(replies_count=0).order_by('-created_at')
        elif value == 'most-viewed':
            return queryset.order_by('-is_pinned', '-views_count', '-created_at')
        # default: latest
        return queryset.order_by('-is_pinned', '-created_at')
