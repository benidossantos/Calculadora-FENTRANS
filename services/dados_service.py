"""Acesso somente leitura à base de comprimentos equivalentes extraída da planilha."""

import json
from decimal import Decimal
from pathlib import Path

from services.erros import CombinacaoIndisponivel, ErroValidacao

CAMINHO_PADRAO = Path(__file__).resolve().parent.parent / "dados" / "comprimentos_equivalentes.json"


class BaseReferencia:
    def __init__(self, dados):
        self.metadados = dados["metadados"]
        self.unidade = self.metadados["unidade"]
        self._materiais = {m["id"]: m for m in dados["materiais"]}
        self._diametros = {d["id"]: d for d in dados["diametros"]}
        self._componentes = {c["id"]: c for c in dados["componentes"]}

    @classmethod
    def carregar(cls, caminho=CAMINHO_PADRAO):
        with open(caminho, encoding="utf-8") as arquivo:
            return cls(json.load(arquivo))

    def listar_materiais(self):
        return [dict(m) for m in self._materiais.values()]

    def listar_diametros(self):
        return [dict(d) for d in self._diametros.values()]

    def listar_componentes(self, material_id=None, diametro_id=None):
        """Componentes que possuem valor para o material e o diâmetro informados.

        Quando os dois filtros são informados, cada componente vem com seu
        valor unitário tabelado.
        """
        if material_id is not None:
            self.obter_material(material_id)
        if diametro_id is not None:
            self.obter_diametro(diametro_id)

        resultado = []
        for componente in self._componentes.values():
            materiais = [
                m for m, valores in componente["valores"].items()
                if (material_id is None or m == material_id)
                and (diametro_id is None or diametro_id in valores)
            ]
            if not materiais:
                continue
            item = {
                "id": componente["id"],
                "nome": componente["nome"],
                "unidade_quantidade": componente["unidade_quantidade"],
                "materiais": materiais,
            }
            if material_id is not None and diametro_id is not None:
                item["valor_unitario"] = componente["valores"][material_id][diametro_id]
            resultado.append(item)
        return resultado

    def obter_material(self, material_id):
        if material_id not in self._materiais:
            raise ErroValidacao(f"Material inexistente: {material_id!r}.")
        return self._materiais[material_id]

    def obter_diametro(self, diametro_id):
        if diametro_id not in self._diametros:
            raise ErroValidacao(f"Diâmetro inexistente: {diametro_id!r}.")
        return self._diametros[diametro_id]

    def obter_componente(self, componente_id):
        if componente_id not in self._componentes:
            raise ErroValidacao(f"Componente não encontrado: {componente_id!r}.")
        return self._componentes[componente_id]

    def valor_unitario(self, componente_id, material_id, diametro_id):
        """Comprimento equivalente unitário exatamente como está na tabela."""
        componente = self.obter_componente(componente_id)
        material = self.obter_material(material_id)
        diametro = self.obter_diametro(diametro_id)
        valor = componente["valores"].get(material_id, {}).get(diametro_id)
        if valor is None:
            raise CombinacaoIndisponivel(
                f"Combinação não disponível na tabela: {componente['nome']} em "
                f"{material['rotulo']} com diâmetro {diametro['rotulo']}."
            )
        return Decimal(valor)
