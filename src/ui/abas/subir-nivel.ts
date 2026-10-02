// Fluxo de subir de nível, compartilhado pelas abas Identidade e Atributos.
// Regra do livro: escolha de 4 atributos (+10 cada) com prévia dos ganhos; regra da planilha: quantos níveis, +bonusPorNivel em todos.
import { comSinal, previaSubirNivel, progressoXp, subirNivel } from '../../engine';
import { ATRIBUTOS_POR_NIVEL, BONUS_ATRIBUTO_LIVRO } from '../../model/evolucao-padrao';
import type { AtributoId } from '../../model/types';
import { ATRIBUTOS, ROTULO_ATRIBUTO } from '../componentes';
import type { Contexto } from '../contexto';
import { definirTexto, h, limpar } from '../dom';

/** Regra da planilha: pergunta quantos níveis subir e soma o bônus por nível a todos os atributos. */
function subirPelaPlanilha(ctx: Contexto): void {
  const bonus = ctx.ficha().regras.bonusPorNivel;
  const resposta = window.prompt(`Quantos níveis subir? Cada nível soma ${bonus} ao bônus de nível de todos os atributos.`, '1');
  if (resposta === null) return;
  const quantos = Number(resposta.trim().replace(',', '.'));
  if (!Number.isInteger(quantos) || quantos < 1) {
    ctx.avisar('Quantidade de níveis inválida: informe um número inteiro maior que zero.');
    return;
  }
  const nova = subirNivel(ctx.ficha(), { quantos });
  ctx.trocarFicha(nova);
  ctx.avisar(`Subiu ${quantos} nível(is): agora nível ${nova.identidade.nivel}, bônus de nível ${nova.atributos.forca.bonusNivel}.`);
}

/**
 * Botão "Subir de nível" e o painel de escolha (oculto até o clique). Na regra do livro o botão pede confirmação quando o XP
 * ainda não chegou ao necessário; o painel só aplica com exatamente quatro atributos marcados.
 */
