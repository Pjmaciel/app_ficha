// Aba Batalha: tudo o que se consulta durante a luta, em uma tela só e com valores prontos.
// Ordem: Minha rodada, Ataques, Defesas, Absorções e proteções, Quando for atacado e Lembretes.
// A estrutura (quantos cartões) vem da ficha ao abrir a aba; os valores são refeitos a cada mudança.
import { poderUsavel, resumoBatalha, usoDoPoder, usosPorDiaDoPoder, type ResumoBatalha } from '../../engine';
import type { ChaveCombate, Poder } from '../../model/types';
import type { Contexto } from '../contexto';
import { campo, definirTexto, definirValor, entradaNumero, h, inteiro, limpar } from '../dom';
import { aplicarPv, descansar, limitarPv, mudarFadiga, usarPoder } from '../sessao';
import { cartaoValor, linhasCombate, linhasDano } from './resumo';

const kmQuadrados = (n: number): string => `${n.toLocaleString('pt-BR')} km²`;

/** Linha de uso de um poder: "2 de 3 restantes" e o botão Usar (que se desativa ao esgotar). */
function controleUso(ctx: Contexto, poderId: string, rotuloNome?: string): HTMLElement {
  const poder = (): Poder | undefined => ctx.ficha().poderes.find((p) => p.id === poderId);
  const texto = h('span', { class: 'detalhe' });
  const botao = h('button', { type: 'button', class: 'destaque grande', 'data-uso-batalha': poderId });
  botao.addEventListener('click', () => { const p = poder(); if (p) usarPoder(ctx, p); });
  ctx.ligar(() => {
    const p = poder();
    if (!p) return;
    const uso = usoDoPoder(p, ctx.sessao());
    const partes = [
      uso.limite !== null ? `${uso.restantes} de ${uso.limite} restantes` : `${uso.usados} usos`,
      uso.custoFadiga > 0 ? `custo ${uso.custoFadiga} de fadiga` : '',
    ].filter(Boolean);
    definirTexto(texto, partes.join(' · '));
    definirTexto(botao, uso.esgotado ? 'Esgotado' : 'Usar');
    botao.disabled = uso.esgotado;
    botao.setAttribute('aria-label', `Usar ${p.nome || 'poder'}`);
  });
  return h('div', { class: 'linha-uso' },
    rotuloNome ? h('span', { class: 'nome-uso' }, rotuloNome) : null,
    texto, botao);
}

/** Bloco de PV: valor atual editável, total, barra e os botões de dano e cura rápidos. */
function blocoPv(ctx: Contexto): HTMLElement {
  const campoPv = entradaNumero(ctx.sessao().pvAtual, (v) => {
    ctx.sessao().pvAtual = limitarPv(ctx, v ?? 0);
    ctx.mudou();
  }, { min: 0 });
  campoPv.addEventListener('change', () => definirValor(campoPv, String(ctx.sessao().pvAtual)));
  const valor = entradaNumero(10, () => {}, { min: 0 });
  const total = h('span', {});
  const preenchimento = h('div', { class: 'preenchimento' });
  const barra = h('div', { class: 'barra pv', role: 'progressbar', 'aria-label': 'Pontos de vida', 'aria-valuemin': 0 }, preenchimento);
  ctx.ligar(() => {
    const max = resumoBatalha(ctx.ficha(), ctx.sessao()).pv.total;
    const atual = ctx.sessao().pvAtual;
    definirValor(campoPv, String(atual));
    definirTexto(total, ` / ${max}`);
    preenchimento.style.width = `${max > 0 ? Math.max(0, Math.min(100, (atual / max) * 100)) : 0}%`;
    barra.setAttribute('aria-valuemax', String(max));
    barra.setAttribute('aria-valuenow', String(atual));
  });
  const quantia = (): number => Math.max(0, inteiro(valor.value, 0));
  return h('div', { class: 'bloco' },
    h('div', { class: 'linha-titulo' },
      h('span', { class: 'rotulo' }, 'PV atual'),
      h('span', { class: 'numeros' }, campo('PV atual', campoPv, true), total)),
    barra,
    h('div', { class: 'controles' },
      h('button', { type: 'button', class: 'perigo grande', onclick: () => aplicarPv(ctx, -quantia()) }, 'Dano'),
      campo('Valor de dano ou cura', valor, true),
      h('button', { type: 'button', class: 'cura grande', onclick: () => aplicarPv(ctx, quantia()) }, 'Cura')));
}

