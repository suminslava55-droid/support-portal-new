from django.conf import settings
from django.db import models


class GameScore(models.Model):
    """Результат одного забега в скрытой аркаде."""

    GAME_CAT = 'cat'
    GAME_MEKO = 'meko'
    GAME_CHOICES = [
        (GAME_CAT, 'Cat Runner'),
        (GAME_MEKO, 'Meko Runner'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='game_scores', verbose_name='Сотрудник')
    game = models.CharField('Игра', max_length=16, choices=GAME_CHOICES)
    score = models.PositiveIntegerField('Счёт')
    created_at = models.DateTimeField('Дата', auto_now_add=True)

    class Meta:
        verbose_name = 'Результат игры'
        verbose_name_plural = 'Результаты игр'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['game', '-score'])]

    def __str__(self):
        return f'{self.get_game_display()}: {self.user} — {self.score}'
