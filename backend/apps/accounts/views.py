from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, Role
from .serializers import UserSerializer, RoleSerializer, CustomTokenObtainPairSerializer
from .permissions import IsAdmin
from .rate_limit import is_blocked, record_failure, reset


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        # Проверяем не заблокирован ли IP
        blocked, retry_after = is_blocked(request)
        if blocked:
            return Response(
                {'detail': f'Слишком много попыток входа. Попробуйте через {retry_after // 60} мин.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={'Retry-After': str(retry_after)},
            )

        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            # Успешный вход — сбрасываем счётчик
            reset(request)
        else:
            # Неудачная попытка — записываем
            record_failure(request)

        return response


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response({'detail': 'Заполните все поля.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(old_password):
            return Response({'detail': 'Неверный текущий пароль.'}, status=status.HTTP_400_BAD_REQUEST)

        if user.check_password(new_password):
            return Response({'detail': 'Новый пароль не должен совпадать со старым.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'detail': 'Пароль должен содержать минимум 8 символов.'}, status=status.HTTP_400_BAD_REQUEST)

        if not any(c.isupper() for c in new_password):
            return Response({'detail': 'Пароль должен содержать хотя бы одну заглавную букву.'}, status=status.HTTP_400_BAD_REQUEST)

        if not any(c.isdigit() for c in new_password):
            return Response({'detail': 'Пароль должен содержать хотя бы одну цифру.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.must_change_password = False
        user.save()
        return Response({'detail': 'Пароль успешно изменён.'})


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('role').all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def for_calendar(self, request):
        """Список пользователей для календаря дежурств — доступен всем кроме Связиста."""
        users = User.objects.filter(is_active=True).exclude(role__name='communications').exclude(email='scheduler@system.local').order_by('last_name', 'first_name')
        data = [{'id': u.id, 'full_name': u.full_name or u.email, 'birthday': u.birthday.strftime('%m-%d') if u.birthday else None} for u in users]
        return Response(data)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
