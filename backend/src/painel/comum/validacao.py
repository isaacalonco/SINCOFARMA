"""Validacao das requisicoes. Espelha as regras do formulario, mas e a fonte da verdade:
o servidor nao confia em nada calculado no navegador (urgencia, sinais, CPF anonimizado)."""

import re
from datetime import date
from decimal import Decimal, InvalidOperation

from .http import HttpError
from .tempo import now, parse_br_date

STATUSES = ("done", "referred", "progress")
RISKS = ("azul", "verde", "amarelo", "laranja", "vermelho")
URGENT_RISKS = {"laranja", "vermelho"}
RED_FLAGS = ("Dor torácica", "Dispneia", "Déficit neurológico", "Síncope")
SEXES = ("F", "M")

RANGES = {
    "systolic": (60, 260),
    "diastolic": (30, 160),
    "heartRate": (20, 250),
    "spo2": (50, 100),
    "temperature": (30, 45),
    "weightKg": (1, 400),
    "heightCm": (30, 250),
}

MAX_LIST = 30
MAX_ITEM = 120
VISIT_ID = re.compile(r"^\d{13}-[0-9a-f]{8}$")


class Erros:
    """Acumula erros por campo e falha de uma vez (mensagens uteis para o cliente)."""

    def __init__(self):
        self.campos: dict[str, str] = {}

    def add(self, campo: str, msg: str):
        self.campos.setdefault(campo, msg)

    def raise_if_any(self):
        if self.campos:
            raise HttpError(422, "Dados inválidos.", {"fields": self.campos})


def only_digits(value) -> str:
    return re.sub(r"\D", "", str(value or ""))


def is_valid_cpf(value) -> bool:
    d = only_digits(value)
    if len(d) != 11 or d == d[0] * 11:
        return False

    def check(n: int) -> int:
        total = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        r = (total * 10) % 11
        return 0 if r == 10 else r

    return check(9) == int(d[9]) and check(10) == int(d[10])


def anonymize_cpf(value) -> str:
    d = only_digits(value)
    return f"***.***.***-{d[9:]}" if len(d) == 11 else "***.***.***-**"


def _text(obj: dict, key: str, erros: Erros, campo: str, *, required: bool, min_len: int = 1, max_len: int = 200) -> str | None:
    value = obj.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            erros.add(campo, "Obrigatório.")
        return None
    if not isinstance(value, str):
        erros.add(campo, "Deve ser texto.")
        return None
    value = " ".join(value.split())
    if len(value) < min_len:
        erros.add(campo, f"Mínimo de {min_len} caracteres.")
    if len(value) > max_len:
        erros.add(campo, f"Máximo de {max_len} caracteres.")
    return value


def _number(obj: dict, key: str, erros: Erros, campo: str, *, required: bool) -> Decimal | None:
    value = obj.get(key)
    if value is None or value == "":
        if required:
            erros.add(campo, "Obrigatório.")
        return None
    if isinstance(value, bool):
        erros.add(campo, "Deve ser número.")
        return None
    try:
        n = Decimal(str(value).replace(",", "."))
    except InvalidOperation:
        erros.add(campo, "Deve ser número.")
        return None
    lo, hi = RANGES[key]
    if not (lo <= n <= hi):
        erros.add(campo, f"Entre {lo} e {hi}.")
        return None
    return n


def _str_list(obj: dict, key: str, erros: Erros, campo: str, *, allowed: tuple[str, ...] | None = None) -> list[str]:
    value = obj.get(key) or []
    if not isinstance(value, list) or len(value) > MAX_LIST:
        erros.add(campo, f"Lista de até {MAX_LIST} itens.")
        return []
    out: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip() or len(item) > MAX_ITEM:
            erros.add(campo, f"Itens de texto com até {MAX_ITEM} caracteres.")
            return []
        item = " ".join(item.split())
        if allowed is not None and item not in allowed:
            erros.add(campo, "Item não reconhecido.")
            return []
        if item.lower() not in {o.lower() for o in out}:
            out.append(item)
    return out


def _br_date(obj: dict, key: str, erros: Erros, campo: str, *, required: bool) -> date | None:
    value = obj.get(key)
    if not value:
        if required:
            erros.add(campo, "Obrigatório.")
        return None
    d = parse_br_date(value) if isinstance(value, str) else None
    if d is None:
        erros.add(campo, "Data inválida (dd/mm/aaaa).")
        return None
    if d > now().date():
        erros.add(campo, "Data no futuro.")
        return None
    return d


