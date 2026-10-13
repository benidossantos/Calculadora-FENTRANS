"""Aplicação Flask da Calculadora de Comprimento Equivalente."""

import json
from dataclasses import asdict
from decimal import Decimal

from flask import Flask, jsonify, render_template, request, url_for

from services.calculadora_service import calcular
from services.dados_service import CAMINHO_PADRAO, BaseReferencia
from services.erros import ErroCalculadora, ErroValidacao
from services.validacao_service import validar_itens

TAMANHO_MAXIMO_REQUISICAO = 64 * 1024


def _decimal_para_texto(valor):
    """Texto decimal exato, sem notação científica (ex.: Decimal('6.00') -> '6.00')."""
    return format(valor, "f")


def _serializar_resultado(resultado):
    linhas = []
    for linha in resultado.linhas:
        dados = asdict(linha)
        for campo in ("quantidade", "valor_unitario", "comprimento_item"):
            dados[campo] = _decimal_para_texto(dados[campo])
        linhas.append(dados)
    return {
        "itens": linhas,
        "comprimento_total": _decimal_para_texto(resultado.comprimento_total),
        "unidade": resultado.unidade,
    }


def _resposta_erro(erro):
    corpo = {"erro": erro.mensagem}
    if erro.detalhes:
        corpo["detalhes"] = erro.detalhes
    return jsonify(corpo), erro.status_http


def create_app(caminho_base=CAMINHO_PADRAO):
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = TAMANHO_MAXIMO_REQUISICAO
    app.json.sort_keys = False
    base = BaseReferencia.carregar(caminho_base)

    @app.get("/")
    def index():
        return render_template("index.html", unidade=base.unidade)

    @app.get("/api/materiais")
    def materiais():
        return jsonify(base.listar_materiais())

    @app.get("/api/diametros")
    def diametros():
        return jsonify(base.listar_diametros())

    @app.get("/api/componentes")
    def componentes():
        material = request.args.get("material") or None
        diametro = request.args.get("diametro") or None
        componentes = base.listar_componentes(material, diametro)
        for componente in componentes:
            if componente.get("imagem"):
                componente["imagem"] = url_for("static", filename=componente["imagem"])
        return jsonify(componentes)

    @app.post("/api/calcular")
    def calcular_comprimento():
        try:
            corpo = json.loads(request.get_data(cache=False), parse_float=Decimal)
        except (ValueError, UnicodeDecodeError):
            raise ErroValidacao("Formato inesperado: o corpo da requisição deve ser JSON válido.")
        itens = validar_itens(corpo, base)
        return jsonify(_serializar_resultado(calcular(itens, base)))

    @app.errorhandler(ErroCalculadora)
    def tratar_erro_calculadora(erro):
        return _resposta_erro(erro)

    @app.errorhandler(404)
    def nao_encontrado(_erro):
        return jsonify({"erro": "Recurso não encontrado."}), 404

    @app.errorhandler(405)
    def metodo_nao_permitido(_erro):
        return jsonify({"erro": "Método não permitido para este endereço."}), 405

    @app.errorhandler(413)
    def requisicao_grande(_erro):
        return jsonify({"erro": "Requisição muito grande."}), 413

    @app.errorhandler(500)
    def erro_interno(_erro):
        return jsonify({"erro": "Erro interno ao processar a solicitação."}), 500

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=5000, debug=False)
