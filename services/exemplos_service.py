"""Exemplo da aula, usado pelo botão "Carregar exemplo da aula".

Exercício do material da disciplina (slide 48): tubulação de 3/4" que sai de
uma caixa d'água, com 1 entrada normal, 5 cotovelos 90°, 2 registros de gaveta
abertos e 10,7 m de tubo reto. Resultado esperado: 17,80 m.
"""

from decimal import Decimal

EXEMPLO_AULA = {
    "titulo": "Exercício da aula: tubulação de 3/4\" saindo da caixa d'água (resultado esperado: 17,80 m)",
    "resultado_esperado": Decimal("17.80"),
    "itens": [
        {"componente": "saida-entrada-de-canalizacao", "material": "pvc", "diametro": "3/4", "quantidade": 1},
        {"componente": "joelho-90", "material": "pvc", "diametro": "3/4", "quantidade": 5},
        {"componente": "registro-de-gaveta-aberto", "material": "metal", "diametro": "3/4", "quantidade": 2},
        {"componente": "trecho-reto", "material": "pvc", "diametro": "3/4", "quantidade": "10.7"},
    ],
}


def montar_exemplo(base):
    """Itens do exemplo com nome, valor unitário e foto, prontos para a interface."""
    itens = []
    for item in EXEMPLO_AULA["itens"]:
        componente = base.obter_componente(item["componente"])
        itens.append({
            "componente": item["componente"],
            "nome": componente["nome"],
            "material": item["material"],
            "material_rotulo": base.obter_material(item["material"])["rotulo"],
            "diametro": item["diametro"],
            "unidade_quantidade": componente["unidade_quantidade"],
            "quantidade": str(item["quantidade"]),
            "valor_unitario": format(base.valor_unitario(item["componente"], item["material"], item["diametro"]), "f"),
            "imagem": componente.get("imagens", {}).get(item["material"]),
        })
    return {
        "titulo": EXEMPLO_AULA["titulo"],
        "resultado_esperado": format(EXEMPLO_AULA["resultado_esperado"], "f"),
        "itens": itens,
    }
