// Aba Poderes: cadastro completo; poderes do tipo "removido" continuam listados, em cinza.
import { comSinal, efeitosDoPoder, formatarNumero, composicaoDoPoder, mostraNaBatalha, resolverTexto, usosPorDiaDoPoder } from '../../engine';
import type { AtributoId, ChaveCombate, EfeitoEscalavel, EscalaPoder, PatamarPoder, OrigemPoder, Poder, TipoPoder } from '../../model/types';
import { ATRIBUTOS, CHAVES_COMBATE, previaViva, ROTULO_ATRIBUTO, ROTULO_COMBATE, ROTULO_TIPO_PODER } from '../componentes';
import type { Contexto } from '../contexto';
import { campo, definirTexto, definirValor, entradaNumero, entradaTexto, h, limpar, novoIdItem, selecao } from '../dom';
import { secaoTextosBatalha } from './textos-batalha';

const TIPOS = Object.keys(ROTULO_TIPO_PODER) as TipoPoder[];

const ROTULO_ORIGEM: Record<OrigemPoder, string> = { livre: 'Livre', item: 'Item', manual: 'Manual' };
const ORIGENS = Object.keys(ROTULO_ORIGEM) as OrigemPoder[];

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
  for (const x of efeitosDoPoder(p)) {
    if (!x.reservado && x.valor !== 0) partes.push(`${x.rotulo.toLowerCase()} ${formatarNumero(x.valor)}${x.unidade ? ` ${x.unidade}` : ''}`);
  }
  return partes.length > 0 ? `No nível ${nivel}: ${partes.join('; ')}.` : 'Sem escala numérica.';
}

/** Identificador de efeito: sem pontos, chaves nem espaços (são delimitadores dos marcadores de texto). */
const idValido = (texto: string): string => texto.trim().replace(/[.{}\s]+/g, '_');

/**
 * Efeitos escaláveis do poder (alcance, absorção, criaturas etc.): valor = fixo + por ponto × ⌊nível ÷ a cada⌋.
 * Cada efeito vira o marcador `{poder.<id do poder>.<id do efeito>}` nos textos da batalha.
 */
function secaoEfeitos(ctx: Contexto, p: Poder): HTMLElement {
  const lista = h('ul', { class: 'lista-efeitos' });
  const efeitos = (): EfeitoEscalavel[] => (p.escala ??= {}).efeitos ??= [];

  const desenhar = (focar = false): void => {
    limpar(lista);
    const atuais = p.escala?.efeitos ?? [];
    if (atuais.length === 0) lista.append(h('li', { class: 'vazio' }, 'Nenhum efeito escalável cadastrado.'));
    atuais.forEach((x, i) => {
      const valor = h('strong', { class: 'valor-efeito' });
      ctx.ligar(() => {
        const e = efeitosDoPoder(p).find((y) => y.id === x.id);
        definirTexto(valor, e ? `No nível ${p.nivel ?? 0}: ${formatarNumero(e.valor)}${x.unidade ? ` ${x.unidade}` : ''}` : 'Id repetido: vale o primeiro.');
      });
      const numero = (rotulo: string, atual: number | undefined, gravar: (v: number | null) => void, min?: number): HTMLElement =>
        campo(rotulo, entradaNumero(atual ?? null, (v) => { gravar(v); ctx.mudou(); }, { aceitaVazio: true, min }));
      const id = entradaTexto(x.id, (v) => { x.id = idValido(v); ctx.mudou(); }, 'id_do_efeito');
      id.addEventListener('change', () => { id.value = x.id; });
      lista.append(h('li', { class: 'item-efeito', role: 'group', 'aria-label': `Efeito ${i + 1}` },
        h('div', { class: 'campos' },
          campo('Rótulo', entradaTexto(x.rotulo, (v) => { x.rotulo = v; ctx.mudou(); }, 'Ex.: Criaturas protegidas')),
          campo('Id (usado nos marcadores)', id),
          numero('Por ponto', x.porPonto, (v) => { x.porPonto = v ?? 0; }),
          numero('Fixo (ajuste)', x.fixo, (v) => { if (v === null) delete x.fixo; else x.fixo = v; }),
          numero('A cada N níveis (vazio = 1)', x.aCada, (v) => { if (v === null) delete x.aCada; else x.aCada = v; }, 1),
          campo('Unidade', entradaTexto(x.unidade ?? '', (v) => { if (v === '') delete x.unidade; else x.unidade = v; ctx.mudou(); }, 'km², criaturas'))),
        h('p', { class: 'detalhe' }, valor),
        h('button', {
          type: 'button', class: 'remover', 'aria-label': `Remover o efeito ${x.rotulo || i + 1}`,
          onclick: () => { efeitos().splice(i, 1); desenhar(); ctx.mudou(); },
        }, 'Remover efeito')));
    });
    if (focar) lista.lastElementChild?.querySelector<HTMLElement>('input')?.focus();
  };
  desenhar();

  return h('div', { class: 'efeitos-poder' },
    h('h4', {}, 'Efeitos por nível'),
    h('p', { class: 'detalhe' },
      'Valor = fixo + por ponto × ⌊nível ÷ a cada⌋. Os efeitos de ataque, defesa, dano, atributo, PV e usos são os coeficientes acima; aqui ficam os demais.'),
    lista,
    h('button', {
      type: 'button',
      onclick: () => {
        efeitos().push({ id: `efeito_${efeitos().length + 1}`, rotulo: 'Novo efeito', porPonto: 0 });
        desenhar(true);
        ctx.mudou();
      },
    }, 'Adicionar efeito'));
}

