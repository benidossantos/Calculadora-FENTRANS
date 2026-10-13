class ErroCalculadora(Exception):
    """Erro de entrada ou de consulta com mensagem pronta para o usuário."""

    status_http = 400

    def __init__(self, mensagem, detalhes=None):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.detalhes = detalhes or []


class ErroValidacao(ErroCalculadora):
    pass


class CombinacaoIndisponivel(ErroCalculadora):
    """A combinação existe nos cadastros, mas não tem valor tabelado."""

    status_http = 422
