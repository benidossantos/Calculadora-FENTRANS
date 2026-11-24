"use strict";

// A interface só monta a lista e exibe valores: todo cálculo é feito pelo backend.
// O cálculo é pedido automaticamente sempre que a lista muda.

const LIMITE_PECAS = 10000;
const LIMITE_METROS = 100000;
const PADRAO_PECAS = /^\d+$/;
const PADRAO_METROS = /^\d+([.,]\d{1,2})?$/;

const estado = {
  materiais: [],
  diametros: [],
  componentes: [],
  itens: [],
  resultado: null,
  calculando: false,
  numeroRequisicao: 0,
  exibicaoDiametro: "pol",
};

const el = (id) => document.getElementById(id);
const campos = {
  form: el("form-componente"),
  material: el("material"),
  diametro: el("diametro"),
  componente: el("componente"),
  previaComponente: el("previa-componente"),
  botaoExemplo: el("botao-exemplo"),
  notaExemplo: el("nota-exemplo"),
  quantidade: el("quantidade"),
  rotuloQuantidade: el("rotulo-quantidade"),
  notaDn: el("nota-dn"),
  botaoAdicionar: el("botao-adicionar"),
  mensagemFormulario: el("mensagem-formulario"),
  corpoTabela: el("corpo-tabela"),
  listaVazia: el("lista-vazia"),
  contador: el("contador-itens"),
  botaoLimpar: el("botao-limpar"),
  botaoImprimir: el("botao-imprimir"),
  mensagemCalculo: el("mensagem-calculo"),
  valorTotal: el("valor-total"),
  estadoResultado: el("estado-resultado"),
  dataMemorial: el("data-memorial"),
  corpoListaCompras: el("corpo-lista-compras"),
};

// ---------- Utilitários ----------

async function requisitar(url, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch {
    throw { erro: "Não foi possível falar com o servidor. Verifique se ele está em execução." };
  }
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw { erro: corpo.erro || `Erro ${resposta.status} no servidor.`, detalhes: corpo.detalhes || [] };
  }
  return corpo;
}

// Formata um decimal recebido como texto ("6.00", "10.7") sem passar por float.
function formatarDecimal(texto, casasMinimas = 2) {
  const [inteiro, fracao = ""] = String(texto).split(".");
  const inteiroFormatado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${inteiroFormatado},${fracao.padEnd(casasMinimas, "0")}`;
}

function formatarQuantidade(item) {
  return item.unidadeQuantidade === "m"
    ? `${formatarDecimal(item.quantidade.replace(",", "."))} m`
    : item.quantidade;
}

function rotuloDiametro(diametro) {
  return estado.exibicaoDiametro === "mm"
    ? `DN ${diametro.dn_mm} (${diametro.rotulo})`
    : diametro.rotulo;
}

// Soma dois comprimentos em metros (texto com até 2 casas) sem erro de ponto flutuante.
function somarMetros(a, b) {
  const centimetros = (texto) => Math.round(Number(String(texto).replace(",", ".")) * 100);
  const total = centimetros(a) + centimetros(b);
  return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, "0")}`;
}

function validarQuantidade(texto, unidadeQuantidade) {
  const valor = String(texto).trim();
  if (unidadeQuantidade === "m") {
    if (!PADRAO_METROS.test(valor) || Number(valor.replace(",", ".")) <= 0) {
      return "Informe o comprimento em metros, maior que zero e com no máximo 2 casas decimais.";
    }
    return null;
  }
  if (!PADRAO_PECAS.test(valor)) return "A quantidade deve ser um número inteiro positivo.";
  const numero = Number(valor);
  if (numero < 1) return "A quantidade deve ser maior que zero.";
  if (numero > LIMITE_PECAS) return `A quantidade máxima é ${LIMITE_PECAS}.`;
  return null;
}

function mostrarMensagem(elemento, texto) {
  elemento.textContent = texto || "";
  elemento.hidden = !texto;
}

