// Aba Poderes: cadastro completo; poderes do tipo "removido" continuam listados, em cinza.
import { comSinal, mostraNaBatalha, usosPorDiaDoPoder } from '../../engine';
import type { AtributoId, ChaveCombate, EscalaPoder, Poder, TipoPoder } from '../../model/types';
import { ATRIBUTOS, CHAVES_COMBATE, ROTULO_ATRIBUTO, ROTULO_COMBATE, ROTULO_TIPO_PODER } from '../componentes';
import type { Contexto } from '../contexto';
import { campo, definirTexto, definirValor, entradaNumero, entradaTexto, h, novoIdItem, selecao } from '../dom';
import { secaoTextosBatalha } from './textos-batalha';

const TIPOS = Object.keys(ROTULO_TIPO_PODER) as TipoPoder[];

type CampoEscala = 'danoPorNivel' | 'pvPorNivel' | 'usosPorNivel' | 'fieisPorNivel' | 'dadosAtaquePorNivel' | 'dadosDanoPorNivel';

const CAMPOS_ESCALA: [CampoEscala, string][] = [
  ['danoPorNivel', 'Dano fixo por nível'],
  ['pvPorNivel', 'PV por nível'],
  ['usosPorNivel', 'Usos por dia por nível'],
  ['fieisPorNivel', 'Fiéis por nível (informativo)'],
  ['dadosAtaquePorNivel', 'Dados de ataque por nível (golpe de mesmo id)'],
  ['dadosDanoPorNivel', 'Dados de dano por nível (golpe de mesmo id)'],
];

/** Efeitos do poder no nível atual, em texto: "Ataques e defesas +150; dano fixo +60". */
export function resumoEfeitos(p: Poder): string {
  const e = p.escala;
  const nivel = p.nivel ?? 0;
  if (!e) return 'Sem escala numérica.';
  const partes: string[] = [];
  const porValor = new Map<number, string[]>();
  for (const chave of CHAVES_COMBATE) {
    const c = e.ataquePorNivel?.[chave];
    if (c !== undefined && c !== 0) porValor.set(c, [...(porValor.get(c) ?? []), ROTULO_COMBATE[chave].toLowerCase()]);
  }
  for (const [coeficiente, chaves] of porValor) {
    partes.push(`${chaves.length === CHAVES_COMBATE.length ? 'todos os ataques e defesas' : chaves.join(', ')} ${comSinal(coeficiente * nivel)}`);
  }
  if (e.danoPorNivel) partes.push(`dano fixo ${comSinal(e.danoPorNivel * nivel)}`);
  if (e.atributoPorNivel && e.atributoPorNivel.valor !== 0) {
    partes.push(`${ROTULO_ATRIBUTO[e.atributoPorNivel.atributo]} ${comSinal(e.atributoPorNivel.valor * nivel)}`);
  }
  if (e.pvPorNivel) partes.push(`PV ${comSinal(e.pvPorNivel * nivel)}`);
  const usos = usosPorDiaDoPoder(p);
  if (e.usosPorNivel !== undefined && usos !== undefined) partes.push(`${usos} ${usos === 1 ? 'uso' : 'usos'} por dia`);
  if (e.fieisPorNivel) partes.push(`${(e.fieisPorNivel * nivel).toLocaleString('pt-BR')} fiéis`);
  if (e.dadosAtaquePorNivel) partes.push(`golpe: ${comSinal(e.dadosAtaquePorNivel * nivel)}d de ataque`);
  if (e.dadosDanoPorNivel) partes.push(`golpe: ${comSinal(e.dadosDanoPorNivel * nivel)}d de dano`);
  return partes.length > 0 ? `No nível ${nivel}: ${partes.join('; ')}.` : 'Sem escala numérica.';
}

