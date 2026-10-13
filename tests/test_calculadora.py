"""Testes do motor de cálculo e da API com valores reais da planilha.

Valores de referência usados (células da aba Plan1, diâmetro 3/4" = coluna G):
  Joelho 90° PVC             G2  = "1,20"
  Saída/Entrada Canaliz. PVC G44 = "0,90"
  Registro de Gaveta Metal   G54 = "0,10"
  Trecho Reto PVC            G64 = 1
  Válvula de Retenção Vert.  H60 = "3,20" (1", Metal)
"""

from decimal import Decimal

import pytest

from services.calculadora_service import calcular
from services.erros import CombinacaoIndisponivel, ErroValidacao
from services.validacao_service import validar_itens


def item(componente, material, diametro, quantidade):
    return {"componente": componente, "material": material, "diametro": diametro, "quantidade": quantidade}


def calcular_corpo(base, *itens):
    return calcular(validar_itens({"itens": list(itens)}, base), base)


# Teste 1 — Um componente
def test_um_componente_resulta_no_valor_unitario(base):
    resultado = calcular_corpo(base, item("joelho-90", "pvc", "3/4", 1))
    assert resultado.linhas[0].valor_unitario == Decimal("1.20")
    assert resultado.linhas[0].comprimento_item == Decimal("1.20")
    assert resultado.comprimento_total == Decimal("1.20")


# Teste 2 — Múltiplas unidades
def test_tres_unidades_triplicam_o_valor_unitario(base):
    resultado = calcular_corpo(base, item("valvula-de-retencao-vertical", "metal", "1", 3))
    assert resultado.linhas[0].valor_unitario == Decimal("3.20")
    assert resultado.linhas[0].comprimento_item == Decimal("9.60")


# Teste 3 — Componentes diferentes (exercício 3/4" do material da disciplina: 17,8 m)
def test_componentes_diferentes_somam_os_itens(base):
    resultado = calcular_corpo(
        base,
        item("saida-entrada-de-canalizacao", "pvc", "3/4", 1),
        item("joelho-90", "pvc", "3/4", 5),
        item("registro-de-gaveta-aberto", "metal", "3/4", 2),
        item("trecho-reto", "pvc", "3/4", Decimal("10.7")),
    )
    itens = [linha.comprimento_item for linha in resultado.linhas]
    assert itens == [Decimal("0.90"), Decimal("6.00"), Decimal("0.20"), Decimal("10.7")]
    assert resultado.comprimento_total == sum(itens) == Decimal("17.8")


# Teste 4 — Remoção de componente
def test_remover_item_recalcula_com_os_restantes(base):
    itens = [
        item("joelho-90", "pvc", "3/4", 5),
        item("registro-de-gaveta-aberto", "metal", "3/4", 2),
        item("saida-entrada-de-canalizacao", "pvc", "3/4", 1),
    ]
    completo = calcular_corpo(base, *itens)
    sem_registro = calcular_corpo(base, itens[0], itens[2])
    assert completo.comprimento_total == Decimal("7.10")
    assert sem_registro.comprimento_total == Decimal("6.90")
    assert sem_registro.comprimento_total == completo.comprimento_total - completo.linhas[1].comprimento_item


# Teste 5 — Combinação inexistente
@pytest.mark.parametrize("componente, material", [
    ("filtro-y", "metal"),            # só existe em PVC
    ("registro-de-globo", "pvc"),     # só existe em Metal
])
def test_combinacao_inexistente_gera_erro_sem_valor(base, componente, material):
    with pytest.raises(CombinacaoIndisponivel, match="não disponível"):
        base.valor_unitario(componente, material, "3/4")
    with pytest.raises(ErroValidacao, match="não disponível"):
        validar_itens({"itens": [item(componente, material, "3/4", 1)]}, base)


@pytest.mark.parametrize("campo, valor, mensagem", [
    ("material", "aco", "Material inexistente"),
    ("diametro", "0.75", "Diâmetro inexistente"),
    ("diametro", '3/4"', "Diâmetro inexistente"),
    ("componente", "cotovelo-90", "Componente não encontrado"),
])
def test_valores_fora_da_base_sao_rejeitados(base, campo, valor, mensagem):
    dados = item("joelho-90", "pvc", "3/4", 1)
    dados[campo] = valor
    with pytest.raises(ErroValidacao, match=mensagem):
        validar_itens({"itens": [dados]}, base)


# Teste 6 — Quantidade inválida
@pytest.mark.parametrize("quantidade", [0, -1, -3, 2.5, Decimal("2.5"), "abc", "", "1.5", None, True, [1], {"q": 1}, 10_001])
def test_quantidade_invalida_de_pecas_e_rejeitada(base, quantidade):
    with pytest.raises(ErroValidacao):
        validar_itens({"itens": [item("joelho-90", "pvc", "3/4", quantidade)]}, base)


@pytest.mark.parametrize("quantidade", [0, -2, "abc", Decimal("1.234"), True, None])
def test_comprimento_invalido_de_trecho_reto_e_rejeitado(base, quantidade):
    with pytest.raises(ErroValidacao):
        validar_itens({"itens": [item("trecho-reto", "pvc", "3/4", quantidade)]}, base)


def test_quantidade_inteira_em_texto_e_aceita(base):
    resultado = calcular_corpo(base, item("joelho-90", "pvc", "3/4", "2"))
    assert resultado.comprimento_total == Decimal("2.40")


