// Aba Perícias: uma tabela por grupo, com busca que apenas esconde linhas (nenhum campo é recriado).
import { totalPericia } from '../../engine';
import type { AtributoId, GrupoPericia } from '../../model/types';
import { ATRIBUTOS, ROTULO_ATRIBUTO, ROTULO_GRUPO } from '../componentes';
import type { Contexto } from '../contexto';
import { campo, definirTexto, entradaNumero, h, selecao } from '../dom';

export function abaPericias(ctx: Contexto, busca: { termo: string }): HTMLElement {
  const f = ctx.ficha;
  const linhasPorGrupo: { secao: HTMLElement; linhas: { tr: HTMLElement; nome: string }[] }[] = [];

  for (const grupo of Object.keys(ROTULO_GRUPO) as GrupoPericia[]) {
    const pericias = f().pericias.filter((p) => p.grupo === grupo);
    if (pericias.length === 0) continue;
    const linhas = pericias.map((p) => {
      const total = h('strong', { class: 'valor-tabela' });
      ctx.ligar(() => definirTexto(total, String(totalPericia(f(), p.id))));
      const inicial = entradaNumero(p.inicial, (v) => { p.inicial = v ?? 0; ctx.mudou(); });
      const graduacao = entradaNumero(p.graduacao, (v) => { p.graduacao = v ?? 0; ctx.mudou(); });
      const atributo = selecao<AtributoId>(
        ATRIBUTOS.map((id) => [id, ROTULO_ATRIBUTO[id]]), p.atributo,
        (v) => { p.atributo = v; ctx.mudou(); });
      const tr = h('tr', {},
        h('th', { scope: 'row' }, p.nome),
        h('td', { 'data-rotulo': 'Total' }, total),
        h('td', { 'data-rotulo': 'Inicial' }, campo(`${p.nome}: inicial`, inicial, true)),
        h('td', { 'data-rotulo': 'Atributo' }, campo(`${p.nome}: atributo`, atributo, true)),
        h('td', { 'data-rotulo': 'Graduação' }, campo(`${p.nome}: graduação`, graduacao, true)));
      return { tr, nome: p.nome.toLocaleLowerCase('pt-BR') };
    });
    const secao = h('section', { class: 'cartao grupo' },
      h('h3', {}, ROTULO_GRUPO[grupo]),
      h('div', { class: 'tabela-rolavel' },
        h('table', { class: 'tabela' },
          h('caption', { class: 'oculto' }, `Perícias de ${ROTULO_GRUPO[grupo]}`),
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col' }, 'Perícia'), h('th', { scope: 'col' }, 'Total'),
            h('th', { scope: 'col' }, 'Inicial'), h('th', { scope: 'col' }, 'Atributo'),
            h('th', { scope: 'col' }, 'Graduação'))),
          h('tbody', {}, ...linhas.map((l) => l.tr)))));
    linhasPorGrupo.push({ secao, linhas });
  }

  const vazio = h('p', { class: 'vazio', role: 'status' }, 'Nenhuma perícia encontrada.');
  const filtrar = (): void => {
    const termo = busca.termo.trim().toLocaleLowerCase('pt-BR');
    let achou = false;
    for (const g of linhasPorGrupo) {
      let visivel = false;
      for (const l of g.linhas) {
        const mostra = l.nome.includes(termo);
        l.tr.hidden = !mostra;
        visivel ||= mostra;
      }
      g.secao.hidden = !visivel;
      achou ||= visivel;
    }
    vazio.hidden = achou;
  };

  const entradaBusca = h('input', { type: 'search', value: busca.termo, placeholder: 'Buscar perícia por nome', autocomplete: 'off' });
  entradaBusca.addEventListener('input', () => { busca.termo = entradaBusca.value; filtrar(); });
  filtrar();

  return h('div', {},
    campo('Buscar perícia por nome', entradaBusca, true),
    vazio,
    h('div', { class: 'grupos' }, ...linhasPorGrupo.map((g) => g.secao)));
}
