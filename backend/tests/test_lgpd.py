"""LGPD: o usuário baixa os próprios dados e pede correção ou exclusão; a administração
responde e exporta os dados de um paciente a partir do CPF."""

import copy
import os

import boto3
import pytest

from conftest import REGION, VALID_CLINICAL, body_of, doctor_sub, event

ADMIN = {"groups": "[papel:admin]", "user": "00000000191", "sub": "11111111-2222-3333-4444-555555555555"}
PAC_CPF = "12345678909"


def ana():
    return {"sub": doctor_sub("52998224725")}


def medico():
    return {"user": "39053344705", "groups": "[papel:medico]", "sub": doctor_sub("39053344705")}


def nova_visita(api):
    resp = api.criar_visita(event("POST", "/visits", {"clinical": copy.deepcopy(VALID_CLINICAL)}, **ana()), None)
    assert resp["statusCode"] == 201
    return body_of(resp)


def encaminhar(api, visit):
    body = {"visitId": visit["id"], "doctorId": doctor_sub("39053344705"), "reason": "Avaliar cefaleia", "priority": "rotina"}
    resp = api.criar_encaminhamento(event("POST", "/encaminhamentos", body, **ana()), None)
    assert resp["statusCode"] == 201
    return body_of(resp)


def meus_dados(api, **kw):
    return api.meus_dados(event(path="/me/dados", **kw), None)


def pedir(api, body, **kw):
    return api.criar_meu_pedido(event("POST", "/me/pedidos", body, **kw), None)


def responder(api, pid, body, **kw):
    return api.responder_pedido_lgpd(event("PATCH", f"/lgpd/pedidos/{pid}", body, path_params={"id": pid}, **kw), None)


def exportar(api, cpf, **kw):
    return api.exportar_paciente(event("POST", "/lgpd/pacientes", {"cpf": cpf}, **kw), None)


def auditoria_geral():
    t = boto3.resource("dynamodb", region_name=REGION).Table("painel-test")
    return [i for i in t.scan()["Items"] if i["PK"].startswith("AUDIT#")]


# ---------------------------------------------------------------- o próprio usuário

def test_farmaceutico_baixa_os_proprios_dados_sem_dados_de_paciente(aws):
    visit = nova_visita(aws)
    resp = meus_dados(aws, **ana())
    assert resp["statusCode"] == 200
    dados = body_of(resp)
    assert dados["conta"]["nome"] == "Dra. Ana Souza"
    assert dados["conta"]["cpf"] == "52998224725"
    assert dados["conta"]["crf"] == "4192"
    assert dados["conta"]["perfis"] == ["Farmacêutico"]
    assert {"acao": "Registrou um atendimento", "referencia": visit["protocol"]}.items() <= dados["atividade"][0].items()
    assert dados["tratamento"]["compartilhamento"]
    # o atendimento é do paciente: no arquivo do farmacêutico só aparece o protocolo
    for termo in ("Maria Teste", "Cefaleia", "123.456.789", "Dipirona", "99999"):
        assert termo not in resp["body"]
    # a própria exportação fica registrada
    assert any(e["action"] == "lgpd_export_self" for e in auditoria_geral())


def test_medico_ve_os_encaminhamentos_recebidos_sem_o_paciente(aws):
    ref = encaminhar(aws, nova_visita(aws))
    resp = meus_dados(aws, **medico())
    dados = body_of(resp)
    assert [r["protocolo"] for r in dados["encaminhamentosRecebidos"]] == [ref["protocol"]]
    assert "Maria Teste" not in resp["body"]


def test_pedido_de_correcao(aws):
    assert pedir(aws, {"type": "correcao", "details": ""}, **ana())["statusCode"] == 422
    assert pedir(aws, {"type": "outro"}, **ana())["statusCode"] == 422
    resp = pedir(aws, {"type": "correcao", "details": "Meu e-mail mudou para ana@novo.com"}, **ana())
    assert resp["statusCode"] == 201
    pedido = body_of(resp)
    assert pedido["status"] == "aberto" and pedido["subject"]["name"] == "Dra. Ana Souza"
    # um pedido aberto de cada tipo por vez
    assert pedir(aws, {"type": "correcao", "details": "De novo, por favor"}, **ana())["statusCode"] == 409
    meus = body_of(aws.listar_meus_pedidos(event(path="/me/pedidos", **ana()), None))["requests"]
    assert [p["id"] for p in meus] == [pedido["id"]]

    # a administração responde; o usuário vê a resposta
    assert responder(aws, pedido["id"], {"status": "concluido", "response": "Ok"}, **ana())["statusCode"] == 403
    resp = responder(aws, pedido["id"], {"status": "concluido", "response": "E-mail atualizado."}, **ADMIN)
    assert resp["statusCode"] == 200
    meus = body_of(aws.listar_meus_pedidos(event(path="/me/pedidos", **ana()), None))["requests"]
    assert meus[0]["status"] == "concluido" and meus[0]["response"] == "E-mail atualizado."
    assert responder(aws, pedido["id"], {"status": "recusado", "response": "x y z"}, **ADMIN)["statusCode"] == 409


