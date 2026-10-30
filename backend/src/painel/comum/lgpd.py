"""Direitos do titular (LGPD, art. 18): acesso e portabilidade, correção, eliminação.

Dois titulares:
  - usuário do painel (farmacêutico, médico, administração): baixa os próprios dados e
    pede correção ou exclusão da conta em "Minha conta";
  - paciente: não tem conta; pede na farmácia ou ao Sincofarma, e a administração exporta
    tudo o que há sobre ele a partir do CPF.

Chaves:
  PAINEL   LGPD#PEDIDOS   PEDIDO#<id>        pedido do usuário (correção ou exclusão)
  CLINICO  PAC#<cpf>      VISIT#<id>         índice: atendimentos do paciente
  CLINICO  PAC#<cpf>      REF#<id>           índice: encaminhamentos do paciente

Exclusão da conta = anonimização: os atendimentos e a auditoria ficam (obrigação legal e
regulatória, art. 16, I), ligados só ao código interno (sub); a identidade sai do Cognito.
"""

import os
from datetime import datetime

from boto3.dynamodb.conditions import Attr, Key

from . import auditoria
from . import repositorio as repo
from . import tempo
from . import usuarios
from .http import HttpError
from .validacao import anonymize_cpf

PEDIDOS = "LGPD#PEDIDOS"
TIPOS = {"correcao": "Correção de dados", "exclusao": "Exclusão da conta"}
STATUS = ("aberto", "concluido", "recusado")
# atividade exportada: até 3 anos para trás (uma consulta por mês)
MESES_ATIVIDADE = 36
REMOVIDO = "Usuário removido"

ACOES = {
    "visit_create": "Registrou um atendimento",
    "visit_update": "Alterou desfecho ou Red Flag",
    "visit_read": "Abriu a ficha de um atendimento",
    "referral_create": "Encaminhou a médico",
    "referral_read": "Leu um encaminhamento",
    "referral_answered": "Respondeu um encaminhamento",
    "referral_declined": "Recusou um encaminhamento",
    "referral_cancelled": "Cancelou um encaminhamento",
    "user_create": "Cadastrou um usuário",
    "user_update": "Alterou um usuário",
    "lgpd_export_self": "Baixou os próprios dados",
    "lgpd_request": "Fez um pedido de privacidade",
    "lgpd_request_resolved": "Respondeu um pedido de privacidade",
    "lgpd_user_anonymized": "Anonimizou uma conta",
    "lgpd_export_patient": "Exportou os dados de um paciente",
}

# o que a política de privacidade também diz, junto do arquivo exportado (art. 9º e 18, VII)
TRATAMENTO = {
    "controlador": "Sincofarma DF: Sindicato do Comércio Varejista de Produtos Farmacêuticos do Distrito Federal",
    "finalidades": [
        "Identificar quem acessa o painel e registrar a responsabilidade técnica de cada atendimento.",
        "Atendimento farmacêutico, triagem e encaminhamento a médicos.",
        "Segurança, auditoria e prevenção de fraude.",
    ],
    "basesLegais": [
        "Cumprimento de obrigação legal ou regulatória (LGPD, art. 7º, II, e art. 11, II, a).",
        "Tutela da saúde, por profissionais de saúde (art. 7º, VIII, e art. 11, II, f).",
        "Execução do vínculo profissional com a farmácia ou o Sincofarma (art. 7º, V).",
    ],
    "compartilhamento": [
        "Médicos cadastrados no painel, quando o farmacêutico encaminha um atendimento.",
        "Amazon Web Services (São Paulo, sa-east-1): hospedagem, banco de dados e login, com criptografia.",
        "Vercel: hospedagem das telas do painel; não guarda dados de pacientes.",
    ],
    "retencao": [
        "Registros de atendimento e encaminhamentos: pelo prazo exigido pelas normas sanitárias e de saúde.",
        "Auditoria: mantida junto aos registros a que se refere.",
        "Logs técnicos de acesso (inclui endereço IP): 90 dias.",
        "Conta de acesso: enquanto houver vínculo; depois, anonimizada a pedido.",
    ],
}


def _painel():
    return repo._painel()


def _clinico():
    return repo._clinico()


def _pool() -> str:
    return os.environ["USER_POOL_ID"]


def _iso(value) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else value


# ---------------------------------------------------------------- pedidos do usuário

def _pedido_publico(item: dict) -> dict:
    return {k: v for k, v in item.items() if k not in ("PK", "SK")}


