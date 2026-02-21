from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import SystemSettings
from apps.accounts.permissions import IsAdmin


class SystemSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        s = SystemSettings.get()
        return Response({
            'ssh_user': s.ssh_user,
            'ssh_password': '••••••••' if s.ssh_password_encrypted else '',
            'has_ssh_password': bool(s.ssh_password_encrypted),
        })

    def post(self, request):
        s = SystemSettings.get()
        s.ssh_user = request.data.get('ssh_user', s.ssh_user)
        password = request.data.get('ssh_password', '')
        if password and password != '••••••••':
            s.set_ssh_password(password)
        s.save()
        return Response({
            'ssh_user': s.ssh_user,
            'ssh_password': '••••••••' if s.ssh_password_encrypted else '',
            'has_ssh_password': bool(s.ssh_password_encrypted),
        })
