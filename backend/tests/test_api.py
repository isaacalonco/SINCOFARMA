import copy

import boto3

from conftest import REGION, VALID_CLINICAL, body_of, event


def post_visit(api, clinical=None, **extra):
    body = {"clinical": copy.deepcopy(clinical or VALID_CLINICAL), **extra}
    return api.criar_visita(event("POST", "/visits", body), None)


def clinico_items():
    return boto3.resource("dynamodb", region_name=REGION).Table("clinico-test").scan()["Items"]


def painel_items():
    return boto3.resource("dynamodb", region_name=REGION).Table("painel-test").scan()["Items"]


# ---------------------------------------------------------------- autorização

def test_sem_unidade_recusa(aws):
    resp = aws.dashboard(event(groups="[papel:farmaceutico]"), None)
    assert resp["statusCode"] == 403


def test_duas_unidades_recusa(aws):
    resp = aws.dashboard(event(groups="[unidade:asa-sul unidade:taguatinga papel:farmaceutico]"), None)
    assert resp["statusCode"] == 403


def test_token_de_id_recusado(aws):
    ev = event()
    ev["requestContext"]["authorizer"]["jwt"]["claims"]["token_use"] = "id"
    assert aws.dashboard(ev, None)["statusCode"] == 401


# ---------------------------------------------------------------- criação

def test_cria_visita_e_deriva_resumo_no_servidor(aws):
    resp = post_visit(aws, status="progress", urgent=False, signs="falso", cpf="vazado")
    assert resp["statusCode"] == 201
    visit = body_of(resp)
    assert visit["name"] == "Maria Teste"
    assert visit["cpf"] == "***.***.***-09"
    assert visit["signs"] == "PA 120/80 mmHg · FC 72 bpm · SpO2 98% · Tax 36,5 °C"
    assert visit["rt"] == "Dra. Ana Souza"  # do Cognito, não do cliente
    assert visit["protocol"].startswith("SIN-") and visit["protocol"].endswith("000001")
    assert visit["urgent"] is False


def test_protocolo_sequencial(aws):
    p1 = body_of(post_visit(aws))["protocol"]
    p2 = body_of(post_visit(aws))["protocol"]
    assert int(p2[-6:]) == int(p1[-6:]) + 1


def test_urgencia_calculada_no_servidor(aws):
    clin = copy.deepcopy(VALID_CLINICAL)
    clin["redFlags"] = ["Síncope"]
    assert body_of(post_visit(aws, clin, urgent=False))["urgent"] is True
    clin = copy.deepcopy(VALID_CLINICAL)
    clin["risk"] = "vermelho"
    assert body_of(post_visit(aws, clin))["urgent"] is True


def test_dados_sensiveis_so_na_tabela_clinica(aws):
    visit = body_of(post_visit(aws))
    resumo = [i for i in painel_items() if i["SK"].startswith("VISIT#")][0]
    texto_resumo = str(resumo)
    for segredo in ["12345678909", "61999990000", "Dipirona", "Observação confidencial", "1990-05-10"]:
        assert segredo not in texto_resumo
    registro = [i for i in clinico_items() if i["SK"] == "RECORD"][0]
    assert registro["patient"]["cpf"] == "12345678909"
    assert registro["history"]["allergies"] == ["Dipirona"]
    assert registro["unit"] == "asa-sul"
    assert registro["protocol"] == visit["protocol"]


def test_auditoria_registrada(aws):
    visit = body_of(post_visit(aws))
    audit = [i for i in clinico_items() if i["SK"].startswith("AUDIT#")]
    assert len(audit) == 1
    assert audit[0]["PK"] == f"VISIT#{visit['id']}"
    assert audit[0]["action"] == "create"
    assert audit[0]["actorSub"] == "sub-52998224725"


def test_validacao_recusa_dados_invalidos(aws):
    clin = copy.deepcopy(VALID_CLINICAL)
    clin["patient"]["cpf"] = "111.111.111-11"
    clin["vitals"]["spo2"] = 999
    clin["vitals"]["diastolic"] = 130
    clin["risk"] = "roxo"
    clin["redFlags"] = ["Inventada"]
    clin["patient"]["birthDate"] = "31/02/1990"
    resp = post_visit(aws, clin)
    assert resp["statusCode"] == 422
    fields = body_of(resp)["details"]["fields"]
    for campo in ["cpf", "spo2", "paDia", "risco", "redFlags", "nascimento"]:
        assert campo in fields, campo
    assert painel_items() == [{"PK": "UNIT#asa-sul", "SK": "PROFILE", "name": "Drogaria Planalto — Asa Sul", "monthGoal": 525, "triageGoalMin": 10}]


