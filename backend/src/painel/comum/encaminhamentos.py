"""Encaminhamentos: farmacêutico envia um atendimento a um médico, que lê e responde.

Tudo na tabela CLINICO (dados de saúde, chave KMS própria):
  REF#<id>             REF                  encaminhamento completo + cópia da ficha no envio
  MED#<sub do médico>  REF#<criado>#<id>    caixa de entrada do médico (resumo)
  UNIT#<u>#REF         REF#<criado>#<id>    encaminhamentos da farmácia (resumo)
  VISIT#<id>           AUDIT#...            auditoria, junto à do atendimento
  PAC#<cpf>            REF#<id>             índice do paciente (pedidos da LGPD)

O médico recebe a ficha copiada no momento do envio: lê só o que foi encaminhado a ele,
nunca o registro clínico da farmácia. Estados: sent -> read -> answered | declined;
cancelled pela farmácia enquanto não houver resposta.
"""

import json
import os
import secrets

from boto3.dynamodb.conditions import Key

from . import auditoria
from . import repositorio as repo
from . import tempo
from .http import HttpError
from .validacao import anonymize_cpf

DOCTOR_GROUP = "papel:medico"
OPEN = ("sent", "read")  # ainda sem resposta
LIST_LIMIT = 100


def _clinico():
    return repo._dynamodb.Table(os.environ["TABELA_CLINICO"])


def _attrs(user: dict) -> dict:
    return {a["Name"]: a["Value"] for a in user.get("Attributes", user.get("UserAttributes", []))}


def doctors() -> list[dict]:
    """Médicos ativos (grupo papel:medico): só id (sub) e nome; o CPF não sai daqui."""
    out, token = [], None
    while True:
        kw = {"UserPoolId": os.environ["USER_POOL_ID"], "GroupName": DOCTOR_GROUP, "Limit": 60}
        if token:
            kw["NextToken"] = token
        try:
            resp = repo._cognito.list_users_in_group(**kw)
        except repo._cognito.exceptions.ResourceNotFoundException:
            return []  # grupo ainda não criado: nenhum médico
        for u in resp.get("Users", []):
            if u.get("Enabled", True):
                a = _attrs(u)
                out.append({"id": a.get("sub"), "name": a.get("name") or "Médico(a)", "username": u["Username"]})
        token = resp.get("NextToken")
        if not token:
            return sorted(out, key=lambda d: repo._sem_acento(d["name"]))


def find_doctor(sub: str) -> dict:
    for d in doctors():
        if d["id"] == sub:
            return d
    raise HttpError(422, "Médico não encontrado.", {"fields": {"doctorId": "Escolha um médico da lista."}})


def _summary(ref: dict) -> dict:
    """O que as listas mostram (nunca a ficha)."""
    return {
        "id": ref["id"],
        "createdAt": ref["createdAt"],
        "status": ref["status"],
        "statusAt": ref["statusAt"],
        "priority": ref["priority"],
        "urgent": ref["urgent"],
        "risk": ref["clinical"]["risk"],
        "patientName": ref["patient"]["name"],
        "complaint": ref["clinical"]["complaint"]["text"],
        "protocol": ref["protocol"],
        "unit": ref["unit"],
        "unitName": ref["unitName"],
        "fromName": ref["from"]["name"],
        "doctorName": ref["doctor"]["name"],
    }


def _keys(ref: dict) -> list[dict]:
    sk = f"REF#{ref['createdAt']}#{ref['id']}"
    return [
        {"PK": f"REF#{ref['id']}", "SK": "REF"},
        {"PK": f"MED#{ref['doctor']['id']}", "SK": sk},
        {"PK": f"UNIT#{ref['unit']}#REF", "SK": sk},
    ]


def _audit(ref: dict, caller, action: str, changes: dict) -> dict:
    at = tempo.now().isoformat()
    item = {
        "PK": f"VISIT#{ref['visitId']}",
        "SK": f"AUDIT#{at}#{secrets.token_hex(3)}",
        "action": action,
        "at": at,
        "actorSub": caller.sub,
        "unit": ref["unit"],
        "referral": ref["id"],
        "changes": changes,
    }
    repo.log.info(json.dumps({"evento": "auditoria", "acao": action, "encaminhamento": ref["id"], "usuario": caller.sub, "unidade": ref["unit"]}))
    return {"Put": {"TableName": os.environ["TABELA_CLINICO"], "Item": item}}


