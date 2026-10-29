"""Registro de auditoria geral, para a administração: quem fez o quê, onde e quando.

Fica na tabela PAINEL, sem nenhum dado de paciente (a trilha detalhada de cada
atendimento continua na tabela CLINICO, junto ao registro):
  AUDIT#<aaaa-mm>   <iso>#<rand>   ação, autor (sub), perfis do autor, unidade, alvo

Uma partição por mês: a tela de Auditoria lê um mês de cada vez, mais recentes primeiro.
"""

import os
import secrets

from boto3.dynamodb.conditions import Key

from . import tempo

PAGE = 200


def entry(action: str, caller, *, unit: str | None = None, target: dict | None = None, details: dict | None = None) -> dict:
    """Item pronto para gravar (sozinho ou dentro de uma transação)."""
    at = tempo.now()
    return {
        "PK": f"AUDIT#{tempo.month_key(at)}",
        "SK": f"{at.isoformat()}#{secrets.token_hex(3)}",
        "action": action,
        "at": at.isoformat(),
        "actorSub": caller.sub,
        "actorRoles": sorted(caller.roles),
        "unit": unit if unit is not None else caller.unit_id,
        "target": target or {},
        "details": details or {},
    }


def put(action: str, caller, **kw) -> dict:
    """Para incluir numa transact_write_items."""
    return {"Put": {"TableName": os.environ["TABELA_PAINEL"], "Item": entry(action, caller, **kw)}}


def record(action: str, caller, **kw) -> None:
    from . import repositorio as repo  # evita import circular

    repo._painel().put_item(Item=entry(action, caller, **kw))


def month_page(month: str, start: str | None = None) -> tuple[list[dict], str | None]:
    """Um mês, mais recentes primeiro. `start`: SK onde a página anterior parou."""
    from . import repositorio as repo

    kw = {"KeyConditionExpression": Key("PK").eq(f"AUDIT#{month}"), "ScanIndexForward": False, "Limit": PAGE}
    if start:
        kw["ExclusiveStartKey"] = {"PK": f"AUDIT#{month}", "SK": start}
    resp = repo._painel().query(**kw)
    items = [{k: v for k, v in i.items() if k != "PK"} for i in resp.get("Items", [])]
    nxt = resp.get("LastEvaluatedKey", {}).get("SK")
    return items, nxt