def test_json_invalido(aws):
    ev = event("POST", "/visits")
    ev["body"] = "{nao e json"
    assert aws.criar_visita(ev, None)["statusCode"] == 400


# ---------------------------------------------------------------- painel

def test_dashboard_reflete_cadastros(aws):
    post_visit(aws, durationSec=300)
    clin = copy.deepcopy(VALID_CLINICAL)
    clin["redFlags"] = ["Dispneia"]
    post_visit(aws, clin, status="referred", durationSec=540)

    data = body_of(aws.dashboard(event(), None))
    assert len(data["visits"]) == 2
    assert data["visits"][0]["status"] == "referred"  # mais recente primeiro
    assert data["unit"] == "Drogaria Planalto — Asa Sul"
    b = data["baseline"]
    assert b["outcomes"] == {"done": 0, "referred": 1, "progress": 1}
    assert b["seedCounts"] == {"done": 0, "referred": 1, "progress": 1}
    assert b["seedCount"] == 2
    assert b["referralsToday"] == 1
    assert b["triageMinutes"] == 7  # (300 + 540) / 2 / 60
    assert b["monthGoal"] == 525
    assert sum(data["week"]) == 2


def test_tempo_de_triagem_curto_nao_aparece_como_zero(aws):
    post_visit(aws, durationSec=12)
    assert body_of(aws.dashboard(event(), None))["baseline"]["triageMinutes"] == 1


def test_sem_medicao_tempo_zero(aws):
    post_visit(aws)
    assert body_of(aws.dashboard(event(), None))["baseline"]["triageMinutes"] == 0


def test_dashboard_isolado_por_unidade(aws):
    post_visit(aws)
    other = body_of(aws.dashboard(event(groups="[unidade:taguatinga papel:farmaceutico]"), None))
    assert other["visits"] == []
    assert other["baseline"]["outcomes"] == {"done": 0, "referred": 0, "progress": 0}


# ---------------------------------------------------------------- atualização

def patch(api, visit_id, body, **kw):
    return api.atualizar_visita(event("PATCH", f"/visits/{visit_id}", body, path_params={"id": visit_id}, **kw), None)


def test_troca_desfecho_ajusta_contadores(aws):
    visit = body_of(post_visit(aws))
    resp = patch(aws, visit["id"], {"status": "done", "urgent": True})
    assert resp["statusCode"] == 200
    assert body_of(resp)["status"] == "done"
    b = body_of(aws.dashboard(event(), None))["baseline"]
    assert b["outcomes"] == {"done": 1, "referred": 0, "progress": 0}
    audit = sorted(i["action"] for i in clinico_items() if i["SK"].startswith("AUDIT#"))
    assert audit == ["create", "update"]


def test_patch_de_outra_unidade_nao_encontra(aws):
    visit = body_of(post_visit(aws))
    assert patch(aws, visit["id"], {"status": "done"}, groups="[unidade:taguatinga papel:farmaceutico]")["statusCode"] == 404


def test_patch_campos_nao_permitidos(aws):
    visit = body_of(post_visit(aws))
    resp = patch(aws, visit["id"], {"name": "Outro"})
    assert resp["statusCode"] == 422


def test_patch_id_invalido(aws):
    assert patch(aws, "../../etc", {"status": "done"})["statusCode"] == 404


def test_patch_sem_mudanca_nao_mexe_em_contadores(aws):
    visit = body_of(post_visit(aws))
    patch(aws, visit["id"], {"status": "progress"})
    audit = [i for i in clinico_items() if i["SK"].startswith("AUDIT#")]
    assert len(audit) == 1


# ---------------------------------------------------------------- RNDS

def test_rnds_responde_nao_implementado(aws):
    resp = aws.sincronizar_rnds(event("POST", "/rnds/sync"), None)
    assert resp["statusCode"] == 501
    assert "RNDS" in body_of(resp)["message"]
