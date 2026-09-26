// Aba Batalha: tudo o que se consulta durante a luta, em uma tela só e com valores prontos.
// Ordem: Minha rodada, Ataques, Defesas, Absorções e proteções, Quando for atacado e Lembretes.
// A estrutura (quantos cartões) vem da ficha ao abrir a aba; os valores são refeitos a cada mudança.
import { poderUsavel, resumoBatalha, usoDoPoder, usosPorDiaDoPoder, type ResumoBatalha } from '../../engine';
import type { ChaveCombate, Poder } from '../../model/types';
import type { Contexto } from '../contexto';
import { campo, definirTexto, definirValor, entradaNumero, h, inteiro } from '../dom';
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

function cartaoAcao(a: { nome: string; rolagem: string; notas: string }): HTMLElement {
  return h('article', { class: 'cartao acao' },
    h('h3', {}, a.nome || 'Sem nome'),
    a.rolagem ? h('p', { class: 'valor-medio' }, a.rolagem) : null,
    a.notas ? h('p', { class: 'detalhe' }, a.notas) : null);
}

function secaoAtaques(ctx: Contexto, r: () => ResumoBatalha): HTMLElement {
  const acoes = ctx.ficha().acoes;
  return h('section', { 'aria-label': 'Ataques' },
    h('h2', {}, 'Ataques'),
    cartaoAtaqueNormal(ctx, r),
    ...ctx.ficha().golpes.map((_, i) => cartaoGolpe(ctx, r, i)),
    acoes.length > 0 ? h('h3', { class: 'subtitulo' }, 'Ações de Tsu real e outras') : null,
    acoes.length > 0 ? h('div', { class: 'grade grade-larga' }, ...acoes.map(cartaoAcao)) : null);
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

function secaoProtecoes(ctx: Contexto, r: () => ResumoBatalha): HTMLElement {
  const protecoes = r().protecoes;
  return h('section', { 'aria-label': 'Absorções e proteções' },
    h('h2', {}, 'Absorções e proteções'),
    protecoes.length === 0
      ? h('p', { class: 'vazio' }, 'Nenhum poder marcado para aparecer aqui. Marque "Mostrar na aba Batalha" na aba Poderes.')
      : h('div', { class: 'grade grade-larga' }, ...protecoes.map((p) =>
        h('article', { class: 'cartao protecao' },
          h('h3', {}, p.nome || 'Sem nome', p.nivel !== null ? h('span', { class: 'detalhe' }, ` · nível ${p.nivel}`) : null),
          h('p', { class: 'descricao' }, p.descricao || 'Sem descrição.'),
          p.uso ? controleUso(ctx, p.id) : null))));
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
      : h('ul', { class: 'reacoes' }, ...reacoes.map((x) =>
        h('li', {}, h('strong', {}, x.situacao || 'Sem situação'), h('span', {}, x.resposta)))));
}

function secaoLembretes(ctx: Contexto): HTMLElement {
  const lembretes = ctx.ficha().lembretes;
  return h('section', { class: 'cartao', 'aria-label': 'Lembretes' },
    h('h2', {}, 'Lembretes'),
    lembretes.length === 0
      ? h('p', { class: 'vazio' }, 'Nenhum lembrete cadastrado.')
      : h('ul', { class: 'lembretes' }, ...lembretes.map((t) => h('li', {}, t))));
}

export function abaBatalha(ctx: Contexto): HTMLElement {
  const r = (): ResumoBatalha => resumoBatalha(ctx.ficha(), ctx.sessao());
  return h('div', { class: 'aba-batalha' },
    cartaoMinhaRodada(ctx, r),
    secaoAtaques(ctx, r),
    secaoDefesas(ctx, r),
    secaoProtecoes(ctx, r),
    secaoQuandoAtacado(ctx, r),
    secaoLembretes(ctx),
    h('p', { class: 'detalhe' }, 'Ações, reações e lembretes são editados na aba Poderes, na seção "Textos da batalha".'));
}
