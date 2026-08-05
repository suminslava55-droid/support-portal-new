import json
import threading

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdmin
from apps.clients.models import Client
from .models import PcJob, PcJobTarget
from .serializers import PcJobListSerializer, PcJobDetailSerializer
from . import executor


def _chain_jobs(job):
    """Все прогоны одной цепочки (корень + все повторы), по времени создания."""
    root = job
    seen = set()
    while root.repeat_of_id and root.repeat_of_id not in seen:
        seen.add(root.id)
        root = root.repeat_of
    out, stack, visited = [], [root], set()
    while stack:
        j = stack.pop()
        if j.id in visited:
            continue
        visited.add(j.id)
        out.append(j)
        stack.extend(list(j.repeats.all()))
    out.sort(key=lambda x: x.created_at)
    return out


class PcClientsView(APIView):
    """Лёгкий список клиентов для выбора целей (адрес, компания, IP сервера)."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = (Client.objects.filter(is_draft=False)
              .select_related('ofd_company')
              .order_by('address'))
        company = request.query_params.get('company')
        if company:
            qs = qs.filter(ofd_company_id=company)
        search = (request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(address__icontains=search)
        data = [{
            'id': c.id,
            'address': c.address or '',
            'company': c.ofd_company.name if c.ofd_company else '',
            'company_id': c.ofd_company_id,
            'server_ip': c.server_ip,
            'subnet': c.subnet or '',
            'has_subnet': bool(c.subnet),
        } for c in qs]
        return Response(data)


class PcJobListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = PcJob.objects.select_related('created_by').all()[:200]
        return Response(PcJobListSerializer(qs, many=True).data)

    def post(self, request):
        d = request.data
        job_type = d.get('job_type')
        if job_type not in (PcJob.TYPE_COPY, PcJob.TYPE_SCRIPT):
            return Response({'error': 'Неверный тип задания'}, status=400)

        target_mode = d.get('target_mode', PcJob.MODE_SERVER)
        if target_mode not in (PcJob.MODE_SERVER, PcJob.MODE_KASSA, PcJob.MODE_BOTH):
            return Response({'error': 'Неверный режим цели'}, status=400)

        raw_ids = d.get('client_ids')
        if isinstance(raw_ids, str):
            try:
                raw_ids = json.loads(raw_ids)
            except Exception:
                raw_ids = [x for x in raw_ids.split(',') if x.strip()]
        try:
            client_ids = [int(x) for x in (raw_ids or [])]
        except Exception:
            client_ids = []
        if not client_ids:
            return Response({'error': 'Не выбрано ни одного клиента'}, status=400)

        name = (d.get('name') or '').strip()[:200]
        job = PcJob(name=name, job_type=job_type, target_mode=target_mode, client_ids=client_ids,
                    created_by=request.user)

        if job_type == PcJob.TYPE_SCRIPT:
            script_text = (d.get('script_text') or '').strip()
            kind = d.get('script_kind', PcJob.KIND_PS)
            if not script_text:
                return Response({'error': 'Пустой текст скрипта'}, status=400)
            if kind not in (PcJob.KIND_PS, PcJob.KIND_CMD):
                return Response({'error': 'Неверный вид скрипта'}, status=400)
            job.script_text = script_text
            job.script_kind = kind
        pending_file = None
        if job_type == PcJob.TYPE_COPY:
            f = request.FILES.get('file')
            if not f:
                return Response({'error': 'Файл не загружен'}, status=400)
            dest_path = (d.get('dest_path') or '').strip()
            if not dest_path:
                return Response({'error': 'Не указан путь назначения'}, status=400)
            job.dest_path = dest_path
            pending_file = f

        job.save()
        if pending_file is not None:
            # сохраняем файл после получения pk, чтобы попасть в pc_jobs/<id>/<имя>
            job.file.save(pending_file.name, pending_file, save=True)

        t = threading.Thread(target=executor.run_job, args=(job.id,), daemon=True)
        t.start()

        return Response(PcJobDetailSerializer(job).data, status=201)


class PcJobDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, pk):
        try:
            job = PcJob.objects.prefetch_related('targets').get(pk=pk)
        except PcJob.DoesNotExist:
            return Response({'error': 'Задание не найдено'}, status=404)
        data = PcJobDetailSerializer(job).data
        chain = _chain_jobs(job)
        data['runs'] = PcJobDetailSerializer(chain, many=True).data
        data['current_run_id'] = job.id
        return Response(data)


class PcJobCancelView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            job = PcJob.objects.get(pk=pk)
        except PcJob.DoesNotExist:
            return Response({'error': 'Задание не найдено'}, status=404)
        if job.status in (PcJob.STATUS_PENDING, PcJob.STATUS_RUNNING):
            job.cancel_requested = True
            job.save(update_fields=['cancel_requested'])
        return Response({'message': 'Запрошена отмена'})


class PcJobRepeatView(APIView):
    """Повторный запуск задания с теми же параметрами."""
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            src = PcJob.objects.get(pk=pk)
        except PcJob.DoesNotExist:
            return Response({'error': 'Задание не найдено'}, status=404)

        # Повтор всегда отталкивается от последнего прогона цепочки,
        # чтобы учесть успехи всех предыдущих прогонов.
        latest = _chain_jobs(src)[-1]

        job = PcJob.objects.create(
            name=latest.name,
            job_type=latest.job_type,
            script_kind=latest.script_kind,
            script_text=latest.script_text,
            file=latest.file,  # переиспользуем тот же загруженный файл
            dest_path=latest.dest_path,
            target_mode=latest.target_mode,
            client_ids=latest.client_ids,
            created_by=request.user,
            repeat_of=latest,  # пропустить ПК, где уже успешно выполнено
        )
        t = threading.Thread(target=executor.run_job, args=(job.id,), daemon=True)
        t.start()
        return Response(PcJobDetailSerializer(job).data, status=201)
