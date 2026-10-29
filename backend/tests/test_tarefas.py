"""Limpeza de aparelhos lembrados (o moto não simula aparelhos: cliente falso)."""

import importlib
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

NOW = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


class FakeIdp:
    def __init__(self, devices):
        self.devices = devices  # username -> [(key, created)]
        self.forgotten = []

    def list_users(self, **kw):
        return {"Users": [{"Username": u} for u in self.devices]}

    def admin_list_devices(self, Username, PaginationToken=None, **kw):  # noqa: N803 - nomes da API
        devs = [{"DeviceKey": k, "DeviceCreateDate": c} for k, c in self.devices[Username]]
        # duas páginas, para exercitar a paginação
        if PaginationToken is None and len(devs) > 1:
            return {"Devices": devs[:1], "PaginationToken": "p2"}
        return {"Devices": devs[1:] if PaginationToken else devs}

    def admin_forget_device(self, Username, DeviceKey, **kw):  # noqa: N803
        self.forgotten.append((Username, DeviceKey))


def test_esquece_so_aparelhos_com_mais_de_24h(monkeypatch):
    monkeypatch.setenv("USER_POOL_ID", "pool")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "sa-east-1")
    tarefas = importlib.import_module("painel.tarefas")
    idp = FakeIdp({
        "ana": [("velho", NOW - timedelta(hours=25)), ("novo", NOW - timedelta(hours=2))],
        "paulo": [("ontem", NOW - timedelta(days=2))],
    })
    out = tarefas.esquecer_aparelhos({}, None, idp=idp, now=NOW)
    assert out == {"forgotten": 2}
    assert sorted(idp.forgotten) == [("ana", "velho"), ("paulo", "ontem")]
    assert os.environ["USER_POOL_ID"] == "pool"