def _todos_pedidos() -> list[dict]:
    out, start = [], None
    while True:
        kw = {"KeyConditionExpression": Key("PK").eq(PEDIDOS), "ScanIndexForward": False}
        if start:
            kw["ExclusiveStartKey"] = start
        resp = _painel().query(**kw)
        out += resp.get("Items", [])
        start = resp.get("LastEvaluatedKey")
        if not start:
            return out


def pedidos_de(sub: str) -> list[dict]:
    return [_pedido_publico(p) for p in _todos_pedidos() if p.get("subject", {}).get("sub") == sub]


def listar_pedidos(status: str | None = None) -> list[dict]:
    return [_pedido_publico(p) for p in _todos_pedidos() if status is None or p.get("status") == status]


def criar_pedido(caller, tipo: str, detalhes: str) -> dict:
    meus = pedidos_de(caller.sub)
    if any(p["type"] == tipo and p["status"] == "aberto" for p in meus):
        raise HttpError(409, "Você já tem um pedido deste tipo em análise.")
    nome = repo.pharmacist(caller.username)["name"]
    at = tempo.now()
    pid = repo.new_visit_id(at)
    item = {
        "PK": PEDIDOS,
        "SK": f"PEDIDO#{pid}",
        "id": pid,
        "at": at.isoformat(),
        "type": tipo,
        "subject": {"kind": "user", "sub": caller.sub, "name": nome},
        "details": detalhes,
        "status": "aberto",
        "response": None,
        "resolvedAt": None,
    }
    repo._client.transact_write_items(TransactItems=[
        {"Put": {"TableName": os.environ["TABELA_PAINEL"], "Item": item, "ConditionExpression": "attribute_not_exists(PK)"}},
        auditoria.put("lgpd_request", caller, target={"type": "lgpd_request", "id": pid, "label": TIPOS[tipo]}),
    ])
    return _pedido_publico(item)


def responder_pedido(caller, pid: str, status: str, resposta: str) -> dict:
    """Administração conclui ou recusa. Concluir uma exclusão anonimiza a conta."""
    item = _painel().get_item(Key={"PK": PEDIDOS, "SK": f"PEDIDO#{pid}"}, ConsistentRead=True).get("Item")
    if not item:
        raise HttpError(404, "Pedido não encontrado.")
    if item["status"] != "aberto":
        raise HttpError(409, "Este pedido já foi respondido.")
    alvo = item["subject"]["sub"]
    if alvo == caller.sub:
        raise HttpError(422, "Um pedido seu precisa ser respondido por outra pessoa da administração.")

    subject = item["subject"]
    if item["type"] == "exclusao" and status == "concluido":
        anonimizar_usuario(caller, alvo)
        subject = {**subject, "name": REMOVIDO}

    agora = tempo.now().isoformat()
    _painel().update_item(
        Key={"PK": PEDIDOS, "SK": f"PEDIDO#{pid}"},
        UpdateExpression="SET #st = :st, #rsp = :r, resolvedAt = :t, resolvedBy = :by, subject = :subj",
        ConditionExpression="#st = :aberto",
        ExpressionAttributeNames={"#st": "status", "#rsp": "response"},
        ExpressionAttributeValues={":st": status, ":r": resposta, ":t": agora, ":by": caller.sub, ":subj": subject, ":aberto": "aberto"},
    )
    auditoria.record("lgpd_request_resolved", caller, target={"type": "lgpd_request", "id": pid, "label": TIPOS[item["type"]]},
                     details={"status": status})
    return _pedido_publico({**item, "status": status, "response": resposta, "resolvedAt": agora, "resolvedBy": caller.sub, "subject": subject})


def anonimizar_usuario(caller, sub: str) -> None:
    """Tira a identidade do Cognito (nome, e-mail, CPF, CRF, MFA) e o CPF das trilhas antigas.

    Fica: o código interno (sub) nos atendimentos, encaminhamentos e auditoria, e o nome e
    CRF de quem assinou como responsável técnico, exigidos pelas normas sanitárias.
    """
    user = usuarios._find(sub)
    username = user["Username"]
    idp = repo._cognito
    try:
        idp.admin_user_global_sign_out(UserPoolId=_pool(), Username=username)
    except idp.exceptions.UserNotFoundException:
        pass
    idp.admin_delete_user(UserPoolId=_pool(), Username=username)

    # trilhas gravadas antes de o CPF deixar de ir para a auditoria (campo actorUsername)
    tabela, start = _clinico(), None
    while True:
        kw = {"FilterExpression": Attr("actorSub").eq(sub) & Attr("actorUsername").exists(), "ProjectionExpression": "PK, SK"}
        if start:
            kw["ExclusiveStartKey"] = start
        resp = tabela.scan(**kw)
        for it in resp.get("Items", []):
            tabela.update_item(Key={"PK": it["PK"], "SK": it["SK"]}, UpdateExpression="REMOVE actorUsername")
        start = resp.get("LastEvaluatedKey")
        if not start:
            break
    repo.forget_name(username)
    repo._sub_names.pop(sub, None)
    auditoria.record("lgpd_user_anonymized", caller, target={"type": "user", "id": sub})