// Grupos do menu de componentes, na ordem em que aparecem.
const GRUPOS_COMPONENTES = [
  ["Joelhos", (id) => id.startsWith("joelho") || id === "uniao-com-joelho-90"],
  ["Curvas", (id) => id.startsWith("curva")],
  ["Tês e cruzetas", (id) => id.startsWith("te-") || id.startsWith("cruzeta")],
  ["Registros, válvulas e filtros", (id) => id.startsWith("registro") || id.startsWith("valvula") || id === "filtro-y"],
  ["Luvas, niples e uniões", (id) => /^(luva|bucha|niple|uniao|engate)/.test(id)],
  ["Entradas e saídas de canalização", (id) => id.startsWith("saida-entrada")],
  ["Tubo reto", (id) => id === "trecho-reto"],
];

function grupoDoComponente(id) {
  const grupo = GRUPOS_COMPONENTES.find(([, pertence]) => pertence(id));
  return grupo ? grupo[0] : "Outros";
}

function preencherSelectAgrupado(select, opcoes, valorAtual) {
  const grupos = new Map([...GRUPOS_COMPONENTES.map(([nome]) => [nome, []]), ["Outros", []]]);
  opcoes.forEach((opcao) => grupos.get(grupoDoComponente(opcao.valor)).push(opcao));
  const elementos = [];
  grupos.forEach((itens, nome) => {
    if (itens.length === 0) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = nome;
    optgroup.append(...itens.map(({ valor, texto }) => new Option(texto, valor)));
    elementos.push(optgroup);
  });
  select.replaceChildren(...elementos);
  if (opcoes.some((opcao) => opcao.valor === valorAtual)) select.value = valorAtual;
}

function preencherSelect(select, opcoes, valorAtual) {
  select.replaceChildren(...opcoes.map(({ valor, texto }) => new Option(texto, valor)));
  if (opcoes.some((opcao) => opcao.valor === valorAtual)) select.value = valorAtual;
}

// ---------- Formulário ----------

async function carregarCatalogo() {
  try {
    [estado.materiais, estado.diametros] = await Promise.all([
      requisitar("/api/materiais"),
      requisitar("/api/diametros"),
    ]);
  } catch (falha) {
    mostrarMensagem(campos.mensagemFormulario, falha.erro);
    campos.botaoAdicionar.disabled = true;
    return;
  }
  preencherSelect(campos.material, estado.materiais.map((m) => ({ valor: m.id, texto: m.rotulo })));
  atualizarOpcoesDiametro("3/4");
  await atualizarComponentes();
}

function atualizarOpcoesDiametro(valorAtual = campos.diametro.value) {
  preencherSelect(
    campos.diametro,
    estado.diametros.map((d) => ({ valor: d.id, texto: rotuloDiametro(d) })),
    valorAtual,
  );
  campos.notaDn.hidden = estado.exibicaoDiametro !== "mm";
}

async function atualizarComponentes() {
  const selecionado = campos.componente.value;
  const parametros = new URLSearchParams({ material: campos.material.value, diametro: campos.diametro.value });
  try {
    estado.componentes = await requisitar(`/api/componentes?${parametros}`);
  } catch (falha) {
    estado.componentes = [];
    mostrarMensagem(campos.mensagemFormulario, falha.erro);
  }
  if (estado.componentes.length === 0) {
    preencherSelect(campos.componente, [{ valor: "", texto: "Nenhum componente disponível para esta combinação" }]);
  } else {
    preencherSelectAgrupado(
      campos.componente,
      estado.componentes.map((c) => ({
        valor: c.id,
        texto: `${c.nome} (${formatarDecimal(c.valor_unitario)} m${c.unidade_quantidade === "m" ? " por metro" : ""})`,
      })),
      selecionado,
    );
  }
  campos.botaoAdicionar.disabled = estado.componentes.length === 0;
  aoSelecionarComponente();
}

function componenteSelecionado() {
  return estado.componentes.find((c) => c.id === campos.componente.value);
}

