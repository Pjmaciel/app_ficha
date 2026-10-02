// Aba Identidade: dados do personagem, níveis, pontos de vida, experiência e regras.
import { descerPilar, fontesDerivadasPv, pilarTexto, progressoXp, pvBase, pvDaProtecaoDivina, pvTotal, subirPilar } from '../../engine';
import { PILAR_MAX, PILAR_MIN } from '../../model/pilar-padrao';
import type { Ficha, RegraNivel, Regras } from '../../model/types';
import { editorFontes } from '../componentes';
import type { Contexto } from '../contexto';
import { limitarPv } from '../sessao';
import { campo, definirTexto, entradaNumero, entradaTexto, h, selecao } from '../dom';
import { controleSubirNivel } from './subir-nivel';

type CampoTexto = 'nome' | 'jogador' | 'raca' | 'reino' | 'armaPrincipal';
type CampoNumeroId = 'nivel' | 'nivelLuganico' | 'basePv';
type CampoRegra = Exclude<keyof Regras, 'regraNivel'>;

const ROTULO_REGRA_NIVEL: Record<RegraNivel, string> = {
  livro: 'Livro (+10 em 4 atributos à escolha)',
  planilha: 'Planilha (+bônus por nível em todos os atributos)',
};

/** Acima do nível 40 a tabela de XP do livro não define o custo: o valor é extrapolação, editável. */
const NIVEL_MAX_TABELA_XP = 40;

/**
 * Pilar lugânico (informativo): nome e nível de 1 a 5 com subir e descer, sem efeito nos poderes.
 */
function secaoPilar(ctx: Contexto, exibido: HTMLElement): HTMLElement {
  const f = ctx.ficha;
  // Ao mudar o pilar, o PV total muda: o PV atual da sessão continua dentro do novo máximo.
  const mudarPilar = (nova: Ficha): void => {
    ctx.trocarFicha(nova);
    ctx.sessao().pvAtual = limitarPv(ctx, ctx.sessao().pvAtual);
    ctx.mudou();
  };
  const subir = h('button', { type: 'button', class: 'destaque', onclick: () => mudarPilar(subirPilar(f())) }, 'Subir o pilar');
  const descer = h('button', { type: 'button', onclick: () => mudarPilar(descerPilar(f())) }, 'Descer o pilar');
  ctx.ligar(() => {
    subir.disabled = f().pilar.nivel >= PILAR_MAX;
    descer.disabled = f().pilar.nivel <= PILAR_MIN;
  });
  return h('section', { class: 'cartao', 'aria-label': 'Pilar lugânico' },
    h('h3', {}, 'Pilar lugânico (aspecto do mundo)'),
    h('div', { class: 'campos' },
      campo('Pilar lugânico', entradaTexto(f().pilar.nome, (v) => { f().pilar.nome = v; ctx.mudou(); }))),
    h('p', {}, 'Pilar exibido na ficha: ', exibido, ` (nível de ${PILAR_MIN} a ${PILAR_MAX})`),
    h('div', { class: 'controles' }, descer, subir),
    h('p', { class: 'detalhe' },
      'Regra da mesa: o pilar é só informativo e não concede nem multiplica poderes. O nível de cada poder é o informado na aba Poderes '
      + '(poderes livres, itens e ajustes manuais); mudar o pilar não altera nenhum valor da ficha.'),
    h('p', { class: 'detalhe' },
      'Poderes com "Pilar mínimo" acima do nível do pilar geram um alerta e só funcionam quando o aspecto do mundo chegar a ele.'));
}

