from django.apps import AppConfig

class RadiusConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.integrations.radius'
    verbose_name = 'RADIUS AAA Gateway'
