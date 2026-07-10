# Generated migration for SavedRoadmap model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tools", "0007_tool_external_url_delete_videochat"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedRoadmap",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("title", models.CharField(max_length=500)),
                ("goal", models.TextField(blank=True)),
                ("skill_level", models.CharField(blank=True, max_length=20)),
                (
                    "roadmap_data",
                    models.JSONField(
                        default=dict,
                        help_text="Full roadmap JSON data",
                    ),
                ),
                ("total_phases", models.IntegerField(default=0)),
                ("completed_phases", models.IntegerField(default=0)),
                (
                    "phase_progress",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Per-phase completion status",
                    ),
                ),
                ("is_favorite", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="saved_roadmaps",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "saved_roadmaps",
                "ordering": ["-updated_at"],
                "indexes": [
                    models.Index(
                        fields=["user", "updated_at"],
                        name="saved_roadm_user_id_updated_idx",
                    ),
                ],
            },
        ),
    ]
