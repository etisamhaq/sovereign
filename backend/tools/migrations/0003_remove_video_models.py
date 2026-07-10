# Migration to remove Video-related models
# Note: The actual table drop is handled by 0004_delete_videochat via DeleteModel.
# This migration is kept as a no-op to preserve the dependency chain.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('tools', '0002_add_video_chat'),
        ('tools', '0002_add_is_implemented'),
    ]

    operations = [
        # No-op: table deletion handled by 0004_delete_videochat
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]