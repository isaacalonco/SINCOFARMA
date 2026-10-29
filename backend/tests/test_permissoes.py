"""Quem pode ver e fazer o quê: farmacêutico, médico e administrador (papéis somam)."""

import boto3

from conftest import REGION, body_of, event
from test_api import patch, post_visit

ADMIN = "[papel:admin]"
MEDICO = "[papel:medico]"
OUTRO_FARMACEUTICO = {"user": "11144477735"}  # mesma unidade, outro login


def dashboard(api, **kw):
    return api.dashboard(event(**kw), None)


# ---------------------------------------------------------------- papel

def test_sem_papel_recusa(aws):
    assert dashboard(aws, groups="[unidade:asa-sul]")["statusCode"] == 403


def test_papel_desconhecido_recusa(aws):
    assert dashboard(aws, groups="[unidade:asa-sul papel:dono]")["statusCode"] == 403


# ---------------------------------------------------------------- médico

def test_medico_nao_ve_painel_nem_registra(aws):
    post_visit(aws)
    assert dashboard(aws, groups=MEDICO)["statusCode"] == 403
    assert dashboard(aws, groups="[unidade:asa-sul papel:medico]")["statusCode"] == 403
    resp = aws.criar_visita(event("POST", "/visits", {"clinical": {}}, groups=MEDICO), None)
    assert resp["statusCode"] == 403
    assert aws.sincronizar_rnds(event("POST", "/rnds/sync", groups=MEDICO), None)["statusCode"] == 403


# ---------------------------------------------------------------- administrador

def test_admin_ve_indicadores_sem_dados_de_paciente(aws):
    post_visit(aws)
    post_visit(aws, status="referred")

    resp = dashboard(aws, groups=ADMIN, query={"unidade": "asa-sul"})
    assert resp["statusCode"] == 200
    data = body_of(resp)
    assert data["visits"] == []
    assert "Maria Teste" not in resp["body"] and "Cefaleia" not in resp["body"]
    assert data["todaySummary"] == {"total": 2, "done": 0, "referred": 1, "progress": 1, "urgent": 0}
    b = data["baseline"]
    # com `visits` vazio nada é descontado: os totais chegam inteiros ao computeStats
    assert b["outcomes"] == {"done": 0, "referred": 1, "progress": 1}
    assert b["seedCounts"] == {"done": 0, "referred": 0, "progress": 0}
    assert b["seedCount"] == 0
    assert b["referralsToday"] == 1


def test_admin_precisa_escolher_unidade_valida(aws):
    assert dashboard(aws, groups=ADMIN)["statusCode"] == 400
    assert dashboard(aws, groups=ADMIN, query={"unidade": "../x"})["statusCode"] == 400
    assert dashboard(aws, groups=ADMIN, query={"unidade": "nao-existe"})["statusCode"] == 404


def test_admin_nao_registra_nem_altera(aws):
    visit = body_of(post_visit(aws))
    resp = aws.criar_visita(event("POST", "/visits", {"clinical": {}}, groups=ADMIN), None)
    assert resp["statusCode"] == 403
    assert patch(aws, visit["id"], {"status": "done"}, groups=ADMIN)["statusCode"] == 403


def test_farmaceutico_nao_ve_outra_unidade(aws):
    assert dashboard(aws, query={"unidade": "taguatinga"})["statusCode"] == 403


def test_papeis_somam(aws):
    """Farmacêutico RT que também é admin: dados na própria unidade, só agregados nas outras."""
    post_visit(aws)
    groups = "[unidade:asa-sul papel:farmaceutico papel:admin]"
    assert len(body_of(dashboard(aws, groups=groups))["visits"]) == 1
    boto3.resource("dynamodb", region_name=REGION).Table("painel-test").put_item(
        Item={"PK": "UNIT#taguatinga", "SK": "PROFILE", "name": "Taguatinga"}
    )
    other = dashboard(aws, groups=groups, query={"unidade": "taguatinga"})
    assert other["statusCode"] == 200
    assert body_of(other)["visits"] == []


# ---------------------------------------------------------------- farmacêutico: só os próprios

def test_farmaceutico_so_altera_o_que_registrou(aws):
    visit = body_of(post_visit(aws))
    assert visit["mine"] is True

    lista = body_of(dashboard(aws, **OUTRO_FARMACEUTICO))["visits"]
    assert [v["mine"] for v in lista] == [False]  # vê, mas não é dele

    resp = patch(aws, visit["id"], {"status": "done"}, **OUTRO_FARMACEUTICO)
    assert resp["statusCode"] == 403
    assert patch(aws, visit["id"], {"status": "done"})["statusCode"] == 200


# ---------------------------------------------------------------- lista de farmácias

def test_admin_lista_unidades_sem_dados_de_paciente(aws):
    post_visit(aws)
    boto3.resource("dynamodb", region_name=REGION).Table("painel-test").put_item(
        Item={"PK": "UNIT#aguas-claras", "SK": "PROFILE", "name": "Águas Claras"}
    )
    resp = aws.listar_unidades(event(path="/unidades", groups=ADMIN), None)
    assert resp["statusCode"] == 200
    assert body_of(resp)["units"] == [
        {"id": "aguas-claras", "name": "Águas Claras"},
        {"id": "asa-sul", "name": "Drogaria Planalto — Asa Sul"},
    ]


def test_so_admin_lista_unidades(aws):
    assert aws.listar_unidades(event(path="/unidades"), None)["statusCode"] == 403
    assert aws.listar_unidades(event(path="/unidades", groups=MEDICO), None)["statusCode"] == 403
