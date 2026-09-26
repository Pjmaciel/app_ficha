// Aba Resumo de Combate: tudo o que se consulta durante a luta, pronto e com a composição de cada valor.
import { combate, dadosPorNivel, dano, golpe, totalAtributo } from '../../engine';
import type { ChaveCombate, Ficha, GolpeEspecial } from '../../model/types';
import {
  ROTULO_ATRIBUTO, ROTULO_COMBATE, blocoComposicao, comSinal, rolagem, type Linha,
} from '../componentes';
import type { Contexto } from '../contexto';
import { campo, definirTexto, entradaNumero, h } from '../dom';

const linhaFonte = (nome: string, valor: number): Linha => ({ rotulo: nome, valor: comSinal(valor) });

/** Linhas de dados: por nível, extras nomeados e, se houver, o extra do golpe. */
function linhasDados(f: Ficha, extras: { nome: string; valor: number }[], golpeExtra?: { nome: string; valor: number }): Linha[] {
  const linhas: Linha[] = [{ rotulo: `Dados por nível (nível ${f.identidade.nivel})`, valor: String(dadosPorNivel(f.identidade.nivel)) }];
  let total = dadosPorNivel(f.identidade.nivel);
  for (const e of extras) { linhas.push(linhaFonte(`Dados: ${e.nome}`, e.valor)); total += e.valor; }
  if (golpeExtra) { linhas.push(linhaFonte(`Dados: ${golpeExtra.nome}`, golpeExtra.valor)); total += golpeExtra.valor; }
  linhas.push({ rotulo: 'Total de dados', valor: String(total) });
  return linhas;
}

export function linhasCombate(f: Ficha, chave: ChaveCombate, golpeEspecial?: GolpeEspecial): Linha[] {
  const c = combate(f, chave);
  const golpeExtra = golpeEspecial ? { nome: golpeEspecial.nome, valor: golpeEspecial.dadosAtaqueExtras } : undefined;
  return [
    ...linhasDados(f, f.combate[chave].dadosExtras, golpeExtra),
    ...c.composicao.map((x) => linhaFonte(x.nome, x.valor)),
    { rotulo: 'Bônus total', valor: comSinal(c.total) },
  ];
}

export function linhasDano(f: Ficha, golpeEspecial?: GolpeEspecial): Linha[] {
  const d = f.dano;
  const r = dano(f, golpeEspecial);
  const attr = f.atributos[d.atributo];
  const linhas: Linha[] = linhasDados(
    f, d.dadosExtras,
    golpeEspecial ? { nome: golpeEspecial.nome, valor: golpeEspecial.dadosDanoExtras } : undefined,
  );
  linhas.push({ rotulo: `Multiplicador: ${ROTULO_ATRIBUTO[d.atributo]}`, valor: String(totalAtributo(attr)) });
  linhas.push({ rotulo: 'Bônus de nível', valor: String(attr.bonusNivel), subitem: true });
  linhas.push({ rotulo: 'Pontos', valor: String(attr.pontos), subitem: true });
  for (const e of attr.extras) linhas.push({ ...linhaFonte(e.nome, e.valor), subitem: true });
  for (const x of d.fixos) linhas.push(linhaFonte(`Fixo: ${x.nome}`, x.valor));
  if (r.fieisBonus > 0) linhas.push(linhaFonte(`Fiéis (+1 a cada ${d.fieisPor})`, r.fieisBonus));
  linhas.push({ rotulo: 'Dano', valor: r.texto });
  return linhas;
}

export interface OpcoesCartao {
  chave: string;
  titulo: string;
  texto: () => string;
  linhas: () => Linha[];
  detalhe?: () => string;
  destaque?: boolean;
}

/** Cartão com um valor grande, detalhe opcional e o botão de composição (reutilizado pela aba Batalha). */
export function cartaoValor(ctx: Contexto, op: OpcoesCartao): HTMLElement {
  const valor = h('p', { class: 'valor-grande' });
  const detalhe = h('p', { class: 'detalhe' });
  ctx.ligar(() => {
    definirTexto(valor, op.texto());
    if (op.detalhe) definirTexto(detalhe, op.detalhe());
  });
  return h('article', { class: op.destaque ? 'cartao destaque-cartao' : 'cartao' },
    h('h3', {}, op.titulo),
    valor,
    op.detalhe ? detalhe : null,
    blocoComposicao(ctx, op.chave, op.titulo, op.linhas));
}

