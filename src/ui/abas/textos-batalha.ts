// Seção "Textos da batalha" (dentro da aba Poderes): edita as ações, as reações e os lembretes da aba Batalha.
import type { AcaoBatalha, Reacao } from '../../model/types';
import type { Contexto } from '../contexto';
import { campo, entradaTexto, h, novoIdItem } from '../dom';

interface OpcoesLista<T> {
  titulo: string;
  ajuda: string;
  adicionar: string;
  vazio: string;
  /** Rótulo do item para leitores de tela (ex.: "Ação 2"). */
  rotuloItem: (i: number) => string;
  novo: () => T;
  /** Campos editáveis do item `i`; gravam na lista (ou no próprio item) e chamam `mudou`. A lista é refeita após adicionar e remover, então `i` está sempre atual. */
  campos: (item: T, i: number, mudou: () => void) => HTMLElement[];
}

function areaTexto(valor: string, aoMudar: (v: string) => void): HTMLTextAreaElement {
  const el = h('textarea', { rows: 2 });
  el.value = valor;
  el.addEventListener('input', () => aoMudar(el.value));
  return el;
}

/** Lista editável com adicionar e remover; digitar só grava, adicionar e remover refazem a lista. */
function editorLista<T>(ctx: Contexto, itens: T[], op: OpcoesLista<T>): HTMLElement {
  const lista = h('ul', { class: 'lista-textos' });
  const desenhar = (focar = false): void => {
    lista.replaceChildren();
    if (itens.length === 0) lista.append(h('li', { class: 'vazio' }, op.vazio));
    itens.forEach((item, i) => {
      lista.append(h('li', { class: 'item-texto', role: 'group', 'aria-label': op.rotuloItem(i) },
        h('div', { class: 'campos-texto' }, ...op.campos(item, i, () => ctx.mudou())),
        h('button', {
          type: 'button', class: 'remover', 'aria-label': `Remover ${op.rotuloItem(i).toLowerCase()}`,
          onclick: () => { itens.splice(i, 1); desenhar(); ctx.mudou(); },
        }, 'Remover')));
    });
    if (focar) lista.lastElementChild?.querySelector<HTMLElement>('input, textarea')?.focus();
  };
  desenhar();
  return h('section', { class: 'cartao texto-batalha', 'aria-label': op.titulo },
    h('h3', {}, op.titulo),
    h('p', { class: 'detalhe' }, op.ajuda),
    lista,
    h('button', {
      type: 'button', class: 'destaque',
      onclick: () => { itens.push(op.novo()); desenhar(true); ctx.mudou(); },
    }, op.adicionar));
}

export function secaoTextosBatalha(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;
  return h('section', { class: 'textos-batalha', 'aria-label': 'Textos da batalha' },
    h('h2', {}, 'Textos da batalha'),
    h('p', { class: 'detalhe' }, 'Aparecem na aba Batalha. Edite, adicione ou remova à vontade.'),
    editorLista<AcaoBatalha>(ctx, f().acoes, {
      titulo: 'Ações', adicionar: 'Adicionar ação', vazio: 'Nenhuma ação cadastrada.',
      ajuda: 'Ações livres, como as de Tsu real: nome, rolagem em texto (ex.: "1d×48 direto no PV") e notas.',
      rotuloItem: (i) => `Ação ${i + 1}`,
      novo: () => ({ id: novoIdItem('acao'), nome: 'Nova ação', rolagem: '', notas: '' }),
      campos: (a, _i, mudou) => [
        campo('Nome', entradaTexto(a.nome, (v) => { a.nome = v; mudou(); }, 'Nome da ação')),
        campo('Rolagem', entradaTexto(a.rolagem, (v) => { a.rolagem = v; mudou(); }, 'Ex.: 1d×48 direto no PV')),
        campo('Notas', areaTexto(a.notas, (v) => { a.notas = v; mudou(); })),
      ],
    }),
    editorLista<Reacao>(ctx, f().reacoes, {
      titulo: 'Quando for atacado', adicionar: 'Adicionar reação', vazio: 'Nenhuma reação cadastrada.',
      ajuda: 'Guia de reação: a situação e o que fazer.',
      rotuloItem: (i) => `Reação ${i + 1}`,
      novo: () => ({ situacao: 'Nova situação', resposta: '' }),
      campos: (x, _i, mudou) => [
        campo('Situação', entradaTexto(x.situacao, (v) => { x.situacao = v; mudou(); }, 'Situação')),
        campo('Resposta', areaTexto(x.resposta, (v) => { x.resposta = v; mudou(); })),
      ],
    }),
    editorLista<string>(ctx, f().lembretes, {
      titulo: 'Lembretes', adicionar: 'Adicionar lembrete', vazio: 'Nenhum lembrete cadastrado.',
      ajuda: 'Regras para não esquecer durante a luta.',
      rotuloItem: (i) => `Lembrete ${i + 1}`,
      novo: () => '',
      campos: (texto, i, mudou) => [
        campo('Texto', areaTexto(texto, (v) => { f().lembretes[i] = v; mudou(); })),
      ],
    }));
}
