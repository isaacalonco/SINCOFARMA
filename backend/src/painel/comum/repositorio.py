"""Acesso ao DynamoDB.

Tabela PAINEL (resumos e agregados, por unidade):
  UNIT#<u>                 PROFILE    perfil da unidade (nome, metas)
  UNIT#<u>#DAY#<aaaa-mm-dd> VISIT#<id> resumo do atendimento (o que o painel lista)
  UNIT#<u>#DAY#<aaaa-mm-dd> #STATS     contadores do dia
  UNIT#<u>#MONTH#<aaaa-mm>  #STATS     contadores do mes
  UNIT#<u>#SEQ              YEAR#<a>   sequencia de protocolos

Tabela CLINICO (dados pessoais e clinicos completos, chave KMS propria):
  VISIT#<id>  RECORD                     registro clinico
  VISIT#<id>  AUDIT#<iso>#<rand>         trilha de auditoria (quem fez o que, quando)
  PAC#<cpf>   VISIT#<id>                 índice do paciente (pedidos da LGPD, comum/lgpd.py)
"""

import json
import logging
import os
import secrets
import unicodedata
from datetime import datetime

import boto3
from boto3.dynamodb.conditions import Attr, Key

from . import auditoria, tempo
from .http import HttpError

log = logging.getLogger()

_dynamodb = boto3.resource("dynamodb")
_client = _dynamodb.meta.client  # cliente que ainda converte tipos Python <-> DynamoDB
_cognito = boto3.client("cognito-idp")

STATS = "#STATS"


def _painel():
    return _dynamodb.Table(os.environ["TABELA_PAINEL"])


def _clinico():
    return _dynamodb.Table(os.environ["TABELA_CLINICO"])


# ---------- chaves ----------

def pk_day(unit: str, day: str) -> str:
    return f"UNIT#{unit}#DAY#{day}"


def pk_month(unit: str, month: str) -> str:
    return f"UNIT#{unit}#MONTH#{month}"


def new_visit_id(at: datetime) -> str:
    """Ordenável por tempo e com o instante embutido (permite achar o dia sem índice)."""
    return f"{int(at.timestamp() * 1000):013d}-{secrets.token_hex(4)}"


def visit_instant(visit_id: str) -> datetime:
    return tempo.from_epoch_ms(int(visit_id.split("-", 1)[0]))


# ---------- leitura ----------

def unit_profile(unit: str) -> dict:
    item = _painel().get_item(Key={"PK": f"UNIT#{unit}", "SK": "PROFILE"}).get("Item") or {}
    return {
        "exists": bool(item),
        "name": item.get("name") or unit,
        "monthGoal": int(item.get("monthGoal") or 0),
        "triageGoalMin": int(item.get("triageGoalMin") or 10),
    }


