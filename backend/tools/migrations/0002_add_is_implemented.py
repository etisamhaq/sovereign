# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tools', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tool',
            name='is_implemented',
            field=models.BooleanField(default=True, help_text='Whether the tool has been implemented'),
        ),
    ]