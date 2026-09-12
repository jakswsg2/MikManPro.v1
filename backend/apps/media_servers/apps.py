from django.apps import AppConfig

class MediaServersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.media_servers'
    verbose_name = 'Local Media Servers Integration'

    def ready(self):
        try:
            import apps.media_servers.signals
        except ImportError:
            pass
