from django.urls import path
from .views import LeaderboardView, SubmitScoreView

urlpatterns = [
    path('leaderboard/', LeaderboardView.as_view(), name='arcade-leaderboard'),
    path('scores/', SubmitScoreView.as_view(), name='arcade-submit-score'),
]
