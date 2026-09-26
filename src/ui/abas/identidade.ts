// Aba Identidade: dados do personagem, níveis, pontos de vida, experiência e regras.
import { fontesDerivadasPv, pilarTexto, pvBase, pvTotal } from '../../engine';
import type { Ficha } from '../../model/types';
import { editorFontes } from '../componentes';
import type { Contexto } from '../contexto';
import { campo, definirTexto, entradaNumero, entradaTexto, h } from '../dom';

type CampoTexto = 'nome' | 'jogador' | 'raca' | 'reino' | 'pilarLuganico' | 'armaPrincipal';
type CampoNumeroId = 'nivel' | 'nivelLuganico' | 'basePv' | 'pilarNivel';
type CampoRegra = keyof Ficha['regras'];

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

  const pvBaseTexto = h('strong', {});
  const pvTotalTexto = h('strong', {});
  ctx.ligar(() => {
    definirTexto(pvBaseTexto, String(pvBase(f())));
    definirTexto(pvTotalTexto, String(pvTotal(f())));
  });

  return h('div', { class: 'formulario' },
    h('section', { class: 'cartao' },
      h('h3', {}, 'Personagem'),
      h('div', { class: 'campos' },
        texto('Nome', 'nome'), texto('Jogador', 'jogador'), texto('Raça', 'raca'),
        texto('Reino', 'reino'), texto('Pilar lugânico', 'pilarLuganico'), numeroId('Nível do pilar (aspecto do mundo, 1 a 5)', 'pilarNivel', 0),
        texto('Arma principal', 'armaPrincipal')),
      h('p', { class: 'detalhe' }, 'Pilar exibido na ficha: ', pilarExibido,
        '. Poderes com "Pilar mínimo" acima desse nível geram um alerta e só funcionam quando o aspecto do mundo chegar a ele.')),
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