def _sem_acento(text: str) -> str:
    """Chave de ordenação: "Águas Claras" antes de "Brazlândia"."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))


def list_units() -> list[dict]:
    """Todas as farmácias cadastradas (id e nome), em ordem alfabética.

    Varre a tabela filtrando os perfis: barato com poucas unidades; com centenas
    delas, vale um item-índice próprio.
    """
    kwargs = {
        "FilterExpression": Attr("SK").eq("PROFILE"),
        "ProjectionExpression": "PK, #n",
        "ExpressionAttributeNames": {"#n": "name"},
    }
    units = []
    while True:
        resp = _painel().scan(**kwargs)
        units += [{"id": i["PK"].removeprefix("UNIT#"), "name": i.get("name") or i["PK"]} for i in resp.get("Items", [])]
        if "LastEvaluatedKey" not in resp:
            return sorted(units, key=lambda u: _sem_acento(u["name"]))
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def visits_of_day(unit: str, day: str, viewer_sub: str, limit: int = 300) -> list[dict]:
    resp = _painel().query(
        KeyConditionExpression=Key("PK").eq(pk_day(unit, day)) & Key("SK").begins_with("VISIT#"),
        ScanIndexForward=False,  # mais recentes primeiro
        Limit=limit,
    )
    return [_public_visit(i, viewer_sub) for i in resp.get("Items", [])]


def stats_items(unit: str, days: list[str], months: list[str]) -> dict[str, dict]:
    """Contadores de vários dias/meses numa leitura em lote. Chave do retorno = PK."""
    keys = [{"PK": pk_day(unit, d), "SK": STATS} for d in days] + [{"PK": pk_month(unit, m), "SK": STATS} for m in months]
    unique = list({k["PK"]: k for k in keys}.values())
    table = os.environ["TABELA_PAINEL"]
    found: dict[str, dict] = {}
    for start in range(0, len(unique), 100):
        request = {table: {"Keys": unique[start:start + 100]}}
        while request:
            resp = _dynamodb.batch_get_item(RequestItems=request)
            for item in resp.get("Responses", {}).get(table, []):
                found[item["PK"]] = item
            request = resp.get("UnprocessedKeys") or None
    return found


def _public_visit(item: dict, viewer_sub: str) -> dict:
    """Formato que o front espera (sem chaves internas). `mine`: quem vê registrou o atendimento."""
    return {
        "id": item["id"],
        "at": item["at"],
        "time": item["time"],
        "name": item["name"],
        "cpf": item["cpf"],
        "complaint": item["complaint"],
        "signs": item.get("signs", ""),
        "rt": item.get("rt", ""),
        "protocol": item.get("protocol"),
        "risk": item.get("risk"),
        "redFlags": item.get("redFlags", []),
        "status": item["status"],
        "urgent": bool(item.get("urgent")),
        "mine": bool(viewer_sub) and item.get("createdBy") == viewer_sub,
        **({"source": item["source"]} if item.get("source") else {}),
    }


# ---------- escrita ----------

def next_protocol(unit: str, year: int) -> str:
    resp = _painel().update_item(
        Key={"PK": f"UNIT#{unit}#SEQ", "SK": f"YEAR#{year}"},
        UpdateExpression="ADD n :one",
        ExpressionAttributeValues={":one": 1},
        ReturnValues="UPDATED_NEW",
    )
    return f"SIN-{year}-{int(resp['Attributes']['n']):06d}"


_name_cache: dict[str, dict] = {}


def pharmacist(username: str) -> dict:
    """Nome e CRF do farmacêutico (cache por contêiner da Lambda)."""
    if username not in _name_cache:
        resp = _cognito.admin_get_user(UserPoolId=os.environ["USER_POOL_ID"], Username=username)
        attrs = {a["Name"]: a["Value"] for a in resp.get("UserAttributes", [])}
        _name_cache[username] = {"name": attrs.get("name") or username, "crf": attrs.get("custom:crf")}
    return _name_cache[username]


def forget_name(username: str) -> None:
    _name_cache.pop(username, None)


_sub_names: dict[str, str] = {}


def name_of_sub(sub: str) -> str:
    """Nome de quem tem este código interno; conta removida vira "Usuário removido"."""
    if sub not in _sub_names:
        users = _cognito.list_users(UserPoolId=os.environ["USER_POOL_ID"], Filter=f'sub = "{sub}"', Limit=1).get("Users", [])
        attrs = {a["Name"]: a["Value"] for a in (users[0].get("Attributes", []) if users else [])}
        if not users:
            return "Usuário removido"
        _sub_names[sub] = attrs.get("name") or "(sem nome)"
    return _sub_names[sub]


def patient_index(cpf: str, kind: str, item_id: str, unit: str, at: str) -> dict:
    """Item do índice PAC#<cpf> (VISIT ou REF) para a mesma transação do registro."""
    return {"Put": {"TableName": os.environ["TABELA_CLINICO"], "Item": {
        "PK": f"PAC#{cpf}", "SK": f"{kind}#{item_id}", "unit": unit, "at": at,
    }}}


def _counter_update(table: str, pk: str, deltas: dict[str, int]) -> dict:
    deltas = {k: v for k, v in deltas.items() if v}
    names = {f"#c{i}": k for i, k in enumerate(deltas)}
    values = {f":v{i}": v for i, v in enumerate(deltas.values())}
    expr = "ADD " + ", ".join(f"#c{i} :v{i}" for i in range(len(deltas)))
    return {
        "Update": {
            "TableName": table,
            "Key": {"PK": pk, "SK": STATS},
            "UpdateExpression": expr,
            "ExpressionAttributeNames": names,
            "ExpressionAttributeValues": values,
        }
    }


