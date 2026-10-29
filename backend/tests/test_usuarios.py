"""Gestão de usuários pela administração: cadastro, perfis, farmácia, desativação, MFA."""

import os

import boto3

from conftest import REGION, body_of, doctor_sub, event

ADMIN = {"groups": "[papel:admin]", "user": "00000000191"}
NOVO = {"cpf": "529.982.247-25"}  # já existe no pool de teste (Dra. Ana)


def idp():
    return boto3.client("cognito-idp", region_name=REGION)


def listar(api, **kw):
    return api.listar_usuarios(event(path="/usuarios", **kw), None)


def criar(api, body, **kw):
    return api.criar_usuario(event("POST", "/usuarios", body, **{**ADMIN, **kw}), None)


def mudar(api, user_id, body, **kw):
    return api.atualizar_usuario(event("PATCH", f"/usuarios/{user_id}", body, path_params={"id": user_id}, **{**ADMIN, **kw}), None)


def by_name(api, name):
    return next(u for u in body_of(listar(api, **ADMIN))["users"] if u["name"] == name)


def groups_of(username):
    return sorted(g["GroupName"] for g in idp().admin_list_groups_for_user(UserPoolId=os.environ["USER_POOL_ID"], Username=username)["Groups"])


def test_so_admin_gerencia(aws):
    assert listar(aws)["statusCode"] == 403  # farmacêutico
    assert listar(aws, groups="[papel:medico]")["statusCode"] == 403


def test_lista_com_cpf_mascarado_e_perfis(aws):
    resp = listar(aws, **ADMIN)
    assert resp["statusCode"] == 200
    data = body_of(resp)
    paulo = next(u for u in data["users"] if u["name"] == "Dr. Paulo Lima")
    assert paulo["roles"] == ["medico"] and paulo["unit"] is None
    assert paulo["cpf"] == "***.533.447-**"
    assert "39053344705" not in resp["body"]
    assert data["units"][0]["id"] == "asa-sul"


def test_cria_farmaceutico_na_farmacia(aws):
    resp = criar(aws, {"cpf": "123.456.789-09", "name": "Dr. João Prado", "email": "Joao@Exemplo.com.br",
                       "roles": ["farmaceutico"], "unit": "asa-sul", "crf": "7788"})
    assert resp["statusCode"] == 201, resp["body"]
    user = body_of(resp)
    assert user["roles"] == ["farmaceutico"] and user["unit"] == "asa-sul" and user["pending"] is True
    assert user["email"] == "joao@exemplo.com.br"
    assert groups_of("12345678909") == ["papel:farmaceutico", "unidade:asa-sul"]


def test_validacao_do_cadastro(aws):
    resp = criar(aws, {"cpf": "111", "name": "X", "email": "nao-e-email", "roles": ["farmaceutico"]})
    assert resp["statusCode"] == 422
    assert set(body_of(resp)["details"]["fields"]) == {"cpf", "name", "email", "unit", "crf"}


def test_cpf_repetido_e_farmacia_inexistente(aws):
    base = {"name": "Fulano de Tal", "email": "f@x.com", "roles": ["admin"]}
    assert criar(aws, {**base, **NOVO})["statusCode"] == 409
    resp = criar(aws, {**base, "cpf": "123.456.789-09", "roles": ["farmaceutico"], "unit": "nao-existe", "crf": "1"})
    assert resp["statusCode"] == 422


def test_troca_perfil_e_farmacia(aws):
    paulo = by_name(aws, "Dr. Paulo Lima")
    resp = mudar(aws, paulo["id"], {"roles": ["medico", "admin"]})
    assert body_of(resp)["roles"] == ["admin", "medico"]
    assert groups_of("39053344705") == ["papel:admin", "papel:medico"]
    # médico sem CRF não vira farmacêutico
    assert mudar(aws, paulo["id"], {"roles": ["farmaceutico"], "unit": "asa-sul"})["statusCode"] == 422


def test_desativa_e_reativa(aws):
    paulo = by_name(aws, "Dr. Paulo Lima")
    assert body_of(mudar(aws, paulo["id"], {"enabled": False}))["enabled"] is False
    assert body_of(mudar(aws, paulo["id"], {"enabled": True}))["enabled"] is True


def test_admin_nao_se_tranca_para_fora(aws):
    paulo_sub = doctor_sub("39053344705")
    mudar(aws, paulo_sub, {"roles": ["medico", "admin"]})
    como_paulo = {"groups": "[papel:admin papel:medico]", "user": "39053344705", "sub": paulo_sub}
    assert mudar(aws, paulo_sub, {"enabled": False}, **como_paulo)["statusCode"] == 422
    assert mudar(aws, paulo_sub, {"roles": ["medico"]}, **como_paulo)["statusCode"] == 422


def test_reenvio_de_convite_so_antes_do_primeiro_acesso(aws):
    pendente = body_of(criar(aws, {"cpf": "123.456.789-09", "name": "Admin Novo", "email": "a@x.com", "roles": ["admin"]}))
    assert mudar(aws, pendente["id"], {"resendInvite": True})["statusCode"] == 200

    ativo = body_of(criar(aws, {"cpf": "987.654.321-00", "name": "Admin Ativo", "email": "b@x.com", "roles": ["admin"]}))
    pool = os.environ["USER_POOL_ID"]
    idp().admin_set_user_password(UserPoolId=pool, Username="98765432100", Password="SenhaForte#2026", Permanent=True)
    assert mudar(aws, ativo["id"], {"resendInvite": True})["statusCode"] == 422


def test_reset_de_mfa(aws):
    paulo = by_name(aws, "Dr. Paulo Lima")
    assert mudar(aws, paulo["id"], {"resetMfa": True})["statusCode"] == 200


def test_mudancas_vao_para_a_auditoria(aws):
    paulo = by_name(aws, "Dr. Paulo Lima")
    mudar(aws, paulo["id"], {"enabled": False})
    items = boto3.resource("dynamodb", region_name=REGION).Table("painel-test").scan()["Items"]
    audit = [i for i in items if i["PK"].startswith("AUDIT#")]
    assert [a["action"] for a in audit] == ["user_update"]
    assert audit[0]["target"]["label"] == "Dr. Paulo Lima" and audit[0]["details"] == {"enabled": False}


def test_usuario_inexistente(aws):
    assert mudar(aws, "00000000-0000-4000-8000-000000000000", {"enabled": False})["statusCode"] == 404
    assert mudar(aws, "abc", {"enabled": False})["statusCode"] == 404