def _fmt(n: Decimal) -> str:
    """Numero no formato brasileiro, sem zeros desnecessarios: 36.50 -> '36,5'."""
    text = format(n.normalize(), "f")
    return text.replace(".", ",")


def format_signs(v: dict) -> str:
    parts = []
    if v.get("systolic") is not None and v.get("diastolic") is not None:
        parts.append(f"PA {_fmt(v['systolic'])}/{_fmt(v['diastolic'])} mmHg")
    if v.get("heartRate") is not None:
        parts.append(f"FC {_fmt(v['heartRate'])} bpm")
    if v.get("spo2") is not None:
        parts.append(f"SpO2 {_fmt(v['spo2'])}%")
    if v.get("temperature") is not None:
        parts.append(f"Tax {_fmt(v['temperature'])} °C")
    return " · ".join(parts)


def bmi(weight: Decimal | None, height_cm: Decimal | None) -> Decimal | None:
    if not weight or not height_cm:
        return None
    m = height_cm / Decimal(100)
    return (weight / (m * m)).quantize(Decimal("0.1"))


def validar_criacao(body: dict) -> tuple[dict, dict, int]:
    """Valida o POST /visits. Retorna (resumo, clinico, duracao_segundos).

    O resumo e derivado do bloco clinico no servidor; campos de resumo
    enviados pelo cliente (urgent, signs, cpf anonimizado...) sao ignorados.
    """
    erros = Erros()
    clinical = body.get("clinical")
    if not isinstance(clinical, dict):
        raise HttpError(422, "Dados clínicos ausentes.", {"fields": {"clinical": "Obrigatório."}})

    patient = clinical.get("patient") if isinstance(clinical.get("patient"), dict) else {}
    complaint = clinical.get("complaint") if isinstance(clinical.get("complaint"), dict) else {}
    history = clinical.get("history") if isinstance(clinical.get("history"), dict) else {}
    vitals_in = clinical.get("vitals") if isinstance(clinical.get("vitals"), dict) else {}

    # paciente
    cpf = only_digits(patient.get("cpf"))
    if not is_valid_cpf(cpf):
        erros.add("cpf", "CPF inválido.")
    name = _text(patient, "name", erros, "nome", required=True, min_len=3, max_len=120)
    if name and len(name.split()) < 2:
        erros.add("nome", "Informe nome e sobrenome.")
    birth = _br_date(patient, "birthDate", erros, "nascimento", required=True)
    sex = patient.get("sex")
    if sex not in SEXES:
        erros.add("sexo", "Selecione o sexo.")
    cns = only_digits(patient.get("cns")) or None
    if cns and len(cns) != 15:
        erros.add("cns", "CNS deve ter 15 dígitos.")
    phone = only_digits(patient.get("phone")) or None
    if phone and len(phone) not in (10, 11):
        erros.add("telefone", "Telefone com DDD (10 ou 11 dígitos).")

    # queixa
    complaint_text = _text(complaint, "text", erros, "queixa", required=True, min_len=3, max_len=300)
    code = _text(complaint, "code", erros, "codigo", required=False, max_len=80)
    onset = _br_date(complaint, "onset", erros, "inicioSintomas", required=False)
    if onset and birth and onset < birth:
        erros.add("inicioSintomas", "Anterior ao nascimento.")

    # histórico
    allergies = _str_list(history, "allergies", erros, "alergias")
    comorbidities = _str_list(history, "comorbidities", erros, "comorbidades")
    medications = _str_list(history, "medications", erros, "medicamentos")

    # sinais vitais
    vitals = {
        "systolic": _number(vitals_in, "systolic", erros, "paSis", required=True),
        "diastolic": _number(vitals_in, "diastolic", erros, "paDia", required=True),
        "heartRate": _number(vitals_in, "heartRate", erros, "fc", required=True),
        "spo2": _number(vitals_in, "spo2", erros, "spo2", required=True),
        "temperature": _number(vitals_in, "temperature", erros, "temp", required=False),
        "weightKg": _number(vitals_in, "weightKg", erros, "peso", required=False),
        "heightCm": _number(vitals_in, "heightCm", erros, "altura", required=False),
    }
    if vitals["systolic"] is not None and vitals["diastolic"] is not None and vitals["diastolic"] >= vitals["systolic"]:
        erros.add("paDia", "Diastólica deve ser menor que a sistólica.")

    risk = clinical.get("risk")
    if risk not in RISKS:
        erros.add("risco", "Selecione a classificação de risco.")
    red_flags = _str_list(clinical, "redFlags", erros, "redFlags", allowed=RED_FLAGS)
    notes = _text(clinical, "notes", erros, "observacoes", required=False, max_len=500)

    status = body.get("status", "progress")
    if status not in STATUSES:
        erros.add("status", "Desfecho inválido.")

    duration = body.get("durationSec")
    try:
        duration = int(duration) if duration is not None else 0
    except (TypeError, ValueError):
        duration = 0
    duration = duration if 0 < duration <= 3 * 3600 else 0  # fora disso: ignora (aba esquecida aberta)

    erros.raise_if_any()

    clinical_out = {
        "patient": {"cpf": cpf, "cns": cns, "name": name, "birthDate": birth.isoformat(), "sex": sex, "phone": phone},
        "complaint": {"text": complaint_text, "code": code, "onset": onset.isoformat() if onset else None},
        "history": {"allergies": allergies, "comorbidities": comorbidities, "medications": medications},
        "vitals": {**vitals, "bmi": bmi(vitals["weightKg"], vitals["heightCm"])},
        "risk": risk,
        "redFlags": red_flags,
        "notes": notes,
    }
    summary = {
        "name": name,
        "cpf": anonymize_cpf(cpf),
        "complaint": complaint_text,
        "signs": format_signs(vitals),
        "risk": risk,
        "redFlags": red_flags,
        "status": status,
        "urgent": risk in URGENT_RISKS or bool(red_flags),
    }
    return summary, clinical_out, duration


