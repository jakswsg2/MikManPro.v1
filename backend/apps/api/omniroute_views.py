import logging

import requests
from rest_framework import permissions, status, views
from rest_framework.response import Response

from .omniroute_client import OmniRouteError, chat_completion

logger = logging.getLogger(__name__)


class OmniRouteChatView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        message = str(request.data.get('message', '')).strip()
        if not message:
            return Response(
                {'detail': 'message is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(message) > 12000:
            return Response(
                {'detail': 'message is too long'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        try:
            result = chat_completion(message, request.data.get('model'))
        except requests.Timeout:
            return Response(
                {'detail': 'OmniRoute request timed out'},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except (requests.RequestException, OmniRouteError) as exc:
            logger.warning('OmniRoute request failed: %s', exc)
            return Response(
                {'detail': 'AI gateway is unavailable'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(result, status=status.HTTP_200_OK)