/** Bloco de fadiga: valor atual e botões para gastar e recuperar. */
function blocoFadiga(ctx: Contexto): HTMLElement {
  const campoFadiga = entradaNumero(ctx.sessao().fadiga, (v) => { ctx.sessao().fadiga = Math.max(0, v ?? 0); ctx.mudou(); }, { min: 0 });
  campoFadiga.addEventListener('change', () => definirValor(campoFadiga, String(ctx.sessao().fadiga)));
  ctx.ligar(() => definirValor(campoFadiga, String(ctx.sessao().fadiga)));
  const passo = entradaNumero(5, () => {}, { min: 1 });
  const quantia = (): number => Math.max(0, inteiro(passo.value, 0));
  return h('div', { class: 'bloco' },
    h('div', { class: 'linha-titulo' }, h('span', { class: 'rotulo' }, 'Fadiga'), h('span', { class: 'numeros' }, campo('Fadiga', campoFadiga, true))),
    h('div', { class: 'controles' },
      h('button', { type: 'button', class: 'grande', onclick: () => mudarFadiga(ctx, quantia()) }, 'Gastar'),
      campo('Quantidade de fadiga', passo, true),
      h('button', { type: 'button', class: 'grande', onclick: () => mudarFadiga(ctx, -quantia()) }, 'Recuperar')));
}

function cartaoMinhaRodada(ctx: Contexto, r: () => ResumoBatalha): HTMLElement {
  const mini = (rotulo: string, texto: (x: ResumoBatalha) => string): HTMLElement => {
    const valor = h('strong', {});
    ctx.ligar(() => definirTexto(valor, texto(r())));
    return h('div', { class: 'tile' }, h('span', { class: 'rotulo' }, rotulo), valor);
  };
  const usaveis = ctx.ficha().poderes.filter(poderUsavel);
  return h('section', { class: 'cartao destaque-cartao minha-rodada', 'aria-label': 'Minha rodada' },
    h('h2', {}, 'Minha rodada'),
    h('div', { class: 'grade grade-larga' }, blocoPv(ctx), blocoFadiga(ctx)),
    h('div', { class: 'visao', role: 'group', 'aria-label': 'Dados da rodada' },
      mini('Rolagem base', (x) => x.rolagemBase),
      mini('Arma principal', (x) => x.armaPrincipal || '—'),
      mini('Velocidade Divina', (x) => (x.velocidadeDivina === null ? '—' : `nível ${x.velocidadeDivina}`))),
    usaveis.length > 0
      ? h('div', { class: 'bloco' },
        h('span', { class: 'rotulo' }, 'Usos restantes'),
        h('ul', { class: 'usos-batalha' }, ...usaveis.map((p) =>
          h('li', {}, controleUso(ctx, p.id, p.nome || 'Sem nome')))))
      : null,
    h('button', { type: 'button', class: 'grande', onclick: () => descansar(ctx) }, 'Descansar (zera fadiga e usos)'));
}

function cartaoAtaqueNormal(ctx: Contexto, r: () => ResumoBatalha): HTMLElement {
  const f = ctx.ficha;
  return h('section', { class: 'cartao', 'aria-label': 'Ataque normal' },
    h('h3', {}, 'Ataque normal'),
    h('div', { class: 'grade grade-larga' },
      cartaoValor(ctx, {
        chave: 'bat-ataque', titulo: 'Ataque', destaque: true,
        texto: () => r().ataqueBasico.texto,
        detalhe: () => (r().armaPrincipal ? `Arma: ${r().armaPrincipal}` : 'Sem arma principal definida'),
        linhas: () => linhasCombate(f(), 'ataqueArmaBranca'),
      }),
      cartaoValor(ctx, {
        chave: 'bat-dano', titulo: 'Dano', destaque: true,
        texto: () => r().danoBasico.texto,
        linhas: () => linhasDano(f()),
      })));
}

