# Calculadora de Comprimento Equivalente

Software aberto, em formato de calculadora web, que calcula o **comprimento equivalente** de acessórios de tubulações hidráulicas a partir da tabela de referência da disciplina de Fenômenos de Transporte (Engenharia de Software, Universidade de Vassouras, 2026.2).

O usuário escolhe material, diâmetro nominal e componente, informa a quantidade e obtém o comprimento equivalente de cada item e o total da instalação.

## Funcionalidades

- Seleção de **material** (PVC ou Metal), apenas entre os que existem na planilha.
- Seleção do **diâmetro nominal** em polegadas (1/4" a 14"), com opção de exibir a designação **DN** em mm.
- Lista de **componentes filtrada** pelo material e diâmetro escolhidos, mostrando o valor unitário tabelado.
- **Quantidade** inteira e positiva para peças. O item *Trecho Reto* aceita metros com até 2 casas decimais (ver Limitações).
- Vários componentes no mesmo cálculo, inclusive com materiais e diâmetros diferentes; o mesmo componente adicionado de novo soma a quantidade.
- Alteração de quantidade, remoção de itens, limpeza da lista e novo cálculo, sem recarregar a página.
- Tabela de resultados com componente, material, diâmetro, quantidade, L<sub>eq</sub> unitário e L<sub>eq</sub> do item, e painel em destaque com o **Comprimento Equivalente Total**.
- Validação no navegador e no servidor, com mensagens claras para quantidade inválida, lista vazia, material, diâmetro ou componente inexistente, combinação sem valor tabelado e JSON malformado.
- Memorial de cálculo pelo botão **Imprimir / salvar PDF** (usa a impressão do navegador, com data e hora).

## Tecnologias

- Python 3.10+ e Flask (servidor e API JSON).
- openpyxl (somente para extrair a planilha para JSON e para os testes de extração).
- HTML5, CSS3 e JavaScript puro, sem frameworks.
- pytest (testes automatizados).

## Estrutura de pastas

```
calculadora-comprimento-equivalente/
├── app.py                         # Flask: rotas, leitura do JSON da requisição, respostas de erro
├── requirements.txt
├── README.md
├── dados/
│   ├── comprimentos_equivalentes.json   # base de referência usada pela aplicação
│   └── fonte/1 Perda de Carga Localizada.xlsx  # planilha original
├── docs/
│   └── analise.md                 # análise dos arquivos e divergências encontradas
├── scripts/
│   └── extrair_planilha.py        # gera o JSON a partir da planilha
├── services/
│   ├── dados_service.py           # carrega e consulta a base (somente leitura)
│   ├── validacao_service.py       # valida os itens recebidos
│   ├── calculadora_service.py     # LE_item = LE_unitário × Q; LE_total = Σ LE_item
│   └── erros.py                   # exceções com mensagens para o usuário
├── templates/index.html
├── static/css/style.css
├── static/js/script.js
└── tests/
    ├── test_calculadora.py        # cálculo, validação e API
    └── test_extracao.py           # JSON × células da planilha
```

## Requisitos

- Python 3.10 ou superior.
- Nenhum serviço externo, banco de dados ou hospedagem.

## Instalação

