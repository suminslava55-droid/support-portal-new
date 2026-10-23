from datetime import timedelta

from django.db.models import Max
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import GameScore

GAMES = dict(GameScore.GAME_CHOICES)
MAX_SCORE = 1000000  # грубая отсечка явной накрутки
TOP_N = 10


def _leaderboard(game, period, user):
    """Лучший результат каждого сотрудника по игре (за всё время или за 30 дней)."""
    qs = GameScore.objects.filter(game=game)
    if period == 'month':
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=30))
    rows = list(
        qs.values('user_id', 'user__last_name', 'user__first_name')
        .annotate(best=Max('score'))
        .order_by('-best', 'user__last_name')
    )
    top = [
        {
            'rank': i + 1,
            'user_id': r['user_id'],
            'name': f"{r['user__last_name']} {r['user__first_name']}".strip(),
            'score': r['best'],
            'is_me': r['user_id'] == user.id,
        }
        for i, r in enumerate(rows[:TOP_N])
    ]
    me = next(({'rank': i + 1, 'score': r['best']}
               for i, r in enumerate(rows) if r['user_id'] == user.id), None)
    return {'game': game, 'period': period, 'top': top, 'me': me, 'players': len(rows)}


class LeaderboardView(APIView):
    """GET ?game=cat|meko|tanks&period=all|month — топ-10 и место текущего пользователя."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        game = request.query_params.get('game')
        if game not in GAMES:
            return Response({'error': 'Неизвестная игра'}, status=400)
        period = 'month' if request.query_params.get('period') == 'month' else 'all'
        return Response(_leaderboard(game, period, request.user))


class SubmitScoreView(APIView):
    """POST {game, score} — сохранить результат забега."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        game = request.data.get('game')
        if game not in GAMES:
            return Response({'error': 'Неизвестная игра'}, status=400)
        try:
            score = int(request.data.get('score'))
        except (TypeError, ValueError):
            return Response({'error': 'Некорректный счёт'}, status=400)
        if score < 0 or score > MAX_SCORE:
            return Response({'error': 'Некорректный счёт'}, status=400)

        prev_best = (GameScore.objects.filter(user=request.user, game=game)
                     .aggregate(b=Max('score'))['b'])
        if score > 0:
            GameScore.objects.create(user=request.user, game=game, score=score)
        return Response({
            'saved': score > 0,
            'personal_best': prev_best is None or score > prev_best,
        })