def validar_atualizacao(visit_id: str, body: dict) -> dict:
    """Valida o PATCH /visits/{id}: só desfecho e Red Flag podem mudar."""
    if not VISIT_ID.match(visit_id or ""):
        raise HttpError(404, "Atendimento não encontrado.")
    extra = set(body) - {"status", "urgent"}
    if extra:
        raise HttpError(422, "Campos não permitidos.", {"fields": {k: "Não editável." for k in sorted(extra)}})
    patch = {}
    if "status" in body:
        if body["status"] not in STATUSES:
            raise HttpError(422, "Desfecho inválido.", {"fields": {"status": "Desfecho inválido."}})
        patch["status"] = body["status"]
    if "urgent" in body:
        if not isinstance(body["urgent"], bool):
            raise HttpError(422, "Red Flag inválida.", {"fields": {"urgent": "Deve ser verdadeiro ou falso."}})
        patch["urgent"] = body["urgent"]
    if not patch:
        raise HttpError(422, "Nada para atualizar.")
    return patch


# ---------------------------------------------------------------- encaminhamentos

PRIORITIES = ("rotina", "urgente")
REFERRAL_STATUSES = ("sent", "read", "answered", "declined", "cancelled")
SUB = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")  # sub do Cognito


def validar_encaminhamento(body: dict) -> dict:
    """POST /encaminhamentos: atendimento, médico, motivo e prioridade."""
    erros = Erros()
    visit_id = body.get("visitId")
    if not isinstance(visit_id, str) or not VISIT_ID.match(visit_id):
        erros.add("visitId", "Atendimento inválido.")
    doctor = body.get("doctorId")
    if not isinstance(doctor, str) or not SUB.match(doctor):
        erros.add("doctorId", "Médico inválido.")
    reason = _text(body, "reason", erros, "reason", required=True, min_len=5, max_len=1000)
    priority = body.get("priority", "rotina")
    if priority not in PRIORITIES:
        erros.add("priority", "Prioridade inválida (rotina ou urgente).")
    erros.raise_if_any()
    return {"visitId": visit_id, "doctorId": doctor, "reason": reason, "priority": priority}


def validar_mudanca_encaminhamento(ref_id: str, body: dict) -> dict:
    """PATCH /encaminhamentos/{id}: responder, recusar ou cancelar."""
    if not VISIT_ID.match(ref_id or ""):
        raise HttpError(404, "Encaminhamento não encontrado.")
    extra = set(body) - {"status", "response"}
    if extra:
        raise HttpError(422, "Campos não permitidos.", {"fields": {k: "Não editável." for k in sorted(extra)}})
    erros = Erros()
    status = body.get("status")
    if status not in ("answered", "declined", "cancelled"):
        erros.add("status", "Use answered, declined ou cancelled.")
    response = _text(body, "response", erros, "response", required=status in ("answered", "declined"), min_len=2, max_len=2000)
    erros.raise_if_any()
    return {"status": status, "response": response}


# ---------------------------------------------------------------- usuários (administração)

ROLES = ("farmaceutico", "medico", "admin")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
UNIT_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")


def _roles(value, erros: Erros) -> list[str] | None:
    if not isinstance(value, list) or not value or any(r not in ROLES for r in value):
        erros.add("roles", "Escolha ao menos um perfil: farmaceutico, medico ou admin.")
        return None
    return sorted(set(value))


