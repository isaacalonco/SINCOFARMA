"""Tarefas agendadas (EventBridge), fora da API."""

import json
import logging
import os
from datetime import datetime, timedelta, timezone

import boto3

log = logging.getLogger()
log.setLevel(logging.INFO)

TRUST = timedelta(hours=24)
_cognito = boto3.client("cognito-idp")


def _pages(method, key: str, token_in: str, token_out: str, **kw):
    token = None
    while True:
        resp = method(**kw, **({token_in: token} if token else {}))
        yield from resp.get(key, [])
        token = resp.get(token_out)
        if not token:
            return


def esquecer_aparelhos(_event, _context, idp=None, now=None):
    """De hora em hora: esquece aparelhos com mais de 24 h ("confiar neste computador").

    O painel registra um aparelho a cada login e só o lembra se a pessoa confiou;
    o Cognito não expira aparelhos sozinho, então o prazo é garantido aqui, mesmo
    que alguém copie a chave guardada no navegador.
    """
    idp = idp or _cognito
    pool = os.environ["USER_POOL_ID"]
    limit = (now or datetime.now(timezone.utc)) - TRUST
    forgotten = 0
    for user in _pages(idp.list_users, "Users", "PaginationToken", "PaginationToken", UserPoolId=pool, Limit=60):
        username = user["Username"]
        for dev in _pages(idp.admin_list_devices, "Devices", "PaginationToken", "PaginationToken", UserPoolId=pool, Username=username, Limit=60):
            created = dev.get("DeviceCreateDate")
            if created and created < limit:
                idp.admin_forget_device(UserPoolId=pool, Username=username, DeviceKey=dev["DeviceKey"])
                forgotten += 1
    log.info(json.dumps({"evento": "aparelhos_esquecidos", "total": forgotten}))
    return {"forgotten": forgotten}
