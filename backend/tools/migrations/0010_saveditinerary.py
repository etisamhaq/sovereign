from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tools', '0009_saveddecisionmatrix'),
    ]

    operations = [
        migrations.CreateModel(
            name='SavedItinerary',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=500)),
                ('destination', models.CharField(blank=True, max_length=300)),
                ('itinerary_data', models.JSONField(default=dict, help_text='Full itinerary JSON data')),
                ('duration', models.CharField(blank=True, max_length=50)),
                ('budget', models.CharField(blank=True, max_length=100)),
                ('total_days', models.IntegerField(default=0)),
                ('is_favorite', models.BooleanField(default=False)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='saved_itineraries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'saved_itineraries',
                'ordering': ['-updated_at'],
                'indexes': [
                    models.Index(fields=['user', 'updated_at'], name='saved_itinera_user_id_8a3b2c_idx'),
                ],
            },
        ),
    ]
