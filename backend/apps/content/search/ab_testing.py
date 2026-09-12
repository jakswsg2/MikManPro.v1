"""
Phase 16: Search A/B Testing Service
Manages experiments, consistent hashing user cohort assignment, and KPI evaluation.
"""
import hashlib
from typing import Dict, Any, Optional
from apps.content.models import SearchABTest


class SearchABTestService:
    """
    Search A/B Testing experimentation framework.
    Uses MD5 consistent hashing to ensure a single user receives stable variant treatment across sessions.
    """

    def get_variant(self, test_id: str, user: Optional[Any]) -> str:
        """Determines experiment variant ('A' or 'B') using consistent hashing."""
        try:
            test = SearchABTest.objects.get(id=test_id)
        except SearchABTest.DoesNotExist:
            return 'A'

        if test.status != 'RUNNING':
            return 'A'

        user_identifier = str(getattr(user, 'id', 'anonymous_guest'))
        hash_input = f"{test_id}:{user_identifier}"
        hash_val = int(hashlib.md5(hash_input.encode('utf-8')).hexdigest(), 16) % 100

        if hash_val < test.traffic_split:
            return 'B'
        return 'A'

    def get_config(self, test_id: str, variant: str) -> Dict[str, Any]:
        """Returns the configuration parameters for the assigned variant."""
        try:
            test = SearchABTest.objects.get(id=test_id)
            if variant == 'B':
                return test.variant_b_config or {}
            return test.variant_a_config or {}
        except SearchABTest.DoesNotExist:
            return {}

    def record_metric(self, test_id: str, variant: str, metric: str, value: float):
        """Records KPI sample value for the designated variant."""
        try:
            test = SearchABTest.objects.get(id=test_id)
            results = test.results or {}

            if variant not in results:
                results[variant] = {}
            if metric not in results[variant]:
                results[variant][metric] = {'sum': 0.0, 'count': 0}

            results[variant][metric]['sum'] += float(value)
            results[variant][metric]['count'] += 1

            test.results = results
            test.save(update_fields=['results'])
        except SearchABTest.DoesNotExist:
            pass

    def get_results(self, test_id: str) -> Dict[str, Any]:
        """Calculates mean scores for variants and evaluates the winner."""
        test = SearchABTest.objects.get(id=test_id)
        results = test.results or {}

        summary: Dict[str, Any] = {}
        for variant in ['A', 'B']:
            if variant in results:
                summary[variant] = {}
                for metric, data in results[variant].items():
                    count = data.get('count', 0)
                    mean_val = (data.get('sum', 0.0) / count) if count > 0 else 0.0
                    summary[variant][metric] = {
                        'mean': round(mean_val, 4),
                        'sample_size': count,
                    }

        winner = None
        target = test.target_metric
        a_metrics = summary.get('A', {}).get(target, {})
        b_metrics = summary.get('B', {}).get(target, {})

        if a_metrics and b_metrics and a_metrics.get('sample_size', 0) >= 10:
            a_mean = a_metrics.get('mean', 0.0)
            b_mean = b_metrics.get('mean', 0.0)
            # Higher is better for CTR and CONVERSION; lower is better for LATENCY / ZERO_RESULTS
            if target in ['EXECUTION_TIME', 'ZERO_RESULTS_RATE']:
                winner = 'B' if b_mean < a_mean else 'A'
            else:
                winner = 'B' if b_mean > a_mean else 'A'

        return {
            'test_id': str(test.id),
            'test_name': test.name,
            'test_type': test.test_type,
            'status': test.status,
            'traffic_split': test.traffic_split,
            'target_metric': test.target_metric,
            'summary': summary,
            'winner': winner,
        }
