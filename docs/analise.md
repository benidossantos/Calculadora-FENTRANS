# Etapa 1 — Análise dos arquivos de referência

## 1. O que cada arquivo traz

| Arquivo | Conteúdo útil |
|---|---|
| `1 Perda de Carga Localizada.xlsx` | Aba única `Plan1` (A1:T65). Colunas: **A** Descrição, **B** Foto (só imagens), **C** Material, **D–T** 17 diâmetros nominais. 64 linhas de dados = 35 componentes. |
| `2026.2 - Software Calculadora.docx` | Enunciado oficial: selecionar diâmetro (mm ou polegadas), adicionar componentes e quantidades, base interna com os valores da planilha, fórmula `L_total = Σ (Quantidade_i · L_unitário_i)`, exibir o total, PDF opcional, Clean Code e separação cálculo/interface. Imagens: exercício 3/4" e tabela de referência. |
| `Trabalho de Software P2.doc` | Quase só imagens: frase de objetivo, a mesma tabela, o exercício 3/4" (total 17,8) e um exemplo em metal 1" (total 30,8 m). |

## 2. Estrutura real da planilha

- Diâmetros (cabeçalho, texto): `1/4"`, `3/8"`, `1/2"`, `3/4"`, `1"`, `1 1/4"`, `1 1/2"`, `2"`, `2 1/2"`, `3"`, `4"`, `5"`, `6"`, `8"`, `10"`, `12"`, `14"`.
- Materiais: apenas `PVC` e `Metal`.
- Valores gravados como **texto com vírgula** (`"0,35"`), sempre com 2 casas. Exceção: `Trecho Reto`, gravado como inteiro `1`.
- **Nenhuma célula vazia** na grade de valores: toda linha existente tem os 17 diâmetros. As lacunas reais são de **material**:
  - Só Metal: União com Joelho 90°, Registro de Ângulo (Hidrante), Registro de Globo, Válvula de Retenção Horizontal, Válvula de Retenção Vertical.
  - Só PVC: Filtro Y.
- Descrições contêm quebras de linha (`"Tê \nPassagem\nDireta"`); serão normalizadas só nos espaços, sem mudar o texto.
- Componentes com nomes parecidos e valores distintos ficam separados por chave própria (ex.: `te-passagem-direta` × `te-passagem-lateral` × `te-passagem-bilateral`; `joelho-90` × `joelho-90-com-reducao` × `uniao-com-joelho-90`).

## 3. Como a planilha vira a base interna

Script `scripts/extrair_planilha.py` (openpyxl) gera `dados/comprimentos_equivalentes.json`:

- cada componente recebe um `id` estável derivado do nome (não da posição da linha);
- cada valor é guardado como **texto decimal exato** (`"0.35"`), convertido para `Decimal` no backend, evitando erros de ponto flutuante (`0.35 × 3` dá `1.05` exato);
- só são gravadas as combinações que existem; ausência de material fica ausente, nunca zero;
- cada valor guarda a célula de origem (`"G2"`) para auditoria;
- o script valida e falha se encontrar valor não numérico, célula vazia, componente duplicado ou diâmetro desconhecido;
- um teste automatizado relê a planilha e confere **todas** as células contra o JSON.

## 4. Ambiguidades que afetam a precisão

### 4.1 Unidade — confirmada: metros
A planilha não diz a unidade. A tabela reproduzida nos dois documentos tem o título **"Diâmetro nominal X Equivalência em metros de canalização"**, e as linhas `Trecho Reto = 1` (1 m de tubo equivale a 1 m) são coerentes com isso. Os resultados serão rotulados em **metros (m)**.

### 4.2 Planilha × tabela dos documentos (decidido: vale a planilha)
Comparei a faixa 3/4"–5" da tabela-imagem com a planilha. A maioria bate, mas há divergências:

| Componente / material | Diâmetros | Planilha | Tabela dos documentos |
|---|---|---|---|
| Joelho 90° Metal | 1" a 5" | 0,94 · 1,17 · 1,41 · 1,88 · 2,35 · 2,82 · 3,76 · 4,70 | 0,8 · 1,1 · 1,3 · 1,7 · 2,0 · 2,5 · 3,4 · 4,2 |
| Joelho 45° Metal | 3/4" a 5" | 0,32 · 0,43 · 0,54 · 0,65 · 0,86 · 1,08 · 1,30 · 1,73 · 2,16 | 0,3 · 0,4 · 0,5 · 0,6 · 0,8 · 0,9 · 1,2 · 1,5 · 1,9 |
| Curva 90° Metal | 1 1/4" a 5" | 0,70 · 0,90 · 1,10 · 1,30 · 1,60 · 2,10 · 2,70 | 0,6 · 0,7 · 0,9 · 1,0 · 1,3 · 1,6 · 2,1 |
| Tê passagem direta Metal | 2 1/2" | 1,35 | 1,3 |
| Tê saída lateral/bilateral Metal | 1 1/4" e 2 1/2" | 2,10 e 4,10 | 2,3 e 4,3 |
| Luva de Redução PVC | 1 1/2" | 0,10 | 0,4 |
| Luva de Redução Metal ("Aço" no documento) | 1 1/2" | 0,18 | 0,38 |

Consequência prática: o exemplo do documento em metal 1" (total 30,8 m) usa Joelho 90° Metal = 0,8; com a planilha o mesmo cálculo dá 31,08 m. O exercício 3/4" (17,8) bate com a planilha.
Como o enunciado diz que os valores aplicados estão na planilha e o pedido manda usá-la como fonte, a calculadora usa a planilha sem correções. As divergências ficam documentadas no README.

### 4.3 Valores suspeitos dentro da própria planilha (preservados)
- Curva de Transposição Metal 1/2" = 0,87, entre 0,24 (3/8") e 0,48 (3/4"); o PVC no mesmo diâmetro é 0,32.
- Niple de Redução Metal: 0,05 até 1/2", 0,01 de 3/4" a 3", e salta para 1,63 em 8".
- Luva de Redução PVC/Metal decresce de 3/4" até 1 1/2" e volta a subir (parte disso também está na tabela dos documentos).
- Faixas 1/4"–1/2" e 6"–14" não existem na tabela dos documentos; parecem extrapoladas, mas estão na planilha e serão oferecidas.

### 4.4 "Trecho Reto" e quantidade fracionária (pergunta ao Beni)
A planilha tem `Trecho Reto = 1` por diâmetro, e o exercício do professor usa **10,7** como quantidade (metros de tubo). O pedido exige quantidades inteiras. Padrão adotado: acessórios aceitam só inteiros positivos; `Trecho Reto` aceita metros com até 2 casas decimais. É uma configuração de uma linha, fácil de reverter.

### 4.5 Diâmetro em mm
A tabela só traz polegadas. A opção "mm" mostrará a designação **DN** (ISO 6708 / ABNT, ex.: 3/4" ↔ DN 20), sempre identificada como nominal, não como diâmetro interno nem como diâmetro externo do tubo soldável (que em PVC é 25 mm para 3/4").

### 4.6 Material por item
O exercício do professor mistura PVC e Metal no mesmo cálculo. Por isso material e diâmetro são escolhidos **por item**; os seletores do topo ficam como padrão para o próximo item e o resultado mostra material e diâmetro de cada linha.
