# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0001_initial'),
    ]

    operations = [
        # Subscription model
        migrations.RenameField(
            model_name='subscription',
            old_name='stripe_subscription_id',
            new_name='polar_subscription_id',
        ),
        migrations.RenameField(
            model_name='subscription',
            old_name='stripe_customer_id',
            new_name='polar_customer_id',
        ),
        migrations.RenameField(
            model_name='subscription',
            old_name='stripe_price_id',
            new_name='polar_product_id',
        ),
        # migrations.RenameIndex(
        #     model_name='subscription',
        #     new_name='subscriptions_polar_sub_12a3b4_idx',
        #     old_name='subscriptions_stripe_sub_12a3b4_idx',
        # ),

        # Payment model
        migrations.RenameField(
            model_name='payment',
            old_name='stripe_payment_intent_id',
            new_name='polar_transaction_id',
        ),
        migrations.RenameField(
            model_name='payment',
            old_name='stripe_invoice_id',
            new_name='polar_checkout_id',
        ),
        # migrations.RenameIndex(
        #     model_name='payment',
        #     new_name='payments_polar_tra_56c7d8_idx',
        #     old_name='payments_stripe_pay_56c7d8_idx',
        # ),

        # Invoice model
        migrations.RenameField(
            model_name='invoice',
            old_name='stripe_invoice_id',
            new_name='polar_invoice_id',
        ),
        # migrations.RenameIndex(
        #     model_name='invoice',
        #     new_name='invoices_polar_inv_90e1f2_idx',
        #     old_name='invoices_stripe_inv_90e1f2_idx',
        # ),
    ]