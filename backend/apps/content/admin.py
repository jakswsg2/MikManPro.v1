"""
Phase 16: Django Admin Interface for Content & Search Models
"""
from django.contrib import admin
from apps.content.models import (
    MediaItem, MediaSource, Library, LogicalContentGroup,
    SearchQuery, SearchSuggestion, SearchSynonym,
    SearchRankingConfig, SavedSearch, SearchABTest
)


@admin.register(SearchQuery)
class SearchQueryAdmin(admin.ModelAdmin):
    list_display = ('query_text', 'tenant', 'user', 'query_intent', 'query_language', 'results_count', 'execution_time_ms', 'created_at')
    list_filter = ('tenant', 'query_intent', 'query_language', 'search_type', 'created_at')
    search_fields = ('query_text', 'query_normalized', 'user__username', 'session_id')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(SearchSuggestion)
class SearchSuggestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'tenant', 'suggestion_type', 'priority', 'is_active', 'valid_from', 'valid_until')
    list_filter = ('tenant', 'suggestion_type', 'is_active')
    search_fields = ('text',)
    ordering = ('priority', '-created_at')


@admin.register(SearchSynonym)
class SearchSynonymAdmin(admin.ModelAdmin):
    list_display = ('term', 'tenant', 'language', 'synonyms', 'is_active')
    list_filter = ('tenant', 'language', 'is_active')
    search_fields = ('term', 'synonyms')


@admin.register(SearchRankingConfig)
class SearchRankingConfigAdmin(admin.ModelAdmin):
    list_display = ('config_key', 'tenant', 'is_active', 'updated_at')
    list_filter = ('tenant', 'is_active')


@admin.register(SavedSearch)
class SavedSearchAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'tenant', 'query', 'notification_enabled', 'notification_frequency', 'last_notified_at')
    list_filter = ('tenant', 'notification_enabled', 'notification_frequency')
    search_fields = ('name', 'query', 'user__username')


@admin.register(SearchABTest)
class SearchABTestAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'test_type', 'status', 'traffic_split', 'target_metric', 'started_at')
    list_filter = ('tenant', 'test_type', 'status', 'target_metric')
    search_fields = ('name', 'description')
