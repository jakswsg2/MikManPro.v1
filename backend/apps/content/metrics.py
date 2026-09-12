"""
Phase 16: Prometheus Search Metrics
Tracks query count, execution latency, zero result count, CTR, and cache hits.
"""
try:
    from prometheus_client import Counter, Histogram, Gauge

    SEARCH_REQUESTS_TOTAL = Counter(
        'smart_lounge_search_requests_total',
        'Total search requests executed',
        ['tenant', 'search_type', 'intent', 'language']
    )

    SEARCH_LATENCY_SECONDS = Histogram(
        'smart_lounge_search_latency_seconds',
        'Search query execution latency in seconds',
        ['tenant', 'search_type'],
        buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5]
    )

    SEARCH_ZERO_RESULTS_TOTAL = Counter(
        'smart_lounge_search_zero_results_total',
        'Total search requests returning zero results',
        ['tenant', 'language']
    )

    SEARCH_CLICKS_TOTAL = Counter(
        'smart_lounge_search_clicks_total',
        'Total clicks on search results',
        ['tenant']
    )

except ImportError:
    # Fallback mock metrics when prometheus_client is not installed
    class MockMetric:
        def labels(self, *args, **kwargs):
            return self
        def inc(self, *args, **kwargs):
            pass
        def observe(self, *args, **kwargs):
            pass
        def set(self, *args, **kwargs):
            pass

    SEARCH_REQUESTS_TOTAL = MockMetric()
    SEARCH_LATENCY_SECONDS = MockMetric()
    SEARCH_ZERO_RESULTS_TOTAL = MockMetric()
    SEARCH_CLICKS_TOTAL = MockMetric()