/** Patamares do poder: a partir de certo nível vale um texto (aceita marcadores vivos). A aba Batalha mostra os atingidos e o próximo. */
function secaoPatamares(ctx: Contexto, p: Poder): HTMLElement {
  const lista = h('ul', { class: 'lista-efeitos' });
  const patamares = (): PatamarPoder[] => (p.escala ??= {}).patamares ??= [];

  const desenhar = (focar = false): void => {
    limpar(lista);
    const atuais = p.escala?.patamares ?? [];
    if (atuais.length === 0) lista.append(h('li', { class: 'vazio' }, 'Nenhum patamar cadastrado.'));
    atuais.forEach((x, i) => {
      const texto = h('textarea', { rows: 2 });
      texto.value = x.texto;
      texto.addEventListener('input', () => { x.texto = texto.value; ctx.mudou(); });
      lista.append(h('li', { class: 'item-efeito', role: 'group', 'aria-label': `Patamar ${i + 1}` },
        h('div', { class: 'campos' },
          campo('A partir do nível', entradaNumero(x.nivel, (v) => { x.nivel = v ?? 0; ctx.mudou(); }, { min: 0 })),
          campo('Texto', texto)),
        previaViva(ctx, () => x.texto),
        h('button', {
          type: 'button', class: 'remover', 'aria-label': `Remover o patamar do nível ${x.nivel}`,
          onclick: () => { patamares().splice(i, 1); desenhar(); ctx.mudou(); },
        }, 'Remover patamar')));
    });
    if (focar) lista.lastElementChild?.querySelector<HTMLElement>('input')?.focus();
  };
  desenhar();

  return h('div', { class: 'efeitos-poder' },
    h('h4', {}, 'Patamares'),
    lista,
    h('button', {
      type: 'button',
      onclick: () => {
        const ultimo = patamares().reduce((m, x) => Math.max(m, x.nivel), 0);
        patamares().push({ nivel: ultimo + 1, texto: '' });
        desenhar(true);
        ctx.mudou();
      },
    }, 'Adicionar patamar'));
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
      campo('Valor do atributo por nível', valor)),
    secaoEfeitos(ctx, p),
    secaoPatamares(ctx, p));
}

/** Descrição do poder com os marcadores resolvidos no nível atual (o texto cru só aparece ao editar). */
function resolvida(ctx: Contexto, obter: () => string): HTMLElement {
  const p = h('p', { class: 'descricao descricao-resolvida' });
  ctx.ligar(() => definirTexto(p, resolverTexto(ctx.ficha(), obter()) || 'Sem descrição.'));
  return p;
}

/** "Proteção Divina 2 — nível informado (poderes livres)": o nível é o informado; o pilar não concede poderes (refeita a cada mudança). */
function linhaPilar(ctx: Contexto, p: Poder): HTMLElement {
  const linha = h('p', { class: 'detalhe nivel-pilar' });
  ctx.ligar(() => definirTexto(linha, composicaoDoPoder(ctx.ficha(), p).texto));
  return linha;
}

/** Pontos de poder ganhos nos níveis ímpares (regra do livro) e ainda não gastos; editáveis, para o jogador ajustar. */
function cartaoPontosDePoder(ctx: Contexto): HTMLElement {
  const entrada = entradaNumero(ctx.ficha().pontosDePoderDisponiveis, (v) => { ctx.ficha().pontosDePoderDisponiveis = v ?? 0; ctx.mudou(); }, { min: 0 });
  ctx.ligar(() => definirValor(entrada, String(ctx.ficha().pontosDePoderDisponiveis)));
  return h('section', { class: 'cartao pontos-de-poder', 'aria-label': 'Pontos de poder disponíveis' },
    h('h3', {}, 'Pontos de poder disponíveis'),
    h('div', { class: 'campos' }, campo('Pontos de poder disponíveis', entrada)),
    h('p', { class: 'detalhe' },
      'Cada nível ímpar ganho pela regra do livro dá +1 ponto de poder. Ao aumentar o nível de um poder livre, o app oferece descontar os pontos disponíveis; '
      + 'você pode recusar e ajustar o número aqui.'));
}

