import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ServiceRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('service_type', models.CharField(choices=[('automation', 'AI Automation Setup'), ('agents', 'Custom AI Agents'), ('optimization', 'Workflow Optimization')], max_length=20)),
                ('package_tier', models.CharField(choices=[('starter', 'Starter'), ('growth', 'Growth'), ('pro', 'Pro')], max_length=10)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('paid', 'Paid'), ('in_progress', 'In Progress'), ('completed', 'Completed'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('payment_status', models.CharField(choices=[('unpaid', 'Unpaid'), ('paid', 'Paid'), ('refunded', 'Refunded')], default='unpaid', max_length=10)),
                ('name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254)),
                ('business_type', models.CharField(max_length=255)),
                ('requirements', models.TextField()),
                ('tools_used', models.TextField(blank=True, default='')),
                ('budget', models.CharField(choices=[('under_500', 'Under $500'), ('500_1000', '$500 - $1,000'), ('1000_2500', '$1,000 - $2,500'), ('2500_5000', '$2,500 - $5,000'), ('5000_plus', '$5,000+')], max_length=20)),
                ('timeline', models.CharField(choices=[('asap', 'ASAP (1-2 weeks)'), ('standard', 'Standard (2-4 weeks)'), ('flexible', 'Flexible (1-2 months)'), ('no_rush', 'No Rush (3+ months)')], max_length=20)),
                ('amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('polar_checkout_id', models.CharField(blank=True, max_length=255, null=True)),
                ('polar_transaction_id', models.CharField(blank=True, max_length=255, null=True)),
                ('ai_summary', models.TextField(blank=True, null=True)),
                ('ai_suggested_solution', models.TextField(blank=True, null=True)),
                ('admin_notes', models.TextField(blank=True, default='')),
                ('delivered_url', models.URLField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='service_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'service_requests',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['status'], name='service_req_status_idx'),
                    models.Index(fields=['service_type'], name='service_req_stype_idx'),
                    models.Index(fields=['payment_status'], name='service_req_pstatus_idx'),
                    models.Index(fields=['user', 'created_at'], name='service_req_user_date_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='BookCallRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254)),
                ('service_type', models.CharField(blank=True, choices=[('automation', 'AI Automation Setup'), ('agents', 'Custom AI Agents'), ('optimization', 'Workflow Optimization')], default='', max_length=20)),
                ('message', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'book_call_requests',
                'ordering': ['-created_at'],
            },
        ),
    ]