def _audit(table: str, visit_id: str, caller, action: str, changes: dict) -> dict:
    at = tempo.now().isoformat()
    item = {
        "PK": f"VISIT#{visit_id}",
        "SK": f"AUDIT#{at}#{secrets.token_hex(3)}",
        "action": action,
        "at": at,
        # só o código interno: o login (CPF) de quem agiu não vai para a trilha
        "actorSub": caller.sub,
        "unit": caller.unit_id,
        "changes": changes,
    }
    log.info(json.dumps({"evento": "auditoria", "acao": action, "visita": visit_id, "usuario": caller.sub, "unidade": caller.unit_id}))
    return {"Put": {"TableName": table, "Item": item}}


def create_visit(caller, summary: dict, clinical: dict, duration_sec: int) -> dict:
    at = tempo.now()
    visit_id = new_visit_id(at)
    day, month = tempo.day_key(at), tempo.month_key(at)
    rt = pharmacist(caller.username)
    protocol = next_protocol(caller.unit_id, at.year)
    painel, clinico = os.environ["TABELA_PAINEL"], os.environ["TABELA_CLINICO"]

    visit = {
        "PK": pk_day(caller.unit_id, day),
        "SK": f"VISIT#{visit_id}",
        "id": visit_id,
        "at": at.isoformat(),
        "time": tempo.time_label(at),
        **summary,
        "rt": rt["name"],
        "rtCrf": rt["crf"],
        "createdBy": caller.sub,
        "protocol": protocol,
    }
    record = {
        "PK": f"VISIT#{visit_id}",
        "SK": "RECORD",
        "unit": caller.unit_id,
        "at": at.isoformat(),
        "protocol": protocol,
        "createdBy": caller.sub,
        **clinical,
    }
    counters = {"total": 1, summary["status"]: 1, "urgent": int(summary["urgent"]), "durSum": duration_sec, "durCount": int(duration_sec > 0)}

    _client.transact_write_items(
        TransactItems=[
            {"Put": {"TableName": painel, "Item": visit, "ConditionExpression": "attribute_not_exists(PK)"}},
            {"Put": {"TableName": clinico, "Item": record, "ConditionExpression": "attribute_not_exists(PK)"}},
            _counter_update(painel, pk_day(caller.unit_id, day), counters),
            _counter_update(painel, pk_month(caller.unit_id, month), counters),
            _audit(clinico, visit_id, caller, "create", {"status": summary["status"], "urgent": summary["urgent"]}),
            patient_index(clinical["patient"]["cpf"], "VISIT", visit_id, caller.unit_id, at.isoformat()),
            # registro geral da administração: sem dado de paciente, só o protocolo
            auditoria.put("visit_create", caller, target={"type": "visit", "id": visit_id, "label": protocol}),
        ]
    )
    return _public_visit(visit, caller.sub)