function textoFieis(fieis: number, por: number | null, bonus: number): string {
  return por === null || por <= 0 ? 'não se aplica' : `⌊${fieis} ÷ ${por}⌋ = +${bonus}`;
}

function secaoFieis(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;
  const entrada = entradaNumero(f().fieis, (v) => { f().fieis = Math.max(0, v ?? 0); ctx.mudou(); }, { min: 0 });
  const calculo = h('p', { class: 'detalhe' });
  ctx.ligar(() => {
    const n = f().fieis;
    const partes = [
      `Ataque e aparar: ${textoFieis(n, f().combate.ataqueArmaBranca.fieisPor, combate(f(), 'ataqueArmaBranca').fieisBonus)}`,
      `Esquiva: ${textoFieis(n, f().combate.esquivar.fieisPor, combate(f(), 'esquivar').fieisBonus)}`,
      `Bloqueio: ${textoFieis(n, f().combate.bloquear.fieisPor, combate(f(), 'bloquear').fieisBonus)}`,
      `Dano: ${textoFieis(n, f().dano.fieisPor, dano(f()).fieisBonus)}`,
    ];
    definirTexto(calculo, partes.join(' · '));
  });
  return h('section', { class: 'cartao' },
    h('h3', {}, 'Fiéis'),
    campo('Fiéis vinculados', entrada),
    h('p', { class: 'detalhe' },
      'Os bônus passivos da planilha já incluem os fiéis atuais; este campo começa em 0 e soma o bônus por cima.'),
    calculo);
}

export function abaResumo(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;
  const arma = (): string => f().identidade.armaPrincipal.trim();
  const atq = (chave: ChaveCombate) => (): string => {
    const c = combate(f(), chave);
    return rolagem(c.dados, c.total);
  };

  const cartaoAtaque = cartaoValor(ctx, {
    chave: 'ataque-basico', titulo: 'Ataque básico', destaque: true,
    texto: atq('ataqueArmaBranca'),
    detalhe: () => (arma() ? `Arma: ${arma()}` : 'Sem arma principal definida'),
    linhas: () => linhasCombate(f(), 'ataqueArmaBranca'),
  });
  const cartaoDano = cartaoValor(ctx, {
    chave: 'dano-basico', titulo: 'Dano básico', destaque: true,
    texto: () => dano(f()).texto,
    linhas: () => linhasDano(f()),
  });

  const defesas = (['aparar', 'bloquear', 'esquivar'] as ChaveCombate[]).map((chave) =>
    cartaoValor(ctx, {
      chave: `defesa-${chave}`, titulo: ROTULO_COMBATE[chave], texto: atq(chave),
      linhas: () => linhasCombate(f(), chave),
    }));

  const outros = (['ataqueMagico', 'ataqueLuta', 'ataqueArmaFogo'] as ChaveCombate[]).map((chave) =>
    cartaoValor(ctx, {
      chave: `outro-${chave}`, titulo: ROTULO_COMBATE[chave], texto: atq(chave),
      linhas: () => linhasCombate(f(), chave),
    }));

  const blocosGolpes = f().golpes.map((g) => {
    const atual = (): GolpeEspecial => f().golpes.find((x) => x.id === g.id) ?? g;
    return h('section', { class: 'cartao golpe', 'aria-label': `Golpe especial ${g.nome}` },
      h('h3', {}, g.nome),
      h('div', { class: 'grade grade-larga' },
        cartaoValor(ctx, {
          chave: `golpe-${g.id}-ataque`, titulo: 'Ataque',
          texto: () => { const r = golpe(f(), atual()); return rolagem(r.ataqueDados, r.ataqueTotal); },
          linhas: () => linhasCombate(f(), 'ataqueArmaBranca', atual()),
        }),
        cartaoValor(ctx, {
          chave: `golpe-${g.id}-dano`, titulo: 'Dano',
          texto: () => golpe(f(), atual()).dano.texto,
          linhas: () => linhasDano(f(), atual()),
        })));
  });

  return h('div', { class: 'aba-resumo' },
    h('div', { class: 'grade grade-larga' }, cartaoAtaque, cartaoDano),
    h('h2', {}, 'Defesas'),
    h('div', { class: 'grade' }, ...defesas),
    ...(blocosGolpes.length > 0 ? [h('h2', {}, 'Golpes especiais'), ...blocosGolpes] : []),
    secaoFieis(ctx),
    h('h2', {}, 'Outros ataques'),
    h('div', { class: 'grade' }, ...outros),
  );
}
