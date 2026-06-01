from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from ..models import Client, KktData, ClientActivity, ClientNote, FaqArticle
from .search_utils import fuzzy_filter_clients


def _convert_layout(s):
    """Конвертация латиницы (неверная раскладка) в кириллицу."""
    EN_TO_RU = {
        'q':'й','w':'ц','e':'у','r':'к','t':'е','y':'н','u':'г','i':'ш','o':'щ','p':'з',
        '[':'х',']':'ъ','a':'ф','s':'ы','d':'в','f':'а','g':'п','h':'р','j':'о','k':'л',
        'l':'д',';':'ж',"'":'э','z':'я','x':'ч','c':'с','v':'м','b':'и','n':'т','m':'ь',
        ',':'б','.':'ю','Q':'Й','W':'Ц','E':'У','R':'К','T':'Е','Y':'Н','U':'Г','I':'Ш',
        'O':'Щ','P':'З','{':'Х','}':'Ъ','A':'Ф','S':'Ы','D':'В','F':'А','G':'П','H':'Р',
        'J':'О','K':'Л','L':'Д',':':'Ж','"':'Э','Z':'Я','X':'Ч','C':'С','V':'М','B':'И',
        'N':'Т','M':'Ь','<':'Б','>':'Ю',
    }
    latin = sum(1 for ch in s if ch in EN_TO_RU)
    if latin > len(s) * 0.4 and latin > 0:
        return ''.join(EN_TO_RU.get(ch, ch) for ch in s)
    return s


def _get_search_term(q):
    """Возвращает поисковый термин с учётом раскладки."""
    converted = _convert_layout(q)
    return converted if converted != q else q


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'results': [], 'total': 0})

        # Конвертируем раскладку если нужно
        search_term = _get_search_term(q)

        results = []

        # Fuzzy поиск клиентов
        base_qs = Client.objects.filter(is_draft=False).select_related('ofd_company')
        clients_qs = fuzzy_filter_clients(base_qs, search_term)[:20]

        for c in clients_qs:
            match_field = _match_field_client(c, search_term)
            results.append({
                'type': 'client', 'source': f'Клиент — {match_field}',
                'client_id': c.id,
                'client_name': c.address or f'Клиент #{c.id}',
                'company': '', 'snippet': match_field,
            })

        kkt_qs = KktData.objects.filter(
            Q(fn_number__icontains=search_term) | Q(serial_number__icontains=search_term) |
            Q(kkt_reg_id__icontains=search_term) | Q(kkt_model__icontains=search_term)
        ).select_related('client', 'client__ofd_company').filter(client__is_draft=False).distinct()[:20]

        for kkt in kkt_qs:
            match_field = _match_field_kkt(kkt, search_term)
            results.append({
                'type': 'kkt', 'source': f'ККТ — {match_field}',
                'client_id': kkt.client_id,
                'client_name': kkt.client.address or f'Клиент #{kkt.client_id}',
                'company': '', 'snippet': match_field,
            })

        activity_qs = ClientActivity.objects.filter(
            action__icontains=search_term, client__is_draft=False
        ).select_related('client', 'user').order_by('-created_at').distinct()[:20]

        for a in activity_qs:
            results.append({
                'type': 'activity', 'source': 'История изменений',
                'client_id': a.client_id,
                'client_name': a.client.address or f'Клиент #{a.client_id}',
                'company': '',
                'snippet': _truncate(a.action, search_term),
                'date': a.created_at.strftime('%d.%m.%Y %H:%M'),
                'user': a.user.full_name if a.user else '—',
            })

        notes_qs = ClientNote.objects.filter(
            text__icontains=search_term, client__is_draft=False
        ).select_related('client', 'author').order_by('-created_at').distinct()[:20]

        for note in notes_qs:
            results.append({
                'type': 'note', 'source': 'Заметка',
                'client_id': note.client_id,
                'client_name': note.client.address or f'Клиент #{note.client_id}',
                'company': '',
                'snippet': _truncate(note.text, search_term),
                'date': note.created_at.strftime('%d.%m.%Y %H:%M'),
                'user': note.author.full_name if note.author else '—',
            })

        faq_qs = FaqArticle.objects.filter(
            Q(title__icontains=search_term) | Q(content__icontains=search_term)
        ).select_related('category', 'author').distinct()[:10]

        for article in faq_qs:
            if search_term.lower() in article.title.lower():
                snippet = article.title
            else:
                import re
                text = re.sub(r'<[^>]+>', ' ', article.content)
                text = re.sub(r'\s+', ' ', text).strip()
                snippet = _truncate(text, search_term)
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
