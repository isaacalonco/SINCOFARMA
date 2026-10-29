"""Gestão de usuários pela administração (grupos do Cognito `papel:*` e `unidade:*`).

O id público de cada usuário é o `sub` do Cognito; o CPF (login) só aparece mascarado.
Toda mudança vai para o registro de auditoria geral.
"""

import os

from . import auditoria
from . import repositorio as repo
from .auth import ROLE_PREFIX, UNIT_PREFIX
from .http import HttpError

ROLE_NAMES = {"farmaceutico": "Farmacêutico", "medico": "Médico", "admin": "Administrador Sincofarma"}


def _pool() -> str:
    return os.environ["USER_POOL_ID"]


def _paginate(method, key: str, **kw):
    token = None
    while True:
        resp = method(**kw, **({"NextToken": token} if token else {}))
        yield from resp.get(key, [])
        token = resp.get("NextToken")
        if not token:
            return


def mask_cpf(username: str) -> str:
    d = "".join(c for c in username if c.isdigit())
    return f"***.{d[3:6]}.{d[6:9]}-**" if len(d) == 11 else "***"


def _attrs(user: dict) -> dict:
    return {a["Name"]: a["Value"] for a in user.get("Attributes", user.get("UserAttributes", []))}


def _memberships() -> dict[str, list[str]]:
    """username -> grupos, lendo grupo a grupo (poucas chamadas mesmo com muitos usuários)."""
    out: dict[str, list[str]] = {}
    groups = [g["GroupName"] for g in _paginate(repo._cognito.list_groups, "Groups", UserPoolId=_pool(), Limit=60)]
    for group in groups:
        for u in _paginate(repo._cognito.list_users_in_group, "Users", UserPoolId=_pool(), GroupName=group, Limit=60):
            out.setdefault(u["Username"], []).append(group)
    return out


def _public(user: dict, groups: list[str]) -> dict:
    a = _attrs(user)
    units = [g[len(UNIT_PREFIX):] for g in groups if g.startswith(UNIT_PREFIX)]
    return {
        "id": a.get("sub"),
        "name": a.get("name") or "(sem nome)",
        "email": a.get("email"),
        "cpf": mask_cpf(user["Username"]),
        "crf": a.get("custom:crf"),
        "roles": sorted(g[len(ROLE_PREFIX):] for g in groups if g.startswith(ROLE_PREFIX)),
        "unit": units[0] if len(units) == 1 else None,
        "enabled": user.get("Enabled", True),
        # FORCE_CHANGE_PASSWORD = ainda não fez o primeiro acesso
        "pending": user.get("UserStatus") == "FORCE_CHANGE_PASSWORD",
        "createdAt": user["UserCreateDate"].isoformat() if user.get("UserCreateDate") else None,
    }


def _all_raw() -> list[dict]:
    return list(_paginate(repo._cognito.list_users, "Users", UserPoolId=_pool(), Limit=60))


def list_all() -> list[dict]:
    members = _memberships()
    users = [_public(u, members.get(u["Username"], [])) for u in _all_raw()]
    return sorted(users, key=lambda u: repo._sem_acento(u["name"]))


def names_by_sub() -> dict[str, str]:
    """Para a auditoria mostrar nomes no lugar de ids."""
    return {(_attrs(u).get("sub")): _attrs(u).get("name") or "(sem nome)" for u in _all_raw()}


def _find(sub: str) -> dict:
    for u in _all_raw():
        if _attrs(u).get("sub") == sub:
            return u
    raise HttpError(404, "Usuário não encontrado.")


def _ensure_group(name: str, description: str) -> None:
    try:
        repo._cognito.create_group(UserPoolId=_pool(), GroupName=name, Description=description)
    except repo._cognito.exceptions.GroupExistsException:
        pass


def _check_unit(unit: str) -> None:
    profile = repo.unit_profile(unit)
    if not profile["exists"]:
        raise HttpError(422, "Farmácia não encontrada.", {"fields": {"unit": "Escolha uma farmácia cadastrada."}})
    _ensure_group(f"{UNIT_PREFIX}{unit}", profile["name"])


def create(caller, data: dict) -> dict:
    if data["unit"]:
        _check_unit(data["unit"])
    attrs = [
        {"Name": "name", "Value": data["name"]},
        {"Name": "email", "Value": data["email"]},
        {"Name": "email_verified", "Value": "true"},
    ]
    if data["crf"]:
        attrs += [{"Name": "preferred_username", "Value": f"crf{data['crf']}"}, {"Name": "custom:crf", "Value": data["crf"]}]
    try:
        user = repo._cognito.admin_create_user(
            UserPoolId=_pool(), Username=data["cpf"], UserAttributes=attrs, DesiredDeliveryMediums=["EMAIL"]
        )["User"]
    except repo._cognito.exceptions.UsernameExistsException as exc:
        raise HttpError(409, "Já existe um usuário com este CPF.", {"fields": {"cpf": "Já cadastrado."}}) from exc
    except repo._cognito.exceptions.AliasExistsException as exc:
        raise HttpError(409, "Este CRF já está em uso por outro usuário.", {"fields": {"crf": "Já cadastrado."}}) from exc
    groups = []
    for role in data["roles"]:
        _ensure_group(f"{ROLE_PREFIX}{role}", ROLE_NAMES[role])
        groups.append(f"{ROLE_PREFIX}{role}")
    if data["unit"]:
        groups.append(f"{UNIT_PREFIX}{data['unit']}")
    for g in groups:
        repo._cognito.admin_add_user_to_group(UserPoolId=_pool(), Username=data["cpf"], GroupName=g)
    public = _public(user, groups)
    auditoria.record("user_create", caller, unit=data["unit"], target={"type": "user", "id": public["id"], "label": public["name"]},
                     details={"roles": data["roles"]})
    return public