export function abaPoderes(ctx: Contexto): HTMLElement {
  const f = ctx.ficha;
  const lista = h('div', { class: 'lista-poderes' });

  const cartao = (p: Poder, i: number): HTMLElement => {
    const nome = entradaTexto(p.nome, (v) => { p.nome = v; ctx.mudou(); }, 'Nome do poder');
    const raiz = h('article', { class: p.tipo === 'removido' ? 'cartao poder removido' : 'cartao poder' });
    const marca = h('input', { type: 'checkbox', checked: mostraNaBatalha(p), disabled: p.tipo === 'removido' });
    marca.addEventListener('change', () => { p.mostrarNaBatalha = marca.checked; ctx.mudou(); });
    const reativar = h('button', {
      type: 'button', class: 'destaque',
      onclick: () => {
        // Volta como ativo se o poder tem usos ou custo; senão, como passivo (o jogador ajusta o tipo se quiser).
        const consumivel = p.custoFadiga !== undefined || p.usosPorDia !== undefined || p.escala?.usosPorNivel !== undefined;
        p.tipo = consumivel ? 'ativo' : 'passivo';
        tipo.value = p.tipo;
        raiz.classList.remove('removido');
        marca.checked = mostraNaBatalha(p);
        marca.disabled = false;
        reativar.hidden = true;
        ctx.mudou();
      },
    }, 'Reativar poder');
    reativar.hidden = p.tipo !== 'removido';
    const tipo = selecao<TipoPoder>(TIPOS.map((t) => [t, ROTULO_TIPO_PODER[t]]), p.tipo, (v) => {
      p.tipo = v;
      raiz.classList.toggle('removido', v === 'removido');
      // Sem escolha explícita, a marca segue o tipo (defesa e item aparecem por padrão).
      marca.checked = mostraNaBatalha(p);
      marca.disabled = v === 'removido';
      reativar.hidden = v !== 'removido';
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
    const entradaNivel = entradaNumero(p.nivel, (v) => { p.nivel = v; ctx.mudou(); }, { min: 0, aceitaVazio: true });
    // Ao confirmar um nível maior em poder livre, oferece descontar os pontos de poder disponíveis (nunca bloqueia a edição).
    let nivelConfirmado = p.nivel ?? 0;
    entradaNivel.addEventListener('change', () => {
      const aumento = (p.nivel ?? 0) - nivelConfirmado;
      nivelConfirmado = p.nivel ?? 0;
      const livre = (p.origem ?? (p.tipo === 'item' ? 'item' : 'livre')) === 'livre' && p.tipo !== 'removido';
      const disponiveis = f().pontosDePoderDisponiveis;
      if (aumento <= 0 || !livre || disponiveis <= 0) return;
      const gastar = Math.min(aumento, disponiveis);
      if (!window.confirm(`Descontar ${gastar} ponto(s) de poder dos ${disponiveis} disponíveis?`)) return;
      f().pontosDePoderDisponiveis = disponiveis - gastar;
      ctx.mudou();
      ctx.avisar(`${gastar} ponto(s) de poder descontado(s): restam ${f().pontosDePoderDisponiveis}.`);
    });
    raiz.append(
      h('div', { class: 'campos' },
        campo('Nome', nome),
        campo('Nível (vazio = sem nível)', entradaNivel),
        campo('Origem', selecao<OrigemPoder>(ORIGENS.map((o) => [o, ROTULO_ORIGEM[o]]), p.origem ?? 'livre', (v) => { p.origem = v; ctx.mudou(); })),
        campo('Tipo', tipo),
        campo('Custo de fadiga', entradaOpcional('custoFadiga')),
        campo('Usos por dia', usos),
        campo('Pilar mínimo (vazio = nenhum)', entradaNumero(p.requerPilar ?? null, (v) => {
          if (v === null) delete p.requerPilar;
          else p.requerPilar = v;
          ctx.mudou();
        }, { min: 0, aceitaVazio: true }))),
      linhaPilar(ctx, p),
      reativar,
      resolvida(ctx, () => p.descricao),
      h('details', { class: 'descricao-poder' },
        h('summary', {}, 'Editar descrição (texto com marcadores)'),
        campo('Descrição', descricao),
        previaViva(ctx, () => p.descricao)),
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
    cartaoPontosDePoder(ctx),
    h('p', { class: 'detalhe' },
      'Só entram no painel de sessão os poderes com custo de fadiga ou usos por dia e tipo diferente de Removido. Poderes de defesa e itens aparecem por padrão na aba Batalha; os demais, se marcados.'),
    lista,
    h('button', {
      type: 'button', class: 'destaque',
      onclick: () => {
        f().poderes.push({ id: novoIdItem('poder'), nome: 'Novo poder', nivel: null, origem: 'manual', tipo: 'passivo', descricao: '' });
        desenhar(f().poderes.length - 1);
        ctx.mudou();
      },
    }, 'Adicionar poder'),
    secaoTextosBatalha(ctx));
}
