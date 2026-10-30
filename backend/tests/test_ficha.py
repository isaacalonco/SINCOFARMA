"""Ficha do atendimento: registro clínico completo + histórico, só para a farmácia dele."""

import copy

from conftest import VALID_CLINICAL, body_of, doctor_sub, event
from test_api import patch, post_visit


def ficha(api, visit_id, **kw):
    return api.ver_visita(event(path=f"/visits/{visit_id}", path_params={"id": visit_id}, **kw), None)


def test_ficha_completa_com_historico(aws):
    # sub real do Cognito: o histórico acha o nome de quem agiu por ele (a trilha não guarda o CPF)
    ana = {"sub": doctor_sub("52998224725")}
    visit = body_of(aws.criar_visita(event("POST", "/visits", {"clinical": copy.deepcopy(VALID_CLINICAL)}, **ana), None))
    patch(aws, visit["id"], {"status": "done"}, **ana)
    resp = ficha(aws, visit["id"], **ana)
    assert resp["statusCode"] == 200
    data = body_of(resp)
    assert data["visit"]["protocol"] == visit["protocol"]
    assert data["record"]["history"]["allergies"] == ["Dipirona"]
    assert data["record"]["vitals"]["spo2"] == 98
    assert [h["label"] for h in data["history"]] == ["Atendimento registrado", "Desfecho ou Red Flag alterado"]
    assert data["history"][0]["actor"] == "Dra. Ana Souza"


def test_outra_farmacia_nao_ve(aws):
    visit = body_of(post_visit(aws))
    assert ficha(aws, visit["id"], groups="[unidade:taguatinga papel:farmaceutico]")["statusCode"] == 404


def test_admin_e_medico_nao_veem_ficha(aws):
    visit = body_of(post_visit(aws))
    assert ficha(aws, visit["id"], groups="[papel:admin]")["statusCode"] == 403
    assert ficha(aws, visit["id"], groups="[papel:medico]")["statusCode"] == 403


def test_id_invalido(aws):
    assert ficha(aws, "../x")["statusCode"] == 404
