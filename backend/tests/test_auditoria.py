"""Registro de auditoria geral (administração): toda ação entra, sem dado de paciente."""

import copy

from conftest import VALID_CLINICAL, body_of, doctor_sub, event
from test_api import patch

ADMIN = {"groups": "[papel:admin]", "user": "00000000191"}


def auditoria(api, **kw):
    return api.listar_auditoria(event(path="/auditoria", **kw), None)


def test_registra_acoes_sem_dados_de_paciente(aws):
    ana = {"sub": doctor_sub("52998224725")}  # sub real do Cognito, como em produção
    visit = body_of(aws.criar_visita(event("POST", "/visits", {"clinical": copy.deepcopy(VALID_CLINICAL)}, **ana), None))
    patch(aws, visit["id"], {"status": "done"}, **ana)
    body = {"visitId": visit["id"], "doctorId": doctor_sub("39053344705"), "reason": "Avaliar cefaleia", "priority": "rotina"}
    assert aws.criar_encaminhamento(event("POST", "/encaminhamentos", body, **ana), None)["statusCode"] == 201

    resp = auditoria(aws, **ADMIN)
    assert resp["statusCode"] == 200
    data = body_of(resp)
    assert [e["action"] for e in data["events"]] == ["referral_create", "visit_update", "visit_create"]  # recentes primeiro
    assert {e["actorName"] for e in data["events"]} == {"Dra. Ana Souza"}
    assert data["events"][-1]["target"]["label"] == visit["protocol"]
    # nada que identifique o paciente
    for termo in ("Maria Teste", "Cefaleia", "123.456.789", "Dipirona"):
        assert termo not in resp["body"]


def test_so_admin_ve(aws):
    assert auditoria(aws)["statusCode"] == 403
    assert auditoria(aws, groups="[papel:medico]")["statusCode"] == 403


def test_filtro_invalido(aws):
    assert auditoria(aws, query={"mes": "2026/10"}, **ADMIN)["statusCode"] == 400
    assert auditoria(aws, query={"inicio": "x"}, **ADMIN)["statusCode"] == 400


def test_mes_sem_eventos(aws):
    assert body_of(auditoria(aws, query={"mes": "2020-01"}, **ADMIN))["events"] == []