# ---------------------------------------------------------------- exportação: o próprio usuário

def _atividade(sub: str, desde: datetime | None) -> list[dict]:
    """Ações do usuário no registro geral, mês a mês (sem nome de terceiros)."""
    agora = tempo.now()
    inicio = desde or agora
    meses, y, m = [], agora.year, agora.month
    while len(meses) < MESES_ATIVIDADE and (y, m) >= (inicio.year, inicio.month):
        meses.append(f"{y:04d}-{m:02d}")
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    out = []
    for mes in meses:
        start = None
        while True:
            kw = {"KeyConditionExpression": Key("PK").eq(f"AUDIT#{mes}"), "FilterExpression": Attr("actorSub").eq(sub)}
            if start:
                kw["ExclusiveStartKey"] = start
            resp = _painel().query(**kw)
            for ev in resp.get("Items", []):
                alvo = ev.get("target") or {}
                # protocolo de atendimento sim; nome de outra pessoa (usuário cadastrado) não
                label = alvo.get("label") if alvo.get("type") in ("visit", "referral", "lgpd_request") else None
                out.append({"em": ev["at"], "acao": ACOES.get(ev["action"], ev["action"]), "referencia": label, "farmacia": ev.get("unit")})
            start = resp.get("LastEvaluatedKey")
            if not start:
                break
    return sorted(out, key=lambda e: e["em"], reverse=True)


def _aparelhos(username: str) -> list[dict]:
    try:
        devices = repo._cognito.admin_list_devices(UserPoolId=_pool(), Username=username, Limit=60).get("Devices", [])
    except Exception:  # noqa: BLE001 - sem aparelhos lembrados, ou a consulta indisponível
        return []
    out = []
    for d in devices:
        attrs = {a["Name"]: a["Value"] for a in d.get("DeviceAttributes", [])}
        out.append({
            "nome": attrs.get("device_name"),
            "lembradoEm": _iso(d.get("DeviceCreateDate")),
            "ultimoUso": _iso(d.get("DeviceLastAuthenticatedDate")),
        })
    return out


def dados_do_usuario(caller) -> dict:
    """Tudo o que o painel guarda sobre quem pede (art. 18, I, II e V), em formato aberto."""
    user = repo._cognito.admin_get_user(UserPoolId=_pool(), Username=caller.username)
    attrs = {a["Name"]: a["Value"] for a in user.get("UserAttributes", [])}
    criado = user.get("UserCreateDate")
    unidade = repo.unit_profile(caller.unit_id)["name"] if caller.unit_id else None

    recebidos = []
    if "medico" in caller.roles:
        resp = _clinico().query(KeyConditionExpression=Key("PK").eq(f"MED#{caller.sub}"))
        for r in resp.get("Items", []):
            # só o que é do médico: protocolo, datas e situação; o paciente não entra
            recebidos.append({"protocolo": r.get("protocol"), "recebidoEm": r.get("createdAt"), "situacao": r.get("status"),
                              "farmacia": r.get("unitName")})

    dados = {
        "geradoEm": tempo.now().isoformat(),
        "titular": "usuario",
        "conta": {
            "codigoInterno": caller.sub,
            "nome": attrs.get("name"),
            "email": attrs.get("email"),
            "cpf": caller.username,
            "crf": attrs.get("custom:crf"),
            "perfis": [usuarios.ROLE_NAMES[r] for r in sorted(caller.roles)],
            "farmacia": unidade,
            "criadaEm": _iso(criado),
            "situacao": user.get("UserStatus"),
            "ativa": user.get("Enabled", True),
            "verificacaoEmDuasEtapas": "SOFTWARE_TOKEN_MFA" in (user.get("UserMFASettingList") or []),
            "aparelhosLembrados": _aparelhos(caller.username),
        },
        "atividade": _atividade(caller.sub, criado),
        "encaminhamentosRecebidos": recebidos,
        "pedidosDePrivacidade": pedidos_de(caller.sub),
        "tratamento": TRATAMENTO,
        "observacoes": [
            "Os atendimentos que você registrou pertencem aos pacientes e não entram neste arquivo; "
            "na atividade aparece só o protocolo de cada um.",
            "Logs técnicos de acesso (data, hora, rota e endereço IP) ficam 90 dias e não entram aqui.",
        ],
    }
    auditoria.record("lgpd_export_self", caller, target={"type": "user", "id": caller.sub})
    return dados


