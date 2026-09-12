from django.apps import AppConfig

class MikrotikConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.integrations.mikrotik'
    verbose_name = 'MikroTik RouterOS Gateway'
