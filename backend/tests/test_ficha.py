"""Ficha do atendimento: registro clínico completo + histórico, só para a farmácia dele."""

from conftest import body_of, event
from test_api import patch, post_visit


def ficha(api, visit_id, **kw):
    return api.ver_visita(event(path=f"/visits/{visit_id}", path_params={"id": visit_id}, **kw), None)


def test_ficha_completa_com_historico(aws):
    visit = body_of(post_visit(aws))
    patch(aws, visit["id"], {"status": "done"})
    resp = ficha(aws, visit["id"])
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