export function abaIdentidade(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;

  const texto = (rotulo: string, chave: CampoTexto): HTMLElement =>
    campo(rotulo, entradaTexto(f().identidade[chave], (v) => { f().identidade[chave] = v; ctx.mudou(); }));

  const numeroId = (rotulo: string, chave: CampoNumeroId, min: number): HTMLElement =>
    campo(rotulo, entradaNumero(f().identidade[chave], (v) => { f().identidade[chave] = v ?? 0; ctx.mudou(); }, { min }));

  const regra = (rotulo: string, chave: CampoRegra): HTMLElement =>
    campo(rotulo, entradaNumero(f().regras[chave], (v) => { f().regras[chave] = v ?? 0; ctx.mudou(); }));

  const xp = (rotulo: string, chave: 'total' | 'atual'): HTMLElement =>
    campo(rotulo, entradaNumero(f().xp[chave], (v) => { f().xp[chave] = v ?? 0; ctx.mudou(); }, { min: 0 }));

  const regraEvolucao = (): HTMLElement =>
    campo('Regra de evolução', selecao<RegraNivel>(
      (Object.keys(ROTULO_REGRA_NIVEL) as RegraNivel[]).map((r) => [r, ROTULO_REGRA_NIVEL[r]]),
      f().regras.regraNivel, (v) => { f().regras.regraNivel = v; ctx.mudou(); }));

  const textoXp = h('p', { class: 'resumo', role: 'status' });
  const preenchimentoXp = h('div', { class: 'preenchimento' });
  const barraXp = h('div', { class: 'barra xp', role: 'progressbar', 'aria-label': 'Experiência para o próximo nível', 'aria-valuemin': 0 }, preenchimentoXp);
  const textoPontosPoder = h('p', { class: 'resumo' });
  ctx.ligar(() => {
    const x = progressoXp(f());
    const extrapolacao = x.proximoNivel > NIVEL_MAX_TABELA_XP ? ' (extrapolação; confirme com o mestre)' : '';
    definirTexto(textoXp, `XP: ${x.atual} / ${x.necessario} para o nível ${x.proximoNivel}${extrapolacao}`);
    textoXp.classList.toggle('pronto', x.atingido);
    preenchimentoXp.style.width = `${Math.round(x.fracao * 100)}%`;
    barraXp.setAttribute('aria-valuemax', String(x.necessario));
    barraXp.setAttribute('aria-valuenow', String(Math.min(x.atual, x.necessario)));
    definirTexto(textoPontosPoder, `Pontos de poder disponíveis: ${f().pontosDePoderDisponiveis}`);
  });
  const subir = controleSubirNivel(ctx);

  const secaoNiveis = h('section', { class: 'cartao', 'aria-label': 'Níveis e experiência' },
    h('h3', {}, 'Níveis e experiência'),
    h('div', { class: 'campos' },
      numeroId('Nível', 'nivel', 1), numeroId('Nível lugânico (informativo; não existe no livro)', 'nivelLuganico', 0),
      xp('Experiência total (histórico)', 'total'), xp('Experiência atual (rumo ao próximo nível)', 'atual')),
    textoXp,
    barraXp,
    h('div', { class: 'campos' },
      regra('XP para o próximo nível', 'xpProximoNivel'), regra('Incremento de XP por nível', 'incrementoXpPorNivel'),
      regraEvolucao()),
    h('p', { class: 'detalhe' },
      'A tabela do livro (p. 31) é acumulada e vai até o nível 40; o custo de cada nível é a diferença entre linhas (20, 30, 40, 50). Acima do 40 o livro não define: '
      + '50 por nível, com incremento 0, é extrapolação do último degrau; confirme com o mestre e ajuste aqui.'),
    textoPontosPoder,
    h('div', { class: 'barra-acoes' }, subir.botao),
    subir.painel,
    h('p', { class: 'detalhe' },
      'Regra do livro, por nível divino: +10 em 4 atributos à escolha; nível par, +4 em todas as perícias; nível ímpar, +1 ponto de poder para gastar na aba Poderes. '
      + 'Subir desconta o XP necessário do XP atual e soma o incremento ao custo do nível seguinte.'));

  const pilarExibido = h('strong', {});
  ctx.ligar(() => definirTexto(pilarExibido, pilarTexto(f())));
  const cartaoPilar = secaoPilar(ctx, pilarExibido);

  const pvBaseTexto = h('strong', {});
  const pvTotalTexto = h('strong', {});
  const pvProtecaoTexto = h('strong', {});
  ctx.ligar(() => {
    definirTexto(pvBaseTexto, String(pvBase(f())));
    definirTexto(pvProtecaoTexto, String(pvDaProtecaoDivina(f())));
    definirTexto(pvTotalTexto, String(pvTotal(f())));
  });

  return h('div', { class: 'formulario' },
    h('section', { class: 'cartao' },
      h('h3', {}, 'Personagem'),
      h('div', { class: 'campos' },
        texto('Nome', 'nome'), texto('Jogador', 'jogador'), texto('Raça', 'raca'),
        texto('Reino', 'reino'), texto('Arma principal', 'armaPrincipal'))),
    cartaoPilar,
    secaoNiveis,
    h('section', { class: 'cartao' },
      h('h3', {}, 'Pontos de vida'),
      h('div', { class: 'campos' }, numeroId('PV por ponto de Fortitude', 'basePv', 0)),
      h('p', {}, 'PV base (PV por ponto × Fortitude): ', pvBaseTexto),
      h('p', {}, 'Parcela da Proteção Divina: ', pvProtecaoTexto),
      editorFontes(ctx, f().pvExtras, {
        titulo: 'PV extras', adicionar: 'Adicionar PV extra', cabecalho: true, vazio: 'Nenhum PV extra manual.',
        derivadas: () => fontesDerivadasPv(f()),
      }),
      h('p', {}, 'PV total: ', pvTotalTexto)),
    h('section', { class: 'cartao' },
      h('h3', {}, 'Regras da ficha'),
      h('div', { class: 'campos' },
        regra('Pontos iniciais', 'pontosIniciais'), regra('Bônus de nível por nível (regra da planilha)', 'bonusPorNivel'),
        regra('Nível de referência', 'nivelReferencia'), regra('Bônus na referência', 'bonusReferencia'),
        regra('Diferença máxima entre atributos', 'diferencaMaximaAtributos'))),
  );
}