def update_visit(caller, visit_id: str, patch: dict) -> dict:
    at = visit_instant(visit_id)
    day, month = tempo.day_key(at), tempo.month_key(at)
    key = {"PK": pk_day(caller.unit_id, day), "SK": f"VISIT#{visit_id}"}
    current = _painel().get_item(Key=key, ConsistentRead=True).get("Item")
    if not current:
        # inexistente ou de outra unidade: mesma resposta (não revela existência)
        raise HttpError(404, "Atendimento não encontrado.")
    if current.get("createdBy") != caller.sub:
        raise HttpError(403, "Só quem registrou o atendimento pode alterá-lo.")

    painel, clinico = os.environ["TABELA_PAINEL"], os.environ["TABELA_CLINICO"]
    new_status = patch.get("status", current["status"])
    new_urgent = patch.get("urgent", bool(current.get("urgent")))
    if new_status == current["status"] and new_urgent == bool(current.get("urgent")):
        return _public_visit(current, caller.sub)  # nada mudou

    deltas: dict[str, int] = {}
    if new_status != current["status"]:
        deltas[current["status"]] = -1
        deltas[new_status] = deltas.get(new_status, 0) + 1
    if new_urgent != bool(current.get("urgent")):
        deltas["urgent"] = 1 if new_urgent else -1

    try:
        _client.transact_write_items(
            TransactItems=[
                {
                    "Update": {
                        "TableName": painel,
                        "Key": key,
                        "UpdateExpression": "SET #st = :st, urgent = :u, updatedAt = :t, updatedBy = :by",
                        # concorrência otimista: só grava se ninguém mudou no meio do caminho
                        "ConditionExpression": "#st = :old_st AND urgent = :old_u",
                        "ExpressionAttributeNames": {"#st": "status"},
                        "ExpressionAttributeValues": {
                            ":st": new_status,
                            ":u": new_urgent,
                            ":t": tempo.now().isoformat(),
                            ":by": caller.sub,
                            ":old_st": current["status"],
                            ":old_u": bool(current.get("urgent")),
                        },
                    }
                },
                _counter_update(painel, pk_day(caller.unit_id, day), deltas),
                _counter_update(painel, pk_month(caller.unit_id, month), deltas),
                _audit(clinico, visit_id, caller, "update", {
                    "status": [current["status"], new_status],
                    "urgent": [bool(current.get("urgent")), new_urgent],
                }),
                auditoria.put("visit_update", caller, target={"type": "visit", "id": visit_id, "label": current.get("protocol")},
                              details={"status": [current["status"], new_status], "urgent": [bool(current.get("urgent")), new_urgent]}),
            ]
        )
    except _client.exceptions.TransactionCanceledException as exc:
        reasons = [r.get("Code") for r in exc.response.get("CancellationReasons", [])]
        if "ConditionalCheckFailed" in reasons:
            raise HttpError(409, "O atendimento foi alterado por outra pessoa. Recarregue o painel.") from exc
        raise

    return _public_visit({**current, "status": new_status, "urgent": new_urgent}, caller.sub)


# ---------- ficha do atendimento ----------

ACTION_LABELS = {
    "create": "Atendimento registrado",
    "update": "Desfecho ou Red Flag alterado",
    "referral_create": "Encaminhado a médico",
    "referral_read": "Encaminhamento lido pelo médico",
    "referral_answered": "Médico respondeu o encaminhamento",
    "referral_declined": "Médico recusou o encaminhamento",
    "referral_cancelled": "Encaminhamento cancelado",
}


def _actor_name(entry: dict) -> str:
    try:
        if entry.get("actorUsername"):  # trilhas antigas, de antes de o CPF sair da auditoria
            return pharmacist(entry["actorUsername"])["name"]
        return name_of_sub(entry.get("actorSub", ""))
    except Exception:  # noqa: BLE001 - usuário removido: mostra o que houver
        return "Usuário removido"


def visit_record(caller, visit_id: str) -> dict:
    """Ficha completa de um atendimento da farmácia de quem pede: resumo, registro clínico e histórico."""
    at = visit_instant(visit_id)
    visit = _painel().get_item(Key={"PK": pk_day(caller.unit_id, tempo.day_key(at)), "SK": f"VISIT#{visit_id}"}).get("Item")
    if not visit:
        # inexistente ou de outra farmácia: mesma resposta
        raise HttpError(404, "Atendimento não encontrado.")
    items = _clinico().query(KeyConditionExpression=Key("PK").eq(f"VISIT#{visit_id}")).get("Items", [])
    record = next((i for i in items if i["SK"] == "RECORD"), None)
    if not record or record.get("unit") != caller.unit_id:
        raise HttpError(404, "Atendimento não encontrado.")
    history = sorted((i for i in items if i["SK"].startswith("AUDIT#")), key=lambda i: i["at"])
    # abrir a ficha (CPF, telefone, dados de saúde) também fica registrado (LGPD, art. 37)
    auditoria.record("visit_read", caller, target={"type": "visit", "id": visit_id, "label": record.get("protocol")})
    return {
        "visit": _public_visit(visit, caller.sub),
        "record": {k: v for k, v in record.items() if k not in ("PK", "SK", "unit", "createdBy")},
        "history": [
            {
                "at": h["at"],
                "action": h["action"],
                "label": ACTION_LABELS.get(h["action"], h["action"]),
                "actor": _actor_name(h),
                "changes": h.get("changes", {}),
            }
            for h in history
        ],
    }
