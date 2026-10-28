"""Handlers das rotas da API do painel (uma função Lambda por rota, permissões mínimas)."""

from .comum import repositorio as repo
from .comum import tempo
from .comum.auth import caller_from_event
from .comum.http import HttpError, handler, parse_json
from .comum.validacao import validar_atualizacao, validar_criacao

HISTORY_DAYS = 28


def _count(visits: list[dict]) -> dict[str, int]:
    out = {"done": 0, "referred": 0, "progress": 0}
    for v in visits:
        if v["status"] in out:
            out[v["status"]] += 1
    return out


@handler
def dashboard(event, _context):
    """GET /dashboard: atendimentos de hoje + agregados no formato que o front usa."""
    caller = caller_from_event(event)
    now = tempo.now()
    today = tempo.day_key(now)
    month = tempo.month_key(now)

    profile = repo.unit_profile(caller.unit_id)
    visits = repo.visits_of_day(caller.unit_id, today)

    week_days = [d.isoformat() for d in tempo.week_days(now)]
    history_days = [d.isoformat() for d in tempo.previous_days(now, HISTORY_DAYS)]
    stats = repo.stats_items(caller.unit_id, week_days + history_days, [month])
    day_total = lambda d: int(stats.get(repo.pk_day(caller.unit_id, d), {}).get("total", 0))  # noqa: E731

    month_stats = stats.get(repo.pk_month(caller.unit_id, month), {})
    dur_count = int(month_stats.get("durCount", 0))
    today_counts = _count(visits)
    history_total = sum(day_total(d) for d in history_days)

    # `baseline` segue o contrato de computeStats (src/data/stats.js):
    # os totais do mês já incluem os atendimentos devolvidos em `visits`.
    return 200, {
        "visits": visits,
        "lastSync": None,
        "rndsPending": 0,
        "unit": profile["name"],
        "week": [day_total(d) for d in week_days],
        "historicAverage": round(history_total / HISTORY_DAYS) if history_total else 0,
        "baseline": {
            "outcomes": {k: int(month_stats.get(k, 0)) for k in ("done", "referred", "progress")},
            "referralsToday": today_counts["referred"],
            # com medição, nunca mostra 0 (triagem de segundos ainda é "menos de 1 min")
            "triageMinutes": max(1, round(int(month_stats.get("durSum", 0)) / dur_count / 60)) if dur_count else 0,
            "triageGoal": f"< {profile['triageGoalMin']} min",
            "monthGoal": profile["monthGoal"],
            "seedCounts": today_counts,
            "seedCount": len(visits),
        },
    }


@handler
def criar_visita(event, _context):
    """POST /visits: valida, emite protocolo e grava resumo + registro clínico + auditoria."""
    caller = caller_from_event(event)
    summary, clinical, duration = validar_criacao(parse_json(event))
    visit = repo.create_visit(caller, summary, clinical, duration)
    return 201, visit


@handler
def atualizar_visita(event, _context):
    """PATCH /visits/{id}: troca desfecho e/ou Red Flag, com auditoria."""
    caller = caller_from_event(event)
    visit_id = (event.get("pathParameters") or {}).get("id", "")
    patch = validar_atualizacao(visit_id, parse_json(event))
    return 200, repo.update_visit(caller, visit_id, patch)


@handler
def sincronizar_rnds(event, _context):
    """POST /rnds/sync: integração ainda não existe; responde com honestidade."""
    caller_from_event(event)
    raise HttpError(501, "A integração com a RNDS ainda não está configurada.")
