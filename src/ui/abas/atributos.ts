// Aba Atributos: total, bônus de nível, pontos e extras nomeados, com subir de nível (fluxo em ./subir-nivel).
import { baseAtributo, diferencaAtributos, fontesDerivadasAtributo, pontosRestantes, totalAtributoFicha } from '../../engine';
import { ATRIBUTOS, ROTULO_ATRIBUTO, editorFontes } from '../componentes';
import type { Contexto } from '../contexto';
import { campo, definirTexto, entradaNumero, h } from '../dom';
import { controleSubirNivel } from './subir-nivel';

export function abaAtributos(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;

  const restantes = h('p', { class: 'resumo', role: 'status' });
  const diferenca = h('p', { class: 'resumo' });
  ctx.ligar(() => {
    const r = pontosRestantes(f());
    definirTexto(restantes, `Pontos restantes: ${r} (de ${f().regras.pontosIniciais})`);
    restantes.classList.toggle('alerta', r !== 0);
    const d = diferencaAtributos(f());
    definirTexto(diferenca, `Maior diferença entre bases: ${d.diferencia} (${ROTULO_ATRIBUTO[d.maior]} contra ${ROTULO_ATRIBUTO[d.menor]}; limite ${d.limite})`);
    diferenca.classList.toggle('alerta', d.excedeu);
  });

  const subir = controleSubirNivel(ctx);

  const linhas = ATRIBUTOS.map((id) => {
    const total = h('strong', { class: 'valor-tabela' });
    const base = h('span', { class: 'detalhe' });
    ctx.ligar(() => {
      definirTexto(total, String(totalAtributoFicha(f(), id)));
      definirTexto(base, `base ${baseAtributo(f().atributos[id])}`);
    });
    const bonusNivel = entradaNumero(f().atributos[id].bonusNivel, (v) => { f().atributos[id].bonusNivel = v ?? 0; ctx.mudou(); });
    const pontos = entradaNumero(f().atributos[id].pontos, (v) => { f().atributos[id].pontos = v ?? 0; ctx.mudou(); });
    return h('tr', {},
      h('th', { scope: 'row' }, ROTULO_ATRIBUTO[id]),
      h('td', { 'data-rotulo': 'Total' }, total, base),
      h('td', { 'data-rotulo': 'Bônus de nível' }, campo(`${ROTULO_ATRIBUTO[id]}: bônus de nível`, bonusNivel, true)),
      h('td', { 'data-rotulo': 'Pontos' }, campo(`${ROTULO_ATRIBUTO[id]}: pontos`, pontos, true)),
      h('td', { 'data-rotulo': 'Extras nomeados' },
        editorFontes(ctx, f().atributos[id].extras, {
          titulo: `Extras de ${ROTULO_ATRIBUTO[id]}`, adicionar: 'Adicionar extra', vazio: 'Sem extras.',
          derivadas: () => fontesDerivadasAtributo(f(), id),
        })));
  });

  return h('div', {},
    h('div', { class: 'barra-acoes' },
      h('div', {}, restantes, diferenca),
      subir.botao),
    subir.painel,
    h('div', { class: 'tabela-rolavel' },
      h('table', { class: 'tabela' },
        h('caption', { class: 'oculto' }, 'Atributos'),
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, 'Atributo'), h('th', { scope: 'col' }, 'Total'),
          h('th', { scope: 'col' }, 'Bônus de nível'), h('th', { scope: 'col' }, 'Pontos'),
          h('th', { scope: 'col' }, 'Extras nomeados'))),
        h('tbody', {}, ...linhas))),
  );
}
