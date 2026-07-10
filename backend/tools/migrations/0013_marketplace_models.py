from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


def seed_initial_marketplace_tools(apps, schema_editor):
    MarketplaceTool = apps.get_model('tools', 'MarketplaceTool')

    initial_tools = [
        {
            'name': 'Prepza',
            'slug': 'prepza',
            'description': 'Data platform for practical data workflows and utilities.',
            'category': 'data',
            'external_url': 'https://prepza.onrender.com/',
            'icon': 'chart-bar',
            'is_free': True,
            'is_featured': True,
            'owner_name': 'Prepza Team',
            'verified': True,
            'moderation_status': 'approved',
            'last_reviewed_at': None,
        },
        {
            'name': 'Logiforge',
            'slug': 'logiforge',
            'description': 'DSA and discrete math logic builder for structured practice.',
            'category': 'education',
            'external_url': 'https://logiforge-frontend.onrender.com/',
            'icon': 'academic-cap',
            'is_free': True,
            'is_featured': True,
            'owner_name': 'Logiforge Team',
            'verified': True,
            'moderation_status': 'approved',
            'last_reviewed_at': None,
        },
        {
            'name': 'Vixora',
            'slug': 'vixora',
            'description': 'AI-powered creative tool for visual ideation and content workflows.',
            'category': 'creative',
            'external_url': 'https://vixora-frontend.onrender.com/',
            'icon': 'sparkles',
            'is_free': True,
            'is_featured': True,
            'owner_name': 'Vixora Team',
            'verified': True,
            'moderation_status': 'approved',
            'last_reviewed_at': None,
        },
        {
            'name': 'Slideo',
            'slug': 'slideo',
            'description': 'AI presentation assistant for creating polished slide decks quickly.',
            'category': 'productivity',
            'external_url': 'https://presentation-frontend-tkem.onrender.com/',
            'icon': 'document-text',
            'is_free': True,
            'is_featured': True,
            'owner_name': 'Slideo Team',
            'verified': True,
            'moderation_status': 'approved',
            'last_reviewed_at': None,
        },
    ]

    for index, tool in enumerate(initial_tools):
        MarketplaceTool.objects.update_or_create(
            slug=tool['slug'],
            defaults={
                **tool,
                'sort_order': index,
                'is_active': True,
            },
        )


def reverse_seed_initial_marketplace_tools(apps, schema_editor):
    MarketplaceTool = apps.get_model('tools', 'MarketplaceTool')
    MarketplaceTool.objects.filter(slug__in=['prepza', 'logiforge', 'vixora', 'slideo']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tools', '0012_tool_seo_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MarketplaceTool',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('slug', models.SlugField(max_length=200, unique=True)),
                ('description', models.TextField()),
                ('category', models.CharField(default='general', max_length=50)),
                ('external_url', models.URLField(max_length=500)),
                ('icon', models.CharField(default='sparkles', max_length=50)),
                ('is_free', models.BooleanField(default=True)),
                ('is_featured', models.BooleanField(default=False)),
                ('sort_order', models.IntegerField(default=0)),
                ('owner_name', models.CharField(blank=True, max_length=200)),
                ('owner_website', models.URLField(blank=True, max_length=500)),
                ('owner_email', models.EmailField(blank=True, max_length=254)),
                ('verified', models.BooleanField(default=False)),
                ('uptime_percentage', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('last_reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('moderation_status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('moderation_notes', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_marketplace_tools', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'marketplace_tools',
                'ordering': ['sort_order', '-is_featured', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='MarketplaceSubmission',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tool_name', models.CharField(max_length=200)),
                ('tool_url', models.URLField(max_length=500)),
                ('category', models.CharField(default='general', max_length=50)),
                ('description', models.TextField()),
                ('contact_email', models.EmailField(blank=True, max_length=254)),
                ('moderation_status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('moderation_notes', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_marketplace_submissions', to=settings.AUTH_USER_MODEL)),
                ('submitted_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='marketplace_submissions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'marketplace_submissions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='MarketplaceToolClick',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('source', models.CharField(blank=True, default='marketplace', max_length=100)),
                ('referrer_path', models.CharField(blank=True, max_length=255)),
                ('user_agent', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('tool', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='clicks', to='tools.marketplacetool')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='marketplace_clicks', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'marketplace_tool_clicks',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='marketplacetool',
            index=models.Index(fields=['slug'], name='marketplace_slug_08ef61_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacetool',
            index=models.Index(fields=['moderation_status', 'is_active'], name='marketplace_moderat_46fef6_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacetool',
            index=models.Index(fields=['category'], name='marketplace_categor_485ab6_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacetool',
            index=models.Index(fields=['is_featured'], name='marketplace_is_feat_730dcf_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacetool',
            index=models.Index(fields=['created_at'], name='marketplace_created_19c0e2_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacesubmission',
            index=models.Index(fields=['submitted_by', '-created_at'], name='marketplace_submitte_7a8aa0_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacesubmission',
            index=models.Index(fields=['moderation_status'], name='marketplace_moderat_b7054e_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacesubmission',
            index=models.Index(fields=['created_at'], name='marketplace_created_4e5f31_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacetoolclick',
            index=models.Index(fields=['tool', '-created_at'], name='marketplace_tool_id_39f7f5_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacetoolclick',
            index=models.Index(fields=['user', '-created_at'], name='marketplace_user_id_8150f6_idx'),
        ),
        migrations.AddIndex(
            model_name='marketplacetoolclick',
            index=models.Index(fields=['created_at'], name='marketplace_created_038f6e_idx'),
        ),
        migrations.RunPython(seed_initial_marketplace_tools, reverse_seed_initial_marketplace_tools),
    ]
