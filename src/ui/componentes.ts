// Rótulos, formatação e componentes reutilizados pelas abas.
import type { AtributoId, ChaveCombate, Elemento, Fonte, GrupoPericia, TipoPoder } from '../model/types';
import type { Contexto } from './contexto';
import { campo, definirTexto, entradaNumero, entradaTexto, h, limpar } from './dom';

export const ATRIBUTOS: AtributoId[] = ['forca', 'agilidade', 'reflexos', 'fortitude', 'distancia', 'mental'];

export const ROTULO_ATRIBUTO: Record<AtributoId, string> = {
  forca: 'Força', agilidade: 'Agilidade', reflexos: 'Reflexos',
  fortitude: 'Fortitude', distancia: 'Distância', mental: 'Mental',
};

export const ROTULO_GRUPO: Record<GrupoPericia, string> = {
  artes: 'Artes', ciencias: 'Ciências', crime: 'Crime', esporte: 'Esporte', idioma: 'Idioma',
  investigacao: 'Investigação', manipulacao: 'Manipulação', sobrevivencia: 'Sobrevivência',
  tecnologia: 'Tecnologia', combate: 'Combate',
};

export const CHAVES_COMBATE: ChaveCombate[] = [
  'ataqueArmaBranca', 'ataqueMagico', 'ataqueLuta', 'ataqueArmaFogo', 'aparar', 'bloquear', 'esquivar',
];

export const ROTULO_COMBATE: Record<ChaveCombate, string> = {
  ataqueArmaBranca: 'Ataque com arma branca', ataqueMagico: 'Ataque mágico',
  ataqueLuta: 'Ataque de luta', ataqueArmaFogo: 'Ataque com arma de fogo',
  esquivar: 'Esquivar', bloquear: 'Bloquear', aparar: 'Aparar',
};

export const ROTULO_ELEMENTO: Record<Elemento, string> = {
  fogo: 'Fogo', agua: 'Água', ar: 'Ar', terra: 'Terra', luz: 'Luz', trevas: 'Trevas',
};

export const ROTULO_TIPO_PODER: Record<TipoPoder, string> = {
  passivo: 'Passivo', ativo: 'Ativo', defensivo: 'Defensivo', item: 'Item', removido: 'Removido',
};

/** Número com sinal explícito: +1078 ou −5. */
export function comSinal(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** Rolagem no formato do jogo: "5d×100 +1078". */
export function rolagem(dados: number, bonus: number): string {
  return `${dados}d×100 ${comSinal(bonus)}`;
}

export const somaFontes = (fontes: Fonte[]): number => fontes.reduce((s, f) => s + f.valor, 0);

/** Linha de uma composição: origem do valor e sua parcela. */
export interface Linha { rotulo: string; valor: string; subitem?: boolean }

/**
 * Botão "composição" que abre a lista de fontes de um valor. A lista é refeita a cada
 * mudança (o texto acompanha a ficha) e o estado aberto/fechado sobrevive à recriação da aba.
 */
export function blocoComposicao(ctx: Contexto, chave: string, titulo: string, linhas: () => Linha[]): HTMLElement {
  const lista = h('ul', { class: 'composicao', id: `comp-${chave}` });
  const botao = h('button', { type: 'button', class: 'composicao-botao', 'aria-controls': `comp-${chave}` }, 'composição');
  const aplicarEstado = (): void => {
    const aberta = ctx.composicoesAbertas.has(chave);
    botao.setAttribute('aria-expanded', String(aberta));
    botao.setAttribute('aria-label', `${aberta ? 'Ocultar' : 'Mostrar'} a composição de ${titulo}`);
    lista.hidden = !aberta;
  };
  botao.addEventListener('click', () => {
    if (ctx.composicoesAbertas.has(chave)) ctx.composicoesAbertas.delete(chave);
    else ctx.composicoesAbertas.add(chave);
    aplicarEstado();
  });
  ctx.ligar(() => {
    aplicarEstado();
    limpar(lista);
    for (const l of linhas()) {
      lista.append(h('li', { class: l.subitem ? 'subitem' : '' }, h('span', {}, l.rotulo), h('strong', {}, l.valor)));
    }
  });
  return h('div', { class: 'bloco-composicao' }, botao, lista);
}

interface OpcoesEditorFontes {
  /** Nome da lista, usado nos rótulos de acessibilidade (ex.: "Extras de Força"). */
  titulo: string;
  /** Texto do botão de adicionar (ex.: "Adicionar extra"). */
  adicionar: string;
  /** Mostra o título e a soma acima da lista. */
  cabecalho?: boolean;
  vazio?: string;
}

/**
 * Editor de lista de fontes nomeadas (nome + valor). Altera a lista da ficha no lugar; adicionar e
 * remover refazem só esta lista, e digitar apenas recalcula os totais.
 */
export function editorFontes(ctx: Contexto, fontes: Fonte[], op: OpcoesEditorFontes): HTMLElement {
  const lista = h('ul', { class: 'lista-fontes' });
  const soma = h('span', { class: 'detalhe' });

  const desenhar = (focar?: number): void => {
    limpar(lista);
    if (fontes.length === 0) lista.append(h('li', { class: 'vazio' }, op.vazio ?? 'Nenhuma fonte.'));
    fontes.forEach((f, i) => {
      const nome = entradaTexto(f.nome, (v) => { f.nome = v; ctx.mudou(); }, 'Nome da fonte');
      const valor = entradaNumero(f.valor, (v) => { f.valor = v ?? 0; ctx.mudou(); });
      lista.append(h('li', { class: 'fonte' },
        campo(`${op.titulo}, item ${i + 1}: nome`, nome, true),
        campo(`${op.titulo}, item ${i + 1}: valor`, valor, true),
        h('button', {
          type: 'button', class: 'remover',
          'aria-label': `Remover ${f.nome || `item ${i + 1}`} de ${op.titulo}`,
          onclick: () => { fontes.splice(i, 1); desenhar(); ctx.mudou(); },
        }, 'Remover')));
    });
    if (focar !== undefined) lista.querySelectorAll<HTMLInputElement>('input[type="text"]')[focar]?.focus();
  };
  desenhar();

  ctx.ligar(() => definirTexto(soma, `Soma: ${somaFontes(fontes)}`));

  return h('div', { class: 'editor-fontes' },
    op.cabecalho ? h('div', { class: 'linha-titulo' }, h('strong', {}, op.titulo), soma) : null,
    lista,
    h('div', { class: 'acoes-fonte' },
      h('button', {
        type: 'button',
        onclick: () => { fontes.push({ nome: '', valor: 0 }); desenhar(fontes.length - 1); ctx.mudou(); },
      }, op.adicionar),
      op.cabecalho ? null : soma),
  );
}