def test_resposta_exige_texto_e_id_valido(aws):
    pedido = body_of(pedir(aws, {"type": "exclusao"}, **ana()))
    assert responder(aws, pedido["id"], {"status": "concluido", "response": ""}, **ADMIN)["statusCode"] == 422
    assert responder(aws, "abc", {"status": "concluido", "response": "ok ok"}, **ADMIN)["statusCode"] == 404


def test_exclusao_anonimiza_a_conta_e_mantem_os_atendimentos(aws):
    visit = nova_visita(aws)
    pedido = body_of(pedir(aws, {"type": "exclusao", "details": "Saí da farmácia"}, **ana()))

    resp = responder(aws, pedido["id"], {"status": "concluido", "response": "Conta anonimizada."}, **ADMIN)
    assert resp["statusCode"] == 200
    assert body_of(resp)["subject"]["name"] == "Usuário removido"

    # a identidade saiu do Cognito
    idp = boto3.client("cognito-idp", region_name=REGION)
    with pytest.raises(idp.exceptions.UserNotFoundException):
        idp.admin_get_user(UserPoolId=os.environ["USER_POOL_ID"], Username="52998224725")
    # o atendimento continua, assinado pelo código interno
    clinico = boto3.resource("dynamodb", region_name=REGION).Table("clinico-test")
    record = clinico.get_item(Key={"PK": f"VISIT#{visit['id']}", "SK": "RECORD"})["Item"]
    assert record["patient"]["name"] == "Maria Teste"
    assert any(e["action"] == "lgpd_user_anonymized" for e in auditoria_geral())


def test_administracao_nao_responde_o_proprio_pedido(aws):
    pedido = body_of(pedir(aws, {"type": "exclusao"}, **ana()))
    assert responder(aws, pedido["id"], {"status": "concluido", "response": "Feito."}, **ana(), groups="[papel:admin]")["statusCode"] == 422


def test_so_administracao_lista_pedidos(aws):
    listar = lambda **kw: aws.listar_pedidos_lgpd(event(path="/lgpd/pedidos", **kw), None)  # noqa: E731
    assert listar(**ana())["statusCode"] == 403
    pedir(aws, {"type": "exclusao"}, **ana())
    resp = listar(**ADMIN, query={"status": "aberto"})
    assert resp["statusCode"] == 200 and len(body_of(resp)["requests"]) == 1
    assert listar(**ADMIN, query={"status": "x"})["statusCode"] == 400


# ---------------------------------------------------------------- paciente

def test_administracao_exporta_os_dados_do_paciente(aws):
    visit = nova_visita(aws)
    encaminhar(aws, visit)
    resp = exportar(aws, "123.456.789-09", **ADMIN)
    assert resp["statusCode"] == 200
    dados = body_of(resp)
    assert dados["cpf"] == "***.***.***-09"
    [atend] = dados["atendimentos"]
    assert atend["protocolo"] == visit["protocol"]
    assert atend["paciente"]["name"] == "Maria Teste"
    assert atend["farmacia"] == "Drogaria Planalto — Asa Sul"
    assert [a["acao"] for a in atend["registroDeAlteracoes"]] == ["Atendimento registrado", "Encaminhado a médico"]
    [ref] = dados["encaminhamentos"]
    # com quem o dado foi compartilhado (art. 18, VII)
    assert ref["medico"] == "Dr. Paulo Lima"
    # a exportação fica no registro geral, com o CPF mascarado
    [ev] = [e for e in auditoria_geral() if e["action"] == "lgpd_export_patient"]
    assert ev["target"]["label"] == "***.***.***-09"
    assert PAC_CPF not in str(ev)


def test_exportacao_de_paciente_valida_e_protege(aws):
    assert exportar(aws, "111.111.111-11", **ADMIN)["statusCode"] == 422
    assert exportar(aws, "52998224725", **ADMIN)["statusCode"] == 404  # CPF válido sem registros
    nova_visita(aws)
    assert exportar(aws, PAC_CPF, **ana())["statusCode"] == 403
    assert exportar(aws, PAC_CPF, **medico())["statusCode"] == 403


# ---------------------------------------------------------------- minimização e registro de acesso

def test_trilha_nao_guarda_o_cpf_de_quem_agiu_e_ficha_aberta_e_registrada(aws):
    visit = nova_visita(aws)
    resp = aws.ver_visita(event(path=f"/visits/{visit['id']}", path_params={"id": visit["id"]}, **ana()), None)
    assert resp["statusCode"] == 200
    assert body_of(resp)["history"][0]["actor"] == "Dra. Ana Souza"
    clinico = boto3.resource("dynamodb", region_name=REGION).Table("clinico-test")
    trilha = [i for i in clinico.scan()["Items"] if i["SK"].startswith("AUDIT#")]
    assert trilha and all("actorUsername" not in i for i in trilha)
    assert any(e["action"] == "visit_read" and e["target"]["label"] == visit["protocol"] for e in auditoria_geral())
