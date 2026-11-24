"""Monta os dados do memorial de cálculo (documento para imprimir ou salvar em PDF).

O cálculo é o mesmo da API (calculadora_service); aqui só se formata o
resultado para leitura: números com vírgula, quantidades por extenso e a
lista de compras.
"""

from decimal import Decimal


def formatar_decimal(valor, casas=2):
    """Decimal('6.00') -> '6,00'; Decimal('1234.5') -> '1.234,50'."""
    texto = f"{Decimal(valor):,.{casas}f}"
    return texto.replace(",", "_").replace(".", ",").replace("_", ".")


def formatar_quantidade(quantidade, unidade_quantidade):
    if unidade_quantidade == "m":
        return f"{formatar_decimal(quantidade)} m"
    inteiro = int(quantidade)
    return f"{inteiro} {'unidade' if inteiro == 1 else 'unidades'}"


def montar_memorial(resultado, base):
    """Linhas formatadas, lista de compras e total para o template do memorial."""
    linhas = []
    for numero, linha in enumerate(resultado.linhas, start=1):
        componente = base.obter_componente(linha.componente_id)
        diametro = base.obter_diametro(linha.diametro_id)
        linhas.append({
            "numero": numero,
            "componente": linha.componente,
            "material": linha.material,
            "diametro": f"{diametro['rotulo']} (DN {diametro['dn_mm']})",
            "quantidade": formatar_quantidade(linha.quantidade, linha.unidade_quantidade),
            "valor_unitario": formatar_decimal(linha.valor_unitario),
            "comprimento_item": formatar_decimal(linha.comprimento_item),
            "imagem": componente.get("imagens", {}).get(linha.material_id),
            "e_tubo": linha.unidade_quantidade == "m",
        })
    total_pecas = sum(int(l.quantidade) for l in resultado.linhas if l.unidade_quantidade == "un")
    metros_tubo = sum((l.quantidade for l in resultado.linhas if l.unidade_quantidade == "m"), Decimal(0))
    return {
        "linhas": linhas,
        "total": formatar_decimal(resultado.comprimento_total),
        "total_pecas": total_pecas,
        "metros_tubo": formatar_decimal(metros_tubo),
        "unidade": resultado.unidade,
    }
