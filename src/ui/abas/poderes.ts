// Aba Poderes: cadastro completo; poderes do tipo "removido" continuam listados, em cinza.
import type { Poder, TipoPoder } from '../../model/types';
import { ROTULO_TIPO_PODER } from '../componentes';
import type { Contexto } from '../contexto';
import { campo, entradaNumero, entradaTexto, h, novoIdItem, selecao } from '../dom';

const TIPOS = Object.keys(ROTULO_TIPO_PODER) as TipoPoder[];

export function abaPoderes(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;
  const lista = h('div', { class: 'lista-poderes' });

  const cartao = (p: Poder, i: number): HTMLElement => {
    const nome = entradaTexto(p.nome, (v) => { p.nome = v; ctx.mudou(); }, 'Nome do poder');
    const raiz = h('article', { class: p.tipo === 'removido' ? 'cartao poder removido' : 'cartao poder' });
    const tipo = selecao<TipoPoder>(TIPOS.map((t) => [t, ROTULO_TIPO_PODER[t]]), p.tipo, (v) => {
      p.tipo = v;
      raiz.classList.toggle('removido', v === 'removido');
      ctx.mudou();
    });
    const descricao = h('textarea', { rows: 4 });
    descricao.value = p.descricao;
    descricao.addEventListener('input', () => { p.descricao = descricao.value; ctx.mudou(); });
    const opcional = (rotulo: string, chave: 'custoFadiga' | 'usosPorDia'): HTMLElement =>
      campo(rotulo, entradaNumero(p[chave] ?? null, (v) => {
        if (v === null) delete p[chave];
        else p[chave] = v;
        ctx.mudou();
      }, { min: 0, aceitaVazio: true }));
    raiz.append(
      h('div', { class: 'campos' },
        campo('Nome', nome),
        campo('Nível (vazio = sem nível)', entradaNumero(p.nivel, (v) => { p.nivel = v; ctx.mudou(); }, { min: 0, aceitaVazio: true })),
        campo('Tipo', tipo),
        opcional('Custo de fadiga', 'custoFadiga'),
        opcional('Usos por dia', 'usosPorDia')),
      campo('Descrição', descricao),
      h('button', {
        type: 'button', class: 'remover',
        onclick: () => {
          if (!window.confirm(`Remover o poder "${p.nome || 'sem nome'}"? Para apenas desativá-lo, mude o tipo para Removido.`)) return;
          f().poderes.splice(i, 1);
          delete ctx.sessao().usosPoder[p.id];
          desenhar();
          ctx.mudou();
        },
      }, 'Remover poder'));
    return raiz;
  };

  const desenhar = (focar?: number): void => {
    lista.replaceChildren();
    if (f().poderes.length === 0) lista.append(h('p', { class: 'vazio' }, 'Nenhum poder cadastrado.'));
    f().poderes.forEach((p, i) => lista.append(cartao(p, i)));
    if (focar !== undefined) lista.querySelectorAll<HTMLInputElement>('input[type="text"]')[focar]?.focus();
  };
  desenhar();

  return h('div', {},
    h('p', { class: 'detalhe' },
      'Só entram no painel de sessão os poderes com custo de fadiga ou usos por dia e tipo diferente de Removido.'),
    lista,
    h('button', {
      type: 'button', class: 'destaque',
      onclick: () => {
        f().poderes.push({ id: novoIdItem('poder'), nome: 'Novo poder', nivel: null, tipo: 'passivo', descricao: '' });
        desenhar(f().poderes.length - 1);
        ctx.mudou();
      },
    }, 'Adicionar poder'));
}
