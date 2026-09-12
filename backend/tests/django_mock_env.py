"""
Django Environment Mocking Bootstrap for Pure Unit Tests.
Allows importing models and testing service logic in environments without full Django/PostgreSQL runtime.
"""
import sys
import types
import base64
from unittest.mock import MagicMock

def bootstrap_django_env():
    if 'jwt' not in sys.modules:
        sys.modules['jwt'] = MagicMock()

    if 'cryptography' not in sys.modules:
        crypto_pkg = types.ModuleType('cryptography')
        crypto_pkg.__path__ = []
        sys.modules['cryptography'] = crypto_pkg

        fernet_mod = types.ModuleType('cryptography.fernet')

        class MockFernet:
            def __init__(self, key):
                self.key = key
            def encrypt(self, data: bytes) -> bytes:
                return b"gAAAAA" + base64.b64encode(data)
            def decrypt(self, token: bytes) -> bytes:
                if token.startswith(b"gAAAAA"):
                    token = token[6:]
                return base64.b64decode(token)

        fernet_mod.Fernet = MockFernet
        sys.modules['cryptography.fernet'] = fernet_mod
        crypto_pkg.fernet = fernet_mod

    if 'requests' not in sys.modules:
        sys.modules['requests'] = MagicMock()

    if 'django' not in sys.modules:
        django_pkg = types.ModuleType('django')
        django_pkg.__path__ = []
        sys.modules['django'] = django_pkg

        # Set submodules as attributes
        sys.modules['django'].apps = MagicMock()
        sys.modules['django.apps'] = sys.modules['django'].apps
        sys.modules['django.apps'].AppConfig = type('AppConfig', (object,), {})

        http_mock = types.ModuleType('django.http')
        http_mock.HttpResponse = type('HttpResponse', (object,), {
            '__init__': lambda self, content='', *args, **kwargs: setattr(self, 'content', content)
        })
        http_mock.JsonResponse = type('JsonResponse', (http_mock.HttpResponse,), {})
        sys.modules['django.http'] = http_mock
        django_pkg.http = http_mock

        sys.modules['django'].db = MagicMock()
        sys.modules['django.db'] = sys.modules['django'].db
        sys.modules['django.db'].transaction = MagicMock()

        class MockField:
            def __init__(self, *args, **kwargs):
                self.default = kwargs.get('default', None)

        class MockModelsModule(types.ModuleType):
            def __getattr__(self, name):
                if name.endswith('Field') or name in ('ForeignKey', 'ManyToManyField', 'OneToOneField'):
                    return MockField
                return MagicMock()

        models_pkg = MockModelsModule('django.db.models')
        models_pkg.__path__ = []
        sys.modules['django.db.models'] = models_pkg
        sys.modules['django.db'].models = models_pkg

        models_fn = types.ModuleType('django.db.models.functions')
        models_fn.Coalesce = MagicMock()
        sys.modules['django.db.models.functions'] = models_fn
        models_pkg.functions = models_fn

        class FakeTextChoices:
            @classmethod
            def __init_subclass__(cls, **kwargs):
                cls.choices = []
                for k, v in list(cls.__dict__.items()):
                    if not k.startswith('_'):
                        if isinstance(v, tuple) and len(v) == 2:
                            val, label = v
                            setattr(cls, k, val)
                            cls.choices.append((val, label))
                        elif isinstance(v, str):
                            cls.choices.append((v, v))
                super().__init_subclass__(**kwargs)

        class FakeModel:
            objects = MagicMock()
            objects.filter.return_value = MagicMock()
            objects.filter.return_value.count.return_value = 0
            objects.filter.return_value.first.return_value = None
            objects.create.return_value = MagicMock()
            objects.get_or_create.return_value = (MagicMock(), True)
            objects.update_or_create.return_value = (MagicMock(), True)

            def __init__(self, *args, **kwargs):
                for k, v in self.__class__.__dict__.items():
                    if not k.startswith('_') and isinstance(v, MockField):
                        d = v.default
                        if d is not None:
                            setattr(self, k, d() if callable(d) else d)
                        else:
                            setattr(self, k, None)
                for k, v in kwargs.items():
                    setattr(self, k, v)
                super().__init__()

            def save(self, *args, **kwargs):
                pass

            def __getattr__(self, name):
                if name.startswith('get_') and name.endswith('_display'):
                    field_name = name[4:-8]
                    val = getattr(self, field_name, '')
                    return lambda: str(val)
                raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{name}'")

        sys.modules['django.db.models'].TextChoices = FakeTextChoices
        sys.modules['django.db.models'].Model = FakeModel

        sys.modules['django'].utils = MagicMock()
        sys.modules['django.utils'] = sys.modules['django'].utils
        sys.modules['django.utils'].timezone = MagicMock()

        sys.modules['django'].core = MagicMock()
        sys.modules['django.core'] = sys.modules['django'].core
        sys.modules['django.core'].cache = MagicMock()
        sys.modules['django.core.cache'] = sys.modules['django.core'].cache
        sys.modules['django.core.validators'] = MagicMock()
        sys.modules['django.core.validators'] = sys.modules['django.core'].validators
        sys.modules['django.core.exceptions'] = MagicMock()
        sys.modules['django.core.exceptions'] = sys.modules['django.core.exceptions']
        sys.modules['django.core.exceptions'].ValidationError = Exception

        sys.modules['django'].conf = MagicMock()
        sys.modules['django.conf'] = sys.modules['django'].conf
        sys.modules['django.conf'].settings = MagicMock()

        sys.modules['django'].shortcuts = MagicMock()
        sys.modules['django.shortcuts'] = sys.modules['django'].shortcuts

        sys.modules['django'].urls = MagicMock()
        sys.modules['django.urls'] = sys.modules['django'].urls
        sys.modules['django.urls'].path = lambda *args, **kwargs: MagicMock()
        sys.modules['django.urls'].include = lambda *args, **kwargs: MagicMock()

        contrib_pkg = types.ModuleType('django.contrib')
        contrib_pkg.__path__ = []
        sys.modules['django.contrib'] = contrib_pkg
        sys.modules['django'].contrib = contrib_pkg

        auth_pkg = MagicMock()
        sys.modules['django.contrib.auth'] = auth_pkg
        contrib_pkg.auth = auth_pkg
        sys.modules['django.contrib.auth.models'] = auth_pkg.models
        auth_pkg.models.AbstractBaseUser = type('AbstractBaseUser', (object,), {})
        auth_pkg.models.PermissionsMixin = type('PermissionsMixin', (object,), {})
        auth_pkg.models.BaseUserManager = type('BaseUserManager', (object,), {})

        pg_pkg = types.ModuleType('django.contrib.postgres')
        pg_pkg.__path__ = []
        sys.modules['django.contrib.postgres'] = pg_pkg
        contrib_pkg.postgres = pg_pkg

        pg_indexes = MagicMock()
        sys.modules['django.contrib.postgres.indexes'] = pg_indexes
        pg_pkg.indexes = pg_indexes

        pg_fields = MagicMock()
        sys.modules['django.contrib.postgres.fields'] = pg_fields
        pg_pkg.fields = pg_fields

        class BaseMockView:
            @classmethod
            def as_view(cls, **kwargs):
                return MagicMock()

        class BaseMockModelSerializer:
            def __init__(self, *args, **kwargs):
                self.data = {}
            def is_valid(self, *args, **kwargs):
                return True
            def save(self, *args, **kwargs):
                return MagicMock()

        rf_pkg = types.ModuleType('rest_framework')
        rf_pkg.__path__ = []
        sys.modules['rest_framework'] = rf_pkg

        routers_mock = MagicMock()
        routers_mock.DefaultRouter = MagicMock
        sys.modules['rest_framework.routers'] = routers_mock
        rf_pkg.routers = routers_mock

        jwt_views_mock = MagicMock()
        sys.modules['rest_framework_simplejwt'] = MagicMock()
        sys.modules['rest_framework_simplejwt.views'] = jwt_views_mock

        views_mock = MagicMock()
        views_mock.APIView = BaseMockView
        sys.modules['rest_framework.views'] = views_mock
        rf_pkg.views = views_mock

        viewsets_mock = MagicMock()
        viewsets_mock.ModelViewSet = BaseMockView
        sys.modules['rest_framework.viewsets'] = viewsets_mock
        rf_pkg.viewsets = viewsets_mock

        sys.modules['rest_framework.response'] = MagicMock()
        rf_pkg.response = sys.modules['rest_framework.response']

        sys.modules['rest_framework.permissions'] = MagicMock()
        rf_pkg.permissions = sys.modules['rest_framework.permissions']

        serializers_mock = MagicMock()
        serializers_mock.ModelSerializer = BaseMockModelSerializer
        serializers_mock.Serializer = BaseMockModelSerializer
        sys.modules['rest_framework.serializers'] = serializers_mock
        rf_pkg.serializers = serializers_mock

        sys.modules['rest_framework.decorators'] = MagicMock()
        rf_pkg.decorators = sys.modules['rest_framework.decorators']

        sys.modules['rest_framework.status'] = MagicMock()
        rf_pkg.status = sys.modules['rest_framework.status']
