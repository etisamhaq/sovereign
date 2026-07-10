from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tools', '0011_add_shared_result'),
    ]

    operations = [
        migrations.AddField(
            model_name='tool',
            name='meta_title',
            field=models.CharField(
                blank=True,
                default='',
                help_text='SEO title (max 70 chars). Leave blank to auto-generate.',
                max_length=70,
            ),
        ),
        migrations.AddField(
            model_name='tool',
            name='meta_description',
            field=models.TextField(
                blank=True,
                default='',
                help_text='SEO meta description (max 160 chars)',
                max_length=160,
            ),
        ),
        migrations.AddField(
            model_name='tool',
            name='keywords',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Comma-separated SEO keywords',
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name='tool',
            name='long_description',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Extended description for SEO landing pages (supports markdown)',
            ),
        ),
    ]