export function controleSubirNivel(ctx: Contexto): { botao: HTMLButtonElement; painel: HTMLElement } {
  const f = ctx.ficha;
  const escolhidos = new Set<AtributoId>();
  const painel = h('section', { class: 'cartao painel-subir-nivel', 'aria-label': 'Escolha para subir de nível', hidden: true });
  const botao = h('button', { type: 'button', class: 'destaque' }, 'Subir de nível');

  const titulo = h('h4', {});
  const contagem = h('p', { class: 'resumo', role: 'status' });
  const ganhos = h('ul', { class: 'ganhos-nivel', 'aria-label': 'Prévia dos ganhos' });
  const aviso = h('p', { class: 'resumo alerta' });
  const confirmar = h('button', { type: 'button', class: 'destaque' }, 'Confirmar e subir de nível');
  const cancelar = h('button', { type: 'button' }, 'Cancelar');

  const caixas = ATRIBUTOS.map((id) => {
    const caixa = h('input', { type: 'checkbox', 'data-atributo': id });
    const rotulo = h('span', {});
    caixa.addEventListener('change', () => {
      if (caixa.checked) escolhidos.add(id);
      else escolhidos.delete(id);
      atualizar();
    });
    return { id, caixa, rotulo, elemento: h('label', { class: 'marcador' }, caixa, rotulo) };
  });

  function atualizar(): void {
    const ficha = f();
    const previa = previaSubirNivel(ficha, [...escolhidos]);
    definirTexto(titulo, `Subir para o nível ${previa.novoNivel}`);
    definirTexto(contagem, `Atributos escolhidos: ${escolhidos.size} de ${ATRIBUTOS_POR_NIVEL}.`);
    for (const c of caixas) {
      const bonus = ficha.atributos[c.id].bonusNivel;
      definirTexto(c.rotulo, `${ROTULO_ATRIBUTO[c.id]}: bônus de nível ${bonus}${escolhidos.has(c.id) ? ` → ${bonus + BONUS_ATRIBUTO_LIVRO}` : ''}`);
    }
    limpar(ganhos);
    if (previa.atributos.length > 0) {
      ganhos.append(h('li', {}, `${comSinal(BONUS_ATRIBUTO_LIVRO)} no bônus de nível de ${previa.atributos.map((a) => ROTULO_ATRIBUTO[a.id]).join(', ')}.`));
    }
    ganhos.append(h('li', {}, previa.bonusPericias > 0
      ? `Nível ${previa.novoNivel} é par: ${comSinal(previa.bonusPericias)} na graduação de todas as perícias.`
      : `Nível ${previa.novoNivel} é ímpar: perícias inalteradas e +${previa.pontosDePoder} ponto de poder (de ${ficha.pontosDePoderDisponiveis} para ${ficha.pontosDePoderDisponiveis + previa.pontosDePoder}).`));
    ganhos.append(h('li', {}, `XP atual: ${ficha.xp.atual} → ${previa.xpAtualDepois} (desconta ${ficha.regras.xpProximoNivel}, sem ficar negativo); o nível seguinte custará ${previa.xpProximoNivelDepois}.`));
    const d = previa.diferenca;
    definirTexto(aviso, d.excedeu
      ? `Com essa escolha, a diferença entre o maior (${ROTULO_ATRIBUTO[d.maior]}) e o menor (${ROTULO_ATRIBUTO[d.menor]}) atributo fica em ${d.diferencia}, acima do limite de ${d.limite} sem bônus.`
      : '');
    aviso.hidden = !d.excedeu;
    confirmar.disabled = !previa.completa;
  }

  const fechar = (): void => { painel.hidden = true; };

  botao.addEventListener('click', () => {
    const ficha = f();
    if (ficha.regras.regraNivel === 'planilha') {
      subirPelaPlanilha(ctx);
      return;
    }
    const xp = progressoXp(ficha);
    if (!xp.atingido && !window.confirm(`XP insuficiente: ${xp.atual} de ${xp.necessario} para o nível ${xp.proximoNivel}. Subir de nível mesmo assim?`)) return;
    escolhidos.clear();
    for (const c of caixas) c.caixa.checked = false;
    painel.hidden = false;
    atualizar();
    caixas[0].caixa.focus();
  });

  cancelar.addEventListener('click', () => { fechar(); botao.focus(); });
  confirmar.addEventListener('click', () => {
    if (confirmar.disabled) return;
    const atributos = [...escolhidos];
    const nova = subirNivel(f(), { atributos });
    ctx.trocarFicha(nova);
    const nivel = nova.identidade.nivel;
    const nomes = atributos.map((id) => ROTULO_ATRIBUTO[id]).join(', ');
    ctx.avisar(`Subiu para o nível ${nivel}: +${BONUS_ATRIBUTO_LIVRO} em ${nomes}; ${nivel % 2 === 0 ? '+4 em todas as perícias' : '+1 ponto de poder'}.`);
  });

  painel.append(
    titulo,
    h('p', { class: 'detalhe' }, `Escolha exatamente ${ATRIBUTOS_POR_NIVEL} atributos para receber +${BONUS_ATRIBUTO_LIVRO} no bônus de nível (regra do livro, p. 74 a 77).`),
    h('div', { class: 'grade' }, ...caixas.map((c) => c.elemento)),
    contagem,
    ganhos,
    aviso,
    h('div', { class: 'controles' }, cancelar, confirmar));

  ctx.ligar(() => {
    const ficha = f();
    const livro = ficha.regras.regraNivel !== 'planilha';
    const atingido = progressoXp(ficha).atingido;
    definirTexto(botao, livro && !atingido ? 'Subir de nível (forçar)' : 'Subir de nível');
    botao.className = !livro || atingido ? 'destaque' : '';
    if (!livro) fechar();
    if (!painel.hidden) atualizar();
  });

  return { botao, painel };
}
