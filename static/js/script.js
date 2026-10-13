"use strict";

// A interface só monta a lista e exibe valores: todo cálculo é feito pelo backend.

const LIMITE_PECAS = 10000;
const PADRAO_PECAS = /^\d+$/;
const PADRAO_METROS = /^\d+([.,]\d{1,2})?$/;

const estado = {
  materiais: [],
  diametros: [],
  componentes: [],
  itens: [],
  resultado: null,
  exibicaoDiametro: "pol",
};

const el = (id) => document.getElementById(id);
const campos = {
  form: el("form-componente"),
  material: el("material"),
  diametro: el("diametro"),
  componente: el("componente"),
  quantidade: el("quantidade"),
  rotuloQuantidade: el("rotulo-quantidade"),
  notaDn: el("nota-dn"),
  botaoAdicionar: el("botao-adicionar"),
  mensagemFormulario: el("mensagem-formulario"),
  corpoTabela: el("corpo-tabela"),
  listaVazia: el("lista-vazia"),
  contador: el("contador-itens"),
  botaoCalcular: el("botao-calcular"),
  botaoLimpar: el("botao-limpar"),
  botaoImprimir: el("botao-imprimir"),
  mensagemCalculo: el("mensagem-calculo"),
  valorTotal: el("valor-total"),
  estadoResultado: el("estado-resultado"),
  dataMemorial: el("data-memorial"),
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
    preencherSelect(
      campos.componente,
      estado.componentes.map((c) => ({
        valor: c.id,
        texto: `${c.nome} (${formatarDecimal(c.valor_unitario)} m${c.unidade_quantidade === "m" ? " por metro" : ""})`,
      })),
      selecionado,
    );
  }
  campos.botaoAdicionar.disabled = estado.componentes.length === 0;
  ajustarCampoQuantidade();
}

function componenteSelecionado() {
  return estado.componentes.find((c) => c.id === campos.componente.value);
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
  const existente = estado.itens.find(
    (item) => item.componente === componente.id && item.material === material.id
      && item.diametro === diametro.id && item.unidadeQuantidade === "un",
  );

  if (existente && componente.unidade_quantidade === "un") {
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

    linha.append(
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
  campos.botaoCalcular.disabled = total === 0;
  campos.botaoLimpar.disabled = total === 0;
  campos.botaoCalcular.title = total === 0 ? "Adicione pelo menos um componente para calcular." : "";
}

function alterarQuantidade(indice, entrada) {
  const item = estado.itens[indice];
  const problema = validarQuantidade(entrada.value, item.unidadeQuantidade);
  entrada.setAttribute("aria-invalid", problema ? "true" : "false");
  if (problema) {
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
  marcarListaAlterada();
}

// ---------- Resultado ----------

function marcarListaAlterada() {
  estado.resultado = null;
  mostrarMensagem(campos.mensagemCalculo, "");
  renderizarItens();
  renderizarResultado();
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
  } else {
    campos.estadoResultado.textContent = "Lista alterada. Clique em “Calcular comprimento equivalente”.";
    campos.estadoResultado.classList.add("desatualizado");
  }
}

async function calcular() {
  if (estado.itens.length === 0) {
    mostrarMensagem(campos.mensagemCalculo, "Adicione pelo menos um componente para calcular.");
    return;
  }
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
  campos.botaoCalcular.disabled = true;
  try {
    estado.resultado = await requisitar("/api/calcular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    mostrarMensagem(campos.mensagemCalculo, "");
  } catch (falha) {
    estado.resultado = null;
    mostrarMensagem(campos.mensagemCalculo, falha.erro);
  }
  renderizarItens();
  renderizarResultado();
}

function imprimirMemorial() {
  const agora = new Date();
  campos.dataMemorial.textContent = `Memorial de cálculo gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR")}.`;
  window.print();
}

// ---------- Eventos ----------

campos.material.addEventListener("change", atualizarComponentes);
campos.diametro.addEventListener("change", atualizarComponentes);
campos.componente.addEventListener("change", ajustarCampoQuantidade);
campos.form.addEventListener("submit", adicionarComponente);
campos.botaoCalcular.addEventListener("click", calcular);
campos.botaoLimpar.addEventListener("click", limparCalculo);
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
