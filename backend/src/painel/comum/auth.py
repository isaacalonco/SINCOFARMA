"""Identidade de quem chama, a partir das claims validadas pelo autorizador JWT.

Papéis vêm de grupos do Cognito `papel:<nome>` e se somam (quem tem dois papéis tem as
permissões dos dois). A unidade vem do grupo `unidade:<id>`. Esta é a fonte da verdade
das permissões; `src/services/permissoes.js` no front só espelha a tabela para esconder telas.
"""

from dataclasses import dataclass

from .http import HttpError

UNIT_PREFIX = "unidade:"
ROLE_PREFIX = "papel:"
ROLES = ("farmaceutico", "medico", "admin")

# permissão -> papéis que a têm
PERMISSOES: dict[str, frozenset[str]] = {
    # atendimentos com dados do paciente (nome, CPF, queixa), só da própria unidade
    "ver_atendimentos": frozenset({"farmaceutico"}),
    # indicadores agregados, sem dado que identifique paciente
    "ver_indicadores": frozenset({"farmaceutico", "admin"}),
    "criar_triagem": frozenset({"farmaceutico"}),
    # desfecho e Red Flag; além do papel, só quem registrou o atendimento (repositorio.update_visit)
    "alterar_atendimento": frozenset({"farmaceutico"}),
    "sincronizar_rnds": frozenset({"farmaceutico"}),
    # indicadores de qualquer farmácia (gestão do Sincofarma)
    "ver_todas_unidades": frozenset({"admin"}),
    # encaminhamentos: a farmácia vê os que enviou; o médico, só os endereçados a ele
    "ver_encaminhamentos": frozenset({"farmaceutico", "medico"}),
    "criar_encaminhamento": frozenset({"farmaceutico"}),  # também cancela os da própria farmácia
    "responder_encaminhamento": frozenset({"medico"}),
    # cadastrar pessoas, trocar perfil e farmácia, desativar, resetar MFA
    "gerenciar_usuarios": frozenset({"admin"}),
    # registro de auditoria geral (sem dados de paciente)
    "ver_auditoria": frozenset({"admin"}),
    # LGPD: baixar os próprios dados e pedir correção ou exclusão da conta (todo mundo)
    "exercer_direitos": frozenset({"farmaceutico", "medico", "admin"}),
    # LGPD: responder pedidos e exportar os dados de um paciente a pedido dele
    "atender_titulares": frozenset({"admin"}),
}

# papéis que só fazem sentido dentro de uma farmácia
_PAPEIS_DE_UNIDADE = frozenset({"farmaceutico"})


@dataclass(frozen=True)
class Caller:
    sub: str
    username: str
    unit_id: str | None
    roles: frozenset[str]
    groups: tuple[str, ...]

    def pode(self, permissao: str) -> bool:
        return bool(self.roles & PERMISSOES[permissao])

    def exigir(self, permissao: str) -> None:
        if not self.pode(permissao):
            raise HttpError(403, "Seu perfil não tem acesso a esta função.")


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
    roles = frozenset(g[len(ROLE_PREFIX):] for g in groups if g.startswith(ROLE_PREFIX)) & frozenset(ROLES)
    if not roles:
        raise HttpError(403, "Usuário sem perfil de acesso. Procure o administrador.")

    units = [g[len(UNIT_PREFIX):] for g in groups if g.startswith(UNIT_PREFIX)]
    if len(units) > 1:
        raise HttpError(403, "Usuário vinculado a mais de uma unidade. Procure o administrador.")
    if not units and roles & _PAPEIS_DE_UNIDADE:
        raise HttpError(403, "Usuário sem unidade vinculada. Procure o administrador.")

    return Caller(
        sub=str(claims.get("sub", "")),
        username=str(claims.get("username", "")),
        unit_id=units[0] if units else None,
        roles=roles,
        groups=tuple(groups),
    )
