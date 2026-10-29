"""Encaminhamentos: farmacêutico envia, médico lê e responde; cada um só vê o que é seu."""

import boto3

from conftest import REGION, body_of, doctor_sub, event
from test_api import clinico_items, post_visit

PAULO, CARLA = "39053344705", "71428793860"
OUTRO_FARMACEUTICO = {"user": "11144477735"}  # mesma farmácia


def as_doctor(username):
    return {"user": username, "groups": "[papel:medico]", "sub": doctor_sub(username)}


def send(api, visit_id, doctor=PAULO, **kw):
    body = {"visitId": visit_id, "doctorId": doctor_sub(doctor), "reason": "Avaliar dor torácica atípica", "priority": "urgente"}
    return api.criar_encaminhamento(event("POST", "/encaminhamentos", body, **kw), None)


def listar(api, **kw):
    return body_of(api.listar_encaminhamentos(event(path="/encaminhamentos", **kw), None))["referrals"]


def abrir(api, ref_id, **kw):
    return api.ver_encaminhamento(event(path=f"/encaminhamentos/{ref_id}", path_params={"id": ref_id}, **kw), None)


def mudar(api, ref_id, body, **kw):
    return api.atualizar_encaminhamento(event("PATCH", f"/encaminhamentos/{ref_id}", body, path_params={"id": ref_id}, **kw), None)


def new_referral(api, doctor=PAULO):
    visit = body_of(post_visit(api))
    resp = send(api, visit["id"], doctor)
    assert resp["statusCode"] == 201, resp["body"]
    return body_of(resp)


# ---------------------------------------------------------------- envio

def test_farmaceutico_lista_medicos_sem_cpf(aws):
    resp = aws.listar_medicos(event(path="/medicos"), None)
    assert resp["statusCode"] == 200
    doctors = body_of(resp)["doctors"]
    assert [d["name"] for d in doctors] == ["Dr. Paulo Lima", "Dra. Carla Nunes"]
    assert PAULO not in resp["body"] and CARLA not in resp["body"]


def test_envia_com_copia_da_ficha_e_cpf_mascarado(aws):
    ref = new_referral(aws)
    assert ref["status"] == "sent"
    assert ref["doctor"]["name"] == "Dr. Paulo Lima"
    assert ref["from"]["name"] == "Dra. Ana Souza"
    assert ref["patient"]["name"] == "Maria Teste"
    assert ref["patient"]["cpf"] == "***.***.***-09"
    assert ref["clinical"]["history"]["allergies"] == ["Dipirona"]
    assert ref["urgent"] is True
    audit = [i["action"] for i in clinico_items() if i["SK"].startswith("AUDIT#")]
    assert "referral_create" in audit


def test_validacao_do_envio(aws):
    visit = body_of(post_visit(aws))
    resp = aws.criar_encaminhamento(event("POST", "/encaminhamentos", {"visitId": visit["id"], "doctorId": "x", "reason": "ok"}), None)
    assert resp["statusCode"] == 422
    assert set(body_of(resp)["details"]["fields"]) == {"doctorId", "reason"}


def test_medico_inexistente_ou_fora_do_grupo(aws):
    visit = body_of(post_visit(aws))
    body = {"visitId": visit["id"], "doctorId": "00000000-0000-4000-8000-000000000000", "reason": "Avaliação"}
    assert aws.criar_encaminhamento(event("POST", "/encaminhamentos", body), None)["statusCode"] == 422


def test_atendimento_de_outra_farmacia_nao_encontra(aws):
    visit = body_of(post_visit(aws))
    resp = send(aws, visit["id"], groups="[unidade:taguatinga papel:farmaceutico]")
    assert resp["statusCode"] == 404


def test_so_farmaceutico_envia(aws):
    visit = body_of(post_visit(aws))
    assert send(aws, visit["id"], **as_doctor(PAULO))["statusCode"] == 403
    assert send(aws, visit["id"], groups="[papel:admin]")["statusCode"] == 403


# ---------------------------------------------------------------- quem vê o quê

