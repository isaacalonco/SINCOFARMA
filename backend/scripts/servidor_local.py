"""Servidor local para testar o front contra o backend real, sem AWS.

- Simula Cognito e DynamoDB em memória (moto).
- Roda as Lambdas de verdade (painel.api) atrás de uma API HTTP local.
- Faz o papel do autorizador JWT: lê as claims do token de acesso e os grupos do usuário.
  (Não valida assinatura: é só para desenvolvimento local.)

Uso:  python scripts/servidor_local.py --porta 3001 --origem http://localhost:5174
Imprime o CLIENT_ID para configurar VITE_COGNITO_CLIENT_ID.
"""

import argparse
import base64
import importlib
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REGION = "sa-east-1"
os.environ.update({
    "AWS_DEFAULT_REGION": REGION,
    "AWS_ACCESS_KEY_ID": "local",
    "AWS_SECRET_ACCESS_KEY": "local",
    "TABELA_PAINEL": "painel-local",
    "TABELA_CLINICO": "clinico-local",
})
os.environ.pop("AWS_PROFILE", None)
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import boto3  # noqa: E402
from botocore.exceptions import ClientError  # noqa: E402
from moto import mock_aws  # noqa: E402

USUARIO = {"cpf": "52998224725", "crf": "4192", "nome": "Dra. Ana Souza", "senha_temporaria": "Temporaria#2026"}


