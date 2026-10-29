"""Handlers das rotas da API do painel (uma função Lambda por rota, permissões mínimas)."""

import re

from .comum import encaminhamentos as enc
from .comum import repositorio as repo
from .comum import tempo
from .comum.auth import caller_from_event
from .comum.http import HttpError, handler, parse_json
from .comum.validacao import (
    REFERRAL_STATUSES,
    VISIT_ID,
    validar_atualizacao,
    validar_criacao,
    validar_encaminhamento,
    validar_mudanca_encaminhamento,
)

HISTORY_DAYS = 28
UNIT_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,39}")


def _count(visits: list[dict]) -> dict[str, int]:
    out = {"done": 0, "referred": 0, "progress": 0}
    for v in visits:
        if v["status"] in out:
            out[v["status"]] += 1
    return out


def _unidade_do_painel(event, caller) -> str:
    """Unidade do dashboard: a do usuário, ou `?unidade=` para quem vê todas as farmácias."""
    pedida = ((event.get("queryStringParameters") or {}).get("unidade") or "").strip()
    if pedida and pedida != caller.unit_id:
        caller.exigir("ver_todas_unidades")
        if not UNIT_ID.fullmatch(pedida):
            raise HttpError(400, "Unidade inválida.")
        if not repo.unit_profile(pedida)["exists"]:
            raise HttpError(404, "Unidade não encontrada.")
        return pedida
    if not caller.unit_id:
        raise HttpError(400, "Informe a unidade (?unidade=<id>).")
    return caller.unit_id


@handler
def dashboard(event, _context):
    """GET /dashboard: atendimentos de hoje + agregados no formato que o front usa.

    Quem não pode ver dados de paciente (ou olha outra farmácia) recebe só os agregados:
    `visits` vazio e o resumo de hoje em `todaySummary`.
    """
    caller = caller_from_event(event)
    caller.exigir("ver_indicadores")
    unit = _unidade_do_painel(event, caller)
    com_pacientes = caller.pode("ver_atendimentos") and unit == caller.unit_id
    now = tempo.now()
    today = tempo.day_key(now)
    month = tempo.month_key(now)

    profile = repo.unit_profile(unit)
    visits = repo.visits_of_day(unit, today, caller.sub)

    week_days = [d.isoformat() for d in tempo.week_days(now)]
    history_days = [d.isoformat() for d in tempo.previous_days(now, HISTORY_DAYS)]
    stats = repo.stats_items(unit, week_days + history_days, [month])
    day_total = lambda d: int(stats.get(repo.pk_day(unit, d), {}).get("total", 0))  # noqa: E731

    month_stats = stats.get(repo.pk_month(unit, month), {})
    dur_count = int(month_stats.get("durCount", 0))
    today_counts = _count(visits)
    history_total = sum(day_total(d) for d in history_days)
    today_summary = {"total": len(visits), **today_counts, "urgent": sum(1 for v in visits if v["urgent"])}
    if not com_pacientes:
        visits = []
    # descontado por computeStats: só o que veio em `visits`
    seed_counts = _count(visits)

    # `baseline` segue o contrato de computeStats (src/data/stats.js):
    # os totais do mês já incluem os atendimentos devolvidos em `visits`.
    return 200, {
        "visits": visits,
        "todaySummary": today_summary,
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
            "seedCounts": seed_counts,
            "seedCount": len(visits),
        },
    }


@handler
def listar_unidades(event, _context):
    """GET /unidades: farmácias para a administração escolher no painel (só id e nome)."""
    caller_from_event(event).exigir("ver_todas_unidades")
    return 200, {"units": repo.list_units()}


@handler
def criar_visita(event, _context):
    """POST /visits: valida, emite protocolo e grava resumo + registro clínico + auditoria."""
    caller = caller_from_event(event)
    caller.exigir("criar_triagem")
    summary, clinical, duration = validar_criacao(parse_json(event))
    visit = repo.create_visit(caller, summary, clinical, duration)
    return 201, visit


@handler
def atualizar_visita(event, _context):
    """PATCH /visits/{id}: troca desfecho e/ou Red Flag, com auditoria (só quem registrou)."""
    caller = caller_from_event(event)
    caller.exigir("alterar_atendimento")
    visit_id = (event.get("pathParameters") or {}).get("id", "")
    patch = validar_atualizacao(visit_id, parse_json(event))
    return 200, repo.update_visit(caller, visit_id, patch)


@handler
def sincronizar_rnds(event, _context):
    """POST /rnds/sync: integração ainda não existe; responde com honestidade."""
    caller_from_event(event).exigir("sincronizar_rnds")
    raise HttpError(501, "A integração com a RNDS ainda não está configurada.")


# ---------------------------------------------------------------- encaminhamentos

@handler
def listar_medicos(event, _context):
    """GET /medicos: para o farmacêutico escolher o destinatário (id e nome, sem CPF)."""
    caller_from_event(event).exigir("criar_encaminhamento")
    return 200, {"doctors": [{"id": d["id"], "name": d["name"]} for d in enc.doctors()]}


@handler
def criar_encaminhamento(event, _context):
    """POST /encaminhamentos: envia um atendimento da farmácia a um médico."""
    caller = caller_from_event(event)
    caller.exigir("criar_encaminhamento")
    return 201, enc.create(caller, validar_encaminhamento(parse_json(event)))


@handler
def listar_encaminhamentos(event, _context):
    """GET /encaminhamentos[?status=]: caixa do médico ou encaminhamentos da farmácia."""
    caller = caller_from_event(event)
    caller.exigir("ver_encaminhamentos")
    status = (event.get("queryStringParameters") or {}).get("status")
    if status is not None and status not in REFERRAL_STATUSES:
        raise HttpError(400, "Status inválido.")
    return 200, {"referrals": enc.list_for(caller, status)}


@handler
def ver_encaminhamento(event, _context):
    """GET /encaminhamentos/{id}: detalhe com a ficha; a primeira abertura pelo médico marca como lido."""
    caller = caller_from_event(event)
    caller.exigir("ver_encaminhamentos")
    ref_id = (event.get("pathParameters") or {}).get("id", "")
    if not VISIT_ID.match(ref_id):
        raise HttpError(404, "Encaminhamento não encontrado.")
    return 200, enc.open_one(caller, ref_id)


@handler
def atualizar_encaminhamento(event, _context):
    """PATCH /encaminhamentos/{id}: médico responde ou recusa; farmácia cancela."""
    caller = caller_from_event(event)
    caller.exigir("ver_encaminhamentos")
    ref_id = (event.get("pathParameters") or {}).get("id", "")
    return 200, enc.change(caller, ref_id, validar_mudanca_encaminhamento(ref_id, parse_json(event)))
