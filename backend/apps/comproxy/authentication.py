import base64
import os

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class HubBasicAuthentication(BaseAuthentication):
    """
    HTTP Basic Auth для HUB-эндпоинтов AgentService.
    Проверяет credentials из переменных окружения.
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Basic '):
            raise AuthenticationFailed('Требуется Basic Auth')

        try:
            decoded = base64.b64decode(auth_header[6:]).decode('utf-8')
            username, password = decoded.split(':', 1)
        except Exception:
            raise AuthenticationFailed('Невалидный заголовок Authorization')

        expected_user = os.environ.get('COMPROXY_HUB_USER', '')
        expected_pass = os.environ.get('COMPROXY_HUB_PASSWORD', '')

        if not expected_user or not expected_pass:
            raise AuthenticationFailed('COMPROXY_HUB_USER/PASSWORD не заданы в .env')

        if username != expected_user or password != expected_pass:
            raise AuthenticationFailed('Неверные учётные данные')

        return (None, None)