def test_medico_so_ve_os_seus(aws):
    para_paulo = new_referral(aws, PAULO)
    new_referral(aws, CARLA)

    caixa = listar(aws, **as_doctor(PAULO))
    assert [r["id"] for r in caixa] == [para_paulo["id"]]
    assert "clinical" not in caixa[0] and "patient" not in caixa[0]  # lista só com resumo

    # o de outro médico: mesma resposta de inexistente
    outro = listar(aws, **as_doctor(CARLA))[0]
    assert abrir(aws, outro["id"], **as_doctor(PAULO))["statusCode"] == 404


def test_farmacia_ve_os_que_enviou(aws):
    new_referral(aws, PAULO)
    new_referral(aws, CARLA)
    assert len(listar(aws, **OUTRO_FARMACEUTICO)) == 2
    assert listar(aws, groups="[unidade:taguatinga papel:farmaceutico]") == []


def test_admin_nao_ve_encaminhamentos(aws):
    new_referral(aws)
    assert aws.listar_encaminhamentos(event(path="/encaminhamentos", groups="[papel:admin]"), None)["statusCode"] == 403


# ---------------------------------------------------------------- ciclo de vida

def test_medico_abre_responde_e_farmacia_ve_a_resposta(aws):
    ref = new_referral(aws)

    aberto = body_of(abrir(aws, ref["id"], **as_doctor(PAULO)))
    assert aberto["status"] == "read"
    assert aberto["clinical"]["vitals"]["spo2"] == 98

    resp = mudar(aws, ref["id"], {"status": "answered", "response": "Paciente pode seguir com analgesia; retorno se piorar."}, **as_doctor(PAULO))
    assert resp["statusCode"] == 200
    assert body_of(resp)["status"] == "answered"

    da_farmacia = body_of(abrir(aws, ref["id"]))
    assert da_farmacia["response"].startswith("Paciente pode seguir")
    assert listar(aws, query={"status": "answered"})[0]["status"] == "answered"  # resumo acompanha

    audit = sorted(i["action"] for i in clinico_items() if i.get("referral") == ref["id"])
    assert audit == ["referral_answered", "referral_create", "referral_read"]


def test_farmacia_abrir_nao_marca_como_lido(aws):
    ref = new_referral(aws)
    assert body_of(abrir(aws, ref["id"]))["status"] == "sent"


def test_resposta_exige_texto(aws):
    ref = new_referral(aws)
    assert mudar(aws, ref["id"], {"status": "answered"}, **as_doctor(PAULO))["statusCode"] == 422


def test_farmacia_nao_responde_e_medico_nao_cancela(aws):
    ref = new_referral(aws)
    assert mudar(aws, ref["id"], {"status": "answered", "response": "ok ok"})["statusCode"] == 403
    assert mudar(aws, ref["id"], {"status": "cancelled"}, **as_doctor(PAULO))["statusCode"] == 403


def test_farmacia_cancela_e_depois_nada_muda(aws):
    ref = new_referral(aws)
    assert body_of(mudar(aws, ref["id"], {"status": "cancelled"}, **OUTRO_FARMACEUTICO))["status"] == "cancelled"
    resp = mudar(aws, ref["id"], {"status": "answered", "response": "tarde demais"}, **as_doctor(PAULO))
    assert resp["statusCode"] == 409


def test_recusa_com_motivo(aws):
    ref = new_referral(aws)
    resp = mudar(aws, ref["id"], {"status": "declined", "response": "Fora da minha especialidade."}, **as_doctor(PAULO))
    assert body_of(resp)["status"] == "declined"


def test_ficha_do_encaminhamento_nao_muda_com_o_atendimento(aws):
    """A cópia é do momento do envio: o médico vê o que foi encaminhado."""
    ref = new_referral(aws)
    table = boto3.resource("dynamodb", region_name=REGION).Table("clinico-test")
    table.update_item(Key={"PK": f"VISIT#{ref['visitId']}", "SK": "RECORD"}, UpdateExpression="SET notes = :n", ExpressionAttributeValues={":n": "mudou"})
    assert body_of(abrir(aws, ref["id"], **as_doctor(PAULO)))["clinical"]["notes"] == "Observação confidencial"