def _target(ref: dict) -> dict:
    """Alvo no registro geral: protocolo e médico, nunca o paciente."""
    return {"type": "referral", "id": ref["id"], "label": ref.get("protocol"), "doctor": ref["doctor"]["name"]}


def public(ref: dict, caller) -> dict:
    """Encaminhamento completo para quem pode vê-lo (sem chaves internas)."""
    out = {k: v for k, v in ref.items() if k not in ("PK", "SK")}
    out["doctor"] = {"id": ref["doctor"]["id"], "name": ref["doctor"]["name"]}
    out["mine"] = caller.sub in (ref["doctor"]["id"], ref["from"]["sub"])
    return out


# ---------------------------------------------------------------- escrita

def create(caller, data: dict) -> dict:
    visit_id = data["visitId"]
    at_visit = repo.visit_instant(visit_id)
    visit = repo._painel().get_item(
        Key={"PK": repo.pk_day(caller.unit_id, tempo.day_key(at_visit)), "SK": f"VISIT#{visit_id}"}
    ).get("Item")
    record = _clinico().get_item(Key={"PK": f"VISIT#{visit_id}", "SK": "RECORD"}).get("Item")
    if not visit or not record or record.get("unit") != caller.unit_id:
        # inexistente ou de outra farmácia: mesma resposta
        raise HttpError(404, "Atendimento não encontrado.")

    doctor = find_doctor(data["doctorId"])
    sender = repo.pharmacist(caller.username)
    now = tempo.now()
    patient = record["patient"]
    ref = {
        "id": repo.new_visit_id(now),
        "visitId": visit_id,
        "protocol": visit.get("protocol"),
        "unit": caller.unit_id,
        "unitName": repo.unit_profile(caller.unit_id)["name"],
        "createdAt": now.isoformat(),
        "status": "sent",
        "statusAt": now.isoformat(),
        "priority": data["priority"],
        "urgent": data["priority"] == "urgente" or bool(visit.get("urgent")),
        "reason": data["reason"],
        "from": {"sub": caller.sub, "name": sender["name"], "crf": sender.get("crf")},
        "doctor": {"id": doctor["id"], "name": doctor["name"]},
        # só o necessário para o médico atender: CPF mascarado, sem endereço
        "patient": {
            "name": patient["name"],
            "birthDate": patient.get("birthDate"),
            "sex": patient.get("sex"),
            "phone": patient.get("phone"),
            "cns": patient.get("cns"),
            "cpf": anonymize_cpf(patient.get("cpf")),
        },
        "clinical": {k: record.get(k) for k in ("complaint", "history", "vitals", "risk", "redFlags", "notes")},
        "response": None,
        "answeredAt": None,
    }
    full, med, unit = _keys(ref)
    summary = _summary(ref)
    table = os.environ["TABELA_CLINICO"]
    repo._client.transact_write_items(
        TransactItems=[
            {"Put": {"TableName": table, "Item": {**full, **ref}, "ConditionExpression": "attribute_not_exists(PK)"}},
            {"Put": {"TableName": table, "Item": {**med, **summary}}},
            {"Put": {"TableName": table, "Item": {**unit, **summary}}},
            _audit(ref, caller, "referral_create", {"doctor": doctor["id"], "priority": ref["priority"]}),
            repo.patient_index(patient["cpf"], "REF", ref["id"], ref["unit"], ref["createdAt"]),
            auditoria.put("referral_create", caller, unit=ref["unit"], target=_target(ref), details={"priority": ref["priority"]}),
        ]
    )
    return public(ref, caller)


def _load_visible(caller, ref_id: str) -> dict:
    ref = _clinico().get_item(Key={"PK": f"REF#{ref_id}", "SK": "REF"}, ConsistentRead=True).get("Item")
    visible = ref and (
        (caller.pode("responder_encaminhamento") and ref["doctor"]["id"] == caller.sub)
        or (caller.pode("criar_encaminhamento") and ref["unit"] == caller.unit_id)
    )
    if not visible:
        # de outro médico ou outra farmácia: mesma resposta de inexistente
        raise HttpError(404, "Encaminhamento não encontrado.")
    return ref


