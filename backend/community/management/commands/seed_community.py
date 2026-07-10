from django.core.management.base import BaseCommand
from community.models import Category


SEED_CATEGORIES = [
    {
        'name': 'Writing Tips',
        'slug': 'writing-tips',
        'description': 'Share and discuss writing techniques, styles, and best practices',
        'icon': '📝',
        'color': '#6366f1',
        'order': 1,
    },
    {
        'name': 'AI Tools Help',
        'slug': 'ai-tools-help',
        'description': 'Questions and answers about using Sovereign AI writing tools',
        'icon': '🤖',
        'color': '#8b5cf6',
        'order': 2,
    },
    {
        'name': 'Show & Tell',
        'slug': 'show-and-tell',
        'description': 'Share your AI-generated content, projects, and creative work',
        'icon': '💡',
        'color': '#f59e0b',
        'order': 3,
    },
    {
        'name': 'General Discussion',
        'slug': 'general-discussion',
        'description': 'Off-topic conversations, introductions, and community chat',
        'icon': '💬',
        'color': '#10b981',
        'order': 4,
    },
    {
        'name': 'Feature Requests',
        'slug': 'feature-requests',
        'description': 'Suggest new features, improvements, and report bugs',
        'icon': '🐛',
        'color': '#ef4444',
        'order': 5,
    },
    {
        'name': 'Resources',
        'slug': 'resources',
        'description': 'Useful links, guides, tutorials, and learning materials',
        'icon': '📚',
        'color': '#3b82f6',
        'order': 6,
    },
]


class Command(BaseCommand):
    help = 'Seed default community categories'

    def handle(self, *args, **options):
        created_count = 0
        for cat_data in SEED_CATEGORIES:
            cat, created = Category.objects.get_or_create(
                slug=cat_data['slug'],
                defaults=cat_data
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'  Created: {cat.name}'))
            else:
                self.stdout.write(f'  Already exists: {cat.name}')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone! {created_count} new categories created.'
        ))
