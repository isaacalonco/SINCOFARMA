"""Identidade de quem chama, a partir das claims validadas pelo autorizador JWT."""

from dataclasses import dataclass

from .http import HttpError

UNIT_PREFIX = "unidade:"


@dataclass(frozen=True)
class Caller:
    sub: str
    username: str
    unit_id: str
    groups: tuple[str, ...]


def _parse_groups(raw) -> list[str]:
    # O HTTP API entrega claims de lista como texto: "[a b]" ou "[a, b]".
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(g) for g in raw]
    text = str(raw).strip()
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]
    return [g for g in text.replace(",", " ").split() if g]


def caller_from_event(event: dict) -> Caller:
    try:
        claims = event["requestContext"]["authorizer"]["jwt"]["claims"]
    except (KeyError, TypeError) as exc:
        # nunca deveria acontecer atras do autorizador; recusa por seguranca
        raise HttpError(401, "Não autenticado.") from exc

    if claims.get("token_use") not in (None, "access"):
        raise HttpError(401, "Use o token de acesso.")

    groups = _parse_groups(claims.get("cognito:groups"))
    units = [g[len(UNIT_PREFIX):] for g in groups if g.startswith(UNIT_PREFIX)]
    if len(units) != 1:
        raise HttpError(403, "Usuário sem unidade vinculada. Procure o administrador.")

    return Caller(
        sub=str(claims.get("sub", "")),
        username=str(claims.get("username", "")),
        unit_id=units[0],
        groups=tuple(groups),
    )