/** Escala editável do poder: coeficientes por nível; campo vazio remove o coeficiente. */
function secaoEscala(ctx: Contexto, p: Poder, usos: HTMLInputElement): HTMLElement {
  const escala = (): EscalaPoder => (p.escala ??= {});
  const resumo = h('p', { class: 'detalhe resumo-escala' });
  ctx.ligar(() => definirTexto(resumo, resumoEfeitos(p)));

  const numero = (rotulo: string, atual: number | undefined, gravar: (v: number | null) => void): HTMLElement =>
    campo(rotulo, entradaNumero(atual ?? null, (v) => { gravar(v); ctx.mudou(); }, { aceitaVazio: true }));

  const porChave = CHAVES_COMBATE.map((chave: ChaveCombate) =>
    numero(`${ROTULO_COMBATE[chave]} por nível`, p.escala?.ataquePorNivel?.[chave], (v) => {
      const e = escala();
      const restante = { ...e.ataquePorNivel };
      if (v === null) delete restante[chave];
      else restante[chave] = v;
      if (Object.keys(restante).length > 0) e.ataquePorNivel = restante;
      else delete e.ataquePorNivel;
    }));

  const outros = CAMPOS_ESCALA.map(([chave, rotulo]) =>
    numero(rotulo, p.escala?.[chave], (v) => {
      // Ao limpar os usos por nível, o valor derivado vira o valor manual, para o poder não perder o limite.
      if (chave === 'usosPorNivel' && v === null) {
        const derivado = usosPorDiaDoPoder(p);
        if (derivado !== undefined) p.usosPorDia = derivado;
      }
      const e = escala();
      if (v === null) delete e[chave];
      else e[chave] = v;
    }));

  let atributoAtual: AtributoId | '' = p.escala?.atributoPorNivel?.atributo ?? '';
  let valorAtributo = p.escala?.atributoPorNivel?.valor ?? 0;
  const gravarAtributo = (): void => {
    const e = escala();
    if (atributoAtual === '') delete e.atributoPorNivel;
    else e.atributoPorNivel = { atributo: atributoAtual, valor: valorAtributo };
    ctx.mudou();
  };
  const seletor = selecao<AtributoId | ''>(
    [['', 'Nenhum'], ...ATRIBUTOS.map((id): [AtributoId, string] => [id, ROTULO_ATRIBUTO[id]])],
    atributoAtual, (v) => { atributoAtual = v; gravarAtributo(); });
  const valor = entradaNumero(valorAtributo, (v) => { valorAtributo = v ?? 0; if (atributoAtual !== '') gravarAtributo(); });

  // Os usos por dia derivados da escala não se editam aqui: o campo mostra o valor calculado.
  ctx.ligar(() => {
    const derivado = p.escala?.usosPorNivel !== undefined && p.nivel !== null;
    usos.disabled = derivado;
    usos.title = derivado ? 'Derivado da escala: usos por nível × nível do poder.' : '';
    if (derivado) definirValor(usos, String(usosPorDiaDoPoder(p)));
  });

  return h('details', { class: 'escala-poder' },
    h('summary', {}, 'Escala por nível'),
    h('p', { class: 'detalhe' },
      'Cada coeficiente multiplica o nível do poder e soma às fontes manuais; as parcelas aparecem com o nome do poder e "nível N" nas abas Atributos, Combate e Identidade.'),
    resumo,
    h('div', { class: 'campos' }, ...porChave),
    h('div', { class: 'campos' },
      ...outros,
      campo('Atributo por nível', seletor),
      campo('Valor do atributo por nível', valor)));
}

export function abaPoderes(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;
  const lista = h('div', { class: 'lista-poderes' });

  const cartao = (p: Poder, i: number): HTMLElement => {
    const nome = entradaTexto(p.nome, (v) => { p.nome = v; ctx.mudou(); }, 'Nome do poder');
    const raiz = h('article', { class: p.tipo === 'removido' ? 'cartao poder removido' : 'cartao poder' });
    const marca = h('input', { type: 'checkbox', checked: mostraNaBatalha(p), disabled: p.tipo === 'removido' });
    marca.addEventListener('change', () => { p.mostrarNaBatalha = marca.checked; ctx.mudou(); });
    const tipo = selecao<TipoPoder>(TIPOS.map((t) => [t, ROTULO_TIPO_PODER[t]]), p.tipo, (v) => {
      p.tipo = v;
      raiz.classList.toggle('removido', v === 'removido');
      // Sem escolha explícita, a marca segue o tipo (defensivo e item aparecem por padrão).
      marca.checked = mostraNaBatalha(p);
      marca.disabled = v === 'removido';
      ctx.mudou();
    });
    const descricao = h('textarea', { rows: 4 });
    descricao.value = p.descricao;
    descricao.addEventListener('input', () => { p.descricao = descricao.value; ctx.mudou(); });
    const entradaOpcional = (chave: 'custoFadiga' | 'usosPorDia'): HTMLInputElement =>
      entradaNumero(p[chave] ?? null, (v) => {
        if (v === null) delete p[chave];
        else p[chave] = v;
        ctx.mudou();
      }, { min: 0, aceitaVazio: true });
    const usos = entradaOpcional('usosPorDia');
    raiz.append(
      h('div', { class: 'campos' },
        campo('Nome', nome),
        campo('Nível (vazio = sem nível)', entradaNumero(p.nivel, (v) => { p.nivel = v; ctx.mudou(); }, { min: 0, aceitaVazio: true })),
        campo('Tipo', tipo),
        campo('Custo de fadiga', entradaOpcional('custoFadiga')),
        campo('Usos por dia', usos)),
      campo('Descrição', descricao),
      secaoEscala(ctx, p, usos),
      h('label', { class: 'marcador' }, marca, h('span', {}, 'Mostrar na aba Batalha (absorções e proteções)')),
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
      'Só entram no painel de sessão os poderes com custo de fadiga ou usos por dia e tipo diferente de Removido. Poderes defensivos e itens aparecem por padrão na aba Batalha; os demais, se marcados.'),
    lista,
    h('button', {
      type: 'button', class: 'destaque',
      onclick: () => {
        f().poderes.push({ id: novoIdItem('poder'), nome: 'Novo poder', nivel: null, tipo: 'passivo', descricao: '' });
        desenhar(f().poderes.length - 1);
        ctx.mudou();
      },
    }, 'Adicionar poder'),
    secaoTextosBatalha(ctx));
}