// Miniatura da foto do componente, exibida na coluna "Foto" da tabela.
function criarFoto(imagem, nome) {
  const foto = document.createElement("img");
  foto.className = "foto-tabela";
  foto.src = imagem;
  foto.alt = `Foto: ${nome}`;
  foto.loading = "lazy";
  return foto;
}

function atualizarPreviaFormulario() {
  const componente = componenteSelecionado();
  campos.previaComponente.hidden = !componente?.imagem;
  if (componente?.imagem) {
    campos.previaComponente.src = componente.imagem;
    campos.previaComponente.alt = `Foto: ${componente.nome}`;
  }
}

function aoSelecionarComponente() {
  ajustarCampoQuantidade();
  atualizarPreviaFormulario();
}

function ajustarCampoQuantidade() {
  const emMetros = componenteSelecionado()?.unidade_quantidade === "m";
  campos.rotuloQuantidade.textContent = emMetros ? "Comprimento (m)" : "Quantidade";
  campos.quantidade.step = emMetros ? "0.01" : "1";
  campos.quantidade.min = emMetros ? "0.01" : "1";
  campos.quantidade.inputMode = emMetros ? "decimal" : "numeric";
}

function adicionarComponente(evento) {
  evento.preventDefault();
  const componente = componenteSelecionado();
  if (!componente) {
    mostrarMensagem(campos.mensagemFormulario, "Selecione um componente disponível.");
    return;
  }
  const quantidade = campos.quantidade.value.trim();
  const problema = validarQuantidade(quantidade, componente.unidade_quantidade);
  campos.quantidade.setAttribute("aria-invalid", problema ? "true" : "false");
  if (problema) {
    mostrarMensagem(campos.mensagemFormulario, problema);
    return;
  }
  mostrarMensagem(campos.mensagemFormulario, "");

  const material = estado.materiais.find((m) => m.id === campos.material.value);
  const diametro = estado.diametros.find((d) => d.id === campos.diametro.value);
  // O mesmo componente, com o mesmo material e diâmetro, soma na linha que já existe.
  const existente = estado.itens.find(
    (item) => item.componente === componente.id && item.material === material.id && item.diametro === diametro.id,
  );

  if (existente && componente.unidade_quantidade === "m") {
    const soma = somarMetros(existente.quantidade, quantidade);
    if (Number(soma) > LIMITE_METROS) {
      mostrarMensagem(campos.mensagemFormulario, `O comprimento máximo por item é ${LIMITE_METROS} m.`);
      return;
    }
    existente.quantidade = soma;
  } else if (existente) {
    const soma = Number(existente.quantidade) + Number(quantidade);
    if (soma > LIMITE_PECAS) {
      mostrarMensagem(campos.mensagemFormulario, `A quantidade máxima por item é ${LIMITE_PECAS}.`);
      return;
    }
    existente.quantidade = String(soma);
  } else {
    estado.itens.push({
      componente: componente.id,
      nome: componente.nome,
      material: material.id,
      materialRotulo: material.rotulo,
      diametro: diametro.id,
      unidadeQuantidade: componente.unidade_quantidade,
      quantidade,
      valorUnitario: componente.valor_unitario,
      imagem: componente.imagem,
    });
  }
  campos.quantidade.value = "1";
  marcarListaAlterada();
}

// ---------- Lista de itens ----------

