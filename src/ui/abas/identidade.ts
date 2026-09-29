// Aba Identidade: dados do personagem, níveis, pontos de vida, experiência e regras.
import { descerPilar, fontesDerivadasPv, pilarTexto, pvBase, pvDaProtecaoDivina, pvTotal, subirPilar } from '../../engine';
import { PILAR_MAX, PILAR_MIN } from '../../model/pilar-padrao';
import type { Ficha } from '../../model/types';
import { editorFontes } from '../componentes';
import type { Contexto } from '../contexto';
import { limitarPv } from '../sessao';
import { campo, definirTexto, entradaNumero, entradaTexto, h, limpar } from '../dom';

type CampoTexto = 'nome' | 'jogador' | 'raca' | 'reino' | 'armaPrincipal';
type CampoNumeroId = 'nivel' | 'nivelLuganico' | 'basePv';
type CampoRegra = keyof Ficha['regras'];

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
    h('section', { class: 'cartao' },
      h('h3', {}, 'Níveis e experiência'),
      h('div', { class: 'campos' },
        numeroId('Nível', 'nivel', 1), numeroId('Nível lugânico', 'nivelLuganico', 0),
        xp('Experiência total', 'total'), xp('Experiência atual', 'atual')),
      h('p', { class: 'detalhe' },
        'Para subir de nível somando o bônus a todos os atributos, use o botão da aba Atributos.')),
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
        regra('Pontos iniciais', 'pontosIniciais'), regra('Bônus de nível por nível', 'bonusPorNivel'),
        regra('Nível de referência', 'nivelReferencia'), regra('Bônus na referência', 'bonusReferencia'),
        regra('Diferença máxima entre atributos', 'diferencaMaximaAtributos'))),
  );
}
