from django import forms
from django.contrib import admin

from apps.core.crypto import encrypt_secret
from .models import MikroTikRouter


class MikroTikRouterAdminForm(forms.ModelForm):
    password = forms.CharField(
        label='كلمة مرور API',
        widget=forms.PasswordInput(render_value=False),
        required=False,
    )

    class Meta:
        model = MikroTikRouter
        exclude = ('password_encrypted',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name in (
            'identity',
            'routeros_version',
            'model',
            'latency_ms',
            'cpu_load',
            'memory_free_mb',
            'uptime',
            'active_hotspot_users_count',
        ):
            if field_name in self.fields:
                self.fields[field_name].required = False

    def clean(self):
        cleaned_data = super().clean()
        if not self.instance.pk and not cleaned_data.get('password'):
            self.add_error('password', 'كلمة المرور مطلوبة عند إضافة روتر جديد.')
        return cleaned_data

    def save(self, commit=True):
        router = super().save(commit=False)
        password = self.cleaned_data.get('password')
        if password:
            router.password_encrypted = encrypt_secret(password).decode('utf-8')
        if commit:
            router.save()
            self.save_m2m()
        return router


@admin.register(MikroTikRouter)
class MikroTikRouterAdmin(admin.ModelAdmin):
    form = MikroTikRouterAdminForm
    list_display = (
        'name',
        'host',
        'port',
        'use_ssl',
        'is_active',
        'is_online',
        'latency_ms',
        'last_seen_at',
    )
    list_filter = ('is_active', 'is_online', 'use_ssl')
    search_fields = ('name', 'host', 'identity', 'model')
    readonly_fields = (
        'is_online',
        'last_seen_at',
        'latency_ms',
        'identity',
        'routeros_version',
        'model',
        'cpu_load',
        'memory_free_mb',
        'uptime',
        'active_hotspot_users_count',
        'created_at',
        'updated_at',
    )
    fieldsets = (
        ('إعدادات الاتصال', {
            'fields': ('name', 'tenant', 'host', 'port', 'use_ssl', 'username', 'password', 'is_active'),
        }),
        ('بيانات الجهاز والحالة', {
            'fields': (
                'identity',
                'routeros_version',
                'model',
                'is_online',
                'latency_ms',
                'cpu_load',
                'memory_free_mb',
                'uptime',
                'active_hotspot_users_count',
                'last_seen_at',
            ),
        }),
        ('التواريخ', {
            'fields': ('created_at', 'updated_at'),
        }),
    )
