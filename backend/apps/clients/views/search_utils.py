from django.db.models import Q


SIMILARITY_THRESHOLD = 0.1

CLIENT_SEARCH_FIELDS = [
    "address", "phone", "email", "pharmacy_code", "warehouse_code",
    "personal_account", "contract_number", "personal_account2", "contract_number2",
]


def build_exact_q(search):
    q = Q()
    for field in CLIENT_SEARCH_FIELDS:
        q |= Q(**{f"{field}__icontains": search})
    q |= Q(provider__name__icontains=search)
    q |= Q(provider2__name__icontains=search)
    q |= Q(ofd_company__name__icontains=search)
    q |= Q(ofd_company__inn__icontains=search)
    return q


def fuzzy_filter_clients(qs, search):
    if not search or len(search) < 2:
        return qs
    exact_qs = qs.filter(build_exact_q(search)).distinct()
    if exact_qs.exists():
        return exact_qs
    try:
        from django.contrib.postgres.search import TrigramSimilarity
        fuzzy_qs = qs.annotate(
            sim=TrigramSimilarity("address", search),
        ).filter(sim__gte=SIMILARITY_THRESHOLD).order_by("-sim").distinct()
        return fuzzy_qs
    except Exception:
        return exact_qs