def update(caller, sub: str, data: dict) -> dict:
    user = _find(sub)
    username = user["Username"]
    current = repo._cognito.admin_list_groups_for_user(UserPoolId=_pool(), Username=username)["Groups"]
    groups = [g["GroupName"] for g in current]
    roles = data.get("roles")
    if sub == caller.sub:
        # ninguém se tranca para fora: a própria conta não perde o admin nem é desativada
        if data.get("enabled") is False or (roles is not None and "admin" not in roles):
            raise HttpError(422, "Você não pode desativar a própria conta nem tirar o próprio perfil de administração.")
    final_roles = roles if roles is not None else [g[len(ROLE_PREFIX):] for g in groups if g.startswith(ROLE_PREFIX)]
    final_unit = data["unit"] if "unit" in data else next((g[len(UNIT_PREFIX):] for g in groups if g.startswith(UNIT_PREFIX)), None)
    if "farmaceutico" in final_roles and not final_unit:
        raise HttpError(422, "Farmacêutico precisa de uma farmácia.", {"fields": {"unit": "Obrigatória para farmacêutico."}})
    if "farmaceutico" in final_roles and not _attrs(user).get("custom:crf"):
        raise HttpError(422, "Este usuário não tem CRF cadastrado; não pode ser farmacêutico.", {"fields": {"roles": "Sem CRF."}})

    changes: dict = {}
    idp = repo._cognito
    if roles is not None:
        for role in set(final_roles) - {g[len(ROLE_PREFIX):] for g in groups if g.startswith(ROLE_PREFIX)}:
            _ensure_group(f"{ROLE_PREFIX}{role}", ROLE_NAMES[role])
            idp.admin_add_user_to_group(UserPoolId=_pool(), Username=username, GroupName=f"{ROLE_PREFIX}{role}")
        for g in groups:
            if g.startswith(ROLE_PREFIX) and g[len(ROLE_PREFIX):] not in final_roles:
                idp.admin_remove_user_from_group(UserPoolId=_pool(), Username=username, GroupName=g)
        changes["roles"] = final_roles
    if "unit" in data:
        if final_unit:
            _check_unit(final_unit)
        for g in groups:
            if g.startswith(UNIT_PREFIX) and g != f"{UNIT_PREFIX}{final_unit}":
                idp.admin_remove_user_from_group(UserPoolId=_pool(), Username=username, GroupName=g)
        if final_unit and f"{UNIT_PREFIX}{final_unit}" not in groups:
            idp.admin_add_user_to_group(UserPoolId=_pool(), Username=username, GroupName=f"{UNIT_PREFIX}{final_unit}")
        changes["unit"] = final_unit
    sign_out = bool(changes)  # perfil ou farmácia mudou: o próximo token já vem certo
    if data.get("enabled") is False:
        idp.admin_disable_user(UserPoolId=_pool(), Username=username)
        changes["enabled"], sign_out = False, True
    elif data.get("enabled") is True:
        idp.admin_enable_user(UserPoolId=_pool(), Username=username)
        changes["enabled"] = True
    if data.get("resetMfa"):
        # sem app autenticador ativo, o próximo login pede o QR code de novo
        idp.admin_set_user_mfa_preference(
            UserPoolId=_pool(), Username=username, SoftwareTokenMfaSettings={"Enabled": False, "PreferredMfa": False}
        )
        changes["resetMfa"], sign_out = True, True
    if data.get("resendInvite"):
        if user.get("UserStatus") != "FORCE_CHANGE_PASSWORD":
            raise HttpError(422, "Este usuário já fez o primeiro acesso; o convite não pode ser reenviado.")
        idp.admin_create_user(UserPoolId=_pool(), Username=username, MessageAction="RESEND", DesiredDeliveryMediums=["EMAIL"])
        changes["resendInvite"] = True
    if sign_out and changes.get("enabled") is not True:
        idp.admin_user_global_sign_out(UserPoolId=_pool(), Username=username)

    fresh = repo._cognito.admin_get_user(UserPoolId=_pool(), Username=username)
    fresh_groups = [g["GroupName"] for g in idp.admin_list_groups_for_user(UserPoolId=_pool(), Username=username)["Groups"]]
    public = _public({**fresh, "Attributes": fresh.get("UserAttributes", [])}, fresh_groups)
    auditoria.record("user_update", caller, unit=final_unit, target={"type": "user", "id": sub, "label": public["name"]}, details=changes)
    return public
