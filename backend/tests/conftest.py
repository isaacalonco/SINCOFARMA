"""Ambiente de teste: DynamoDB e Cognito simulados (moto), sem tocar na AWS."""

import importlib
import json
import os
import sys

import boto3
import pytest
from moto import mock_aws

REGION = "sa-east-1"


@pytest.fixture(autouse=True)
def _aws_env(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", REGION)
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.delenv("AWS_PROFILE", raising=False)
    monkeypatch.setenv("TABELA_PAINEL", "painel-test")
    monkeypatch.setenv("TABELA_CLINICO", "clinico-test")


def _table(ddb, name):
    ddb.create_table(
        TableName=name,
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[{"AttributeName": "PK", "AttributeType": "S"}, {"AttributeName": "SK", "AttributeType": "S"}],
        KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}, {"AttributeName": "SK", "KeyType": "RANGE"}],
    )


DOCTORS = {"39053344705": "Dr. Paulo Lima", "71428793860": "Dra. Carla Nunes"}


def doctor_sub(username: str) -> str:
    """sub que o Cognito (simulado) deu ao médico."""
    resp = boto3.client("cognito-idp", region_name=REGION).admin_get_user(UserPoolId=os.environ["USER_POOL_ID"], Username=username)
    return next(a["Value"] for a in resp["UserAttributes"] if a["Name"] == "sub")


@pytest.fixture
def aws(monkeypatch):
    with mock_aws():
        ddb = boto3.client("dynamodb", region_name=REGION)
        _table(ddb, "painel-test")
        _table(ddb, "clinico-test")

        idp = boto3.client("cognito-idp", region_name=REGION)
        pool = idp.create_user_pool(PoolName="test")["UserPool"]["Id"]
        monkeypatch.setenv("USER_POOL_ID", pool)
        for username, name, crf in [("52998224725", "Dra. Ana Souza", "4192"), ("11144477735", "Dr. Rafael Mendes", "5501")]:
            idp.admin_create_user(
                UserPoolId=pool,
                Username=username,
                UserAttributes=[{"Name": "name", "Value": name}, {"Name": "custom:crf", "Value": crf}],
                MessageAction="SUPPRESS",
            )

        # médicos (recebem encaminhamentos): só nome, sem CRF
        idp.create_group(UserPoolId=pool, GroupName="papel:medico")
        for username, name in DOCTORS.items():
            idp.admin_create_user(UserPoolId=pool, Username=username, UserAttributes=[{"Name": "name", "Value": name}], MessageAction="SUPPRESS")
            idp.admin_add_user_to_group(UserPoolId=pool, Username=username, GroupName="papel:medico")

        # importa depois de ligar o mock: os clientes boto3 do módulo ficam simulados
        for mod in [m for m in sys.modules if m.startswith("painel")]:
            del sys.modules[mod]
        api = importlib.import_module("painel.api")

        boto3.resource("dynamodb", region_name=REGION).Table("painel-test").put_item(
            Item={"PK": "UNIT#asa-sul", "SK": "PROFILE", "name": "Drogaria Planalto — Asa Sul", "monthGoal": 525, "triageGoalMin": 10}
        )
        yield api


def event(method="GET", path="/dashboard", body=None, user="52998224725", groups="[unidade:asa-sul papel:farmaceutico]", path_params=None, query=None, sub=None):
    """Evento no formato do HTTP API (payload 2.0) já com claims do autorizador JWT."""
    return {
        "version": "2.0",
        "routeKey": f"{method} {path}",
        "rawPath": path,
        "body": json.dumps(body) if body is not None else None,
        "isBase64Encoded": False,
        "pathParameters": path_params or {},
        "queryStringParameters": query,
        "requestContext": {
            "http": {"method": method, "path": path},
            "authorizer": {"jwt": {"claims": {
                "sub": sub or f"sub-{user}",
                "username": user,
                "token_use": "access",
                "cognito:groups": groups,
            }}},
        },
    }


def body_of(resp):
    return json.loads(resp["body"])


VALID_CLINICAL = {
    "patient": {"cpf": "123.456.789-09", "cns": "", "name": "Maria Teste", "birthDate": "10/05/1990", "sex": "F", "phone": "(61) 99999-0000"},
    "complaint": {"text": "Cefaleia tensional", "code": "CIAP-2 N01", "onset": ""},
    "history": {"allergies": ["Dipirona"], "comorbidities": [], "medications": []},
    "vitals": {"systolic": 120, "diastolic": 80, "heartRate": 72, "spo2": 98, "temperature": 36.5, "weightKg": 70, "heightCm": 175},
    "risk": "azul",
    "redFlags": [],
    "notes": "Observação confidencial",
}
