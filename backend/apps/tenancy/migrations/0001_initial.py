import uuid
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Tenant',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('name', models.CharField(max_length=150, verbose_name='اسم المستأجر')),
                ('slug', models.SlugField(unique=True, verbose_name='المعرّف اللطيف')),
                ('is_active', models.BooleanField(default=True, verbose_name='نشط')),
            ],
            options={
                'verbose_name': 'مستأجر / جهة',
                'verbose_name_plural': 'المستأجرين',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Site',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')),
                ('name', models.CharField(max_length=150, verbose_name='اسم الموقع / الفرع')),
                ('code', models.CharField(max_length=50, unique=True, verbose_name='كود الموقع')),
                ('is_active', models.BooleanField(default=True, verbose_name='نشط')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sites', to='tenancy.tenant', verbose_name='المستأجر')),
            ],
            options={
                'verbose_name': 'موقع / فرع',
                'verbose_name_plural': 'المواقع والفروع',
                'ordering': ['-created_at'],
            },
        ),
    ]
