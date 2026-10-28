"""Cadastro administrativo: cria/atualiza uma unidade e cria um farmacêutico nela.

O farmacêutico recebe por e-mail uma senha temporária (enviada pelo Cognito)
e define a senha definitiva no primeiro login do painel.

Exemplos:
  python scripts/cadastrar.py unidade --stack sincofarma-painel-dev \\
      --id asa-sul --nome "Drogaria Planalto - Asa Sul" --meta-mensal 525

  python scripts/cadastrar.py usuario --stack sincofarma-painel-dev \\
      --unidade asa-sul --cpf 52998224725 --crf 4192 \\
      --nome "Dra. Ana Souza" --email ana@exemplo.com.br
"""

import argparse
import re
import sys

import boto3
from botocore.exceptions import ClientError

UNIT_PREFIX = "unidade:"


def stack_outputs(cf, stack: str) -> dict[str, str]:
    resp = cf.describe_stacks(StackName=stack)
    return {o["OutputKey"]: o["OutputValue"] for o in resp["Stacks"][0].get("Outputs", [])}


def digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def cmd_unidade(session, args) -> None:
    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    table = session.resource("dynamodb").Table(outputs["TabelaPainel"])
    table.put_item(
        Item={
            "PK": f"UNIT#{args.id}",
            "SK": "PROFILE",
            "name": args.nome,
            "monthGoal": args.meta_mensal,
            "triageGoalMin": args.meta_triagem,
        }
    )
    idp = session.client("cognito-idp")
    group = f"{UNIT_PREFIX}{args.id}"
    try:
        idp.create_group(UserPoolId=outputs["UserPoolId"], GroupName=group, Description=args.nome)
    except idp.exceptions.GroupExistsException:
        pass  # idempotente: rodar de novo só atualiza o perfil
    print(f"Unidade '{args.id}' pronta (grupo {group}).")


def cmd_usuario(session, args) -> None:
    cpf = digits(args.cpf)
    if len(cpf) != 11:
        raise ValueError("CPF deve ter 11 dígitos.")
    crf = digits(args.crf)
    if not crf:
        raise ValueError("CRF deve conter números.")

    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    pool = outputs["UserPoolId"]
    idp = session.client("cognito-idp")
    group = f"{UNIT_PREFIX}{args.unidade}"
    try:
        idp.get_group(UserPoolId=pool, GroupName=group)
    except idp.exceptions.ResourceNotFoundException as exc:
        raise ValueError(f"Unidade '{args.unidade}' não existe. Crie com o comando 'unidade'.") from exc

    idp.admin_create_user(
        UserPoolId=pool,
        Username=cpf,  # login pelo CPF...
        UserAttributes=[
            {"Name": "preferred_username", "Value": f"crf{crf}"},  # ...ou pelo CRF
            {"Name": "name", "Value": args.nome},
            {"Name": "email", "Value": args.email},
            {"Name": "email_verified", "Value": "true"},
            {"Name": "custom:crf", "Value": crf},
        ],
        DesiredDeliveryMediums=["EMAIL"],  # Cognito envia a senha temporária
    )
    idp.admin_add_user_to_group(UserPoolId=pool, Username=cpf, GroupName=group)
    print(f"Usuário {args.nome} criado na unidade '{args.unidade}'. A senha temporária foi enviada para {args.email}.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--profile", help="perfil da AWS CLI (opcional)")
    parser.add_argument("--region", default="sa-east-1")
    sub = parser.add_subparsers(dest="cmd", required=True)

    u = sub.add_parser("unidade", help="cria ou atualiza uma unidade")
    u.add_argument("--stack", required=True)
    u.add_argument("--id", required=True, help="identificador curto, ex. asa-sul")
    u.add_argument("--nome", required=True)
    u.add_argument("--meta-mensal", type=int, default=0)
    u.add_argument("--meta-triagem", type=int, default=10, help="minutos")

    p = sub.add_parser("usuario", help="cria um farmacêutico numa unidade")
    p.add_argument("--stack", required=True)
    p.add_argument("--unidade", required=True)
    p.add_argument("--cpf", required=True)
    p.add_argument("--crf", required=True)
    p.add_argument("--nome", required=True)
    p.add_argument("--email", required=True)

    args = parser.parse_args()
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    try:
        {"unidade": cmd_unidade, "usuario": cmd_usuario}[args.cmd](session, args)
        return 0
    except ValueError as err:
        print(f"Erro: {err}", file=sys.stderr)
        return 2
    except ClientError as err:
        print(f"Erro da AWS: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