def _unit(value, erros: Erros) -> str | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str) or not UNIT_ID.match(value):
        erros.add("unit", "Farmácia inválida.")
        return None
    return value


def validar_usuario(body: dict) -> dict:
    """POST /usuarios: CPF (login), nome, e-mail, perfis, farmácia e CRF quando farmacêutico."""
    erros = Erros()
    cpf = only_digits(body.get("cpf"))
    if not is_valid_cpf(cpf):
        erros.add("cpf", "CPF inválido.")
    name = _text(body, "name", erros, "name", required=True, min_len=3, max_len=120)
    email = _text(body, "email", erros, "email", required=True, max_len=200)
    if email and not EMAIL.match(email):
        erros.add("email", "E-mail inválido.")
    roles = _roles(body.get("roles"), erros)
    unit = _unit(body.get("unit"), erros)
    crf = only_digits(body.get("crf"))
    if roles and "farmaceutico" in roles:
        if not unit:
            erros.add("unit", "Farmacêutico precisa de uma farmácia.")
        if not crf or len(crf) > 10:
            erros.add("crf", "CRF obrigatório para farmacêutico (só números).")
    erros.raise_if_any()
    return {"cpf": cpf, "name": name, "email": email.lower(), "roles": roles, "unit": unit, "crf": crf or None}


def validar_mudanca_usuario(body: dict) -> dict:
    """PATCH /usuarios/{id}: perfis, farmácia, ativo, reset do MFA ou reenvio do convite."""
    allowed = {"roles", "unit", "enabled", "resetMfa", "resendInvite"}
    extra = set(body) - allowed
    if extra:
        raise HttpError(422, "Campos não permitidos.", {"fields": {k: "Não editável." for k in sorted(extra)}})
    if not body:
        raise HttpError(422, "Nada para atualizar.")
    erros = Erros()
    out: dict = {}
    if "roles" in body:
        out["roles"] = _roles(body["roles"], erros)
    if "unit" in body:
        out["unit"] = _unit(body["unit"], erros)
    for flag in ("enabled", "resetMfa", "resendInvite"):
        if flag in body:
            if not isinstance(body[flag], bool):
                erros.add(flag, "Deve ser verdadeiro ou falso.")
            out[flag] = body[flag]
    erros.raise_if_any()
    return out


# ---------------------------------------------------------------- LGPD

LGPD_TIPOS = ("correcao", "exclusao")
LGPD_RESPOSTAS = ("concluido", "recusado")


def validar_pedido_lgpd(body: dict) -> dict:
    """POST /me/pedidos: tipo e o que corrigir (a exclusão pode vir sem texto)."""
    erros = Erros()
    tipo = body.get("type")
    if tipo not in LGPD_TIPOS:
        erros.add("type", "Escolha correção ou exclusão.")
    detalhes = body.get("details")
    if detalhes is not None and not isinstance(detalhes, str):
        erros.add("details", "Texto inválido.")
        detalhes = None
    detalhes = (detalhes or "").strip()
    if tipo == "correcao" and len(detalhes) < 5:
        erros.add("details", "Diga o que precisa ser corrigido.")
    if len(detalhes) > 1000:
        erros.add("details", "Use no máximo 1.000 caracteres.")
    erros.raise_if_any()
    return {"type": tipo, "details": detalhes}


def validar_resposta_lgpd(pedido_id: str, body: dict) -> dict:
    """PATCH /lgpd/pedidos/{id}: concluir ou recusar, sempre com uma resposta ao titular."""
    if not VISIT_ID.match(pedido_id or ""):
        raise HttpError(404, "Pedido não encontrado.")
    erros = Erros()
    status = body.get("status")
    if status not in LGPD_RESPOSTAS:
        erros.add("status", "Escolha concluir ou recusar.")
    resposta = body.get("response")
    resposta = resposta.strip() if isinstance(resposta, str) else ""
    if len(resposta) < 3:
        erros.add("response", "Escreva a resposta ao titular.")
    if len(resposta) > 1000:
        erros.add("response", "Use no máximo 1.000 caracteres.")
    erros.raise_if_any()
    return {"status": status, "response": resposta}


def validar_cpf_titular(body: dict) -> str:
    """POST /lgpd/pacientes: o CPF vai no corpo, nunca na URL (que aparece em logs)."""
    cpf = only_digits(body.get("cpf"))
    if not is_valid_cpf(cpf):
        raise HttpError(422, "CPF inválido.", {"fields": {"cpf": "CPF inválido."}})
    return cpf