def preparar():
    ddb = boto3.client("dynamodb")
    for name in ("painel-local", "clinico-local"):
        ddb.create_table(
            TableName=name,
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "PK", "AttributeType": "S"}, {"AttributeName": "SK", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}, {"AttributeName": "SK", "KeyType": "RANGE"}],
        )
    boto3.resource("dynamodb").Table("painel-local").put_item(
        Item={"PK": "UNIT#asa-sul", "SK": "PROFILE", "name": "Drogaria Planalto — Asa Sul (local)", "monthGoal": 525, "triageGoalMin": 10}
    )
    idp = boto3.client("cognito-idp")
    # mesma política de senha do template.yaml
    pool = idp.create_user_pool(
        PoolName="local",
        Policies={"PasswordPolicy": {"MinimumLength": 12, "RequireLowercase": True, "RequireUppercase": True, "RequireNumbers": True, "RequireSymbols": False}},
    )["UserPool"]["Id"]
    client = idp.create_user_pool_client(
        UserPoolId=pool,
        ClientName="painel-web",
        GenerateSecret=False,
        ExplicitAuthFlows=["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
    )["UserPoolClient"]["ClientId"]
    # MFA obrigatório por app autenticador, como no template (o moto aceita qualquer código de 6 dígitos)
    idp.set_user_pool_mfa_config(UserPoolId=pool, SoftwareTokenMfaConfiguration={"Enabled": True}, MfaConfiguration="ON")
    idp.create_group(UserPoolId=pool, GroupName="unidade:asa-sul")
    idp.admin_create_user(
        UserPoolId=pool,
        Username=USUARIO["cpf"],
        TemporaryPassword=USUARIO["senha_temporaria"],
        UserAttributes=[{"Name": "name", "Value": USUARIO["nome"]}, {"Name": "custom:crf", "Value": USUARIO["crf"]}],
        MessageAction="SUPPRESS",
    )
    idp.admin_add_user_to_group(UserPoolId=pool, Username=USUARIO["cpf"], GroupName="unidade:asa-sul")
    os.environ["USER_POOL_ID"] = pool
    return idp, pool, client


def claims_do_token(idp, pool, auth_header: str) -> dict | None:
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (IndexError, ValueError):
        return None
    username = claims.get("username") or claims.get("cognito:username")
    if not username:
        return None
    grupos = [g["GroupName"] for g in idp.admin_list_groups_for_user(UserPoolId=pool, Username=username)["Groups"]]
    # mesmo formato que o HTTP API entrega para claims de lista
    return {**claims, "username": username, "token_use": "access", "cognito:groups": "[" + " ".join(grupos) + "]"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--porta", type=int, default=3001)
    parser.add_argument("--origem", default="http://localhost:5174")
    parser.add_argument("--arquivo-client-id", help="grava o CLIENT_ID neste arquivo")
    args = parser.parse_args()

    with mock_aws():
        idp, pool, client_id = preparar()
        api = importlib.import_module("painel.api")
        rotas = {
            ("GET", "dashboard"): api.dashboard,
            ("POST", "visits"): api.criar_visita,
            ("PATCH", "visits"): api.atualizar_visita,
            ("POST", "rnds"): api.sincronizar_rnds,
        }
        cognito_ops = {
            "InitiateAuth": idp.initiate_auth,
            "RespondToAuthChallenge": idp.respond_to_auth_challenge,
            "AssociateSoftwareToken": idp.associate_software_token,
            "VerifySoftwareToken": idp.verify_software_token,
            "RevokeToken": idp.revoke_token,
        }

        class Handler(BaseHTTPRequestHandler):
            def _cors(self):
                self.send_header("Access-Control-Allow-Origin", args.origem)
                self.send_header("Access-Control-Allow-Headers", "authorization, content-type, x-amz-target, x-amz-user-agent")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")

            def _send(self, status, body: str):
                self.send_response(status)
                self._cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(body.encode("utf-8"))

            def do_OPTIONS(self):  # noqa: N802
                self.send_response(204)
                self._cors()
                self.end_headers()

            def _body(self) -> str:
                n = int(self.headers.get("Content-Length") or 0)
                return self.rfile.read(n).decode("utf-8") if n else ""

            def _handle(self, method):
                target = self.headers.get("X-Amz-Target", "")
                if target.startswith("AWSCognitoIdentityProviderService."):
                    op = cognito_ops.get(target.split(".", 1)[1])
                    if not op:
                        return self._send(400, json.dumps({"__type": "UnsupportedOperation", "message": target}))
                    try:
                        resp = op(**json.loads(self._body() or "{}"))
                        resp.pop("ResponseMetadata", None)
                        return self._send(200, json.dumps(resp, default=str))
                    except ClientError as err:
                        e = err.response["Error"]
                        return self._send(400, json.dumps({"__type": e["Code"], "message": e.get("Message", "")}))

                parts = [p for p in self.path.split("?")[0].split("/") if p]
                fn = rotas.get((method, parts[0] if parts else ""))
                if not fn:
                    return self._send(404, json.dumps({"message": "Rota inexistente."}))
                claims = claims_do_token(idp, pool, self.headers.get("Authorization", ""))
                if not claims:
                    return self._send(401, json.dumps({"message": "Unauthorized"}))
                event = {
                    "body": self._body() or None,
                    "isBase64Encoded": False,
                    "pathParameters": {"id": parts[1]} if len(parts) > 1 else {},
                    "requestContext": {"http": {"method": method}, "authorizer": {"jwt": {"claims": claims}}},
                }
                result = fn(event, None)
                self._send(result["statusCode"], result["body"])

            def do_GET(self):  # noqa: N802
                self._handle("GET")

            def do_POST(self):  # noqa: N802
                self._handle("POST")

            def do_PATCH(self):  # noqa: N802
                self._handle("PATCH")

            def log_message(self, fmt, *a):
                sys.stderr.write("[local] " + (fmt % a) + "\n")

        if args.arquivo_client_id:
            Path(args.arquivo_client_id).write_text(client_id, encoding="utf-8")
        print(f"CLIENT_ID={client_id}", flush=True)
        print(f"Usuário: CPF {USUARIO['cpf']} / senha temporária {USUARIO['senha_temporaria']}", flush=True)
        print(f"Ouvindo em http://localhost:{args.porta}", flush=True)
        ThreadingHTTPServer(("127.0.0.1", args.porta), Handler).serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