def _set_status(ref: dict, caller, new: dict, action: str) -> dict:
    """Atualiza o completo e os dois resumos de uma vez, só se ninguém mudou antes."""
    table = os.environ["TABELA_CLINICO"]
    names = {"#st": "status"}
    values = {":old": ref["status"]}
    sets = []
    for i, (k, v) in enumerate(new.items()):
        names[f"#f{i}"] = k
        values[f":v{i}"] = v
        sets.append(f"#f{i} = :v{i}")
    update = "SET " + ", ".join(sets)
    summary_fields = {k: v for k, v in new.items() if k in ("status", "statusAt")}
    s_names = {f"#s{i}": k for i, k in enumerate(summary_fields)} | {"#st": "status"}
    s_values = {f":s{i}": v for i, v in enumerate(summary_fields.values())} | {":old": ref["status"]}
    s_update = "SET " + ", ".join(f"#s{i} = :s{i}" for i in range(len(summary_fields)))
    full, med, unit = _keys(ref)
    try:
        repo._client.transact_write_items(
            TransactItems=[
                {"Update": {"TableName": table, "Key": full, "UpdateExpression": update, "ConditionExpression": "#st = :old",
                            "ExpressionAttributeNames": names, "ExpressionAttributeValues": values}},
                *[
                    {"Update": {"TableName": table, "Key": key, "UpdateExpression": s_update, "ConditionExpression": "#st = :old",
                                "ExpressionAttributeNames": s_names, "ExpressionAttributeValues": s_values}}
                    for key in (med, unit)
                ],
                _audit(ref, caller, action, {"status": [ref["status"], new["status"]]}),
                auditoria.put(action, caller, unit=ref["unit"], target=_target(ref), details={"status": [ref["status"], new["status"]]}),
            ]
        )
    except repo._client.exceptions.TransactionCanceledException as exc:
        if "ConditionalCheckFailed" in [r.get("Code") for r in exc.response.get("CancellationReasons", [])]:
            raise HttpError(409, "O encaminhamento foi alterado por outra pessoa. Recarregue.") from exc
        raise
    return {**ref, **new}


def open_one(caller, ref_id: str) -> dict:
    """Detalhe; a primeira leitura pelo médico marca como lido."""
    ref = _load_visible(caller, ref_id)
    if ref["status"] == "sent" and ref["doctor"]["id"] == caller.sub:
        ref = _set_status(ref, caller, {"status": "read", "statusAt": tempo.now().isoformat()}, "referral_read")
    return public(ref, caller)


def change(caller, ref_id: str, data: dict) -> dict:
    ref = _load_visible(caller, ref_id)
    status = data["status"]
    if status in ("answered", "declined"):
        if ref["doctor"]["id"] != caller.sub:
            raise HttpError(403, "Só o médico que recebeu pode responder.")
    elif not (caller.pode("criar_encaminhamento") and ref["unit"] == caller.unit_id):
        raise HttpError(403, "Só a farmácia que encaminhou pode cancelar.")
    if ref["status"] not in OPEN:
        raise HttpError(409, "Este encaminhamento já foi encerrado.")
    now = tempo.now().isoformat()
    new = {"status": status, "statusAt": now}
    if status in ("answered", "declined"):
        new |= {"response": data["response"], "answeredAt": now}
    return public(_set_status(ref, caller, new, f"referral_{status}"), caller)


# ---------------------------------------------------------------- leitura

def list_for(caller, status: str | None = None) -> list[dict]:
    """Médico: a caixa de entrada dele. Farmacêutico: os da farmácia. Mais recentes primeiro."""
    if caller.pode("responder_encaminhamento") and not caller.pode("criar_encaminhamento"):
        pk = f"MED#{caller.sub}"
    elif caller.pode("criar_encaminhamento"):
        pk = f"UNIT#{caller.unit_id}#REF"
    else:
        raise HttpError(403, "Seu perfil não tem acesso a esta função.")
    items = _clinico().query(
        KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("REF#"),
        ScanIndexForward=False,
        Limit=LIST_LIMIT,
    ).get("Items", [])
    items = [{k: v for k, v in i.items() if k not in ("PK", "SK")} for i in items]
    return [i for i in items if status is None or i["status"] == status]
