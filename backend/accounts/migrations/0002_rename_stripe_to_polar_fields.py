# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        # Remove the old index before renaming the field (avoids SQLite RenameIndex issue)
        migrations.RemoveIndex(
            model_name='user',
            name='users_stripe__0fdd23_idx',
        ),
        migrations.RenameField(
            model_name='user',
            old_name='stripe_customer_id',
            new_name='polar_customer_id',
        ),
        migrations.RenameField(
            model_name='user',
            old_name='stripe_subscription_id',
            new_name='polar_subscription_id',
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(
                fields=['polar_customer_id'], name='users_polar_c_0fdd23_idx'
            ),
        ),
    ]