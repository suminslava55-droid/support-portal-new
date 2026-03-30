from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from ..models import Client, KktData, ClientActivity, ClientNote, FaqArticle


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'results': [], 'total': 0})

        results = []

        clients_qs = Client.objects.filter(is_draft=False).filter(
            Q(address__icontains=q) | Q(phone__icontains=q) | Q(email__icontains=q) |
            Q(pharmacy_code__icontains=q) | Q(warehouse_code__icontains=q) |
            Q(iccid__icontains=q) | Q(personal_account__icontains=q) |
            Q(contract_number__icontains=q) | Q(personal_account2__icontains=q) |
            Q(contract_number2__icontains=q) | Q(ofd_company__name__icontains=q) |
            Q(ofd_company__inn__icontains=q) | Q(external_ip__icontains=q) |
            Q(subnet__icontains=q)
        ).select_related('ofd_company').distinct()[:20]

        for c in clients_qs:
            match_field = _match_field_client(c, q)
            results.append({
                'type': 'client', 'source': f'Клиент — {match_field}',
                'client_id': c.id,
                'client_name': c.address or c.company or f'Клиент #{c.id}',
                'company': c.company or '', 'snippet': match_field,
            })

        kkt_qs = KktData.objects.filter(
            Q(fn_number__icontains=q) | Q(serial_number__icontains=q) |
            Q(kkt_reg_id__icontains=q) | Q(kkt_model__icontains=q)
        ).select_related('client', 'client__ofd_company').filter(client__is_draft=False).distinct()[:20]

        for kkt in kkt_qs:
            match_field = _match_field_kkt(kkt, q)
            results.append({
                'type': 'kkt', 'source': f'ККТ — {match_field}',
                'client_id': kkt.client_id,
                'client_name': kkt.client.address or kkt.client.company or f'Клиент #{kkt.client_id}',
                'company': kkt.client.company or '', 'snippet': match_field,
            })

        activity_qs = ClientActivity.objects.filter(
            action__icontains=q, client__is_draft=False
        ).select_related('client', 'user').order_by('-created_at').distinct()[:20]

        for a in activity_qs:
            results.append({
                'type': 'activity', 'source': 'История изменений',
                'client_id': a.client_id,
                'client_name': a.client.address or a.client.company or f'Клиент #{a.client_id}',
                'company': a.client.company or '',
                'snippet': _truncate(a.action, q),
                'date': a.created_at.strftime('%d.%m.%Y %H:%M'),
                'user': a.user.full_name if a.user else '—',
            })

        notes_qs = ClientNote.objects.filter(
            text__icontains=q, client__is_draft=False
        ).select_related('client', 'author').order_by('-created_at').distinct()[:20]

        for note in notes_qs:
            results.append({
                'type': 'note', 'source': 'Заметка',
                'client_id': note.client_id,
                'client_name': note.client.address or note.client.company or f'Клиент #{note.client_id}',
                'company': note.client.company or '',
                'snippet': _truncate(note.text, q),
                'date': note.created_at.strftime('%d.%m.%Y %H:%M'),
                'user': note.author.full_name if note.author else '—',
            })

        # Поиск по базе знаний
        faq_qs = FaqArticle.objects.filter(
            Q(title__icontains=q) | Q(content__icontains=q)
        ).select_related('category', 'author').distinct()[:10]

        for article in faq_qs:
            if q.lower() in article.title.lower():
                snippet = article.title
            else:
                # Извлекаем текст из HTML для сниппета
                import re
                text = re.sub(r'<[^>]+>', ' ', article.content)
                text = re.sub(r'\s+', ' ', text).strip()
                snippet = _truncate(text, q)
            results.append({
                'type': 'faq',
                'source': f'База знаний — {article.category.name}',
                'article_id': article.id,
                'client_name': article.title,
                'company': article.category.name,
                'snippet': snippet,
                'date': article.updated_at.strftime('%d.%m.%Y %H:%M'),
                'user': article.author.full_name if article.author else '—',
            })

        return Response({'results': results, 'total': len(results), 'query': q})


def _match_field_client(client, q):
    q_lower = q.lower()
    checks = [
        ('address', 'Адрес'), ('phone', 'Телефон'), ('email', 'Email'),
        ('pharmacy_code', 'Код аптеки'), ('warehouse_code', 'Код склада'),
        ('iccid', 'ICCID'), ('personal_account', 'Лицевой счёт'),
        ('contract_number', '№ договора'), ('personal_account2', 'Лицевой счёт 2'),
        ('contract_number2', '№ договора 2'), ('external_ip', 'Внешний IP'),
        ('subnet', 'Подсеть'),
    ]
    for field, label in checks:
        val = getattr(client, field, '') or ''
        if q_lower in val.lower():
            return f'{label}: {val}'
    if client.ofd_company:
        if q_lower in (client.ofd_company.name or '').lower():
            return f'Компания: {client.ofd_company.name}'
        if q_lower in (client.ofd_company.inn or '').lower():
            return f'ИНН: {client.ofd_company.inn}'
    return 'совпадение в полях'


def _match_field_kkt(kkt, q):
    q_lower = q.lower()
    if kkt.fn_number and q_lower in kkt.fn_number.lower():
        return f'ФН: {kkt.fn_number}'
    if kkt.serial_number and q_lower in kkt.serial_number.lower():
        return f'Серийный номер: {kkt.serial_number}'
    if kkt.kkt_reg_id and q_lower in kkt.kkt_reg_id.lower():
        return f'РНМ: {kkt.kkt_reg_id}'
    if kkt.kkt_model and q_lower in kkt.kkt_model.lower():
        return f'Модель: {kkt.kkt_model}'
    return 'совпадение в полях ККТ'


def _truncate(text, q, context=80):
    idx = text.lower().find(q.lower())
    if idx == -1:
        return text[:context] + ('...' if len(text) > context else '')
    start = max(0, idx - 30)
    end = min(len(text), idx + len(q) + 50)
    snippet = text[start:end]
    if start > 0: snippet = '...' + snippet
    if end < len(text): snippet = snippet + '...'
    return snippet
