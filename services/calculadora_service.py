"""Motor de cálculo: LE_item = LE_unitário × Q e LE_total = Σ LE_item.

Toda a aritmética usa Decimal com os valores exatos da tabela; nada é
arredondado aqui. O arredondamento, se houver, é só de apresentação.
"""

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class LinhaResultado:
    componente_id: str
    componente: str
    material_id: str
    material: str
    diametro_id: str
    diametro: str
    unidade_quantidade: str
    quantidade: Decimal
    valor_unitario: Decimal
    comprimento_item: Decimal


@dataclass(frozen=True)
class ResultadoCalculo:
    linhas: list
    comprimento_total: Decimal
    unidade: str


def comprimento_item(valor_unitario, quantidade):
    return valor_unitario * quantidade


def comprimento_total(comprimentos_itens):
    return sum(comprimentos_itens, Decimal(0))


def calcular(itens, base):
    """Calcula os comprimentos equivalentes de itens já validados."""
    linhas = []
    for item in itens:
        componente = base.obter_componente(item.componente_id)
        valor_unitario = base.valor_unitario(item.componente_id, item.material_id, item.diametro_id)
        linhas.append(LinhaResultado(
            componente_id=item.componente_id,
            componente=componente["nome"],
            material_id=item.material_id,
            material=base.obter_material(item.material_id)["rotulo"],
            diametro_id=item.diametro_id,
            diametro=base.obter_diametro(item.diametro_id)["rotulo"],
            unidade_quantidade=componente["unidade_quantidade"],
            quantidade=item.quantidade,
            valor_unitario=valor_unitario,
            comprimento_item=comprimento_item(valor_unitario, item.quantidade),
        ))
    total = comprimento_total(linha.comprimento_item for linha in linhas)
    return ResultadoCalculo(linhas=linhas, comprimento_total=total, unidade=base.unidade)