# ---------------------------------------------------------------- exportação: paciente

def dados_do_paciente(caller, cpf: str) -> dict:
    """Tudo sobre um paciente, a partir do CPF (pedido feito à farmácia ou ao Sincofarma)."""
    idx = _clinico().query(KeyConditionExpression=Key("PK").eq(f"PAC#{cpf}")).get("Items", [])
    if not idx:
        raise HttpError(404, "Nenhum registro encontrado para este CPF.")
    nomes_unidade: dict[str, str] = {}

    def farmacia(unit: str | None) -> str | None:
        if unit and unit not in nomes_unidade:
            nomes_unidade[unit] = repo.unit_profile(unit)["name"]
        return nomes_unidade.get(unit) if unit else None

    atendimentos, encaminhamentos = [], []
    for i in sorted(idx, key=lambda i: i.get("at", "")):
        if i["SK"].startswith("VISIT#"):
            vid = i["SK"][len("VISIT#"):]
            items = _clinico().query(KeyConditionExpression=Key("PK").eq(f"VISIT#{vid}")).get("Items", [])
            rec = next((x for x in items if x["SK"] == "RECORD"), None)
            if not rec:
                continue
            resumo = _painel().get_item(Key={"PK": repo.pk_day(rec["unit"], tempo.day_key(repo.visit_instant(vid))), "SK": f"VISIT#{vid}"}).get("Item") or {}
            atendimentos.append({
                "protocolo": rec.get("protocol"),
                "data": rec.get("at"),
                "farmacia": farmacia(rec.get("unit")),
                "paciente": rec.get("patient"),
                "queixa": rec.get("complaint"),
                "historico": rec.get("history"),
                "sinaisVitais": rec.get("vitals"),
                "classificacaoDeRisco": rec.get("risk"),
                "sinaisDeAlerta": rec.get("redFlags"),
                "observacoes": rec.get("notes"),
                "desfecho": resumo.get("status"),
                "responsavelTecnico": resumo.get("rt"),
                # quem mexeu e quando; o nome dos funcionários não entra (dado deles)
                "registroDeAlteracoes": [
                    {"em": a["at"], "acao": repo.ACTION_LABELS.get(a["action"], a["action"])}
                    for a in sorted((x for x in items if x["SK"].startswith("AUDIT#")), key=lambda x: x["at"])
                ],
            })
        elif i["SK"].startswith("REF#"):
            rid = i["SK"][len("REF#"):]
            ref = _clinico().get_item(Key={"PK": f"REF#{rid}", "SK": "REF"}).get("Item")
            if not ref:
                continue
            encaminhamentos.append({
                "protocolo": ref.get("protocol"),
                "enviadoEm": ref.get("createdAt"),
                "farmacia": ref.get("unitName"),
                # compartilhamento (art. 18, VII): com quem o dado foi compartilhado
                "medico": ref.get("doctor", {}).get("name"),
                "prioridade": ref.get("priority"),
                "motivo": ref.get("reason"),
                "situacao": ref.get("status"),
                "resposta": ref.get("response"),
                "respondidoEm": ref.get("answeredAt"),
            })

    auditoria.record("lgpd_export_patient", caller, target={"type": "patient", "label": anonymize_cpf(cpf)},
                     details={"atendimentos": len(atendimentos), "encaminhamentos": len(encaminhamentos)})
    return {
        "geradoEm": tempo.now().isoformat(),
        "titular": "paciente",
        "cpf": anonymize_cpf(cpf),
        "atendimentos": atendimentos,
        "encaminhamentos": encaminhamentos,
        "tratamento": TRATAMENTO,
        "observacoes": [
            "Dados de saúde são mantidos pelo prazo exigido pelas normas sanitárias; correções são feitas pela farmácia que registrou o atendimento.",
        ],
    }