function cartaoGolpe(ctx: Contexto, r: () => ResumoBatalha, indice: number): HTMLElement {
  const f = ctx.ficha;
  const atual = () => f().golpes[indice];
  const golpe = () => r().golpes[indice];
  const pressao = h('p', { class: 'detalhe' });
  ctx.ligar(() => {
    const g = golpe();
    if (!g) return;
    const partes = [
      g.pontos !== null ? `${g.pontos} ${g.pontos === 1 ? 'ponto' : 'pontos'}` : '',
      g.pressaoKm2 !== null ? `pressão de ${kmQuadrados(g.pressaoKm2)}` : '',
    ].filter(Boolean);
    definirTexto(pressao, partes.join(' · '));
  });
  const nome = atual().nome;
  return h('section', { class: 'cartao golpe', 'aria-label': `Golpe especial ${nome}` },
    h('h3', {}, nome),
    h('div', { class: 'grade grade-larga' },
      cartaoValor(ctx, {
        chave: `bat-golpe-${atual().id}-ataque`, titulo: 'Ataque',
        texto: () => golpe().ataque.texto,
        linhas: () => linhasCombate(f(), 'ataqueArmaBranca', atual()),
      }),
      cartaoValor(ctx, {
        chave: `bat-golpe-${atual().id}-dano`, titulo: 'Dano',
        texto: () => golpe().dano.texto,
        linhas: () => linhasDano(f(), atual()),
      })),
    pressao,
    f().poderes.some((p) => p.id === atual().id && poderUsavel(p) && usosPorDiaDoPoder(p) !== undefined)
      ? controleUso(ctx, atual().id)
      : null);
}

/** Cartão de ação: nome, rolagem e notas já com os marcadores vivos resolvidos (refeito a cada mudança). */
function cartaoAcao(ctx: Contexto, r: () => ResumoBatalha, indice: number): HTMLElement {
  const nome = h('h3', {});
  const rolagem = h('p', { class: 'valor-medio' });
  const notas = h('p', { class: 'detalhe' });
  ctx.ligar(() => {
    const a = r().acoes[indice];
    if (!a) return;
    definirTexto(nome, a.nome || 'Sem nome');
    definirTexto(rolagem, a.rolagem);
    rolagem.hidden = !a.rolagem;
    definirTexto(notas, a.notas);
    notas.hidden = !a.notas;
  });
  return h('article', { class: 'cartao acao' }, nome, rolagem, notas);
}

function secaoAtaques(ctx: Contexto, r: () => ResumoBatalha): HTMLElement {
  const acoes = ctx.ficha().acoes;
  return h('section', { 'aria-label': 'Ataques' },
    h('h2', {}, 'Ataques'),
    cartaoAtaqueNormal(ctx, r),
    ...ctx.ficha().golpes.map((_, i) => cartaoGolpe(ctx, r, i)),
    acoes.length > 0 ? h('h3', { class: 'subtitulo' }, 'Ações de Tsu real e outras') : null,
    acoes.length > 0 ? h('div', { class: 'grade grade-larga' }, ...acoes.map((_, i) => cartaoAcao(ctx, r, i))) : null);
}

function secaoDefesas(ctx: Contexto, r: () => ResumoBatalha): HTMLElement {
  const chaves: ChaveCombate[] = ['aparar', 'bloquear', 'esquivar'];
  return h('section', { 'aria-label': 'Defesas' },
    h('h2', {}, 'Defesas'),
    h('div', { class: 'grade' }, ...chaves.map((chave, i) =>
      cartaoValor(ctx, {
        chave: `bat-defesa-${chave}`, titulo: r().defesas[i].nome,
        texto: () => r().defesas[i].rolagem.texto,
        linhas: () => linhasCombate(ctx.ficha(), chave),
      }))));
}

/**
 * Card de absorção de um poder, gerado dos efeitos no nível atual (valores refeitos a cada mudança), com os patamares
 * atingidos e o próximo. A descrição do poder fica recolhida: ela é texto livre e pode ter números da planilha.
 */