# Teste 7 — Lista vazia
def test_lista_vazia_pede_ao_menos_um_componente(base):
    with pytest.raises(ErroValidacao, match="pelo menos um componente"):
        validar_itens({"itens": []}, base)


@pytest.mark.parametrize("corpo", [None, [], "itens", {"outra": 1}, {"itens": "x"}, {"itens": [1]}, {"itens": [{"componente": "joelho-90"}]}])
def test_formato_inesperado_e_rejeitado(base, corpo):
    with pytest.raises(ErroValidacao):
        validar_itens(corpo, base)


# Teste 8 — Precisão
def test_soma_sem_erro_de_ponto_flutuante(base):
    # Em float, 0.1 * 3 e somas de 0,10 acumulam erro (0.30000000000000004).
    resultado = calcular_corpo(
        base,
        item("registro-de-gaveta-aberto", "metal", "3/4", 3),
        item("uniao", "metal", "3/4", 7),
        item("joelho-45", "metal", "1", 3),
    )
    itens = [linha.comprimento_item for linha in resultado.linhas]
    assert itens == [Decimal("0.30"), Decimal("0.07"), Decimal("1.29")]
    assert resultado.comprimento_total == Decimal("1.66")
    assert resultado.comprimento_total == sum(linha.valor_unitario * linha.quantidade for linha in resultado.linhas)


def test_exemplo_metal_1_polegada_usa_valores_da_planilha(base):
    # Exemplo do documento (30,8 m) usa Joelho 90° Metal 1" = 0,8; a planilha traz 0,94 (H3).
    resultado = calcular_corpo(
        base,
        item("trecho-reto", "metal", "1", Decimal("10.5")),
        item("valvula-de-retencao-vertical", "metal", "1", 1),
        item("registro-de-globo", "metal", "1", 1),
        item("valvula-de-pe-com-crivo", "metal", "1", 1),
        item("joelho-90", "metal", "1", 2),
    )
    assert resultado.comprimento_total == Decimal("31.08")


# Consultas à base
def test_componentes_filtrados_por_material_e_diametro(base):
    metal = {c["id"] for c in base.listar_componentes("metal", "3/4")}
    pvc = {c["id"] for c in base.listar_componentes("pvc", "3/4")}
    assert "filtro-y" in pvc and "filtro-y" not in metal
    assert "registro-de-globo" in metal and "registro-de-globo" not in pvc
    assert len(metal) == 34 and len(pvc) == 30


def test_diametros_correspondem_a_planilha(base):
    rotulos = [d["rotulo"] for d in base.listar_diametros()]
    assert rotulos == ['1/4"', '3/8"', '1/2"', '3/4"', '1"', '1 1/4"', '1 1/2"', '2"',
                       '2 1/2"', '3"', '4"', '5"', '6"', '8"', '10"', '12"', '14"']


# API
def test_api_calcular_retorna_resultado_exato(cliente):
    resposta = cliente.post("/api/calcular", json={"itens": [
        item("joelho-90", "pvc", "3/4", 5),
        item("trecho-reto", "pvc", "3/4", 10.7),
    ]})
    assert resposta.status_code == 200
    corpo = resposta.get_json()
    assert corpo["comprimento_total"] == "16.70"
    assert corpo["unidade"] == "m"
    assert [i["comprimento_item"] for i in corpo["itens"]] == ["6.00", "10.7"]


def test_api_combinacao_inexistente_retorna_422(cliente):
    resposta = cliente.post("/api/calcular", json={"itens": [item("filtro-y", "metal", "3/4", 1)]})
    assert resposta.status_code == 422
    assert "não disponível" in resposta.get_json()["erro"]
    assert "comprimento_total" not in resposta.get_json()


@pytest.mark.parametrize("dados", [b"nao e json", b'{"itens": []}', b'{"itens": [{"componente": "joelho-90", "material": "pvc", "diametro": "3/4", "quantidade": 0}]}'])
def test_api_entradas_invalidas_retornam_400(cliente, dados):
    resposta = cliente.post("/api/calcular", data=dados, content_type="application/json")
    assert resposta.status_code == 400
    assert resposta.get_json()["erro"]


def test_api_listagens(cliente):
    assert [m["id"] for m in cliente.get("/api/materiais").get_json()] == ["pvc", "metal"]
    assert len(cliente.get("/api/diametros").get_json()) == 17
    componentes = cliente.get("/api/componentes?material=pvc&diametro=3/4").get_json()
    joelho = next(c for c in componentes if c["id"] == "joelho-90")
    assert joelho["valor_unitario"] == "1.20"
    assert cliente.get("/api/componentes?material=aco").status_code == 400
    assert cliente.get("/").status_code == 200


def test_api_ignora_valores_enviados_pelo_cliente(cliente):
    adulterado = {**item("joelho-90", "pvc", "3/4", 5), "valor_unitario": "99"}
    resposta = cliente.post("/api/calcular", json={"itens": [adulterado]})
    assert resposta.get_json()["itens"][0]["valor_unitario"] == "1.20"
    assert resposta.get_json()["comprimento_total"] == "6.00"


def test_api_componentes_traz_foto_do_material(cliente):
    componentes = cliente.get("/api/componentes?material=metal&diametro=3/4").get_json()
    joelho = next(c for c in componentes if c["id"] == "joelho-90")
    assert joelho["imagem"] == "/static/img/componentes/joelho-90-metal.jpeg"
    resposta = cliente.get(joelho["imagem"])
    assert resposta.status_code == 200 and resposta.mimetype.startswith("image/")
    resposta.close()
