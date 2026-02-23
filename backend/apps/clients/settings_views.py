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
            'has_ssh_password': bool(s.ssh_password_encrypted),
            'smtp_host': s.smtp_host,
            'smtp_port': s.smtp_port,
            'smtp_user': s.smtp_user,
            'smtp_from_email': s.smtp_from_email,
            'smtp_from_name': s.smtp_from_name,
            'smtp_use_ssl': s.smtp_use_ssl,
            'smtp_use_tls': s.smtp_use_tls,
            'has_smtp_password': bool(s.smtp_password_encrypted),
        })

    def delete(self, request):
        section = request.query_params.get('section', 'ssh')
        s = SystemSettings.get()
        if section == 'smtp':
            s.smtp_host = ''
            s.smtp_port = 465
            s.smtp_user = ''
            s.smtp_password_encrypted = ''
            s.smtp_from_email = ''
            s.smtp_from_name = ''
            s.smtp_use_ssl = True
            s.smtp_use_tls = False
            s.save()
            return Response({'message': 'SMTP данные очищены'})
        else:
            s.ssh_user = ''
            s.ssh_password_encrypted = ''
            s.save()
            return Response({'message': 'SSH данные очищены'})

    def post(self, request):
        s = SystemSettings.get()
        section = request.data.get('section', 'ssh')

        if section == 'smtp':
            s.smtp_host = request.data.get('smtp_host', s.smtp_host)
            s.smtp_port = int(request.data.get('smtp_port', s.smtp_port) or 465)
            s.smtp_user = request.data.get('smtp_user', s.smtp_user)
            s.smtp_from_email = request.data.get('smtp_from_email', s.smtp_from_email)
            s.smtp_from_name = request.data.get('smtp_from_name', s.smtp_from_name)
            s.smtp_use_ssl = request.data.get('smtp_use_ssl', s.smtp_use_ssl)
            s.smtp_use_tls = request.data.get('smtp_use_tls', s.smtp_use_tls)
            smtp_password = request.data.get('smtp_password', '')
            if smtp_password and smtp_password != '••••••••':
                s.set_smtp_password(smtp_password)
            s.save()
            return Response({
                'smtp_host': s.smtp_host,
                'smtp_port': s.smtp_port,
                'smtp_user': s.smtp_user,
                'smtp_from_email': s.smtp_from_email,
                'smtp_from_name': s.smtp_from_name,
                'smtp_use_ssl': s.smtp_use_ssl,
                'smtp_use_tls': s.smtp_use_tls,
                'has_smtp_password': bool(s.smtp_password_encrypted),
            })
        else:
            s.ssh_user = request.data.get('ssh_user', s.ssh_user)
            password = request.data.get('ssh_password', '')
            if password and password != '••••••••':
                s.set_ssh_password(password)
            s.save()
            return Response({
                'ssh_user': s.ssh_user,
                'has_ssh_password': bool(s.ssh_password_encrypted),
            })


class TestEmailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        import smtplib
        import ssl
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        s = SystemSettings.get()
        to_email = request.data.get('to_email', '').strip()

        if not to_email:
            return Response({'error': 'Укажите email для тестовой отправки'}, status=400)
        if not s.smtp_host:
            return Response({'error': 'SMTP сервер не задан'}, status=400)
        if not s.smtp_user:
            return Response({'error': 'SMTP пользователь не задан'}, status=400)
        if not s.smtp_password_encrypted:
            return Response({'error': 'SMTP пароль не задан'}, status=400)
        if not s.smtp_from_email:
            return Response({'error': 'Email отправителя не задан'}, status=400)

        try:
            from_addr = (
                f'{s.smtp_from_name} <{s.smtp_from_email}>'
                if s.smtp_from_name else s.smtp_from_email
            )

            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'Тестовое письмо — Support Portal'
            msg['From'] = from_addr
            msg['To'] = to_email

            html = """
            <html><body style="font-family: Arial, sans-serif; padding: 20px;">
              <h2 style="color: #1677ff;">Тестовое письмо</h2>
              <p>Это тестовое письмо из <strong>Support Portal</strong>.</p>
              <p>Если вы получили это сообщение — настройки SMTP работают корректно.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">Support Portal</p>
            </body></html>
            """
            msg.attach(MIMEText(html, 'html', 'utf-8'))

            if s.smtp_use_ssl:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, context=context, timeout=10) as server:
                    server.login(s.smtp_user, s.smtp_password)
                    server.sendmail(s.smtp_from_email, to_email, msg.as_string())
            elif s.smtp_use_tls:
                with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    server.login(s.smtp_user, s.smtp_password)
                    server.sendmail(s.smtp_from_email, to_email, msg.as_string())
            else:
                with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as server:
                    server.login(s.smtp_user, s.smtp_password)
                    server.sendmail(s.smtp_from_email, to_email, msg.as_string())

            return Response({'success': True, 'message': f'Письмо отправлено на {to_email}'})

        except smtplib.SMTPAuthenticationError:
            return Response({'error': 'Ошибка аутентификации — проверьте логин и пароль'}, status=400)
        except smtplib.SMTPConnectError:
            return Response({'error': f'Не удалось подключиться к {s.smtp_host}:{s.smtp_port}'}, status=400)
        except Exception as e:
            return Response({'error': f'Ошибка отправки: {str(e)}'}, status=400)