```bash
cd calculadora-comprimento-equivalente
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

## Executar o servidor

```bash
python app.py
```

Abra <http://127.0.0.1:5000> no navegador. O servidor escuta apenas na própria máquina e roda sem modo de depuração.

## Executar os testes

```bash
python -m pytest
```

Resultado da última execução: **52 testes aprovados**. Eles cobrem os oito cenários obrigatórios com valores reais da planilha (um componente, três unidades, componentes diferentes, remoção, combinação inexistente, quantidades inválidas, lista vazia e precisão), as rotas da API e a conferência das 1.088 células extraídas.

## Fórmula

Para cada item:

```
LE_item = LE_unitário × Q
```

Para a instalação:

```
LE_total = Σ (LE_unitário_i × Q_i)
```

`LE_unitário` vem diretamente da tabela para a combinação componente + material + diâmetro, e `Q` é a quantidade informada. O resultado é o comprimento equivalente em **metros**; a calculadora não calcula perda de carga (Darcy-Weisbach, Hazen-Williams etc.).

Os cálculos usam `Decimal` com os valores exatos da tabela, sem arredondamento intermediário. A API devolve os números como texto decimal exato (ex.: `"6.00"`), e a interface só troca o ponto pela vírgula. Exemplo do material da disciplina, em 3/4": 1 entrada PVC (0,90) + 5 joelhos 90° PVC (1,20) + 2 registros de gaveta Metal (0,10) + 10,7 m de trecho reto = **17,80 m**.

## Origem dos dados

- Fonte: `1 Perda de Carga Localizada.xlsx`, aba `Plan1`. Colunas: Descrição, Foto, Material e 17 diâmetros (1/4" a 14").
- 35 componentes, 64 combinações componente/material, 1.088 valores. Não há células vazias; as lacunas são de material: União com Joelho 90°, Registro de Ângulo, Registro de Globo e Válvulas de Retenção existem só em Metal, e Filtro Y só em PVC.
- A planilha guarda os valores como texto com vírgula (`"0,35"`). No JSON eles ficam como texto decimal com ponto (`"0.35"`) e são lidos como `Decimal`. Cada valor guarda a célula de origem (`"celulas"`), para auditoria.
- Combinações ausentes não aparecem no JSON e nunca viram zero. A API responde 422 com a mensagem "Combinação não disponível na tabela".
- **Unidade:** a planilha não informa; a tabela reproduzida nos documentos da disciplina se intitula "Diâmetro nominal X Equivalência em **metros** de canalização".

## Limitações conhecidas

- **Planilha × tabela dos documentos.** Algumas células divergem da tabela-imagem dos documentos (Joelho 90° Metal, Joelho 45° Metal, Curva 90° Metal, Tês Metal e Luva de Redução 1 1/2"). A calculadora usa a planilha, conforme o enunciado. Por isso, o exemplo de metal 1" do documento (30,8 m) dá 31,08 m aqui. Detalhes em `docs/analise.md`.
- **Valores suspeitos preservados.** Exemplos: Curva de Transposição Metal 1/2" = 0,87; Niple de Redução Metal com 0,01 de 3/4" a 3". Não foram corrigidos.
- **Trecho Reto.** A planilha o inclui com valor 1 por metro, e o exercício da disciplina usa 10,7 m. Por isso ele aceita metros decimais (até 2 casas), enquanto as peças aceitam só inteiros. Para exigir inteiros também nele, esvazie `COMPONENTES_MEDIDOS_EM_METROS` em `scripts/extrair_planilha.py` e regenere o JSON.
- **Diâmetro em mm.** A opção mm mostra a designação nominal DN (ISO 6708; ex.: 3/4" = DN 20). Não é o diâmetro interno nem o diâmetro externo comercial do tubo de PVC soldável (25 mm para 3/4"). A consulta à tabela usa sempre a chave em polegadas.
- O PDF é gerado pela impressão do navegador; não há geração de PDF no servidor.

## Consultar e atualizar a base de referência

- Consulta rápida: abra `dados/comprimentos_equivalentes.json` ou use a API, por exemplo `GET /api/componentes?material=pvc&diametro=3/4`.
- Rotas: `GET /api/materiais`, `GET /api/diametros`, `GET /api/componentes?material=&diametro=` e `POST /api/calcular` com corpo `{"itens": [{"componente": "joelho-90", "material": "pvc", "diametro": "3/4", "quantidade": 5}]}`.
- Para atualizar, substitua a planilha em `dados/fonte/`, mantendo o mesmo layout, e rode:

  ```bash
  python scripts/extrair_planilha.py
  python -m pytest
  ```

  O script falha com mensagem clara se encontrar cabeçalho inesperado, diâmetro desconhecido, valor não numérico ou componente duplicado. Os testes de extração conferem cada valor do JSON com a célula de origem. Os testes de cálculo usam valores reais da planilha atual; se a planilha mudar, ajuste-os aos novos valores.
- Os dados enviados pelo navegador nunca alteram a base: o servidor só a lê, e qualquer valor unitário enviado pelo cliente é ignorado.
