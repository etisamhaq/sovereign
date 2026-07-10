# Generated migration for SavedDecisionMatrix model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tools", "0008_savedroadmap"),
    ]

    operations = [
        migrations.CreateModel(
            name="SavedDecisionMatrix",
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
                ("topic", models.TextField(blank=True)),
                (
                    "matrix_data",
                    models.JSONField(
                        default=dict,
                        help_text="Full decision matrix JSON data",
                    ),
                ),
                ("winner", models.CharField(blank=True, max_length=300)),
                ("options_count", models.IntegerField(default=0)),
                ("criteria_count", models.IntegerField(default=0)),
                ("is_favorite", models.BooleanField(default=False)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="saved_matrices",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "saved_decision_matrices",
                "ordering": ["-updated_at"],
                "indexes": [
                    models.Index(
                        fields=["user", "updated_at"],
                        name="saved_decis_user_id_updated_idx",
                    ),
                ],
            },
        ),
    ]