function renderizarItens() {
  const linhasResultado = estado.resultado?.itens ?? [];
  const linhas = estado.itens.map((item, indice) => {
    const linha = document.createElement("tr");
    const diametro = estado.diametros.find((d) => d.id === item.diametro);
    const totalItem = linhasResultado[indice]?.comprimento_item;

    const celula = (texto, classe) => {
      const td = document.createElement("td");
      td.textContent = texto;
      if (classe) td.className = classe;
      return td;
    };

    const entrada = document.createElement("input");
    entrada.type = "number";
    entrada.value = item.quantidade.replace(",", ".");
    entrada.min = item.unidadeQuantidade === "m" ? "0.01" : "1";
    entrada.step = item.unidadeQuantidade === "m" ? "0.01" : "1";
    entrada.setAttribute("aria-label", `Quantidade de ${item.nome}`);
    entrada.addEventListener("change", () => alterarQuantidade(indice, entrada));
    const celulaQuantidade = celula("", "numero");
    celulaQuantidade.append(entrada);
    if (item.unidadeQuantidade === "m") celulaQuantidade.append(" m");

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "botao-remover";
    remover.textContent = "Remover";
    remover.setAttribute("aria-label", `Remover ${item.nome}`);
    remover.addEventListener("click", () => removerItem(indice));
    const celulaAcao = celula("", "nao-imprimir");
    celulaAcao.append(remover);

    const celulaFoto = celula("");
    if (item.imagem) celulaFoto.append(criarFoto(item.imagem, item.nome));

    linha.append(
      celulaFoto,
      celula(item.nome),
      celula(item.materialRotulo),
      celula(rotuloDiametro(diametro)),
      celulaQuantidade,
      celula(formatarDecimal(item.valorUnitario), "numero"),
      celula(totalItem ? formatarDecimal(totalItem) : "—", "numero"),
      celulaAcao,
    );
    return linha;
  });
  campos.corpoTabela.replaceChildren(...linhas);

  const total = estado.itens.length;
  campos.contador.textContent = `${total} ${total === 1 ? "item" : "itens"}`;
  campos.listaVazia.hidden = total > 0;
  campos.botaoLimpar.disabled = total === 0;
}

function alterarQuantidade(indice, entrada) {
  const item = estado.itens[indice];
  const problema = validarQuantidade(entrada.value, item.unidadeQuantidade);
  entrada.setAttribute("aria-invalid", problema ? "true" : "false");
  if (problema) {
    // O total some até a quantidade ser corrigida, para não exibir um valor desatualizado.
    estado.numeroRequisicao += 1;
    estado.calculando = false;
    estado.resultado = null;
    renderizarResultado();
    mostrarMensagem(campos.mensagemCalculo, `${item.nome}: ${problema}`);
    return;
  }
  item.quantidade = entrada.value.trim();
  marcarListaAlterada();
}

function removerItem(indice) {
  estado.itens.splice(indice, 1);
  marcarListaAlterada();
}

function limparCalculo() {
  estado.itens = [];
  mostrarNotaExemplo("");
  marcarListaAlterada();
}

function mostrarNotaExemplo(texto) {
  campos.notaExemplo.textContent = texto;
  campos.notaExemplo.hidden = !texto;
}

// Substitui a lista pelo exercício da aula (slide 48), definido no servidor.
async function carregarExemplo() {
  let exemplo;
  try {
    exemplo = await requisitar("/api/exemplo");
  } catch (falha) {
    mostrarMensagem(campos.mensagemFormulario, falha.erro);
    return;
  }
  mostrarMensagem(campos.mensagemFormulario, "");
  estado.itens = exemplo.itens.map((item) => ({
    componente: item.componente,
    nome: item.nome,
    material: item.material,
    materialRotulo: item.material_rotulo,
    diametro: item.diametro,
    unidadeQuantidade: item.unidade_quantidade,
    quantidade: item.quantidade,
    valorUnitario: item.valor_unitario,
    imagem: item.imagem,
  }));
  mostrarNotaExemplo(exemplo.titulo);
  marcarListaAlterada();
}

// ---------- Resultado ----------

// Toda mudança na lista dispara um novo cálculo no servidor.
function marcarListaAlterada() {
  estado.resultado = null;
  mostrarMensagem(campos.mensagemCalculo, "");
  renderizarItens();
  renderizarResultado();
  if (estado.itens.length > 0) calcular();
}

function renderizarResultado() {
  campos.botaoImprimir.hidden = !estado.resultado;
  campos.estadoResultado.classList.remove("desatualizado");
  if (estado.resultado) {
    campos.valorTotal.textContent = formatarDecimal(estado.resultado.comprimento_total);
    campos.estadoResultado.textContent = `Soma de ${estado.resultado.itens.length} ${estado.resultado.itens.length === 1 ? "item" : "itens"}.`;
    return;
  }
  campos.valorTotal.textContent = "—";
  if (estado.itens.length === 0) {
    campos.estadoResultado.textContent = "Adicione pelo menos um componente para calcular.";
  } else if (estado.calculando) {
    campos.estadoResultado.textContent = "Calculando…";
  } else {
    campos.estadoResultado.textContent = "Corrija os itens indicados para ver o total.";
    campos.estadoResultado.classList.add("desatualizado");
  }
}

