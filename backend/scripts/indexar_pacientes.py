"""Cria o índice por CPF (PAC#<cpf>) dos atendimentos e encaminhamentos que já existiam.

Os registros novos já gravam o índice na hora (src/painel/comum/repositorio.py e
encaminhamentos.py). Este script é de uso único, depois do deploy da LGPD, para os antigos:
sem ele, "Exportar dados de um paciente" não acha o que foi registrado antes.
Pode rodar mais de uma vez: só regrava os mesmos itens.

  python scripts/indexar_pacientes.py --stack sincofarma-painel-prod --profile sincofarma
  python scripts/indexar_pacientes.py --stack sincofarma-painel-prod --profile sincofarma --simular
"""

import argparse
import sys

import boto3

from cadastrar import stack_outputs


def varrer(table, **kw):
    start = None
    while True:
        resp = table.scan(**kw, **({"ExclusiveStartKey": start} if start else {}))
        yield from resp.get("Items", [])
        start = resp.get("LastEvaluatedKey")
        if not start:
            return


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--stack", required=True)
    parser.add_argument("--profile", help="perfil da AWS CLI (opcional)")
    parser.add_argument("--region", default="sa-east-1")
    parser.add_argument("--simular", action="store_true", help="só conta, não grava nada")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    table = session.resource("dynamodb").Table(outputs["TabelaClinico"])

    # 1) atendimentos: o CPF completo está no registro clínico
    cpf_da_visita: dict[str, str] = {}
    indices = []
    for rec in varrer(table, ProjectionExpression="PK, SK, patient, #u, #a", ExpressionAttributeNames={"#u": "unit", "#a": "at"}):
        if rec["SK"] != "RECORD" or not rec["PK"].startswith("VISIT#"):
            continue
        visit_id = rec["PK"][len("VISIT#"):]
        cpf = (rec.get("patient") or {}).get("cpf")
        if not cpf:
            continue
        cpf_da_visita[visit_id] = cpf
        indices.append({"PK": f"PAC#{cpf}", "SK": f"VISIT#{visit_id}", "unit": rec.get("unit"), "at": rec.get("at")})

    # 2) encaminhamentos: guardam o CPF mascarado; o completo vem do atendimento de origem
    sem_origem = 0
    for ref in varrer(table, ProjectionExpression="PK, SK, visitId, #u, createdAt", ExpressionAttributeNames={"#u": "unit"}):
        if ref["SK"] != "REF" or not ref["PK"].startswith("REF#"):
            continue
        cpf = cpf_da_visita.get(ref.get("visitId"))
        if not cpf:
            sem_origem += 1
            continue
        indices.append({"PK": f"PAC#{cpf}", "SK": f"REF#{ref['PK'][len('REF#'):]}", "unit": ref.get("unit"), "at": ref.get("createdAt")})

    print(f"{len(cpf_da_visita)} atendimentos e {len(indices) - len(cpf_da_visita)} encaminhamentos para indexar"
          + (f"; {sem_origem} encaminhamentos sem atendimento de origem" if sem_origem else ""))
    if args.simular:
        print("Simulação: nada foi gravado.")
        return 0
    with table.batch_writer() as batch:
        for item in indices:
            batch.put_item(Item=item)
    print("Índice gravado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
