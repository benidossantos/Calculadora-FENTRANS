"""Converte e valida o corpo recebido em /api/calcular."""

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from services.erros import ErroCalculadora, ErroValidacao

LIMITE_ITENS = 200
LIMITE_PECAS = 10_000
LIMITE_METROS = Decimal("100000")
CASAS_DECIMAIS_METROS = 2
CAMPOS_ITEM = ("componente", "material", "diametro", "quantidade")

_INTEIRO = re.compile(r"^\d+$")


@dataclass(frozen=True)
class ItemCalculo:
    componente_id: str
    material_id: str
    diametro_id: str
    quantidade: Decimal


def validar_itens(corpo, base):
    """Retorna a lista de ItemCalculo ou lança ErroValidacao com os problemas por item."""
    if not isinstance(corpo, dict) or "itens" not in corpo:
        raise ErroValidacao("Formato inesperado: envie um objeto JSON com a lista 'itens'.")
    itens = corpo["itens"]
    if not isinstance(itens, list):
        raise ErroValidacao("Formato inesperado: 'itens' deve ser uma lista.")
    if not itens:
        raise ErroValidacao("Adicione pelo menos um componente para calcular.")
    if len(itens) > LIMITE_ITENS:
        raise ErroValidacao(f"A lista aceita no máximo {LIMITE_ITENS} itens.")

    validos, problemas = [], []
    for posicao, bruto in enumerate(itens, start=1):
        try:
            validos.append(_validar_item(bruto, base))
        except ErroCalculadora as erro:
            problemas.append({"item": posicao, "mensagem": erro.mensagem, "status": erro.status_http})

    if problemas:
        mensagem = " ".join(f"Item {p['item']}: {p['mensagem']}" for p in problemas)
        erro = ErroValidacao(mensagem, [{"item": p["item"], "mensagem": p["mensagem"]} for p in problemas])
        # Se todos os problemas forem combinações sem valor, a resposta usa o status específico.
        if all(p["status"] == 422 for p in problemas):
            erro.status_http = 422
        raise erro
    return validos


def _validar_item(bruto, base):
    if not isinstance(bruto, dict):
        raise ErroValidacao("cada item deve ser um objeto com componente, material, diâmetro e quantidade.")
    faltando = [campo for campo in CAMPOS_ITEM if campo not in bruto]
    if faltando:
        raise ErroValidacao(f"campo(s) ausente(s): {', '.join(faltando)}.")
    for campo in ("componente", "material", "diametro"):
        if not isinstance(bruto[campo], str):
            raise ErroValidacao(f"'{campo}' deve ser um texto.")

    componente = base.obter_componente(bruto["componente"])
    base.valor_unitario(bruto["componente"], bruto["material"], bruto["diametro"])
    quantidade = validar_quantidade(bruto["quantidade"], componente["unidade_quantidade"])
    return ItemCalculo(bruto["componente"], bruto["material"], bruto["diametro"], quantidade)


def validar_quantidade(bruto, unidade_quantidade):
    """Peças ('un'): inteiro positivo. Tubo reto ('m'): metros positivos com até 2 casas."""
    if unidade_quantidade == "m":
        return _validar_metros(bruto)
    return _validar_pecas(bruto)


def _validar_pecas(bruto):
    if isinstance(bruto, bool):
        raise ErroValidacao("a quantidade deve ser um número inteiro positivo.")
    if isinstance(bruto, int):
        quantidade = bruto
    elif isinstance(bruto, str) and _INTEIRO.match(bruto.strip()):
        quantidade = int(bruto.strip())
    else:
        raise ErroValidacao("a quantidade deve ser um número inteiro positivo (sem casas decimais).")
    if quantidade < 1:
        raise ErroValidacao("a quantidade deve ser maior que zero.")
    if quantidade > LIMITE_PECAS:
        raise ErroValidacao(f"a quantidade máxima é {LIMITE_PECAS}.")
    return Decimal(quantidade)


def _validar_metros(bruto):
    if isinstance(bruto, bool) or not isinstance(bruto, (int, float, Decimal, str)):
        raise ErroValidacao("o comprimento deve ser um número positivo em metros.")
    texto = bruto.strip().replace(",", ".") if isinstance(bruto, str) else str(bruto)
    try:
        metros = Decimal(texto)
    except InvalidOperation:
        raise ErroValidacao("o comprimento deve ser um número positivo em metros.") from None
    if not metros.is_finite() or metros <= 0:
        raise ErroValidacao("o comprimento deve ser maior que zero.")
    if metros > LIMITE_METROS:
        raise ErroValidacao(f"o comprimento máximo é {LIMITE_METROS} m.")
    if -metros.as_tuple().exponent > CASAS_DECIMAIS_METROS:
        raise ErroValidacao(f"o comprimento aceita no máximo {CASAS_DECIMAIS_METROS} casas decimais.")
    return metros
