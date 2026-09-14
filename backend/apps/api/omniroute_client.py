import time

import requests
from django.conf import settings


class OmniRouteError(Exception):
    """Raised when the AI gateway cannot produce a response."""


def chat_completion(message: str, model: str | None = None) -> dict:
    if not settings.OMNIROUTE_API_KEY:
        raise OmniRouteError('OmniRoute API key is not configured')

    started_at = time.perf_counter()
    response = requests.post(
        f'{settings.OMNIROUTE_BASE_URL.rstrip("/")}/chat/completions',
        headers={
            'Authorization': f'Bearer {settings.OMNIROUTE_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'model': model or settings.OMNIROUTE_MODEL,
            'messages': [
                {
                    'role': 'system',
                    'content': (
                        'أنت مساعد Smart Lounge. أجب بالعربية باختصار ودقة. '
                        'لا تدّع تنفيذ إجراء على الشبكة أو خادم الوسائط ما لم يقدمه النظام فعلياً.'
                    ),
                },
                {'role': 'user', 'content': message},
            ],
            'stream': False,
        },
        timeout=settings.OMNIROUTE_TIMEOUT_SECONDS,
    )

    if not response.ok:
        raise OmniRouteError(f'OmniRoute returned HTTP {response.status_code}')

    try:
        payload = response.json()
        content = payload['choices'][0]['message']['content']
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise OmniRouteError('OmniRoute returned an invalid completion') from exc

    if isinstance(content, list):
        content = ''.join(
            part.get('text', '') for part in content if isinstance(part, dict)
        )

    return {
        'reply': str(content),
        'model': payload.get('model', model or settings.OMNIROUTE_MODEL),
        'latency_ms': round((time.perf_counter() - started_at) * 1000),
        'decision': response.headers.get('X-OmniRoute-Decision', ''),
        'usage': payload.get('usage', {}),
    }