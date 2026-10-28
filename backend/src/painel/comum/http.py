"""Respostas HTTP, leitura do corpo e tratamento de erro padrao das Lambdas."""

import base64
import functools
import json
import logging
from decimal import Decimal

log = logging.getLogger()
log.setLevel(logging.INFO)

MAX_BODY = 64 * 1024


class HttpError(Exception):
    """Erro esperado: vira uma resposta com o status e a mensagem dados."""

    def __init__(self, status: int, message: str, details: dict | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.details = details or {}


def _json_default(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, set):
        return sorted(value)
    raise TypeError(f"tipo nao serializavel: {type(value).__name__}")


def response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"},
        "body": json.dumps(body, default=_json_default, ensure_ascii=False),
    }


def parse_json(event: dict) -> dict:
    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    if len(raw) > MAX_BODY:
        raise HttpError(413, "Requisição grande demais.")
    try:
        # Decimal: o DynamoDB nao aceita float
        data = json.loads(raw or "{}", parse_float=Decimal)
    except json.JSONDecodeError as exc:
        raise HttpError(400, "JSON inválido.") from exc
    if not isinstance(data, dict):
        raise HttpError(400, "O corpo deve ser um objeto JSON.")
    return data


def handler(fn):
    """Envolve o handler: HttpError vira resposta; o resto vira 500 com log."""

    @functools.wraps(fn)
    def wrapper(event, context):
        try:
            status, body = fn(event, context)
            return response(status, body)
        except HttpError as err:
            log.info(json.dumps({"evento": "http_error", "status": err.status, "mensagem": err.message}))
            return response(err.status, {"message": err.message, **({"details": err.details} if err.details else {})})
        except Exception:  # noqa: BLE001 - ultima barreira antes do cliente
            log.exception("erro inesperado")
            return response(500, {"message": "Erro interno. Tente novamente em instantes."})

    return wrapper