function cartaoProtecao(ctx: Contexto, r: () => ResumoBatalha, id: string, temUso: boolean): HTMLElement {
  const proteger = (): ResumoBatalha['protecoes'][number] | undefined => r().protecoes.find((x) => x.id === id);
  const titulo = h('h3', {});
  const efeitos = h('ul', { class: 'efeitos-protecao', 'aria-label': 'Efeitos no nível atual' });
  const patamares = h('ul', { class: 'patamares', 'aria-label': 'Patamares' });
  const proximo = h('p', { class: 'proximo-patamar' });
  const descricao = h('p', { class: 'descricao' });
  const bloco = h('details', { class: 'descricao-poder' }, h('summary', {}, 'Descrição do poder'), descricao);
  ctx.ligar(() => {
    const p = proteger();
    if (!p) return;
    limpar(titulo);
    titulo.append(p.nome || 'Sem nome');
    if (p.nivel !== null) titulo.append(h('span', { class: 'detalhe' }, ` · nível ${p.nivel}`));
    limpar(efeitos);
    for (const e of p.efeitos) efeitos.append(h('li', {}, e.texto));
    efeitos.hidden = p.efeitos.length === 0;
    limpar(patamares);
    for (const x of p.patamares.filter((y) => y.atingido)) patamares.append(h('li', { class: 'atingido' }, `Nível ${x.nivel}: ${x.texto}`));
    patamares.hidden = patamares.childElementCount === 0;
    definirTexto(proximo, p.proximoPatamar ? `Próximo patamar: nível ${p.proximoPatamar.nivel}, ${p.proximoPatamar.texto}` : '');
    proximo.hidden = p.proximoPatamar === null;
    definirTexto(descricao, p.descricao || 'Sem descrição.');
  });
  return h('article', { class: 'cartao protecao' }, titulo, efeitos, patamares, proximo, bloco, temUso ? controleUso(ctx, id) : null);
}

function secaoProtecoes(ctx: Contexto, r: () => ResumoBatalha): HTMLElement {
  const protecoes = r().protecoes;
  return h('section', { 'aria-label': 'Absorções e proteções' },
    h('h2', {}, 'Absorções e proteções'),
    protecoes.length === 0
      ? h('p', { class: 'vazio' }, 'Nenhum poder marcado para aparecer aqui. Marque "Mostrar na aba Batalha" na aba Poderes.')
      : h('div', { class: 'grade grade-larga' }, ...protecoes.map((p) => cartaoProtecao(ctx, r, p.id, p.uso !== null))));
}

function secaoQuandoAtacado(ctx: Contexto, r: () => ResumoBatalha): HTMLElement {
  const defesas = h('p', { class: 'resumo' });
  ctx.ligar(() => definirTexto(defesas, r().defesas.map((d) => `${d.nome} ${d.rolagem.texto}`).join(' · ')));
  const reacoes = ctx.ficha().reacoes;
  return h('section', { class: 'cartao', 'aria-label': 'Quando for atacado' },
    h('h2', {}, 'Quando for atacado'),
    defesas,
    reacoes.length === 0
      ? h('p', { class: 'vazio' }, 'Nenhuma reação cadastrada.')
      : h('ul', { class: 'reacoes' }, ...reacoes.map((_, i) => {
        const situacao = h('strong', {});
        const resposta = h('span', {});
        ctx.ligar(() => {
          const x = r().reacoes[i];
          if (!x) return;
          definirTexto(situacao, x.situacao || 'Sem situação');
          definirTexto(resposta, x.resposta);
        });
        return h('li', {}, situacao, resposta);
      })));
}

function secaoLembretes(ctx: Contexto, r: () => ResumoBatalha): HTMLElement {
  const lembretes = ctx.ficha().lembretes;
  return h('section', { class: 'cartao', 'aria-label': 'Lembretes' },
    h('h2', {}, 'Lembretes'),
    lembretes.length === 0
      ? h('p', { class: 'vazio' }, 'Nenhum lembrete cadastrado.')
      : h('ul', { class: 'lembretes' }, ...lembretes.map((_, i) => {
        const item = h('li', {});
        ctx.ligar(() => definirTexto(item, r().lembretes[i] ?? ''));
        return item;
      })));
}

export function abaBatalha(ctx: Contexto): HTMLElement {
  const r = (): ResumoBatalha => resumoBatalha(ctx.ficha(), ctx.sessao());
  return h('div', { class: 'aba-batalha' },
    cartaoMinhaRodada(ctx, r),
    secaoAtaques(ctx, r),
    secaoDefesas(ctx, r),
    secaoProtecoes(ctx, r),
    secaoQuandoAtacado(ctx, r),
    secaoLembretes(ctx, r),
    h('p', { class: 'detalhe' }, 'Ações, reações e lembretes são editados na aba Poderes, na seção "Textos da batalha".'));
}