async function calcular() {
  if (estado.itens.length === 0) return;
  const invalido = estado.itens.find((item) => validarQuantidade(item.quantidade, item.unidadeQuantidade));
  if (invalido) {
    mostrarMensagem(campos.mensagemCalculo, `Corrija a quantidade de ${invalido.nome} antes de calcular.`);
    return;
  }
  const corpo = {
    itens: estado.itens.map((item) => ({
      componente: item.componente,
      material: item.material,
      diametro: item.diametro,
      quantidade: item.unidadeQuantidade === "m" ? item.quantidade.replace(",", ".") : Number(item.quantidade),
    })),
  };
  // Se a lista mudar durante a requisição, só a resposta mais recente é exibida.
  const numero = ++estado.numeroRequisicao;
  estado.calculando = true;
  renderizarResultado();
  let resultado = null;
  let erro = "";
  try {
    resultado = await requisitar("/api/calcular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch (falha) {
    erro = falha.erro;
  }
  if (numero !== estado.numeroRequisicao) return;
  estado.calculando = false;
  estado.resultado = resultado;
  mostrarMensagem(campos.mensagemCalculo, erro);
  renderizarItens();
  renderizarResultado();
}

// Lista de compras do memorial: cada peça com material, diâmetro e quantidade a comprar.
function preencherListaCompras() {
  const linhas = (estado.resultado?.itens ?? []).map((item) => {
    const linha = document.createElement("tr");
    const diametro = estado.diametros.find((d) => d.id === item.diametro_id);
    const quantidade = item.unidade_quantidade === "m"
      ? `${formatarDecimal(item.quantidade)} m de tubo`
      : `${item.quantidade} ${item.quantidade === "1" ? "unidade" : "unidades"}`;
    [item.componente, item.material, rotuloDiametro(diametro), quantidade].forEach((texto, indice) => {
      const td = document.createElement("td");
      td.textContent = texto;
      if (indice === 3) td.className = "numero";
      linha.append(td);
    });
    return linha;
  });
  campos.corpoListaCompras.replaceChildren(...linhas);
}

// Abre o memorial de cálculo numa aba própria, montado pelo servidor como um
// documento A4 (cabeçalho, método, detalhamento, lista de materiais e total).
function imprimirMemorial() {
  const formulario = document.createElement("form");
  formulario.method = "post";
  formulario.action = "/memorial";
  formulario.target = "_blank";
  const dados = document.createElement("input");
  dados.type = "hidden";
  dados.name = "dados";
  dados.value = JSON.stringify({
    itens: estado.itens.map((item) => ({
      componente: item.componente,
      material: item.material,
      diametro: item.diametro,
      quantidade: item.unidadeQuantidade === "m" ? item.quantidade.replace(",", ".") : Number(item.quantidade),
    })),
  });
  formulario.append(dados);
  document.body.append(formulario);
  formulario.submit();
  formulario.remove();
}

// ---------- Eventos ----------

campos.material.addEventListener("change", atualizarComponentes);
campos.diametro.addEventListener("change", atualizarComponentes);
campos.componente.addEventListener("change", aoSelecionarComponente);
campos.form.addEventListener("submit", adicionarComponente);
campos.botaoLimpar.addEventListener("click", limparCalculo);
campos.botaoExemplo.addEventListener("click", carregarExemplo);
campos.botaoImprimir.addEventListener("click", imprimirMemorial);
document.querySelectorAll('input[name="exibicao-diametro"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    estado.exibicaoDiametro = radio.value;
    atualizarOpcoesDiametro();
    renderizarItens();
  });
});

renderizarItens();
renderizarResultado();
carregarCatalogo();
